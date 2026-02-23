import React, { useEffect, useMemo, useState } from "react";
import type { AdminPrefs, ApiError, SiteConfig } from "../api";
import { changeAdminPassword, getAdminPrefs, getConfig, updateAdminPrefs, updateSettings } from "../api";
import { ShortcutsEditor } from "../components/ShortcutsEditor";

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

export function AccountPage(props: {
  cfg: SiteConfig | null;
  onCfg: (c: SiteConfig) => void;
  prefs: AdminPrefs | null;
  onPrefs: (p: AdminPrefs) => void;
  onError: (m: string) => void;
  onForceRelogin: () => void;
}) {
  const [editorLayout, setEditorLayout] = useState<AdminPrefs["editorLayout"]>(props.prefs?.editorLayout ?? "split");

  const [siteShortcutsText, setSiteShortcutsText] = useState(props.cfg?.shortcutsJson ?? "");
  const [siteShortcutsDirty, setSiteShortcutsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");

  const parsedSiteShortcuts = useMemo(() => parseJson(siteShortcutsText), [siteShortcutsText]);
  const siteShortcutsParseError = parsedSiteShortcuts.ok ? "" : parsedSiteShortcuts.error;

  useEffect(() => {
    if (!props.prefs) return;
    setEditorLayout(props.prefs.editorLayout ?? "split");
  }, [props.prefs]);

  useEffect(() => {
    if (!props.cfg) return;
    if (!siteShortcutsDirty) setSiteShortcutsText(props.cfg.shortcutsJson ?? "");
  }, [props.cfg, siteShortcutsDirty]);

  useEffect(() => {
    const base = props.cfg?.shortcutsJson ?? "";
    if (siteShortcutsText === base) {
      if (siteShortcutsDirty) setSiteShortcutsDirty(false);
    } else {
      if (!siteShortcutsDirty) setSiteShortcutsDirty(true);
    }
  }, [siteShortcutsText, props.cfg?.shortcutsJson]);


  async function reloadPrefs() {
    const p = await getAdminPrefs();
    props.onPrefs(p);
  }

  async function reloadCfg() {
    const c = await getConfig();
    props.onCfg(c);
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

  async function saveSiteShortcuts() {
    props.onError("");
    if (!parsedSiteShortcuts.ok) {
      props.onError(siteShortcutsParseError || "JSON 解析失败");
      return;
    }
    setSaving(true);
    try {
      const text = String(siteShortcutsText ?? "").trim();
      await updateSettings({ "site.shortcuts_json": text ? text : null });
      setSiteShortcutsDirty(false);
      await reloadCfg();
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
        <h2 style={{ margin: "0 0 8px" }}>全站快捷键（影响前端 + 后台）</h2>
        <div className="muted">作用域只有 3 个：全局 / 后台 / 前端；全局优先级最高。</div>
        <div style={{ height: 12 }} />
        <ShortcutsEditor value={siteShortcutsText} onChange={setSiteShortcutsText} allowedTargets={["admin", "web"]} />
        <div style={{ height: 10 }} />
        <label>
          高级：site.shortcuts_json（JSON）
          <textarea value={siteShortcutsText} onChange={(e) => setSiteShortcutsText(e.target.value)} />
        </label>
        {siteShortcutsParseError ? <div className="muted" style={{ color: "#ffb4b4" }}>{siteShortcutsParseError}</div> : null}
        <div style={{ height: 10 }} />
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveSiteShortcuts()} disabled={saving || !parsedSiteShortcuts.ok || !siteShortcutsDirty}>
            {saving ? "保存中…" : "保存快捷键"}
          </button>
          <button
            className="chip"
            onClick={() => {
              setSiteShortcutsText("");
            }}
            disabled={saving}
          >
            清空快捷键
          </button>
        </div>
      </div>
    </div>
  );
}
