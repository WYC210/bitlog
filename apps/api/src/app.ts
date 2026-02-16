import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";
import type { R2Bucket } from "@cloudflare/workers-types";
import { ensureDefaultAdmin, verifyPassword, hashPassword } from "./lib/password.js";
import { randomId, randomToken, sha256Bytes, timingSafeEqual } from "./lib/crypto.js";
import { slugifyUnique } from "./lib/slug.js";
import { renderPostContent } from "./lib/render.js";
import { getSiteConfig, setSettings, bumpCacheVersion } from "./services/settings.js";
import { rateLimitAdminLogin, rateLimitSearch } from "./services/rate-limit.js";
import { embedFromShortcode } from "./lib/embeds.js";
import { getCachedResponse, putCachedResponse } from "./services/cache.js";
import { uploadImageToR2, getR2ObjectByKey } from "./services/assets.js";

export interface ApiBindings {
  db: Db;
  assetsR2?: R2Bucket;
}

type PostStatus = "draft" | "published" | "scheduled";

function statusCodeName(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "TOO_MANY_REQUESTS";
  if (status >= 500) return "INTERNAL_ERROR";
  return "ERROR";
}

function jsonError(message: string, status = 400, code?: string) {
  return { ok: false, error: { code: code ?? statusCodeName(status), message, status } } as const;
}

function nowMs() {
  return Date.now();
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}

