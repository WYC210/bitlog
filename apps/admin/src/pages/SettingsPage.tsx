import React, { useEffect, useState } from "react";
import type {
  AdminHotSourceItem,
  AdminToolItem,
  ApiError,
  HotSourceKind,
  ProjectsConfigAdminView,
  SiteConfig,
  ToolKind,
  UiStyle
} from "../api";
import { CodeEditor } from "../components/CodeEditor";
import { NoticeDialog } from "../components/NoticeDialog";
import { AboutExperienceEditor } from "../components/about/AboutExperienceEditor";
import { AboutSkillsEditor } from "../components/about/AboutSkillsEditor";
import { AboutVisitedPlacesEditor } from "../components/about/AboutVisitedPlacesEditor";
import { SelectBox } from "../components/SelectBox";
import {
  createAdminHotSource,
  createAdminTool,
  deleteAdminHotSource,
  deleteAdminTool,
  getConfig,
  getAdminSettings,
  getProjectsConfigAdmin,
  listAdminHotSources,
  listAdminTools,
  reorderAdminHotSources,
  reorderAdminTools,
  updateAdminHotSource,
  updateAdminTool,
  updateProjectsConfigAdmin,
  updateSettings
} from "../api";

type WebNavItem = { id: string; label: string; href: string; enabled: boolean; external?: boolean };

