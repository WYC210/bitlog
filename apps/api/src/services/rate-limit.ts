import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";

const SEARCH_LIMIT_PER_MINUTE = 60;
const ADMIN_LOGIN_LIMIT_PER_MINUTE = 20;
const PROXY_LIMIT_PER_MINUTE = 120;
const ADMIN_RENDER_LIMIT_PER_MINUTE = 600;

async function rateLimitFixedWindow(
  db: Db,
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = windowStart + 2 * windowMs;

  await db.execute(
    sql`INSERT INTO rate_limit_counters (key, window_start, count, expires_at)
        VALUES (${key}, ${windowStart}, 1, ${expiresAt})
        ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`
  );
  const rows = await db.query<{ count: number }>(
    sql`SELECT count FROM rate_limit_counters WHERE key = ${key} AND window_start = ${windowStart} LIMIT 1`
  );
  const count = Number(rows[0]?.count ?? 0);

  if (Math.random() < 0.01) {
    void db.execute(sql`DELETE FROM rate_limit_counters WHERE expires_at <= ${now}`);
  }

  if (count > limit) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}

export async function rateLimitSearch(
  db: Db,
  ip: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return rateLimitFixedWindow(db, `search:${ip}`, SEARCH_LIMIT_PER_MINUTE, 60_000);
}

export async function rateLimitAdminLogin(
  db: Db,
  ip: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return rateLimitFixedWindow(db, `admin_login:${ip}`, ADMIN_LOGIN_LIMIT_PER_MINUTE, 60_000);
}

export async function rateLimitProxy(
  db: Db,
  ip: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return rateLimitFixedWindow(db, `proxy:${ip}`, PROXY_LIMIT_PER_MINUTE, 60_000);
}

export async function rateLimitAdminRender(
  db: Db,
  adminId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = String(adminId ?? "").trim() || "unknown";
  return rateLimitFixedWindow(db, `admin_render:${key}`, ADMIN_RENDER_LIMIT_PER_MINUTE, 60_000);
}
