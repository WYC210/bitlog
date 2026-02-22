import type { Db } from "@bitlog/db";
import { getSiteConfig } from "./settings.js";

function hasCachesDefault(): boolean {
  return typeof (globalThis as any).caches !== "undefined" && !!(caches as any).default;
}

export async function getCachedResponse(
  request: Request,
  db: Db,
  key: string
): Promise<Response | null> {
  if (request.method !== "GET") return null;
  if (!hasCachesDefault()) return null;

  const cfg = await getSiteConfig(db);
  const url = new URL(request.url);
  url.searchParams.set("__cv", String(cfg.cacheVersion));
  url.searchParams.set("__k", key);
  // Normalize cache key to avoid fragmentation by headers (Accept-Language/Cookie/etc.).
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = (caches as any).default as Cache;
  const hit = await cache.match(cacheKey);
  return hit ?? null;
}

export async function putCachedResponse(
  request: Request,
  response: Response,
  db: Db,
  key: string
): Promise<void> {
  if (request.method !== "GET") return;
  if (!hasCachesDefault()) return;
  if (!response.ok) return;

  const cfg = await getSiteConfig(db);
  const url = new URL(request.url);
  url.searchParams.set("__cv", String(cfg.cacheVersion));
  url.searchParams.set("__k", key);
  // Normalize cache key to avoid fragmentation by headers (Accept-Language/Cookie/etc.).
  const cacheKey = new Request(url.toString(), { method: "GET" });

  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${cfg.cacheTtlSeconds}`);
  const toCache = new Response(response.clone().body, {
    status: response.status,
    headers
  });
  const cache = (caches as any).default as Cache;
  await cache.put(cacheKey, toCache);
}
