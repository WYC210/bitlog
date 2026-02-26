import type { Db } from "@bitlog/db";
import { join, raw, sql } from "@bitlog/db/sql";
import { randomId, sha256Bytes, toHex } from "../lib/crypto.js";
import { XMLParser } from "fast-xml-parser";

export type HotSourceKind = "rss" | "rsshub";

export type HotSource = {
  id: string;
  slug: string;
  name: string;
  category: string;
  kind: HotSourceKind;
  routeOrUrl: string;
  icon: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type HotSourceCreateInput = {
  slug: string;
  name: string;
  category?: string;
  kind?: HotSourceKind;
  routeOrUrl: string;
  icon?: string | null;
  enabled?: boolean;
};

export type HotSourceUpdateInput = Partial<{
  slug: string;
  name: string;
  category: string;
  kind: HotSourceKind;
  routeOrUrl: string;
  icon: string | null;
  enabled: boolean;
}>;

export type HotItem = {
  id: string;
  title: string;
  url: string;
  published: string | null;
  description: string | null;
};

export type HotList = {
  source: string;
  sourceName: string;
  category: string;
  icon: string | null;
  updatedAt: number;
  items: HotItem[];
};

export type HotFetchFailure = { slug: string; name: string; message: string };

export type HotFetchProgress =
  | {
      type: "hotlist";
      list: HotList;
      completed: number;
      total: number;
      success: number;
      failed: number;
    }
  | {
      type: "failed";
      failure: HotFetchFailure;
      completed: number;
      total: number;
      success: number;
      failed: number;
    };

const KEY_RSSHUB_URL = "hot.rsshub_url";
const KEY_RSSHUB_FALLBACK_URLS = "hot.rsshub_fallback_urls";

function nowMs() {
  return Date.now();
}

function normalizeSlug(input: unknown): string | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;
  const cleaned = s
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^[-_]+|[-_]+$/g, "");
  if (!cleaned) return null;
  if (cleaned.length > 80) return null;
  return cleaned;
}

function normalizeKind(input: unknown): HotSourceKind {
  const s = String(input ?? "rsshub").trim().toLowerCase();
  return s === "rss" ? "rss" : "rsshub";
}

function normalizeCategory(input: unknown): string {
  const s = String(input ?? "").trim();
  return s || "其他";
}

function normalizeIcon(input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (s.length > 500) return null;
  return s;
}

function normalizeRouteOrUrl(kind: HotSourceKind, input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (kind === "rss") {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.toString();
    } catch {
      return null;
    }
  }
  // rsshub route
  if (!s.startsWith("/")) return null;
  if (s.startsWith("//")) return null;
  if (s.length > 500) return null;
  return s;
}

function toBool01(v: unknown): 0 | 1 {
  return v === false ? 0 : 1;
}

type DbHotSourceRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  kind: string;
  route_or_url: string;
  icon: string | null;
  enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

function mapRow(r: DbHotSourceRow): HotSource {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    category: String(r.category ?? ""),
    kind: normalizeKind(r.kind),
    routeOrUrl: String(r.route_or_url ?? ""),
    icon: r.icon ? String(r.icon) : null,
    enabled: Number(r.enabled) === 1,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0)
  };
}

export async function listHotSourcesAdmin(db: Db): Promise<HotSource[]> {
  const rows = await db.query<DbHotSourceRow>(
    sql`SELECT
          id,
          slug,
          name,
          category,
          kind,
          route_or_url,
          icon,
          enabled,
          sort_order,
          created_at,
          updated_at
        FROM hot_sources
        ORDER BY sort_order ASC, updated_at DESC`
  );
  return rows.map(mapRow);
}

export async function listHotSourcesPublic(db: Db): Promise<HotSource[]> {
  const rows = await db.query<DbHotSourceRow>(
    sql`SELECT
          id,
          slug,
          name,
          category,
          kind,
          route_or_url,
          icon,
          enabled,
          sort_order,
          created_at,
          updated_at
        FROM hot_sources
        WHERE enabled = 1
        ORDER BY sort_order ASC, updated_at DESC`
  );
  return rows.map(mapRow);
}

