import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";
import { randomId } from "./crypto.js";

function basicSlugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    // keep ascii letters/numbers + chinese + hyphen
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s;
}

export async function slugifyUnique(db: Db, title: string): Promise<string> {
  const base = basicSlugify(title);
  const fallback = `post-${randomId().slice(0, 8)}`;
  const baseSlug = base || fallback;

  const existing = await db.query<{ slug: string }>(
    sql`SELECT slug FROM posts WHERE slug = ${baseSlug} LIMIT 1`
  );
  if (existing.length === 0) return baseSlug;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`;
    const rows = await db.query<{ slug: string }>(
      sql`SELECT slug FROM posts WHERE slug = ${candidate} LIMIT 1`
    );
    if (rows.length === 0) return candidate;
  }

  // Extremely unlikely; fall back to a random slug.
  return fallback;
}

