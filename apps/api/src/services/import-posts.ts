import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";
import { randomId } from "../lib/crypto.js";
import { slugifyUnique } from "../lib/slug.js";
import { renderPostContent } from "../lib/render.js";
import { embedFromShortcode } from "../lib/embeds.js";
import { getSiteConfig } from "./settings.js";
import { parse as parseYaml } from "yaml";
import { parse as parseToml } from "smol-toml";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

type ImportSource = "md" | "wordpress";

export type ImportPostsResult = {
  ok: true;
  imported: number;
  skipped: number;
  failed: number;
  items: Array<
    | { ok: true; source: ImportSource; title: string; slug: string; action: "imported" | "skipped" }
    | { ok: false; source: ImportSource; path: string; error: string }
  >;
};

type MdFrontmatter = Record<string, unknown>;

function nowMs() {
  return Date.now();
}

function parseLooseBool(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function normalizeWhitespace(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function basicSlugify(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripHtmlToText(html: string): string {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSummaryFromText(text: string, maxLen = 150): string {
  const plain = normalizeWhitespace(text);
  if (!plain) return "";
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen) + "...";
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((x) => String(x ?? "").trim()).filter(Boolean);
  const s = String(value ?? "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function pickFirstString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const it of value) {
      const s = pickFirstString(it);
      if (s) return s;
    }
  }
  return null;
}

function normalizeSlug(raw: unknown): string | null {
  const s0 = typeof raw === "string" ? raw.trim() : "";
  if (!s0) return null;

  let s = s0;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname;
    } catch {
      // ignore
    }
  }
  s = s.replace(/[#?].*$/, "");
  s = s.replace(/^\/+|\/+$/g, "");
  if (!s) return null;
  const parts = s.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const out = basicSlugify(last);
  return out || null;
}

function slugFromFileName(path: string): string | null {
  const base = String(path ?? "").split("/").pop() ?? "";
  const name = base.replace(/\.[a-z0-9]+$/i, "");
  if (!name) return null;
  const stripped = name.replace(/^\d{4}-\d{2}-\d{2}[-_]/, "");
  const out = basicSlugify(stripped);
  return out || null;
}

function categoryFromPath(path: string): string | null {
  const parts = String(path ?? "").split("/").filter(Boolean);
  const i = parts.findIndex((p) => p.toLowerCase() === "content");
  if (i >= 0) {
    const next = parts[i + 1];
    return next ? String(next) : null;
  }
  // Hugo often uses content/<section>/...
  return null;
}

function coerceDateMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function splitFrontmatter(text: string): { meta: MdFrontmatter; body: string } {
  const src = String(text ?? "").replace(/^\uFEFF/, "");
  const lines = src.split(/\r?\n/);
  const first = lines[0] ?? "";
  const isYaml = first.trim() === "---";
  const isToml = first.trim() === "+++";
  if (!isYaml && !isToml) return { meta: {}, body: src };

  const delim = isYaml ? "---" : "+++";
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === delim) {
      end = i;
      break;
    }
  }
  if (end === -1) return { meta: {}, body: src };

  const rawMeta = lines.slice(1, end).join("\n");
  const body = lines.slice(end + 1).join("\n");
  try {
    const parsed = isToml ? (parseToml(rawMeta) as any) : (parseYaml(rawMeta) as any);
    if (parsed && typeof parsed === "object") return { meta: parsed as MdFrontmatter, body };
  } catch {
    // ignore
  }
  return { meta: {}, body };
}

function parseWpUtcMs(s: unknown): number | null {
  const v = String(s ?? "").trim();
  if (!v || v.startsWith("0000-00-00")) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const sec = Number(m[6] ?? "0");
  if (![year, month, day, hour, minute, sec].every((x) => Number.isFinite(x))) return null;
  return Date.UTC(year, month - 1, day, hour, minute, sec);
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function hasPostSlug(db: Db, slug: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(sql`SELECT id FROM posts WHERE slug = ${slug} LIMIT 1`);
  return !!rows[0];
}

async function hasPostTitleDate(db: Db, title: string, publishAt: number): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    sql`SELECT id FROM posts WHERE title = ${title} AND publish_at = ${publishAt} LIMIT 1`
  );
  return !!rows[0];
}

