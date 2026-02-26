import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";

export interface SiteConfig {
  title: string | null;
  description: string | null;
  baseUrl: string | null;
  timezone: string | null;
  embedAllowlistHosts: Set<string>;
  cacheTtlSeconds: number;
  cacheVersion: number;
  webStyle: UiStyle;
  adminStyle: UiStyle;
  commandMenuLayout: CommandMenuLayout;
  commandMenuConfirmMode: CommandMenuConfirmMode;
  commandMenuMobileSync: boolean;
  shortcutsJson: string | null;
  webNav: WebNavItem[];
  footerCopyrightUrl: string | null;
  footerIcpText: string | null;
  footerIcpLink: string | null;
}

export type UiStyle = "current" | "classic" | "glass" | "brutal" | "terminal";
export type CommandMenuLayout = "arc" | "grid" | "dial" | "cmd";
export type CommandMenuConfirmMode = "enter" | "release";

export type WebNavItem = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  external?: boolean;
};

const KEY_TITLE = "site.title";
const KEY_DESCRIPTION = "site.description";
const KEY_BASE_URL = "site.base_url";
const KEY_TIMEZONE = "site.timezone";
const KEY_EMBED_ALLOWLIST = "site.embed_allowlist";
const KEY_CACHE_TTL = "site.cache_public_ttl_seconds";
const KEY_CACHE_VERSION = "site.cache_version";
const KEY_UI_WEB_STYLE = "ui.web_style";
const KEY_UI_ADMIN_STYLE = "ui.admin_style";
const KEY_UI_COMMAND_MENU_LAYOUT = "ui.command_menu_layout";
const KEY_UI_COMMAND_MENU_CONFIRM_MODE = "ui.command_menu_confirm_mode";
const KEY_UI_COMMAND_MENU_MOBILE_SYNC = "ui.command_menu_mobile_sync";
const KEY_UI_WEB_NAV = "ui.web_nav_json";
const KEY_SHORTCUTS = "site.shortcuts_json";
const KEY_FOOTER_COPYRIGHT_URL = "site.footer_copyright_url";
const KEY_FOOTER_ICP_TEXT = "site.footer_icp_text";
const KEY_FOOTER_ICP_LINK = "site.footer_icp_link";

const SITE_CONFIG_CACHE_MS = 5_000;
let siteConfigCache: { value: SiteConfig; expiresAt: number } | null = null;

function cloneSiteConfig(cfg: SiteConfig): SiteConfig {
  return {
    ...cfg,
    embedAllowlistHosts: new Set(cfg.embedAllowlistHosts),
    webNav: (cfg.webNav ?? []).map((x) => ({ ...x }))
  };
}

function parseUiStyle(input: string | null | undefined): UiStyle | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (s === "current") return "current";
  if (s === "classic") return "classic";
  if (s === "glass") return "glass";
  if (s === "brutal") return "brutal";
  if (s === "terminal") return "terminal";
  return null;
}

function parseCommandMenuLayout(input: string | null | undefined): CommandMenuLayout | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (s === "arc") return "arc";
  if (s === "grid") return "grid";
  if (s === "dial") return "dial";
  if (s === "cmd") return "cmd";
  return null;
}

function parseCommandMenuConfirmMode(input: string | null | undefined): CommandMenuConfirmMode | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (s === "enter") return "enter";
  if (s === "release") return "release";
  return null;
}

function parseLooseBool(input: string | null | undefined): boolean {
  const s = String(input ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function normalizeWebNavHref(raw: string): { href: string; external: boolean } | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/")) {
    if (s.startsWith("//")) return null;
    return { href: s, external: false };
  }
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return { href: u.toString(), external: true };
    return null;
  } catch {
    return null;
  }
}

function defaultWebNav(): WebNavItem[] {
  return [
    { id: "home", label: "首页", href: "/", enabled: true },
    { id: "articles", label: "文章", href: "/articles", enabled: true },
    { id: "hot", label: "今日热点", href: "/hot", enabled: true },
    { id: "projects", label: "项目", href: "/projects", enabled: true },
    { id: "tools", label: "工具中心", href: "/tools", enabled: true },
    { id: "about", label: "关于我", href: "/about", enabled: true }
  ];
}

