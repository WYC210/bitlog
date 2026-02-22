import type { Route } from "../routes";
import type { AdminActionId, AdminContextKey } from "./actions";
import { ADMIN_ACTION_ALIASES, ADMIN_ACTIONS } from "./actions";

export type ShortcutConfig = {
  global?: Record<string, string>;
  contexts?: Record<string, Record<string, string>>;
};

export function isTypingTarget(target: EventTarget | null): boolean {
  const t = target as any;
  const tag = String(t?.tagName ?? "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!t?.isContentEditable;
}

export function matchChord(e: KeyboardEvent, combo: string | undefined): boolean {
  const s = String(combo ?? "").trim().toLowerCase();
  if (!s || s.includes(" ")) return false;
  const parts = s.split("+").map((x) => x.trim()).filter(Boolean);
  const key = String(e.key ?? "").toLowerCase();
  const wantCtrl = parts.includes("ctrl");
  const wantMeta = parts.includes("meta");
  const wantMod = parts.includes("cmd") || parts.includes("mod");
  const wantAlt = parts.includes("alt");
  const wantShift = parts.includes("shift");
  const wantKey = parts.find((p) => !["ctrl", "cmd", "mod", "meta", "alt", "shift"].includes(p));
  if (wantCtrl && !e.ctrlKey) return false;
  if (wantMeta && !e.metaKey) return false;
  if (wantMod && !(e.ctrlKey || e.metaKey)) return false;
  if (wantAlt && !e.altKey) return false;
  if (wantShift && !e.shiftKey) return false;
  if (wantKey && wantKey !== key) return false;
  return true;
}

export function parseSeq(spec: string | undefined): string[] | null {
  const s = String(spec ?? "").trim().toLowerCase();
  if (!s.includes(" ")) return null;
  const keys = s.split(/\s+/).map((x) => x.trim()).filter(Boolean);
  return keys.length ? keys : null;
}

export function parseShortcutsJson(text: string | null | undefined): ShortcutConfig {
  try {
    const v = text ? JSON.parse(text) : {};
    return v && typeof v === "object" ? (v as any) : {};
  } catch {
    return {};
  }
}

export function mergeShortcuts(a: ShortcutConfig, b: ShortcutConfig): ShortcutConfig {
  const out: ShortcutConfig = {};
  const ag = a?.global && typeof a.global === "object" ? a.global : {};
  const bg = b?.global && typeof b.global === "object" ? b.global : {};
  out.global = { ...ag, ...bg };
  const ac = a?.contexts && typeof a.contexts === "object" ? a.contexts : {};
  const bc = b?.contexts && typeof b.contexts === "object" ? b.contexts : {};
  const keys = new Set<string>([...Object.keys(ac), ...Object.keys(bc)]);
  const contexts: Record<string, Record<string, string>> = {};
  keys.forEach((k) => {
    const av = ac[k] && typeof ac[k] === "object" ? ac[k] : {};
    const bv = bc[k] && typeof bc[k] === "object" ? bc[k] : {};
    contexts[k] = { ...av, ...bv } as any;
  });
  out.contexts = contexts;
  return out;
}

export function getAdminContextKey(route: Route): AdminContextKey {
  if (route.page === "edit") return "admin.edit";
  if (route.page === "settings") return "admin.settings";
  if (route.page === "account") return "admin.account";
  return "admin.posts";
}

export function getEffectiveBindings(sc: ShortcutConfig, contextKey: AdminContextKey): Record<string, string> {
  const global = sc?.global && typeof sc.global === "object" ? sc.global : {};
  const contexts = sc?.contexts && typeof sc.contexts === "object" ? sc.contexts : {};
  const adminGlobal = contexts["admin.global"] && typeof contexts["admin.global"] === "object" ? contexts["admin.global"] : {};
  const page = contexts[contextKey] && typeof contexts[contextKey] === "object" ? contexts[contextKey] : {};
  return { ...global, ...adminGlobal, ...page } as any;
}

export function getActionBinding(
  effective: Record<string, string>,
  actionId: AdminActionId,
  fallback?: string
): string {
  const keys = ADMIN_ACTION_ALIASES[actionId] ?? [actionId];
  for (const k of keys) {
    const v = (effective as any)?.[k];
    if (v) return String(v);
  }
  const def = ADMIN_ACTIONS.find((a) => a.id === actionId);
  return fallback ?? def?.defaultBinding ?? "";
}

export class SeqBuffer {
  private keys: string[] = [];
  private timer: number | null = null;

  push(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = String(e.key ?? "").toLowerCase();
    if (!k || k.length !== 1) return;
    this.keys.push(k);
    if (this.keys.length > 6) this.keys.shift();
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.keys = [];
      this.timer = null;
    }, 900);
  }

  match(seq: string[] | null): boolean {
    if (!seq || seq.length === 0) return false;
    if (this.keys.length < seq.length) return false;
    const tail = this.keys.slice(this.keys.length - seq.length);
    for (let i = 0; i < seq.length; i++) {
      if (tail[i] !== seq[i]) return false;
    }
    return true;
  }
}

export function normalizeRecordedChord(e: KeyboardEvent): string | null {
  const k = String(e.key ?? "").toLowerCase();
  if (k === "escape") return null;
  if (!k || ["control", "shift", "alt", "meta"].includes(k)) return "";
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("mod");
  if (e.altKey) mods.push("alt");
  if (e.shiftKey) mods.push("shift");
  const key = k === " " ? "space" : k;
  return [...mods, key].join("+");
}