export async function importPostsFromZip(db: Db, zipBytes: Uint8Array): Promise<ImportPostsResult> {
  const map = unzipSync(zipBytes);
  const entries = Object.entries(map)
    .map(([path, bytes]) => ({ path: String(path ?? ""), bytes }))
    .filter((e) => e.path && !e.path.endsWith("/"));

  const xmlEntries = entries.filter((e) => e.path.toLowerCase().endsWith(".xml"));
  const mdEntries = entries.filter((e) => e.path.toLowerCase().endsWith(".md"));

  const items: ImportPostsResult["items"] = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  const config = await getSiteConfig(db);
  const allowlist = config.embedAllowlistHosts;

  const POSTS_KEY_AUTO_SUMMARY = "posts.auto_summary";
  const autoSummaryEnabled = (() => {
    // Keep behavior consistent with /api/admin/posts: if setting isn't present, default to false.
    return false;
  })();
  let autoSummary = autoSummaryEnabled;
  try {
    const rows = await db.query<{ value: string }>(
      sql`SELECT value FROM settings WHERE key = ${POSTS_KEY_AUTO_SUMMARY} LIMIT 1`
    );
    autoSummary = parseLooseBool(rows[0]?.value ?? null);
  } catch {
    // ignore
  }

  const categoryIdCache = new Map<string, string>();
  const tagIdCache = new Map<string, string>();

  const getOrCreateCategoryId = async (name: string): Promise<string | null> => {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return null;
    const cached = categoryIdCache.get(trimmed);
    if (cached) return cached;
    const slug = basicSlugify(trimmed) || randomId();
    const existing = await db.query<{ id: string }>(sql`SELECT id FROM categories WHERE slug = ${slug} LIMIT 1`);
    if (existing[0]?.id) {
      categoryIdCache.set(trimmed, existing[0].id);
      return existing[0].id;
    }
    const id = randomId();
    const t = nowMs();
    await db.execute(sql`INSERT INTO categories (id, slug, name, created_at, updated_at) VALUES (${id}, ${slug}, ${trimmed}, ${t}, ${t})`);
    categoryIdCache.set(trimmed, id);
    return id;
  };

  const getOrCreateTagIds = async (names: string[]): Promise<string[]> => {
    const out: string[] = [];
    for (const rawName of names) {
      const name = String(rawName ?? "").trim();
      if (!name) continue;
      const cached = tagIdCache.get(name);
      if (cached) {
        out.push(cached);
        continue;
      }
      const slug = basicSlugify(name) || randomId();
      const existing = await db.query<{ id: string }>(sql`SELECT id FROM tags WHERE slug = ${slug} LIMIT 1`);
      if (existing[0]?.id) {
        tagIdCache.set(name, existing[0].id);
        out.push(existing[0].id);
        continue;
      }
      const id = randomId();
      await db.execute(sql`INSERT INTO tags (id, slug, name, created_at) VALUES (${id}, ${slug}, ${name}, ${nowMs()})`);
      tagIdCache.set(name, id);
      out.push(id);
    }
    return out;
  };

  const insertPost = async (input: {
    title: string;
    contentMd: string;
    summary: string;
    publishAt: number;
    slugPreferred: string | null;
    categoryName: string | null;
    tags: string[];
  }): Promise<{ ok: true; slug: string; action: "imported" | "skipped" } | { ok: false; error: string }> => {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Missing title" };
    if (!input.contentMd) return { ok: false, error: "Missing content" };
    if (!Number.isFinite(input.publishAt) || input.publishAt <= 0) return { ok: false, error: "Invalid date" };

    if (input.slugPreferred) {
      if (await hasPostSlug(db, input.slugPreferred)) {
        return { ok: true, slug: input.slugPreferred, action: "skipped" };
      }
    } else {
      if (await hasPostTitleDate(db, title, input.publishAt)) {
        const fallbackSlug = basicSlugify(title) || "post";
        return { ok: true, slug: fallbackSlug, action: "skipped" };
      }
    }

    const slug = input.slugPreferred ?? (await slugifyUnique(db, title));
    if (await hasPostSlug(db, slug)) return { ok: true, slug, action: "skipped" };

    const rendered = await renderPostContent(input.contentMd, {
      embedAllowlist: allowlist,
      embed: embedFromShortcode
    });

    let summary = String(input.summary ?? "").trim();
    if (!summary && autoSummary) summary = deriveSummaryFromText(rendered.text, 150);

    const postId = randomId();
    const t = nowMs();
    const categoryId = input.categoryName ? await getOrCreateCategoryId(input.categoryName) : null;
    await db.execute(
      sql`INSERT INTO posts
          (id, slug, title, summary, category_id, status, publish_at, created_at, updated_at, content_md, content_html, content_text, cover_asset_id)
          VALUES (${postId}, ${slug}, ${title}, ${summary}, ${categoryId}, ${"published"}, ${input.publishAt}, ${t}, ${t}, ${input.contentMd}, ${rendered.html}, ${rendered.text}, ${null})`
    );

    const tagIds = await getOrCreateTagIds(input.tags);
    for (const tagId of tagIds) {
      await db.execute(sql`INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (${postId}, ${tagId})`);
    }

    return { ok: true, slug, action: "imported" };
  };

  // Markdown-based importers (Bitlog/Hexo/Hugo/Jekyll)
  for (const e of mdEntries) {
    try {
      const text = strFromU8(e.bytes);
      const { meta, body } = splitFrontmatter(text);
      const title = String(meta.title ?? "").trim();
      const publishAt = coerceDateMs(meta.date) ?? nowMs();
      const tags = toStringArray((meta as any).tags);
      const folderCat = categoryFromPath(e.path);
      const metaCat = pickFirstString((meta as any).category ?? (meta as any).categories);
      const categoryName = folderCat ?? metaCat;

      const slugPreferred =
        normalizeSlug((meta as any).slug) ??
        normalizeSlug((meta as any).url) ??
        normalizeSlug((meta as any).permalink) ??
        slugFromFileName(e.path);

      const summary =
        String((meta as any).summary ?? "").trim() ||
        String((meta as any).description ?? "").trim();

      if (!title) throw new Error("missing_title");
      const res = await insertPost({
        title,
        contentMd: body,
        summary,
        publishAt,
        slugPreferred,
        categoryName,
        tags
      });
      if (!res.ok) throw new Error(res.error);
      if (res.action === "imported") {
        imported++;
        items.push({ ok: true, source: "md", title, slug: res.slug, action: "imported" });
      } else {
        skipped++;
        items.push({ ok: true, source: "md", title, slug: res.slug, action: "skipped" });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "import_failed";
      items.push({ ok: false, source: "md", path: e.path, error: msg });
    }
  }

  // WordPress WXR importers
  if (xmlEntries.length > 0) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      allowBooleanAttributes: true,
      processEntities: true
    });

    for (const e of xmlEntries) {
      try {
        const xmlText = strFromU8(e.bytes);
        const doc = parser.parse(xmlText) as any;
        const channel = doc?.rss?.channel ?? doc?.channel ?? null;
        const itemsRaw = channel?.item ?? [];
        const wpItems = asArray<any>(itemsRaw);

        for (const it of wpItems) {
          try {
            const postType = String(it?.["wp:post_type"] ?? "").trim();
            if (postType && postType !== "post") continue;

            const title = normalizeWhitespace(String(it?.title ?? ""));
            const contentHtml = String(it?.["content:encoded"] ?? "");
            const excerptHtml = String(it?.["excerpt:encoded"] ?? "");
            const summary = stripHtmlToText(excerptHtml);
            const slugPreferred = normalizeSlug(String(it?.["wp:post_name"] ?? "")) ?? null;

            const publishAt =
              parseWpUtcMs(it?.["wp:post_date_gmt"]) ??
              parseWpUtcMs(it?.["wp:post_date"]) ??
              nowMs();

            const categories = asArray<any>(it?.category);
            const catNames = categories
              .filter((c) => String(c?.["@domain"] ?? "").toLowerCase() === "category")
              .map((c) => stripHtmlToText(String(c?.["#text"] ?? c ?? "")))
              .filter(Boolean);
            const tagNames = categories
              .filter((c) => String(c?.["@domain"] ?? "").toLowerCase() === "post_tag")
              .map((c) => stripHtmlToText(String(c?.["#text"] ?? c ?? "")))
              .filter(Boolean);

            if (!title) continue;
            if (!contentHtml) continue;

            const categoryName = catNames[0] ?? null;
            const res = await insertPost({
              title,
              contentMd: contentHtml,
              summary,
              publishAt,
              slugPreferred,
              categoryName,
              tags: tagNames
            });
            if (!res.ok) throw new Error(res.error);
            if (res.action === "imported") {
              imported++;
              items.push({ ok: true, source: "wordpress", title, slug: res.slug, action: "imported" });
            } else {
              skipped++;
              items.push({ ok: true, source: "wordpress", title, slug: res.slug, action: "skipped" });
            }
          } catch {
            failed++;
            items.push({ ok: false, source: "wordpress", path: e.path, error: "item_import_failed" });
          }
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "xml_import_failed";
        items.push({ ok: false, source: "wordpress", path: e.path, error: msg });
      }
    }
  }

  return { ok: true, imported, skipped, failed, items };
}
