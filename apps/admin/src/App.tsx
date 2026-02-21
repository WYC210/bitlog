import React, { useEffect, useMemo, useState } from "react";
import type { AdminPrefs, ApiError, SiteConfig } from "./api";
import { adminLogout, adminMe, getAdminPrefs, getConfig } from "./api";
import type { Route } from "./routes";
import { parseRoute } from "./routes";
import { LoginPage } from "./pages/LoginPage";
import { PostsPage } from "./pages/PostsPage";
import { EditorPage } from "./pages/EditorPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountPage } from "./pages/AccountPage";
import { applyThemeWithTransition, getTheme } from "./ui/theme";

function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const t = target as any;
  const tag = String(t?.tagName ?? "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!t?.isContentEditable;
}

function matchChord(e: KeyboardEvent, combo: string | undefined): boolean {
  const s = String(combo ?? "").trim().toLowerCase();
  if (!s || s.includes(" ")) return false;
  const parts = s.split("+").map((x) => x.trim()).filter(Boolean);
  const key = String(e.key ?? "").toLowerCase();
  const wantCtrl = parts.includes("ctrl");
  const wantMeta = parts.includes("meta");
  const wantMod = parts.includes("cmd") || parts.includes("mod");
  const wantAlt = parts.includes("alt");
  const wantShift = parts.includes("shift");
  const wantKey = parts.find((p) => !["ctrl", "cmd", "mod", "meta", "alt", "shift"].includes(p));
  if (wantCtrl && !e.ctrlKey) return false;
  if (wantMeta && !e.metaKey) return false;
  if (wantMod && !(e.ctrlKey || e.metaKey)) return false;
  if (wantAlt && !e.altKey) return false;
  if (wantShift && !e.shiftKey) return false;
  if (wantKey && wantKey !== key) return false;
  return true;
}

function parseSeq(spec: string | undefined): string[] | null {
  const s = String(spec ?? "").trim().toLowerCase();
  if (!s.includes(" ")) return null;
  const keys = s.split(/\s+/).map((x) => x.trim()).filter(Boolean);
  return keys.length ? keys : null;
}

