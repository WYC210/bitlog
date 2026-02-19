import React, { useEffect, useState } from "react";
import type { AdminToolItem, ApiError, ProjectsConfigAdminView, SiteConfig, ToolGroup, ToolKind } from "../api";
import { CodeEditor } from "../components/CodeEditor";
import {
  apiJson,
  createAdminTool,
  deleteAdminTool,
  getConfig,
  getAdminSettings,
  getProjectsConfigAdmin,
  listAdminTools,
  reorderAdminTools,
  updateAdminTool,
  updateProjectsConfigAdmin,
  updateSettings
} from "../api";

export function SettingsPage(props: {
  cfg: SiteConfig | null;
  onCfg: (c: SiteConfig) => void;
  onError: (m: string) => void;
}) {
  const ABOUT_KEY_TECH_STACK = "about.tech_stack_json";
  const ABOUT_KEY_VISITED_PLACES = "about.visited_places_json";
  const ABOUT_KEY_TIMELINE = "about.timeline_json";

  const [baseUrl, setBaseUrl] = useState(props.cfg?.baseUrl ?? "");
  const [timezone, setTimezone] = useState(props.cfg?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [cacheTtl, setCacheTtl] = useState(String(props.cfg?.cacheTtlSeconds ?? 60));
  const [embedAllowlist, setEmbedAllowlist] = useState((props.cfg?.embedAllowlistHosts ?? []).join("\n"));
  const [shortcuts, setShortcuts] = useState(props.cfg?.shortcutsJson ?? "");
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [saving, setSaving] = useState(false);
  const [projectsCfg, setProjectsCfg] = useState<ProjectsConfigAdminView | null>(null);
  const [ghEnabled, setGhEnabled] = useState(true);
  const [ghUsername, setGhUsername] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [ghClearToken, setGhClearToken] = useState(false);
  const [gtEnabled, setGtEnabled] = useState(true);
  const [gtUsername, setGtUsername] = useState("");
  const [gtToken, setGtToken] = useState("");
  const [gtClearToken, setGtClearToken] = useState(false);
  const [includeForks, setIncludeForks] = useState(false);
  const [maxItems, setMaxItems] = useState("24");

  const [tools, setTools] = useState<AdminToolItem[]>([]);
  const [toolEditId, setToolEditId] = useState<string | null>(null);
  const [toolDraft, setToolDraft] = useState<Partial<AdminToolItem> | null>(null);
  const [formattingClientCode, setFormattingClientCode] = useState(false);

  const [aboutTechStackJson, setAboutTechStackJson] = useState("");
  const [aboutVisitedPlacesJson, setAboutVisitedPlacesJson] = useState("");
  const [aboutTimelineJson, setAboutTimelineJson] = useState("");
  const [formattingAboutJson, setFormattingAboutJson] = useState(false);
  const [newTool, setNewTool] = useState<{
    title: string;
    slug: string;
    groupKey: ToolGroup;
    kind: ToolKind;
    url: string;
    description: string;
    clientCode: string;
    enabled: boolean;
  }>({
    title: "",
    slug: "",
    groupKey: "utils",
    kind: "link",
    url: "",
    description: "",
    clientCode: "",
    enabled: true
  });

  async function formatJs(code: string): Promise<string> {
    const prettierMod = (await import("prettier/standalone")) as any;
    const babelMod = (await import("prettier/plugins/babel")) as any;
    const estreeMod = (await import("prettier/plugins/estree")) as any;

    const prettier = prettierMod?.default ?? prettierMod;
    const babel = babelMod?.default ?? babelMod;
    const estree = estreeMod?.default ?? estreeMod;

    const formatted = await prettier.format(String(code ?? ""), {
      parser: "babel",
      plugins: [babel, estree],
      printWidth: 100,
      tabWidth: 2,
      semi: true,
      singleQuote: true,
      trailingComma: "es5"
    });
    return String(formatted ?? "").trimEnd();
  }

  function formatJsonSync(value: string): string {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  }

  async function formatAboutJson() {
    setFormattingAboutJson(true);
    try {
      setAboutTechStackJson((v) => formatJsonSync(v));
      setAboutVisitedPlacesJson((v) => formatJsonSync(v));
      setAboutTimelineJson((v) => formatJsonSync(v));
    } catch (e) {
      const msg = (e as any)?.message ? String((e as any).message) : "JSON format failed";
      props.onError(msg);
    } finally {
      setFormattingAboutJson(false);
    }
  }

  async function formatToolDraftClientCode() {
    if (!toolDraft) return;
    const code = String((toolDraft as any).clientCode ?? "");
    if (!code.trim()) return;
    setFormattingClientCode(true);
    try {
      const next = await formatJs(code);
      setToolDraft((prev) => (prev ? ({ ...prev, clientCode: next } as any) : prev));
    } catch (e) {
      const msg = (e as any)?.message ? String((e as any).message) : "格式化失败";
      props.onError(msg);
    } finally {
      setFormattingClientCode(false);
    }
  }

  async function formatNewToolClientCode() {
    const code = String(newTool.clientCode ?? "");
    if (!code.trim()) return;
    setFormattingClientCode(true);
    try {
      const next = await formatJs(code);
      setNewTool((prev) => ({ ...prev, clientCode: next }));
    } catch (e) {
      const msg = (e as any)?.message ? String((e as any).message) : "格式化失败";
      props.onError(msg);
    } finally {
      setFormattingClientCode(false);
    }
  }

  useEffect(() => {
    if (!props.cfg) return;
    setBaseUrl(props.cfg.baseUrl ?? "");
    setTimezone(props.cfg.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setCacheTtl(String(props.cfg.cacheTtlSeconds ?? 60));
    setEmbedAllowlist((props.cfg.embedAllowlistHosts ?? []).join("\n"));
    setShortcuts(props.cfg.shortcutsJson ?? "");
  }, [props.cfg]);

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getProjectsConfigAdmin();
        setProjectsCfg(cfg);
        setGhEnabled(!!cfg.github.enabled);
        setGhUsername(cfg.github.username ?? "");
        setGtEnabled(!!cfg.gitee.enabled);
        setGtUsername(cfg.gitee.username ?? "");
        setIncludeForks(!!cfg.includeForks);
        setMaxItems(String(cfg.maxItemsPerPlatform ?? 24));
      } catch {
        // ignore
      }
      try {
        const list = await listAdminTools();
        setTools(list);
      } catch {
        // ignore
      }
      try {
        const settings = await getAdminSettings([
          ABOUT_KEY_TECH_STACK,
          ABOUT_KEY_VISITED_PLACES,
          ABOUT_KEY_TIMELINE
        ]);
        setAboutTechStackJson(settings[ABOUT_KEY_TECH_STACK] ?? "");
        setAboutVisitedPlacesJson(settings[ABOUT_KEY_VISITED_PLACES] ?? "");
        setAboutTimelineJson(settings[ABOUT_KEY_TIMELINE] ?? "");
      } catch {
        // ignore
      }
    })();
  }, []);

  async function saveAbout() {
    props.onError("");
    setSaving(true);
    try {
      const techText = String(aboutTechStackJson ?? "").trim();
      const placesText = String(aboutVisitedPlacesJson ?? "").trim();
      const timelineText = String(aboutTimelineJson ?? "").trim();

      if (techText) JSON.parse(techText);
      if (placesText) JSON.parse(placesText);
      if (timelineText) JSON.parse(timelineText);

      await updateSettings({
        [ABOUT_KEY_TECH_STACK]: aboutTechStackJson,
        [ABOUT_KEY_VISITED_PLACES]: aboutVisitedPlacesJson,
        [ABOUT_KEY_TIMELINE]: aboutTimelineJson
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      alert("Saved (cache_version bumped)");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

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

  async function saveProjects() {
    props.onError("");
    setSaving(true);
    try {
      await updateProjectsConfigAdmin({
        github: {
          enabled: ghEnabled,
          username: ghUsername,
          ...(ghClearToken ? { clearToken: true } : {}),
          ...(ghToken.trim() ? { token: ghToken.trim() } : {})
        },
        gitee: {
          enabled: gtEnabled,
          username: gtUsername,
          ...(gtClearToken ? { clearToken: true } : {}),
          ...(gtToken.trim() ? { token: gtToken.trim() } : {})
        },
        includeForks,
        maxItemsPerPlatform: Number(maxItems)
      });
      const cfg = await getProjectsConfigAdmin();
      setProjectsCfg(cfg);
      setGhToken("");
      setGtToken("");
      setGhClearToken(false);
      setGtClearToken(false);
      alert("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function refreshTools() {
    const list = await listAdminTools();
    setTools(list);
  }

  async function moveTool(id: string, dir: -1 | 1) {
    const idx = tools.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = idx + dir;
    if (next < 0 || next >= tools.length) return;
    const copy = tools.slice();
    const tmp = copy[idx]!;
    copy[idx] = copy[next]!;
    copy[next] = tmp;
    setTools(copy);
    await reorderAdminTools(copy.map((t) => t.id));
    await refreshTools();
  }

  async function toggleToolEnabled(tool: AdminToolItem) {
    await updateAdminTool(tool.id, { enabled: !tool.enabled });
    await refreshTools();
  }

  function startEditTool(tool: AdminToolItem) {
    setToolEditId(tool.id);
    setToolDraft({ ...tool });

    const code = tool.clientCode ? String(tool.clientCode) : "";
    if (code.trim() && !code.includes("\n")) {
      void (async () => {
        setFormattingClientCode(true);
        try {
          const next = await formatJs(code);
          setToolDraft((prev) => {
            if (!prev) return prev;
            if (String((prev as any).id ?? "") !== tool.id) return prev;
            if (String((prev as any).clientCode ?? "") !== code) return prev;
            return { ...prev, clientCode: next } as any;
          });
        } catch {
          // ignore auto-format errors
        } finally {
          setFormattingClientCode(false);
        }
      })();
    }
  }

  function cancelEditTool() {
    setToolEditId(null);
    setToolDraft(null);
  }

  async function saveToolDraft() {
    if (!toolEditId || !toolDraft) return;
    await updateAdminTool(toolEditId, {
      title: String(toolDraft.title ?? ""),
      slug: String(toolDraft.slug ?? ""),
      groupKey: toolDraft.groupKey as ToolGroup,
      kind: toolDraft.kind as ToolKind,
      url: toolDraft.url ?? null,
      description: String(toolDraft.description ?? ""),
      clientCode: (toolDraft as any).clientCode ?? null,
      enabled: !!toolDraft.enabled,
      icon: (toolDraft as any).icon ?? null
    });
    cancelEditTool();
    await refreshTools();
  }

  async function removeTool(id: string) {
    if (!confirm("确定删除该工具？")) return;
    await deleteAdminTool(id);
    await refreshTools();
  }

  async function addTool() {
    props.onError("");
    if (!newTool.title.trim() || !newTool.slug.trim()) {
      props.onError("请填写 title / slug");
      return;
    }
    setSaving(true);
    try {
      await createAdminTool({
        title: newTool.title.trim(),
        slug: newTool.slug.trim(),
        groupKey: newTool.groupKey,
        kind: newTool.kind,
        url: newTool.url.trim() ? newTool.url.trim() : null,
        description: newTool.description.trim(),
        clientCode: newTool.clientCode.trim() ? newTool.clientCode.trim() : null,
        enabled: !!newTool.enabled
      });
      setNewTool({
        title: "",
        slug: "",
        groupKey: "utils",
        kind: "link",
        url: "",
        description: "",
        clientCode: "",
        enabled: true
      });
      await refreshTools();
      alert("已新增（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "新增失败");
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
        <h2 style={{ margin: "0 0 8px" }}>/about 配置</h2>
        <div className="muted">存储在 settings 表中（JSON，多行）。/about 页面会读取并展示。</div>
        <div style={{ height: 10 }} />
        <div className="nav" style={{ marginBottom: 10 }}>
          <button className="chip" type="button" onClick={() => void formatAboutJson()} disabled={formattingAboutJson}>
            {formattingAboutJson ? "格式化中..." : "格式化 JSON"}
          </button>
          <button className="chip chip-primary" type="button" onClick={() => void saveAbout()} disabled={saving}>
            {saving ? "保存中..." : "保存 /about"}
          </button>
        </div>

        <label>
          {ABOUT_KEY_TECH_STACK}
          <CodeEditor
            value={aboutTechStackJson}
            onChange={(v) => setAboutTechStackJson(v)}
            onSave={() => void saveAbout()}
            placeholder={`[\n  { \"title\": \"Frontend\", \"items\": [\"TypeScript\", \"React\"] },\n  { \"title\": \"Backend\", \"items\": [\"Hono\", \"SQLite\"] }\n]`}
          />
        </label>

        <div style={{ height: 10 }} />
        <label>
          {ABOUT_KEY_VISITED_PLACES}
          <CodeEditor
            value={aboutVisitedPlacesJson}
            onChange={(v) => setAboutVisitedPlacesJson(v)}
            onSave={() => void saveAbout()}
            placeholder={`[\n  \"中国-北京\",\n  \"中国-广东\"\n]`}
          />
        </label>

        <div style={{ height: 10 }} />
        <label>
          {ABOUT_KEY_TIMELINE}
          <CodeEditor
            value={aboutTimelineJson}
            onChange={(v) => setAboutTimelineJson(v)}
            onSave={() => void saveAbout()}
            placeholder={`[\n  { \"year\": 2023, \"title\": \"Started\", \"description\": \"...\" }\n]`}
          />
        </label>
      </div>

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
        <h2 style={{ margin: "0 0 8px" }}>项目页（GitHub / Gitee）</h2>
        <div className="muted">只在服务端保存 Token，不会暴露给访客浏览器。</div>
        <div style={{ height: 12 }} />
        <div className="row">
          <label>
            GitHub 启用
            <select value={ghEnabled ? "1" : "0"} onChange={(e) => setGhEnabled(e.target.value === "1")}>
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </select>
          </label>
          <label>
            GitHub 用户名
            <input value={ghUsername} onChange={(e) => setGhUsername(e.target.value)} placeholder="yourname" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            GitHub Token（可选）
            <input
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder={projectsCfg?.github.tokenSet ? "已保存（留空不改）" : "留空=不使用"}
            />
          </label>
          <label>
            GitHub Token 操作
            <select value={ghClearToken ? "1" : "0"} onChange={(e) => setGhClearToken(e.target.value === "1")}>
              <option value="0">不清空</option>
              <option value="1">清空 Token</option>
            </select>
          </label>
        </div>

        <div style={{ height: 14 }} />
        <div className="row">
          <label>
            Gitee 启用
            <select value={gtEnabled ? "1" : "0"} onChange={(e) => setGtEnabled(e.target.value === "1")}>
              <option value="1">启用</option>
              <option value="0">禁用</option>
            </select>
          </label>
          <label>
            Gitee 用户名
            <input value={gtUsername} onChange={(e) => setGtUsername(e.target.value)} placeholder="yourname" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            Gitee Token（可选）
            <input
              type="password"
              value={gtToken}
              onChange={(e) => setGtToken(e.target.value)}
              placeholder={projectsCfg?.gitee.tokenSet ? "已保存（留空不改）" : "留空=不使用"}
            />
          </label>
          <label>
            Gitee Token 操作
            <select value={gtClearToken ? "1" : "0"} onChange={(e) => setGtClearToken(e.target.value === "1")}>
              <option value="0">不清空</option>
              <option value="1">清空 Token</option>
            </select>
          </label>
        </div>

        <div style={{ height: 14 }} />
        <div className="row">
          <label>
            展示 fork
            <select value={includeForks ? "1" : "0"} onChange={(e) => setIncludeForks(e.target.value === "1")}>
              <option value="0">不展示</option>
              <option value="1">展示</option>
            </select>
          </label>
          <label>
            每个平台最多展示（1-100）
            <input value={maxItems} onChange={(e) => setMaxItems(e.target.value)} />
          </label>
        </div>

        <div style={{ height: 10 }} />
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveProjects()} disabled={saving}>
            {saving ? "保存中..." : "保存项目页配置"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>工具中心（访客可见）</h2>
        <div className="muted">支持启用/禁用、拖动排序（↑↓）、新增/编辑/删除；保存会触发 cache_version 递增。</div>
        <div style={{ height: 12 }} />

        <div className="grid" style={{ gap: 10 }}>
          {tools.map((t) => (
            <div key={t.id} className="card" style={{ padding: 12, background: "rgba(255,255,255,0.02)" }}>
              <div className="nav" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div className="nav">
                  <button className="chip" onClick={() => void moveTool(t.id, -1)} title="上移">
                    ↑
                  </button>
                  <button className="chip" onClick={() => void moveTool(t.id, 1)} title="下移">
                    ↓
                  </button>
                  <button className={`chip ${t.enabled ? "chip-primary" : ""}`} onClick={() => void toggleToolEnabled(t)}>
                    {t.enabled ? "已启用" : "已禁用"}
                  </button>
                </div>
                <div className="nav">
                  <button className="chip" onClick={() => startEditTool(t)}>
                    编辑
                  </button>
                  <button className="chip" onClick={() => void removeTool(t.id)}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ fontWeight: 800 }}>{t.title}</div>
              <div className="muted">
                /{t.slug} · {t.groupKey} · {t.kind} · {t.url || "（无链接）"}
              </div>
              {t.description ? <div style={{ marginTop: 8, color: "rgba(255,255,255,0.75)" }}>{t.description}</div> : null}

              {toolEditId === t.id && toolDraft ? (
                <div style={{ marginTop: 12 }}>
                  <div className="row">
                    <label>
                      title
                      <input
                        value={String(toolDraft.title ?? "")}
                        onChange={(e) => setToolDraft({ ...toolDraft, title: e.target.value })}
                      />
                    </label>
                    <label>
                      slug
                      <input
                        value={String(toolDraft.slug ?? "")}
                        onChange={(e) => setToolDraft({ ...toolDraft, slug: e.target.value })}
                      />
                    </label>
                  </div>
                  <div style={{ height: 10 }} />
                  <div className="row">
                    <label>
                      group
                      <select
                        value={String(toolDraft.groupKey ?? "utils")}
                        onChange={(e) => setToolDraft({ ...toolDraft, groupKey: e.target.value as ToolGroup })}
                      >
                        <option value="games">games</option>
                        <option value="apis">apis</option>
                        <option value="utils">utils</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                    <label>
                      kind
                      <select
                        value={String(toolDraft.kind ?? "link")}
                        onChange={(e) => setToolDraft({ ...toolDraft, kind: e.target.value as ToolKind })}
                      >
                        <option value="link">link</option>
                        <option value="page">page</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ height: 10 }} />
                  <label>
                    url（link=外链；page=站内路径）
                    <input
                      value={String(toolDraft.url ?? "")}
                      onChange={(e) => setToolDraft({ ...toolDraft, url: e.target.value })}
                      placeholder="https://... 或 /tools/snake"
                    />
                  </label>
                  <label>
                    description
                    <textarea
                      value={String(toolDraft.description ?? "")}
                      onChange={(e) => setToolDraft({ ...toolDraft, description: e.target.value })}
                      style={{ minHeight: 80 }}
                    />
                  </label>
                  {(toolDraft.kind === "page") && (
                    <label>
                      客户端代码 JS（kind=page 时生效，运行在 #tool-root 内）
                      <div className="nav" style={{ margin: "8px 0" }}>
                        <button className="chip" type="button" onClick={() => void formatToolDraftClientCode()} disabled={formattingClientCode}>
                          {formattingClientCode ? "格式化中..." : "格式化 JS"}
                        </button>
                        <button
                          className="chip"
                          type="button"
                          onClick={() => {
                            const code = String((toolDraft as any).clientCode ?? "");
                            if (navigator.clipboard) void navigator.clipboard.writeText(code);
                          }}
                        >
                          复制
                        </button>
                      </div>
                      <CodeEditor
                        value={String((toolDraft as any).clientCode ?? "")}
                        onChange={(v) => setToolDraft({ ...toolDraft, clientCode: v } as any)}
                        onSave={() => void saveToolDraft()}
                        placeholder={"// 在 #tool-root 元素内渲染工具\nvar root = document.getElementById('tool-root');\nroot.innerHTML = '<p>Hello</p>';"}
                      />
                    </label>
                  )}
                  <div className="nav">
                    <button className="chip chip-primary" onClick={() => void saveToolDraft()}>
                      保存
                    </button>
                    <button className="chip" onClick={() => cancelEditTool()}>
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ height: 14 }} />
        <h3 style={{ margin: "0 0 8px" }}>新增工具</h3>
        <div className="row">
          <label>
            title
            <input value={newTool.title} onChange={(e) => setNewTool({ ...newTool, title: e.target.value })} />
          </label>
          <label>
            slug
            <input value={newTool.slug} onChange={(e) => setNewTool({ ...newTool, slug: e.target.value })} placeholder="snake / api-tester" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            group
            <select value={newTool.groupKey} onChange={(e) => setNewTool({ ...newTool, groupKey: e.target.value as ToolGroup })}>
              <option value="games">games</option>
              <option value="apis">apis</option>
              <option value="utils">utils</option>
              <option value="other">other</option>
            </select>
          </label>
          <label>
            kind
            <select value={newTool.kind} onChange={(e) => setNewTool({ ...newTool, kind: e.target.value as ToolKind })}>
              <option value="link">link</option>
              <option value="page">page</option>
            </select>
          </label>
        </div>
        <div style={{ height: 10 }} />
        <label>
          url（可空）
          <input value={newTool.url} onChange={(e) => setNewTool({ ...newTool, url: e.target.value })} placeholder="https://... 或 /tools/xxx" />
        </label>
        <label>
          description（可空）
          <textarea value={newTool.description} onChange={(e) => setNewTool({ ...newTool, description: e.target.value })} style={{ minHeight: 80 }} />
        </label>
        {newTool.kind === "page" && (
          <label>
            客户端代码 JS（kind=page 时生效，运行在 #tool-root 内）
            <div className="nav" style={{ margin: "8px 0" }}>
              <button className="chip" type="button" onClick={() => void formatNewToolClientCode()} disabled={formattingClientCode}>
                {formattingClientCode ? "格式化中..." : "格式化 JS"}
              </button>
              <button
                className="chip"
                type="button"
                onClick={() => {
                  const code = String(newTool.clientCode ?? "");
                  if (navigator.clipboard) void navigator.clipboard.writeText(code);
                }}
              >
                复制
              </button>
            </div>
            <CodeEditor
              value={newTool.clientCode}
              onChange={(v) => setNewTool({ ...newTool, clientCode: v })}
              placeholder={"// 在 #tool-root 元素内渲染工具\nvar root = document.getElementById('tool-root');\nroot.innerHTML = '<p>Hello</p>';"}
            />
          </label>
        )}
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void addTool()} disabled={saving}>
            {saving ? "新增中..." : "新增"}
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
