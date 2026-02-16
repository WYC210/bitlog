import { Hono } from "hono";

export interface WebEnv {
  API: Fetcher;
  ASSETS: Fetcher;
  API_BASE_URL?: string;
}

type ApiOk<T> = { ok: true } & T;

type SiteConfig = {
  title: string | null;
  description: string | null;
  baseUrl: string | null;
  timezone: string | null;
  embedAllowlistHosts: string[];
  cacheTtlSeconds: number;
  cacheVersion: number;
  shortcutsJson: string | null;
};

type Category = { id: string; slug: string; name: string };
type Tag = { id?: string; slug: string; name: string };

type PostListItem = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  publish_at: number;
  updated_at: number;
  category_slug: string | null;
  category_name: string | null;
};

type PostDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content_html: string;
  publish_at: number;
  updated_at: number;
  category_slug: string | null;
  category_name: string | null;
  tags: Array<{ slug: string; name: string }>;
};

let templatesPromise: Promise<{ post: string; articles: string }> | null = null;

async function loadTemplates(env: WebEnv, requestUrl: string) {
  if (templatesPromise) return templatesPromise;
  templatesPromise = (async () => {
    const base = new URL(requestUrl);
    base.pathname = "/_templates/post.html";
    base.search = "";
    const postHtml = await env.ASSETS.fetch(base.toString()).then((r) => r.text());

    base.pathname = "/_templates/articles.html";
    const articlesHtml = await env.ASSETS.fetch(base.toString()).then((r) => r.text());
    return { post: postHtml, articles: articlesHtml };
  })();
  return templatesPromise;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isoDate(ms: number, tz: string | null): string {
  const dtf = new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz ?? undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return dtf.format(new Date(ms));
}

function replaceAll(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(k).join(v);
  return out;
}

async function apiJson<T>(env: WebEnv, path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, "https://api.local");
  const res = await apiFetch(env, url.toString(), init);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function apiForwardJson<T>(
  env: WebEnv,
  request: Request,
  path: string
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const url = new URL(request.url);
  url.pathname = path;
  // Avoid leaking original page query params to the API.
  url.search = "";
  const res = await apiForward(env, new Request(url.toString(), request));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

function apiFetch(env: WebEnv, url: string, init?: RequestInit): Promise<Response> {
  if (!env.API_BASE_URL) return env.API.fetch(url, init);
  const target = new URL(url);
  const base = new URL(env.API_BASE_URL);
  target.protocol = base.protocol;
  target.username = base.username;
  target.password = base.password;
  target.host = base.host;
  return fetch(target.toString(), init);
}

function apiForward(env: WebEnv, request: Request): Promise<Response> {
  if (!env.API_BASE_URL) return env.API.fetch(request);
  const url = new URL(request.url);
  const base = new URL(env.API_BASE_URL);
  url.protocol = base.protocol;
  url.username = base.username;
  url.password = base.password;
  url.host = base.host;

  // When proxying browser requests to a different local port, the API's same-origin check
  // (based on the `Origin` header) would otherwise fail.
  const headers = new Headers(request.headers);
  if (headers.has("origin")) headers.set("origin", base.origin);
  const referer = headers.get("referer");
  if (referer) {
    try {
      const ref = new URL(referer);
      headers.set("referer", `${base.origin}${ref.pathname}${ref.search}${ref.hash}`);
    } catch {
      // ignore
    }
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = { method: request.method, headers, redirect: request.redirect };
  if (method !== "GET" && method !== "HEAD") init.body = request.clone().body;
  return fetch(url.toString(), init);
}

async function getConfig(env: WebEnv): Promise<SiteConfig> {
  const data = await apiJson<ApiOk<{ config: SiteConfig }>>(env, "/api/config");
  return data.config;
}

async function maybeCachePage(
  request: Request,
  cfg: SiteConfig,
  cacheKey: string,
  build: () => Promise<Response>
): Promise<Response> {
  if (request.method !== "GET") return build();
  if (request.headers.get("cookie")) return build();
  if (typeof (globalThis as any).caches === "undefined" || !(caches as any).default) return build();

  const url = new URL(request.url);
  url.searchParams.set("__cv", String(cfg.cacheVersion));
  url.searchParams.set("__k", cacheKey);
  const keyReq = new Request(url.toString(), request);
  const cache = (caches as any).default as Cache;
  const hit = await cache.match(keyReq);
  if (hit) return hit;

  const res = await build();
  if (!res.ok) return res;
  const headers = new Headers(res.headers);
  headers.set("cache-control", `public, max-age=${cfg.cacheTtlSeconds}`);
  const toCache = new Response(res.clone().body, { status: res.status, headers });
  await cache.put(keyReq, toCache.clone());
  return toCache;
}

function renderChips(items: Array<{ name: string; slug: string }>, baseHref: string): string {
  return items
    .map((it) => {
      const href = `${baseHref}${encodeURIComponent(it.slug)}`;
      return `<a class="chip" href="${href}">${escapeHtml(it.name)}</a>`;
    })
    .join("");
}

function buildTocFromHtml(contentHtml: string): { tocHtml: string; tocInlineLinks: string } {
  const headings = extractHeadings(contentHtml);
  if (headings.length === 0) return { tocHtml: "", tocInlineLinks: "" };

  const groups = groupByH2(headings);
  const tocHtml = groups
    .map((g) => {
      const children = g.children
        .map((h3) => {
          return `<li><a href="#${escapeHtml(h3.id)}">${escapeHtml(h3.text)}</a></li>`;
        })
        .join("");
      const ul = children ? `<ul>${children}</ul>` : "";
      return `<details data-toc-group open data-target="${escapeHtml(g.h2.id)}"><summary>${escapeHtml(
        g.h2.text
      )}</summary>${ul}</details>`;
    })
    .join("");

  const tocInlineLinks = headings
    .map((h) => `<a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`)
    .join("");

  return { tocHtml, tocInlineLinks };
}

function extractHeadings(html: string): Array<{ level: 2 | 3; id: string; text: string }> {
  const out: Array<{ level: 2 | 3; id: string; text: string }> = [];
  const re = /<(h2|h3)\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(html))) {
    const level = m[1]?.toLowerCase() === "h2" ? 2 : 3;
    const id = String(m[2] ?? "").trim();
    const inner = String(m[3] ?? "");
    const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!id || !text) continue;
    out.push({ level, id, text } as any);
  }
  return out;
}

