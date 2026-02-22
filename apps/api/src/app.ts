import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Db } from "@bitlog/db";
import { sql, join } from "@bitlog/db/sql";
import type { R2Bucket } from "@cloudflare/workers-types";
import {
  CF_PBKDF2_MAX_ITERATIONS,
  decodeIterations,
  hashPassword,
  verifyPassword
} from "./lib/password.js";
import type { PasswordPolicy } from "./lib/password.js";
import { randomId, randomToken, sha256Bytes, timingSafeEqual } from "./lib/crypto.js";
import { slugifyUnique } from "./lib/slug.js";
import { renderPostContent } from "./lib/render.js";
import { getSiteConfig, setSettings, bumpCacheVersion } from "./services/settings.js";
import {
  rateLimitAdminLogin,
  rateLimitAdminRender,
  rateLimitProxy,
  rateLimitSearch
} from "./services/rate-limit.js";
import { embedFromShortcode } from "./lib/embeds.js";
import { getCachedResponse, putCachedResponse } from "./services/cache.js";
import { uploadImageToR2, getR2ObjectByKey } from "./services/assets.js";
import { getAdminPrefs, setAdminPrefs } from "./services/admin-prefs.js";
import { importPostsFromItems, importPostsFromZip } from "./services/import-posts.js";
import {
  getProjectsConfig,
  getProjectsConfigAdminView,
  patchProjectsConfig
} from "./services/projects.js";
import {
  createTool,
  deleteTool,
  getToolBySlug,
  listToolsAdmin,
  listToolsPublic,
  reorderTools,
  updateTool
} from "./services/tools.js";

export interface ApiBindings {
  db: Db;
  assetsR2?: R2Bucket;
  password?: PasswordPolicy;
}

type PostStatus = "draft" | "published" | "scheduled";
type ProjectsPlatform = "github" | "gitee";
type ToolGroup = "games" | "apis" | "utils" | "other";

const ABOUT_KEY_TECH_STACK = "about.tech_stack_json";
const ABOUT_KEY_VISITED_PLACES = "about.visited_places_json";
const ABOUT_KEY_TIMELINE = "about.timeline_json";
const ABOUT_KEY_SIDEBAR_DAILY_NEWS = "about.sidebar_daily_news_enabled";
const ABOUT_KEY_SIDEBAR_HISTORY_TODAY = "about.sidebar_history_today_enabled";
const ABOUT_KEY_SIDEBAR_TRAVEL = "about.sidebar_travel_enabled";
const POSTS_KEY_AUTO_SUMMARY = "posts.auto_summary";

function parseLooseBool(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function parsePostStatus(value: unknown): PostStatus | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "draft") return "draft";
  if (s === "published") return "published";
  if (s === "scheduled") return "scheduled";
  return null;
}

function toFiniteIntMs(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const ms = Math.trunc(value);
  if (ms <= 0) return null;
  return ms;
}

function getEffectivePasswordPolicy(input?: PasswordPolicy): { iterations: number; pepper?: string } {
  const rawPepper = typeof input?.pepper === "string" ? input.pepper.trim() : "";
  const pepper = rawPepper ? rawPepper : undefined;

  const rawIterations = Number(input?.iterations);
  const iterations =
    Number.isFinite(rawIterations) && rawIterations > 0
      ? Math.min(CF_PBKDF2_MAX_ITERATIONS, Math.floor(rawIterations))
      : CF_PBKDF2_MAX_ITERATIONS;

  return pepper ? { pepper, iterations } : { iterations };
}

function deriveSummaryFromText(text: string, maxLen = 150): string {
  const plain = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen) + "...";
}

type ProjectItem = {
  platform: ProjectsPlatform;
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

function cdataText(value: unknown): string {
  return String(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function nowMs() {
  return Date.now();
}

function parseProjectsPlatform(value: string | null): "all" | ProjectsPlatform | null {
  const s = String(value ?? "all").trim().toLowerCase();
  if (!s || s === "all") return "all";
  if (s === "github") return "github";
  if (s === "gitee") return "gitee";
  return null;
}

function parseToolGroup(value: string | null): ToolGroup | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "games") return "games";
  if (s === "apis") return "apis";
  if (s === "utils") return "utils";
  if (s === "other") return "other";
  return null;
}

function safeDateMs(value: unknown): number {
  const ms = typeof value === "string" || typeof value === "number" ? Date.parse(String(value)) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

async function fetchGithubProjects(input: {
  username: string;
  token: string | null;
  includeForks: boolean;
  maxItems: number;
}): Promise<{ projects: ProjectItem[]; error: { status: number; message: string; retryAfterSeconds?: number } | null }> {
  const perPage = Math.min(100, Math.max(1, input.maxItems));
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(input.username)}/repos`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("type", "owner");

  const headers = new Headers({
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "bitlog"
  });
  if (input.token) headers.set("authorization", `Bearer ${input.token}`);

  const res = await fetchWithTimeout(url.toString(), { headers }, 10_000);
  if (!res.ok) {
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? NaN);
    const resetUnix = Number(res.headers.get("x-ratelimit-reset") ?? NaN);
    const retryAfterSeconds =
      Number.isFinite(resetUnix) && resetUnix > 0
        ? Math.max(1, Math.ceil(resetUnix - Date.now() / 1000))
        : undefined;

    const body = (await res.json().catch(() => null)) as any;
    const msg = body?.message ? String(body.message) : `HTTP ${res.status}`;
    const extra =
      res.status === 403 && remaining === 0
        ? ` (GitHub API rate limit exceeded; try adding a Token)`
        : "";
    const error = {
      status: res.status,
      message: `${msg}${extra}`,
      ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {})
    };
    return { projects: [], error };
  }
  const data = (await res.json().catch(() => null)) as any;
  if (!Array.isArray(data)) return { projects: [], error: { status: 502, message: "GitHub API returned invalid JSON" } };

  const out: ProjectItem[] = [];
  for (const r of data) {
    const fork = !!r?.fork;
    if (!input.includeForks && fork) continue;
    const fullName = String(r?.full_name ?? "").trim();
    const name = String(r?.name ?? "").trim();
    const htmlUrl = String(r?.html_url ?? "").trim();
    if (!fullName || !name || !htmlUrl) continue;
    out.push({
      platform: "github",
      id: `github:${fullName}`,
      name,
      fullName,
      url: htmlUrl,
      description: r?.description ? String(r.description) : null,
      language: r?.language ? String(r.language) : null,
      stars: Number(r?.stargazers_count ?? 0) || 0,
      forks: Number(r?.forks_count ?? 0) || 0,
      fork,
      archived: !!r?.archived,
      homepage: r?.homepage ? String(r.homepage) : null,
      updatedAt: safeDateMs(r?.pushed_at ?? r?.updated_at)
    });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return { projects: out.slice(0, input.maxItems), error: null };
}

async function fetchGiteeProjects(input: {
  username: string;
  token: string | null;
  includeForks: boolean;
  maxItems: number;
}): Promise<{ projects: ProjectItem[]; error: { status: number; message: string; retryAfterSeconds?: number } | null }> {
  const perPage = Math.min(100, Math.max(1, input.maxItems));
  const url = new URL(`https://gitee.com/api/v5/users/${encodeURIComponent(input.username)}/repos`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("type", "owner");
  if (input.token) url.searchParams.set("access_token", input.token);

  const res = await fetchWithTimeout(url.toString(), { headers: { "user-agent": "bitlog" } }, 10_000);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    const msg = body?.message ? String(body.message) : `HTTP ${res.status}`;
    return { projects: [], error: { status: res.status, message: msg } };
  }
  const data = (await res.json().catch(() => null)) as any;
  if (!Array.isArray(data)) return { projects: [], error: { status: 502, message: "Gitee API returned invalid JSON" } };

  const out: ProjectItem[] = [];
  for (const r of data) {
    const fork = !!r?.fork;
    if (!input.includeForks && fork) continue;
    const fullName = String(r?.full_name ?? r?.path_with_namespace ?? "").trim();
    const name = String(r?.name ?? r?.path ?? "").trim();
    const htmlUrl = String(r?.html_url ?? "").trim();
    if (!fullName || !name || !htmlUrl) continue;
    out.push({
      platform: "gitee",
      id: `gitee:${fullName}`,
      name,
      fullName,
      url: htmlUrl,
      description: r?.description ? String(r.description) : null,
      language: r?.language ? String(r.language) : null,
      stars: Number(r?.stargazers_count ?? 0) || 0,
      forks: Number(r?.forks_count ?? 0) || 0,
      fork,
      archived: !!r?.archived,
      homepage: r?.homepage ? String(r.homepage) : null,
      updatedAt: safeDateMs(r?.pushed_at ?? r?.updated_at)
    });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return { projects: out.slice(0, input.maxItems), error: null };
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

function isSameOriginRequest(
  request: Request,
  opts?: { requireOrigin?: boolean; requireSameSite?: boolean }
): boolean {
  const requireOrigin = !!opts?.requireOrigin;
  const requireSameSite = !!opts?.requireSameSite;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return !requireOrigin;
  if (origin !== requestOrigin) return false;

  if (requireSameSite) {
    const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") return false;

    const referer = request.headers.get("referer");
    if (referer) {
      try {
        if (new URL(referer).origin !== requestOrigin) return false;
      } catch {
        return false;
      }
    }
  }

  return true;
}

function isIpAddress(value: string): boolean {
  const v = String(value ?? "").trim();
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})$/;
  if (ipv4.test(v)) return true;
  if (v.includes(":")) return true; // loose IPv6 check
  return false;
}

