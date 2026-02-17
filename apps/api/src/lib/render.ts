import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { refractor } from "refractor/lib/core.js";
import javascript from "refractor/lang/javascript.js";
import typescript from "refractor/lang/typescript.js";
import tsx from "refractor/lang/tsx.js";
import jsx from "refractor/lang/jsx.js";
import json from "refractor/lang/json.js";
import bash from "refractor/lang/bash.js";
import rust from "refractor/lang/rust.js";
import sqlLang from "refractor/lang/sql.js";
import markdownLang from "refractor/lang/markdown.js";
import { visit } from "unist-util-visit";
import { toText } from "hast-util-to-text";
import type { EmbedOptions } from "./embeds.js";

export interface RenderOptions {
  embedAllowlist: Set<string>;
  embed: (provider: string, value: string, opts: EmbedOptions) => string;
  includeSourceMap?: boolean;
}

export interface RenderedContent {
  html: string;
  text: string;
}

type MdRoot = any;
type MdContent = any;
type MdText = any;
type HastRoot = any;
type Element = any;
type HastText = any;

refractor.register(javascript);
refractor.register(typescript);
refractor.register(tsx);
refractor.register(jsx);
refractor.register(json);
refractor.register(bash);
refractor.register(rust);
refractor.register(sqlLang);
refractor.register(markdownLang);

export async function renderPostContent(
  markdown: string,
  options: RenderOptions
): Promise<RenderedContent> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBitlogShortcodes, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw);

  if (options.includeSourceMap) processor.use(rehypeBitlogSourceMap);

  processor
    .use(rehypeBitlogHeadingIds)
    .use(rehypeBitlogHighlight)
    .use(rehypeBitlogSanitize, { embedAllowlist: options.embedAllowlist })
    .use(rehypeStringify, { allowDangerousHtml: false });

  const hast = (await processor.run(processor.parse(markdown))) as HastRoot;
  const html = String(await processor.stringify(hast));
  const text = toText(hast).toLowerCase();
  return { html, text };
}

function rehypeBitlogSourceMap() {
  return function transformer(tree: HastRoot) {
    visit(tree, "element", (node: Element) => {
      const pos = (node as any).position;
      const line = pos?.start?.line;
      if (typeof line !== "number" || !Number.isFinite(line) || line <= 0) return;
      const props = (node.properties ??= {});
      if ((props as any)["data-line"] || (props as any).dataLine) return;
      (props as any)["data-line"] = Math.trunc(line);
    });
  };
}

function rehypeBitlogHeadingIds() {
  return function transformer(tree: HastRoot) {
    const seen = new Map<string, number>();
    visit(tree, "element", (node: Element) => {
      const tag = String(node.tagName ?? "").toLowerCase();
      if (!/^h[1-6]$/.test(tag)) return;

      const props = (node.properties ??= {});
      if (props.id) return;

      const headingText = String(toText(node) ?? "").trim();
      const base = slugifyHeadingId(headingText);
      if (!base) return;

      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      props.id = n === 1 ? base : `${base}-${n}`;
    });
  };
}

function slugifyHeadingId(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 64);
}

function rehypeBitlogHighlight() {
  return function transformer(tree: HastRoot) {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const code = (node.children ?? []).find((child: any) => {
        return child?.type === "element" && child.tagName === "code";
      }) as Element | undefined;
      if (!code) return;

      const classList = normalizeClassList(code.properties?.className);
      const lang =
        classList.find((c) => c.startsWith("language-"))?.slice("language-".length) ??
        classList.find((c) => c.startsWith("lang-"))?.slice("lang-".length) ??
        null;
      if (!lang) return;

      const text = extractText(code);
      if (!text) return;
      try {
        const highlighted = refractor.highlight(text, lang) as any;
        const children = Array.isArray(highlighted) ? highlighted : highlighted?.children;
        if (!Array.isArray(children) || children.length === 0) return;
        code.children = children as any;
        code.properties = { ...(code.properties ?? {}), className: ["language-" + lang] };
      } catch {
        // Unknown language → keep original.
      }
    });
  };
}

function normalizeClassList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value).split(/\s+/).filter(Boolean);
}