function parseWebNav(input: string | null | undefined): WebNavItem[] {
  const raw = String(input ?? "").trim();
  if (!raw) return defaultWebNav();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultWebNav();
  }
  if (!Array.isArray(parsed)) return defaultWebNav();

  const out: WebNavItem[] = [];
  const seen = new Set<string>();
  for (const it of parsed) {
    if (!it || typeof it !== "object") continue;
    const obj = it as any;
    const id = String(obj.id ?? "").trim();
    if (!id) continue;
    if (id.length > 80) continue;
    if (seen.has(id)) continue;

    const label = String(obj.label ?? "").trim();
    if (!label) continue;
    const normalized = normalizeWebNavHref(String(obj.href ?? ""));
    if (!normalized) continue;

    const enabled = obj.enabled === false ? false : true;
    const external = obj.external === true ? true : normalized.external;

    out.push({ id, label, href: normalized.href, enabled, external });
    seen.add(id);
    if (out.length >= 24) break;
  }

  return out.length ? out : defaultWebNav();
}

export async function getSiteConfig(db: Db): Promise<SiteConfig> {
  const now = Date.now();
  if (siteConfigCache && now < siteConfigCache.expiresAt) {
    return cloneSiteConfig(siteConfigCache.value);
  }

  const rows = await db.query<{ key: string; value: string }>(
    sql`SELECT key, value FROM settings WHERE key IN (${KEY_TITLE}, ${KEY_DESCRIPTION}, ${KEY_BASE_URL}, ${KEY_TIMEZONE}, ${KEY_EMBED_ALLOWLIST}, ${KEY_CACHE_TTL}, ${KEY_CACHE_VERSION}, ${KEY_UI_WEB_STYLE}, ${KEY_UI_ADMIN_STYLE}, ${KEY_UI_COMMAND_MENU_LAYOUT}, ${KEY_UI_COMMAND_MENU_CONFIRM_MODE}, ${KEY_UI_COMMAND_MENU_MOBILE_SYNC}, ${KEY_UI_WEB_NAV}, ${KEY_SHORTCUTS}, ${KEY_FOOTER_COPYRIGHT_URL}, ${KEY_FOOTER_ICP_TEXT}, ${KEY_FOOTER_ICP_LINK})`
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const baseUrl = normalizeBaseUrl(map.get(KEY_BASE_URL) ?? null);
  const ttl = parseInt(map.get(KEY_CACHE_TTL) ?? "60", 10);
  const cacheTtlSeconds = Number.isFinite(ttl) && ttl > 0 && ttl <= 3600 ? ttl : 60;

  const version = parseInt(map.get(KEY_CACHE_VERSION) ?? "1", 10);
  const cacheVersion = Number.isFinite(version) && version > 0 ? version : 1;

  const embedAllowlistHosts = parseEmbedAllowlist(map.get(KEY_EMBED_ALLOWLIST) ?? null);

  const webStyle = parseUiStyle(map.get(KEY_UI_WEB_STYLE) ?? null) ?? "current";
  const adminStyle = parseUiStyle(map.get(KEY_UI_ADMIN_STYLE) ?? null) ?? "current";
  const commandMenuLayout = parseCommandMenuLayout(map.get(KEY_UI_COMMAND_MENU_LAYOUT) ?? null) ?? "arc";
  const commandMenuConfirmMode = parseCommandMenuConfirmMode(map.get(KEY_UI_COMMAND_MENU_CONFIRM_MODE) ?? null) ?? "enter";
  const commandMenuMobileSync = parseLooseBool(map.get(KEY_UI_COMMAND_MENU_MOBILE_SYNC) ?? null);

  const timezone = map.get(KEY_TIMEZONE) ?? null;
  const title = map.get(KEY_TITLE) ?? null;
  const description = map.get(KEY_DESCRIPTION) ?? null;
  const shortcutsJson = map.get(KEY_SHORTCUTS) ?? null;
  const webNav = parseWebNav(map.get(KEY_UI_WEB_NAV) ?? null);
  const footerCopyrightUrl = map.get(KEY_FOOTER_COPYRIGHT_URL) ?? null;
  const footerIcpText = map.get(KEY_FOOTER_ICP_TEXT) ?? null;
  const footerIcpLink = map.get(KEY_FOOTER_ICP_LINK) ?? null;

  const cfg: SiteConfig = {
    title,
    description,
    baseUrl,
    timezone,
    embedAllowlistHosts,
    cacheTtlSeconds,
    cacheVersion,
    webStyle,
    adminStyle,
    commandMenuLayout,
    commandMenuConfirmMode,
    commandMenuMobileSync,
    shortcutsJson,
    webNav,
    footerCopyrightUrl,
    footerIcpText,
    footerIcpLink
  };

  siteConfigCache = { value: cfg, expiresAt: now + SITE_CONFIG_CACHE_MS };
  return cloneSiteConfig(cfg);
}

export async function setSettings(db: Db, patch: Record<string, unknown>): Promise<void> {
  siteConfigCache = null;
  const now = Date.now();
  for (const [key, raw] of Object.entries(patch)) {
    const value = normalizeSettingValue(key, raw);
    await db.execute(
      sql`INSERT INTO settings (key, value, updated_at)
          VALUES (${key}, ${value}, ${now})
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
  }
}

export async function bumpCacheVersion(db: Db): Promise<void> {
  siteConfigCache = null;
  const now = Date.now();
  const rows = await db.query<{ value: string }>(
    sql`SELECT value FROM settings WHERE key = ${KEY_CACHE_VERSION} LIMIT 1`
  );
  const current = rows[0]?.value ? parseInt(rows[0].value, 10) : 1;
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 2;
  await db.execute(
    sql`INSERT INTO settings (key, value, updated_at)
        VALUES (${KEY_CACHE_VERSION}, ${String(next)}, ${now})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
}

function normalizeSettingValue(key: string, value: unknown): string {
  if (key === KEY_BASE_URL) {
    const normalized = normalizeBaseUrl(String(value ?? ""));
    if (!normalized) throw new Error("Invalid site.base_url (example: https://example.com)");
    return normalized;
  }
  if (key === KEY_TIMEZONE) {
    const tz = String(value ?? "").trim();
    if (!tz) throw new Error("Invalid site.timezone");
    // Validate via Intl try/catch.
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return tz;
  }
  if (key === KEY_EMBED_ALLOWLIST) {
    const hosts = parseEmbedAllowlist(
      typeof value === "string" ? value : JSON.stringify(value)
    );
    return JSON.stringify(Array.from(hosts.values()));
  }
  if (key === KEY_CACHE_TTL) {
    const ttl = Number(value);
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 3600) throw new Error("Invalid cache ttl");
    return String(Math.floor(ttl));
  }
  if (key === KEY_SHORTCUTS) {
    if (typeof value === "string") return value;
    return JSON.stringify(value ?? {});
  }
  if (key === KEY_UI_WEB_STYLE) {
    const style = parseUiStyle(typeof value === "string" ? value : String(value ?? ""));
    if (!style) throw new Error("Invalid ui.web_style (allowed: current/classic/glass/brutal/terminal)");
    return style;
  }
  if (key === KEY_UI_ADMIN_STYLE) {
    const style = parseUiStyle(typeof value === "string" ? value : String(value ?? ""));
    if (!style) throw new Error("Invalid ui.admin_style (allowed: current/classic/glass/brutal/terminal)");
    return style;
  }
  if (key === KEY_UI_COMMAND_MENU_LAYOUT) {
    const layout = parseCommandMenuLayout(typeof value === "string" ? value : String(value ?? ""));
    if (!layout) throw new Error("Invalid ui.command_menu_layout (allowed: arc/grid/dial/cmd)");
    return layout;
  }
  if (key === KEY_UI_COMMAND_MENU_CONFIRM_MODE) {
    const mode = parseCommandMenuConfirmMode(typeof value === "string" ? value : String(value ?? ""));
    if (!mode) throw new Error("Invalid ui.command_menu_confirm_mode (allowed: enter/release)");
    return mode;
  }
  if (key === KEY_UI_COMMAND_MENU_MOBILE_SYNC) {
    if (typeof value === "boolean") return value ? "1" : "0";
    return parseLooseBool(typeof value === "string" ? value : String(value ?? "")) ? "1" : "0";
  }
  if (key === KEY_UI_WEB_NAV) {
    const nav = parseWebNav(typeof value === "string" ? value : JSON.stringify(value));
    return JSON.stringify(nav);
  }

  if (typeof value === "string") return value;
  return JSON.stringify(value ?? null);
}

function normalizeBaseUrl(input: string | null): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  // Accept "example.com" and normalize to "https://example.com".
  // For local dev, prefer http:// for localhost/127.0.0.1.
  let s = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    const lower = s.toLowerCase();
    const scheme =
      lower.startsWith("localhost") ||
      lower.startsWith("127.0.0.1") ||
      lower.startsWith("[::1]")
        ? "http://"
        : "https://";
    s = scheme + s;
  }

  try {
    const url = new URL(s);
    if (url.hash || url.search) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    const out = url.toString().replace(/\/$/, "");
    return out;
  } catch {
    return null;
  }
}

function parseEmbedAllowlist(jsonText: string | null): Set<string> {
  if (!jsonText) {
    return new Set([
      "github.com",
      "www.youtube.com",
      "www.youtube-nocookie.com",
      "player.bilibili.com"
    ]);
  }
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return new Set();
    const hosts = parsed
      .map((h) => String(h).trim().toLowerCase())
      .filter(Boolean)
      .map((h) => h.replace(/^https?:\/\//, "").split("/")[0]!)
      .filter((h) => h && !h.includes(":") && !h.includes("?") && !h.includes("#"));
    return new Set(hosts);
  } catch {
    return new Set();
  }
}
