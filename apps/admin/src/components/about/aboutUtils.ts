export function safeParseJson<T = any>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  const s = String(text ?? "").trim();
  if (!s) return { ok: true, value: null as any };
  try {
    return { ok: true, value: JSON.parse(s) as T };
  } catch {
    return { ok: false, error: "JSON 解析失败" };
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

export function trimOrUndef(input: unknown): string | undefined {
  const s = String(input ?? "").trim();
  return s ? s : undefined;
}

export function isValidExternalUrlOrPath(input: string | undefined): boolean {
  const s = String(input ?? "").trim();
  if (!s) return true;
  if (s.startsWith("/")) return true;
  return /^https?:\/\//i.test(s);
}