export function App() {
  const route = useRoute();
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [user, setUser] = useState<{ adminId: string; username: string } | null>(null);
  const [prefs, setPrefs] = useState<AdminPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<"light" | "dark">(() => getTheme());

  useEffect(() => {
    void (async () => {
      try {
        const c = await getConfig();
        setCfg(c);
        try {
          const s = String((c as any).adminStyle ?? "current");
          if (/^(current|classic|glass|brutal|terminal)$/.test(s)) {
            document.documentElement.setAttribute("data-ui-style", s);
            localStorage.setItem("ui-admin-style-last", s);
          }
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
      try {
        const me = await adminMe();
        setUser(me);
        try {
          const p = await getAdminPrefs();
          setPrefs(p);
        } catch {
          setPrefs(null);
        }
      } catch {
        setUser(null);
        setPrefs(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!cfg) return;
    try {
      const s = String((cfg as any).adminStyle ?? "current");
      if (/^(current|classic|glass|brutal|terminal)$/.test(s)) {
        document.documentElement.setAttribute("data-ui-style", s);
        localStorage.setItem("ui-admin-style-last", s);
      }
    } catch {
      // ignore
    }
  }, [(cfg as any)?.adminStyle]);

  useEffect(() => {
    const page =
      route.page === "edit" && (route as any).id === "new"
        ? "new"
        : route.page === "edit"
          ? "posts"
          : route.page;
    try {
      document.body?.setAttribute("data-page", page);
    } catch {
      // ignore
    }
  }, [route.page, (route as any).id]);

  function parseShortcutsJson(text: string | null | undefined): any {
    try {
      const v = text ? JSON.parse(text) : {};
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }

  function mergeShortcuts(a: any, b: any): any {
    const out: any = {};
    const ag = a?.global && typeof a.global === "object" ? a.global : {};
    const bg = b?.global && typeof b.global === "object" ? b.global : {};
    out.global = { ...ag, ...bg };
    const ac = a?.contexts && typeof a.contexts === "object" ? a.contexts : {};
    const bc = b?.contexts && typeof b.contexts === "object" ? b.contexts : {};
    const keys = new Set<string>([...Object.keys(ac), ...Object.keys(bc)]);
    const contexts: any = {};
    keys.forEach((k) => {
      const av = ac[k] && typeof ac[k] === "object" ? ac[k] : {};
      const bv = bc[k] && typeof bc[k] === "object" ? bc[k] : {};
      contexts[k] = { ...av, ...bv };
    });
    out.contexts = contexts;
    return out;
  }

  const shortcutSpecs = useMemo(() => {
    const merged = mergeShortcuts(parseShortcutsJson(cfg?.shortcutsJson), parseShortcutsJson(prefs?.shortcutsJson));
    const pageKey = `admin.${route.page}`;
    const effective = {
      ...(merged?.global ?? {}),
      ...(merged?.contexts?.["admin.global"] ?? {}),
      ...(merged?.contexts?.[pageKey] ?? {})
    };
    const getSpec = (keys: string[], fallback: string) => {
      for (const k of keys) {
        const v = (effective as any)?.[k];
        if (v) return String(v);
      }
      return fallback;
    };
    return {
      newPost: getSpec(["newPost"], "mod+n"),
      goHome: getSpec(["goHome"], "alt+h"),
      back: getSpec(["goBack", "back"], "g b"),
      forward: getSpec(["goForward", "forward"], "g n")
    };
  }, [cfg?.shortcutsJson, prefs?.shortcutsJson, route.page]);

  useEffect(() => {
    let seq: string[] = [];
    let timer: number | null = null;
    const pushSeq = (key: string) => {
      if (!key || key.length !== 1) return;
      seq.push(key);
      if (seq.length > 4) seq.shift();
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        seq = [];
        timer = null;
      }, 900);
    };
    const matchSeq = (keys: string[] | null) => {
      if (!keys || !keys.length) return false;
      if (seq.length < keys.length) return false;
      const tail = seq.slice(seq.length - keys.length);
      for (let i = 0; i < keys.length; i++) {
        if (tail[i] !== keys[i]) return false;
      }
      return true;
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (!e.ctrlKey && !e.metaKey && !e.altKey) pushSeq(String(e.key ?? "").toLowerCase());

      if (matchChord(e, shortcutSpecs.newPost)) {
        e.preventDefault();
        window.location.hash = "#/posts/new";
        return;
      }
      if (matchChord(e, shortcutSpecs.goHome)) {
        e.preventDefault();
        window.location.href = "/articles";
        return;
      }

      const backSeq = parseSeq(shortcutSpecs.back);
      const fwdSeq = parseSeq(shortcutSpecs.forward);
      if (matchChord(e, shortcutSpecs.back) || matchSeq(backSeq)) {
        e.preventDefault();
        history.back();
        return;
      }
      if (matchChord(e, shortcutSpecs.forward) || matchSeq(fwdSeq)) {
        e.preventDefault();
        history.forward();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [shortcutSpecs]);

  useEffect(() => setError(null), [route.page]);
  const authed = !!user;

  const pageInfo = useMemo(() => {
    if (!authed) return { title: "登录", crumb: "Auth / Login" };
    if (route.page === "settings") return { title: "设置", crumb: "站点 / Settings" };
    if (route.page === "account") return { title: "账号", crumb: "安全 / Preferences" };
    if (route.page === "edit" && (route as any).id === "new") return { title: "新建", crumb: "写作 / New" };
    if (route.page === "edit") return { title: "编辑", crumb: "写作 / Edit" };
    return { title: "文章", crumb: "内容管理 / Posts" };
  }, [authed, route.page, (route as any).id]);

  const currentPageKey =
    route.page === "edit" && (route as any).id === "new"
      ? "new"
      : route.page === "edit"
        ? "posts"
        : route.page;

  const mainContent = !authed ? (
    <div className="center-wrap">
      <div className="login-card">
        {error ? (
          <div className="card danger" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}
        <LoginPage
          onLoggedIn={async () => {
            try {
              const me = await adminMe();
              setUser(me);
              try {
                const p = await getAdminPrefs();
                setPrefs(p);
              } catch {
                setPrefs(null);
              }
              window.location.hash = "#/posts";
            } catch (e) {
              const err = e as ApiError;
              setError(err.message || "登录失败");
            }
          }}
          onError={(m) => setError(m || null)}
        />
      </div>
    </div>
  ) : route.page === "account" ? (
    <AccountPage
      prefs={prefs}
      onPrefs={setPrefs}
      onError={(m) => setError(m || null)}
      onForceRelogin={() => {
        setUser(null);
        setPrefs(null);
        window.location.hash = "#/login";
      }}
    />
  ) : route.page === "settings" ? (
    <SettingsPage cfg={cfg} onCfg={setCfg} onError={(m) => setError(m || null)} />
  ) : route.page === "edit" ? (
    <EditorPage
      id={(route as any).id}
      cfg={cfg}
      prefs={prefs}
      onPrefs={setPrefs}
      onError={(m) => setError(m || null)}
    />
  ) : (
    <PostsPage cfg={cfg} onError={(m) => setError(m || null)} />
  );

  if (!authed) {
    return mainContent;
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="侧边栏导航">
        <div className="brand">
          <div className="brand-left">
            <div className="logo" aria-hidden="true"></div>
            <div className="brand-title">
              <strong>Bitlog Admin</strong>
              <span>{cfg?.adminStyle ?? "current"}</span>
            </div>
          </div>
          <button
            className="iconbtn"
            type="button"
            aria-label="折叠/展开侧边栏"
            title="折叠/展开"
            onClick={() => {
              const root = document.documentElement;
              const current = root.getAttribute("data-sidebar") === "collapsed" ? "collapsed" : "expanded";
              const next = current === "collapsed" ? "expanded" : "collapsed";
              root.setAttribute("data-sidebar", next);
              try {
                localStorage.setItem("ui-admin-sidebar", next);
              } catch {
                // ignore
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 4h7v16H3z" />
              <path d="M14 4h7v16h-7z" />
            </svg>
          </button>
        </div>

        <nav className="nav" aria-label="主菜单">
          <a href="#/posts" aria-current={currentPageKey === "posts" ? "page" : "false"}>
            <span className="ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16v6H4z" />
                <path d="M4 14h16v6H4z" />
              </svg>
            </span>
            <span>
              <div className="lbl">文章</div>
              <div className="sub">列表 / 编辑</div>
            </span>
            <span className="meta">P</span>
          </a>

          <a href="#/posts/new" aria-current={currentPageKey === "new" ? "page" : "false"}>
            <span className="ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span>
              <div className="lbl">新建</div>
              <div className="sub">快速发布</div>
            </span>
            <span className="meta">⌘N</span>
          </a>

          <a href="#/settings" aria-current={currentPageKey === "settings" ? "page" : "false"}>
            <span className="ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                <path d="M19.4 15a7.7 7.7 0 0 0 .1-1l2-1.1-2-3.5-2.3.4a7.7 7.7 0 0 0-1.7-1l-.7-2.2H9.2l-.7 2.2a7.7 7.7 0 0 0-1.7 1L4.5 9.4l-2 3.5L4.5 14a7.7 7.7 0 0 0 .1 1l-2 1.1 2 3.5 2.3-.4a7.7 7.7 0 0 0 1.7 1l.7 2.2h5.6l.7-2.2a7.7 7.7 0 0 0 1.7-1l2.3.4 2-3.5-2-1.1Z" />
              </svg>
            </span>
            <span>
              <div className="lbl">设置</div>
              <div className="sub">站点 / 工具</div>
            </span>
            <span className="meta">S</span>
          </a>

          <a href="#/account" aria-current={currentPageKey === "account" ? "page" : "false"}>
            <span className="ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21a8 8 0 1 0-16 0" />
                <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
              </svg>
            </span>
            <span>
              <div className="lbl">账号</div>
              <div className="sub">安全 / 偏好</div>
            </span>
            <span className="meta">@</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="me">
            <div className="me-text">
              <strong>@{user?.username ?? "admin"}</strong>
              <small>Site-level UI</small>
            </div>
            <button
              className="iconbtn"
              type="button"
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                try {
                  await adminLogout();
                } finally {
                  setUser(null);
                  setPrefs(null);
                  window.location.hash = "#/login";
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M21 3v18" />
              </svg>
            </button>
        </div>
          <a className="btn btn-site" href="/articles" title="前往站点" aria-label="前往站点">
            <span className="btn-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18" />
                <path d="M12 3v18" />
              </svg>
            </span>
            <span className="btn-label">前往站点</span>
          </a>
        </div>
      </aside>

      <main className="main" id="main">
        <header className="topbar" aria-label="页面头部">
          <div className="title">
            <h1>{pageInfo.title}</h1>
            <div className="crumb">{pageInfo.crumb}</div>
          </div>
          <div className="actions">
            <button
              className="iconbtn"
              id="themeToggle"
              type="button"
              aria-label="切换主题"
              title="切换主题"
              onClick={(e) => {
                const next = theme === "dark" ? "light" : "dark";
                applyThemeWithTransition({ next, toggleEl: e.currentTarget, event: e });
                setThemeState(next);
              }}
            >
              {theme === "dark" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.41 1.41M8.34 15.66l-1.41 1.41m0-11.31 1.41 1.41m8.32 8.32 1.41 1.41"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </header>

        <section className="content">
          <div className="content-full">
            {error ? (
              <div className="card danger" style={{ marginBottom: 12 }}>
                {error}
              </div>
            ) : null}
            {mainContent}
          </div>
        </section>
      </main>
    </div>
  );
}