function extractText(code: Element): string {
  let out = "";
  for (const child of code.children ?? []) {
    if ((child as any).type === "text") out += (child as HastText).value ?? "";
    else if ((child as any).type === "element") out += extractText(child as Element);
  }
  return out;
}

function remarkBitlogShortcodes(options: RenderOptions) {
  return function transformer(tree: MdRoot) {
    visit(tree, "text", (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== "number") return;
      const value = node.value;
      if (!value.includes("||") && !value.includes("@[")) return;

      const replaced = splitTextToNodes(value, options);
      if (replaced.length === 1 && replaced[0]?.type === "text") return;
      (parent.children as MdContent[]).splice(index, 1, ...(replaced as MdContent[]));
      return index + replaced.length;
    });

    // Markdown will parse `@[provider](value)` as a plain `@` text node followed by a `link` node.
    // Convert that pair back into our embed shortcode.
    transformEmbedLinks(tree, options);
  };
}

function splitTextToNodes(value: string, options: RenderOptions): MdContent[] {
  // Supported inline syntaxes:
  // - blur: ||text||
  // - embed: @[provider](value)
  const out: MdContent[] = [];
  let i = 0;
  while (i < value.length) {
    const blurStart = value.indexOf("||", i);
    const embedStart = value.indexOf("@[", i);

    const next = minPositive(blurStart, embedStart);
    if (next === -1) {
      out.push({ type: "text", value: value.slice(i) } as MdText);
      break;
    }

    if (next > i) out.push({ type: "text", value: value.slice(i, next) } as MdText);

    if (next === blurStart) {
      const end = value.indexOf("||", blurStart + 2);
      if (end === -1) {
        out.push({ type: "text", value: value.slice(blurStart) } as MdText);
        break;
      }
      const inner = value.slice(blurStart + 2, end);
      out.push({ type: "html", value: `<span class="blur">${escapeHtml(inner)}</span>` } as any);
      i = end + 2;
      continue;
    }

    if (next === embedStart) {
      const closeBracket = value.indexOf("](", embedStart);
      const closeParen = closeBracket >= 0 ? value.indexOf(")", closeBracket + 2) : -1;
      if (closeBracket === -1 || closeParen === -1) {
        out.push({ type: "text", value: value.slice(embedStart) } as MdText);
        break;
      }
      const provider = value.slice(embedStart + 2, closeBracket);
      const payload = value.slice(closeBracket + 2, closeParen);
      const html = options.embed(provider, payload, { embedAllowlist: options.embedAllowlist });
      out.push({ type: "html", value: html } as any);
      i = closeParen + 1;
      continue;
    }
  }
  return out;
}

function transformEmbedLinks(node: any, options: RenderOptions) {
  if (!node || typeof node !== "object") return;
  const children = (node as any).children;
  if (!Array.isArray(children)) return;

  for (const child of children) transformEmbedLinks(child, options);

  for (let i = 1; i < children.length; i++) {
    const prev = children[i - 1];
    const cur = children[i];
    if (!prev || !cur) continue;
    if (cur.type !== "link") continue;
    if (prev.type !== "text" || typeof prev.value !== "string") continue;

    const prevValue: string = prev.value;
    if (!prevValue.endsWith("@")) continue;

    const provider = mdText(cur).trim();
    const payload = String(cur.url ?? "").trim();
    if (!provider || !payload) continue;

    const html = options.embed(provider, payload, { embedAllowlist: options.embedAllowlist });
    const atStripped = prevValue.slice(0, -1);
    if (atStripped) {
      prev.value = atStripped;
      children.splice(i, 1, { type: "html", value: html } as any);
    } else {
      children.splice(i - 1, 2, { type: "html", value: html } as any);
      i--;
    }
  }
}

function mdText(node: any): string {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text") return String(node.value ?? "");
  if (Array.isArray(node.children)) return node.children.map(mdText).join("");
  return "";
}

