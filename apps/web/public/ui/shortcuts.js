(function () {
  const shortcutsText = (window.__bitlogShortcutsText || "").toString();
  const page = (document.body && document.body.dataset && document.body.dataset.page) || "global";
  const search = document.getElementById("navSearch");

  const LIST_CTX_KEY = "bitlog:web:articlesListContext:v1";
  const LIST_CTX_TTL_MS = 60 * 60 * 1000;

  function isTypingTarget(e) {
    const t = e && e.target;
    if (!t) return false;
    const tag = (t.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable;
  }

  function parseShortcuts() {
    try {
      return shortcutsText ? JSON.parse(shortcutsText) : {};
    } catch {
      return {};
    }
  }

  function escapeHtml(input) {
    return String(input ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getWebNavConfig() {
    const raw = window.__bitlogWebNav;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return null;
  }

  function normalizePathname(pathname) {
    const p = String(pathname || "/");
    if (p === "/") return "/";
    return p.endsWith("/") ? p.slice(0, -1) : p;
  }

  function normalizeWebNavItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const label = String(raw.label || "").trim();
    const href = String(raw.href || "").trim();
    if (!id || !label || !href) return null;
    const enabled = raw.enabled === false ? false : true;
    const external = raw.external === true || /^https?:\/\//i.test(href);
    return { id, label, href, enabled, external };
  }

  function listEnabledNavItems() {
    const cfg = getWebNavConfig();
    if (!cfg) return [];
    const out = [];
    const seen = new Set();
    for (const it of cfg) {
      const n = normalizeWebNavItem(it);
      if (!n || !n.enabled) continue;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
      if (out.length >= 24) break;
    }
    return out;
  }

  function pickNavHrefByIdOrPath(id, path) {
    const items = listEnabledNavItems();
    const byId = items.find((x) => x.id === id);
    if (byId) return byId.href;
    const want = normalizePathname(path);
    const byPath = items.find((x) => !x.external && normalizePathname(x.href) === want);
    return byPath ? byPath.href : null;
  }

  const sc = parseShortcuts();
  const contexts = (sc && typeof sc === "object" && sc.contexts && typeof sc.contexts === "object") ? sc.contexts : {};
  const global = (sc && typeof sc === "object" && sc.global && typeof sc.global === "object") ? sc.global : {};
  const web = (sc && typeof sc === "object" && sc.web && typeof sc.web === "object") ? sc.web : {};
  const effective = Object.assign(
    {},
    contexts["web.global"] || {},
    contexts[page] || {},
    contexts[`web.${page}`] || {},
    web || {},
    global || {}
  );

  function getSpec(keys, fallback) {
    for (const k of keys) {
      const v = effective && effective[k];
      if (v) return String(v);
    }
    return fallback;
  }

  const specs = {
    openCommandPalette: getSpec(["openCommandPalette", "commandPalette", "palette"], "?"),
    focusSearch: getSpec(["focusSearch"], "/"),
    toggleLightDark: getSpec(["toggleLightDark", "toggleTheme", "themeToggle"], "shift+d"),
    goHome: getSpec(["goHome"], "g h"),
    goArticles: getSpec(["goArticles"], "g a"),
    goProjects: getSpec(["goProjects"], "g p"),
    goTools: getSpec(["goTools"], "g t"),
    goAbout: getSpec(["goAbout"], "g o"),
    goAdminPosts: getSpec(["goAdminPosts"], ""),
    goAdminSettings: getSpec(["goAdminSettings"], ""),
    goAdminAccount: getSpec(["goAdminAccount"], ""),
    newPost: getSpec(["newPost"], ""),
    postPrev: getSpec(["postPrev"], "k"),
    postNext: getSpec(["postNext"], "j"),
    back: getSpec(["goBack", "back"], "g b"),
    forward: getSpec(["goForward", "forward"], "g n")
  };

  function matchChord(e, combo) {
    const s = String(combo || "").trim().toLowerCase();
    if (!s || s.includes(" ")) return false;
    const parts = s
      .split("+")
      .map((x) => x.trim())
      .filter(Boolean);
    const key = String(e.key || "").toLowerCase();
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

  function parseSeq(spec) {
    const s = String(spec || "").trim().toLowerCase();
    if (!s.includes(" ")) return null;
    return s
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  let seq = [];
  let seqTimer = null;
  function pushSeq(key) {
    if (!key || key.length !== 1) return;
    seq.push(key);
    if (seq.length > 6) seq.shift();
    if (seqTimer) clearTimeout(seqTimer);
    seqTimer = setTimeout(() => {
      seq = [];
      seqTimer = null;
    }, 900);
  }
  function matchSeq(keys) {
    if (!keys || !keys.length) return false;
    if (seq.length < keys.length) return false;
    const tail = seq.slice(seq.length - keys.length);
    for (let i = 0; i < keys.length; i++) {
      if (tail[i] !== keys[i]) return false;
    }
    return true;
  }

  function focusSearch() {
    if (!search) return;
    search.focus();
    try {
      search.select();
    } catch {}
  }

  function toggleLightDark() {
    const btn = document.getElementById("themeToggle");
    if (btn && typeof btn.click === "function") btn.click();
  }

  function go(href) {
    const target = String(href || "").trim();
    if (!target) return;
    try {
      if (window.__bitlogSpaNavigate) {
        window.__bitlogSpaNavigate(target, { history: "push" });
        return;
      }
    } catch {}
    window.location.href = target;
  }

  (function maybeAutoFocusSearch() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("focus") !== "1") return;
      focusSearch();
      url.searchParams.delete("focus");
      history.replaceState(null, "", url.toString());
    } catch {}
  })();

  function getCurrentPostSlug() {
    try {
      const url = new URL(window.location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "articles" || !parts[1]) return null;
      return decodeURIComponent(parts[1]);
    } catch {
      return null;
    }
  }

  function readListContext() {
    try {
      const raw = sessionStorage.getItem(LIST_CTX_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.at !== "number" || Date.now() - parsed.at > LIST_CTX_TTL_MS) return null;
      if (!Array.isArray(parsed.slugs)) return null;
      const titles = parsed.titles && typeof parsed.titles === "object" ? parsed.titles : null;
      return {
        at: parsed.at,
        slugs: parsed.slugs.map(String),
        titles: titles,
        from: String(parsed.from || "")
      };
    } catch {
      return null;
    }
  }

  function writeListContext(payload) {
    try {
      const slugs = Array.isArray(payload && payload.slugs) ? payload.slugs : [];
      const from = payload && payload.from ? payload.from : "";
      const titles = payload && payload.titles && typeof payload.titles === "object" ? payload.titles : null;
      sessionStorage.setItem(
        LIST_CTX_KEY,
        JSON.stringify({
          v: 2,
          at: Date.now(),
          slugs: slugs.slice(0, 200),
          titles: titles,
          from: String(from || "")
        })
      );
    } catch {}
  }

  function getPostPrevNext() {
    if (page !== "post") return { prev: null, next: null };
    const slug = getCurrentPostSlug();
    if (!slug) return { prev: null, next: null };
    const ctx = readListContext();
    if (!ctx) return { prev: null, next: null };
    const idx = ctx.slugs.indexOf(slug);
    if (idx === -1) return { prev: null, next: null };
    const prev = idx > 0 ? ctx.slugs[idx - 1] : null;
    const next = idx + 1 < ctx.slugs.length ? ctx.slugs[idx + 1] : null;
    return { prev, next };
  }

  const postNav = getPostPrevNext();
  const canPostPrev = !!postNav.prev;
  const canPostNext = !!postNav.next;

  function ensurePostNavUi() {
    if (page !== "post") return;
    if (!canPostPrev && !canPostNext) return;
    const body = document.querySelector("article.card .card-body");
    if (!body) return;
    if (document.getElementById("postNav")) return;
    const ctx = readListContext();
    const titles = (ctx && ctx.titles && typeof ctx.titles === "object") ? ctx.titles : null;
    const titleOf = (slug) => {
      try {
        if (!titles || !slug) return "";
        const t = titles[slug];
        return (t && String(t).trim()) || "";
      } catch {
        return "";
      }
    };
    const wrap = document.createElement("div");
    wrap.id = "postNav";
    wrap.className = "post-nav";
    const mk = (kind, label, slug) => {
      const title = titleOf(slug) || (slug ? slug : (kind === "prev" ? "没有上一篇" : "没有下一篇"));
      if (!slug) {
        return `<div class="post-nav-item ${kind} is-disabled" aria-disabled="true">
  <div class="post-nav-label">${label}</div>
  <div class="post-nav-title">${title}</div>
</div>`;
      }
      return `<a class="post-nav-item ${kind}" href="/articles/${encodeURIComponent(slug)}">
  <div class="post-nav-label">${label}</div>
  <div class="post-nav-title">${title}</div>
</a>`;
    };
    wrap.innerHTML = `${mk("prev", "上一篇", postNav.prev)}${mk("next", "下一篇", postNav.next)}`;
    body.appendChild(wrap);
  }

  function ensurePostBackLink() {
    if (page !== "post") return;
    const a = document.getElementById("postBack");
    if (!a) return;
    const ctx = readListContext();
    const from = ctx && typeof ctx.from === "string" ? ctx.from : "";
    const href = from && from.startsWith("/") ? from : "/articles";
    a.setAttribute("href", href);
  }

  function postPrev() {
    if (!canPostPrev) return;
    go(`/articles/${encodeURIComponent(postNav.prev)}`);
  }
  function postNext() {
    if (!canPostNext) return;
    go(`/articles/${encodeURIComponent(postNav.next)}`);
  }

  function getActions() {
    const actions = [
      { id: "focusSearch", label: "聚焦搜索", desc: "聚焦顶部搜索框", binding: specs.focusSearch, run: focusSearch },
      { id: "toggleLightDark", label: "切换 light/dark", desc: "只影响当前设备", binding: specs.toggleLightDark, run: toggleLightDark },
      { id: "goHome", label: "跳转首页", desc: "打开 /", binding: specs.goHome, run: () => go("/") },
      { id: "goArticles", label: "跳转文章列表", desc: "打开 /articles", binding: specs.goArticles, run: () => go("/articles") },
      { id: "goProjects", label: "跳转项目页", desc: "打开 /projects", binding: specs.goProjects, run: () => go("/projects") },
      { id: "goTools", label: "跳转工具中心", desc: "打开 /tools", binding: specs.goTools, run: () => go("/tools") },
      { id: "goAbout", label: "跳转关于我", desc: "打开 /about", binding: specs.goAbout, run: () => go("/about") },
      { id: "back", label: "后退", desc: "history.back()", binding: specs.back, run: () => history.back() },
      { id: "forward", label: "前进", desc: "history.forward()", binding: specs.forward, run: () => history.forward() }
    ];

    const core = [
      { navId: "home", actionId: "goHome", fallback: "/" },
      { navId: "articles", actionId: "goArticles", fallback: "/articles" },
      { navId: "projects", actionId: "goProjects", fallback: "/projects" },
      { navId: "tools", actionId: "goTools", fallback: "/tools" },
      { navId: "about", actionId: "goAbout", fallback: "/about" }
    ];

    for (const c of core) {
      const a = actions.find((x) => x && x.id === c.actionId);
      if (!a) continue;
      const href = pickNavHrefByIdOrPath(c.navId, c.fallback);
      if (!href) {
        a.enabled = false;
        continue;
      }
      a.enabled = true;
      a.desc = `鎵撳紑 ${href}`;
      a.run = () => go(href);
    }

    const nav = listEnabledNavItems();
    for (const it of nav) {
      if (["home", "articles", "projects", "tools", "about"].includes(it.id)) continue;
      actions.push({
        id: `nav:${it.id}`,
        label: `璺宠浆${it.label}`,
        desc: `鎵撳紑 ${it.href}`,
        binding: "",
        run: () => go(it.href)
      });
    }

    if (page === "post" && (canPostPrev || canPostNext)) {
      actions.push({
        id: "postPrev",
        label: "上一篇（文章页）",
        desc: "按列表顺序",
        binding: specs.postPrev,
        run: postPrev,
        enabled: canPostPrev
      });
      actions.push({
        id: "postNext",
        label: "下一篇（文章页）",
        desc: "按列表顺序",
        binding: specs.postNext,
        run: postNext,
        enabled: canPostNext
      });
    }

    if (specs.goAdminPosts) {
      actions.push({
        id: "goAdminPosts",
        label: "跳转后台文章",
        desc: "打开 /admin/#/posts",
        binding: specs.goAdminPosts,
        run: () => go("/admin/#/posts")
      });
    }
    if (specs.goAdminSettings) {
      actions.push({
        id: "goAdminSettings",
        label: "跳转后台设置",
        desc: "打开 /admin/#/settings",
        binding: specs.goAdminSettings,
        run: () => go("/admin/#/settings")
      });
    }
    if (specs.goAdminAccount) {
      actions.push({
        id: "goAdminAccount",
        label: "跳转后台账号",
        desc: "打开 /admin/#/account",
        binding: specs.goAdminAccount,
        run: () => go("/admin/#/account")
      });
    }
    if (specs.newPost) {
      actions.push({
        id: "newPost",
        label: "新建文章（后台）",
        desc: "打开 /admin/#/posts/new",
        binding: specs.newPost,
        run: () => go("/admin/#/posts/new")
      });
    }

    return actions;
  }

  function openPalette() {
    ensurePalette();
    try {
      if (window.__bitlogSwmIsOpen && window.__bitlogSwmIsOpen()) window.__bitlogSwmOpen(false);
    } catch {}
    window.__bitlogCmdpOpen(true);
  }

  function closePalette() {
    if (window.__bitlogCmdpOpen) window.__bitlogCmdpOpen(false);
  }

  function ensurePalette() {
    if (window.__bitlogCmdpOpen) return;

    const overlay = document.createElement("div");
    overlay.className = "blcmd-overlay";
    overlay.style.display = "none";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "命令面板");

    const panel = document.createElement("div");
    panel.className = "blcmd-panel";
    panel.innerHTML = `
      <div class="blcmd-head">
        <input class="blcmd-input" placeholder="搜索动作…" />
        <button class="blcmd-close" type="button" aria-label="关闭">Esc</button>
      </div>
      <div class="blcmd-list"></div>
      <div class="blcmd-foot"><span class="blcmd-hint">提示：不想记快捷键时，用这里搜索即可。</span></div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const input = panel.querySelector(".blcmd-input");
    const list = panel.querySelector(".blcmd-list");
    const closeBtn = panel.querySelector(".blcmd-close");

    function render() {
      const keyword = String(input.value || "").trim().toLowerCase();
      const actions = getActions().filter((a) => {
        if (!keyword) return true;
        return `${a.label} ${a.desc}`.toLowerCase().includes(keyword);
      });
      list.innerHTML = "";
      if (actions.length === 0) {
        const empty = document.createElement("div");
        empty.className = "blcmd-empty";
        empty.textContent = "无匹配动作";
        list.appendChild(empty);
        return;
      }
      for (const a of actions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "blcmd-item";
        if (a.enabled === false) {
          btn.disabled = true;
          btn.className += " is-disabled";
        }
        btn.innerHTML = `
          <div class="blcmd-main">
            <div class="blcmd-title">${a.label}</div>
            <div class="blcmd-desc">${a.desc || ""}</div>
          </div>
          ${a.binding ? `<kbd class="blcmd-kbd">${a.binding}</kbd>` : ""}
        `;
        btn.addEventListener("click", () => {
          window.__bitlogCmdpOpen(false);
          a.run();
        });
        list.appendChild(btn);
      }
    }

    overlay.addEventListener("mousedown", (e) => {
      if (e.target !== overlay) return;
      // Prevent click-through: if we close on mousedown, the mouseup/click can land on the page behind.
      e.preventDefault();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target !== overlay) return;
      e.preventDefault();
      e.stopPropagation();
      window.__bitlogCmdpOpen(false);
    });
    closeBtn.addEventListener("click", () => window.__bitlogCmdpOpen(false));
    input.addEventListener("input", render);

    let openNow = false;
    window.__bitlogCmdpOpen = (open) => {
      openNow = !!open;
      overlay.style.display = open ? "grid" : "none";
      if (open) {
        input.value = "";
        render();
        setTimeout(() => input.focus(), 0);
      }
    };
    window.__bitlogCmdpIsOpen = () => openNow;
  }

  function getCommandMenuLayout() {
    const s = String(document.documentElement?.dataset?.cmdLayout || "").trim().toLowerCase();
    if (s === "grid" || s === "dial" || s === "cmd") return s;
    return "arc";
  }

  function getCommandMenuConfirmMode() {
    const s = String(document.documentElement?.dataset?.cmdConfirm || "").trim().toLowerCase();
    return s === "release" ? "release" : "enter";
  }

  function isAltBackquote(e) {
    return !!e.altKey && !e.ctrlKey && !e.metaKey && String(e.code || "") === "Backquote";
  }

  function wrapIndex(idx, n) {
    if (n <= 0) return 0;
    return ((idx % n) + n) % n;
  }

  function ensureSwitchMenu() {
    if (window.__bitlogSwmOpen) return;

    const overlay = document.createElement("div");
    overlay.className = "blsw-overlay";
    overlay.style.display = "none";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "菜单");

    const scene = document.createElement("div");
    scene.className = "blsw-scene";
    scene.innerHTML = `
      <div class="blsw-info" aria-hidden="true">
        <div class="blsw-info-title"></div>
        <div class="blsw-info-desc"></div>
      </div>
      <div class="blsw-strip"></div>
    `;
    overlay.appendChild(scene);
    document.body.appendChild(overlay);

    const infoTitle = scene.querySelector(".blsw-info-title");
    const infoDesc = scene.querySelector(".blsw-info-desc");
    const strip = scene.querySelector(".blsw-strip");

    const state = {
      open: false,
      layout: "arc",
      confirmMode: "enter",
      holdArmed: false,
      active: 0,
      query: "",
      visible: []
    };

    function accentForId(id) {
      const s = String(id || "");
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      const hue = h % 360;
      return `hsl(${hue} 92% 58%)`;
    }

    function iconSvg(id) {
      const s = String(id || "");
      if (s === "focusSearch") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>`;
      }
      if (s === "toggleLightDark") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      if (s === "goHome") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9.5V21h14V9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      if (s === "goArticles") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Z"/><path d="M8 7h8" stroke-linecap="round"/><path d="M8 11h8" stroke-linecap="round"/><path d="M8 15h6" stroke-linecap="round"/></svg>`;
      }
      if (s === "goProjects") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h8v10H3z"/><path d="M13 7h8v10h-8z"/></svg>`;
      }
      if (s === "goTools") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg>`;
      }
      if (s === "goAbout") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c2-4 6-6 8-6s6 2 8 6" stroke-linecap="round"/></svg>`;
      }
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v6H4z"/><path d="M4 14h16v6H4z"/></svg>`;
    }

    function listVisible() {
      const all = getActions();
      const q = String(state.query || "").trim().toLowerCase();
      if (!q) return all;
      return all.filter((a) => `${a.label} ${a.desc}`.toLowerCase().includes(q));
    }

    function renderSelection() {
      const a = state.visible[wrapIndex(state.active, state.visible.length)] || null;
      if (infoTitle) infoTitle.textContent = a ? a.label : "";
      if (infoDesc) infoDesc.textContent = state.query ? `搜索：${state.query}` : a ? a.desc || "" : "";

      const tiles = Array.from(strip.querySelectorAll(".blsw-tile"));
      for (const t of tiles) {
        const idx = Number(t.getAttribute("data-idx") || "0");
        t.setAttribute("aria-selected", idx === wrapIndex(state.active, state.visible.length) ? "true" : "false");
      }
      if (state.layout === "arc") layoutArc(strip, wrapIndex(state.active, state.visible.length));
      if (state.layout === "grid") {
        const el = strip.querySelector(`[data-idx="${wrapIndex(state.active, state.visible.length)}"]`);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
      if (state.layout === "dial") {
        const wheel = strip.querySelector(".blsw-dial-wheel");
        if (wheel) {
          const n = Math.max(1, state.visible.length);
          wheel.style.setProperty("--wedge-mid", `${(wrapIndex(state.active, n) * 360) / n}deg`);
          wheel.style.setProperty("--wedge-span", `${Math.min(140, Math.max(32, (360 / n) * 0.92))}deg`);
          wheel.style.setProperty("--wedge-accent", accentForId(a ? a.id : ""));
        }
        const centerTitle = strip.querySelector(".blsw-dial-center-title");
        const centerDesc = strip.querySelector(".blsw-dial-center-desc");
        if (centerTitle) centerTitle.textContent = a ? a.label : "";
        if (centerDesc) centerDesc.textContent = state.query ? `搜索：${state.query}` : a ? a.desc || "" : "";
        const items = Array.from(strip.querySelectorAll(".blsw-dial-item"));
        for (const t of items) {
          const idx = Number(t.getAttribute("data-idx") || "0");
          t.setAttribute("aria-selected", idx === wrapIndex(state.active, state.visible.length) ? "true" : "false");
        }
      }
    }

    function confirm() {
      const a = state.visible[wrapIndex(state.active, state.visible.length)] || null;
      if (!a) return;
      if (a.enabled === false) return;
      close();
      try {
        a.run();
      } catch {}
    }

    function render() {
      state.visible = listVisible();
      if (state.visible.length === 0) state.active = 0;
      if (state.active >= state.visible.length) state.active = 0;

      strip.className = `blsw-strip is-${state.layout}`;
      strip.innerHTML = "";

      if (state.layout === "dial") {
        const dial = document.createElement("div");
        dial.className = "blsw-dial";
        dial.innerHTML = `
          <div class="blsw-dial-wheel"><div class="blsw-dial-wedge" aria-hidden="true"></div></div>
          <div class="blsw-dial-center" aria-hidden="true">
            <div class="blsw-dial-center-title"></div>
            <div class="blsw-dial-center-desc"></div>
          </div>
          <div class="blsw-dial-items"></div>
        `;
        strip.appendChild(dial);

        const wheel = dial.querySelector(".blsw-dial-wheel");
        const itemsWrap = dial.querySelector(".blsw-dial-items");

        dial.addEventListener("pointermove", (e) => {
          const n = state.visible.length;
          if (n <= 0) return;
          const rect = dial.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = e.clientX - cx;
          const dy = e.clientY - cy;
          const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
          const fromTop = (deg + 90 + 360) % 360;
          const seg = 360 / n;
          state.active = wrapIndex(Math.floor((fromTop + seg / 2) / seg), n);
          renderSelection();
        });

        if (wheel) {
          wheel.addEventListener("click", () => confirm());
        }

        for (let i = 0; i < state.visible.length; i++) {
          const a = state.visible[i];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "blsw-dial-item";
          btn.setAttribute("data-idx", String(i));
          btn.setAttribute("aria-selected", "false");
          btn.style.setProperty("--blsw-accent", accentForId(a.id));
          const n = Math.max(1, state.visible.length);
          const mid = -90 + (i * 360) / n;
          const p = polar(50, 50, 47.2, mid);
          btn.style.left = `${p.x.toFixed(3)}%`;
          btn.style.top = `${p.y.toFixed(3)}%`;
          btn.textContent = String(a.label || "").trim().slice(0, 1) || "•";
          btn.addEventListener("mouseenter", () => {
            state.active = i;
            renderSelection();
          });
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            state.active = i;
            confirm();
          });
          itemsWrap.appendChild(btn);
        }
      } else {
        for (let i = 0; i < state.visible.length; i++) {
          const a = state.visible[i];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "blsw-tile";
          btn.setAttribute("data-idx", String(i));
          btn.setAttribute("aria-selected", "false");
          btn.style.setProperty("--blsw-accent", accentForId(a.id));
          const binding = String(a.binding || "").trim();
          btn.innerHTML = `
            <div class="blsw-tile-center">
              <span class="blsw-tile-ico" aria-hidden="true">${iconSvg(a.id)}</span>
              <div class="blsw-tile-title">${escapeHtml(String(a.label || ""))}</div>
              ${binding ? `<kbd class="blsw-tile-kbd">${escapeHtml(binding)}</kbd>` : ""}
              <div class="blsw-tile-desc">${escapeHtml(String(a.desc || ""))}</div>
            </div>
          `;
          btn.addEventListener("mouseenter", () => {
            state.active = i;
            renderSelection();
          });
          btn.addEventListener("click", () => {
            state.active = i;
            confirm();
          });
          strip.appendChild(btn);
        }
      }

      renderSelection();
    }

    function open(opts) {
      try {
        if (window.__bitlogCmdpIsOpen && window.__bitlogCmdpIsOpen()) window.__bitlogCmdpOpen(false);
      } catch {}
      state.layout = opts && opts.layout ? String(opts.layout) : "arc";
      if (state.layout !== "arc" && state.layout !== "grid" && state.layout !== "dial") state.layout = "arc";
      state.confirmMode = opts && opts.confirmMode === "release" ? "release" : "enter";
      state.holdArmed = !!(opts && opts.holdArmed);
      state.query = "";
      state.active = 0;
      overlay.style.display = "grid";
      state.open = true;
      const handle = document.getElementById("blswHandle");
      if (handle) handle.classList.add("is-hidden");
      render();
    }

    function close() {
      overlay.style.display = "none";
      state.open = false;
      state.holdArmed = false;
      state.query = "";
      const handle = document.getElementById("blswHandle");
      if (handle) handle.classList.remove("is-hidden");
    }

    function handleKeydown(e) {
      if (!state.open) return false;

      if (e.key === "Escape") {
        e.preventDefault();
        if (state.query) {
          state.query = "";
          state.active = 0;
          render();
          return true;
        }
        close();
        return true;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        confirm();
        return true;
      }

      if (state.layout === "grid") {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          state.active = wrapIndex(state.active - 2, state.visible.length);
          renderSelection();
          return true;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          state.active = wrapIndex(state.active + 2, state.visible.length);
          renderSelection();
          return true;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          state.active = wrapIndex(state.active - 1, state.visible.length);
          renderSelection();
          return true;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          state.active = wrapIndex(state.active + 1, state.visible.length);
          renderSelection();
          return true;
        }
      } else {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          state.active = wrapIndex(state.active - 1, state.visible.length);
          renderSelection();
          return true;
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          state.active = wrapIndex(state.active + 1, state.visible.length);
          renderSelection();
          return true;
        }
      }

      if (e.key === "Backspace") {
        if (!state.query) return false;
        e.preventDefault();
        state.query = state.query.slice(0, -1);
        state.active = 0;
        render();
        return true;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && String(e.key || "").length === 1) {
        const ch = String(e.key || "");
        if (!/[\u0000-\u001f]/.test(ch)) {
          e.preventDefault();
          state.query += ch;
          state.active = 0;
          render();
          return true;
        }
      }

      return false;
    }

    function handleKeyup(e) {
      if (!state.open) return false;
      if (state.confirmMode !== "release") return false;
      if (!state.holdArmed) return false;
      if (String(e.code || "") !== "Backquote" && String(e.key || "").toLowerCase() !== "alt") return false;
      e.preventDefault();
      state.holdArmed = false;
      confirm();
      return true;
    }

    const isInsideMenuArea = (target) => {
      if (!target || !target.closest) return false;
      if (target.closest(".blsw-tile")) return true;
      if (target.closest(".blsw-dial")) return true;
      if ((state.layout === "grid" || state.layout === "dial") && target.closest(".blsw-strip")) return true;
      return false;
    };

    let swallowClickOnce = false;
    overlay.addEventListener(
      "click",
      (e) => {
        if (!swallowClickOnce) return;
        swallowClickOnce = false;
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    // Mobile swipe (arc): horizontal drag to switch selection.
    const swipe = { tracking: false, pointerId: null, startX: 0, startY: 0, lastStep: 0, didSwipe: false };
    const SWIPE_ACTIVATE_PX = 34;
    const SWIPE_STEP_PX = 62;

    // Touch fallback for browsers where PointerEvents are flaky (notably some iOS Safari versions).
    const touchSwipe = { tracking: false, startX: 0, startY: 0, lastStep: 0, didSwipe: false };
    overlay.addEventListener(
      "touchstart",
      (e) => {
        if (!state.open) return;
        if (state.layout !== "arc") return;
        if (!e.touches || e.touches.length !== 1) return;
        const t = e.touches[0];
        if (!t) return;
        touchSwipe.tracking = true;
        touchSwipe.startX = t.clientX;
        touchSwipe.startY = t.clientY;
        touchSwipe.lastStep = 0;
        touchSwipe.didSwipe = false;
      },
      { passive: true }
    );
    overlay.addEventListener(
      "touchmove",
      (e) => {
        if (!touchSwipe.tracking) return;
        if (!e.touches || e.touches.length !== 1) return;
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - touchSwipe.startX;
        const dy = t.clientY - touchSwipe.startY;
        if (Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx)) {
          touchSwipe.tracking = false;
          return;
        }
        if (Math.abs(dx) < SWIPE_ACTIVATE_PX) return;
        e.preventDefault();
        const step = Math.trunc(dx / SWIPE_STEP_PX);
        const diff = step - touchSwipe.lastStep;
        if (diff === 0) return;
        touchSwipe.didSwipe = true;
        touchSwipe.lastStep = step;
        const n = state.visible.length;
        if (n <= 0) return;
        state.active = wrapIndex(state.active + -diff, n);
        renderSelection();
      },
      { passive: false }
    );
    const endTouchSwipe = () => {
      if (!touchSwipe.tracking) return;
      touchSwipe.tracking = false;
      if (touchSwipe.didSwipe) swallowClickOnce = true;
    };
    overlay.addEventListener("touchend", endTouchSwipe, { passive: true });
    overlay.addEventListener("touchcancel", endTouchSwipe, { passive: true });
    overlay.addEventListener(
      "pointerdown",
      (e) => {
        if (!state.open) return;
        if (e.pointerType === "mouse") return;
        if (state.layout !== "arc") return;
        swipe.tracking = true;
        swipe.pointerId = e.pointerId;
        swipe.startX = e.clientX;
        swipe.startY = e.clientY;
        swipe.lastStep = 0;
        swipe.didSwipe = false;
      },
      { passive: true }
    );
    overlay.addEventListener(
      "pointermove",
      (e) => {
        if (!swipe.tracking) return;
        if (swipe.pointerId !== null && e.pointerId !== swipe.pointerId) return;
        const dx = e.clientX - swipe.startX;
        const dy = e.clientY - swipe.startY;
        if (Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx)) {
          swipe.tracking = false;
          swipe.pointerId = null;
          return;
        }
        if (Math.abs(dx) < SWIPE_ACTIVATE_PX) return;
        const step = Math.trunc(dx / SWIPE_STEP_PX);
        const diff = step - swipe.lastStep;
        if (diff === 0) return;
        swipe.didSwipe = true;
        swipe.lastStep = step;
        const n = state.visible.length;
        if (n <= 0) return;
        state.active = wrapIndex(state.active + -diff, n);
        renderSelection();
      },
      { passive: true }
    );
    const endSwipe = (e) => {
      if (!swipe.tracking) return;
      if (swipe.pointerId !== null && e.pointerId !== swipe.pointerId) return;
      swipe.tracking = false;
      swipe.pointerId = null;
      if (swipe.didSwipe) swallowClickOnce = true;
    };
    overlay.addEventListener("pointerup", endSwipe, { passive: true });
    overlay.addEventListener("pointercancel", endSwipe, { passive: true });

    overlay.addEventListener(
      "mousedown",
      (e) => {
        if (!state.open) return;
        if (isInsideMenuArea(e.target)) return;
        // Prevent click-through: if we close on mousedown, the click can land on the page behind.
        e.preventDefault();
      },
      { passive: false }
    );

    overlay.addEventListener("click", (e) => {
      if (!state.open) return;
      if (isInsideMenuArea(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    // Trackpad wheel can fire many events quickly; throttle so horizontal "scroll" feels controllable.
    let wheelAccum = 0;
    let wheelDir = 0;
    let wheelLastAt = 0;
    overlay.addEventListener("wheel", (e) => {
      if (!state.open) return;
      if (state.layout !== "arc" && state.layout !== "dial") return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;

      const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      const dir = d > 0 ? 1 : -1;
      if (wheelDir && dir !== wheelDir) wheelAccum = 0;
      wheelDir = dir;
      wheelAccum += d;

      const WHEEL_THRESHOLD_PX = 72;
      const WHEEL_MIN_INTERVAL_MS = 110;
      if (now - wheelLastAt < WHEEL_MIN_INTERVAL_MS) return;
      if (Math.abs(wheelAccum) < WHEEL_THRESHOLD_PX) return;

      wheelAccum = 0;
      wheelLastAt = now;
      state.active = wrapIndex(state.active + dir, state.visible.length);
      renderSelection();
    }, { passive: false });

    window.__bitlogSwmIsOpen = () => !!state.open;
    window.__bitlogSwmOpen = (openFlag, opts) => {
      if (openFlag) open(opts || {});
      else close();
    };
    window.__bitlogSwmKeydown = handleKeydown;
    window.__bitlogSwmKeyup = handleKeyup;
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function layoutArc(container, selectedIdx) {
    const tiles = Array.from(container.querySelectorAll(".blsw-tile"));
    if (tiles.length === 0) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 60 || h < 120) return;

    const n = tiles.length;
    const first = tiles[0];
    if (!first) return;
    const tileW = first.getBoundingClientRect().width || 320;

    const stepByWidth = (w - tileW) / 4;
    const xStep = Math.max(tileW * 0.82, Math.min(tileW * 1.02, stepByWidth));

    const yBase = 0;
    const yCurve = Math.max(1.4, h * 0.004);
    const centerLift = Math.min(12, h * 0.03);

    const selectedZ = 110;
    const zStep = 70;
    const ryStep = 7.2;
    const rzStep = 0.8;
    const maxVisible = 4;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t) continue;
      let offset = i - selectedIdx;
      if (offset > n / 2) offset -= n;
      if (offset < -n / 2) offset += n;
      const abs = Math.abs(offset);
      const hidden = abs > maxVisible;

      const x = offset * xStep;
      const y = yBase - abs * abs * yCurve + (abs === 0 ? -centerLift : 0);
      const z = selectedZ - abs * zStep;
      const ry = -offset * ryStep;
      const rz = offset * rzStep;
      const s = abs === 0 ? 1.04 : abs === 1 ? 0.98 : 0.92;
      const blur = abs <= 1 ? 0 : abs === 2 ? 0.6 : 1.2;

      t.style.opacity = hidden ? "0" : String(1 - abs * 0.12);
      t.style.pointerEvents = hidden ? "none" : "auto";
      t.style.setProperty("--cf-x", `${x.toFixed(2)}px`);
      t.style.setProperty("--cf-y", `${y.toFixed(2)}px`);
      t.style.setProperty("--cf-z", `${z.toFixed(2)}px`);
      t.style.setProperty("--cf-ry", `${ry.toFixed(2)}deg`);
      t.style.setProperty("--cf-rz", `${rz.toFixed(2)}deg`);
      t.style.setProperty("--cf-s", `${s.toFixed(3)}`);
      t.style.setProperty("--cf-blur", `${blur.toFixed(2)}px`);
    }
  }

  function ensureMobileButton() {
    if (document.getElementById("blcmdFab")) return;
    const btn = document.createElement("button");
    btn.id = "blcmdFab";
    btn.type = "button";
    btn.className = "blcmd-fab";
    btn.setAttribute("aria-label", "命令面板");
    btn.title = "命令面板";
    btn.textContent = "?";
    btn.addEventListener("click", openPalette);
    document.body.appendChild(btn);
  }

  function ensureSwitchHandle() {
    if (document.getElementById("blswHandle")) return;
    const btn = document.createElement("button");
    btn.id = "blswHandle";
    btn.type = "button";
    btn.className = "blsw-handle";
    btn.setAttribute("aria-label", "快捷菜单");
    btn.innerHTML = `<span class="blsw-handle-dot" aria-hidden="true"></span><span class="blsw-handle-label">菜单</span>`;

    let revealed = false;
    let timer = null;
    const reveal = () => {
      revealed = true;
      btn.classList.add("is-revealed");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        revealed = false;
        btn.classList.remove("is-revealed");
        timer = null;
      }, 2600);
    };

    btn.addEventListener("click", () => {
      if (!revealed) {
        reveal();
        return;
      }
      const layout = getCommandMenuLayout();
      const confirmMode = getCommandMenuConfirmMode();
      if (layout === "cmd") {
        openPalette();
        return;
      }
      ensureSwitchMenu();
      window.__bitlogSwmOpen(true, { layout, confirmMode, holdArmed: false });
    });

    document.body.appendChild(btn);
  }

  function enableLongPressOpenMenu() {
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;

    const HOLD_MS = 420;
    const CANCEL_MOVE_PX = 14;

    let tracking = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let timer = null;

    const clearHold = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const shouldIgnoreTarget = (target) => {
      if (!target) return true;
      if (target.closest && target.closest("a,button,input,textarea,select,label")) return true;
      if (target.closest && target.closest("pre,code,.code-block,.prose")) return true;
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel.toString() || "").trim()) return true;
      return false;
    };

    const openMenu = () => {
      clearHold();
      if (window.__bitlogCmdpIsOpen && window.__bitlogCmdpIsOpen()) return;
      if (window.__bitlogSwmIsOpen && window.__bitlogSwmIsOpen()) return;

      const layout = getCommandMenuLayout();
      const confirmMode = getCommandMenuConfirmMode();
      if (layout === "cmd") {
        openPalette();
        return;
      }
      ensureSwitchMenu();
      window.__bitlogSwmOpen(true, { layout, confirmMode, holdArmed: false });
    };

    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "mouse") return;
        if (isTypingTarget(e)) return;
        if (window.__bitlogCmdpIsOpen && window.__bitlogCmdpIsOpen()) return;
        if (window.__bitlogSwmIsOpen && window.__bitlogSwmIsOpen()) return;
        if (shouldIgnoreTarget(e.target)) return;

        tracking = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        clearHold();
        timer = setTimeout(openMenu, HOLD_MS);
      },
      { passive: true }
    );

    document.addEventListener(
      "pointermove",
      (e) => {
        if (!tracking) return;
        if (pointerId !== null && e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.hypot(dx, dy) >= CANCEL_MOVE_PX) {
          tracking = false;
          pointerId = null;
          clearHold();
        }
      },
      { passive: true }
    );

    const end = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      tracking = false;
      pointerId = null;
      clearHold();
    };

    document.addEventListener("pointerup", end, { passive: true });
    document.addEventListener("pointercancel", end, { passive: true });
  }

  function enableArticleListContextCapture() {
    if (page !== "articles") return;
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a[href^='/articles/']") : null;
        if (!a) return;
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("/articles/")) return;
        const parts = href.split("?")[0].split("/").filter(Boolean);
        if (parts[0] !== "articles" || !parts[1]) return;
        const cards = Array.from(document.querySelectorAll("a.article-card[href^='/articles/']"));
        const titles = {};
        const slugs = cards
          .map((x) => {
            const h = x.getAttribute("href") || "";
            const p = h.split("?")[0].split("/").filter(Boolean);
            const slug = p[0] === "articles" && p[1] ? decodeURIComponent(p[1]) : "";
            const titleEl = x.querySelector && x.querySelector(".article-title");
            const title = titleEl && titleEl.textContent ? String(titleEl.textContent).trim() : "";
            if (slug && title) titles[slug] = title;
            return slug;
          })
          .filter(Boolean);
        if (slugs.length) {
          writeListContext({ slugs, titles, from: window.location.pathname + window.location.search });
        }
      },
      true
    );
  }

  function enablePostSwipe() {
    if (page !== "post") return;
    if (!canPostPrev && !canPostNext) return;
    const prose = document.querySelector(".prose");
    if (!prose) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let pointerId = null;

    const shouldIgnoreTarget = (target) => {
      if (!target) return true;
      if (target.closest("a,button,input,textarea,select,label")) return true;
      if (target.closest("pre,code,.code-block")) return true;
      if (target.closest("img,figure,video,canvas,svg")) return true;
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel.toString() || "").trim()) return true;
      return false;
    };

    prose.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      if (shouldIgnoreTarget(e.target)) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
    });
    prose.addEventListener("pointermove", (e) => {
      if (!tracking) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
        tracking = false;
      }
    });
    prose.addEventListener("pointerup", (e) => {
      if (!tracking) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 40) return;
      if (dx < -70) {
        postNext();
      } else if (dx > 70) {
        postPrev();
      }
    });
    prose.addEventListener("pointercancel", () => {
      tracking = false;
      pointerId = null;
    });
  }

  document.addEventListener("keydown", (e) => {
    if (isAltBackquote(e)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;

      const layout = getCommandMenuLayout();
      const confirmMode = getCommandMenuConfirmMode();

      if (layout === "cmd") {
        ensurePalette();
        const isOpen = window.__bitlogCmdpIsOpen ? window.__bitlogCmdpIsOpen() : false;
        window.__bitlogCmdpOpen(!isOpen);
        return;
      }

      ensureSwitchMenu();
      const isOpen = window.__bitlogSwmIsOpen ? window.__bitlogSwmIsOpen() : false;
      if (confirmMode === "release") {
        if (isOpen) return;
        window.__bitlogSwmOpen(true, { layout, confirmMode, holdArmed: true });
        return;
      }
      window.__bitlogSwmOpen(!isOpen, { layout, confirmMode, holdArmed: false });
      return;
    }

    if (window.__bitlogSwmIsOpen && window.__bitlogSwmIsOpen()) {
      if (window.__bitlogSwmKeydown && window.__bitlogSwmKeydown(e)) return;
    }

    if (window.__bitlogCmdpIsOpen && window.__bitlogCmdpIsOpen()) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }
    }

    if (isTypingTarget(e)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey) pushSeq(String(e.key || "").toLowerCase());

    // `?` reserved for mobile / quick search list (command palette).
    if (matchChord(e, specs.openCommandPalette)) {
      e.preventDefault();
      openPalette();
      return;
    }
    if (matchChord(e, specs.focusSearch)) {
      e.preventDefault();
      focusSearch();
      return;
    }
    if (matchChord(e, specs.toggleLightDark)) {
      e.preventDefault();
      toggleLightDark();
      return;
    }

    const hrefHome = pickNavHrefByIdOrPath("home", "/");
    if (hrefHome && (matchChord(e, specs.goHome) || matchSeq(parseSeq(specs.goHome)))) {
      e.preventDefault();
      go(hrefHome);
      return;
    }
    const hrefArticles = pickNavHrefByIdOrPath("articles", "/articles");
    if (hrefArticles && (matchChord(e, specs.goArticles) || matchSeq(parseSeq(specs.goArticles)))) {
      e.preventDefault();
      go(hrefArticles);
      return;
    }
    const hrefProjects = pickNavHrefByIdOrPath("projects", "/projects");
    if (hrefProjects && (matchChord(e, specs.goProjects) || matchSeq(parseSeq(specs.goProjects)))) {
      e.preventDefault();
      go(hrefProjects);
      return;
    }
    const hrefTools = pickNavHrefByIdOrPath("tools", "/tools");
    if (hrefTools && (matchChord(e, specs.goTools) || matchSeq(parseSeq(specs.goTools)))) {
      e.preventDefault();
      go(hrefTools);
      return;
    }
    const hrefAbout = pickNavHrefByIdOrPath("about", "/about");
    if (hrefAbout && (matchChord(e, specs.goAbout) || matchSeq(parseSeq(specs.goAbout)))) {
      e.preventDefault();
      go(hrefAbout);
      return;
    }

    if (specs.goAdminPosts && (matchChord(e, specs.goAdminPosts) || matchSeq(parseSeq(specs.goAdminPosts)))) {
      e.preventDefault();
      go("/admin/#/posts");
      return;
    }
    if (specs.goAdminSettings && (matchChord(e, specs.goAdminSettings) || matchSeq(parseSeq(specs.goAdminSettings)))) {
      e.preventDefault();
      go("/admin/#/settings");
      return;
    }
    if (specs.goAdminAccount && (matchChord(e, specs.goAdminAccount) || matchSeq(parseSeq(specs.goAdminAccount)))) {
      e.preventDefault();
      go("/admin/#/account");
      return;
    }
    if (specs.newPost && (matchChord(e, specs.newPost) || matchSeq(parseSeq(specs.newPost)))) {
      e.preventDefault();
      go("/admin/#/posts/new");
      return;
    }

    if (page === "post") {
      if (canPostPrev && matchChord(e, specs.postPrev)) {
        e.preventDefault();
        postPrev();
        return;
      }
      if (canPostNext && matchChord(e, specs.postNext)) {
        e.preventDefault();
        postNext();
        return;
      }
    }

    const backSeq = parseSeq(specs.back);
    const fwdSeq = parseSeq(specs.forward);
    if (matchChord(e, specs.back) || (backSeq && matchSeq(backSeq))) {
      e.preventDefault();
      history.back();
      return;
    }
    if (matchChord(e, specs.forward) || (fwdSeq && matchSeq(fwdSeq))) {
      e.preventDefault();
      history.forward();
      return;
    }
  });

  document.addEventListener("keyup", (e) => {
    if (window.__bitlogSwmIsOpen && window.__bitlogSwmIsOpen()) {
      if (window.__bitlogSwmKeyup && window.__bitlogSwmKeyup(e)) return;
    }
  });

  ensurePostNavUi();
  ensurePostBackLink();
  enableArticleListContextCapture();
  enablePostSwipe();
  ensureMobileButton();
  ensureSwitchHandle();
  enableLongPressOpenMenu();
})();
