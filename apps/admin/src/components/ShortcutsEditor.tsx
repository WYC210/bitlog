import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AdminActionId } from "../shortcuts/actions";
import { ADMIN_ACTIONS } from "../shortcuts/actions";
import { normalizeRecordedChord } from "../shortcuts/shortcuts";
import { SelectBox } from "./SelectBox";

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
type ShortcutScope = "global" | "admin" | "web";

type ShortcutConfig = {
  global?: Record<string, string>;
  admin?: Record<string, string>;
  web?: Record<string, string>;
  contexts?: Record<string, Record<string, string>>;
};

const WEB_ACTIONS: Array<{
  id: WebActionId;
  label: string;
  defaultBinding?: string;
}> = [
  { id: "openCommandPalette", label: "打开命令面板", defaultBinding: "?" },
  { id: "focusSearch", label: "聚焦搜索", defaultBinding: "/" },
  { id: "toggleLightDark", label: "切换 light/dark", defaultBinding: "shift+d" },
  { id: "goHome", label: "跳转首页", defaultBinding: "g h" },
  { id: "goArticles", label: "跳转文章列表", defaultBinding: "g a" },
  { id: "goProjects", label: "跳转项目页", defaultBinding: "g p" },
  { id: "goTools", label: "跳转工具中心", defaultBinding: "g t" },
  { id: "goAbout", label: "跳转关于我", defaultBinding: "g o" },
  { id: "postPrev", label: "上一篇（文章页）", defaultBinding: "k" },
  { id: "postNext", label: "下一篇（文章页）", defaultBinding: "j" },
  { id: "back", label: "后退", defaultBinding: "g b" },
  { id: "forward", label: "前进", defaultBinding: "g n" }
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

function getScopeMap(sc: ShortcutConfig, scope: ShortcutScope): Record<string, string> {
  if (scope === "global") {
    if (!sc.global || typeof sc.global !== "object") sc.global = {};
    return sc.global;
  }

  if (scope === "admin") {
    if (!sc.admin || typeof sc.admin !== "object") sc.admin = {};
    const legacy = sc.contexts?.["admin.global"];
    if (!Object.keys(sc.admin).length && legacy && typeof legacy === "object") Object.assign(sc.admin, legacy);
    return sc.admin;
  }

  if (scope === "web") {
    if (!sc.web || typeof sc.web !== "object") sc.web = {};
    const legacy = sc.contexts?.["web.global"];
    if (!Object.keys(sc.web).length && legacy && typeof legacy === "object") Object.assign(sc.web, legacy);
    return sc.web;
  }

  return {};
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
  const [scope, setScope] = useState<ShortcutScope>(() => {
    const allowed = new Set(props.allowedTargets);
    if (allowed.has("admin") && allowed.has("web")) return "global";
    if (allowed.has("admin")) return "admin";
    if (allowed.has("web")) return "web";
    return "global";
  });

  const [recording, setRecording] = useState<null | { kind: "chord" | "seq"; actionKey: string }>(null);
  const [seqPreview, setSeqPreview] = useState<string[]>([]);
  const seqTimerRef = useRef<number | null>(null);
  const seqRef = useRef<string[]>([]);

  const scopes = useMemo(() => {
    const allowed = new Set(props.allowedTargets);
    const out: Array<{ key: ShortcutScope; label: string }> = [{ key: "global", label: "全局（global）" }];
    if (allowed.has("admin")) out.push({ key: "admin", label: "后台（admin）" });
    if (allowed.has("web")) out.push({ key: "web", label: "前端（web）" });
    return out;
  }, [props.allowedTargets]);

  useEffect(() => {
    const allowed = new Set(props.allowedTargets);
    if (scope === "web" && !allowed.has("web")) setScope("global");
    if (scope === "admin" && !allowed.has("admin")) setScope("global");
  }, [scope, props.allowedTargets]);

  type ActionOption = { id: ActionId; label: string; defaultBinding: string | undefined };

  const adminActions = useMemo(() => {
    const out: ActionOption[] = [];
    for (const a of ADMIN_ACTIONS) {
      if (a.id === "setWebStyle" || a.id === "setAdminStyle") continue;
      out.push({ id: a.id, label: a.label, defaultBinding: a.defaultBinding });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, []);

  const webActions = useMemo(() => {
    const out: ActionOption[] = WEB_ACTIONS.map((a) => ({ id: a.id, label: a.label, defaultBinding: a.defaultBinding }));
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, []);

  const globalActions = useMemo(() => {
    const allowed = new Set(props.allowedTargets);
    const map = new Map<string, { id: ActionId; adminLabel?: string; webLabel?: string; defaultBinding: string | undefined }>();

    if (allowed.has("admin")) {
      for (const a of adminActions) {
        const id = String(a.id);
        const cur = map.get(id) ?? { id: a.id, defaultBinding: undefined };
        cur.adminLabel = a.label;
        if (cur.defaultBinding === undefined) cur.defaultBinding = a.defaultBinding;
        map.set(id, cur);
      }
    }

    if (allowed.has("web")) {
      for (const a of webActions) {
        const id = String(a.id);
        const cur = map.get(id) ?? { id: a.id, defaultBinding: undefined };
        cur.webLabel = a.label;
        if (cur.defaultBinding === undefined) cur.defaultBinding = a.defaultBinding;
        map.set(id, cur);
      }
    }

    const out: ActionOption[] = [];
    for (const v of map.values()) {
      const inAdmin = !!v.adminLabel;
      const inWeb = !!v.webLabel;
      const baseLabel = (v.adminLabel ?? v.webLabel ?? String(v.id)).trim();
      const label = inAdmin && inWeb ? `通用：${baseLabel}` : inAdmin ? `后台：${baseLabel}` : `前端：${baseLabel}`;
      out.push({ id: v.id, label, defaultBinding: v.defaultBinding });
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [adminActions, webActions, props.allowedTargets]);

  const actionsForScope = useMemo((): ActionOption[] => {
    if (scope === "global") return globalActions;
    if (scope === "admin") return adminActions;
    if (scope === "web") return webActions;
    return globalActions;
  }, [adminActions, globalActions, scope, webActions]);

  const scopeMap = useMemo(() => {
    if (!parsed.ok) return {};
    const sc = JSON.parse(JSON.stringify(parsed.value ?? {})) as ShortcutConfig;
    return getScopeMap(sc, scope);
  }, [parsed, scope]);

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
      const m = getScopeMap(sc, scope);
      if (!spec.trim()) {
        delete m[actionKey];
      } else {
        m[actionKey] = spec.trim();
      }
    });
  }

  function deleteRow(actionKey: string) {
    mutate((sc) => {
      const m = getScopeMap(sc, scope);
      delete m[actionKey];
    });
  }

  function renameAction(oldKey: string, nextKey: string) {
    if (oldKey === nextKey) return;
    mutate((sc) => {
      const m = getScopeMap(sc, scope);
      const val = Object.prototype.hasOwnProperty.call(m, oldKey) ? m[oldKey] : undefined;
      delete m[oldKey];
      // 保留空字符串：用户经常先选 Action，再录制按键。
      m[nextKey] = val === undefined ? "" : val;
    });
  }

  function addRow() {
    const existing = new Set(rows.map((r) => r.key));
    const pick = actionsForScope.find((a) => !existing.has(String(a.id)));
    const nextKey = String(pick?.id ?? "focusSearch");
    mutate((sc) => {
      const m = getScopeMap(sc, scope);
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
          value={String(scope)}
          options={scopes.map((c) => ({ value: String(c.key), label: c.label }))}
          onChange={(v) => setScope(v as ShortcutScope)}
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
            const base = actionsForScope.map((a) => {
              const value = String(a.id);
              return {
                value,
                label: a.label,
                disabled: usedKeys.has(value) && value !== r.key
              };
            });
            if (!base.some((o) => o.value === r.key)) base.push({ value: r.key, label: `自定义：${r.key}`, disabled: false });
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
                placeholder={actionsForScope.find((a) => String(a.id) === r.key)?.defaultBinding || "例如：mod+s / g p / ?"}
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
