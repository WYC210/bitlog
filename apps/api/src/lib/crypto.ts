export function randomId(): string {
  // 16 bytes is enough for IDs; base64url keeps it compact.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return base64Url(bytes);
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

export async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return toHex(new Uint8Array(digest));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  // btoa is available in Workers.
  const base64 = btoa(binary);
  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
