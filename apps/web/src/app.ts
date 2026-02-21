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
  webStyle: "current" | "classic" | "glass" | "brutal" | "terminal";
  adminStyle: "current" | "classic" | "glass" | "brutal" | "terminal";
  shortcutsJson: string | null;
  footerCopyrightUrl: string | null;
  footerIcpText: string | null;
  footerIcpLink: string | null;
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

type ProjectItem = {
  platform: "github" | "gitee";
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  updatedAt: number;
};

type ToolItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  groupKey: "games" | "apis" | "utils" | "other";
  kind: "link" | "page";
  url: string | null;
  icon: string | null;
  clientCode: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

let templatesPromise: Promise<{ home: string; post: string; articles: string; page: string }> | null = null;

async function loadTemplates(env: WebEnv, requestUrl: string) {
  if (templatesPromise) return templatesPromise;
  templatesPromise = (async () => {
    const base = new URL(requestUrl);
    base.pathname = "/_templates/home.html";
    base.search = "";
    const homeHtml = await env.ASSETS.fetch(base.toString()).then((r) => r.text());

    base.pathname = "/_templates/post.html";
    base.search = "";
    const postHtml = await env.ASSETS.fetch(base.toString()).then((r) => r.text());

    base.pathname = "/_templates/articles.html";
    const articlesHtml = await env.ASSETS.fetch(base.toString()).then((r) => r.text());

    base.pathname = "/_templates/page.html";
    const pageHtml = await env.ASSETS.fetch(base.toString()).then((r) => r.text());

    return { home: homeHtml, post: postHtml, articles: articlesHtml, page: pageHtml };
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

function safeHref(input: string | null): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

function renderSiteFooter(cfg: SiteConfig, year: string): string {
  const title = cfg.title ?? "Bitlog";
  const copyrightText = `© ${year} ${title}. All rights reserved.`;
  const copyrightHref = safeHref(cfg.footerCopyrightUrl) ?? safeHref(cfg.baseUrl) ?? null;
  const copyrightHtml = copyrightHref
    ? `<a href="${escapeHtml(copyrightHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copyrightText)}</a>`
    : `<span>${escapeHtml(copyrightText)}</span>`;

  const dot = `<span class="site-footer__dot" aria-hidden="true">·</span>`;
  const sitemap = `<a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" aria-label="网站地图">Sitemap</a>`;
  const rss = `<a href="/rss.xml" target="_blank" rel="noopener noreferrer" aria-label="RSS订阅">RSS</a>`;

  const icpText = String(cfg.footerIcpText ?? "").trim();
  const icpHref = safeHref(cfg.footerIcpLink) ?? "https://beian.miit.gov.cn/";
  const icpHtml = icpText
    ? `<div class="site-footer__icp">
  <img src="/images/national.png" alt="备案图标" width="16" height="16" loading="lazy" decoding="async" />
  <a href="${escapeHtml(icpHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(icpText)}</a>
</div>`
    : "";

  return `<footer class="site-footer">
  <div class="site-footer__links">
    ${copyrightHtml}
    ${dot}
    ${sitemap}
    ${dot}
    ${rss}
  </div>
  ${icpHtml}
</footer>`;
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
  // Local dev: avoid caching HTML pages so template tweaks reflect immediately.
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return build();
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

function cacheVersionForRequest(cfg: SiteConfig, reqUrl: string): string {
  try {
    const url = new URL(reqUrl);
    // Local dev: force-refresh static assets (CSS/JS) without needing to bump cache_version.
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return String(Date.now());
  } catch {}
  return String(cfg.cacheVersion);
}

function renderChips(items: Array<{ name: string; slug: string }>, baseHref: string): string {
  return items
    .map((it) => {
      const href = `${baseHref}${encodeURIComponent(it.slug)}`;
      return `<a class="chip" href="${href}">${escapeHtml(it.name)}</a>`;
    })
    .join("");
}

function renderChipsWithActive(
  items: Array<{ name: string; slug: string }>,
  baseHref: string,
  activeSlug: string | null
): string {
  return items
    .map((it) => {
      const href = `${baseHref}${encodeURIComponent(it.slug)}`;
      const color = hashColor(it.name);
      const cls = `chip chip--${color}${activeSlug && it.slug === activeSlug ? " is-active" : ""}`;
      return `<a class="${cls}" href="${href}">${escapeHtml(it.name)}</a>`;
    })
    .join("");
}

function hashColor(str: string): string {
  const colors = ["blue", "purple", "green", "orange", "pink", "teal"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return colors[h % colors.length] ?? "blue";
}

function buildTocFromHtml(contentHtml: string): { tocHtml: string; tocInlineLinks: string } {
  const isFootnotesHeading = (h: { id: string; text: string }) => {
    const id = String(h.id ?? "").trim().toLowerCase();
    const text = String(h.text ?? "").trim().toLowerCase();
    return id === "footnotes" || text === "footnotes" || text === "脚注";
  };

  const normalizeTocText = (text: string) => {
    const s = String(text ?? "").replace(/\s+/g, " ").trim();
    const stripped = s
      .replace(/^\d+\)\s+/, "")
      .replace(/^\d+(?:\.\d+)+\s+/, "")
      .replace(/^\d+\.\s+/, "");
    return stripped || s;
  };

  const headings = extractHeadings(contentHtml).filter((h) => !isFootnotesHeading(h));
  if (headings.length === 0) return { tocHtml: "", tocInlineLinks: "" };

  const groups: Array<{
    h2: { id: string; text: string };
    h3s: Array<{ id: string; text: string }>;
  }> = [];
  let current: (typeof groups)[number] | null = null;
  for (const h of headings) {
    if (h.level === 2) {
      current = { h2: { id: h.id, text: h.text }, h3s: [] };
      groups.push(current);
      continue;
    }
    if (h.level === 3) {
      if (!current) continue;
      current.h3s.push({ id: h.id, text: h.text });
    }
  }

  let sectionIndex = 0;
  const tocHtml = groups
    .map((g) => {
      const groupId = escapeHtml(g.h2.id);
      const h2Id = escapeHtml(g.h2.id);
      const h2Text = escapeHtml(normalizeTocText(g.h2.text));
      const h2 = `<a class="toc-link toc-link-h2" data-level="2" data-toc-group="${groupId}" data-toc-id="${h2Id}" href="#${h2Id}"><span class="toc-badge" aria-hidden="true">${++sectionIndex}</span><span class="toc-text">${h2Text}</span></a>`;
      const children = g.h3s
        .map((h3) => {
          const id = escapeHtml(h3.id);
          const text = escapeHtml(normalizeTocText(h3.text));
          return `<a class="toc-link toc-link-h3" data-level="3" data-toc-group="${groupId}" data-toc-id="${id}" href="#${id}"><span class="toc-bullet" aria-hidden="true"></span><span class="toc-text">${text}</span></a>`;
        })
        .join("");
      return `<div class="toc-group" data-toc-group="${groupId}">${h2}<div class="toc-children">${children}</div></div>`;
    })
    .join("");

  const tocInlineLinks = headings
    .filter((h) => h.level === 2)
    .map((h) => `<a href="#${escapeHtml(h.id)}">${escapeHtml(normalizeTocText(h.text))}</a>`)
    .join("");

  return { tocHtml, tocInlineLinks };
}

function extractHeadings(html: string): Array<{ level: 2 | 3; id: string; text: string }> {
  // Normalize heading depth like the old blog:
  // - find the minimum heading depth in the article (h1..h6)
  // - treat that as TOC level 2 ("section"), everything deeper as level 3 ("subsection")
  // This allows authoring with `#` as the first content heading while keeping the current 2-level TOC UI.
  const raw: Array<{ depth: number; id: string; text: string }> = [];
  const re = /<(h[1-6])\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(html))) {
    const tag = String(m[1] ?? "").toLowerCase();
    const depth = parseInt(tag.slice(1), 10);
    if (!Number.isFinite(depth) || depth < 1 || depth > 6) continue;
    const id = String(m[2] ?? "").trim();
    const inner = String(m[3] ?? "");
    const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!id || !text) continue;
    raw.push({ depth, id, text });
  }
  if (raw.length === 0) return [];

  const minDepth = Math.min(...raw.map((h) => h.depth));
  return raw.map((h) => {
    const relative = h.depth - minDepth;
    return { level: relative <= 0 ? 2 : 3, id: h.id, text: h.text };
  });
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

  app.get("/", async (c) => {
    const cfg = await getConfig(c.env);
    return maybeCachePage(c.req.raw, cfg, "web:home", async () => {
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);
      const html = replaceAll((await loadTemplates(c.env, c.req.url)).home, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{SITE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{SITE_DESC}}": escapeHtml(
          cfg.description ??
            "在 AI 时代重新定义思考"
        ),
        "{{YEAR}}": escapeHtml(year),
        "{{SITE_FOOTER}}": footer,
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? "")
      });

      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });
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
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);
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
          const cat = p.category_name ?? p.category_slug ?? "";
          const catChip = cat ? `<span class="chip chip--${hashColor(cat)}">${escapeHtml(cat)}</span>` : "";

          const summary = p.summary ?? "";

          return `<a class="card article-card" href="/articles/${encodeURIComponent(p.slug)}">
  <div class="meta">${escapeHtml(dateText)}${catChip ? ` · ${catChip}` : ""}</div>
  <h2 class="article-title">${escapeHtml(p.title)}</h2>
  ${summary ? `<p class="article-summary">${escapeHtml(summary)}</p>` : ""}
</a>`;
        })
        .join("\n");

      const resultMeta = q ? `搜索结果 · ${posts.length} 条` : `最近更新`;

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).articles, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ?? "Articles"),
        "{{SITE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{FILTER_PILL}}": filterPill,
        "{{RESULT_META}}": escapeHtml(resultMeta),
        "{{SEARCH_VALUE}}": escapeHtml(q),
        "{{POST_CARDS}}": cards || `<div class="meta">暂无文章</div>`,
        "{{CATEGORIES}}": renderChipsWithActive(categories, "/articles?category=", category),
        "{{TAGS}}": renderChipsWithActive(tags as any, "/articles?tag=", tag),
        "{{SITE_FOOTER}}": footer,
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? "")
      });

      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });

  app.get("/projects", async (c) => {
    const cfg = await getConfig(c.env);
    const url = new URL(c.req.url);
    const rawPlatform = (url.searchParams.get("platform") ?? "").trim().toLowerCase();
    const platform =
      rawPlatform === "github" || rawPlatform === "gitee" ? rawPlatform : rawPlatform === "all" ? "all" : "all";

    return maybeCachePage(c.req.raw, cfg, `web:projects:${platform}`, async () => {
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);

      const data = await apiJson<
        ApiOk<{
          projects: ProjectItem[];
          accounts: { github: { username: string } | null; gitee: { username: string } | null };
          config: { includeForks: boolean; maxItemsPerPlatform: number };
        }>
      >(c.env, `/api/projects?platform=${encodeURIComponent(platform)}`);

      const projects = data.projects ?? [];
      const accounts = data.accounts ?? { github: null, gitee: null };

      const chip = (label: string, href: string, active: boolean) =>
        `<a class="chip${active ? " is-active" : ""}" href="${href}">${escapeHtml(label)}</a>`;

      const filter = `
<div class="section-head">
  <div class="tag-list">
    ${chip("全部", "/projects?platform=all", platform === "all")}
    ${chip("GitHub", "/projects?platform=github", platform === "github")}
    ${chip("Gitee", "/projects?platform=gitee", platform === "gitee")}
  </div>
  <div class="meta">
    ${escapeHtml(
      [
        accounts.github?.username ? `GitHub: ${accounts.github.username}` : "",
        accounts.gitee?.username ? `Gitee: ${accounts.gitee.username}` : ""
      ]
        .filter(Boolean)
        .join(" · ") || "尚未配置账号"
    )}
  </div>
</div>
`.trim();

      const cards = projects
        .map((p) => {
          const dateText = isoDate(Number(p.updatedAt ?? 0), cfg.timezone);
          const platformLabel = p.platform === "github" ? "GitHub" : "Gitee";
          const platformCls = p.platform === "github" ? "repo-platform repo-platform--github" : "repo-platform repo-platform--gitee";
          const githubSvg = `<svg class="repo-card__avatar-icon" viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`;
          const giteeSvg = `<svg class="repo-card__avatar-icon" viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z"/></svg>`;
          const avatarEl = p.platform === "github"
            ? `<div class="repo-card__avatar repo-card__avatar--github">${githubSvg}</div>`
            : `<div class="repo-card__avatar repo-card__avatar--gitee">${giteeSvg}</div>`;
          const desc = p.description ? escapeHtml(p.description) : "（无描述）";
          const starSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
          const forkSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h3M18 15V9"/></svg>`;
          const metaBits = [
            p.language ? `<span class="pill">${escapeHtml(p.language)}</span>` : "",
            `<span class="pill">${starSvg} ${escapeHtml(String(p.stars ?? 0))}</span>`,
            `<span class="pill">${forkSvg} ${escapeHtml(String(p.forks ?? 0))}</span>`,
          ].filter(Boolean);
          return `<a class="card-link repo-card" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">
  <div class="repo-card__inner">
    ${avatarEl}
    <div class="repo-card__body">
      <div class="repo-head">
        <div class="repo-title">${escapeHtml(p.name)}</div>
        <span class="${platformCls}">${escapeHtml(platformLabel)}</span>
      </div>
      <div class="repo-sub meta">${escapeHtml(p.fullName)}</div>
      <div class="repo-desc meta">${desc}</div>
      <div class="repo-meta">
        ${metaBits.join("")}
        ${p.archived ? `<span class="pill">Archived</span>` : ""}
        ${p.fork ? `<span class="pill">Fork</span>` : ""}
      </div>
    </div>
  </div>
</a>`;
        })
        .join("\n");

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · 项目` : "项目"),
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
        "{{PAGE_ID}}": "projects",
        "{{SEARCH_VALUE}}": "",
        "{{NAV_HOME_ACTIVE}}": "",
        "{{NAV_ARTICLES_ACTIVE}}": "",
        "{{NAV_PROJECTS_ACTIVE}}": "active",
        "{{NAV_TOOLS_ACTIVE}}": "",
        "{{NAV_ABOUT_ACTIVE}}": "",
        "{{HERO_SECTION}}": "",
        "{{STATS_SECTION}}": "",
        "{{MAIN_CONTENT}}": `
${filter}
<div class="cards-grid">
  ${cards || `<div class="meta">暂无项目（请先在后台 设置 → 项目页 配置账号）</div>`}
</div>
`.trim(),
        "{{SITE_FOOTER}}": footer,
        "{{TOOL_SCRIPT}}": `<script>(function(){var key="bl-projects-platform";try{var url=new URL(location.href);var p=(url.searchParams.get("platform")||"").trim();if(!p){var stored=localStorage.getItem(key);if(stored&&stored!=="all"){url.searchParams.set("platform",stored);location.replace(url.pathname+"?"+url.searchParams.toString());return;}}else{localStorage.setItem(key,p);}}catch(e){}})()</script>`,
      });
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });

  app.get("/about", async (c) => {
    const cfg = await getConfig(c.env);
    return maybeCachePage(c.req.raw, cfg, "web:about", async () => {
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);
      const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · 关于我` : "关于我"),
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
        "{{PAGE_ID}}": "about",
        "{{SEARCH_VALUE}}": "",
        "{{NAV_HOME_ACTIVE}}": "",
        "{{NAV_ARTICLES_ACTIVE}}": "",
        "{{NAV_PROJECTS_ACTIVE}}": "",
        "{{NAV_TOOLS_ACTIVE}}": "",
        "{{NAV_ABOUT_ACTIVE}}": "active",
        "{{HERO_SECTION}}": "",
        "{{STATS_SECTION}}": "",
        "{{MAIN_CONTENT}}": "",
        "{{SITE_FOOTER}}": footer,
        "{{TOOL_SCRIPT}}": `<script type="module" src="/ui/about/about.js?__cv=${escapeHtml(cacheVersionForRequest(cfg, c.req.url))}"></script>`,
      });
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });

  app.get("/tools", async (c) => {
    const cfg = await getConfig(c.env);
    const url = new URL(c.req.url);
    const rawGroup = (url.searchParams.get("group") ?? "").trim().toLowerCase();
    const group =
      rawGroup === "games" || rawGroup === "apis" || rawGroup === "utils" || rawGroup === "other"
        ? rawGroup
        : rawGroup === "all"
          ? "all"
          : "all";

    return maybeCachePage(c.req.raw, cfg, `web:tools:${group}`, async () => {
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);
      const apiPath = group === "all" ? "/api/tools" : `/api/tools?group=${encodeURIComponent(group)}`;
      const data = await apiJson<ApiOk<{ tools: ToolItem[] }>>(c.env, apiPath);
      const tools = data.tools ?? [];

      const chip = (label: string, href: string, active: boolean) =>
        `<a class="chip${active ? " is-active" : ""}" href="${href}">${escapeHtml(label)}</a>`;

      const filter = `
<div class="section-head">
  <div class="tag-list">
    ${chip("全部", "/tools?group=all", group === "all")}
    ${chip("games", "/tools?group=games", group === "games")}
    ${chip("apis", "/tools?group=apis", group === "apis")}
    ${chip("utils", "/tools?group=utils", group === "utils")}
    ${chip("other", "/tools?group=other", group === "other")}
  </div>
  <div class="meta">${escapeHtml(`共 ${tools.length} 项`)}</div>
</div>
`.trim();

      const cards = tools
        .map((t) => {
          const rawHref = t.kind === "page" ? `/tools/${encodeURIComponent(t.slug)}` : (t.url ? String(t.url) : "");
          const isExternal = /^https?:\/\//i.test(rawHref);
          const attrs = rawHref
            ? isExternal
              ? `href="${escapeHtml(rawHref)}" target="_blank" rel="noopener noreferrer"`
              : `href="${escapeHtml(rawHref)}"`
            : "";
          const el = rawHref ? "a" : "div";
          const groupColors: Record<string, string> = { games: "purple", apis: "blue", utils: "green", other: "gray" };
          const groupIcons: Record<string, string> = {
            games: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 12h.01M18 12h.01"/></svg>`,
            apis: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
            utils: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
            other: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
          };
          const icon = t.icon || groupIcons[t.groupKey] || groupIcons.other;
          const groupColor = groupColors[t.groupKey] || "gray";
          const groupChip = `<span class="chip chip--${groupColor === "gray" ? "teal" : groupColor}">${escapeHtml(t.groupKey)}</span>`;
          return `<${el} class="card-link tool-card" ${attrs}>
  <div class="tool-card__icon tool-card__icon--${escapeHtml(t.groupKey)}">${icon}</div>
  <div class="repo-head">
    <div class="repo-title">${escapeHtml(t.title)}</div>
    ${groupChip}
  </div>
  <div class="repo-desc meta">${escapeHtml(t.description || "（无描述）")}</div>
</${el}>`;
        })
        .join("\n");

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · 工具中心` : "工具中心"),
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
        "{{PAGE_ID}}": "tools",
        "{{SEARCH_VALUE}}": "",
        "{{NAV_HOME_ACTIVE}}": "",
        "{{NAV_ARTICLES_ACTIVE}}": "",
        "{{NAV_PROJECTS_ACTIVE}}": "",
        "{{NAV_TOOLS_ACTIVE}}": "active",
        "{{NAV_ABOUT_ACTIVE}}": "",
        "{{HERO_SECTION}}": "",
        "{{STATS_SECTION}}": "",
        "{{MAIN_CONTENT}}": `
${filter}
<div class="cards-grid">
  ${cards || `<div class="meta">暂无工具（请先在后台 设置 → 工具中心 新增）</div>`}
</div>
`.trim(),
        "{{SITE_FOOTER}}": footer,
        "{{TOOL_SCRIPT}}": "",
      });
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    });
  });

  app.get("/tools/:slug", async (c) => {
    const cfg = await getConfig(c.env);
    const slug = c.req.param("slug");
    let tool: ToolItem;
    try {
      const data = await apiJson<ApiOk<{ tool: ToolItem }>>(c.env, `/api/tools/${encodeURIComponent(slug)}`);
      tool = data.tool;
    } catch {
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);
      const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · 工具未找到` : "工具未找到"),
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
        "{{PAGE_ID}}": "tools",
        "{{SEARCH_VALUE}}": "",
        "{{NAV_HOME_ACTIVE}}": "",
        "{{NAV_ARTICLES_ACTIVE}}": "",
        "{{NAV_PROJECTS_ACTIVE}}": "",
        "{{NAV_TOOLS_ACTIVE}}": "active",
        "{{NAV_ABOUT_ACTIVE}}": "",
        "{{HERO_SECTION}}": "",
        "{{STATS_SECTION}}": "",
        "{{MAIN_CONTENT}}": `
<div class="nav" style="margin-bottom:16px">
  <a class="chip" href="/tools">← 返回工具中心</a>
</div>
<div class="meta">该工具不存在或已被禁用。</div>
        `.trim(),
        "{{SITE_FOOTER}}": footer,
        "{{TOOL_SCRIPT}}": "",
      });
      return new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // kind=link: 直接跳转
    if (tool.kind === "link" && tool.url) {
      return Response.redirect(tool.url, 302);
    }

    const year = String(new Date().getFullYear());
    const footer = renderSiteFooter(cfg, year);
    const scriptBlock = tool.clientCode
      ? `<script src="/api/tools/${encodeURIComponent(tool.slug)}/script.js"></script>`
      : "";

    const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
      "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · ${tool.title}` : tool.title),
      "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
      "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
      "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
      "{{PAGE_ID}}": "tools",
      "{{SEARCH_VALUE}}": "",
      "{{NAV_HOME_ACTIVE}}": "",
      "{{NAV_ARTICLES_ACTIVE}}": "",
      "{{NAV_PROJECTS_ACTIVE}}": "",
      "{{NAV_TOOLS_ACTIVE}}": "active",
      "{{NAV_ABOUT_ACTIVE}}": "",
      "{{HERO_SECTION}}": "",
      "{{STATS_SECTION}}": "",
      "{{MAIN_CONTENT}}": `
<div class="nav" style="margin-bottom:16px">
  <a class="chip" href="/tools">← 工具中心</a>
</div>
<div id="tool-root"></div>
      `.trim(),
      "{{SITE_FOOTER}}": footer,
      "{{TOOL_SCRIPT}}": scriptBlock,
    });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  });

  app.get("/articles/:slug", async (c) => {
    const cfg = await getConfig(c.env);
    const slug = c.req.param("slug");
    return maybeCachePage(c.req.raw, cfg, `web:post:${slug}`, async () => {
      const year = String(new Date().getFullYear());
      const footer = renderSiteFooter(cfg, year);
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
        ? `<a class="chip chip--${hashColor(post.category_name ?? post.category_slug)}" href="/articles?category=${encodeURIComponent(
            post.category_slug
          )}">${escapeHtml(post.category_name ?? post.category_slug)}</a>`
        : `<span class="chip">未分类</span>`;
      const tagChips = (post.tags ?? [])
        .map((t) => {
          return `<a class="chip chip--${hashColor(t.name)}" href="/articles?tag=${encodeURIComponent(t.slug)}">${escapeHtml(
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
        "{{SITE_FOOTER}}": footer,
        "{{CACHE_VERSION}}": escapeHtml(cacheVersionForRequest(cfg, c.req.url)),
        "{{UI_WEB_STYLE}}": escapeHtml(String(cfg.webStyle ?? "current")),
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
