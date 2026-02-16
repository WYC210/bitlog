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

  useEffect(() => {
    void (async () => {
      try {
        const c = await getConfig();
        setCfg(c);
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

  const topNav = useMemo(() => {
    return (
      <div className="topbar">
        <div className="topbar-inner">
          <div className="nav">
            <span className="brand">Bitlog Admin</span>
            <a className="chip" href="/articles">
              站点
            </a>
            <a className={`chip ${route.page === "posts" || route.page === "edit" ? "chip-primary" : ""}`} href="#/posts">
              文章
            </a>
            <a className={`chip ${route.page === "account" ? "chip-primary" : ""}`} href="#/account">
              账号
            </a>
            <a className={`chip ${route.page === "settings" ? "chip-primary" : ""}`} href="#/settings">
              设置
            </a>
          </div>
          <div className="nav">
            {user ? <span className="muted">@{user.username}</span> : <span className="muted">未登录</span>}
            {user ? (
              <button
                className="chip"
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
                退出
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }, [route.page, user]);

  const authed = !!user;

  return (
    <>
      {topNav}
      <div className="shell">
        {error ? (
          <div className="card danger" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        {!authed ? (
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
          <EditorPage id={route.id} cfg={cfg} prefs={prefs} onPrefs={setPrefs} onError={(m) => setError(m || null)} />
        ) : (
          <PostsPage cfg={cfg} onError={(m) => setError(m || null)} />
        )}
      </div>
    </>
  );
}
