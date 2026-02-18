import type { Db } from "@bitlog/db";
import { join, raw, sql } from "@bitlog/db/sql";
import { randomId } from "../lib/crypto.js";

export type ToolGroup = "games" | "apis" | "utils" | "other";
export type ToolKind = "link" | "page";

export type ToolItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  groupKey: ToolGroup;
  kind: ToolKind;
  url: string | null;
  icon: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type ToolCreateInput = {
  slug: string;
  title: string;
  description?: string;
  groupKey?: ToolGroup;
  kind?: ToolKind;
  url?: string | null;
  icon?: string | null;
  enabled?: boolean;
};

export type ToolUpdateInput = Partial<{
  slug: string;
  title: string;
  description: string;
  groupKey: ToolGroup;
  kind: ToolKind;
  url: string | null;
  icon: string | null;
  enabled: boolean;
}>;

export async function listToolsAdmin(db: Db): Promise<ToolItem[]> {
  const rows = await db.query<DbToolRow>(
    sql`SELECT
          id,
          slug,
          title,
          description,
          group_key,
          kind,
          url,
          icon,
          enabled,
          sort_order,
          created_at,
          updated_at
        FROM tools
        ORDER BY sort_order ASC, updated_at DESC`
  );
  return rows.map(mapRow);
}

export async function listToolsPublic(db: Db, groupKey?: ToolGroup | null): Promise<ToolItem[]> {
  const rows = await db.query<DbToolRow>(
    sql`SELECT
          id,
          slug,
          title,
          description,
          group_key,
          kind,
          url,
          icon,
          enabled,
          sort_order,
          created_at,
          updated_at
        FROM tools
        WHERE enabled = 1
          AND (${groupKey ?? null} IS NULL OR group_key = ${groupKey ?? null})
        ORDER BY sort_order ASC, updated_at DESC`
  );
  return rows.map(mapRow);
}

export async function createTool(db: Db, input: ToolCreateInput): Promise<ToolItem> {
  const now = Date.now();
  const id = randomId();
  const slug = normalizeSlug(input.slug);
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("Invalid title");
  if (!slug) throw new Error("Invalid slug");

  const description = String(input.description ?? "").trim();
  const groupKey = normalizeGroup(input.groupKey);
  const kind = normalizeKind(input.kind);
  const url = normalizeUrl(input.url ?? null);
  const icon = normalizeIcon(input.icon ?? null);
  const enabled = input.enabled === false ? 0 : 1;

  const existing = await db.query<{ id: string }>(sql`SELECT id FROM tools WHERE slug = ${slug} LIMIT 1`);
  if (existing[0]?.id) throw new Error("Slug already exists");

  const max = await db.query<{ m: number }>(sql`SELECT COALESCE(MAX(sort_order), 0) AS m FROM tools`);
  const sortOrder = Number(max[0]?.m ?? 0) + 1;

  await db.execute(
    sql`INSERT INTO tools
          (id, slug, title, description, group_key, kind, url, icon, enabled, sort_order, created_at, updated_at)
        VALUES
          (${id}, ${slug}, ${title}, ${description}, ${groupKey}, ${kind}, ${url}, ${icon}, ${enabled}, ${sortOrder}, ${now}, ${now})`
  );

  return {
    id,
    slug,
    title,
    description,
    groupKey,
    kind,
    url,
    icon,
    enabled: enabled === 1,
    sortOrder,
    createdAt: now,
    updatedAt: now
  };
}

export async function updateTool(db: Db, id: string, patch: ToolUpdateInput): Promise<void> {
  const now = Date.now();
  const existing = await db.query<{ id: string; slug: string }>(sql`SELECT id, slug FROM tools WHERE id = ${id} LIMIT 1`);
  if (!existing[0]?.id) throw new Error("Not found");

  if (typeof patch.slug === "string") {
    const slug = normalizeSlug(patch.slug);
    if (!slug) throw new Error("Invalid slug");
    const dupe = await db.query<{ id: string }>(
      sql`SELECT id FROM tools WHERE slug = ${slug} AND id != ${id} LIMIT 1`
    );
    if (dupe[0]?.id) throw new Error("Slug already exists");
  }

  const parts = [];

  if (typeof patch.slug === "string") parts.push(sql`slug = ${normalizeSlug(patch.slug)}`);
  if (typeof patch.title === "string") {
    const t = String(patch.title).trim();
    if (!t) throw new Error("Invalid title");
    parts.push(sql`title = ${t}`);
  }
  if (typeof patch.description === "string") parts.push(sql`description = ${String(patch.description).trim()}`);
  if (typeof patch.groupKey === "string") parts.push(sql`group_key = ${normalizeGroup(patch.groupKey as ToolGroup)}`);
  if (typeof patch.kind === "string") parts.push(sql`kind = ${normalizeKind(patch.kind as ToolKind)}`);
  if ("url" in patch) parts.push(sql`url = ${normalizeUrl(patch.url ?? null)}`);
  if ("icon" in patch) parts.push(sql`icon = ${normalizeIcon(patch.icon ?? null)}`);
  if (typeof patch.enabled === "boolean") parts.push(sql`enabled = ${patch.enabled ? 1 : 0}`);

  if (!parts.length) return;
  parts.push(sql`updated_at = ${now}`);

  await db.execute(sql`UPDATE tools SET ${join(parts, raw(", "))} WHERE id = ${id}`);
}

export async function deleteTool(db: Db, id: string): Promise<void> {
  await db.execute(sql`DELETE FROM tools WHERE id = ${id}`);
}

export async function reorderTools(db: Db, ids: string[]): Promise<void> {
  const now = Date.now();
  const normalized = Array.from(new Set(ids.map((x) => String(x ?? "").trim()).filter(Boolean)));
  if (!normalized.length) return;

  for (let i = 0; i < normalized.length; i++) {
    const id = normalized[i]!;
    await db.execute(
      sql`UPDATE tools SET sort_order = ${i + 1}, updated_at = ${now} WHERE id = ${id}`
    );
  }
}

type DbToolRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  group_key: string;
  kind: string;
  url: string | null;
  icon: string | null;
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

function mapRow(row: DbToolRow): ToolItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description ?? ""),
    groupKey: normalizeGroup(row.group_key as ToolGroup),
    kind: normalizeKind(row.kind as ToolKind),
    url: row.url ? String(row.url) : null,
    icon: row.icon ? String(row.icon) : null,
    enabled: Number(row.enabled) === 1,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function normalizeSlug(value: string): string {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  if (!s) return "";
  if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(s) && !/^[a-z0-9]$/.test(s)) return "";
  return s.replaceAll(/-+/g, "-");
}

function normalizeGroup(value: ToolGroup | undefined | null): ToolGroup {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "games") return "games";
  if (s === "apis") return "apis";
  if (s === "other") return "other";
  return "utils";
}

function normalizeKind(value: ToolKind | undefined | null): ToolKind {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "page") return "page";
  return "link";
}

function normalizeUrl(value: string | null): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return s;
}

function normalizeIcon(value: string | null): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return s;
}
