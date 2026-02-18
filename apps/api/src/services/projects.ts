import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";
import { setSettings } from "./settings.js";

export type ProjectsPlatform = "github" | "gitee";

export type ProjectsConfig = {
  githubEnabled: boolean;
  githubUsername: string | null;
  githubToken: string | null;
  giteeEnabled: boolean;
  giteeUsername: string | null;
  giteeToken: string | null;
  includeForks: boolean;
  maxItemsPerPlatform: number;
};

export type ProjectsConfigAdminView = {
  github: { enabled: boolean; username: string | null; tokenSet: boolean };
  gitee: { enabled: boolean; username: string | null; tokenSet: boolean };
  includeForks: boolean;
  maxItemsPerPlatform: number;
};

export type ProjectsConfigPatch = Partial<{
  github: Partial<{ enabled: boolean; username: string | null; token: string; clearToken: boolean }>;
  gitee: Partial<{ enabled: boolean; username: string | null; token: string; clearToken: boolean }>;
  includeForks: boolean;
  maxItemsPerPlatform: number;
}>;

const KEY_GH_ENABLED = "projects.github_enabled";
const KEY_GH_USERNAME = "projects.github_username";
const KEY_GH_TOKEN = "projects.github_token";
const KEY_GT_ENABLED = "projects.gitee_enabled";
const KEY_GT_USERNAME = "projects.gitee_username";
const KEY_GT_TOKEN = "projects.gitee_token";
const KEY_INCLUDE_FORKS = "projects.include_forks";
const KEY_MAX_ITEMS = "projects.max_items_per_platform";

export async function getProjectsConfig(db: Db): Promise<ProjectsConfig> {
  const rows = await db.query<{ key: string; value: string }>(
    sql`SELECT key, value FROM settings WHERE key IN (
      ${KEY_GH_ENABLED},
      ${KEY_GH_USERNAME},
      ${KEY_GH_TOKEN},
      ${KEY_GT_ENABLED},
      ${KEY_GT_USERNAME},
      ${KEY_GT_TOKEN},
      ${KEY_INCLUDE_FORKS},
      ${KEY_MAX_ITEMS}
    )`
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const githubEnabled = parseBool(map.get(KEY_GH_ENABLED), true);
  const githubUsername = normalizeUsername(map.get(KEY_GH_USERNAME) ?? null);
  const githubToken = normalizeToken(map.get(KEY_GH_TOKEN) ?? null);

  const giteeEnabled = parseBool(map.get(KEY_GT_ENABLED), true);
  const giteeUsername = normalizeUsername(map.get(KEY_GT_USERNAME) ?? null);
  const giteeToken = normalizeToken(map.get(KEY_GT_TOKEN) ?? null);

  const includeForks = parseBool(map.get(KEY_INCLUDE_FORKS), false);
  const maxItemsPerPlatform = clampInt(parseInt(map.get(KEY_MAX_ITEMS) ?? "24", 10), 1, 100, 24);

  return {
    githubEnabled,
    githubUsername,
    githubToken,
    giteeEnabled,
    giteeUsername,
    giteeToken,
    includeForks,
    maxItemsPerPlatform
  };
}

export async function getProjectsConfigAdminView(db: Db): Promise<ProjectsConfigAdminView> {
  const cfg = await getProjectsConfig(db);
  return {
    github: { enabled: cfg.githubEnabled, username: cfg.githubUsername, tokenSet: !!cfg.githubToken },
    gitee: { enabled: cfg.giteeEnabled, username: cfg.giteeUsername, tokenSet: !!cfg.giteeToken },
    includeForks: cfg.includeForks,
    maxItemsPerPlatform: cfg.maxItemsPerPlatform
  };
}

export async function patchProjectsConfig(db: Db, patch: ProjectsConfigPatch): Promise<void> {
  const out: Record<string, unknown> = {};

  if (patch.github) {
    if ("enabled" in patch.github) out[KEY_GH_ENABLED] = !!patch.github.enabled;
    if ("username" in patch.github) out[KEY_GH_USERNAME] = normalizeUsername(patch.github.username ?? null) ?? "";
    if (patch.github.clearToken) out[KEY_GH_TOKEN] = "";
    if (typeof patch.github.token === "string" && patch.github.token.trim()) {
      out[KEY_GH_TOKEN] = patch.github.token.trim();
    }
  }

  if (patch.gitee) {
    if ("enabled" in patch.gitee) out[KEY_GT_ENABLED] = !!patch.gitee.enabled;
    if ("username" in patch.gitee) out[KEY_GT_USERNAME] = normalizeUsername(patch.gitee.username ?? null) ?? "";
    if (patch.gitee.clearToken) out[KEY_GT_TOKEN] = "";
    if (typeof patch.gitee.token === "string" && patch.gitee.token.trim()) {
      out[KEY_GT_TOKEN] = patch.gitee.token.trim();
    }
  }

  if ("includeForks" in patch) out[KEY_INCLUDE_FORKS] = !!patch.includeForks;
  if ("maxItemsPerPlatform" in patch) {
    out[KEY_MAX_ITEMS] = clampInt(Number(patch.maxItemsPerPlatform), 1, 100, 24);
  }

  if (!Object.keys(out).length) return;
  await setSettings(db, out);
}

function parseBool(value: string | undefined | null, fallback: boolean): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  try {
    const v = JSON.parse(s);
    if (typeof v === "boolean") return v;
  } catch {
    // ignore
  }
  return fallback;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const i = Math.floor(value);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function normalizeUsername(value: string | null): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return s;
}

function normalizeToken(value: string | null): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return s;
}

