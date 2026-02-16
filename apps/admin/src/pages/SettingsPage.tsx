import React, { useEffect, useState } from "react";
import type { ApiError, SiteConfig } from "../api";
import { apiJson, getConfig, updateSettings } from "../api";

export function SettingsPage(props: {
  cfg: SiteConfig | null;
  onCfg: (c: SiteConfig) => void;
  onError: (m: string) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(props.cfg?.baseUrl ?? "");
  const [timezone, setTimezone] = useState(props.cfg?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [cacheTtl, setCacheTtl] = useState(String(props.cfg?.cacheTtlSeconds ?? 60));
  const [embedAllowlist, setEmbedAllowlist] = useState((props.cfg?.embedAllowlistHosts ?? []).join("\n"));
  const [shortcuts, setShortcuts] = useState(props.cfg?.shortcutsJson ?? "");
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.cfg) return;
    setBaseUrl(props.cfg.baseUrl ?? "");
    setTimezone(props.cfg.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setCacheTtl(String(props.cfg.cacheTtlSeconds ?? 60));
    setEmbedAllowlist((props.cfg.embedAllowlistHosts ?? []).join("\n"));
    setShortcuts(props.cfg.shortcutsJson ?? "");
  }, [props.cfg]);

  async function saveSettings() {
    props.onError("");
    setSaving(true);
    try {
      const allowlistHosts = embedAllowlist
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((h) => h.replace(/^https?:\/\//, "").split("/")[0]!);
      await updateSettings({
        "site.base_url": baseUrl,
        "site.timezone": timezone,
        "site.cache_public_ttl_seconds": Number(cacheTtl),
        "site.embed_allowlist": allowlistHosts,
        "site.shortcuts_json": shortcuts
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      alert("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    props.onError("");
    if (!pwOld || !pwNew) {
      props.onError("请输入旧密码/新密码");
      return;
    }
    setSaving(true);
    try {
      const r = await apiJson<{ ok: true; relogin?: boolean }>("/api/admin/password", {
        method: "PUT",
        body: JSON.stringify({ oldPassword: pwOld, newPassword: pwNew })
      });
      setPwNew("");
      setPwOld("");
      if (r.relogin) window.location.reload();
      alert("密码已更新");
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
        <h2 style={{ margin: "0 0 8px" }}>站点设置</h2>
        <div className="muted">提示：保存会触发缓存软失效（cache_version 递增）。</div>
        <div style={{ height: 12 }} />
        <div className="row">
          <label>
            site.base_url（必填）
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://example.com" />
          </label>
          <label>
            site.timezone（IANA）
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Shanghai" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            Public Cache TTL（秒，1-3600）
            <input value={cacheTtl} onChange={(e) => setCacheTtl(e.target.value)} />
          </label>
          <label>
            （占位）
            <input value="" readOnly style={{ opacity: 0.6 }} />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <label>
          site.embed_allowlist（host，一行一个；空=禁用）
          <textarea value={embedAllowlist} onChange={(e) => setEmbedAllowlist(e.target.value)} />
        </label>
        <label>
          site.shortcuts_json（JSON）
          <textarea value={shortcuts} onChange={(e) => setShortcuts(e.target.value)} />
        </label>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveSettings()} disabled={saving}>
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>管理员密码</h2>
        <div className="row">
          <label>
            旧密码
            <input type="password" value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
          </label>
          <label>
            新密码（≥6）
            <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="nav">
          <button className="chip" onClick={() => void changePassword()} disabled={saving}>
            更新密码
          </button>
        </div>
      </div>
    </div>
  );
}