function isLikelyLocalOrUnknownIp(ip: string): boolean {
  const s = String(ip ?? "").trim().toLowerCase();
  if (!s || s === "unknown") return true;
  if (s === "localhost") return true;
  if (s === "127.0.0.1" || s === "::1") return true;
  if (s.startsWith("10.")) return true;
  if (s.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(s)) return true;
  return false;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = octets as [number, number, number, number];
  // Private, loopback, link-local, CGNAT, benchmark, multicast/reserved.
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224) return true;
  return false;
}

function normalizePortScanHost(input: string): { host: string; kind: "domain" | "ipv4" | "ipv6" } | null {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  let host = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) host = new URL(trimmed).hostname;
  } catch {
    // ignore
  }

  host = host.trim();
  if (!host) return null;
  if (host.length > 253) return null;

  const lower = host.toLowerCase();
  if (lower === "localhost") return null;

  // Basic IPv4 check.
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})$/;
  if (ipv4.test(host)) return { host, kind: "ipv4" };

  // IPv6 (very loose): accept a raw address without zone id/brackets; block obvious local ranges.
  if (host.includes(":")) {
    let v6 = host;
    if (v6.startsWith("[") && v6.endsWith("]")) v6 = v6.slice(1, -1);
    const s = v6.toLowerCase();
    if (s === "::1") return null;
    if (s.startsWith("fe80:")) return null; // link-local
    if (s.startsWith("fc") || s.startsWith("fd")) return null; // ULA fc00::/7 (rough)
    if (s.includes("%")) return null; // zone id
    return { host: v6, kind: "ipv6" };
  }

  const domain = normalizeDomainInput(host);
  if (!domain) return null;
  if (domain === "localhost") return null;
  return { host: domain, kind: "domain" };
}

function normalizeDomainInput(input: string): string | null {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  let host = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) host = new URL(trimmed).hostname;
  } catch {
    // ignore
  }

  host = host.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;
  if (host.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return null;

  const labels = host.split(".");
  if (!labels.length) return null;
  for (const label of labels) {
    if (!label || label.length > 63) return null;
    if (label.startsWith("-") || label.endsWith("-")) return null;
  }
  return host;
}

function normalizePhoneInput(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("0086")) digits = digits.slice(4);
  if (digits.startsWith("86") && digits.length === 13) digits = digits.slice(2);

  if (!/^\d{5,20}$/.test(digits)) return null;
  return digits;
}

function normalizePublicAssetKey(input: string): string | null {
  const key = String(input ?? "").trim();
  if (!key) return null;
  if (key.length > 512) return null;
  if (/[\u0000-\u001f\u007f]/.test(key)) return null;
  if (key.includes("\\") || key.includes("%")) return null;
  if (!key.startsWith("images/")) return null;
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key)) return null;

  const parts = key.split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) return null;

  return key;
}

async function getSettingsValues(db: Db, keys: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(keys.map((k) => String(k ?? "").trim()).filter(Boolean)));
  if (unique.length === 0) return new Map();
  const placeholders = join(unique.map((k) => sql`${k}`));
  const rows = await db.query<{ key: string; value: string }>(
    sql`SELECT key, value FROM settings WHERE key IN (${placeholders})`
  );
  return new Map(rows.map((r) => [r.key, r.value]));
}

function extractFirstIpv4(value: unknown): string | null {
  const ipv4Pattern =
    /\b(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\.(25[0-5]|2[0-4]\d|1?\d{1,2})\b/;

  if (typeof value === "string") {
    const match = value.match(ipv4Pattern);
    return match ? match[0] : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const ip = extractFirstIpv4(item);
      if (ip) return ip;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value as any)) {
      const ip = extractFirstIpv4((value as any)[k]);
      if (ip) return ip;
    }
  }
  return null;
}

