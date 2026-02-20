import React, { useEffect, useMemo, useState } from "react";
import type { AdminPrefs, ApiError } from "../api";
import { changeAdminPassword, getAdminPrefs, updateAdminPrefs } from "../api";

type ShortcutAction = "newPost" | "goHome" | "goBack" | "goForward";

function parseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
  const s = String(text ?? "").trim();
  if (!s) return { ok: true, value: {} };
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object") return { ok: false, error: "JSON 必须是对象" };
    return { ok: true, value: v };
  } catch {
    return { ok: false, error: "JSON 解析失败" };
  }
}

function ensureAdminGlobal(sc: any): any {
  if (!sc || typeof sc !== "object") sc = {};
  if (!sc.contexts || typeof sc.contexts !== "object") sc.contexts = {};
  if (!sc.contexts["admin.global"] || typeof sc.contexts["admin.global"] !== "object") sc.contexts["admin.global"] = {};
  return sc;
}

function formatRecordedCombo(e: KeyboardEvent): string | null {
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

export function AccountPage(props: {
  prefs: AdminPrefs | null;
  onPrefs: (p: AdminPrefs) => void;
  onError: (m: string) => void;
  onForceRelogin: () => void;
}) {
  const [shortcutsText, setShortcutsText] = useState(props.prefs?.shortcutsJson ?? "");
  const [editorLayout, setEditorLayout] = useState<AdminPrefs["editorLayout"]>(props.prefs?.editorLayout ?? "split");
  const [shortcutsDirty, setShortcutsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");

  const parsed = useMemo(() => parseJson(shortcutsText), [shortcutsText]);
  const parseError = parsed.ok ? "" : parsed.error;

  const adminGlobal = useMemo(() => {
    if (!parsed.ok) return {};
    const sc = ensureAdminGlobal(JSON.parse(JSON.stringify(parsed.value ?? {})));
    return sc.contexts["admin.global"] ?? {};
  }, [parsed]);

  const [recording, setRecording] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (!props.prefs) return;
    if (!shortcutsDirty) setShortcutsText(props.prefs.shortcutsJson ?? "");
    setEditorLayout(props.prefs.editorLayout ?? "split");
  }, [props.prefs]);

  useEffect(() => {
    const base = props.prefs?.shortcutsJson ?? "";
    if (shortcutsText === base) {
      if (shortcutsDirty) setShortcutsDirty(false);
    } else {
      if (!shortcutsDirty) setShortcutsDirty(true);
    }
  }, [shortcutsText, props.prefs?.shortcutsJson]);

  useEffect(() => {
    if (!recording) return;
    const onKeydown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const combo = formatRecordedCombo(e);
      if (combo === null) {
        setRecording(null);
        return;
      }
      if (combo === "") return;
      applyShortcut(recording, combo);
      setRecording(null);
    };
    window.addEventListener("keydown", onKeydown, true);
    return () => window.removeEventListener("keydown", onKeydown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  function applyShortcut(action: ShortcutAction, spec: string) {
    if (!parsed.ok) return;
    const sc = ensureAdminGlobal(JSON.parse(JSON.stringify(parsed.value ?? {})));
    sc.contexts["admin.global"][action] = spec;
    setShortcutsText(JSON.stringify(sc, null, 2));
    setShortcutsDirty(true);
  }

  function clearShortcut(action: ShortcutAction) {
    if (!parsed.ok) return;
    const sc = ensureAdminGlobal(JSON.parse(JSON.stringify(parsed.value ?? {})));
    delete sc.contexts["admin.global"][action];
    setShortcutsText(JSON.stringify(sc, null, 2));
    setShortcutsDirty(true);
  }

  async function reloadPrefs() {
    const p = await getAdminPrefs();
    props.onPrefs(p);
  }

  async function persistEditorLayout(next: AdminPrefs["editorLayout"]) {
    props.onError("");
    if (editorLayout === next) {
      setEditorLayout(next);
      return;
    }
    setSaving(true);
    try {
      setEditorLayout(next);
      await updateAdminPrefs({ editorLayout: next });
      await reloadPrefs();
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveShortcuts() {
    props.onError("");
    if (!parsed.ok) {
      props.onError(parseError || "JSON 解析失败");
      return;
    }
    setSaving(true);
    try {
      await updateAdminPrefs({ shortcutsJson: shortcutsText.trim() ? shortcutsText : null });
      setShortcutsDirty(false);
      await reloadPrefs();
      alert("已保存");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function doChangePassword() {
    props.onError("");
    if (!pwOld || !pwNew) {
      props.onError("请输入旧密码/新密码");
      return;
    }
    if (pwNew.length < 6) {
      props.onError("新密码至少 6 位");
      return;
    }
    setSaving(true);
    try {
      const r = await changeAdminPassword(pwOld, pwNew);
      setPwOld("");
      setPwNew("");
      if (r.relogin) {
        alert("密码已更新，需要重新登录");
        props.onForceRelogin();
      } else {
        alert("密码已更新");
      }
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "改密失败");
    } finally {
      setSaving(false);
    }
  }

  const actions: Array<{ key: ShortcutAction; label: string; placeholder: string }> = [
    { key: "newPost", label: "新建文章", placeholder: "mod+n / g n ..." },
    { key: "goHome", label: "去站点", placeholder: "alt+h ..." },
    { key: "goBack", label: "上一页", placeholder: "g b ..." },
    { key: "goForward", label: "下一页", placeholder: "g n ..." }
  ];

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>账号</h2>
        <div className="muted">改密后会撤销所有会话，需要重新登录。</div>
        <div style={{ height: 12 }} />
        <div className="row">
          <label>
            旧密码
            <input type="password" value={pwOld} onChange={(e) => setPwOld(e.target.value)} autoComplete="current-password" />
          </label>
          <label>
            新密码（≥6）
            <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="nav">
          <button className="chip" onClick={() => void doChangePassword()} disabled={saving}>
            更新密码
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>编辑器</h2>
        <div className="muted">布局偏好会写入 DB，跨设备生效。</div>
        <div style={{ height: 10 }} />
        <div className="nav">
          <button className={`chip ${editorLayout === "write" ? "chip-primary" : ""}`} onClick={() => void persistEditorLayout("write")}>
            单栏：写作
          </button>
          <button className={`chip ${editorLayout === "preview" ? "chip-primary" : ""}`} onClick={() => void persistEditorLayout("preview")}>
            单栏：预览
          </button>
          <button className={`chip ${editorLayout === "split" ? "chip-primary" : ""}`} onClick={() => void persistEditorLayout("split")}>
            左右分栏
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>个人快捷键（覆盖站点默认）</h2>
        <div className="muted">支持 chord（如 mod+s）和序列（如 g b）。录制只支持 chord。</div>
        <div style={{ height: 12 }} />
        <div className="grid">
          {actions.map((a) => (
            <div key={a.key} className="card" style={{ padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 750 }}>{a.label}</div>
                <div className="nav">
                  <button className="chip" onClick={() => setRecording(a.key)} disabled={saving || !!recording}>
                    {recording === a.key ? "按键中…" : "录制"}
                  </button>
                  <button className="chip" onClick={() => clearShortcut(a.key)} disabled={saving || !parsed.ok}>
                    清空
                  </button>
                </div>
              </div>
              <div style={{ height: 8 }} />
              <input
                value={String((adminGlobal as any)?.[a.key] ?? "")}
                placeholder={a.placeholder}
                onChange={(e) => applyShortcut(a.key, e.target.value)}
                disabled={!parsed.ok || saving}
              />
            </div>
          ))}
        </div>
        <div style={{ height: 10 }} />
        <label>
          高级：shortcuts_json（JSON）
          <textarea value={shortcutsText} onChange={(e) => setShortcutsText(e.target.value)} />
        </label>
        {parseError ? <div className="muted" style={{ color: "#ffb4b4" }}>{parseError}</div> : null}
        <div style={{ height: 10 }} />
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveShortcuts()} disabled={saving || !parsed.ok || !shortcutsDirty}>
            {saving ? "保存中…" : "保存快捷键"}
          </button>
          <button
            className="chip"
            onClick={() => {
              setShortcutsText("");
            }}
            disabled={saving}
          >
            清空覆盖
          </button>
        </div>
      </div>
    </div>
  );
}
