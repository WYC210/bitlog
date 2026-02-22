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

  const sc = parseShortcuts();
  const contexts = (sc && typeof sc === "object" && sc.contexts && typeof sc.contexts === "object") ? sc.contexts : {};
  const global = (sc && typeof sc === "object" && sc.global && typeof sc.global === "object") ? sc.global : {};
  const effective = Object.assign(
    {},
    global || {},
    contexts["web.global"] || {},
    contexts[page] || {},
    contexts[`web.${page}`] || {}
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
    window.location.href = href;
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
      return { at: parsed.at, slugs: parsed.slugs.map(String), from: String(parsed.from || "") };
    } catch {
      return null;
    }
  }

  function writeListContext(slugs, from) {
    try {
      sessionStorage.setItem(
        LIST_CTX_KEY,
        JSON.stringify({ v: 1, at: Date.now(), slugs: slugs.slice(0, 200), from: String(from || "") })
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
    const wrap = document.createElement("div");
    wrap.id = "postNav";
    wrap.className = "post-nav";
    const mk = (label, slug) =>
      slug
        ? `<a class="btn ghost post-nav-btn" href="/articles/${encodeURIComponent(slug)}">${label}</a>`
        : `<span class="btn ghost post-nav-btn is-disabled" aria-disabled="true">${label}</span>`;
    wrap.innerHTML = `<div class="post-nav-inner">
      ${mk("上一篇", postNav.prev)}
      ${mk("下一篇", postNav.next)}
    </div>`;
    body.appendChild(wrap);
  }

  function postPrev() {
    if (!canPostPrev) return;
    go(`/articles/${encodeURIComponent(postNav.prev)}`);
  }
  function postNext() {
    if (!canPostNext) return;
    go(`/articles/${encodeURIComponent(postNav.next)}`);
  }

  function openPalette() {
    ensurePalette();
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
      return actions;
    }

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
      if (e.target === overlay) window.__bitlogCmdpOpen(false);
    });
    closeBtn.addEventListener("click", () => window.__bitlogCmdpOpen(false));
    input.addEventListener("input", render);

    window.__bitlogCmdpOpen = (open) => {
      overlay.style.display = open ? "grid" : "none";
      if (open) {
        input.value = "";
        render();
        setTimeout(() => input.focus(), 0);
      }
    };
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
        const slugs = Array.from(document.querySelectorAll("a.article-card[href^='/articles/']"))
          .map((x) => x.getAttribute("href") || "")
          .map((h) => {
            const p = h.split("?")[0].split("/").filter(Boolean);
            return p[0] === "articles" && p[1] ? decodeURIComponent(p[1]) : "";
          })
          .filter(Boolean);
        if (slugs.length) writeListContext(slugs, window.location.pathname + window.location.search);
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
    if (isTypingTarget(e)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey) pushSeq(String(e.key || "").toLowerCase());

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

    if (matchChord(e, specs.goHome) || matchSeq(parseSeq(specs.goHome))) {
      e.preventDefault();
      go("/");
      return;
    }
    if (matchChord(e, specs.goArticles) || matchSeq(parseSeq(specs.goArticles))) {
      e.preventDefault();
      go("/articles");
      return;
    }
    if (matchChord(e, specs.goProjects) || matchSeq(parseSeq(specs.goProjects))) {
      e.preventDefault();
      go("/projects");
      return;
    }
    if (matchChord(e, specs.goTools) || matchSeq(parseSeq(specs.goTools))) {
      e.preventDefault();
      go("/tools");
      return;
    }
    if (matchChord(e, specs.goAbout) || matchSeq(parseSeq(specs.goAbout))) {
      e.preventDefault();
      go("/about");
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

  ensurePostNavUi();
  enableArticleListContextCapture();
  enablePostSwipe();
  ensureMobileButton();
})();