async function resolveInputToIp(input: string): Promise<string | null> {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;
  if (isIpAddress(trimmed)) return trimmed;

  let domain = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      domain = new URL(trimmed).hostname;
    }
  } catch {
    // ignore parse errors
  }

  const dnsUrl = `https://uapis.cn/api/v1/network/dns?domain=${encodeURIComponent(domain)}&type=A`;
  const res = await fetchWithTimeout(
    dnsUrl,
    {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "bitlog" }
    },
    10_000
  );
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as unknown;
  return extractFirstIpv4(data);
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

  app.get("/api/about-config", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, "about-config");
    if (maybeCached) return maybeCached;

    const map = await getSettingsValues(bindings.db, [
      ABOUT_KEY_TECH_STACK,
      ABOUT_KEY_VISITED_PLACES,
      ABOUT_KEY_TIMELINE,
      ABOUT_KEY_SIDEBAR_DAILY_NEWS,
      ABOUT_KEY_SIDEBAR_HISTORY_TODAY,
      ABOUT_KEY_SIDEBAR_TRAVEL
    ]);

    const response = c.json({
      ok: true,
      config: {
        techStackJson: map.get(ABOUT_KEY_TECH_STACK) ?? null,
        visitedPlacesJson: map.get(ABOUT_KEY_VISITED_PLACES) ?? null,
        timelineJson: map.get(ABOUT_KEY_TIMELINE) ?? null,
        sidebarDailyNewsEnabled:
          map.has(ABOUT_KEY_SIDEBAR_DAILY_NEWS) ? parseLooseBool(map.get(ABOUT_KEY_SIDEBAR_DAILY_NEWS)) : true,
        sidebarHistoryTodayEnabled:
          map.has(ABOUT_KEY_SIDEBAR_HISTORY_TODAY) ? parseLooseBool(map.get(ABOUT_KEY_SIDEBAR_HISTORY_TODAY)) : true,
        sidebarTravelEnabled:
          map.has(ABOUT_KEY_SIDEBAR_TRAVEL) ? parseLooseBool(map.get(ABOUT_KEY_SIDEBAR_TRAVEL)) : true
      }
    });
    await putCachedResponse(c.req.raw, response, bindings.db, "about-config");
    return response;
  });

  app.get("/api/categories", async (c) => {
    const url = new URL(c.req.url);
    const limitRaw = url.searchParams.get("limit");
    const cursorRaw = url.searchParams.get("cursor");
    const paged = limitRaw !== null || cursorRaw !== null;
    const limit = Math.max(
      1,
      Math.min(1000, Number.isFinite(Number(limitRaw)) ? Math.trunc(Number(limitRaw)) : 1000)
    );

    let cursor: { name: string; id: string } | null = null;
    if (cursorRaw) {
      try {
        let b64 = cursorRaw.replace(/-/g, "+").replace(/_/g, "/");
        const pad = (4 - (b64.length % 4)) % 4;
        if (pad) b64 += "=".repeat(pad);
        const json = atob(b64);
        const parsed = JSON.parse(json) as any;
        const name = String(parsed?.name ?? "");
        const id = String(parsed?.id ?? "");
        if (name && id) cursor = { name, id };
      } catch {
        cursor = null;
      }
    }

    const maybeCached = await getCachedResponse(
      c.req.raw,
      bindings.db,
      paged ? `categories:${limit}:${cursorRaw ?? ""}` : `categories`
    );
    if (maybeCached) return maybeCached;

    const now = nowMs();
    const fetchLimit = paged ? limit + 1 : 1000000;
    const allRows = await bindings.db.query<{ id: string; slug: string; name: string }>(
      sql`SELECT c.id, c.slug, c.name
          FROM categories c
          WHERE EXISTS (
            SELECT 1
            FROM posts p
            WHERE p.category_id = c.id
              AND p.status IN ('published','scheduled')
              AND p.publish_at IS NOT NULL
              AND p.publish_at <= ${now}
          )
          AND (
            ${cursor?.name ?? null} IS NULL
            OR c.name > ${cursor?.name ?? null}
            OR (c.name = ${cursor?.name ?? null} AND c.id > ${cursor?.id ?? null})
          )
          ORDER BY c.name ASC, c.id ASC
          LIMIT ${fetchLimit}`
    );

    const hasMore = paged && allRows.length > limit;
    const rows = hasMore ? allRows.slice(0, limit) : allRows;

    let nextCursor: string | null = null;
    if (hasMore && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      const payload = JSON.stringify({ name: last.name, id: last.id });
      nextCursor = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    const response = c.json(paged ? { ok: true, categories: rows, nextCursor } : { ok: true, categories: rows });
    await putCachedResponse(
      c.req.raw,
      response,
      bindings.db,
      paged ? `categories:${limit}:${cursorRaw ?? ""}` : `categories`
    );
    return response;
  });

  app.get("/api/tags", async (c) => {
    const url = new URL(c.req.url);
    const limitRaw = url.searchParams.get("limit");
    const cursorRaw = url.searchParams.get("cursor");
    const orderRaw = (url.searchParams.get("order") ?? "").trim().toLowerCase();
    const order = orderRaw === "popular" ? "popular" : "name";
    const paged = limitRaw !== null || cursorRaw !== null;
    const limit = Math.max(
      1,
      Math.min(1000, Number.isFinite(Number(limitRaw)) ? Math.trunc(Number(limitRaw)) : 1000)
    );

    let cursor: { name: string; id: string } | null = null;
    if (cursorRaw) {
      try {
        let b64 = cursorRaw.replace(/-/g, "+").replace(/_/g, "/");
        const pad = (4 - (b64.length % 4)) % 4;
        if (pad) b64 += "=".repeat(pad);
        const json = atob(b64);
        const parsed = JSON.parse(json) as any;
        const name = String(parsed?.name ?? "");
        const id = String(parsed?.id ?? "");
        if (name && id) cursor = { name, id };
      } catch {
        cursor = null;
      }
    }

    const maybeCached = await getCachedResponse(
      c.req.raw,
      bindings.db,
      paged ? `tags:${order}:${limit}:${cursorRaw ?? ""}` : `tags:${order}`
    );
    if (maybeCached) return maybeCached;

    const now = nowMs();
    const fetchLimit = paged ? limit + 1 : 1000000;

    let allRows: Array<{ id: string; slug: string; name: string }> = [];
    if (order === "popular") {
      if (paged) return c.json(jsonError("Paged popular tags not supported", 400), 400);
      allRows = await bindings.db.query<{ id: string; slug: string; name: string; count: number }>(
        sql`SELECT t.id, t.slug, t.name, COUNT(DISTINCT pt.post_id) as count
            FROM tags t
            JOIN post_tags pt ON pt.tag_id = t.id
            JOIN posts p ON p.id = pt.post_id
            WHERE p.status IN ('published','scheduled')
              AND p.publish_at IS NOT NULL
              AND p.publish_at <= ${now}
            GROUP BY t.id, t.slug, t.name
            ORDER BY COUNT(DISTINCT pt.post_id) DESC, t.name ASC, t.id ASC
            LIMIT ${fetchLimit}`
      );
    } else {
      allRows = await bindings.db.query<{ id: string; slug: string; name: string }>(
        sql`SELECT t.id, t.slug, t.name
            FROM tags t
            WHERE EXISTS (
              SELECT 1
              FROM post_tags pt
              JOIN posts p ON p.id = pt.post_id
              WHERE pt.tag_id = t.id
                AND p.status IN ('published','scheduled')
                AND p.publish_at IS NOT NULL
                AND p.publish_at <= ${now}
            )
            AND (
              ${cursor?.name ?? null} IS NULL
              OR t.name > ${cursor?.name ?? null}
              OR (t.name = ${cursor?.name ?? null} AND t.id > ${cursor?.id ?? null})
            )
            ORDER BY t.name ASC, t.id ASC
            LIMIT ${fetchLimit}`
      );
    }

    const hasMore = paged && allRows.length > limit;
    const rows = hasMore ? allRows.slice(0, limit) : allRows;

    let nextCursor: string | null = null;
    if (hasMore && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      const payload = JSON.stringify({ name: last.name, id: last.id });
      nextCursor = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    const response = c.json(paged ? { ok: true, tags: rows, nextCursor } : { ok: true, tags: rows });
    await putCachedResponse(
      c.req.raw,
      response,
      bindings.db,
      paged ? `tags:${order}:${limit}:${cursorRaw ?? ""}` : `tags:${order}`
    );
    return response;
  });

  app.get("/api/projects", async (c) => {
    const url = new URL(c.req.url);
    const platform = parseProjectsPlatform(url.searchParams.get("platform"));
    if (!platform) return c.json(jsonError("Invalid platform", 400), 400);

    const cfg = await getProjectsConfig(bindings.db);
    const cacheKey = `projects:${platform}:${cfg.githubEnabled ? 1 : 0}:${cfg.giteeEnabled ? 1 : 0}:${cfg.githubUsername ?? ""}:${cfg.giteeUsername ?? ""}:${cfg.githubToken ? 1 : 0}:${cfg.giteeToken ? 1 : 0}:${cfg.includeForks ? 1 : 0}:${cfg.maxItemsPerPlatform}`;
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, cacheKey);
    if (maybeCached) return maybeCached;

    const tasks: Array<Promise<{ platform: ProjectsPlatform; projects: ProjectItem[]; error: { status: number; message: string; retryAfterSeconds?: number } | null }>> = [];
    if (platform !== "gitee" && cfg.githubEnabled && cfg.githubUsername) {
      tasks.push(
        fetchGithubProjects({
          username: cfg.githubUsername,
          token: cfg.githubToken,
          includeForks: cfg.includeForks,
          maxItems: cfg.maxItemsPerPlatform
        }).then((r) => ({ platform: "github" as const, ...r }))
      );
    }
    if (platform !== "github" && cfg.giteeEnabled && cfg.giteeUsername) {
      tasks.push(
        fetchGiteeProjects({
          username: cfg.giteeUsername,
          token: cfg.giteeToken,
          includeForks: cfg.includeForks,
          maxItems: cfg.maxItemsPerPlatform
        }).then((r) => ({ platform: "gitee" as const, ...r }))
      );
    }

    const results = await Promise.all(tasks);
    const errors: Partial<Record<ProjectsPlatform, { status: number; message: string; retryAfterSeconds?: number }>> = {};
    const lists: ProjectItem[][] = [];
    for (const r of results) {
      if (r.error) errors[r.platform] = r.error;
      lists.push(r.projects);
    }
    const projects = lists.flat().sort((a, b) => b.updatedAt - a.updatedAt);

    const response = c.json({
      ok: true,
      projects,
      errors: Object.keys(errors).length ? errors : undefined,
      accounts: {
        github: cfg.githubEnabled && cfg.githubUsername ? { username: cfg.githubUsername } : null,
        gitee: cfg.giteeEnabled && cfg.giteeUsername ? { username: cfg.giteeUsername } : null
      },
      config: { includeForks: cfg.includeForks, maxItemsPerPlatform: cfg.maxItemsPerPlatform }
    });
    if (!Object.keys(errors).length) {
      await putCachedResponse(c.req.raw, response, bindings.db, cacheKey);
    }
    return response;
  });

  app.get("/api/tools", async (c) => {
    const url = new URL(c.req.url);
    const group = parseToolGroup(url.searchParams.get("group"));
    if (url.searchParams.has("group") && !group) return c.json(jsonError("Invalid group", 400), 400);

    const maybeCached = await getCachedResponse(
      c.req.raw,
      bindings.db,
      `tools:${group ?? "all"}`
    );
    if (maybeCached) return maybeCached;

    const tools = await listToolsPublic(bindings.db, group);
    const response = c.json({ ok: true, tools });
    await putCachedResponse(c.req.raw, response, bindings.db, `tools:${group ?? "all"}`);
    return response;
  });

  app.get("/api/tools/:slug", async (c) => {
    const slug = c.req.param("slug");
    const tool = await getToolBySlug(bindings.db, slug);
    if (!tool) return c.json(jsonError("Not found", 404), 404);
    return c.json({ ok: true, tool });
  });

  app.get("/api/tools/:slug/script.js", async (c) => {
    const slug = c.req.param("slug");
    const tool = await getToolBySlug(bindings.db, slug);
    if (!tool || !tool.clientCode) {
      return new Response("// no script", { status: 404, headers: { "content-type": "application/javascript; charset=utf-8" } });
    }
    const code = tool.clientCode;
    return new Response(code, {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  });

  // Public tools: IP location lookup.
  app.get("/api/ip-location", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const input = String(url.searchParams.get("ip") ?? "auto").trim();
    const targetIp = !input || input === "auto" ? ip : await resolveInputToIp(input);
    if (!targetIp || targetIp === "unknown") return c.json(jsonError("Invalid ip", 400), 400);

    const upstream = `https://freegeoip.app/json/${encodeURIComponent(targetIp)}`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      10_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const data = (await res.json().catch(() => null)) as any;
    if (!data || typeof data !== "object") return c.json(jsonError("Upstream invalid JSON", 502), 502);

    return c.json({
      ok: true,
      ip: String(data.ip ?? targetIp),
      country: data.country_name ? String(data.country_name) : "",
      region: data.region_name ? String(data.region_name) : "",
      city: data.city ? String(data.city) : "",
      latitude: typeof data.latitude === "number" ? data.latitude : null,
      longitude: typeof data.longitude === "number" ? data.longitude : null,
      timezone: data.time_zone ? String(data.time_zone) : null,
      source: "freegeoip",
      raw: data
    });
  });

  // Public: Weather now (IP auto locate, no browser permission).
  app.get("/api/weather-now", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    type WeatherLocation = {
      ip: string;
      country: string;
      region: string;
      city: string;
      latitude: number | null;
      longitude: number | null;
      timezone: string | null;
      source: "cf" | "freegeoip" | "unknown";
    };

    const errors: Array<{ source: string; message: string; status?: number }> = [];

    const cf = (c.req.raw as any)?.cf as any | undefined;
    const cfLocation: WeatherLocation | null =
      cf && typeof cf === "object"
        ? {
            ip,
            country: cf?.country ? String(cf.country) : "",
            region: cf?.region ? String(cf.region) : "",
            city: cf?.city ? String(cf.city) : "",
            latitude: typeof cf?.latitude === "number" ? cf.latitude : null,
            longitude: typeof cf?.longitude === "number" ? cf.longitude : null,
            timezone: cf?.timezone ? String(cf.timezone) : null,
            source: "cf"
          }
        : null;

    let locRaw: any = null;
    let freegeoipLocation: WeatherLocation | null = null;

    const needFreegeoip =
      !cfLocation ||
      (!cfLocation.city && !cfLocation.region && typeof cfLocation.latitude !== "number");

    if (needFreegeoip) {
      const upstreamIp = isLikelyLocalOrUnknownIp(ip)
        ? `https://freegeoip.app/json/`
        : `https://freegeoip.app/json/${encodeURIComponent(ip)}`;

      try {
        const locRes = await fetchWithTimeout(
          upstreamIp,
          { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
          10_000
        );
        if (!locRes.ok) {
          errors.push({
            source: "freegeoip",
            status: locRes.status,
            message: `Upstream HTTP ${locRes.status}`
          });
        } else {
          locRaw = (await locRes.json().catch(() => null)) as any;
          if (!locRaw || typeof locRaw !== "object") {
            errors.push({ source: "freegeoip", message: "Upstream invalid JSON" });
          } else {
            freegeoipLocation = {
              ip: String(locRaw.ip ?? ip),
              country: locRaw.country_name ? String(locRaw.country_name) : "",
              region: locRaw.region_name ? String(locRaw.region_name) : "",
              city: locRaw.city ? String(locRaw.city) : "",
              latitude: typeof locRaw.latitude === "number" ? locRaw.latitude : null,
              longitude: typeof locRaw.longitude === "number" ? locRaw.longitude : null,
              timezone: locRaw.time_zone ? String(locRaw.time_zone) : null,
              source: "freegeoip"
            };
          }
        }
      } catch (e) {
        errors.push({ source: "freegeoip", message: (e as any)?.message ? String((e as any).message) : "Fetch failed" });
      }
    }

    const location: WeatherLocation =
      cfLocation && (cfLocation.city || typeof cfLocation.latitude === "number")
        ? cfLocation
        : freegeoipLocation ??
          (cfLocation ?? {
            ip,
            country: "",
            region: "",
            city: "",
            latitude: null,
            longitude: null,
            timezone: null,
            source: "unknown"
          });

    const cityCandidates = [location.city, location.region, location.country].filter(Boolean);
    let weatherUapis: any = null;
    let uapisCity: string | null = null;

    for (const candidate of cityCandidates) {
      const upstreamWeather = `https://uapis.cn/api/v1/misc/weather?city=${encodeURIComponent(candidate)}`;
      try {
        const weatherRes = await fetchWithTimeout(
          upstreamWeather,
          { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
          12_000
        );
        if (!weatherRes.ok) {
          errors.push({ source: "uapis-weather", status: weatherRes.status, message: `Upstream HTTP ${weatherRes.status}` });
          continue;
        }
        const data = (await weatherRes.json().catch(() => null)) as any;
        if (!data || typeof data !== "object") {
          errors.push({ source: "uapis-weather", message: "Upstream invalid JSON" });
          continue;
        }
        weatherUapis = data;
        uapisCity = candidate;
        break;
      } catch (e) {
        errors.push({ source: "uapis-weather", message: (e as any)?.message ? String((e as any).message) : "Fetch failed" });
      }
    }

    let weatherOpenMeteo: any = null;
    if (typeof location.latitude === "number" && typeof location.longitude === "number") {
      const upstream =
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(location.latitude))}` +
        `&longitude=${encodeURIComponent(String(location.longitude))}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
        `&timezone=auto`;
      try {
        const res = await fetchWithTimeout(
          upstream,
          { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
          12_000
        );
        if (!res.ok) {
          errors.push({ source: "open-meteo", status: res.status, message: `Upstream HTTP ${res.status}` });
        } else {
          const data = (await res.json().catch(() => null)) as any;
          if (data && typeof data === "object") weatherOpenMeteo = data;
          else errors.push({ source: "open-meteo", message: "Upstream invalid JSON" });
        }
      } catch (e) {
        errors.push({ source: "open-meteo", message: (e as any)?.message ? String((e as any).message) : "Fetch failed" });
      }
    }

    return c.json({
      ok: true,
      ip,
      location,
      weather: {
        uapis: weatherUapis,
        uapisCity,
        openMeteo: weatherOpenMeteo
      },
      errors,
      raw: { cf: cf ?? null, ipLocation: locRaw }
    });
  });

  // Public: Daily news image (proxy uapis.cn).
  app.get("/api/news-image", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, "news-image");
    if (maybeCached) return maybeCached;

    const upstream = `https://uapis.cn/api/v1/daily/news-image`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "image/*,*/*;q=0.8", "user-agent": "bitlog" } },
      12_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const headers = new Headers();
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!ct.includes("image/")) {
      const data = (await res.json().catch(() => null)) as any;
      const msg = data?.message ? String(data.message) : "Upstream invalid content";
      return c.json(jsonError(msg, 502), 502);
    }
    headers.set("content-type", ct);
    const len = res.headers.get("content-length");
    if (len) headers.set("content-length", len);
    headers.set("cache-control", "public, max-age=600");

    const response = new Response(res.body, { status: 200, headers });
    await putCachedResponse(c.req.raw, response, bindings.db, "news-image");
    return response;
  });

  // Public: Programmer history today (proxy uapis.cn).
  app.get("/api/programmer-history", async (c) => {
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, "programmer-history");
    if (maybeCached) return maybeCached;

    const upstream = `https://uapis.cn/api/v1/history/programmer/today`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      12_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const data = (await res.json().catch(() => null)) as any;
    if (!data || typeof data !== "object") return c.json(jsonError("Upstream invalid JSON", 502), 502);

    const response = c.json({
      ok: true,
      message: data.message ? String(data.message) : "",
      date: data.date ? String(data.date) : "",
      events: Array.isArray(data.events) ? data.events : [],
      raw: data
    });
    await putCachedResponse(c.req.raw, response, bindings.db, "programmer-history");
    return response;
  });

  // Public tools: DNS query (powered by uapis.cn).
  app.get("/api/dns-query", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const domainRaw = String(url.searchParams.get("domain") ?? "").trim();
    const domain = normalizeDomainInput(domainRaw);
    if (!domain) return c.json(jsonError("Invalid domain", 400), 400);

    const typeRaw = String(url.searchParams.get("type") ?? "A").trim().toUpperCase();
    const allowedTypes = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "PTR"]);
    const type = allowedTypes.has(typeRaw) ? typeRaw : "A";

    const upstream = `https://uapis.cn/api/v1/network/dns?domain=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      10_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const data = (await res.json().catch(() => null)) as any;
    if (!data || typeof data !== "object") return c.json(jsonError("Upstream invalid JSON", 502), 502);

    return c.json({ ok: true, domain, type, raw: data });
  });

  // Public tools: ICP query (powered by uapis.cn).
  app.get("/api/icp-query", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const domainRaw = String(url.searchParams.get("domain") ?? "").trim();
    const domain = normalizeDomainInput(domainRaw);
    if (!domain) return c.json(jsonError("Invalid domain", 400), 400);

    const upstream = `https://uapis.cn/api/v1/network/icp?domain=${encodeURIComponent(domain)}`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      12_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const data = (await res.json().catch(() => null)) as any;
    if (!data || typeof data !== "object") return c.json(jsonError("Upstream invalid JSON", 502), 502);

    return c.json({ ok: true, domain, raw: data });
  });

  // Public tools: Phone location (powered by uapis.cn).
  app.get("/api/phone-location", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const phoneRaw = String(url.searchParams.get("phone") ?? "").trim();
    const phone = normalizePhoneInput(phoneRaw);
    if (!phone) return c.json(jsonError("Invalid phone", 400), 400);

    const upstream = `https://uapis.cn/api/v1/misc/phoneinfo?phone=${encodeURIComponent(phone)}`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      10_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const data = (await res.json().catch(() => null)) as any;
    if (!data || typeof data !== "object") return c.json(jsonError("Upstream invalid JSON", 502), 502);

    return c.json({ ok: true, phone, raw: data });
  });

  // Public tools: ASCII art (powered by uapis.cn).
  app.get("/api/ascii-art", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const text = String(url.searchParams.get("text") ?? "").trim();
    if (!text) return c.json(jsonError("Missing text", 400), 400);
    if (text.length > 200) return c.json(jsonError("Text too long", 400), 400);

    const font = String(url.searchParams.get("font") ?? "3D Diagonal").trim();
    if (!font || font.length > 80) return c.json(jsonError("Invalid font", 400), 400);

    const upstream = `https://uapis.cn/api/v1/text/ascii?text=${encodeURIComponent(text)}&font=${encodeURIComponent(font)}`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      12_000
    );
    if (!res.ok) return c.json(jsonError("Upstream error", 502), 502);

    const data = (await res.json().catch(() => null)) as any;
    if (!data || typeof data !== "object") return c.json(jsonError("Upstream invalid JSON", 502), 502);

    return c.json({ ok: true, text, font, raw: data });
  });

  // Public tools: JSON formatting (first-party).
  app.post("/api/json-format", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const body = (await c.req.json().catch(() => null)) as any;
    const content =
      typeof body === "string"
        ? body
        : typeof body?.content === "string"
          ? body.content
          : typeof body?.text === "string"
            ? body.text
            : typeof body?.json === "string"
              ? body.json
              : null;

    if (typeof content !== "string") return c.json(jsonError("Missing content", 400), 400);
    if (content.length > 200_000) return c.json(jsonError("Content too long", 400), 400);

    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      return c.json({
        ok: true,
        formatted,
        stats: { inputChars: content.length, outputChars: formatted.length }
      });
    } catch {
      return c.json(jsonError("Invalid JSON", 400), 400);
    }
  });

  // Public tools: Port scan (powered by uapis.cn).
  app.get("/api/port-scan", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const hostRaw = String(url.searchParams.get("host") ?? "").trim();
    const parsedHost = normalizePortScanHost(hostRaw);
    if (!parsedHost) return c.json(jsonError("Invalid host", 400), 400);
    if (parsedHost.kind === "ipv4" && isPrivateOrReservedIpv4(parsedHost.host)) {
      return c.json(jsonError("Invalid host", 400), 400);
    }
    const host = parsedHost.host;

    const protocol = String(url.searchParams.get("protocol") ?? "tcp").trim().toLowerCase() === "udp" ? "udp" : "tcp";
    const portsParam = String(url.searchParams.get("ports") ?? "").trim();

    const COMMON = [
      { port: 21, service: "FTP" },
      { port: 22, service: "SSH" },
      { port: 23, service: "Telnet" },
      { port: 25, service: "SMTP" },
      { port: 53, service: "DNS" },
      { port: 80, service: "HTTP" },
      { port: 110, service: "POP3" },
      { port: 143, service: "IMAP" },
      { port: 443, service: "HTTPS" },
      { port: 993, service: "IMAPS" },
      { port: 995, service: "POP3S" },
      { port: 1433, service: "MSSQL" },
      { port: 3306, service: "MySQL" },
      { port: 3389, service: "RDP" },
      { port: 5432, service: "PostgreSQL" },
      { port: 6379, service: "Redis" },
      { port: 8080, service: "HTTP-Alt" },
      { port: 8443, service: "HTTPS-Alt" }
    ];

    const parsePorts = (s: string) => {
      const items = s
        .split(",")
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 65535);
      return Array.from(new Set(items)).slice(0, 50);
    };

    const ports = portsParam ? parsePorts(portsParam) : COMMON.map((p) => p.port);
    if (!ports.length) return c.json(jsonError("Invalid ports", 400), 400);

    const serviceByPort = new Map<number, string>(COMMON.map((x) => [x.port, x.service]));

    async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
      const out: R[] = [];
      let i = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
          const idx = i++;
          out[idx] = await fn(items[idx]!);
        }
      });
      await Promise.all(workers);
      return out;
    }

    const startedAt = Date.now();
    const results = await mapLimit(ports, 8, async (port) => {
      const apiUrl = `https://uapis.cn/api/v1/network/portscan?host=${encodeURIComponent(host)}&port=${port}&protocol=${protocol}`;
      try {
        const res = await fetchWithTimeout(
          apiUrl,
          { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
          8_000
        );
        const data = (await res.json().catch(() => null)) as any;
        const status = data?.port_status ? String(data.port_status) : res.ok ? "unknown" : "error";
        return { port, status, service: serviceByPort.get(port) ?? null, raw: data ?? null };
      } catch {
        return { port, status: "error", service: serviceByPort.get(port) ?? null, raw: null };
      }
    });

    const open = results.filter((r) => r.status === "open").length;
    const closed = results.filter((r) => r.status === "closed").length;
    const unknown = results.length - open - closed;

    return c.json({
      ok: true,
      host,
      protocol,
      ports,
      durationMs: Date.now() - startedAt,
      summary: { open, closed, unknown },
      results
    });
  });

  // Public tools: Beijing vegetable wholesale prices.
  app.get("/api/vegetable-prices", async (c) => {
    const ip = getClientIp(c.req.raw);
    const limited = await rateLimitProxy(bindings.db, ip);
    if (!limited.ok) return c.json(jsonError("Too many requests", 429), 429);

    const url = new URL(c.req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));
    const market = String(url.searchParams.get("market") ?? "").trim();

    const userAgent =
      getUserAgent(c.req.raw) ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    type VegetablePrice = { name: string; price: string; unit: string; market: string; date: string };

    const marketConfigs = [
      {
        name: "新发地",
        fullName: "新发地批发市场",
        url: "http://www.xinfadi.com.cn/getPriceData.html",
        method: "POST" as const,
        headers: {
          "User-Agent": userAgent,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json, text/javascript, */*; q=0.01",
          Referer: "http://www.xinfadi.com.cn/marketanalysis/0/list/1.shtml"
        }
      },
      {
        name: "大洋路",
        fullName: "大洋路农产品批发市场",
        url: "https://www.dlync.com/market/getPriceData",
        method: "GET" as const,
        headers: { "User-Agent": userAgent, Accept: "application/json", Referer: "https://www.dlync.com/market" }
      },
      {
        name: "岳各庄",
        fullName: "岳各庄批发市场",
        url: "https://www.ygznc.com/api/market/prices",
        method: "GET" as const,
        headers: { "User-Agent": userAgent, Accept: "application/json", Referer: "https://www.ygznc.com/market" }
      },
      {
        name: "锦绣大地",
        fullName: "锦绣大地农产品批发市场",
        url: "https://www.jxdadi.com/market/api/prices",
        method: "GET" as const,
        headers: { "User-Agent": userAgent, Accept: "application/json", Referer: "https://www.jxdadi.com/market" }
      }
    ];

    const targetMarkets = market
      ? marketConfigs.filter((cfg) => cfg.name === market || cfg.fullName.includes(market))
      : marketConfigs;

    let allData: VegetablePrice[] = [];
    let realDataFound = false;

    for (const cfg of targetMarkets) {
      try {
        let res: Response;
        if (cfg.method === "POST") {
          const formData = new URLSearchParams({
            limit: String(limit),
            current: String(page),
            pubDateStartTime: "",
            pubDateEndTime: "",
            prodPcatid: "",
            prodCatid: "",
            prodName: ""
          });
          res = await fetchWithTimeout(
            cfg.url,
            { method: "POST", headers: cfg.headers, body: formData.toString() },
            15_000
          );
        } else {
          res = await fetchWithTimeout(
            `${cfg.url}?page=${page}&limit=${limit}`,
            { method: "GET", headers: cfg.headers },
            15_000
          );
        }
        if (!res.ok) continue;
        const data = (await res.json().catch(() => null)) as any;
        if (!data) continue;

        if (cfg.name === "新发地" && Array.isArray(data.list) && data.list.length > 0) {
          const marketData: VegetablePrice[] = data.list.map((item: any) => ({
            name: item?.prodName ? String(item.prodName) : "未知蔬菜",
            price: item?.lowPrice ? String(item.lowPrice) : "0.00",
            unit: item?.unitInfo ? String(item.unitInfo) : "斤",
            market: cfg.fullName,
            date: item?.pubDate
              ? new Date(String(item.pubDate)).toLocaleDateString("zh-CN")
              : new Date().toLocaleDateString("zh-CN")
          }));
          allData = allData.concat(marketData);
          realDataFound = true;
        } else if (Array.isArray(data.data) && data.data.length > 0) {
          const marketData: VegetablePrice[] = data.data.map((item: any) => ({
            name: item?.name ? String(item.name) : item?.productName ? String(item.productName) : "未知蔬菜",
            price: item?.price ? String(item.price) : item?.lowPrice ? String(item.lowPrice) : "0.00",
            unit: item?.unit ? String(item.unit) : item?.unitInfo ? String(item.unitInfo) : "斤",
            market: cfg.fullName,
            date: item?.date || item?.updateTime
              ? new Date(String(item.date ?? item.updateTime)).toLocaleDateString("zh-CN")
              : new Date().toLocaleDateString("zh-CN")
          }));
          allData = allData.concat(marketData);
          realDataFound = true;
        }
      } catch {
        // ignore and try next market
      }
    }

    if (realDataFound && allData.length > 0) {
      const grouped = new Map<string, VegetablePrice>();
      for (const item of allData) {
        const key = `${item.market}-${item.name}`;
        if (grouped.has(key)) {
          const existing = grouped.get(key)!;
          const a = Number.parseFloat(existing.price);
          const b = Number.parseFloat(item.price);
          if (Number.isFinite(a) && Number.isFinite(b)) existing.price = ((a + b) / 2).toFixed(2);
        } else {
          grouped.set(key, { ...item });
        }
      }

      const unique = Array.from(grouped.values());
      const startIndex = (page - 1) * limit;
      const paginated = unique.slice(startIndex, startIndex + limit);
      const prices = paginated.map((x) => Number.parseFloat(x.price)).filter((n) => Number.isFinite(n));
      const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

      return c.json({
        ok: true,
        source: "real_data",
        updateTime: new Date().toISOString(),
        marketsQueried: targetMarkets.map((m) => m.fullName),
        data: paginated,
        pagination: { page, limit, total: unique.length },
        statistics: {
          averagePrice: avg ? avg.toFixed(2) : "0.00",
          priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 },
          vegetableTypes: new Set(paginated.map((x) => x.name)).size,
          markets: new Set(paginated.map((x) => x.market)).size
        }
      });
    }

    // fallback: mock data (when upstreams fail)
    const vegetables = [
      "白菜",
      "萝卜",
      "胡萝卜",
      "土豆",
      "洋葱",
      "西红柿",
      "黄瓜",
      "茄子",
      "青椒",
      "韭菜",
      "菠菜",
      "芹菜",
      "生菜",
      "豆角",
      "冬瓜",
      "南瓜",
      "西兰花",
      "包菜"
    ];
    const markets = targetMarkets.map((x) => x.fullName);
    const units = ["斤", "公斤", "袋"];

    const startIndex = (page - 1) * limit;
    const data: VegetablePrice[] = [];
    for (let i = 0; i < limit; i++) {
      const veg = vegetables[(startIndex + i) % vegetables.length]!;
      const mkt = markets[Math.floor(Math.random() * markets.length)] ?? "未知市场";
      const price = (Math.max(0.5, 1 + Math.random() * 12)).toFixed(2);
      data.push({ name: veg, price, unit: units[Math.floor(Math.random() * units.length)]!, market: mkt, date: new Date().toLocaleDateString("zh-CN") });
    }
    const prices = data.map((x) => Number.parseFloat(x.price)).filter((n) => Number.isFinite(n));
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    return c.json({
      ok: true,
      source: "mock_data",
      updateTime: new Date().toISOString(),
      marketsQueried: targetMarkets.map((m) => m.fullName),
      data,
      pagination: { page, limit, total: vegetables.length * markets.length },
      statistics: {
        averagePrice: avg ? avg.toFixed(2) : "0.00",
        priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 }
      }
    });
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
      `posts:v3:${page}:${pageSize}:${category ?? ""}:${tag ?? ""}`
    );
    if (maybeCached) return maybeCached;

    const offset = (page - 1) * pageSize;
    const now = nowMs();
    const fetchLimit = pageSize + 1;

    const rows = await bindings.db.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      publish_at: number;
      updated_at: number;
      category_slug: string | null;
      category_name: string | null;
      total: number;
    }>(
      sql`SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.publish_at,
            p.updated_at,
            c.slug AS category_slug,
            c.name AS category_name,
            COUNT(*) OVER() AS total
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
          LIMIT ${fetchLimit} OFFSET ${offset}`
    );

    const hasMore = rows.length > pageSize;
    const posts = hasMore ? rows.slice(0, pageSize) : rows;
    const total = Number(posts[0]?.total ?? rows[0]?.total ?? 0) || 0;
    const safePosts = posts.map((p) => {
      const { total: _total, ...rest } = p as any;
      return rest;
    });
    const response = c.json({ ok: true, page, pageSize, hasMore, total, posts: safePosts });
    await putCachedResponse(
      c.req.raw,
      response,
      bindings.db,
      `posts:v3:${page}:${pageSize}:${category ?? ""}:${tag ?? ""}`
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
    if (!q) return c.json({ ok: true, q: "", page: 1, pageSize: 10, hasMore: false, total: 0, results: [] });

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

    const cacheKey = `search:v3:${normalizedQ}:${page}:${pageSize}`;
    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, cacheKey);
    if (maybeCached) return maybeCached;

    const now = nowMs();
    const offset = (page - 1) * pageSize;
    if (offset >= 3000) {
      return c.json({ ok: true, q: normalizedQ, page, pageSize, hasMore: false, total: 3000, results: [] });
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
      SELECT *, COUNT(*) OVER() AS total
      FROM scored
      WHERE score > 0
      ORDER BY score DESC, publish_at DESC, updated_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(now, pageSize + 1, offset);

    const rows = await bindings.db.query<Record<string, unknown> & { total?: number }>({
      text: queryText,
      values: params as any
    });

    const hasMore = rows.length > pageSize;
    const results = hasMore ? rows.slice(0, pageSize) : rows;
    const total = Number((results[0] as any)?.total ?? (rows[0] as any)?.total ?? 0) || 0;
    const safeResults = results.map((r) => {
      const { total: _total, ...rest } = r as any;
      return rest;
    });
    const response = c.json({ ok: true, q: normalizedQ, page, pageSize, hasMore, total, results: safeResults });
    await putCachedResponse(c.req.raw, response, bindings.db, cacheKey);
    return response;
  });

  app.get("/api/embed/gitee", async (c) => {
    const url = new URL(c.req.url);
    const repoRaw = String(url.searchParams.get("repo") ?? "").trim();
    if (!repoRaw) return c.json(jsonError("Missing repo", 400, "MISSING_REPO"), 400);

    const match = repoRaw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) return c.json(jsonError("Invalid repo", 400, "INVALID_REPO"), 400);
    const owner = match[1]!;
    const name = match[2]!;
    const repo = `${owner}/${name}`;

    const maybeCached = await getCachedResponse(c.req.raw, bindings.db, `embed:gitee:${repo}`);
    if (maybeCached) return maybeCached;

    const upstream = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const res = await fetchWithTimeout(
      upstream,
      { method: "GET", headers: { accept: "application/json", "user-agent": "bitlog" } },
      10_000
    );
    if (res.status === 404) return c.json(jsonError("Not found", 404, "NOT_FOUND"), 404);
    if (!res.ok) return c.json(jsonError("Upstream failed", 502, "UPSTREAM_FAILED"), 502);

    const data = (await res.json()) as any;
    const response = c.json({
      ok: true,
      repo: {
        full_name: String(data?.full_name ?? repo),
        html_url: String(data?.html_url ?? `https://gitee.com/${repo}`),
        description: data?.description ? String(data.description) : "",
        language: data?.language ? String(data.language) : "",
        stargazers_count: Number(data?.stargazers_count ?? 0),
        forks_count: Number(data?.forks_count ?? 0),
        owner: {
          login: data?.owner?.login ? String(data.owner.login) : String(owner),
          avatar_url: data?.owner?.avatar_url ? String(data.owner.avatar_url) : ""
        }
      }
    });
    await putCachedResponse(c.req.raw, response, bindings.db, `embed:gitee:${repo}`);
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
            <title><![CDATA[${cdataText(p.title)}]]></title>
            <link>${link}</link>
            <guid isPermaLink="true">${guid}</guid>
            <pubDate>${pubDate}</pubDate>
            <description><![CDATA[${cdataText(p.summary || p.content_html)}]]></description>
          </item>
        `.trim();
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${cdataText(config.title ?? "bitlog")}]]></title>
    <link>${config.baseUrl}</link>
    <description><![CDATA[${cdataText(config.description ?? "")}]]></description>
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
    const rawKey = c.req.path.replace(/^\/assets\//, "");
    const key = normalizePublicAssetKey(rawKey);
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
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const limited = await rateLimitAdminRender(bindings.db, session.adminId);
    if (!limited.ok) return c.json(jsonError("Too Many Requests", 429), 429);

    const body = (await c.req.json().catch(() => null)) as { content_md?: string } | null;
    const contentMd = body?.content_md ?? "";
    if (typeof contentMd !== "string") return c.json(jsonError("Invalid content_md", 400), 400);
    if (contentMd.length > 500_000) return c.json(jsonError("Content too long", 400), 400);

    const config = await getSiteConfig(bindings.db);
    const rendered = await renderPostContent(contentMd, {
      embedAllowlist: config.embedAllowlistHosts,
      embed: embedFromShortcode,
      includeSourceMap: true
    });

    return c.json({ ok: true, rendered });
  });

  app.post("/api/admin/login", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const passwordPolicy = getEffectivePasswordPolicy(bindings.password);
    const initialized = await bindings.db.query<{ id: string }>(sql`SELECT id FROM admin_users LIMIT 1`);
    if (!initialized[0]?.id) {
      return c.json(jsonError("Admin not initialized", 503, "ADMIN_NOT_INITIALIZED"), 503);
    }
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
    }, passwordPolicy);
    if (!ok) return c.json(jsonError("Invalid credentials", 401), 401);

    // Opportunistically upgrade stored password parameters (pepper and/or iterations) after a successful login.
    const stored = decodeIterations(Number(user.password_iterations));
    const targetPeppered = !!passwordPolicy.pepper;
    const needsPepperUpgrade = targetPeppered && !stored.peppered;
    const needsIterationsUpgrade = stored.iterations < passwordPolicy.iterations;
    if (needsPepperUpgrade || needsIterationsUpgrade) {
      const upgraded = await hashPassword(password, passwordPolicy);
      await bindings.db.execute(
        sql`UPDATE admin_users
            SET password_hash = ${upgraded.hash},
                password_salt = ${upgraded.salt},
                password_iterations = ${upgraded.iterations},
                updated_at = ${nowMs()}
            WHERE id = ${user.id}`
      );
    }

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
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
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
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
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

  app.get("/api/admin/prefs", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const prefs = await getAdminPrefs(bindings.db, session.adminId);
    return c.json({ ok: true, prefs });
  });

  app.put("/api/admin/prefs", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = (await c.req.json().catch(() => null)) as
      | { shortcutsJson?: string | null; editorLayout?: "split" | "write" | "preview" }
      | null;
    if (!body) return c.json(jsonError("Invalid JSON", 400), 400);

    const shortcutsJson = body.shortcutsJson;
    if (shortcutsJson !== undefined && shortcutsJson !== null && typeof shortcutsJson !== "string") {
      return c.json(jsonError("Invalid shortcutsJson", 400), 400);
    }
    if (typeof shortcutsJson === "string" && shortcutsJson.trim()) {
      try {
        const parsed = JSON.parse(shortcutsJson);
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
      } catch {
        return c.json(jsonError("Invalid shortcutsJson", 400), 400);
      }
    }

    const editorLayout = body.editorLayout;
    if (editorLayout !== undefined && !["split", "write", "preview"].includes(String(editorLayout))) {
      return c.json(jsonError("Invalid editorLayout", 400), 400);
    }

    await setAdminPrefs(bindings.db, session.adminId, {
      ...(shortcutsJson !== undefined ? { shortcutsJson } : {}),
      ...(editorLayout !== undefined ? { editorLayout } : {})
    });
    return c.json({ ok: true });
  });

  app.put("/api/admin/password", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const passwordPolicy = getEffectivePasswordPolicy(bindings.password);
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
    }, passwordPolicy);
    if (!ok) return c.json(jsonError("Invalid credentials", 401), 401);

    const { hash, salt, iterations } = await hashPassword(newPassword, passwordPolicy);
    await bindings.db.execute(
      sql`UPDATE admin_users
          SET password_hash = ${hash},
              password_salt = ${salt},
              password_iterations = ${iterations},
              updated_at = ${nowMs()}
          WHERE id = ${session.adminId}`
    );
    await bindings.db.execute(sql`DELETE FROM admin_sessions WHERE admin_user_id = ${session.adminId}`);
    deleteCookie(c, COOKIE_SESSION_ID, { path: "/" });
    deleteCookie(c, COOKIE_REFRESH_TOKEN, { path: "/" });
    return c.json({ ok: true, relogin: true });
  });

  app.get("/api/admin/settings", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const url = new URL(c.req.url);
    const keysParam = String(url.searchParams.get("keys") ?? "").trim();
    const keys = keysParam
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (keys.length === 0) return c.json(jsonError("Missing keys", 400), 400);

    const map = await getSettingsValues(bindings.db, keys);
    const settings: Record<string, string | null> = {};
    for (const k of keys) settings[k] = map.get(k) ?? null;
    return c.json({ ok: true, settings });
  });

  app.put("/api/admin/settings", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json(jsonError("Invalid JSON", 400), 400);

    try {
      await setSettings(bindings.db, body);
      await bumpCacheVersion(bindings.db);
      return c.json({ ok: true });
    } catch (e) {
      const msg = (e as any)?.message ? String((e as any).message) : "";
      if (msg.startsWith("Invalid ")) return c.json(jsonError(msg, 400), 400);
      throw e;
    }
  });

  app.get("/api/admin/projects-config", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const config = await getProjectsConfigAdminView(bindings.db);
    return c.json({ ok: true, config });
  });

  app.put("/api/admin/projects-config", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = (await c.req.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") return c.json(jsonError("Invalid JSON", 400), 400);

    await patchProjectsConfig(bindings.db, body);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.get("/api/admin/tools", async (c) => {
    if (!isSameOriginRequest(c.req.raw)) return c.json(jsonError("Forbidden", 403), 403);
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const tools = await listToolsAdmin(bindings.db);
    return c.json({ ok: true, tools });
  });

  app.post("/api/admin/tools", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = (await c.req.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") return c.json(jsonError("Invalid JSON", 400), 400);
    try {
      const tool = await createTool(bindings.db, body);
      await bumpCacheVersion(bindings.db);
      return c.json({ ok: true, tool });
    } catch (e) {
      return c.json(jsonError((e as Error).message || "Bad Request", 400), 400);
    }
  });

  app.put("/api/admin/tools/reorder", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const body = (await c.req.json().catch(() => null)) as any;
    const ids = Array.isArray(body?.ids) ? body.ids : null;
    if (!ids) return c.json(jsonError("Invalid JSON", 400), 400);
    await reorderTools(bindings.db, ids);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.put("/api/admin/tools/:id", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") return c.json(jsonError("Invalid JSON", 400), 400);
    try {
      await updateTool(bindings.db, id, body);
      await bumpCacheVersion(bindings.db);
      return c.json({ ok: true });
    } catch (e) {
      const msg = (e as Error).message || "Bad Request";
      const status = msg === "Not found" ? 404 : 400;
      return c.json(jsonError(msg, status), status);
    }
  });

  app.delete("/api/admin/tools/:id", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const id = c.req.param("id");
    await deleteTool(bindings.db, id);
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
    const fetchLimit = pageSize + 1;

    const countRows = await bindings.db.query<{ c: number }>(
      sql`SELECT count(*) AS c
          FROM posts p
          WHERE (${status ?? null} IS NULL OR p.status = ${status ?? null})
            AND (${q || null} IS NULL OR lower(p.title) LIKE ${q ? `%${q}%` : null})`
    );
    const total = Number(countRows?.[0]?.c ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const offset = (safePage - 1) * pageSize;

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
          LIMIT ${fetchLimit} OFFSET ${offset}`
    );

    const hasMore = rows.length > pageSize;
    const posts = hasMore ? rows.slice(0, pageSize) : rows;
    return c.json({ ok: true, page: safePage, pageSize, hasMore, total, pageCount, posts });
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
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
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
    if (!body || typeof body !== "object") return c.json(jsonError("Invalid JSON", 400), 400);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const contentMd = typeof body.content_md === "string" ? body.content_md : "";
    if (!title || !contentMd) return c.json(jsonError("Missing fields", 400), 400);

    const status = body.status === undefined ? "draft" : parsePostStatus(body.status);
    if (!status) return c.json(jsonError("Invalid status", 400), 400);

    let publishAt: number | null = null;
    if (status !== "draft") {
      if ("publish_at" in body && body.publish_at !== null && body.publish_at !== undefined) {
        if (typeof body.publish_at !== "number") return c.json(jsonError("Invalid publish_at", 400), 400);
        const parsed = toFiniteIntMs(body.publish_at);
        if (!parsed) return c.json(jsonError("Invalid publish_at", 400), 400);
        publishAt = parsed;
      } else {
        publishAt = nowMs();
      }
    }

    const config = await getSiteConfig(bindings.db);
    const allowlist = config.embedAllowlistHosts;
    const rendered = await renderPostContent(contentMd, {
      embedAllowlist: allowlist,
      embed: embedFromShortcode
    });
    const autoSummaryEnabled = parseLooseBool(
      (await getSettingsValues(bindings.db, [POSTS_KEY_AUTO_SUMMARY])).get(POSTS_KEY_AUTO_SUMMARY)
    );

    const createdAt = nowMs();
    const postId = randomId();
    const slug = await slugifyUnique(bindings.db, title);

    const categoryId = body.category
      ? await upsertCategory(bindings.db, body.category)
      : null;
    const tagIds = await upsertTags(bindings.db, body.tags ?? []);

    let summary = String(body.summary ?? "").trim();
    if (!summary && autoSummaryEnabled) {
      summary = deriveSummaryFromText(rendered.text, 150);
    }

    await bindings.db.execute(
      sql`INSERT INTO posts
          (id, slug, title, summary, category_id, status, publish_at, created_at, updated_at, content_md, content_html, content_text)
          VALUES (${postId}, ${slug}, ${title}, ${summary}, ${categoryId}, ${status}, ${publishAt}, ${createdAt}, ${createdAt}, ${contentMd}, ${rendered.html}, ${rendered.text})`
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
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
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

    const nextStatus = body.status === undefined ? null : parsePostStatus(body.status);
    if (body.status !== undefined && !nextStatus) return c.json(jsonError("Invalid status", 400), 400);
    if ("publish_at" in body && body.publish_at !== undefined && body.publish_at !== null && typeof body.publish_at !== "number") {
      return c.json(jsonError("Invalid publish_at", 400), 400);
    }

    const existing = await bindings.db.query<{ id: string; slug: string }>(
      sql`SELECT id, slug FROM posts WHERE id = ${id} LIMIT 1`
    );
    if (!existing[0]) return c.json(jsonError("Not found", 404), 404);

    const config = await getSiteConfig(bindings.db);
    const allowlist = config.embedAllowlistHosts;
    const autoSummaryEnabled = parseLooseBool(
      (await getSettingsValues(bindings.db, [POSTS_KEY_AUTO_SUMMARY])).get(POSTS_KEY_AUTO_SUMMARY)
    );

    const fields: string[] = [];
    const values: unknown[] = [];
    let renderedTextForSummary: string | null = null;
    if (typeof body.title === "string") {
      fields.push("title = ?");
      values.push(body.title);
    }
    if (typeof body.content_md === "string") {
      const rendered = await renderPostContent(body.content_md, {
        embedAllowlist: allowlist,
        embed: embedFromShortcode
      });
      renderedTextForSummary = rendered.text;
      fields.push("content_md = ?", "content_html = ?", "content_text = ?");
      values.push(body.content_md, rendered.html, rendered.text);
    }
    if (typeof body.summary === "string") {
      let nextSummary = body.summary.trim();
      if (!nextSummary && autoSummaryEnabled) {
        if (!renderedTextForSummary) {
          const rows = await bindings.db.query<{ content_text: string }>(
            sql`SELECT content_text FROM posts WHERE id = ${id} LIMIT 1`
          );
          renderedTextForSummary = rows[0]?.content_text ?? "";
        }
        nextSummary = deriveSummaryFromText(renderedTextForSummary, 150);
      }
      fields.push("summary = ?");
      values.push(nextSummary);
    }
    if ("category" in (body ?? {})) {
      const categoryId = body.category
        ? await upsertCategory(bindings.db, body.category)
        : null;
      fields.push("category_id = ?");
      values.push(categoryId);
    }
    if (nextStatus) {
      fields.push("status = ?");
      values.push(nextStatus);
      let publishAt: number | null = null;
      if (nextStatus !== "draft") {
        if (typeof body.publish_at === "number") {
          const parsed = toFiniteIntMs(body.publish_at);
          if (!parsed) return c.json(jsonError("Invalid publish_at", 400), 400);
          publishAt = parsed;
        } else {
          publishAt = nowMs();
        }
      }
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

    await cleanupOrphanCategoriesAndTags(bindings.db);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.delete("/api/admin/posts/:id", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    const id = c.req.param("id");
    await bindings.db.execute(sql`DELETE FROM post_tags WHERE post_id = ${id}`);
    await bindings.db.execute(sql`DELETE FROM posts WHERE id = ${id}`);
    await cleanupOrphanCategoriesAndTags(bindings.db);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true });
  });

  app.post("/api/admin/assets/images", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);
    if (!bindings.assetsR2) return c.json(jsonError("上传已禁用", 400), 400);

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.startsWith("image/")) return c.json(jsonError("文件类型不支持", 400), 400);
    if (contentType === "image/svg+xml") return c.json(jsonError("SVG 已禁用", 400), 400);

    const body = await c.req.arrayBuffer();
    if (body.byteLength > 10 * 1024 * 1024) return c.json(jsonError("文件过大", 400), 400);

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

  app.post("/api/admin/import/posts", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const contentType = (c.req.header("content-type") ?? "").toLowerCase();
    if (!contentType.includes("zip")) return c.json(jsonError("文件类型不支持", 400), 400);

    const buf = await c.req.arrayBuffer();
    if (buf.byteLength > 30 * 1024 * 1024) return c.json(jsonError("文件过大", 400), 400);

    let result: any;
    try {
      result = await importPostsFromZip(bindings.db, new Uint8Array(buf));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ZIP 文件无效";
      return c.json(jsonError(msg || "ZIP 文件无效", 400), 400);
    }
    await cleanupOrphanCategoriesAndTags(bindings.db);
    await bumpCacheVersion(bindings.db);
    return c.json({ ok: true, result });
  });

  app.post("/api/admin/import/posts/batch", async (c) => {
    if (!isSameOriginRequest(c.req.raw, { requireOrigin: true, requireSameSite: true })) {
      return c.json(jsonError("Forbidden", 403), 403);
    }
    const session = await requireAdmin(bindings, c.req.raw);
    if (!session) return c.json(jsonError("Unauthorized", 401), 401);

    const body = await c.req.json().catch(() => null) as
      | {
          items?: unknown;
          final?: unknown;
        }
      | null;
    if (!body || typeof body !== "object") return c.json(jsonError("JSON 无效", 400), 400);
    if (!Array.isArray(body.items)) return c.json(jsonError("缺少 items", 400), 400);
    if (body.items.length < 1) return c.json(jsonError("items 为空", 400), 400);
    if (body.items.length > 5) return c.json(jsonError("items 过多", 400), 400);

    let result: any;
    try {
      result = await importPostsFromItems(bindings.db, body.items as any);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "导入失败";
      return c.json(jsonError(msg || "导入失败", 400), 400);
    }

    const isFinal = String(body.final ?? "").trim().toLowerCase() === "1" || String(body.final ?? "").trim().toLowerCase() === "true";
    if (isFinal) {
      await cleanupOrphanCategoriesAndTags(bindings.db);
      await bumpCacheVersion(bindings.db);
    } else if (result?.imported) {
      await bumpCacheVersion(bindings.db);
    }
    return c.json({ ok: true, result });
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

async function cleanupOrphanCategoriesAndTags(db: Db): Promise<void> {
  await db.execute(
    sql`DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM post_tags pt WHERE pt.tag_id = tags.id)`
  );
  await db.execute(
    sql`DELETE FROM categories WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.category_id = categories.id)`
  );
}