function groupByH2(headings: Array<{ level: 2 | 3; id: string; text: string }>) {
  const groups: Array<{ h2: { id: string; text: string }; children: Array<{ id: string; text: string }> }> =
    [];
  let current: { h2: { id: string; text: string }; children: Array<{ id: string; text: string }> } | null =
    null;
  for (const h of headings) {
    if (h.level === 2) {
      current = { h2: { id: h.id, text: h.text }, children: [] };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = { h2: { id: h.id, text: h.text }, children: [] };
      groups.push(current);
      continue;
    }
    current.children.push({ id: h.id, text: h.text });
  }
  return groups;
}

export function createWebApp() {
  const app = new Hono<{ Bindings: WebEnv }>();

  app.get("/_health", (c) => c.json({ ok: true }));
  app.all("/_templates/*", (c) => c.json({ ok: false, error: { message: "Not found", status: 404 } }, 404));

  // Same-origin passthrough (Admin calls `/api/*` directly in browser).
  app.all("/api/*", (c) => apiForward(c.env, c.req.raw));
  app.all("/assets/*", (c) => apiForward(c.env, c.req.raw));
  app.get("/rss.xml", (c) => apiForward(c.env, c.req.raw));
  app.get("/sitemap.xml", (c) => apiForward(c.env, c.req.raw));

  app.get("/", (c) => c.redirect("/articles", 302));
  app.get("/admin", (c) => c.redirect("/admin/", 302));

  app.all("/admin/*", async (c) => {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status !== 404) return res;
    const url = new URL(c.req.url);
    url.pathname = "/admin/index.html";
    url.search = "";
    return c.env.ASSETS.fetch(url.toString());
  });

  app.get("/articles", async (c) => {
    const cfg = await getConfig(c.env);
    const url = new URL(c.req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const category = url.searchParams.get("category");
    const tag = url.searchParams.get("tag");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(30, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10")));

    return maybeCachePage(c.req.raw, cfg, `web:articles:${q}:${category ?? ""}:${tag ?? ""}:${page}:${pageSize}`, async () => {
      const [categories, tags] = await Promise.all([
        apiJson<ApiOk<{ categories: Category[] }>>(c.env, "/api/categories").then((r) => r.categories),
        apiJson<ApiOk<{ tags: Tag[] }>>(c.env, "/api/tags").then((r) => r.tags)
      ]);

      const filterPill = category
        ? `<span class="pill"><strong>分类</strong><span class="sep">·</span>${escapeHtml(
            categories.find((x) => x.slug === category)?.name ?? category
          )}</span>`
        : tag
          ? `<span class="pill"><strong>标签</strong><span class="sep">·</span>${escapeHtml(
              tags.find((x) => x.slug === tag)?.name ?? tag
            )}</span>`
          : `<span class="pill"><strong>Articles</strong><span class="sep">·</span>${escapeHtml(
              cfg.title ?? "Bitlog"
            )}</span>`;

      let posts: PostListItem[] = [];
      if (q) {
        const search = await apiJson<ApiOk<{ results: PostListItem[]; q: string }>>(
          c.env,
          `/api/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`
        );
        posts = (search.results ?? []) as any;
      } else {
        const list = await apiJson<ApiOk<{ posts: PostListItem[] }>>(
          c.env,
          `/api/posts?page=${page}&pageSize=${pageSize}${category ? `&category=${encodeURIComponent(category)}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`
        );
        posts = list.posts ?? [];
      }

      const cards = posts
        .map((p) => {
          const dateText = isoDate(Number(p.publish_at ?? p.updated_at), cfg.timezone);
          const cat = p.category_slug
            ? `<a class="chip chip--cat" href="/articles?category=${encodeURIComponent(
                p.category_slug
              )}">${escapeHtml(p.category_name ?? p.category_slug)}</a>`
            : "";
          return `<article class="card article-card">
  <div class="article-meta">
    <span class="meta">${escapeHtml(dateText)}</span>
    <span class="meta">${cat}</span>
  </div>
  <h2 class="article-title"><a href="/articles/${encodeURIComponent(p.slug)}">${escapeHtml(
    p.title
  )}</a></h2>
  <p class="article-summary">${escapeHtml(p.summary ?? "")}</p>
</article>`;
        })
        .join("\n");

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).articles, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ?? "Articles"),
        "{{SITE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{FILTER_PILL}}": filterPill,
        "{{SEARCH_VALUE}}": escapeHtml(q),
        "{{POST_CARDS}}": cards || `<div class="meta">暂无文章</div>`,
        "{{CATEGORIES}}": renderChips(categories, "/articles?category="),
        "{{TAGS}}": renderChips(tags as any, "/articles?tag="),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? "")
      });

      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });

  app.get("/articles/:slug", async (c) => {
    const cfg = await getConfig(c.env);
    const slug = c.req.param("slug");
    return maybeCachePage(c.req.raw, cfg, `web:post:${slug}`, async () => {
      const publicResp = await apiForwardJson<ApiOk<{ post: PostDetail }>>(
        c.env,
        c.req.raw,
        `/api/posts/${encodeURIComponent(slug)}`
      );

      let post: PostDetail | null = null;
      if (publicResp.ok) {
        post = publicResp.data.post;
      } else if (publicResp.status === 404) {
        // Preview: for drafts/scheduled posts, fall back to an admin-authenticated endpoint.
        const previewResp = await apiForwardJson<ApiOk<{ post: PostDetail }>>(
          c.env,
          c.req.raw,
          `/api/admin/preview/${encodeURIComponent(slug)}`
        );
        if (previewResp.ok) post = previewResp.data.post;
        else if (previewResp.status === 401 || previewResp.status === 403 || previewResp.status === 404) {
          return c.text("Not found", 404);
        } else {
          throw new Error(`API /api/admin/preview/${slug} failed: ${previewResp.status}`);
        }
      } else {
        throw new Error(`API /api/posts/${slug} failed: ${publicResp.status}`);
      }
      if (!post) return c.text("Not found", 404);

      const dateText = isoDate(Number(post.publish_at ?? post.updated_at), cfg.timezone);
      const catChip = post.category_slug
        ? `<a class="chip chip--cat" href="/articles?category=${encodeURIComponent(
            post.category_slug
          )}">${escapeHtml(post.category_name ?? post.category_slug)}</a>`
        : `<span class="chip chip--cat">未分类</span>`;
      const tagChips = (post.tags ?? [])
        .map((t) => {
          return `<a class="chip" href="/articles?tag=${encodeURIComponent(t.slug)}">${escapeHtml(
            t.name
          )}</a>`;
        })
        .join("");

      const toc = buildTocFromHtml(post.content_html ?? "");

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).post, {
        "{{PAGE_TITLE}}": escapeHtml(post.title),
        "{{SITE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{POST_TITLE}}": escapeHtml(post.title),
        "{{POST_SUMMARY}}": escapeHtml(post.summary ?? ""),
        "{{POST_DATE}}": escapeHtml(dateText),
        "{{CATEGORY_CHIP}}": catChip,
        "{{TAG_CHIPS}}": tagChips || `<span class="meta">无标签</span>`,
        "{{TOC_GROUPS}}": toc.tocHtml || `<div class="meta">无目录</div>`,
        "{{POST_CONTENT}}": post.content_html ?? "",
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? "")
      });

      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });

  app.all("*", async (c) => {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status !== 404) return res;
    return c.text("Not found", 404);
  });

  return app;
}
