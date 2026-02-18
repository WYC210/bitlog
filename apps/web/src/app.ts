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

function renderChipsWithActive(
  items: Array<{ name: string; slug: string }>,
  baseHref: string,
  activeSlug: string | null
): string {
  return items
    .map((it) => {
      const href = `${baseHref}${encodeURIComponent(it.slug)}`;
      const cls = `chip${activeSlug && it.slug === activeSlug ? " is-active" : ""}`;
      return `<a class="${cls}" href="${href}">${escapeHtml(it.name)}</a>`;
    })
    .join("");
}

function buildTocFromHtml(contentHtml: string): { tocHtml: string; tocInlineLinks: string } {
  const headings = extractHeadings(contentHtml);
  if (headings.length === 0) return { tocHtml: "", tocInlineLinks: "" };

  const tocHtml = headings
    .map((h) => {
      const level = h.level === 3 ? "3" : "2";
      return `<a data-level="${level}" href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`;
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

  app.get("/", async (c) => {
    const cfg = await getConfig(c.env);
    return maybeCachePage(c.req.raw, cfg, "web:home", async () => {
      const list = await apiJson<ApiOk<{ posts: PostListItem[] }>>(c.env, `/api/posts?page=1&pageSize=6`);
      const posts = list.posts ?? [];

      const cards = posts
        .map((p) => {
          const dateText = isoDate(Number(p.publish_at ?? p.updated_at), cfg.timezone);
          const cat = p.category_name ?? p.category_slug ?? "";
          const catChip = cat ? `<span class="chip primary">${escapeHtml(cat)}</span>` : "";
          return `<a class="card article-card" href="/articles/${encodeURIComponent(p.slug)}">
  <div class="meta">${escapeHtml(dateText)}${catChip ? ` · ${catChip}` : ""}</div>
  <h2 class="article-title">${escapeHtml(p.title)}</h2>
  <p class="article-summary">${escapeHtml(p.summary ?? "")}</p>
</a>`;
        })
        .join("\n");

      const year = String(new Date().getFullYear());
      const html = replaceAll((await loadTemplates(c.env, c.req.url)).home, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{SITE_TITLE}}": escapeHtml(cfg.title ?? "Bitlog"),
        "{{SITE_DESC}}": escapeHtml(
          cfg.description ??
            "在 AI 时代重定义思考与写作：更清晰的结构，更轻量的表达，更可复用的知识沉淀。"
        ),
        "{{RECENT_CARDS}}": cards || `<div class="meta">暂无文章</div>`,
        "{{YEAR}}": escapeHtml(year),
        "{{CACHE_VERSION}}": escapeHtml(String(cfg.cacheVersion)),
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
          const catChip = cat ? `<span class="chip primary">${escapeHtml(cat)}</span>` : "";
          return `<a class="card article-card" href="/articles/${encodeURIComponent(p.slug)}">
  <div class="meta">${escapeHtml(dateText)}${catChip ? ` · ${catChip}` : ""}</div>
  <h2 class="article-title">${escapeHtml(p.title)}</h2>
  <p class="article-summary">${escapeHtml(p.summary ?? "")}</p>
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
        "{{CACHE_VERSION}}": escapeHtml(String(cfg.cacheVersion)),
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
          const platformCls = p.platform === "github" ? "chip primary" : "chip";
          const desc = p.description ? escapeHtml(p.description) : "（无描述）";
          const metaBits = [
            p.language ? escapeHtml(p.language) : "",
            `★ ${escapeHtml(String(p.stars ?? 0))}`,
            `Fork ${escapeHtml(String(p.forks ?? 0))}`,
            dateText ? `更新 ${escapeHtml(dateText)}` : ""
          ].filter(Boolean);
          return `<a class="card-link repo-card" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">
  <div class="repo-head">
    <div class="repo-title">${escapeHtml(p.name)}</div>
    <span class="${platformCls}">${escapeHtml(platformLabel)}</span>
  </div>
  <div class="repo-sub meta">${escapeHtml(p.fullName)}</div>
  <div class="repo-desc meta">${desc}</div>
  <div class="repo-meta">
    ${metaBits.map((m) => `<span class="pill">${m}</span>`).join("")}
    ${p.archived ? `<span class="pill">Archived</span>` : ""}
    ${p.fork ? `<span class="pill">Fork</span>` : ""}
  </div>
</a>`;
        })
        .join("\n");

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · 项目` : "项目"),
        "{{CACHE_VERSION}}": escapeHtml(String(cfg.cacheVersion)),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
        "{{PAGE_ID}}": "projects",
        "{{SEARCH_VALUE}}": "",
        "{{NAV_HOME_ACTIVE}}": "",
        "{{NAV_ARTICLES_ACTIVE}}": "",
        "{{NAV_PROJECTS_ACTIVE}}": "active",
        "{{NAV_TOOLS_ACTIVE}}": "",
        "{{MAIN_TITLE}}": escapeHtml("项目"),
        "{{MAIN_DESC}}": escapeHtml("展示 GitHub / Gitee 个人项目（可筛选）。"),
        "{{MAIN_CONTENT}}": `
${filter}
<div class="cards-grid">
  ${cards || `<div class="meta">暂无项目（请先在后台 设置 → 项目页 配置账号）</div>`}
</div>
<script>
  (function () {
    const key = "bl-projects-platform";
    try {
      const url = new URL(location.href);
      const p = (url.searchParams.get("platform") || "").trim();
      if (!p) {
        const stored = localStorage.getItem(key);
        if (stored && stored !== "all") {
          url.searchParams.set("platform", stored);
          location.replace(url.pathname + "?" + url.searchParams.toString());
          return;
        }
      } else {
        localStorage.setItem(key, p);
      }
    } catch {}
  })();
</script>
<div class="footer">© ${escapeHtml(year)} ${escapeHtml(cfg.title ?? "Bitlog")}</div>
`.trim(),
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
          const href = t.url ? String(t.url) : "";
          const isExternal = /^https?:\/\//i.test(href);
          const attrs = href
            ? isExternal
              ? `href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`
              : `href="${escapeHtml(href)}"`
            : "";
          const el = href ? "a" : "div";
          const groupChip = `<span class="chip">${escapeHtml(t.groupKey)}</span>`;
          const kindChip = `<span class="chip">${escapeHtml(t.kind)}</span>`;
          return `<${el} class="card-link tool-card" ${attrs}>
  <div class="repo-head">
    <div class="repo-title">${escapeHtml(t.title)}</div>
    <div class="tag-list" style="gap:6px">${groupChip}${kindChip}</div>
  </div>
  <div class="repo-desc meta">${escapeHtml(t.description || "（无描述）")}</div>
  ${href ? `<div class="repo-sub meta">${escapeHtml(href)}</div>` : ""}
</${el}>`;
        })
        .join("\n");

      const html = replaceAll((await loadTemplates(c.env, c.req.url)).page, {
        "{{PAGE_TITLE}}": escapeHtml(cfg.title ? `${cfg.title} · 工具中心` : "工具中心"),
        "{{CACHE_VERSION}}": escapeHtml(String(cfg.cacheVersion)),
        "{{SHORTCUTS_TEXT}}": JSON.stringify(cfg.shortcutsJson ?? ""),
        "{{PAGE_ID}}": "tools",
        "{{SEARCH_VALUE}}": "",
        "{{NAV_HOME_ACTIVE}}": "",
        "{{NAV_ARTICLES_ACTIVE}}": "",
        "{{NAV_PROJECTS_ACTIVE}}": "",
        "{{NAV_TOOLS_ACTIVE}}": "active",
        "{{MAIN_TITLE}}": escapeHtml("工具中心"),
        "{{MAIN_DESC}}": escapeHtml("小游戏 / API 工具 / 常用入口（后台实时管理）。"),
        "{{MAIN_CONTENT}}": `
${filter}
<div class="cards-grid">
  ${cards || `<div class="meta">暂无工具（请先在后台 设置 → 工具中心 新增）</div>`}
</div>
<div class="footer">© ${escapeHtml(year)} ${escapeHtml(cfg.title ?? "Bitlog")}</div>
`.trim(),
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
        ? `<a class="chip primary" href="/articles?category=${encodeURIComponent(
            post.category_slug
          )}">${escapeHtml(post.category_name ?? post.category_slug)}</a>`
        : `<span class="chip">未分类</span>`;
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
        "{{CACHE_VERSION}}": escapeHtml(String(cfg.cacheVersion)),
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
