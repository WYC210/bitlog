import type { Db } from "@bitlog/db";
import { sql } from "@bitlog/db/sql";
import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";
import { randomId, sha256Hex } from "../lib/crypto.js";

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export async function uploadImageToR2(
  bindings: { db: Db; assetsR2: R2Bucket },
  input: { bytes: Uint8Array; mime: string; createdBy: string }
): Promise<{
  id: string;
  url: string;
  storageKey: string;
  mime: string;
  sizeBytes: number;
  sha256Hex: string;
}> {
  const sha = await sha256Hex(input.bytes);
  const existing = await bindings.db.query<{
    id: string;
    storage_key: string;
    mime: string;
    size_bytes: number;
    sha256_hex: string;
  }>(sql`SELECT id, storage_key, mime, size_bytes, sha256_hex FROM assets WHERE sha256_hex = ${sha} LIMIT 1`);
  if (existing[0]) {
    const row = existing[0];
    return {
      id: row.id,
      url: `/assets/${row.storage_key}`,
      storageKey: row.storage_key,
      mime: row.mime,
      sizeBytes: Number(row.size_bytes),
      sha256Hex: row.sha256_hex
    };
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = extFromMime(input.mime);
  const storageKey = `images/${yyyy}/${mm}/${sha}.${ext}`;

  await bindings.assetsR2.put(storageKey, input.bytes, {
    httpMetadata: { contentType: input.mime, cacheControl: "public, max-age=31536000, immutable" }
  });

  const id = randomId();
  await bindings.db.execute(
    sql`INSERT INTO assets
        (id, kind, storage_provider, storage_key, mime, size_bytes, sha256_hex, width, height, created_at, created_by)
        VALUES (${id}, ${"image"}, ${"r2"}, ${storageKey}, ${input.mime}, ${input.bytes.byteLength}, ${sha}, ${null}, ${null}, ${Date.now()}, ${input.createdBy})`
  );

  return {
    id,
    url: `/assets/${storageKey}`,
    storageKey,
    mime: input.mime,
    sizeBytes: input.bytes.byteLength,
    sha256Hex: sha
  };
}

export async function getR2ObjectByKey(
  bucket: R2Bucket,
  key: string
): Promise<R2ObjectBody | null> {
  const obj = await bucket.get(key);
  return obj ?? null;
}

