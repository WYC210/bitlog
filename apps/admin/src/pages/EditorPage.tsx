import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AdminPostDetail, AdminPrefs, ApiError, PublicCategory, PublicTag, SiteConfig } from "../api";
import {
  createAdminPost,
  getAdminPost,
  listPublicCategories,
  listPublicTags,
  renderAdminMarkdown,
  updateAdminPost,
  updateAdminPrefs,
  uploadAdminImage
} from "../api";
import { utcMsToZonedInput, zonedInputToUtcMs } from "../tz";
import type { MarkdownEditorHandle } from "../components/MarkdownEditor";
import { MarkdownEditor } from "../components/MarkdownEditor";

export function EditorPage(props: {
  id: string | "new";
  cfg: SiteConfig | null;
  prefs: AdminPrefs | null;
  onPrefs: (p: AdminPrefs | null) => void;
  onError: (m: string) => void;
}) {
  type ToolboxDock = "left" | "top";
  const TOOLBOX_DOCK_KEY = "bitlog_admin_editor_toolbox_dock";

  const isNew = props.id === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [id, setId] = useState<string | null>(isNew ? null : (props.id as string));
  const [slug, setSlug] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("# 标题\n\n正文...");
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("draft");
  const [publishAtLocal, setPublishAtLocal] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const editorCardRef = useRef<HTMLDivElement | null>(null);

  const [layout, setLayout] = useState<AdminPrefs["editorLayout"]>(props.prefs?.editorLayout ?? "split");
  const [markdownFocused, setMarkdownFocused] = useState(false);
  const sidebarPrevRef = useRef<"collapsed" | "expanded" | null>(null);

  const [toolboxDock, setToolboxDock] = useState<ToolboxDock>(() => {
    if (typeof window === "undefined") return "left";
    const v = window.localStorage.getItem(TOOLBOX_DOCK_KEY);
    return v === "top" ? "top" : "left";
  });
  const [toolboxDragging, setToolboxDragging] = useState(false);
  const [toolboxDragTarget, setToolboxDragTarget] = useState<ToolboxDock>(() => {
    if (typeof window === "undefined") return "left";
    const v = window.localStorage.getItem(TOOLBOX_DOCK_KEY);
    return v === "top" ? "top" : "left";
  });
  const toolboxDragTargetRef = useRef<ToolboxDock>(toolboxDragTarget);
  const toolboxPointerIdRef = useRef<number | null>(null);
  const toolboxRailRef = useRef<HTMLElement | null>(null);
  const [toolboxRailExpanded, setToolboxRailExpanded] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string>("");
  const [autoPreview, setAutoPreview] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewSeq = useRef(0);

  const CATEGORY_PAGE_SIZE = 10;
  const TAG_PAGE_SIZE = 10;

  const categoryBoxRef = useRef<HTMLDivElement | null>(null);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryItems, setCategoryItems] = useState<PublicCategory[]>([]);
  const [categoryNextCursor, setCategoryNextCursor] = useState<string | null>(null);
  const [categoryHasMore, setCategoryHasMore] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const tagsBoxRef = useRef<HTMLDivElement | null>(null);
  const tagsInputRef = useRef<HTMLInputElement | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagsItems, setTagsItems] = useState<PublicTag[]>([]);
  const [tagsNextCursor, setTagsNextCursor] = useState<string | null>(null);
  const [tagsHasMore, setTagsHasMore] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(false);

  const loadMoreCategories = useCallback(async () => {
    if (categoryLoading || !categoryHasMore) return;
    setCategoryLoading(true);
    try {
      const r = await listPublicCategories({ limit: CATEGORY_PAGE_SIZE, cursor: categoryNextCursor });
      setCategoryItems((prev) => {
        const map = new Map(prev.map((x) => [x.id, x] as const));
        for (const item of r.categories ?? []) map.set(item.id, item);
        return Array.from(map.values());
      });
      setCategoryNextCursor(r.nextCursor ?? null);
      setCategoryHasMore(!!r.nextCursor);
    } catch {
      setCategoryHasMore(false);
    } finally {
      setCategoryLoading(false);
    }
  }, [CATEGORY_PAGE_SIZE, categoryHasMore, categoryLoading, categoryNextCursor]);

  const loadMoreTags = useCallback(async () => {
    if (tagsLoading || !tagsHasMore) return;
    setTagsLoading(true);
    try {
      const r = await listPublicTags({ limit: TAG_PAGE_SIZE, cursor: tagsNextCursor });
      setTagsItems((prev) => {
        const map = new Map(prev.map((x) => [x.id, x] as const));
        for (const item of r.tags ?? []) map.set(item.id, item);
        return Array.from(map.values());
      });
      setTagsNextCursor(r.nextCursor ?? null);
      setTagsHasMore(!!r.nextCursor);
    } catch {
      setTagsHasMore(false);
    } finally {
      setTagsLoading(false);
    }
  }, [TAG_PAGE_SIZE, tagsHasMore, tagsLoading, tagsNextCursor]);

  useEffect(() => {
    if (!categoryOpen) return;
    if (categoryItems.length > 0 || categoryLoading || !categoryHasMore) return;
    loadMoreCategories();
  }, [categoryHasMore, categoryItems.length, categoryLoading, categoryOpen, loadMoreCategories]);

  useEffect(() => {
    if (!tagsOpen) return;
    if (tagsItems.length > 0 || tagsLoading || !tagsHasMore) return;
    loadMoreTags();
  }, [loadMoreTags, tagsHasMore, tagsItems.length, tagsLoading, tagsOpen]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const t = e.target as any;
      if (categoryOpen && categoryBoxRef.current && t && !categoryBoxRef.current.contains(t)) setCategoryOpen(false);
      if (tagsOpen && tagsBoxRef.current && t && !tagsBoxRef.current.contains(t)) setTagsOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (categoryOpen) setCategoryOpen(false);
      if (tagsOpen) setTagsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [categoryOpen, tagsOpen]);

  function normalizeTagList(items: string[]): string {
    return items.map((s) => String(s ?? "").trim()).filter(Boolean).join(", ");
  }

  function parseTagTokens(value: string): string[] {
    return String(value ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function getTokenAtCursor(value: string, cursor: number): { start: number; end: number; token: string } {
    const s = String(value ?? "");
    const i = Math.max(0, Math.min(s.length, cursor));
    const prevComma = s.lastIndexOf(",", i - 1);
    const nextComma = s.indexOf(",", i);
    const start = prevComma === -1 ? 0 : prevComma + 1;
    const end = nextComma === -1 ? s.length : nextComma;
    const token = s.slice(start, end).trim();
    return { start, end, token };
  }

  function replaceToken(value: string, cursor: number, nextToken: string): { nextValue: string; nextCursor: number } {
    const s = String(value ?? "");
    const { start, end } = getTokenAtCursor(s, cursor);
    const before = s.slice(0, start);
    const after = s.slice(end);
    const leading = before.replace(/\s*$/, "");
    const trailing = after.replace(/^\s*/, "");

    const insert = String(nextToken ?? "").trim();
    let out = leading;
    if (out.length > 0 && !out.endsWith(",")) out += ",";
    if (out.length > 0) out += " ";
    out += insert;
    if (trailing.length > 0) {
      out += ",";
      out += " ";
      out += trailing.replace(/^,?\s*/, "");
    }

    const normalized = normalizeTagList(parseTagTokens(out));
    return { nextValue: normalized, nextCursor: normalized.length };
  }

  const tz = props.cfg?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!props.prefs?.editorLayout) return;
    setLayout(props.prefs.editorLayout);
  }, [props.prefs?.editorLayout]);

  useEffect(() => {
    if (layout === "preview" && markdownFocused) setMarkdownFocused(false);
  }, [layout, markdownFocused]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (layout === "split") {
      if (!sidebarPrevRef.current) {
        sidebarPrevRef.current = root.getAttribute("data-sidebar") === "collapsed" ? "collapsed" : "expanded";
      }
      root.setAttribute("data-sidebar", "collapsed");
      return;
    }
    if (!sidebarPrevRef.current) return;
    const current = root.getAttribute("data-sidebar") === "collapsed" ? "collapsed" : "expanded";
    if (current === "collapsed") root.setAttribute("data-sidebar", sidebarPrevRef.current);
    sidebarPrevRef.current = null;
  }, [layout]);

  useEffect(() => {
    return () => {
      if (typeof document === "undefined") return;
      if (!sidebarPrevRef.current) return;
      const root = document.documentElement;
      const current = root.getAttribute("data-sidebar") === "collapsed" ? "collapsed" : "expanded";
      if (current === "collapsed") root.setAttribute("data-sidebar", sidebarPrevRef.current);
      sidebarPrevRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOOLBOX_DOCK_KEY, toolboxDock);
  }, [toolboxDock]);

  useEffect(() => {
    if (!toolboxDragging) return;

    const onMove = (e: PointerEvent) => {
      if (toolboxPointerIdRef.current !== null && e.pointerId !== toolboxPointerIdRef.current) return;
      const card = editorCardRef.current?.getBoundingClientRect() ?? null;
      const nearTop = card ? e.clientY - card.top < 120 : e.clientY < 140;
      const next: ToolboxDock = nearTop ? "top" : "left";
      if (toolboxDragTargetRef.current === next) return;
      toolboxDragTargetRef.current = next;
      setToolboxDragTarget(next);
    };

    const onUp = (e: PointerEvent) => {
      if (toolboxPointerIdRef.current !== null && e.pointerId !== toolboxPointerIdRef.current) return;
      setToolboxDock(toolboxDragTargetRef.current);
      setToolboxDragging(false);
      toolboxPointerIdRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [toolboxDragging]);

  function onToolboxDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    toolboxDragTargetRef.current = toolboxDock;
    setToolboxDragTarget(toolboxDock);
    toolboxPointerIdRef.current = e.pointerId;
    setToolboxDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function applySnippet(kind: "blur" | "inlineCode" | "codeBlock" | "link" | "image" | "embed") {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelectionText();

    if (kind === "blur") {
      const inner = selected || "text";
      const rep = `||${inner}||`;
      editor.replaceSelection(rep, 2, 2 + inner.length);
      return;
    }
    if (kind === "inlineCode") {
      const inner = selected || "code";
      const rep = `\`${inner}\``;
      editor.replaceSelection(rep, 1, 1 + inner.length);
      return;
    }
    if (kind === "codeBlock") {
      const inner = selected || "code";
      const rep = `\n\n\`\`\`ts\n${inner}\n\`\`\`\n\n`;
      const start = "\n\n```ts\n".length;
      editor.replaceSelection(rep, start, start + inner.length);
      return;
    }
    if (kind === "link") {
      const text = selected || "text";
      const rep = `[${text}](url)`;
      const urlStart = 1 + text.length + 2;
      editor.replaceSelection(rep, urlStart, urlStart + 3);
      return;
    }
    if (kind === "image") {
      const url = selected && /^https?:\/\//i.test(selected.trim()) ? selected.trim() : "url";
      const rep = `![](${url})`;
      const urlStart = 4;
      editor.replaceSelection(rep, urlStart, urlStart + url.length);
      return;
    }
    if (kind === "embed") {
      const provider = "provider";
      const value = "value";
      const rep = `@[${provider}](${value})`;
      editor.replaceSelection(rep, 2, 2 + provider.length);
    }
  }

  function renderToolboxActions() {
    return (
      <div className="toolbox-actions">
        <div className="toolbox-group" aria-label="格式">
          <button className="toolbox-btn" onClick={() => applySnippet("blur")} title="文字模糊：||text||">
            <span className="toolbox-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
            </span>
            <span className="toolbox-label">模糊</span>
          </button>
          <button className="toolbox-btn" onClick={() => applySnippet("inlineCode")} title="行内代码：`code`">
            <span className="toolbox-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </span>
            <span className="toolbox-label">行内代码</span>
          </button>
          <button className="toolbox-btn" onClick={() => applySnippet("codeBlock")} title="代码块：```ts">
            <span className="toolbox-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="10" x2="14" y1="13" y2="13"/><line x1="8" x2="16" y1="17" y2="17"/><line x1="8" x2="10" y1="9" y2="9"/></svg>
            </span>
            <span className="toolbox-label">代码块</span>
          </button>
        </div>

        <div className="toolbox-group" aria-label="插入">
          <button className="toolbox-btn" onClick={() => applySnippet("link")} title="链接：[text](url)">
            <span className="toolbox-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </span>
            <span className="toolbox-label">链接</span>
          </button>
          <button className="toolbox-btn" onClick={() => applySnippet("image")} title="图片：![](url)">
            <span className="toolbox-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </span>
            <span className="toolbox-label">图片</span>
          </button>
          <button className="toolbox-btn" onClick={() => applySnippet("embed")} title="嵌入：@[provider](value)">
            <span className="toolbox-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
            </span>
            <span className="toolbox-label">嵌入</span>
          </button>
        </div>
      </div>
    );
  }

  function renderToolboxHandle() {
    return (
      <div
        className={`toolbox-handle${toolboxDragging ? " is-dragging" : ""}`}
        title="拖动到顶部：停靠为工具条"
        onPointerDown={onToolboxDragStart}
      >
        ⋮⋮
      </div>
    );
  }

  async function setLayoutAndPersist(next: AdminPrefs["editorLayout"]) {
    setLayout(next);
    if (props.prefs?.editorLayout === next) return;
    try {
      await updateAdminPrefs({ editorLayout: next });
      if (props.prefs) props.onPrefs({ ...props.prefs, editorLayout: next });
    } catch (e) {
      const err = e as ApiError;
      props.onError(err.message || "保存布局失败");
    }
  }

  const layoutButtons = (
    <div className="layout-switcher">
      <button className={`btn${layout === "write" ? " active" : ""}`} onClick={() => void setLayoutAndPersist("write")}>写作</button>
      <button className={`btn${layout === "preview" ? " active" : ""}`} onClick={() => void setLayoutAndPersist("preview")}>预览</button>
      <button className={`btn${layout === "split" ? " active" : ""}`} onClick={() => void setLayoutAndPersist("split")}>分屏</button>
    </div>
  );

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      setLoading(true);
      try {
        const p: AdminPostDetail = await getAdminPost(props.id as string);
        setId(p.id);
        setSlug(p.slug);
        setTitle(p.title);
        setSummary(p.summary ?? "");
        setContent(p.content_md ?? "");
        setCategory(p.category_name ?? "");
        setTags((p.tags ?? []).map((t) => t.name).join(", "));
        setStatus(p.status);
        if (p.publish_at) setPublishAtLocal(utcMsToZonedInput(p.publish_at, tz));
      } catch (e) {
        const err = e as ApiError;
        props.onError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [isNew, props.id, tz]);

  async function renderPreview(seq: number) {
    setPreviewError("");
    setPreviewing(true);
    try {
      const rendered = await renderAdminMarkdown(content);
      if (seq !== previewSeq.current) return;
      setPreviewHtml(rendered.html);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      const err = e as ApiError;
      setPreviewError(err.message || "Preview render failed");
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }

  useEffect(() => {
    if (!autoPreview) return;
    const seq = ++previewSeq.current;
    const t = window.setTimeout(() => void renderPreview(seq), 350);
    return () => window.clearTimeout(t);
  }, [content, autoPreview]);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;

    const cards = Array.from(root.querySelectorAll<HTMLAnchorElement>("a.embed-card--github[data-repo]"));
    if (cards.length === 0) return;

    const storeKey = (repo: string) => `bitlog_gh_repo_${repo}`;
    const now = () => Date.now();
    const TTL = 12 * 60 * 60 * 1000;

    const formatNumber = (n: unknown) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "—";
      if (x >= 1e6) return (x / 1e6).toFixed(1).replace(/\\.0$/, "") + "m";
      if (x >= 1e3) return (x / 1e3).toFixed(1).replace(/\\.0$/, "") + "k";
      return String(Math.floor(x));
    };

    const fetchRepo = async (repo: string) => {
      const cache = (() => {
        try {
          return localStorage.getItem(storeKey(repo));
        } catch {
          return null;
        }
      })();
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          if (parsed && typeof parsed.ts === "number" && now() - parsed.ts < TTL && parsed.data) return parsed.data;
        } catch {
          // ignore
        }
      }
      const url = `https://api.github.com/repos/${repo}`;
      const res = await fetch(url, { headers: { accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("github_api_failed");
      const data = await res.json();
      try {
        localStorage.setItem(storeKey(repo), JSON.stringify({ ts: now(), data }));
      } catch {
        // ignore
      }
      return data;
    };

    const setText = (el: Element | null, s: unknown) => {
      if (!el) return;
      el.textContent = String(s ?? "");
    };

    cards.forEach((a) => {
      const repo = a.getAttribute("data-repo");
      if (!repo) return;

      fetchRepo(repo)
        .then((data) => {
          a.removeAttribute("data-loading");
          if (data && data.html_url) a.setAttribute("href", String(data.html_url));

          const avatar = a.querySelector<HTMLImageElement>(".embed-card__avatar");
          if (avatar && data?.owner?.avatar_url) {
            avatar.setAttribute("src", String(data.owner.avatar_url));
            avatar.setAttribute("alt", String(data.owner.login ?? ""));
          }

          setText(a.querySelector(".embed-card__title"), data?.full_name ?? repo);
          setText(a.querySelector(".embed-card__desc"), data?.description ?? "");
          setText(a.querySelector("[data-field='stars']"), formatNumber(data?.stargazers_count));
          setText(a.querySelector("[data-field='forks']"), formatNumber(data?.forks_count));
          setText(a.querySelector("[data-field='lang']"), data?.language ?? "—");
        })
        .catch(() => {
          a.removeAttribute("data-loading");
        });
    });
  }, [previewHtml]);

  async function uploadImage(file: File): Promise<string> {
    props.onError("");
    setUploading(true);
    setUploadedUrl(null);
    try {
      const asset = await uploadAdminImage(file);
      setUploadedUrl(asset.url);
      return asset.url;
    } catch (err) {
      const apiErr = err as ApiError;
      props.onError(apiErr.message || "上传失败");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    props.onError("");
    if (!title.trim() || !content.trim()) {
      props.onError("title/content 不能为空");
      return;
    }
    setSaving(true);
    try {
      const publishAt =
        status === "draft"
          ? null
          : publishAtLocal
            ? zonedInputToUtcMs(publishAtLocal, tz)
            : Date.now();
      const tagsArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (isNew) {
        const created = await createAdminPost({
          title: title.trim(),
          summary,
          content_md: content,
          category: category.trim() ? category.trim() : null,
          tags: tagsArr,
          status,
          publish_at: publishAt ?? null
        });
        setId(created.id);
        setSlug(created.slug);
        window.location.hash = `#/posts/${created.id}`;
      } else if (id) {
        await updateAdminPost(id, {
          title: title.trim(),
          summary,
          content_md: content,
          category: category.trim() ? category.trim() : null,
          tags: tagsArr,
          status,
          publish_at: publishAt ?? null
        });
        if (!summary.trim()) {
          try {
            const updated = await getAdminPost(id);
            setSummary(updated.summary ?? "");
          } catch {
            // ignore
          }
        }
      }
      showToast("已保存", "success");
    } catch (e) {
      const err = e as ApiError;
      showToast(err.message || "保存失败", "error");
      props.onError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">加载中...</div>;

  const railPreview = toolboxDragging && toolboxDragTarget === "left" && toolboxDock !== "left";
  const topPreview = toolboxDragging && toolboxDragTarget === "top" && toolboxDock !== "top";
  const railOpen = toolboxDock === "left" || railPreview;
  const topOpen = toolboxDock === "top" || topPreview;
  const railExpanded = railOpen && toolboxDock === "left" && toolboxRailExpanded && !toolboxDragging;

  return (
    <div
      className={`grid grid--editor layout--${layout}${markdownFocused ? " focus-md" : ""}${
        railOpen ? " toolbox-left" : ""
      }${railExpanded ? " toolbox-rail-expanded" : ""}`}
    >
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
      {layout !== "preview" ? (
        <>
          {railOpen && (
            <aside
              className={`toolbox toolbox-rail${toolboxDock === "left" ? " is-active" : ""}${railPreview ? " is-preview" : ""}`}
              aria-label="编辑工具栏（侧边）"
              aria-hidden={!railOpen}
              ref={toolboxRailRef as any}
              onMouseEnter={() => setToolboxRailExpanded(true)}
              onMouseLeave={() => {
                const el = toolboxRailRef.current;
                if (el && el.contains(document.activeElement)) return;
                setToolboxRailExpanded(false);
              }}
              onFocusCapture={() => setToolboxRailExpanded(true)}
              onBlurCapture={(e) => {
                const el = toolboxRailRef.current;
                if (!el) return;
                const next = e.relatedTarget as Node | null;
                if (next && el.contains(next)) return;
                setToolboxRailExpanded(false);
              }}
            >
              {renderToolboxHandle()}
              <div className="toolbox-rail-scroll">{renderToolboxActions()}</div>
            </aside>
          )}
        <div className="card editor-card" ref={editorCardRef}>

          <div className="nav">
            <a className="btn btn-ghost" href="#/posts">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              返回列表
            </a>
            {slug ? (
              <a className="btn btn-secondary" href={`/articles/${encodeURIComponent(slug)}?preview=1`} target="_blank" rel="noreferrer">
                预览
              </a>
            ) : null}
            <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
            {layoutButtons}
          </div>

          <div className={`toolbox-top-slot${topOpen ? " is-open" : ""}${topPreview ? " is-preview" : ""}`}>
            <div
              className={`toolbox toolbox-top${toolboxDock === "top" ? " is-active" : ""}${topPreview ? " is-preview" : ""}`}
              aria-label="编辑工具栏（顶部）"
              aria-hidden={!topOpen}
            >
              {renderToolboxHandle()}
              <div className="toolbox-top-scroll">{renderToolboxActions()}</div>
            </div>
          </div>

          <div className="editor-meta">
            <div className="grid2">
              <label className="field">
                标题
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="field">
                摘要
                <input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} />
              </label>
            </div>
            <div className="grid2">
              <label className="field">
                分类（只允许 1 个）
                <div className="combo" ref={categoryBoxRef}>
                  <input
                    className="input"
                    ref={categoryInputRef}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="例如：教学 / 编程"
                    onFocus={() => setCategoryOpen(true)}
                    onClick={() => setCategoryOpen(true)}
                  />
                  {categoryOpen && (
                    <div
                      className="combo-popover"
                      role="listbox"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMoreCategories();
                      }}
                    >
                      {(category.trim()
                        ? categoryItems.filter((c) => c.name.toLowerCase().includes(category.trim().toLowerCase()))
                        : categoryItems
                      ).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="combo-item"
                          role="option"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCategory(c.name);
                            setCategoryOpen(false);
                            categoryInputRef.current?.focus();
                          }}
                        >
                          <span className="combo-main">{c.name}</span>
                          <span className="combo-sub">{c.slug}</span>
                        </button>
                      ))}
                      {categoryLoading && <div className="combo-hint">加载中...</div>}
                      {!categoryLoading && categoryHasMore && <div className="combo-hint">下滑加载更多...</div>}
                      {!categoryLoading && !categoryHasMore && categoryItems.length === 0 && (
                        <div className="combo-hint">暂无分类（你可以直接手动输入创建）</div>
                      )}
                    </div>
                  )}
                </div>
              </label>
              <label className="field">
                标签（逗号分隔）
                <div className="combo" ref={tagsBoxRef}>
                  <input
                    className="input"
                    ref={tagsInputRef}
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="例如：教程, SQL, Edge"
                    onFocus={() => setTagsOpen(true)}
                    onClick={() => setTagsOpen(true)}
                  />
                  {tagsOpen && (
                    <div
                      className="combo-popover"
                      role="listbox"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMoreTags();
                      }}
                    >
                      {(() => {
                        const selected = new Set(parseTagTokens(tags).map((t) => t.toLowerCase()));
                        const cursor = tagsInputRef.current?.selectionStart ?? tags.length;
                        const { token } = getTokenAtCursor(tags, cursor);
                        const q = token.trim().toLowerCase();
                        const list = (q ? tagsItems.filter((t) => t.name.toLowerCase().includes(q)) : tagsItems).filter(
                          (t) => !selected.has(t.name.toLowerCase())
                        );
                        return list.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="combo-item"
                            role="option"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const cur = tagsInputRef.current?.selectionStart ?? tags.length;
                              const next = replaceToken(tags, cur, t.name);
                              setTags(next.nextValue);
                              setTagsOpen(true);
                              requestAnimationFrame(() => {
                                tagsInputRef.current?.focus();
                                try {
                                  tagsInputRef.current?.setSelectionRange(next.nextCursor, next.nextCursor);
                                } catch {
                                  // ignore
                                }
                              });
                            }}
                          >
                            <span className="combo-main">{t.name}</span>
                            <span className="combo-sub">{t.slug}</span>
                          </button>
                        ));
                      })()}
                      {tagsLoading && <div className="combo-hint">加载中...</div>}
                      {!tagsLoading && tagsHasMore && <div className="combo-hint">下滑加载更多...</div>}
                      {!tagsLoading && !tagsHasMore && tagsItems.length === 0 && (
                        <div className="combo-hint">暂无标签（你可以直接手动输入创建）</div>
                      )}
                      {!tagsLoading && tagsItems.length > 0 && (
                        <div className="combo-hint">提示：可继续手动输入（逗号分隔）</div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="grid2">
              <label className="field">
                状态
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="draft">草稿</option>
                  <option value="published">发布</option>
                  <option value="scheduled">定时</option>
                </select>
              </label>
              <label className="field">
                发布时间（{tz}）
                <input
                  className="input"
                  type="datetime-local"
                  value={publishAtLocal}
                  onChange={(e) => setPublishAtLocal(e.target.value)}
                  disabled={status === "draft"}
                />
              </label>
            </div>
            <label className="field">
              图片上传（仅当 Worker 绑定 R2 时可用）
              <input
                className="input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadImage(file);
                    editorRef.current?.insertText(`\n\n![](${url})\n`);
                  } catch {
                    // error handled by uploadImage
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {uploadedUrl ? (
              <div className="nav">
                <span className="muted">已上传：{uploadedUrl}</span>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    editorRef.current?.insertText(`\n\n![](${uploadedUrl})\n`);
                  }}
                >
                  插入 Markdown
                </button>
              </div>
            ) : uploading ? (
              <div className="muted">上传中...</div>
            ) : null}
          </div>

          <label className="field editor-md">
            Markdown
            <MarkdownEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              onSave={() => void save()}
              onUploadImage={uploadImage}
              onFocusChange={setMarkdownFocused}
            />
          </label>
          <div className="muted">
            支持：表格/脚注/代码高亮(Refractor)/文字模糊(||text||)/嵌入短代码(@[provider](value))；允许原始 HTML（会做 XSS 清洗）。
          </div>
        </div>
        </>
      ) : null}
      {layout !== "write" ? (
        <div className="card">
        <div className="md-preview-toolbar">
          <div className="left">
            <span style={{ fontWeight: 750 }}>预览</span>
            <button className="btn btn-ghost" onClick={() => setAutoPreview((v) => !v)}>
              自动刷新：{autoPreview ? "开" : "关"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const seq = ++previewSeq.current;
                void renderPreview(seq);
                editorRef.current?.scrollToSelection();
              }}
              disabled={previewing}
            >
              {previewing ? "渲染中..." : "刷新预览"}
            </button>
            {layoutButtons}
          </div>
          <span className="muted">{previewError ? previewError : previewing ? "渲染中..." : ""}</span>
        </div>

        {previewHtml ? (
          <div
            ref={previewRef}
            className="md-prose"
            onClick={(e) => {
              const target = e.target as HTMLElement | null;
              if (!target) return;
              const copyBtn = target.closest("button[data-copy]") as HTMLButtonElement | null;
              if (copyBtn) {
                const code = copyBtn.closest(".code-block")?.querySelector("code");
                if (!code) return;
                const lines = Array.from(code.querySelectorAll(".code-line"));
                const text = lines.length
                  ? lines.map((line) => line.querySelector(".code-text")?.textContent?.trimEnd() ?? "").join("\n")
                  : code.textContent ?? "";
                if (!text) return;

                const setTempText = (next: string, ok: boolean) => {
                  const prev = copyBtn.textContent ?? "复制";
                  if (ok) copyBtn.classList.add("copied");
                  copyBtn.textContent = next;
                  window.setTimeout(() => {
                    copyBtn.classList.remove("copied");
                    copyBtn.textContent = prev;
                  }, 1400);
                };

                (async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    setTempText("已复制", true);
                  } catch {
                    try {
                      const ta = document.createElement("textarea");
                      ta.value = text;
                      ta.setAttribute("readonly", "true");
                      ta.style.position = "fixed";
                      ta.style.left = "-9999px";
                      ta.style.top = "0";
                      document.body.appendChild(ta);
                      ta.select();
                      const ok = document.execCommand("copy");
                      ta.remove();
                      setTempText(ok ? "已复制" : "复制失败", ok);
                    } catch {
                      setTempText("复制失败", false);
                    }
                  }
                })();
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
              const href = anchor?.getAttribute("href") ?? "";
              if (anchor && href && !href.startsWith("#")) return;

              const lineEl = target.closest("[data-line]") as HTMLElement | null;
              const lineAttr = lineEl?.getAttribute("data-line") ?? "";
              const line = Number(lineAttr);
              if (Number.isFinite(line) && line > 0) editorRef.current?.scrollToLine(line);
              else editorRef.current?.scrollToSelection();
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>
            暂无预览
          </div>
        )}
        </div>
      ) : null}
    </div>
  );
}
