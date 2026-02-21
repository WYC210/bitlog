import { sql } from "@bitlog/db/sql";
import type { Db } from "@bitlog/db";
import { randomId } from "./crypto.js";

export interface StoredPassword {
  hash: Uint8Array;
  salt: Uint8Array;
  iterations: number;
}

export interface StoredPasswordLike {
  hash: Uint8Array | ArrayBuffer | string;
  salt: Uint8Array | ArrayBuffer | string;
  iterations: number;
}

// Cloudflare Workers WebCrypto PBKDF2 has a hard limit: iterations must be <= 100000.
// If a larger value is requested, deriveBits throws NotSupportedError.
export const CF_PBKDF2_MAX_ITERATIONS = 100_000;

// Keep the default at the platform max for best security without breaking on Workers.
const DEFAULT_ITERATIONS = CF_PBKDF2_MAX_ITERATIONS;

export interface PasswordPolicy {
  pepper?: string;
  iterations?: number;
}

export async function hashPassword(
  password: string,
  policy?: PasswordPolicy
): Promise<StoredPassword> {
  const pepper = normalizePepper(policy?.pepper);
  const iterations = normalizeIterations(policy?.iterations ?? DEFAULT_ITERATIONS);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const input = pepper ? applyPepper(password, pepper) : password;
  const hash = await pbkdf2Sha256(input, salt, iterations);
  return { hash, salt, iterations: encodeIterations(iterations, !!pepper) };
}

export async function verifyPassword(
  password: string,
  stored: StoredPasswordLike,
  policy?: Pick<PasswordPolicy, "pepper">
): Promise<boolean> {
  const salt = await toBytes(stored.salt, "salt");
  const expected = await toBytes(stored.hash, "hash");

  const decoded = decodeIterations(Number(stored.iterations));
  if (decoded.iterations > CF_PBKDF2_MAX_ITERATIONS) {
    throw new Error(
      `PBKDF2 iterations above ${CF_PBKDF2_MAX_ITERATIONS} are not supported (stored ${decoded.iterations})`
    );
  }

  const pepper = normalizePepper(policy?.pepper);
  if (decoded.peppered && !pepper) {
    throw new Error("Password pepper is required but not configured (set PASSWORD_PEPPER)");
  }

  const input = decoded.peppered ? applyPepper(password, pepper!) : password;
  const actual = await pbkdf2Sha256(input, salt, decoded.iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

async function pbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function toBytes(input: unknown, label: string): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== "undefined" && input instanceof Blob) return new Uint8Array(await input.arrayBuffer());

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof input === "string") {
    const s = input.trim();
    const parsed = parseDbByteArrayString(s);
    if (parsed) return parsed;
    throw new TypeError(`Invalid ${label}: expected byte array string like "[1,2,3]"`);
  }
  if (Array.isArray(input)) {
    return byteArrayFromNumbers(input, label);
  }
  if (typeof input === "object" && input !== null) {
    const anyInput = input as any;
    // Node Buffer JSON shape: { type: "Buffer", data: number[] }
    if (Array.isArray(anyInput.data)) return byteArrayFromNumbers(anyInput.data, label);
    // Generic array-like: {0:..,1:..,length:n}
    if (typeof anyInput.length === "number" && anyInput.length >= 0) {
      const arr: number[] = [];
      const len = Math.min(10_000, Math.floor(anyInput.length));
      for (let i = 0; i < len; i++) arr.push(anyInput[i]);
      if (arr.length === len) return byteArrayFromNumbers(arr, label);
    }
  }

  const tag = Object.prototype.toString.call(input);
  throw new TypeError(`Invalid ${label}: unsupported type ${typeof input} ${tag}`);
}

function parseDbByteArrayString(s: string): Uint8Array | null {
  // Wrangler/D1 sometimes serializes BLOB columns as a string like:
  //   "[35, 114, 185, ...]"
  if (!s.startsWith("[") || !s.endsWith("]")) return null;
  const inner = s.slice(1, -1).trim();
  if (!inner) return new Uint8Array(0);

  const out: number[] = [];
  // Accept commas with optional spaces.
  for (const part of inner.split(",")) {
    const p = part.trim();
    if (!p) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out.push(n);
  }
  return new Uint8Array(out);
}

function byteArrayFromNumbers(input: unknown[], label: string): Uint8Array {
  const out: number[] = [];
  for (const v of input) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new TypeError(`Invalid ${label}: expected bytes 0..255`);
    }
    out.push(n);
  }
  return new Uint8Array(out);
}

export async function ensureDefaultAdmin(db: Db, policy?: PasswordPolicy): Promise<void> {
  const existing = await db.query<{ id: string }>(
    sql`SELECT id FROM admin_users LIMIT 1`
  );
  if (existing.length > 0) return;

  const id = randomId();
  const now = Date.now();
  const { hash, salt, iterations } = await hashPassword("123456", policy);
  await db.execute(
    sql`INSERT INTO admin_users
        (id, username, password_hash, password_salt, password_iterations, created_at, updated_at)
        VALUES (${id}, ${"admin"}, ${hash}, ${salt}, ${iterations}, ${now}, ${now})`
  );
}

export function decodeIterations(iterations: number): { iterations: number; peppered: boolean } {
  const n = Number(iterations);
  if (!Number.isFinite(n) || n === 0) return { iterations: DEFAULT_ITERATIONS, peppered: false };
  return { iterations: Math.abs(Math.trunc(n)), peppered: n < 0 };
}

function encodeIterations(iterations: number, peppered: boolean): number {
  const n = normalizeIterations(iterations);
  return peppered ? -n : n;
}

function normalizeIterations(iterations: number): number {
  const n = Number(iterations);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ITERATIONS;
  return Math.min(CF_PBKDF2_MAX_ITERATIONS, Math.floor(n));
}

function normalizePepper(pepper: unknown): string | null {
  const s = typeof pepper === "string" ? pepper.trim() : "";
  return s ? s : null;
}

function applyPepper(password: string, pepper: string): string {
  // Use a NUL separator to avoid ambiguous concatenations.
  return `${password}\u0000${pepper}`;
}