export async function createHotSource(db: Db, input: HotSourceCreateInput): Promise<HotSource> {
  const now = nowMs();
  const id = randomId();
  const slug = normalizeSlug(input.slug);
  if (!slug) throw new Error("Invalid slug");
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Invalid name");
  const category = normalizeCategory(input.category);
  const kind = normalizeKind(input.kind);
  const routeOrUrl = normalizeRouteOrUrl(kind, input.routeOrUrl);
  if (!routeOrUrl) throw new Error(kind === "rss" ? "Invalid RSS URL" : "Invalid RSSHub route");
  const icon = normalizeIcon(input.icon ?? null);
  const enabled = toBool01(input.enabled);

  const existing = await db.query<{ id: string }>(sql`SELECT id FROM hot_sources WHERE slug = ${slug} LIMIT 1`);
  if (existing[0]?.id) throw new Error("Slug already exists");

  const max = await db.query<{ m: number }>(sql`SELECT COALESCE(MAX(sort_order), 0) AS m FROM hot_sources`);
  const sortOrder = Number(max[0]?.m ?? 0) + 1;

  await db.execute(
    sql`INSERT INTO hot_sources
          (id, slug, name, category, kind, route_or_url, icon, enabled, sort_order, created_at, updated_at)
        VALUES
          (${id}, ${slug}, ${name}, ${category}, ${kind}, ${routeOrUrl}, ${icon}, ${enabled}, ${sortOrder}, ${now}, ${now})`
  );

  return {
    id,
    slug,
    name,
    category,
    kind,
    routeOrUrl,
    icon,
    enabled: enabled === 1,
    sortOrder,
    createdAt: now,
    updatedAt: now
  };
}

export async function updateHotSource(db: Db, id: string, patch: HotSourceUpdateInput): Promise<void> {
  const now = nowMs();
  const existing = await db.query<Pick<DbHotSourceRow, "id" | "kind">>(
    sql`SELECT id, kind FROM hot_sources WHERE id = ${id} LIMIT 1`
  );
  const row = existing[0];
  if (!row?.id) throw new Error("Not found");

  if (typeof patch.slug === "string") {
    const slug = normalizeSlug(patch.slug);
    if (!slug) throw new Error("Invalid slug");
    const dupe = await db.query<{ id: string }>(
      sql`SELECT id FROM hot_sources WHERE slug = ${slug} AND id != ${id} LIMIT 1`
    );
    if (dupe[0]?.id) throw new Error("Slug already exists");
  }

  const parts = [];
  const kind = typeof patch.kind === "string" ? normalizeKind(patch.kind) : normalizeKind(row.kind);

  if (typeof patch.slug === "string") parts.push(sql`slug = ${normalizeSlug(patch.slug)}`);
  if (typeof patch.name === "string") {
    const name = String(patch.name).trim();
    if (!name) throw new Error("Invalid name");
    parts.push(sql`name = ${name}`);
  }
  if (typeof patch.category === "string") parts.push(sql`category = ${normalizeCategory(patch.category)}`);
  if (typeof patch.kind === "string") parts.push(sql`kind = ${kind}`);
  if (typeof patch.routeOrUrl === "string") {
    const normalized = normalizeRouteOrUrl(kind, patch.routeOrUrl);
    if (!normalized) throw new Error(kind === "rss" ? "Invalid RSS URL" : "Invalid RSSHub route");
    parts.push(sql`route_or_url = ${normalized}`);
  }
  if ("icon" in patch) parts.push(sql`icon = ${normalizeIcon(patch.icon ?? null)}`);
  if (typeof patch.enabled === "boolean") parts.push(sql`enabled = ${patch.enabled ? 1 : 0}`);

  if (!parts.length) return;
  parts.push(sql`updated_at = ${now}`);

  await db.execute(sql`UPDATE hot_sources SET ${join(parts, raw(", "))} WHERE id = ${id}`);
}

export async function deleteHotSource(db: Db, id: string): Promise<void> {
  await db.execute(sql`DELETE FROM hot_sources WHERE id = ${id}`);
}

export async function reorderHotSources(db: Db, ids: string[]): Promise<void> {
  const now = nowMs();
  const normalized = Array.from(new Set(ids.map((x) => String(x ?? "").trim()).filter(Boolean)));
  if (!normalized.length) return;
  for (let i = 0; i < normalized.length; i++) {
    const id = normalized[i]!;
    await db.execute(sql`UPDATE hot_sources SET sort_order = ${i + 1}, updated_at = ${now} WHERE id = ${id}`);
  }
}