export function SettingsPage(props: {
  cfg: SiteConfig | null;
  onCfg: (c: SiteConfig) => void;
  onError: (m: string) => void;
  section?: "site" | "projects" | "tools" | "hot" | "about" | null;
}) {
  const ABOUT_KEY_TECH_STACK = "about.tech_stack_json";
  const ABOUT_KEY_VISITED_PLACES = "about.visited_places_json";
  const ABOUT_KEY_TIMELINE = "about.timeline_json";
  const ABOUT_KEY_SIDEBAR_DAILY_NEWS = "about.sidebar_daily_news_enabled";
  const ABOUT_KEY_SIDEBAR_HISTORY_TODAY = "about.sidebar_history_today_enabled";
  const ABOUT_KEY_SIDEBAR_TRAVEL = "about.sidebar_travel_enabled";
  const POSTS_KEY_AUTO_SUMMARY = "posts.auto_summary";
  const HOT_KEY_RSSHUB_URL = "hot.rsshub_url";
  const HOT_KEY_RSSHUB_FALLBACK_URLS = "hot.rsshub_fallback_urls";

  const [baseUrl, setBaseUrl] = useState(props.cfg?.baseUrl ?? "");
  const [timezone, setTimezone] = useState(props.cfg?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [cacheTtl, setCacheTtl] = useState(String(props.cfg?.cacheTtlSeconds ?? 60));
  const [embedAllowlist, setEmbedAllowlist] = useState((props.cfg?.embedAllowlistHosts ?? []).join("\n"));
  const [footerCopyrightUrl, setFooterCopyrightUrl] = useState(props.cfg?.footerCopyrightUrl ?? "");
  const [footerIcpText, setFooterIcpText] = useState(props.cfg?.footerIcpText ?? "");
  const [footerIcpLink, setFooterIcpLink] = useState(props.cfg?.footerIcpLink ?? "https://beian.miit.gov.cn/");
  const [webStyle, setWebStyle] = useState<UiStyle>(props.cfg?.webStyle ?? "current");
  const [adminStyle, setAdminStyle] = useState<UiStyle>(props.cfg?.adminStyle ?? "current");
  const SWITCH_MENU_BINDINGS_KEY = "bitlog:admin:switchMenu:bindings";
  const UI_COMMAND_MENU_LAYOUT_KEY = "ui.command_menu_layout";
  const UI_COMMAND_MENU_CONFIRM_MODE_KEY = "ui.command_menu_confirm_mode";
  const UI_COMMAND_MENU_MOBILE_SYNC_KEY = "ui.command_menu_mobile_sync";
  const UI_WEB_NAV_KEY = "ui.web_nav_json";
  const [webNav, setWebNav] = useState<WebNavItem[]>(
    props.cfg?.webNav?.length
      ? (props.cfg.webNav as any)
      : [
          { id: "home", label: "首页", href: "/", enabled: true },
          { id: "articles", label: "文章", href: "/articles", enabled: true },
          { id: "hot", label: "今日热点", href: "/hot", enabled: true },
          { id: "projects", label: "项目", href: "/projects", enabled: true },
          { id: "tools", label: "工具中心", href: "/tools", enabled: true },
          { id: "about", label: "关于我", href: "/about", enabled: true }
        ]
  );
  const [webNavBuiltinToAdd, setWebNavBuiltinToAdd] = useState<"home" | "articles" | "hot" | "projects" | "tools" | "about">("home");
  const [switchMenuLayout, setSwitchMenuLayout] = useState<"arc" | "grid" | "dial" | "cmd">(props.cfg?.commandMenuLayout ?? "arc");
  const [switchMenuConfirmMode, setSwitchMenuConfirmMode] = useState<"enter" | "release">(props.cfg?.commandMenuConfirmMode ?? "enter");
  const [switchMenuMobileSync, setSwitchMenuMobileSync] = useState<boolean>(props.cfg?.commandMenuMobileSync ?? false);
  const [switchBindingsCount, setSwitchBindingsCount] = useState(0);
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
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

  const [hotRsshubUrl, setHotRsshubUrl] = useState("");
  const [hotRsshubFallbackUrls, setHotRsshubFallbackUrls] = useState("");
  const [hotSources, setHotSources] = useState<AdminHotSourceItem[]>([]);
  const [hotEditId, setHotEditId] = useState<string | null>(null);
  const [hotDraft, setHotDraft] = useState<Partial<AdminHotSourceItem> | null>(null);
  const [newHotSource, setNewHotSource] = useState<{
    slug: string;
    name: string;
    category: string;
    kind: HotSourceKind;
    routeOrUrl: string;
    icon: string;
    enabled: boolean;
  }>({
    slug: "",
    name: "",
    category: "技术",
    kind: "rsshub",
    routeOrUrl: "",
    icon: "",
    enabled: true
  });

  const [aboutTechStackJson, setAboutTechStackJson] = useState("");
  const [aboutVisitedPlacesJson, setAboutVisitedPlacesJson] = useState("");
  const [aboutTimelineJson, setAboutTimelineJson] = useState("");
  const [aboutSidebarDailyNewsEnabled, setAboutSidebarDailyNewsEnabled] = useState(true);
  const [aboutSidebarHistoryTodayEnabled, setAboutSidebarHistoryTodayEnabled] = useState(true);
  const [aboutSidebarTravelEnabled, setAboutSidebarTravelEnabled] = useState(true);
  const [formattingAboutJson, setFormattingAboutJson] = useState(false);
  const [newTool, setNewTool] = useState<{
    title: string;
    slug: string;
    groupKey: string;
    kind: ToolKind;
    url: string;
    description: string;
    clientCode: string;
    enabled: boolean;
  }>({
    title: "",
    slug: "",
    groupKey: "",
    kind: "link",
    url: "",
    description: "",
    clientCode: "",
    enabled: true
  });

  const toolGroupSuggestions = React.useMemo(() => {
    const s = new Set<string>();
    for (const t of tools) {
      const g = String((t as any)?.groupKey ?? "").trim();
      if (!g) continue;
      s.add(g);
    }
    if (toolDraft) {
      const g = String((toolDraft as any)?.groupKey ?? "").trim();
      if (g) s.add(g);
    }
    const ng = String(newTool.groupKey ?? "").trim();
    if (ng) s.add(ng);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [tools, toolDraft, newTool.groupKey]);

  const UI_STYLES: Array<{ value: UiStyle; label: string }> = [
    { value: "current", label: "current（默认）" },
    { value: "classic", label: "classic" },
    { value: "glass", label: "glass" },
    { value: "brutal", label: "brutal" },
    { value: "terminal", label: "terminal" }
  ];

  const refreshSwitchBindingsCount = () => {
    try {
      const raw = localStorage.getItem(SWITCH_MENU_BINDINGS_KEY);
      if (!raw) {
        setSwitchBindingsCount(0);
        return;
      }
      const v = JSON.parse(raw);
      const n = v && typeof v === "object" ? Object.keys(v).length : 0;
      setSwitchBindingsCount(n);
    } catch {
      setSwitchBindingsCount(0);
    }
  };

  useEffect(() => {
    refreshSwitchBindingsCount();
  }, []);

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

  function parseLooseBoolClient(v: string | null | undefined): boolean {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }

  async function formatAboutJson() {
    setFormattingAboutJson(true);
    try {
      setAboutTechStackJson((v) => formatJsonSync(v));
      setAboutVisitedPlacesJson((v) => formatJsonSync(v));
      setAboutTimelineJson((v) => formatJsonSync(v));
    } catch (e) {
      const msg = (e as any)?.message ? String((e as any).message) : "JSON 格式化失败";
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
    setFooterCopyrightUrl(props.cfg.footerCopyrightUrl ?? "");
    setFooterIcpText(props.cfg.footerIcpText ?? "");
    setFooterIcpLink(props.cfg.footerIcpLink ?? "https://beian.miit.gov.cn/");
    setWebStyle(props.cfg.webStyle ?? "current");
    setAdminStyle(props.cfg.adminStyle ?? "current");
    setSwitchMenuLayout(props.cfg.commandMenuLayout ?? "arc");
    setSwitchMenuConfirmMode(props.cfg.commandMenuConfirmMode ?? "enter");
    setSwitchMenuMobileSync(props.cfg.commandMenuMobileSync ?? false);
    if (props.cfg.webNav) setWebNav(props.cfg.webNav as any);
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
        const list = await listAdminHotSources();
        setHotSources(list);
      } catch {
        // ignore
      }
      try {
        const settings = await getAdminSettings([
          ABOUT_KEY_TECH_STACK,
          ABOUT_KEY_VISITED_PLACES,
          ABOUT_KEY_TIMELINE,
          ABOUT_KEY_SIDEBAR_DAILY_NEWS,
          ABOUT_KEY_SIDEBAR_HISTORY_TODAY,
          ABOUT_KEY_SIDEBAR_TRAVEL,
          POSTS_KEY_AUTO_SUMMARY,
          HOT_KEY_RSSHUB_URL,
          HOT_KEY_RSSHUB_FALLBACK_URLS
        ]);
        setAboutTechStackJson(settings[ABOUT_KEY_TECH_STACK] ?? "");
        setAboutVisitedPlacesJson(settings[ABOUT_KEY_VISITED_PLACES] ?? "");
        setAboutTimelineJson(settings[ABOUT_KEY_TIMELINE] ?? "");
        setAboutSidebarDailyNewsEnabled(
          settings[ABOUT_KEY_SIDEBAR_DAILY_NEWS] === null || settings[ABOUT_KEY_SIDEBAR_DAILY_NEWS] === undefined
            ? true
            : parseLooseBoolClient(settings[ABOUT_KEY_SIDEBAR_DAILY_NEWS])
        );
        setAboutSidebarHistoryTodayEnabled(
          settings[ABOUT_KEY_SIDEBAR_HISTORY_TODAY] === null || settings[ABOUT_KEY_SIDEBAR_HISTORY_TODAY] === undefined
            ? true
            : parseLooseBoolClient(settings[ABOUT_KEY_SIDEBAR_HISTORY_TODAY])
        );
        setAboutSidebarTravelEnabled(
          settings[ABOUT_KEY_SIDEBAR_TRAVEL] === null || settings[ABOUT_KEY_SIDEBAR_TRAVEL] === undefined
            ? true
            : parseLooseBoolClient(settings[ABOUT_KEY_SIDEBAR_TRAVEL])
        );
        const raw = String(settings[POSTS_KEY_AUTO_SUMMARY] ?? "").trim().toLowerCase();
        setAutoSummaryEnabled(raw === "1" || raw === "true" || raw === "yes" || raw === "on");
        setHotRsshubUrl(String(settings[HOT_KEY_RSSHUB_URL] ?? ""));
        setHotRsshubFallbackUrls(String(settings[HOT_KEY_RSSHUB_FALLBACK_URLS] ?? ""));
      } catch {
        // ignore
      }
    })();
  }, []);

  function openNotice(message: string, title = "提示") {
    setNotice({ title, message });
  }

  function defaultWebNav(): WebNavItem[] {
    return [
      { id: "home", label: "首页", href: "/", enabled: true },
      { id: "articles", label: "文章", href: "/articles", enabled: true },
      { id: "hot", label: "今日热点", href: "/hot", enabled: true },
      { id: "projects", label: "项目", href: "/projects", enabled: true },
      { id: "tools", label: "工具中心", href: "/tools", enabled: true },
      { id: "about", label: "关于我", href: "/about", enabled: true }
    ];
  }

  function isValidWebNavHref(href: string): boolean {
    const h = String(href ?? "").trim();
    if (!h) return false;
    if (h.startsWith("/")) return !h.startsWith("//");
    return /^https?:\/\//i.test(h);
  }

  function normalizeWebNav(items: WebNavItem[]): WebNavItem[] {
    const out: WebNavItem[] = [];
    const seen = new Set<string>();
    for (const it of items ?? []) {
      const id = String(it?.id ?? "").trim();
      const label = String(it?.label ?? "").trim();
      const href = String(it?.href ?? "").trim();
      if (!id || seen.has(id)) continue;
      if (!label) continue;
      if (!isValidWebNavHref(href)) continue;
      seen.add(id);
      out.push({
        id,
        label,
        href,
        enabled: it?.enabled === false ? false : true,
        external: /^https?:\/\//i.test(href) || it?.external === true ? true : false
      });
      if (out.length >= 24) break;
    }
    return out;
  }

  function validateWebNav(items: WebNavItem[]): string | null {
    const seen = new Set<string>();
    const list = items ?? [];
    if (list.length > 24) return "导航项最多 24 个";
    for (let i = 0; i < list.length; i++) {
      const it = list[i] as any;
      const id = String(it?.id ?? "").trim();
      const label = String(it?.label ?? "").trim();
      const href = String(it?.href ?? "").trim();
      if (!id) return `第 ${i + 1} 项：缺少 id`;
      if (seen.has(id)) return `存在重复 id：${id}`;
      seen.add(id);
      if (!label) return `第 ${i + 1} 项：标题不能为空`;
      if (!isValidWebNavHref(href)) return `第 ${i + 1} 项：链接不合法（需要以 / 开头或 http(s)://）`;
    }
    return null;
  }

  function setWebNavItem(idx: number, patch: Partial<WebNavItem>) {
    setWebNav((prev) => prev.map((it, i) => (i === idx ? ({ ...it, ...patch } as any) : it)));
  }

  function moveWebNavItem(idx: number, delta: number) {
    setWebNav((prev) => {
      const next = [...prev];
      const to = idx + delta;
      if (to < 0 || to >= next.length) return prev;
      const it = next[idx];
      if (!it) return prev;
      next.splice(idx, 1);
      next.splice(to, 0, it);
      return next;
    });
  }

  function removeWebNavItem(idx: number) {
    setWebNav((prev) => prev.filter((_, i) => i !== idx));
  }

  function addBuiltinWebNavItem(id: "home" | "articles" | "hot" | "projects" | "tools" | "about") {
    if (webNav.some((x) => x.id === id)) {
      openNotice(`已存在内置项：${id}`);
      return;
    }
    const it = defaultWebNav().find((x) => x.id === id);
    if (!it) return;
    setWebNav((prev) => [...prev, it]);
  }

  function addCustomWebNavItem() {
    const base = `custom:${Date.now()}`;
    let id = base;
    let n = 1;
    while (webNav.some((x) => x.id === id) && n < 50) {
      n++;
      id = `${base}:${n}`;
    }
    if (webNav.some((x) => x.id === id)) {
      openNotice("自定义 id 生成失败，请重试");
      return;
    }
    setWebNav((prev) => [...prev, { id, label: "自定义", href: "/", enabled: true }]);
  }

  async function saveWebNav() {
    props.onError("");
    setSaving(true);
    try {
      const invalid = validateWebNav(webNav);
      if (invalid) {
        props.onError(invalid);
        return;
      }
      const next = normalizeWebNav(webNav);
      if (next.length === 0) {
        props.onError("前台导航不能为空");
        return;
      }
      await updateSettings({ [UI_WEB_NAV_KEY]: next });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

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
        [ABOUT_KEY_TIMELINE]: aboutTimelineJson,
        [ABOUT_KEY_SIDEBAR_DAILY_NEWS]: aboutSidebarDailyNewsEnabled ? "1" : "0",
        [ABOUT_KEY_SIDEBAR_HISTORY_TODAY]: aboutSidebarHistoryTodayEnabled ? "1" : "0",
        [ABOUT_KEY_SIDEBAR_TRAVEL]: aboutSidebarTravelEnabled ? "1" : "0"
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function parseAllowlistHosts(input: string): string[] {
    return String(input ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((h) => h.replace(/^https?:\/\//, "").split("/")[0]!)
      .filter(Boolean);
  }

  async function saveUiStyles() {
    props.onError("");
    setSaving(true);
    try {
      await updateSettings({
        "ui.web_style": webStyle,
        "ui.admin_style": adminStyle
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      try {
        document.documentElement.setAttribute("data-ui-style", newCfg.adminStyle ?? "current");
        localStorage.setItem("ui-admin-style-last", newCfg.adminStyle ?? "current");
      } catch {
        // ignore
      }
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveSwitchMenuSettings() {
    props.onError("");
    setSaving(true);
    try {
      await updateSettings({
        [UI_COMMAND_MENU_LAYOUT_KEY]: switchMenuLayout,
        [UI_COMMAND_MENU_CONFIRM_MODE_KEY]: switchMenuConfirmMode,
        [UI_COMMAND_MENU_MOBILE_SYNC_KEY]: switchMenuMobileSync ? "1" : "0"
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveSiteCoreSettings() {
    props.onError("");
    setSaving(true);
    try {
      let nextBaseUrl = String(baseUrl ?? "").trim();
      if (!nextBaseUrl) {
        props.onError("站点域名（site.base_url）必填，例如：https://www.example.com");
        return;
      }
      if (!/^https?:\/\//i.test(nextBaseUrl)) {
        nextBaseUrl = `https://${nextBaseUrl}`;
        setBaseUrl(nextBaseUrl);
      }

      await updateSettings({
        "site.base_url": nextBaseUrl,
        "site.timezone": timezone,
        "site.cache_public_ttl_seconds": Number(cacheTtl),
        [POSTS_KEY_AUTO_SUMMARY]: autoSummaryEnabled ? "1" : "0"
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmbedAllowlist() {
    props.onError("");
    setSaving(true);
    try {
      const allowlistHosts = parseAllowlistHosts(embedAllowlist);
      await updateSettings({ "site.embed_allowlist": allowlistHosts });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function isValidHrefForFooter(s: string): boolean {
    const v = String(s ?? "").trim();
    if (!v) return true;
    return v.startsWith("/") || /^https?:\/\//i.test(v);
  }

  async function saveFooter() {
    props.onError("");
    setSaving(true);
    try {
      if (!isValidHrefForFooter(footerCopyrightUrl)) {
        props.onError("版权链接格式不正确：请输入以 https:// 开头的链接，或以 / 开头的站内路径。");
        return;
      }
      if (!isValidHrefForFooter(footerIcpLink)) {
        props.onError("ICP 链接格式不正确：请输入以 https:// 开头的链接，或以 / 开头的站内路径。");
        return;
      }
      await updateSettings({
        "site.footer_copyright_url": footerCopyrightUrl,
        "site.footer_icp_text": footerIcpText,
        "site.footer_icp_link": footerIcpLink
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
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
      openNotice("已保存（cache_version 已递增）");
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
      groupKey: String((toolDraft as any).groupKey ?? "").trim(),
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
      props.onError("请填写 标题 / 路径标识");
      return;
    }
    setSaving(true);
    try {
      await createAdminTool({
        title: newTool.title.trim(),
        slug: newTool.slug.trim(),
        groupKey: newTool.groupKey.trim() ? newTool.groupKey.trim() : undefined,
        kind: newTool.kind,
        url: newTool.url.trim() ? newTool.url.trim() : null,
        description: newTool.description.trim(),
        clientCode: newTool.clientCode.trim() ? newTool.clientCode.trim() : null,
        enabled: !!newTool.enabled
      });
      setNewTool({
        title: "",
        slug: "",
        groupKey: "",
        kind: "link",
        url: "",
        description: "",
        clientCode: "",
        enabled: true
      });
      await refreshTools();
      openNotice("已新增（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "新增失败");
    } finally {
      setSaving(false);
    }
  }

  async function refreshHotSources() {
    const list = await listAdminHotSources();
    setHotSources(list);
  }

  async function saveHotSettings() {
    props.onError("");
    setSaving(true);
    try {
      await updateSettings({
        [HOT_KEY_RSSHUB_URL]: String(hotRsshubUrl ?? "").trim(),
        [HOT_KEY_RSSHUB_FALLBACK_URLS]: String(hotRsshubFallbackUrls ?? "").trim()
      });
      const newCfg = await getConfig();
      props.onCfg(newCfg);
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function startEditHotSource(s: AdminHotSourceItem) {
    setHotEditId(s.id);
    setHotDraft({ ...s });
  }

  function cancelEditHotSource() {
    setHotEditId(null);
    setHotDraft(null);
  }

  async function saveHotDraft() {
    if (!hotEditId || !hotDraft) return;
    props.onError("");
    setSaving(true);
    try {
      await updateAdminHotSource(hotEditId, {
        slug: hotDraft.slug,
        name: hotDraft.name,
        category: hotDraft.category,
        kind: hotDraft.kind as any,
        routeOrUrl: (hotDraft as any).routeOrUrl,
        icon: hotDraft.icon ?? null,
        enabled: !!hotDraft.enabled
      });
      cancelEditHotSource();
      await refreshHotSources();
      openNotice("已保存（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleHotEnabled(s: AdminHotSourceItem) {
    props.onError("");
    setSaving(true);
    try {
      await updateAdminHotSource(s.id, { enabled: !s.enabled });
      await refreshHotSources();
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "更新失败");
    } finally {
      setSaving(false);
    }
  }

  async function moveHotSource(id: string, dir: -1 | 1) {
    const idx = hotSources.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= hotSources.length) return;
    const copy = hotSources.slice();
    const [it] = copy.splice(idx, 1);
    copy.splice(next, 0, it!);
    setHotSources(copy);
    await reorderAdminHotSources(copy.map((x) => x.id));
    await refreshHotSources();
  }

  async function removeHotSource(id: string) {
    if (!confirm("确定删除这个热点渠道吗？")) return;
    props.onError("");
    setSaving(true);
    try {
      await deleteAdminHotSource(id);
      await refreshHotSources();
      openNotice("已删除（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "删除失败");
    } finally {
      setSaving(false);
    }
  }

  async function addHotSource() {
    props.onError("");
    setSaving(true);
    try {
      await createAdminHotSource({
        slug: newHotSource.slug.trim(),
        name: newHotSource.name.trim(),
        category: newHotSource.category.trim(),
        kind: newHotSource.kind,
        routeOrUrl: newHotSource.routeOrUrl.trim(),
        icon: newHotSource.icon.trim() ? newHotSource.icon.trim() : null,
        enabled: !!newHotSource.enabled
      });
      setNewHotSource({
        slug: "",
        name: "",
        category: "技术",
        kind: "rsshub",
        routeOrUrl: "",
        icon: "",
        enabled: true
      });
      await refreshHotSources();
      openNotice("已新增（cache_version 已递增）");
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "新增失败");
    } finally {
      setSaving(false);
    }
  }

  const section = props.section ?? null;
  const showOverview = section === null;
  const showSite = section === "site";
  const showProjects = section === "projects";
  const showTools = section === "tools";
  const showHot = section === "hot";
  const showAbout = section === "about";

  return (
    <div>
      <NoticeDialog
        open={!!notice}
        title={notice?.title ?? "提示"}
        message={notice?.message ?? ""}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
      />
      <div className="nav" style={{ marginBottom: 12 }}>
        <a className={`chip ${showOverview ? "active" : ""}`} href="#/settings">
          概览
        </a>
        <a className={`chip ${showSite ? "active" : ""}`} href="#/settings/site">
          站点配置
        </a>
        <a className={`chip ${showProjects ? "active" : ""}`} href="#/settings/projects">
          项目
        </a>
        <a className={`chip ${showTools ? "active" : ""}`} href="#/settings/tools">
          工具
        </a>
        <a className={`chip ${showHot ? "active" : ""}`} href="#/settings/hot">
          今日热点
        </a>
        <a className={`chip ${showAbout ? "active" : ""}`} href="#/settings/about">
          关于
        </a>
      </div>

      <div className="grid">
        {showOverview ? (
          <div className="card">
            <h2 style={{ margin: "0 0 8px" }}>设置</h2>
            <div className="muted">这里把内容拆成 5 个页面，避免在一个页面里滚太长。</div>
            <div style={{ height: 12 }} />
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <a className="embed-card" href="#/settings/site" style={{ ["--embed-accent" as any]: "#ff2d55" }}>
                <div className="embed-card__row">
                  <div className="embed-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16v16H4z" />
                      <path d="M8 12h8" />
                      <path d="M8 8h5" />
                      <path d="M8 16h6" />
                    </svg>
                  </div>
                  <div className="embed-card__main">
                    <div className="embed-card__title">站点配置</div>
                    <div className="embed-card__desc">域名 / 时区 / UI 风格 / Footer / Allowlist 等</div>
                  </div>
                  <div className="embed-card__badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </a>
              <a className="embed-card" href="#/settings/projects" style={{ ["--embed-accent" as any]: "#4b6bff" }}>
                <div className="embed-card__row">
                  <div className="embed-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7h8v10H3z" />
                      <path d="M13 7h8v10h-8z" />
                      <path d="M6 10h2" />
                      <path d="M16 14h2" />
                    </svg>
                  </div>
                  <div className="embed-card__main">
                    <div className="embed-card__title">项目</div>
                    <div className="embed-card__desc">GitHub / Gitee 相关设置与展示</div>
                  </div>
                  <div className="embed-card__badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </a>
              <a className="embed-card" href="#/settings/tools" style={{ ["--embed-accent" as any]: "#22c55e" }}>
                <div className="embed-card__row">
                  <div className="embed-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <div className="embed-card__main">
                    <div className="embed-card__title">工具</div>
                    <div className="embed-card__desc">工具中心：分组 / 链接 / 客户端代码</div>
                  </div>
                  <div className="embed-card__badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </a>
              <a className="embed-card" href="#/settings/hot" style={{ ["--embed-accent" as any]: "#f97316" }}>
                <div className="embed-card__row">
                  <div className="embed-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2s3 3 3 6a3 3 0 0 1-6 0c0-3 3-6 3-6z" />
                      <path d="M6 13a6 6 0 0 0 12 0c0-2-1-4-3-6" />
                    </svg>
                  </div>
                  <div className="embed-card__main">
                    <div className="embed-card__title">今日热点</div>
                    <div className="embed-card__desc">RSSHub 配置 + 热点渠道管理</div>
                  </div>
                  <div className="embed-card__badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </a>
              <a className="embed-card" href="#/settings/about" style={{ ["--embed-accent" as any]: "#f59e0b" }}>
                <div className="embed-card__row">
                  <div className="embed-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c2-4 6-6 8-6s6 2 8 6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="embed-card__main">
                    <div className="embed-card__title">关于</div>
                    <div className="embed-card__desc">关于页：技能 / 足迹 / 经历 + 侧边栏开关</div>
                  </div>
                  <div className="embed-card__badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </a>
            </div>
          </div>
        ) : null}

        {showSite ? (
          <div className="settings-grid">
          <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>1. 站点设置</h2>
        <div className="muted">提示：保存会触发缓存软失效。</div>
        <div style={{ height: 12 }} />
        <h3 style={{ margin: "6px 0 4px" }}>基础</h3>
        <div className="row">
          <label>
            站点域名（必填）
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://example.com" />
          </label>
          <label>
            时区
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Shanghai"
              list="timezone-list"
            />
            <datalist id="timezone-list">
              <option value="Asia/Shanghai" />
              <option value="UTC" />
              <option value="Asia/Tokyo" />
              <option value="America/Los_Angeles" />
              <option value="America/New_York" />
              <option value="Europe/London" />
            </datalist>
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            缓存 TTL（秒，1-3600）
            <input value={cacheTtl} onChange={(e) => setCacheTtl(e.target.value)} />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            自动生成摘要（摘要为空时自动从正文截取前 150 字）
            <SelectBox
              value={autoSummaryEnabled ? "1" : "0"}
              options={[
                { value: "1", label: "启用" },
                { value: "0", label: "关闭" }
              ]}
              onChange={(v) => setAutoSummaryEnabled(v === "1")}
            />
          </label>
        </div>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveSiteCoreSettings()} disabled={saving}>
            {saving ? "保存中..." : "保存基础设置"}
          </button>
        </div>
        <div style={{ height: 16 }} />
        <h3 style={{ margin: "6px 0 4px" }}>UI 风格</h3>
        <div className="row">
          <label>
            Web 风格
            <SelectBox
              value={webStyle}
              options={UI_STYLES.map((s) => ({ value: s.value, label: s.label }))}
              onChange={(v) => setWebStyle(v as UiStyle)}
            />
          </label>
          <label>
            Admin 风格
            <SelectBox
              value={adminStyle}
              options={UI_STYLES.map((s) => ({ value: s.value, label: s.label }))}
              onChange={(v) => setAdminStyle(v as UiStyle)}
            />
          </label>
        </div>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveUiStyles()} disabled={saving}>
            {saving ? "保存中..." : "保存 UI 风格"}
          </button>
        </div>
        <div style={{ height: 16 }} />
        <h3 style={{ margin: "6px 0 4px" }}>前台导航</h3>
        <div className="muted">控制前台顶部导航 + 快捷键菜单（Alt + `）。支持隐藏/显示、调整顺序、添加/删除自定义项。</div>
        <div style={{ height: 10 }} />
        <div className="nav" style={{ flexWrap: "wrap", gap: 10 }}>
          <button className="chip" type="button" onClick={() => addCustomWebNavItem()} disabled={saving}>
            + 自定义
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              添加内置
            </span>
            <SelectBox
              value={webNavBuiltinToAdd}
              options={[
                { value: "home", label: "首页" },
                { value: "articles", label: "文章" },
                { value: "hot", label: "今日热点" },
                { value: "projects", label: "项目" },
                { value: "tools", label: "工具中心" },
                { value: "about", label: "关于我" }
              ]}
              onChange={(v) =>
                setWebNavBuiltinToAdd(
                  v === "articles" || v === "hot" || v === "projects" || v === "tools" || v === "about" ? v : "home"
                )
              }
            />
          </label>
          <button className="chip" type="button" onClick={() => addBuiltinWebNavItem(webNavBuiltinToAdd)} disabled={saving}>
            添加
          </button>
          <button className="chip" type="button" onClick={() => setWebNav(defaultWebNav())} disabled={saving}>
            重置默认
          </button>
          <button className="chip chip-primary" type="button" onClick={() => void saveWebNav()} disabled={saving}>
            {saving ? "保存中..." : "保存导航"}
          </button>
        </div>
        <div style={{ height: 10 }} />
        <div className="grid" style={{ gap: 10 }}>
          {webNav.map((it, idx) => {
            const hrefOk = isValidWebNavHref(it.href);
            const external = /^https?:\/\//i.test(String(it.href || "").trim());
            return (
              <div key={`${it.id}:${idx}`} className="card" style={{ padding: 12, background: "rgba(255,255,255,0.02)" }}>
                <div className="nav" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div className="nav">
                    <button className="chip" type="button" onClick={() => moveWebNavItem(idx, -1)} disabled={idx === 0 || saving} title="上移">
                      ↑
                    </button>
                    <button
                      className="chip"
                      type="button"
                      onClick={() => moveWebNavItem(idx, 1)}
                      disabled={idx >= webNav.length - 1 || saving}
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      className={`chip ${it.enabled ? "chip-primary" : ""}`}
                      type="button"
                      onClick={() => setWebNavItem(idx, { enabled: !it.enabled })}
                      disabled={saving}
                    >
                      {it.enabled ? "显示" : "隐藏"}
                    </button>
                  </div>
                  <div className="nav">
                    <span className="muted" style={{ alignSelf: "center" }}>
                      {it.id}
                      {external ? "（外链）" : ""}
                    </span>
                    <button
                      className="chip"
                      type="button"
                      onClick={() => {
                        if (!confirm("确定删除这个导航项吗？")) return;
                        removeWebNavItem(idx);
                      }}
                      disabled={saving}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div style={{ height: 10 }} />
                <div className="row">
                  <label>
                    标题
                    <input value={it.label} onChange={(e) => setWebNavItem(idx, { label: e.target.value })} disabled={saving} />
                  </label>
                  <label>
                    链接
                    <input
                      value={it.href}
                      onChange={(e) => setWebNavItem(idx, { href: e.target.value })}
                      disabled={saving}
                      placeholder="/about 或 https://example.com"
                    />
                  </label>
                </div>
                {!hrefOk ? (
                  <div className="muted" style={{ marginTop: 8, color: "rgba(239, 68, 68, 0.9)" }}>
                    链接不合法：需要以 / 开头（站内）或 http(s)://（外链）
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div style={{ height: 16 }} />
        <h3 style={{ margin: "6px 0 4px" }}>快捷菜单</h3>
        <div className="row">
          <label>
            菜单布局
            <SelectBox
              value={switchMenuLayout}
              options={[
                { value: "arc", label: "弧形滚轮" },
                { value: "grid", label: "竖排两列" },
                { value: "dial", label: "圆盘" },
                { value: "cmd", label: "命令行" }
              ]}
              onChange={(v) => setSwitchMenuLayout(v === "grid" || v === "dial" || v === "cmd" ? v : "arc")}
            />
          </label>
          <label>
            确认模式
            <SelectBox
              value={switchMenuConfirmMode}
              options={[
                { value: "enter", label: "Enter 确认" },
                { value: "release", label: "松开确认" }
              ]}
              onChange={(v) => setSwitchMenuConfirmMode(v === "release" ? "release" : "enter")}
            />
          </label>
          <label>
            呼出快捷键
            <input value={"Alt + ` / ?"} readOnly className="input" style={{ opacity: 0.85 }} />
          </label>
        </div>
        <div style={{ height: 8 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={switchMenuMobileSync}
            onChange={(e) => setSwitchMenuMobileSync(e.target.checked)}
          />
          <span>移动端同步菜单样式（未勾选时移动端固定为命令行菜单）</span>
        </label>
        <div className="nav">
          <button className="chip chip-primary" type="button" onClick={() => void saveSwitchMenuSettings()} disabled={saving}>
            {saving ? "保存中..." : "保存菜单设置"}
          </button>
          <button
            className="chip"
            type="button"
            onClick={() => {
              if (!confirm("确定清空快捷菜单的页面绑定吗？")) return;
              try {
                localStorage.removeItem(SWITCH_MENU_BINDINGS_KEY);
              } catch {
                // ignore
              }
              refreshSwitchBindingsCount();
              openNotice("已清空绑定");
            }}
          >
            清空绑定
          </button>
          <span className="muted" style={{ alignSelf: "center" }}>
            已绑定 {switchBindingsCount} 个
          </span>
        </div>

        <div style={{ height: 16 }} />
        <label>
          <h3 style={{ margin: "6px 0 4px" }}>嵌入域名白名单</h3>
          嵌入域名白名单（每行一个；留空=禁用）
          <textarea
            value={embedAllowlist}
            onChange={(e) => setEmbedAllowlist(e.target.value)}
            placeholder={"github.com\nwww.youtube.com\nplayer.bilibili.com"}
          />
        </label>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveEmbedAllowlist()} disabled={saving}>
            {saving ? "保存中..." : "保存白名单"}
          </button>
        </div>
        <div style={{ height: 16 }} />
        <h3 style={{ margin: "6px 0 4px" }}>底部（Footer）</h3>
        <div className="muted">所有公共页面底部展示：版权信息 + Sitemap/RSS + ICP 备案（可配置）。</div>
        <div style={{ height: 12 }} />
        <div className="row">
          <label>
            版权链接（可选）
            <input
              value={footerCopyrightUrl}
              onChange={(e) => setFooterCopyrightUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <label>
            ICP 备案号（可选）
            <input value={footerIcpText} onChange={(e) => setFooterIcpText(e.target.value)} placeholder="冀ICP备2023042333号-1" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            ICP 链接（可选）
            <input
              value={footerIcpLink}
              onChange={(e) => setFooterIcpLink(e.target.value)}
              placeholder="https://beian.miit.gov.cn/"
            />
          </label>
        </div>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveFooter()} disabled={saving}>
            {saving ? "保存中..." : "保存底部"}
          </button>
        </div>
      </div>
      </div>
        ) : null}

        {showProjects ? (
      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>2. 项目页（GitHub / Gitee）</h2>
        <div className="muted">只在服务端保存 Token，不会暴露给访客浏览器。</div>
        <div style={{ height: 12 }} />
        <div className="row">
          <label>
            GitHub 启用
            <SelectBox
              value={ghEnabled ? "1" : "0"}
              options={[
                { value: "1", label: "启用" },
                { value: "0", label: "禁用" }
              ]}
              onChange={(v) => setGhEnabled(v === "1")}
            />
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
            <SelectBox
              value={ghClearToken ? "1" : "0"}
              options={[
                { value: "0", label: "不清空" },
                { value: "1", label: "清空 Token" }
              ]}
              onChange={(v) => setGhClearToken(v === "1")}
            />
          </label>
        </div>

        <div style={{ height: 14 }} />
        <div className="row">
          <label>
            Gitee 启用
            <SelectBox
              value={gtEnabled ? "1" : "0"}
              options={[
                { value: "1", label: "启用" },
                { value: "0", label: "禁用" }
              ]}
              onChange={(v) => setGtEnabled(v === "1")}
            />
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
            <SelectBox
              value={gtClearToken ? "1" : "0"}
              options={[
                { value: "0", label: "不清空" },
                { value: "1", label: "清空 Token" }
              ]}
              onChange={(v) => setGtClearToken(v === "1")}
            />
          </label>
        </div>

        <div style={{ height: 14 }} />
        <div className="row">
          <label>
            展示 fork
            <SelectBox
              value={includeForks ? "1" : "0"}
              options={[
                { value: "0", label: "不展示" },
                { value: "1", label: "展示" }
              ]}
              onChange={(v) => setIncludeForks(v === "1")}
            />
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
        ) : null}

        {showTools ? (
      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>3. 工具中心（访客可见）</h2>
        <div className="muted">支持启用/禁用、拖动排序（↑↓）、新增/编辑/删除；保存会触发 cache_version 递增。</div>
        <div style={{ height: 12 }} />
        <datalist id="tool-group-suggest">
          {toolGroupSuggestions.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

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
                      标题
                      <input
                        value={String(toolDraft.title ?? "")}
                        onChange={(e) => setToolDraft({ ...toolDraft, title: e.target.value })}
                      />
                    </label>
                    <label>
                      路径标识
                      <input
                        value={String(toolDraft.slug ?? "")}
                        onChange={(e) => setToolDraft({ ...toolDraft, slug: e.target.value })}
                      />
                    </label>
                  </div>
                  <div style={{ height: 10 }} />
                  <div className="row">
                    <label>
                      分组
                      <input
                        value={String((toolDraft as any).groupKey ?? "")}
                        onChange={(e) => setToolDraft({ ...toolDraft, groupKey: e.target.value } as any)}
                        onBlur={(e) => setToolDraft({ ...toolDraft, groupKey: e.target.value.trim() } as any)}
                        placeholder="输入分组（可自定义）"
                        list="tool-group-suggest"
                      />
                    </label>
                    <label>
                      类型
                      <SelectBox
                        value={String(toolDraft.kind ?? "link")}
                        options={[
                          { value: "link", label: "外链（link）" },
                          { value: "page", label: "站内页（page）" }
                        ]}
                        onChange={(v) => setToolDraft({ ...toolDraft, kind: v as ToolKind })}
                      />
                    </label>
                  </div>
                  <div style={{ height: 10 }} />
                  <label>
                    链接/路径（外链=完整 URL；站内页=/tools/...）
                    <input
                      value={String(toolDraft.url ?? "")}
                      onChange={(e) => setToolDraft({ ...toolDraft, url: e.target.value })}
                      placeholder="https://... 或 /tools/snake"
                    />
                  </label>
                  <label>
                    描述
                    <textarea
                      value={String(toolDraft.description ?? "")}
                      onChange={(e) => setToolDraft({ ...toolDraft, description: e.target.value })}
                      style={{ minHeight: 80 }}
                    />
                  </label>
                  {toolDraft.kind === "page" ? (
                    <div>
                      <div style={{ fontWeight: 700 }}>客户端代码 JS（kind=page 时生效，运行在 #tool-root 内）</div>
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
                    </div>
                  ) : null}
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
            标题
            <input value={newTool.title} onChange={(e) => setNewTool({ ...newTool, title: e.target.value })} />
          </label>
          <label>
            路径标识
            <input
              value={newTool.slug}
              onChange={(e) => setNewTool({ ...newTool, slug: e.target.value })}
              placeholder="snake / api-tester"
            />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            分组
            <input
              value={newTool.groupKey}
              onChange={(e) => setNewTool({ ...newTool, groupKey: e.target.value })}
              onBlur={(e) => setNewTool({ ...newTool, groupKey: e.target.value.trim() })}
              placeholder="输入分组（可自定义）"
              list="tool-group-suggest"
            />
          </label>
          <label>
            类型
            <SelectBox
              value={newTool.kind}
              options={[
                { value: "link", label: "外链（link）" },
                { value: "page", label: "站内页（page）" }
              ]}
              onChange={(v) => setNewTool({ ...newTool, kind: v as ToolKind })}
            />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <label>
          链接/路径（可空）
          <input
            value={newTool.url}
            onChange={(e) => setNewTool({ ...newTool, url: e.target.value })}
            placeholder="https://... 或 /tools/xxx"
          />
        </label>
        <label>
          描述（可空）
          <textarea value={newTool.description} onChange={(e) => setNewTool({ ...newTool, description: e.target.value })} style={{ minHeight: 80 }} />
        </label>
        {newTool.kind === "page" ? (
          <div>
            <div style={{ fontWeight: 700 }}>客户端代码 JS（kind=page 时生效，运行在 #tool-root 内）</div>
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
          </div>
        ) : null}
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void addTool()} disabled={saving}>
            {saving ? "新增中..." : "新增"}
          </button>
        </div>
      </div>
        ) : null}

        {showHot ? (
      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>4. 今日热点（/hot）</h2>
        <div className="muted">热点抓取/解析在 API Worker；前台 /hot 页面通过 JSON 渲染。</div>
        <div style={{ height: 12 }} />

        <h3 style={{ margin: "6px 0 4px" }}>RSSHub 配置</h3>
        <div className="row">
          <label>
            RSSHub URL（主实例）
            <input value={hotRsshubUrl} onChange={(e) => setHotRsshubUrl(e.target.value)} placeholder="https://rsshub.example.com" />
          </label>
          <label>
            RSSHub Fallback URLs（逗号分隔，可空）
            <input
              value={hotRsshubFallbackUrls}
              onChange={(e) => setHotRsshubFallbackUrls(e.target.value)}
              placeholder="https://rsshub.a.com,https://rsshub.b.com"
            />
          </label>
        </div>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void saveHotSettings()} disabled={saving}>
            {saving ? "保存中..." : "保存 RSSHub 配置"}
          </button>
        </div>

        <div style={{ height: 16 }} />
        <h3 style={{ margin: "0 0 8px" }}>热点渠道（源）</h3>
        <div className="muted">支持启用/禁用、调整顺序（↑↓）、新增/编辑/删除。</div>
        <div style={{ height: 12 }} />

        <div className="grid" style={{ gap: 10 }}>
          {hotSources.map((s) => (
            <div key={s.id} className="card" style={{ padding: 12, background: "rgba(255,255,255,0.02)" }}>
              <div className="nav" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div className="nav">
                  <button className="chip" onClick={() => void moveHotSource(s.id, -1)} title="上移">
                    ↑
                  </button>
                  <button className="chip" onClick={() => void moveHotSource(s.id, 1)} title="下移">
                    ↓
                  </button>
                  <button className={`chip ${s.enabled ? "chip-primary" : ""}`} onClick={() => void toggleHotEnabled(s)}>
                    {s.enabled ? "已启用" : "已禁用"}
                  </button>
                </div>
                <div className="nav">
                  <button className="chip" onClick={() => startEditHotSource(s)}>
                    编辑
                  </button>
                  <button className="chip" onClick={() => void removeHotSource(s.id)}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ fontWeight: 800 }}>{s.name}</div>
              <div className="muted">
                {s.slug} · {s.category} · {s.kind} · {s.routeOrUrl}
              </div>

              {hotEditId === s.id && hotDraft ? (
                <div style={{ marginTop: 12 }}>
                  <div className="row">
                    <label>
                      名称
                      <input value={String(hotDraft.name ?? "")} onChange={(e) => setHotDraft({ ...hotDraft, name: e.target.value })} />
                    </label>
                    <label>
                      slug
                      <input value={String(hotDraft.slug ?? "")} onChange={(e) => setHotDraft({ ...hotDraft, slug: e.target.value })} />
                    </label>
                  </div>
                  <div style={{ height: 10 }} />
                  <div className="row">
                    <label>
                      分类
                      <input value={String(hotDraft.category ?? "")} onChange={(e) => setHotDraft({ ...hotDraft, category: e.target.value })} />
                    </label>
                    <label>
                      类型
                      <SelectBox
                        value={String(hotDraft.kind ?? "rsshub")}
                        options={[
                          { value: "rsshub", label: "RSSHub route" },
                          { value: "rss", label: "RSS URL" }
                        ]}
                        onChange={(v) => setHotDraft({ ...hotDraft, kind: v as HotSourceKind })}
                      />
                    </label>
                  </div>
                  <div style={{ height: 10 }} />
                  <label>
                    route / url
                    <input
                      value={String((hotDraft as any).routeOrUrl ?? "")}
                      onChange={(e) => setHotDraft({ ...hotDraft, routeOrUrl: e.target.value } as any)}
                      placeholder={hotDraft.kind === "rss" ? "https://..." : "/v2ex/topics/hot"}
                    />
                  </label>
                  <label>
                    icon（可空）
                    <input value={String(hotDraft.icon ?? "")} onChange={(e) => setHotDraft({ ...hotDraft, icon: e.target.value })} placeholder="https://..." />
                  </label>
                  <div className="nav">
                    <button className="chip chip-primary" onClick={() => void saveHotDraft()} disabled={saving}>
                      保存
                    </button>
                    <button className="chip" onClick={() => cancelEditHotSource()} disabled={saving}>
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ height: 14 }} />
        <h3 style={{ margin: "0 0 8px" }}>新增渠道</h3>
        <div className="row">
          <label>
            名称
            <input value={newHotSource.name} onChange={(e) => setNewHotSource({ ...newHotSource, name: e.target.value })} />
          </label>
          <label>
            slug
            <input value={newHotSource.slug} onChange={(e) => setNewHotSource({ ...newHotSource, slug: e.target.value })} placeholder="v2ex / hackernews" />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="row">
          <label>
            分类
            <input value={newHotSource.category} onChange={(e) => setNewHotSource({ ...newHotSource, category: e.target.value })} placeholder="技术" />
          </label>
          <label>
            类型
            <SelectBox
              value={newHotSource.kind}
              options={[
                { value: "rsshub", label: "RSSHub route" },
                { value: "rss", label: "RSS URL" }
              ]}
              onChange={(v) => setNewHotSource({ ...newHotSource, kind: v as HotSourceKind })}
            />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <label>
          route / url
          <input
            value={newHotSource.routeOrUrl}
            onChange={(e) => setNewHotSource({ ...newHotSource, routeOrUrl: e.target.value })}
            placeholder={newHotSource.kind === "rss" ? "https://..." : "/hackernews/best"}
          />
        </label>
        <label>
          icon（可空）
          <input value={newHotSource.icon} onChange={(e) => setNewHotSource({ ...newHotSource, icon: e.target.value })} placeholder="https://..." />
        </label>
        <div className="row">
          <label>
            启用
            <SelectBox
              value={newHotSource.enabled ? "1" : "0"}
              options={[
                { value: "1", label: "启用" },
                { value: "0", label: "禁用" }
              ]}
              onChange={(v) => setNewHotSource({ ...newHotSource, enabled: v === "1" })}
            />
          </label>
        </div>
        <div className="nav">
          <button className="chip chip-primary" onClick={() => void addHotSource()} disabled={saving}>
            {saving ? "新增中..." : "新增"}
          </button>
        </div>
      </div>
        ) : null}

        {showAbout ? (
      <div className="card">
        <h2 style={{ margin: "0 0 8px" }}>5. 关于页配置（/about）</h2>
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

        <div className="row">
          <label>
            侧边栏：每日新闻
            <SelectBox
              value={aboutSidebarDailyNewsEnabled ? "1" : "0"}
              options={[
                { value: "1", label: "开启" },
                { value: "0", label: "关闭" }
              ]}
              onChange={(v) => setAboutSidebarDailyNewsEnabled(v === "1")}
            />
          </label>
          <label>
            侧边栏：历史上的今日
            <SelectBox
              value={aboutSidebarHistoryTodayEnabled ? "1" : "0"}
              options={[
                { value: "1", label: "开启" },
                { value: "0", label: "关闭" }
              ]}
              onChange={(v) => setAboutSidebarHistoryTodayEnabled(v === "1")}
            />
          </label>
          <label>
            侧边栏：旅行足迹
            <SelectBox
              value={aboutSidebarTravelEnabled ? "1" : "0"}
              options={[
                { value: "1", label: "开启" },
                { value: "0", label: "关闭" }
              ]}
              onChange={(v) => setAboutSidebarTravelEnabled(v === "1")}
            />
          </label>
        </div>

        <AboutSkillsEditor value={aboutTechStackJson} onChange={(v) => setAboutTechStackJson(v)} />
        <div style={{ height: 16 }} />
        <AboutVisitedPlacesEditor value={aboutVisitedPlacesJson} onChange={(v) => setAboutVisitedPlacesJson(v)} />
        <div style={{ height: 16 }} />
        <AboutExperienceEditor value={aboutTimelineJson} onChange={(v) => setAboutTimelineJson(v)} />

        <details style={{ marginTop: 12 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            高级：JSON
          </summary>

        <label>
          <div style={{ fontWeight: 700 }}>技能专长（JSON）</div>
          <CodeEditor
            value={aboutTechStackJson}
            onChange={(v) => setAboutTechStackJson(v)}
            onSave={() => void saveAbout()}
            placeholder={`[\n  {\n    \"title\": \"前端开发\",\n    \"description\": \"精通现代前端技术栈，擅长构建高性能 Web 应用。\",\n    \"tags\": [\"React\", \"Vue\", \"TypeScript\"],\n    \"icon\": \"frontend\"\n  },\n  {\n    \"title\": \"UI/UX 设计\",\n    \"description\": \"注重用户体验，擅长将设计理念转化为界面实现。\",\n    \"tags\": [\"Figma\", \"Tailwind\", \"CSS\"],\n    \"icon\": \"design\"\n  }\n]\n\n// 兼容写法：也支持 items 字段\n// { \"title\": \"Backend\", \"items\": [\"Hono\", \"SQLite\"] }`}
          />
        </label>

        <div style={{ height: 10 }} />
        <label>
          <div style={{ fontWeight: 700 }}>旅行足迹（地点列表 JSON）</div>
          <CodeEditor
            value={aboutVisitedPlacesJson}
            onChange={(v) => setAboutVisitedPlacesJson(v)}
            onSave={() => void saveAbout()}
            placeholder={`[\n  \"中国-北京\",\n  \"中国-广东\"\n]`}
          />
        </label>

        <div style={{ height: 10 }} />
        <label>
          <div style={{ fontWeight: 700 }}>工作经历（JSON）</div>
          <CodeEditor
            value={aboutTimelineJson}
            onChange={(v) => setAboutTimelineJson(v)}
            onSave={() => void saveAbout()}
            placeholder={`[\n  {\n    \"date\": \"2023 - 至今\",\n    \"title\": \"高级前端工程师\",\n    \"company\": \"某科技公司\",\n    \"description\": \"负责核心产品的前端架构设计与开发，带领团队完成多个重要项目。\"\n  },\n  {\n    \"date\": \"2021 - 2023\",\n    \"title\": \"前端工程师\",\n    \"company\": \"某互联网公司\",\n    \"description\": \"参与多个 Web 应用的开发，积累了丰富的前端开发经验。\"\n  }\n]`}
          />
        </label>
        </details>
      </div>
        ) : null}
    </div>
    </div>
  );
}
