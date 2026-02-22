import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AdminActionId, AdminContextKey } from "../shortcuts/actions";
import { ADMIN_ACTIONS } from "../shortcuts/actions";
import { normalizeRecordedChord } from "../shortcuts/shortcuts";
import { SelectBox } from "./SelectBox";

type WebContextKey =
  | "web.global"
  | "web.home"
  | "web.articles"
  | "web.post"
  | "web.projects"
  | "web.tools"
  | "web.about";

type WebActionId =
  | "openCommandPalette"
  | "focusSearch"
  | "toggleLightDark"
  | "goHome"
  | "goArticles"
  | "goProjects"
  | "goTools"
  | "goAbout"
  | "postPrev"
  | "postNext"
  | "back"
  | "forward";

type ActionId = AdminActionId | WebActionId | string;
type ContextKey = AdminContextKey | WebContextKey | string;

type ShortcutConfig = {
  global?: Record<string, string>;
  contexts?: Record<string, Record<string, string>>;
};

const WEB_ACTIONS: Array<{
  id: WebActionId;
  label: string;
  scopes: WebContextKey[];
  defaultBinding?: string;
}> = [
  { id: "openCommandPalette", label: "打开命令面板", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "?" },
  { id: "focusSearch", label: "聚焦搜索", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "/" },
  { id: "toggleLightDark", label: "切换 light/dark", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "shift+d" },
  { id: "goHome", label: "跳转首页", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g h" },
  { id: "goArticles", label: "跳转文章列表", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g a" },
  { id: "goProjects", label: "跳转项目页", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g p" },
  { id: "goTools", label: "跳转工具中心", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g t" },
  { id: "goAbout", label: "跳转关于我", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g o" },
  { id: "postPrev", label: "上一篇（文章页）", scopes: ["web.post"], defaultBinding: "k" },
  { id: "postNext", label: "下一篇（文章页）", scopes: ["web.post"], defaultBinding: "j" },
  { id: "back", label: "后退", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g b" },
  { id: "forward", label: "前进", scopes: ["web.global", "web.home", "web.articles", "web.post", "web.projects", "web.tools", "web.about"], defaultBinding: "g n" }
];

const ALL_CONTEXTS: Array<{ key: ContextKey; label: string }> = [
  { key: "global", label: "全局（global）" },
  { key: "web.global", label: "Web：全局（web.global）" },
  { key: "web.home", label: "Web：首页（web.home）" },
  { key: "web.articles", label: "Web：文章列表（web.articles）" },
  { key: "web.post", label: "Web：文章页（web.post）" },
  { key: "web.projects", label: "Web：项目页（web.projects）" },
  { key: "web.tools", label: "Web：工具页（web.tools）" },
  { key: "web.about", label: "Web：关于页（web.about）" },
  { key: "admin.global", label: "Admin：全局（admin.global）" },
  { key: "admin.posts", label: "Admin：文章列表（admin.posts）" },
  { key: "admin.edit", label: "Admin：编辑器（admin.edit）" },
  { key: "admin.settings", label: "Admin：设置（admin.settings）" },
  { key: "admin.account", label: "Admin：账号（admin.account）" }
];

function parseJson(text: string): { ok: true; value: ShortcutConfig } | { ok: false; error: string } {
  const s = String(text ?? "").trim();
  if (!s) return { ok: true, value: {} };
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object") return { ok: false, error: "JSON 必须是对象" };
    return { ok: true, value: v as any };
  } catch {
    return { ok: false, error: "JSON 解析失败" };
  }
}

function formatJson(value: ShortcutConfig): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function getScopeMap(sc: ShortcutConfig, contextKey: ContextKey): Record<string, string> {
  if (contextKey === "global") {
    if (!sc.global || typeof sc.global !== "object") sc.global = {};
    return sc.global;
  }
  if (!sc.contexts || typeof sc.contexts !== "object") sc.contexts = {};
  if (!sc.contexts[String(contextKey)] || typeof sc.contexts[String(contextKey)] !== "object") sc.contexts[String(contextKey)] = {};
  return sc.contexts[String(contextKey)];
}

function reservedHint(spec: string): string {
  const s = String(spec ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s === "mod+n" || s === "ctrl+n") return "提示：可能会被浏览器用于“新窗口”。建议改成序列键（如 c n）。";
  if (s === "mod+r" || s === "ctrl+r") return "提示：可能会触发浏览器刷新。";
  if (s === "ctrl+f" || s === "mod+f") return "提示：可能会触发浏览器查找。建议用 / 聚焦搜索。";
  return "";
}

export function ShortcutsEditor(props: {
  value: string;
  onChange: (next: string) => void;
  allowedTargets: Array<"web" | "admin">;
}) {
  const parsed = useMemo(() => parseJson(props.value), [props.value]);
  const [contextKey, setContextKey] = useState<ContextKey>("admin.global");

  const [recording, setRecording] = useState<null | { kind: "chord" | "seq"; actionKey: string }>(null);
  const [seqPreview, setSeqPreview] = useState<string[]>([]);
  const seqTimerRef = useRef<number | null>(null);
  const seqRef = useRef<string[]>([]);

  const contexts = useMemo(() => {
    const allowed = new Set(props.allowedTargets);
    return ALL_CONTEXTS.filter((c) => {
      if (c.key === "global") return true;
      if (String(c.key).startsWith("web.") && allowed.has("web")) return true;
      if (String(c.key).startsWith("admin.") && allowed.has("admin")) return true;
      return false;
    });
  }, [props.allowedTargets]);

  useEffect(() => {
    const allowed = new Set(props.allowedTargets);
    if (String(contextKey).startsWith("web.") && !allowed.has("web")) setContextKey("admin.global");
    if (String(contextKey).startsWith("admin.") && !allowed.has("admin")) setContextKey("global");
  }, [contextKey, props.allowedTargets]);

  const allowedActions = useMemo(() => {
    const allowed = new Set(props.allowedTargets);
    const out: Array<{ id: ActionId; label: string; defaultBinding?: string }> = [];
    if (allowed.has("admin")) {
      for (const a of ADMIN_ACTIONS) {
        if (a.id === "setWebStyle" || a.id === "setAdminStyle") continue;
        out.push({ id: a.id, label: `Admin：${a.label}`, defaultBinding: a.defaultBinding });
      }
    }
    if (allowed.has("web")) {
      for (const a of WEB_ACTIONS) out.push({ id: a.id, label: `Web：${a.label}`, defaultBinding: a.defaultBinding });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [props.allowedTargets]);

  const actionsForContext = useMemo(() => {
    const ctx = String(contextKey);
    const allowed = new Set(props.allowedTargets);
    const out: Array<{ id: ActionId; label: string; defaultBinding?: string }> = [];
    if (ctx === "global") return allowedActions;
    if (ctx.startsWith("admin.") && allowed.has("admin")) {
      for (const a of ADMIN_ACTIONS) {
        if (!a.scopes.includes(ctx as any)) continue;
        out.push({ id: a.id, label: a.label, defaultBinding: a.defaultBinding });
      }
    }
    if (ctx.startsWith("web.") && allowed.has("web")) {
      for (const a of WEB_ACTIONS) {
        if (!a.scopes.includes(ctx as any)) continue;
        out.push({ id: a.id, label: a.label, defaultBinding: a.defaultBinding });
      }
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out.length ? out : allowedActions;
  }, [allowedActions, contextKey, props.allowedTargets]);

  const scopeMap = useMemo(() => {
    if (!parsed.ok) return {};
    const sc = JSON.parse(JSON.stringify(parsed.value ?? {})) as ShortcutConfig;
    return getScopeMap(sc, contextKey);
  }, [parsed, contextKey]);

  const rows = useMemo(() => {
    const entries = Object.entries(scopeMap ?? {});
    return entries.map(([k, v]) => ({ key: k, spec: String(v ?? "") }));
  }, [scopeMap]);

  const dupBindings = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const s = String(r.spec ?? "").trim();
      if (!s) continue;
      const list = map.get(s) ?? [];
      list.push(r.key);
      map.set(s, list);
    }
    const dups = new Map<string, string[]>();
    for (const [spec, keys] of map) if (keys.length > 1) dups.set(spec, keys);
    return dups;
  }, [rows]);

  function mutate(mutator: (sc: ShortcutConfig) => void) {
    if (!parsed.ok) return;
    const sc = JSON.parse(JSON.stringify(parsed.value ?? {})) as ShortcutConfig;
    mutator(sc);
    props.onChange(formatJson(sc));
  }

  function setBinding(actionKey: string, spec: string) {
    mutate((sc) => {
      const m = getScopeMap(sc, contextKey);
      if (!spec.trim()) {
        delete m[actionKey];
      } else {
        m[actionKey] = spec.trim();
      }
    });
  }

  function deleteRow(actionKey: string) {
    mutate((sc) => {
      const m = getScopeMap(sc, contextKey);
      delete m[actionKey];
    });
  }

  function renameAction(oldKey: string, nextKey: string) {
    if (oldKey === nextKey) return;
    mutate((sc) => {
      const m = getScopeMap(sc, contextKey);
      const val = Object.prototype.hasOwnProperty.call(m, oldKey) ? m[oldKey] : undefined;
      delete m[oldKey];
      // 保留空字符串：用户经常先选 Action，再录制按键。
      m[nextKey] = val === undefined ? "" : val;
    });
  }

  function addRow() {
    const existing = new Set(rows.map((r) => r.key));
    const pick = actionsForContext.find((a) => !existing.has(String(a.id)));
    const nextKey = String(pick?.id ?? "focusSearch");
    mutate((sc) => {
      const m = getScopeMap(sc, contextKey);
      if (!m[nextKey]) m[nextKey] = "";
    });
  }

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (recording.kind === "chord") {
        const combo = normalizeRecordedChord(e);
        if (combo === null) {
          setRecording(null);
          return;
        }
        if (combo === "") return;
        setBinding(recording.actionKey, combo);
        setRecording(null);
        return;
      }

      const key = String(e.key ?? "").toLowerCase();
      if (key === "escape") {
        setRecording(null);
        setSeqPreview([]);
        seqRef.current = [];
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!key || key.length !== 1) return;
      seqRef.current = [...seqRef.current, key].slice(-6);
      setSeqPreview(seqRef.current);
      if (seqTimerRef.current) window.clearTimeout(seqTimerRef.current);
      seqTimerRef.current = window.setTimeout(() => {
        const spec = seqRef.current.join(" ");
        setBinding(recording.actionKey, spec);
        setSeqPreview([]);
        seqRef.current = [];
        setRecording(null);
        seqTimerRef.current = null;
      }, 900);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  if (!parsed.ok) {
    return <div className="muted" style={{ color: "#ffb4b4" }}>{parsed.error}</div>;
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong>可视化录制</strong>
          <span className="muted">（下拉选择 Action + 录制 chord/序列）</span>
        </div>
        <div className="nav">
          <button className="chip" type="button" onClick={addRow}>添加动作</button>
          <button className="chip" type="button" onClick={() => props.onChange(formatJson(parsed.value ?? {}))}>格式化</button>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div className="field">
        作用域
        <SelectBox
          value={String(contextKey)}
          options={contexts.map((c) => ({ value: String(c.key), label: c.label }))}
          onChange={(v) => setContextKey(v)}
          ariaLabel="作用域"
        />
      </div>
      <div style={{ height: 10 }} />

      {rows.length === 0 ? <div className="muted">当前作用域暂无绑定，点击“添加动作”开始。</div> : null}

      <div className="grid">
        {rows.map((r) => {
          const conflict = dupBindings.get(r.spec.trim());
          const hint = reservedHint(r.spec);
          const usedKeys = new Set(rows.map((x) => x.key));
          const rowOptions = (() => {
            const base = actionsForContext.map((a) => {
              const value = String(a.id);
              return {
                value,
                label: a.label,
                disabled: usedKeys.has(value) && value !== r.key
              };
            });
            if (!base.some((o) => o.value === r.key)) base.push({ value: r.key, label: `自定义：${r.key}` });
            return base;
          })();
          return (
            <div key={r.key} className="card" style={{ padding: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ minWidth: 220, flex: "1 1 220px" }}>
                  <SelectBox
                    value={r.key}
                    options={rowOptions}
                    onChange={(v) => renameAction(r.key, v)}
                    ariaLabel="选择动作"
                  />
                </div>
                <div className="nav" style={{ flexWrap: "wrap" }}>
                  <button
                    className="chip"
                    type="button"
                    onClick={() => {
                      setSeqPreview([]);
                      seqRef.current = [];
                      setRecording({ kind: "chord", actionKey: r.key });
                    }}
                    disabled={!!recording}
                  >
                    {recording?.kind === "chord" && recording.actionKey === r.key ? "按键中…" : "录制组合键"}
                  </button>
                  <button
                    className="chip"
                    type="button"
                    onClick={() => {
                      setSeqPreview([]);
                      seqRef.current = [];
                      setRecording({ kind: "seq", actionKey: r.key });
                    }}
                    disabled={!!recording}
                  >
                    {recording?.kind === "seq" && recording.actionKey === r.key ? `录制序列：${seqPreview.join(" ") || "…"}` : "录制序列"}
                  </button>
                  <button className="chip" type="button" onClick={() => setBinding(r.key, "")} disabled={!!recording}>
                    清空
                  </button>
                  <button className="chip" type="button" onClick={() => deleteRow(r.key)} disabled={!!recording}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ height: 8 }} />
              <input
                value={r.spec}
                onChange={(e) => setBinding(r.key, e.target.value)}
                placeholder={actionsForContext.find((a) => String(a.id) === r.key)?.defaultBinding || "例如：mod+s / g p / ?"}
              />
              {hint ? <div className="muted" style={{ marginTop: 6 }}>{hint}</div> : null}
              {conflict && conflict.length > 1 ? (
                <div className="muted" style={{ marginTop: 6, color: "#ffb4b4" }}>
                  冲突：{conflict.join(" / ")} 都绑定了 {r.spec}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