function isSecureRequest(request: Request): boolean {
  const xfProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  if (xfProto === "https") return true;
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

const COOKIE_SESSION_ID = "bl_sid";
const COOKIE_REFRESH_TOKEN = "bl_rt";

async function requireAdmin(
  bindings: ApiBindings,
  request: Request
): Promise<{ adminId: string; username: string } | null> {
  const sid = getCookieFromHeader(request.headers.get("cookie"), COOKIE_SESSION_ID);
  const rt = getCookieFromHeader(request.headers.get("cookie"), COOKIE_REFRESH_TOKEN);
  if (!sid || !rt) return null;

  const sessions = await bindings.db.query<{
    admin_user_id: string;
    refresh_token_hash: Uint8Array;
    expires_at: number;
  }>(
    sql`SELECT admin_user_id, refresh_token_hash, expires_at
        FROM admin_sessions
        WHERE id = ${sid}`
  );
  const row = sessions[0];
  if (!row) return null;
  if (Number(row.expires_at) <= nowMs()) return null;

  const rtHash = await sha256Bytes(rt);
  if (!timingSafeEqual(rtHash, row.refresh_token_hash)) return null;

  const users = await bindings.db.query<{ id: string; username: string }>(
    sql`SELECT id, username FROM admin_users WHERE id = ${row.admin_user_id}`
  );
  const user = users[0];
  if (!user) return null;

  void bindings.db.execute(
    sql`UPDATE admin_sessions SET last_seen_at = ${nowMs()} WHERE id = ${sid}`
  );
  return { adminId: user.id, username: user.username };
}

function getCookieFromHeader(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k !== key) continue;
    return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export function createApiApp(bindings: ApiBindings) {
  const app = new Hono<{ Variables: { req_id: string } }>();

  app.use("*", async (c, next) => {
    const reqId = c.req.header("cf-ray") ?? randomId();
    c.set("req_id", reqId);
    try {
      await next();
    } catch (err) {
      console.error("[bitlog-api]", "req_error", { req_id: reqId, path: c.req.path }, err);
      throw err;
    } finally {
      c.header("x-request-id", reqId);
      if (c.res && c.res.status >= 500) {
        console.error("[bitlog-api]", "req_5xx", {
          req_id: reqId,
          method: c.req.method,
          path: c.req.path,
          status: c.res.status
        });
      }
    }
  });

  app.onError((err, c) => {
    const reqId = c.get("req_id") as string | undefined;
    console.error("[bitlog-api]", "unhandled", { req_id: reqId, path: c.req.path }, err);
    return c.json(jsonError("Internal Server Error", 500), 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true, db: bindings.db.kind }));

  app.get("/api/config", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, "config");
    if (maybeCached) return maybeCached;

    const config = await getSiteConfig(bindings.db);
    const response = c.json({
      ok: true,
      config: {
        ...config,
        embedAllowlistHosts: Array.from(config.embedAllowlistHosts.values())
      }
    });
    await putCachedResponse(c.req.raw, response, bindings.db, "config");
    return response;
  });

  app.get("/api/categories", async (c) => {
    const maybeCached = await getCachedResponse(
      c.req.raw,
      bindings.db,
      `categories`
    );
    if (maybeCached) return maybeCached;

    const rows = await bindings.db.query<{ id: string; slug: string; name: string }>(
      sql`SELECT id, slug, name FROM categories ORDER BY name ASC`
    );
    const response = c.json({ ok: true, categories: rows });
    await putCachedResponse(c.req.raw, response, bindings.db, `categories`);
    return response;
  });

  app.get("/api/tags", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, `tags`);
    if (maybeCached) return maybeCached;

    const rows = await bindings.db.query<{ id: string; slug: string; name: string }>(
      sql`SELECT id, slug, name FROM tags ORDER BY name ASC`
    );
    const response = c.json({ ok: true, tags: rows });
    await putCachedResponse(c.req.raw, response, bindings.db, `tags`);
    return response;
  });

  app.get("/api/posts", async (c) => {
    const url = new URL(c.req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      30,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? "10"))
    );
    const category = url.searchParams.get("category");
    const tag = url.searchParams.get("tag");

    const maybeCached = await getCachedResponse(
      c.req.raw,
      bindings.db,
      `posts:${page}:${pageSize}:${category ?? ""}:${tag ?? ""}`
    );
    if (maybeCached) return maybeCached;

    const offset = (page - 1) * pageSize;
    const now = nowMs();

    const rows = await bindings.db.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      publish_at: number;
      updated_at: number;
      category_slug: string | null;
      category_name: string | null;
    }>(
      sql`SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.publish_at,
            p.updated_at,
            c.slug AS category_slug,
            c.name AS category_name
          FROM posts p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.status IN ('published','scheduled')
            AND p.publish_at IS NOT NULL
            AND p.publish_at <= ${now}
            AND (${category ?? null} IS NULL OR c.slug = ${category ?? null})
            AND (
              ${tag ?? null} IS NULL OR EXISTS (
                SELECT 1
                FROM post_tags pt
                JOIN tags t ON t.id = pt.tag_id
                WHERE pt.post_id = p.id AND t.slug = ${tag ?? null}
              )
            )
          ORDER BY p.publish_at DESC, p.updated_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`
    );

    const response = c.json({ ok: true, page, pageSize, posts: rows });
    await putCachedResponse(
      c.req.raw,
      response,
      bindings.db,
      `posts:${page}:${pageSize}:${category ?? ""}:${tag ?? ""}`
    );
    return response;
  });

  app.get("/api/posts/:slug", async (c) => {
    const slug = c.req.param("slug");
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, `post:${slug}`);
    if (maybeCached) return maybeCached;

    const now = nowMs();
    const rows = await bindings.db.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      content_html: string;
      publish_at: number;
      updated_at: number;
      category_slug: string | null;
      category_name: string | null;
    }>(
      sql`SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.content_html,
            p.publish_at,
            p.updated_at,
            c.slug AS category_slug,
            c.name AS category_name
          FROM posts p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.slug = ${slug}
            AND p.status IN ('published','scheduled')
            AND p.publish_at IS NOT NULL
            AND p.publish_at <= ${now}
          LIMIT 1`
    );
    const post = rows[0];
    if (!post) return c.json(jsonError("Not found", 404), 404);

    const tags = await bindings.db.query<{ slug: string; name: string }>(
      sql`SELECT t.slug, t.name
          FROM post_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id = ${post.id}
          ORDER BY t.name ASC`
    );

    const response = c.json({ ok: true, post: { ...post, tags } });
    await putCachedResponse(c.req.raw, response, bindings.db, `post:${slug}`);
    return response;
  });

  app.get("/api/search", async (c) => {
    const url = new URL(c.req.url);
    const qRaw = url.searchParams.get("q") ?? "";
    const q = qRaw.trim();
    if (!q) return c.json({ ok: true, q: "", page: 1, pageSize: 10, results: [] });

    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitSearch(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too Many Requests", 429), 429);

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      30,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? "10"))
    );
    const tokens = q
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const uniqTokens = Array.from(new Set(tokens)).slice(0, 8);
    const normalizedQ = uniqTokens.join(" ");
    if (normalizedQ.length > 200) {
      return c.json(jsonError("Query too long", 400), 400);
    }

    const cacheKey = `search:${normalizedQ}:${page}:${pageSize}`;
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, cacheKey);
    if (maybeCached) return maybeCached;

    const now = nowMs();
    const offset = (page - 1) * pageSize;
    if (offset >= 3000) {
      return c.json({ ok: true, q: normalizedQ, page, pageSize, results: [] });
    }

    const likeParts = uniqTokens.map((t) => `%${t.toLowerCase()}%`);

    let scoreExpr = "0";
    const params: Array<string | number> = [];
    for (const tokenLike of likeParts) {
      scoreExpr += " + (CASE WHEN lower(p.title) LIKE ? THEN 10 ELSE 0 END)";
      params.push(tokenLike);
      scoreExpr += " + (CASE WHEN lower(p.summary) LIKE ? THEN 3 ELSE 0 END)";
      params.push(tokenLike);
      scoreExpr += " + (CASE WHEN lower(p.content_text) LIKE ? THEN 1 ELSE 0 END)";
      params.push(tokenLike);
      scoreExpr += ` + (CASE WHEN EXISTS (
        SELECT 1 FROM post_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id AND (lower(t.name) LIKE ? OR lower(t.slug) LIKE ?)
      ) THEN 6 ELSE 0 END)`;
      params.push(tokenLike, tokenLike);
    }

    const queryText = `
      WITH scored AS (
        SELECT
          p.id,
          p.slug,
          p.title,
          p.summary,
          p.publish_at,
          p.updated_at,
          c.slug AS category_slug,
          c.name AS category_name,
          (${scoreExpr}) AS score
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status IN ('published','scheduled')
          AND p.publish_at IS NOT NULL
          AND p.publish_at <= ?
      )
      SELECT *
      FROM scored
      WHERE score > 0
      ORDER BY score DESC, publish_at DESC, updated_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(now, pageSize, offset);

    const results = await bindings.db.query<Record<string, unknown>>({
      text: queryText,
      values: params as any
    });

    const response = c.json({ ok: true, q: normalizedQ, page, pageSize, results });
    await putCachedResponse(c.req.raw, response, bindings.db, cacheKey);
    return response;
  });

  app.get("/rss.xml", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, `rss`);
    if (maybeCached) return maybeCached;

    const config = await getSiteConfig(bindings.db);
    if (!config.baseUrl) return c.text("Missing site.base_url", 500);

    const now = nowMs();
    const rows = await bindings.db.query<{
      slug: string;
      title: string;
      summary: string;
      content_html: string;
      publish_at: number;
      updated_at: number;
    }>(
      sql`SELECT slug, title, summary, content_html, publish_at, updated_at
          FROM posts
          WHERE status IN ('published','scheduled')
            AND publish_at IS NOT NULL
            AND publish_at <= ${now}
          ORDER BY publish_at DESC, updated_at DESC
          LIMIT 50`
    );

    const feedItems = rows
      .map((p) => {
        const link = `${config.baseUrl}/posts/${encodeURIComponent(p.slug)}`;
        const pubDate = new Date(Number(p.publish_at)).toUTCString();
        const guid = link;
        return `
          <item>
            <title><![CDATA[${p.title}]]></title>
            <link>${link}</link>
            <guid isPermaLink="true">${guid}</guid>
            <pubDate>${pubDate}</pubDate>
            <description><![CDATA[${p.summary || p.content_html}]]></description>
          </item>
        `.trim();
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${config.title ?? "bitlog"}]]></title>
    <link>${config.baseUrl}</link>
    <description><![CDATA[${config.description ?? ""}]]></description>
    ${feedItems}
  </channel>
</rss>`;
    const response = new Response(xml, {
      headers: { "content-type": "application/rss+xml; charset=utf-8" }
    });
    await putCachedResponse(c.req.raw, response, bindings.db, `rss`);
    return response;
  });

  app.get("/sitemap.xml", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, `sitemap`);
    if (maybeCached) return maybeCached;

    const config = await getSiteConfig(bindings.db);
    if (!config.baseUrl) return c.text("Missing site.base_url", 500);

    const now = nowMs();
    const rows = await bindings.db.query<{ slug: string; updated_at: number }>(
      sql`SELECT slug, updated_at
          FROM posts
          WHERE status IN ('published','scheduled')
            AND publish_at IS NOT NULL
            AND publish_at <= ${now}
          ORDER BY updated_at DESC
          LIMIT 5000`
    );

    const urls = rows
      .map((p) => {
        const loc = `${config.baseUrl}/posts/${encodeURIComponent(p.slug)}`;
        const lastmod = new Date(Number(p.updated_at)).toISOString();
        return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${config.baseUrl}</loc></url>
  ${urls}
</urlset>`;
    const response = new Response(xml, {
      headers: { "content-type": "application/xml; charset=utf-8" }
    });
    await putCachedResponse(c.req.raw, response, bindings.db, `sitemap`);
    return response;
  });

  app.get("/assets/*", async (c) => {
    const key = c.req.path.replace(/^\/assets\//, "");
    if (!key) return c.json(jsonError("Not found", 404), 404);
    if (!bindings.assetsR2) return c.json(jsonError("Assets disabled", 404), 404);

    const obj = await getR2ObjectByKey(bindings.assetsR2, key);
    if (!obj) return c.json(jsonError("Not found", 404), 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(obj.body, { headers });
  });

  // Admin
  app.get("/api/admin/preview/:slug", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const slug = c.req.param("slug");
    const rows = await bindings.db.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      content_html: string;
      publish_at: number | null;
      updated_at: number;
      category_slug: string | null;
      category_name: string | null;
    }>(
      sql`SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.content_html,
            p.publish_at,
            p.updated_at,
            c.slug AS category_slug,
            c.name AS category_name
          FROM posts p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.slug = ${slug}
          LIMIT 1`
    );
    const post = rows[0];
    if (!post) return c.json(jsonError("Not found", 404), 404);

    const tags = await bindings.db.query<{ slug: string; name: string }>(
      sql`SELECT t.slug, t.name
          FROM post_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id = ${post.id}
          ORDER BY t.name ASC`
    );

    return c.json({
      ok: true,
      post: {
        ...post,
        publish_at: Number(post.publish_at ?? post.updated_at),
        tags
      }
    });
  });

  app.post("/api/admin/render", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const body = (await c.req.json().catch(() => null)) as { content_md?: string } | null;
    const contentMd = body?.content_md ?? "";
    if (typeof contentMd !== "string") return c.json(jsonError("Invalid content_md", 400), 400);

    const config = await getSiteConfig(bindings.db);
    const rendered = await renderPostContent(contentMd, {
      embedAllowlist: config.embedAllowlistHosts,
      embed: embedFromShortcode
    });

    return c.json({ ok: true, rendered });
  });

  app.post("/api/admin/login", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    await ensureDefaultAdmin(bindings.db);
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitAdminLogin(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too Many Requests", 429), 429);
    const body = await c.req.json().catch(() => null) as
      | { username?: string; password?: string; remember?: boolean }
      | null;
    const username = body?.username?.trim() ?? "";
    const password = body?.password ?? "";
    const remember = body?.remember ?? true;
    if (!username || !password) return c.json(jsonError("Missing credentials", 400), 400);

    const users = await bindings.db.query<{
      id: string;
      username: string;
      password_hash: Uint8Array | ArrayBuffer | string;
      password_salt: Uint8Array | ArrayBuffer | string;
      password_iterations: number;
    }>(
      sql`SELECT id, username, password_hash, password_salt, password_iterations
          FROM admin_users
          WHERE username = ${username}
          LIMIT 1`
    );
    const user = users[0];
    if (!user) return c.json(jsonError("Invalid credentials", 401), 401);

    const ok = await verifyPassword(password, {
      hash: user.password_hash,
      salt: user.password_salt,
      iterations: Number(user.password_iterations)
    });
    if (!ok) return c.json(jsonError("Invalid credentials", 401), 401);

    const sessionId = randomId();
    const refreshToken = randomToken();
    const refreshHash = await sha256Bytes(refreshToken);
    const ttlDays = remember ? 30 : 1;
    const expiresAt = nowMs() + ttlDays * 24 * 60 * 60 * 1000;

    await bindings.db.execute(
      sql`INSERT INTO admin_sessions
          (id, admin_user_id, refresh_token_hash, expires_at, created_at, last_seen_at, user_agent, ip)
          VALUES (${sessionId}, ${user.id}, ${refreshHash}, ${expiresAt}, ${nowMs()}, ${nowMs()}, ${
        getUserAgent(c.req.raw)
      }, ${ip})`
    );

    const secure = isSecureRequest(c.req.raw);
    setCookie(c, COOKIE_SESSION_ID, sessionId, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: ttlDays * 24 * 60 * 60
    });
    setCookie(c, COOKIE_REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: ttlDays * 24 * 60 * 60
    });

    return c.json({ ok: true, user: { id: user.id, username: user.username } });
  });

  app.post("/api/admin/logout", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    const sid = getCookie(c, COOKIE_SESSION_ID);
    if (session && sid) {
      await bindings.db.execute(sql`DELETE FROM admin_sessions WHERE id = ${sid}`);
    }
    deleteCookie(c, COOKIE_SESSION_ID, { path: "/" });
    deleteCookie(c, COOKIE_REFRESH_TOKEN, { path: "/" });
    return c.json({ ok: true });
  });

  app.post("/api/admin/refresh", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const sid = getCookie(c, COOKIE_SESSION_ID);
    const rt = getCookie(c, COOKIE_REFRESH_TOKEN);
    if (!sid || !rt) return c.json(jsonError("Unauthorized", 401), 401);

    const sessions = await bindings.db.query<{
      admin_user_id: string;
      refresh_token_hash: Uint8Array;
      expires_at: number;
    }>(
      sql`SELECT admin_user_id, refresh_token_hash, expires_at
          FROM admin_sessions WHERE id = ${sid} LIMIT 1`
    );
    const row = sessions[0];
    if (!row) return c.json(jsonError("Unauthorized", 401), 401);
    if (Number(row.expires_at) <= nowMs()) return c.json(jsonError("Unauthorized", 401), 401);
    const rtHash = await sha256Bytes(rt);
    if (!timingSafeEqual(rtHash, row.refresh_token_hash)) {
      return c.json(jsonError("Unauthorized", 401), 401);
    }

    const newRefresh = randomToken();
    const newHash = await sha256Bytes(newRefresh);
    await bindings.db.execute(
      sql`UPDATE admin_sessions
          SET refresh_token_hash = ${newHash}, last_seen_at = ${nowMs()}
          WHERE id = ${sid}`
    );
    const secure = isSecureRequest(c.req.raw);
    setCookie(c, COOKIE_REFRESH_TOKEN, newRefresh, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60
    });
    return c.json({ ok: true });
  });

  app.get("/api/admin/me", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    return c.json({ ok: true, user: session });
  });

  app.put("/api/admin/password", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = await c.req.json().catch(() => null) as
      | { oldPassword?: string; newPassword?: string }
      | null;
    const oldPassword = body?.oldPassword ?? "";
    const newPassword = body?.newPassword ?? "";
    if (!oldPassword || !newPassword) return c.json(jsonError("Missing fields", 400), 400);
    if (newPassword.length < 6) return c.json(jsonError("Password too short", 400), 400);

    const rows = await bindings.db.query<{
      password_hash: Uint8Array | ArrayBuffer | string;
      password_salt: Uint8Array | ArrayBuffer | string;
      password_iterations: number;
    }>(
      sql`SELECT password_hash, password_salt, password_iterations
           FROM admin_users WHERE id = ${session.adminId} LIMIT 1`
    );
    const row = rows[0];
    if (!row) return c.json(jsonError("Unauthorized", 401), 401);
    const ok = await verifyPassword(oldPassword, {
      hash: row.password_hash,
      salt: row.password_salt,
      iterations: Number(row.password_iterations)
    });
    if (!ok) return c.json(jsonError("Invalid credentials", 401), 401);

    const { hash, salt, iterations } = await hashPassword(newPassword);
    await bindings.db.execute(
      sql`UPDATE admin_users
          SET password_hash = ${hash},
              password_salt = ${salt},
              password_iterations = ${iterations},
              updated_at = ${nowMs()}
          WHERE id = ${session.adminId}`
    );
    return c.json({ ok: true });
  });

  app.put("/api/admin/settings", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json(jsonError("Invalid JSON", 400), 400);

    await setSettings(bindings.db, body);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.get("/api/admin/posts", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const url = new URL(c.req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(30, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20")));
    const status = url.searchParams.get("status")?.trim() as PostStatus | null;
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const offset = (page - 1) * pageSize;

    const rows = await bindings.db.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      status: PostStatus;
      publish_at: number | null;
      created_at: number;
      updated_at: number;
      category_slug: string | null;
      category_name: string | null;
    }>(
      sql`SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.status,
            p.publish_at,
            p.created_at,
            p.updated_at,
            c.slug AS category_slug,
            c.name AS category_name
          FROM posts p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE (${status ?? null} IS NULL OR p.status = ${status ?? null})
            AND (${q || null} IS NULL OR lower(p.title) LIKE ${q ? `%${q}%` : null})
          ORDER BY p.updated_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`
    );

    return c.json({ ok: true, page, pageSize, posts: rows });
  });

  app.get("/api/admin/posts/:id", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const id = c.req.param("id");
    const rows = await bindings.db.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      status: PostStatus;
      publish_at: number | null;
      created_at: number;
      updated_at: number;
      content_md: string;
      category_name: string | null;
    }>(
      sql`SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.status,
            p.publish_at,
            p.created_at,
            p.updated_at,
            p.content_md,
            c.name AS category_name
          FROM posts p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.id = ${id}
          LIMIT 1`
    );
    const post = rows[0];
    if (!post) return c.json(jsonError("Not found", 404), 404);

    const tags = await bindings.db.query<{ name: string; slug: string }>(
      sql`SELECT t.name, t.slug
          FROM post_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id = ${id}
          ORDER BY t.name ASC`
    );

    return c.json({ ok: true, post: { ...post, tags } });
  });

  app.post("/api/admin/posts", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = await c.req.json().catch(() => null) as
      | {
          title?: string;
          summary?: string;
          content_md?: string;
          category?: string | null;
          tags?: string[];
          status?: PostStatus;
          publish_at?: number | null;
        }
      | null;
    if (!body?.title || !body.content_md) return c.json(jsonError("Missing fields", 400), 400);

    const status: PostStatus = body.status ?? "draft";
    const publishAt =
      status === "draft" ? null : typeof body.publish_at === "number" ? body.publish_at : nowMs();

    const config = await getSiteConfig(bindings.db);
    const allowlist = config.embedAllowlistHosts;
    const rendered = await renderPostContent(body.content_md, {
      embedAllowlist: allowlist,
      embed: embedFromShortcode
    });

    const createdAt = nowMs();
    const postId = randomId();
    const slug = await slugifyUnique(bindings.db, body.title);

    const categoryId = body.category
      ? await upsertCategory(bindings.db, body.category)
      : null;
    const tagIds = await upsertTags(bindings.db, body.tags ?? []);

    await bindings.db.execute(
      sql`INSERT INTO posts
          (id, slug, title, summary, category_id, status, publish_at, created_at, updated_at, content_md, content_html, content_text)
          VALUES (${postId}, ${slug}, ${body.title}, ${body.summary ?? ""}, ${categoryId}, ${status}, ${publishAt}, ${createdAt}, ${createdAt}, ${body.content_md}, ${rendered.html}, ${rendered.text})`
    );
    for (const tagId of tagIds) {
      await bindings.db.execute(
        sql`INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (${postId}, ${tagId})`
      );
    }
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true, post: { id: postId, slug } });
  });

  app.put("/api/admin/posts/:id", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null) as
      | {
          title?: string;
          summary?: string;
          content_md?: string;
          category?: string | null;
          tags?: string[];
          status?: PostStatus;
          publish_at?: number | null;
        }
      | null;
    if (!body) return c.json(jsonError("Invalid JSON", 400), 400);

    const existing = await bindings.db.query<{ id: string; slug: string }>(
      sql`SELECT id, slug FROM posts WHERE id = ${id} LIMIT 1`
    );
    if (!existing[0]) return c.json(jsonError("Not found", 404), 404);

    const config = await getSiteConfig(bindings.db);
    const allowlist = config.embedAllowlistHosts;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (typeof body.title === "string") {
      fields.push("title = ?");
      values.push(body.title);
    }
    if (typeof body.summary === "string") {
      fields.push("summary = ?");
      values.push(body.summary);
    }
    if (typeof body.content_md === "string") {
      const rendered = await renderPostContent(body.content_md, {
        embedAllowlist: allowlist,
        embed: embedFromShortcode
      });
      fields.push("content_md = ?", "content_html = ?", "content_text = ?");
      values.push(body.content_md, rendered.html, rendered.text);
    }
    if ("category" in (body ?? {})) {
      const categoryId = body.category
        ? await upsertCategory(bindings.db, body.category)
        : null;
      fields.push("category_id = ?");
      values.push(categoryId);
    }
    if (body.status) {
      fields.push("status = ?");
      values.push(body.status);
      const publishAt =
        body.status === "draft"
          ? null
          : typeof body.publish_at === "number"
            ? body.publish_at
            : nowMs();
      fields.push("publish_at = ?");
      values.push(publishAt);
    }
    fields.push("updated_at = ?");
    values.push(nowMs());

    if (fields.length > 0) {
      const query = {
        text: `UPDATE posts SET ${fields.join(", ")} WHERE id = ?`,
        values: [...values, id]
      };
      await bindings.db.execute(query as any);
    }

    if (Array.isArray(body.tags)) {
      const tagIds = await upsertTags(bindings.db, body.tags);
      await bindings.db.execute(sql`DELETE FROM post_tags WHERE post_id = ${id}`);
      for (const tagId of tagIds) {
        await bindings.db.execute(
          sql`INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (${id}, ${tagId})`
        );
      }
    }

    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.delete("/api/admin/posts/:id", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const id = c.req.param("id");
    await bindings.db.execute(sql`DELETE FROM posts WHERE id = ${id}`);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.post("/api/admin/assets/images", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    if (!bindings.assetsR2) return c.json(jsonError("Upload disabled", 400), 400);

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.startsWith("image/")) return c.json(jsonError("Invalid type", 400), 400);
    if (contentType === "image/svg+xml") return c.json(jsonError("SVG disabled", 400), 400);

    const body = await c.req.arrayBuffer();
    if (body.byteLength > 10 * 1024 * 1024) return c.json(jsonError("Too large", 400), 400);

    const asset = await uploadImageToR2(
      { db: bindings.db, assetsR2: bindings.assetsR2 },
      {
        bytes: new Uint8Array(body),
        mime: contentType,
        createdBy: session.adminId
      }
    );
    return c.json({ ok: true, asset });
  });

  return app;
}

async function upsertCategory(db: Db, nameOrSlug: string): Promise<string> {
  const name = nameOrSlug.trim();
  if (!name) return null as unknown as string;
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = await db.query<{ id: string }>(
    sql`SELECT id FROM categories WHERE slug = ${slug} LIMIT 1`
  );
  if (existing[0]) return existing[0].id;

  const id = randomId();
  const t = nowMs();
  await db.execute(
    sql`INSERT INTO categories (id, slug, name, created_at, updated_at)
        VALUES (${id}, ${slug || id}, ${name}, ${t}, ${t})`
  );
  return id;
}

async function upsertTags(db: Db, tags: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of tags) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await db.query<{ id: string }>(
      sql`SELECT id FROM tags WHERE slug = ${slug} LIMIT 1`
    );
    if (existing[0]) {
      out.push(existing[0].id);
      continue;
    }

    const id = randomId();
    await db.execute(
      sql`INSERT INTO tags (id, slug, name, created_at)
          VALUES (${id}, ${slug || id}, ${name}, ${nowMs()})`
    );
    out.push(id);
  }
  return out;
}
