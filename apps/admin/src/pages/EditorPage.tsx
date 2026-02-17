import React, { useEffect, useRef, useState } from "react";
import type { AdminPostDetail, AdminPrefs, ApiError, SiteConfig } from "../api";
import { createAdminPost, getAdminPost, renderAdminMarkdown, updateAdminPost, updateAdminPrefs, uploadAdminImage } from "../api";
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
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const editorCardRef = useRef<HTMLDivElement | null>(null);

  const [layout, setLayout] = useState<AdminPrefs["editorLayout"]>(props.prefs?.editorLayout ?? "split");
  const [markdownFocused, setMarkdownFocused] = useState(false);

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

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string>("");
  const [autoPreview, setAutoPreview] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewSeq = useRef(0);

  const tz = props.cfg?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!props.prefs?.editorLayout) return;
    setLayout(props.prefs.editorLayout);
  }, [props.prefs?.editorLayout]);

  useEffect(() => {
    if (layout === "preview" && markdownFocused) setMarkdownFocused(false);
  }, [layout, markdownFocused]);

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
        <button className="toolbox-btn" onClick={() => applySnippet("blur")} title="文字模糊：||text||">
          模糊
        </button>
        <button className="toolbox-btn" onClick={() => applySnippet("inlineCode")} title="行内代码：`code`">
          行内代码
        </button>
        <button className="toolbox-btn" onClick={() => applySnippet("codeBlock")} title="代码块：```ts">
          代码块
        </button>
        <button className="toolbox-btn" onClick={() => applySnippet("link")} title="链接：[text](url)">
          链接
        </button>
        <button className="toolbox-btn" onClick={() => applySnippet("image")} title="图片：![](url)">
          图片
        </button>
        <button className="toolbox-btn" onClick={() => applySnippet("embed")} title="嵌入：@[provider](value)">
          嵌入
        </button>
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
    <>
      <button className={`chip ${layout === "write" ? "chip-primary" : ""}`} onClick={() => void setLayoutAndPersist("write")}>
        Write
      </button>
      <button className={`chip ${layout === "preview" ? "chip-primary" : ""}`} onClick={() => void setLayoutAndPersist("preview")}>
        Preview
      </button>
      <button className={`chip ${layout === "split" ? "chip-primary" : ""}`} onClick={() => void setLayoutAndPersist("split")}>
        Split
      </button>
    </>
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
      }
      alert("已保存");
    } catch (e) {
      const err = e as ApiError;
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

  return (
    <div
      className={`grid grid--editor layout--${layout}${markdownFocused ? " focus-md" : ""}${
        railOpen ? " toolbox-left" : ""
      }`}
    >
      {layout !== "preview" ? (
        <div className="card editor-card" ref={editorCardRef}>
          <aside
            className={`toolbox toolbox-rail${toolboxDock === "left" ? " is-active" : ""}${railPreview ? " is-preview" : ""}`}
            aria-label="编辑工具栏（侧边）"
            aria-hidden={!railOpen}
          >
            {renderToolboxHandle()}
            <div className="toolbox-rail-scroll">{renderToolboxActions()}</div>
          </aside>

          <div className="nav">
            <a className="chip" href="#/posts">
              返回列表
            </a>
            {slug ? (
              <a className="chip" href={`/articles/${encodeURIComponent(slug)}?preview=1`} target="_blank" rel="noreferrer">
                预览
              </a>
            ) : null}
            <button className="chip chip-primary" onClick={() => void save()} disabled={saving}>
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
            <div style={{ height: 10 }} />
            <div className="row">
              <label>
                标题
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                Summary
                <input value={summary} onChange={(e) => setSummary(e.target.value)} />
              </label>
            </div>
            <div style={{ height: 10 }} />
            <div className="row">
              <label>
                分类（只允许 1 个）
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="例如：教学 / 编程" />
              </label>
              <label>
                标签（逗号分隔）
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例如：教程, SQL, Edge" />
              </label>
            </div>
            <div style={{ height: 10 }} />
            <div className="row">
              <label>
                状态
                <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="draft">草稿</option>
                  <option value="published">发布</option>
                  <option value="scheduled">定时</option>
                </select>
              </label>
              <label>
                发布时间（{tz}）
                <input
                  type="datetime-local"
                  value={publishAtLocal}
                  onChange={(e) => setPublishAtLocal(e.target.value)}
                  disabled={status === "draft"}
                />
              </label>
            </div>
            <div style={{ height: 10 }} />
            <label>
              图片上传（仅当 Worker 绑定 R2 时可用）
              <input
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
                  className="chip"
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
            <div style={{ height: 10 }} />
          </div>

          <label className="editor-md">
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
      ) : null}
      {layout !== "write" ? (
        <div className="card">
        <div className="md-preview-toolbar">
          <div className="left">
            <span style={{ fontWeight: 750 }}>预览</span>
            <button className="chip" onClick={() => setAutoPreview((v) => !v)}>
              自动刷新：{autoPreview ? "开" : "关"}
            </button>
            <button
              className="chip"
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