function minPositive(a: number, b: number): number {
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rehypeBitlogSanitize(options: { embedAllowlist: Set<string> }) {
  const allowedTags = new Set([
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
    "img",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "del",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "details",
    "summary",
    "span",
    "sup",
    "section",
    "iframe"
  ]);

  // HAST uses `className` (not `class`) for the HTML class attribute.
  const allowedGlobal = new Set(["class", "classname", "id", "title", "role"]);
  const allowedByTag: Record<string, Set<string>> = {
    a: new Set(["href", "rel", "target", "aria-label"]),
    img: new Set(["src", "alt", "width", "height", "loading", "decoding"]),
    code: new Set(["class"]),
    pre: new Set(["class"]),
    details: new Set(["open"]),
    iframe: new Set([
      "src",
      "loading",
      "referrerpolicy",
      "sandbox",
      "allow",
      "allowfullscreen",
      "data-bitlog-embed",
      "data-provider",
      "class"
    ])
  };

  function isDataOrAriaPropName(propName: string): boolean {
    const lower = propName.toLowerCase();
    if (lower.startsWith("data-") || lower.startsWith("aria-")) return true;
    // Some HAST conversions can camelCase unknown attributes (e.g. `data-foo-bar` -> `dataFooBar`).
    if (propName.startsWith("data") && /[A-Z]/.test(propName[4] ?? "")) return true;
    if (propName.startsWith("aria") && /[A-Z]/.test(propName[4] ?? "")) return true;
    return false;
  }

  function sanitizeNode(node: any): any | null {
    if (!node || typeof node !== "object") return null;
    if (node.type === "text") return node;
    if (node.type !== "element") {
      if (Array.isArray(node.children)) {
        node.children = node.children.map(sanitizeNode).filter(Boolean);
        return node;
      }
      return null;
    }

    const tag = String(node.tagName ?? "").toLowerCase();
    if (!allowedTags.has(tag)) return null;

    const props = (node.properties ??= {});
    for (const k of Object.keys(props)) {
      const key = k.toLowerCase();
      if (key === "style" || key.startsWith("on")) {
        delete (props as any)[k];
        continue;
      }
      if (isDataOrAriaPropName(k)) continue;
      if (allowedGlobal.has(key)) continue;
      if (allowedByTag[tag]?.has(key)) continue;
      delete (props as any)[k];
    }

    if (tag === "a") sanitizeHref(props as any);
    if (tag === "img") sanitizeImg(props as any);
    if (tag === "iframe") sanitizeIframe(props as any, options.embedAllowlist);
    if (tag === "iframe" && !props.src) return null;
    if (tag === "img" && !props.src) return null;

    if (Array.isArray(node.children)) {
      node.children = node.children.map(sanitizeNode).filter(Boolean);
    }
    return node;
  }

  return function transformer(tree: HastRoot) {
    if (!tree || !Array.isArray(tree.children)) return;
    tree.children = tree.children.map(sanitizeNode).filter(Boolean);
  };
}

function sanitizeHref(props: Record<string, unknown>) {
  const href = String(props.href ?? "");
  if (!href) return;
  if (href.startsWith("#")) return;
  try {
    const url = new URL(href, "https://example.com");
    const proto = url.protocol.toLowerCase();
    if (proto !== "http:" && proto !== "https:" && proto !== "mailto:") {
      delete props.href;
      return;
    }
    props.rel = "noopener noreferrer";
    if (proto === "http:" || proto === "https:") props.target = "_blank";
  } catch {
    delete props.href;
  }
}

function sanitizeImg(props: Record<string, unknown>) {
  const src = String(props.src ?? "");
  if (!src) return;
  try {
    const url = new URL(src, "https://example.com");
    const proto = url.protocol.toLowerCase();
    if (proto !== "http:" && proto !== "https:") delete props.src;
  } catch {
    delete props.src;
  }
}

function sanitizeIframe(props: Record<string, unknown>, allowlist: Set<string>) {
  const marker = String((props as any)["data-bitlog-embed"] ?? (props as any).dataBitlogEmbed ?? "");
  if (marker !== "1") {
    delete props.src;
    return;
  }
  const src = String(props.src ?? "");
  if (!src) return;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") {
      delete props.src;
      return;
    }
    const host = url.hostname.toLowerCase();
    if (!allowlist.has(host)) {
      delete props.src;
      return;
    }
    // Force safe defaults (ignore user-provided values).
    props.loading = "lazy";
    (props as any).referrerPolicy = "no-referrer";
    props.sandbox = "allow-scripts allow-same-origin allow-presentation allow-popups";
    (props as any).allowFullScreen = true;
    props.allow =
      "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  } catch {
    delete props.src;
  }
}