async function getSettingValue(db: Db, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string }>(sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`);
  const v = rows[0]?.value;
  return v ? String(v) : null;
}

function splitUrls(csv: string | null): string[] {
  return String(csv ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.replace(/\/+$/, ""))
    .slice(0, 5);
}

function stripHtml(s: string): string {
  return String(s ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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

function parseDateToIso(value: unknown): string | null {
  const raw = pickFirstString(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseTagValue: false,
  trimValues: true
});

function parseFeedItems(xmlText: string, maxItems: number): Array<{
  title: string;
  url: string;
  published: string | null;
  description: string | null;
}> {
  let parsed: any = null;
  try {
    parsed = xmlParser.parse(xmlText);
  } catch {
    return [];
  }

  // RSS 2.0: rss.channel.item
  const rssItems = parsed?.rss?.channel?.item;
  if (rssItems) {
    const arr = Array.isArray(rssItems) ? rssItems : [rssItems];
    return arr.slice(0, maxItems).map((it: any) => {
      const title = pickFirstString(it?.title) ?? "";
      const url = pickFirstString(it?.link) ?? "";
      const description = pickFirstString(it?.description) ?? pickFirstString(it?.["content:encoded"]);
      const published = parseDateToIso(it?.pubDate) ?? parseDateToIso(it?.published) ?? null;
      return { title: title.trim(), url: url.trim(), description: description ? stripHtml(description) : null, published };
    });
  }

  // Atom: feed.entry
  const atomEntries = parsed?.feed?.entry;
  if (atomEntries) {
    const arr = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return arr.slice(0, maxItems).map((it: any) => {
      const title = pickFirstString(it?.title) ?? "";
      let url = "";
      const link = it?.link;
      if (typeof link === "string") url = link;
      else if (Array.isArray(link)) {
        const alt = link.find((x) => String(x?.["@_rel"] ?? "").toLowerCase() === "alternate") ?? link[0];
        url = String(alt?.["@_href"] ?? "");
      } else if (link && typeof link === "object") {
        url = String(link?.["@_href"] ?? "");
      }
      const description = pickFirstString(it?.summary) ?? pickFirstString(it?.content);
      const published = parseDateToIso(it?.updated) ?? parseDateToIso(it?.published) ?? null;
      return { title: title.trim(), url: url.trim(), description: description ? stripHtml(description) : null, published };
    });
  }

  return [];
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

async function computeItemId(sourceSlug: string, url: string, title: string): Promise<string> {
  const input = `${sourceSlug}:${url}:${title}`.slice(0, 5000);
  const digest = await sha256Bytes(input);
  return toHex(digest).slice(0, 12);
}

async function prepareHotFetch(
  db: Db,
  opts?: { slugs?: string[]; category?: string | null; perSourceLimit?: number }
): Promise<{
  sourcesAll: HotSource[];
  sources: HotSource[];
  perSourceLimit: number;
  instances: string[];
}> {
  const perSourceLimit = Math.max(1, Math.min(50, Number(opts?.perSourceLimit ?? 10)));
  const sourcesAll = await listHotSourcesPublic(db);

  const wantSlugs = Array.isArray(opts?.slugs) && opts?.slugs.length
    ? new Set(opts!.slugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean))
    : null;
  const wantCategory = opts?.category ? String(opts.category).trim() : "";

  const sources = sourcesAll.filter((s) => {
    if (wantSlugs && !wantSlugs.has(s.slug)) return false;
    if (wantCategory && s.category !== wantCategory) return false;
    return true;
  });

  const rsshubUrl = (await getSettingValue(db, KEY_RSSHUB_URL)) ?? "https://rsshub.rssforever.com";
  const rsshubFallback = splitUrls(await getSettingValue(db, KEY_RSSHUB_FALLBACK_URLS));
  const instances = [rsshubUrl, ...rsshubFallback].map((x) => x.replace(/\/+$/, "")).filter(Boolean);

  return { sourcesAll, sources, perSourceLimit, instances };
}

async function fetchHotSource(
  source: HotSource,
  instances: string[],
  perSourceLimit: number
): Promise<{ list: HotList | null; failure: HotFetchFailure | null }> {
  try {
    const candidateUrls = resolveCandidateUrls(instances, source);
    if (!candidateUrls.length) throw new Error(source.kind === "rsshub" ? "RSSHub not configured" : "Invalid URL");

    const text = await fetchFirstOkText(candidateUrls);
    const rawItems = parseFeedItems(text, perSourceLimit);
    if (!rawItems.length) throw new Error("Empty feed");

    const items: HotItem[] = [];
    for (const it of rawItems) {
      if (!it.title || !it.url) continue;
      const id = await computeItemId(source.slug, it.url, it.title);
      items.push({
        id,
        title: it.title,
        url: it.url,
        published: it.published,
        description: it.description
      });
    }

    return {
      list: {
        source: source.slug,
        sourceName: source.name,
        category: source.category,
        icon: source.icon,
        updatedAt: nowMs(),
        items
      },
      failure: null
    };
  } catch (e) {
    const msg = (e as any)?.message ? String((e as any).message) : "Fetch failed";
    return { list: null, failure: { slug: source.slug, name: source.name, message: msg } };
  }
}

export async function fetchHotListsIncremental(
  db: Db,
  opts?: {
    slugs?: string[];
    category?: string | null;
    perSourceLimit?: number;
    concurrency?: number;
    onStart?: (info: { total: number }) => void | Promise<void>;
  },
  onProgress?: (event: HotFetchProgress) => void | Promise<void>
): Promise<{
  lists: HotList[];
  failed: HotFetchFailure[];
  total: number;
}> {
  const { sourcesAll, sources, perSourceLimit, instances } = await prepareHotFetch(db, opts);
  const total = sources.length;
  const failed: HotFetchFailure[] = [];
  const lists: HotList[] = [];
  const concurrency = Math.max(1, Math.min(8, Number(opts?.concurrency ?? 4)));
  const queue = sources.slice();

  let completed = 0;
  let successCount = 0;
  let failedCount = 0;

  if (opts?.onStart) {
    try {
      await opts.onStart({ total });
    } catch {
      // Ignore callback errors and continue.
    }
  }

  async function worker() {
    while (queue.length) {
      const source = queue.shift();
      if (!source) return;
      const { list, failure } = await fetchHotSource(source, instances, perSourceLimit);
      completed += 1;

      if (list) {
        successCount += 1;
        lists.push(list);
        if (onProgress) {
          try {
            await onProgress({
              type: "hotlist",
              list,
              completed,
              total,
              success: successCount,
              failed: failedCount
            });
          } catch {
            // Ignore callback errors and continue.
          }
        }
      } else if (failure) {
        failedCount += 1;
        failed.push(failure);
        if (onProgress) {
          try {
            await onProgress({
              type: "failed",
              failure,
              completed,
              total,
              success: successCount,
              failed: failedCount
            });
          } catch {
            // Ignore callback errors and continue.
          }
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, () => worker()));

  // Keep stable ordering based on configured sort order.
  const order = new Map(sourcesAll.map((s, i) => [s.slug, i]));
  lists.sort((a, b) => (order.get(a.source) ?? 0) - (order.get(b.source) ?? 0));
  return { lists, failed, total };
}

export async function fetchHotLists(db: Db, opts?: { slugs?: string[]; category?: string | null; perSourceLimit?: number }): Promise<{
  lists: HotList[];
  failed: HotFetchFailure[];
}> {
  const { lists, failed } = await fetchHotListsIncremental(db, opts);
  return { lists, failed };
}

function resolveCandidateUrls(instances: string[], source: HotSource): string[] {
  if (source.kind === "rss") return [source.routeOrUrl].filter(Boolean);
  const route = source.routeOrUrl;
  const out: string[] = [];
  for (const base of instances) {
    if (!base) continue;
    try {
      const u = new URL(base);
      u.pathname = route;
      u.search = "";
      u.hash = "";
      out.push(u.toString());
    } catch {
      // ignore
    }
  }
  return out;
}

async function fetchFirstOkText(urls: string[]): Promise<string> {
  let lastStatus = 0;
  let lastErr: string | null = null;
  for (const url of urls) {
    let res: Response | null = null;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            // Use a browser-like UA for better compatibility with some public RSSHub instances / CDNs.
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
          }
        },
        15_000
      );
    } catch (e) {
      lastErr = (e as any)?.message ? String((e as any).message) : "Upstream failed";
      continue;
    }

    lastStatus = res.status;
    if (!res.ok) continue;

    const text = await res.text();
    const trimmed = text ? text.trim() : "";
    if (!trimmed) continue;

    // Some public RSSHub instances may return a 200 with a plain-text error body.
    // Avoid treating that as a valid feed so we can try fallbacks.
    const head = trimmed.slice(0, 800).toLowerCase();
    const looksLikeFeed = head.includes("<rss") || head.includes("<feed") || head.startsWith("<?xml");
    if (!looksLikeFeed) {
      lastErr = trimmed.slice(0, 120);
      continue;
    }

    return trimmed;
  }
  if (lastStatus) throw new Error(`Upstream HTTP ${lastStatus}`);
  if (lastErr) throw new Error(lastErr);
  throw new Error("Upstream failed");
}
