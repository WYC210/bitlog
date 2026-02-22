import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SiteConfig } from "../api";
import { getConfig, updateSettings } from "../api";
import type { AdminActionId, AdminContextKey, UiStyle } from "../shortcuts/actions";
import { ADMIN_ACTIONS, UI_STYLES } from "../shortcuts/actions";

type PaletteItem =
  | {
      key: string;
      kind: "action";
      actionId: AdminActionId;
      label: string;
      description?: string;
      binding?: string;
      danger?: "normal" | "siteSetting";
    }
  | {
      key: string;
      kind: "setStyle";
      target: "web" | "admin";
      value: UiStyle;
      label: string;
      description?: string;
      danger: "siteSetting";
    };

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 720px)")?.matches ?? false;
}

export function CommandPalette(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextKey: AdminContextKey;
  bindings: Partial<Record<AdminActionId, string>>;
  cfg: SiteConfig | null;
  onCfg: (c: SiteConfig) => void;
  onToggleTheme: () => void;
}) {
  const [q, setQ] = useState("");
  const [busyKey, setBusyKey] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setQ("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [props]);

  const items = useMemo<PaletteItem[]>(() => {
    if (!props.open) return [];
    const context = props.contextKey;
    const base = ADMIN_ACTIONS.filter((a) => a.permission === "admin" && a.scopes.includes(context));

    const out: PaletteItem[] = base.map((a) => ({
      key: a.id,
      kind: "action",
      actionId: a.id,
      label: a.label,
      description: a.description,
      binding: props.bindings?.[a.id] ?? a.defaultBinding,
      danger: a.dangerLevel ?? "normal"
    }));

    const webStyle = (props.cfg as any)?.webStyle as UiStyle | undefined;
    const adminStyle = (props.cfg as any)?.adminStyle as UiStyle | undefined;

    const addStyleItems = (target: "web" | "admin", current: UiStyle | undefined) => {
      for (const s of UI_STYLES) {
        out.push({
          key: `setStyle:${target}:${s.value}`,
          kind: "setStyle",
          target,
          value: s.value,
          label: `${target === "web" ? "WebStyle" : "AdminStyle"}：${s.label}${current === s.value ? "（当前）" : ""}`,
          description: "全站生效（会刷新 cache_version）",
          danger: "siteSetting"
        });
      }
    };

    if (base.some((x) => x.id === "setWebStyle")) addStyleItems("web", webStyle);
    if (base.some((x) => x.id === "setAdminStyle")) addStyleItems("admin", adminStyle);

    const keyword = q.trim().toLowerCase();
    if (!keyword) return out;
    return out.filter((it) => {
      const hay = `${it.label} ${"description" in it ? String(it.description ?? "") : ""}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [props.open, props.contextKey, props.bindings, props.cfg, q]);

  async function run(item: PaletteItem) {
    if (item.kind === "setStyle") {
      setBusyKey(item.key);
      try {
        if (item.target === "web") {
          await updateSettings({ "ui.web_style": item.value });
        } else {
          await updateSettings({ "ui.admin_style": item.value });
        }
        const next = await getConfig();
        props.onCfg(next);
        alert("已应用（全站生效）");
      } catch (e) {
        alert((e as any)?.message ? String((e as any).message) : "执行失败");
      } finally {
        setBusyKey("");
        props.onOpenChange(false);
      }
      return;
    }

    props.onOpenChange(false);
    const id = item.actionId;
    if (id === "toggleLightDark") {
      props.onToggleTheme();
      return;
    }
    if (id === "goSite") {
      window.location.href = "/articles";
      return;
    }
    if (id === "goAdminPosts") {
      window.location.hash = "#/posts";
      return;
    }
    if (id === "goAdminSettings") {
      window.location.hash = "#/settings";
      return;
    }
    if (id === "goAdminAccount") {
      window.location.hash = "#/account";
      return;
    }
    if (id === "newPost") {
      window.location.hash = "#/posts/new";
      return;
    }
    if (id === "back") {
      history.back();
      return;
    }
    if (id === "forward") {
      history.forward();
      return;
    }
    if (id === "editorSave") {
      window.dispatchEvent(new CustomEvent("bitlog:admin:editorSave"));
      return;
    }
    if (id === "editorRefreshPreview") {
      window.dispatchEvent(new CustomEvent("bitlog:admin:editorRefreshPreview"));
      return;
    }
    if (id === "editorPublish") {
      window.dispatchEvent(new CustomEvent("bitlog:admin:editorPublish"));
      return;
    }
  }

  if (!props.open) return null;

  const mobile = isMobile();

  return createPortal(
    <div
      className="cmdp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onOpenChange(false);
      }}
    >
      <div className={`cmdp-panel${mobile ? " is-mobile" : ""}`}>
        <div className="cmdp-head">
          <input
            ref={inputRef}
            className="cmdp-input"
            placeholder="搜索动作…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="cmdp-close" type="button" onClick={() => props.onOpenChange(false)} aria-label="关闭">
            Esc
          </button>
        </div>
        <div className="cmdp-list" ref={listRef}>
          {items.length === 0 ? <div className="cmdp-empty">无匹配动作</div> : null}
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              className={`cmdp-item${it.kind === "setStyle" ? " is-danger" : it.danger === "siteSetting" ? " is-danger" : ""}`}
              disabled={!!busyKey}
              onClick={() => void run(it)}
            >
              <div className="cmdp-main">
                <div className="cmdp-title">{it.label}</div>
                {"description" in it && it.description ? <div className="cmdp-desc">{it.description}</div> : null}
              </div>
              {"binding" in it && it.binding ? <kbd className="cmdp-kbd">{it.binding}</kbd> : null}
              {busyKey === it.key ? <span className="cmdp-busy">…</span> : null}
            </button>
          ))}
        </div>
        <div className="cmdp-foot">
          <span className="cmdp-hint">提示：不想记快捷键时，用这里搜索即可。</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

