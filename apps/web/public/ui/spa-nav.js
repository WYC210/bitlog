(function () {
  if (window.__bitlogSpaNavInstalled) return;
  window.__bitlogSpaNavInstalled = true;

  const SPA_PATHS = new Set(["/", "/articles", "/projects", "/tools", "/about"]);
  const CORE_STYLES = ["/ui/base.css", "/ui/style-pack.css"];
  const MAX_CACHE = 12;

  const state = {
    abort: null,
    cache: new Map(),
    seq: 0
  };

  function escapeHtml(s) {
    return String(s ?? "")
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

  function applyWebNavConfig(url) {
    const nav = document.querySelector(".nav.nav-main");
    if (!nav) return;
    const cfg = getWebNavConfig();
    if (!cfg) return;

    const path = normalizePathname(url.pathname);
    const items = cfg
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id || "").trim(),
        label: String(x.label || "").trim(),
        href: String(x.href || "").trim(),
        enabled: x.enabled === false ? false : true,
        external: x.external === true
      }))
      .filter((x) => x.id && x.label && x.href && x.enabled)
      .slice(0, 24);

    const mkActive = (href, external) => {
      if (external) return false;
      const h = normalizePathname(href);
      if (h === "/") return path === "/";
      return path === h || path.startsWith(h + "/");
    };

    let usedActive = false;
    nav.innerHTML = items
      .map((it) => {
        const active = !usedActive && mkActive(it.href, it.external);
        if (active) usedActive = true;
        const attrs = it.external
          ? `href="${escapeHtml(it.href)}" target="_blank" rel="noopener noreferrer"`
          : `href="${escapeHtml(it.href)}"`;
        const cls = active ? ` class="active"` : "";
        return `<a${cls} ${attrs}>${escapeHtml(it.label)}</a>`;
      })
      .join("\n");

    // If "articles" is disabled/removed, hide the global search box to avoid linking to a hidden page.
    const articlesEnabled = items.some((x) => !x.external && normalizePathname(x.href) === "/articles");
    const headerCenter = document.querySelector(".header-center");
    if (headerCenter) headerCenter.style.display = articlesEnabled ? "" : "none";
  }

  function normalizePathname(pathname) {
    const p = String(pathname || "/");
    if (p === "/") return "/";
    return p.endsWith("/") ? p.slice(0, -1) : p;
  }

  function isSameOrigin(url) {
    try {
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function isSpaPath(pathname) {
    return SPA_PATHS.has(normalizePathname(pathname));
  }

  function isPlainLeftClick(e) {
    if (e.defaultPrevented) return false;
    if (e.button !== 0) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    return true;
  }

  function findAnchor(target) {
    const el = target && target.closest ? target.closest("a") : null;
    return el && el.tagName === "A" ? el : null;
  }

  function shouldHandleAnchor(a) {
    if (!a) return false;
    if (a.hasAttribute("download")) return false;
    const target = a.getAttribute("target");
    if (target && target !== "_self") return false;
    const rel = (a.getAttribute("rel") || "").toLowerCase();
    if (rel.includes("external")) return false;

    const href = a.getAttribute("href") || "";
    if (!href) return false;
    if (href.startsWith("#")) return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;

    let url;
    try {
      url = new URL(a.href, window.location.href);
    } catch {
      return false;
    }
    if (!isSameOrigin(url)) return false;
    if (!isSpaPath(url.pathname)) return false;
    return true;
  }

  function updateNavActive(url) {
    const path = normalizePathname(url.pathname);
    const want =
      path === "/" ? "/" : path === "/articles" ? "/articles" : path === "/projects" ? "/projects" : path === "/tools" ? "/tools" : path === "/about" ? "/about" : "";

    const links = document.querySelectorAll(".nav.nav-main a[href]");
    let used = false;
    for (const a of links) {
      let p = "";
      try {
        p = normalizePathname(new URL(a.href, window.location.href).pathname);
      } catch {
        // ignore
      }
      const match = !!want && p === want;
      if (match && !used) {
        a.classList.add("active");
        used = true;
      } else {
        a.classList.remove("active");
      }
    }
  }

  function updateSearchValue(url) {
    const input = document.getElementById("navSearch");
    if (!input) return;
    const isArticles = normalizePathname(url.pathname) === "/articles";
    const q = isArticles ? (url.searchParams.get("q") || "") : "";
    try {
      input.value = q;
    } catch {
      // ignore
    }
  }

  function isCoreStylesheetHref(href) {
    const h = String(href || "");
    return CORE_STYLES.some((p) => h.startsWith(p));
  }

  function shouldManageStylesheetHref(href) {
    const h = String(href || "");
    if (!h.startsWith("/ui/")) return false;
    if (isCoreStylesheetHref(h)) return false;
    // Only manage page-level styles, to avoid touching third-party or long-lived styles accidentally.
    return h.includes("-page.css") || h.includes("dashboard-widgets.css") || h.includes("widgets");
  }

  function syncStyles(nextDoc) {
    const next = new Set();
    const nextLinks = nextDoc.querySelectorAll("link[rel='stylesheet'][href]");
    for (const l of nextLinks) {
      const href = l.getAttribute("href") || "";
      if (shouldManageStylesheetHref(href) || isCoreStylesheetHref(href)) next.add(href);
    }

    const curLinks = Array.from(document.querySelectorAll("head link[rel='stylesheet'][href]"));
    for (const l of curLinks) {
      const href = l.getAttribute("href") || "";
      if (!shouldManageStylesheetHref(href)) continue;
      if (!next.has(href)) l.remove();
    }

    const hasLink = (href) => {
      const links = document.querySelectorAll("head link[rel='stylesheet'][href]");
      for (const l of links) {
        if ((l.getAttribute("href") || "") === href) return true;
      }
      return false;
    };

    for (const href of next) {
      if (!href) continue;
      if (hasLink(href)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function ensurePageScripts(nextDoc) {
    // Only allowlist known module scripts we need for DOM-hydration pages.
    const mod = nextDoc.querySelector('script[type="module"][src*="/ui/about/about.js"]');
    if (mod) {
      const src = mod.getAttribute("src") || "";
      if (src) {
        const key = "/ui/about/about.js";
        if (!document.querySelector(`script[type="module"][data-spa-key="${key}"]`)) {
          const s = document.createElement("script");
          s.type = "module";
          s.src = src;
          s.setAttribute("data-spa-key", key);
          document.body.appendChild(s);
        }
      }
    }
  }

  function canonicalizeUrl(url) {
    // Keep current behavior for /projects: remember last platform filter.
    if (normalizePathname(url.pathname) !== "/projects") return url;
    const key = "bl-projects-platform";
    const p = (url.searchParams.get("platform") || "").trim();
    try {
      if (p) {
        localStorage.setItem(key, p);
        return url;
      }
      const stored = localStorage.getItem(key);
      if (stored && stored !== "all") {
        const next = new URL(url.toString());
        next.searchParams.set("platform", stored);
        return next;
      }
    } catch {
      // ignore
    }
    return url;
  }

  async function fetchHtml(url, signal) {
    const key = url.toString();
    if (state.cache.has(key)) return state.cache.get(key);

    const res = await fetch(key, {
      signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "x-bitlog-spa": "1"
      }
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const html = await res.text();
    state.cache.set(key, html);
    while (state.cache.size > MAX_CACHE) {
      const firstKey = state.cache.keys().next().value;
      state.cache.delete(firstKey);
    }
    return html;
  }

  async function navigateTo(rawUrl, opts) {
    const options = opts || {};
    const seqId = ++state.seq;

    const mode = options.history || "push"; // push | replace | none
    let url = new URL(rawUrl, window.location.href);
    url = canonicalizeUrl(url);

    if (!isSpaPath(url.pathname)) {
      window.location.href = url.toString();
      return;
    }

    if (state.abort) state.abort.abort();
    const ac = new AbortController();
    state.abort = ac;

    try {
      document.body.setAttribute("data-spa-loading", "1");

      const html = await fetchHtml(url, ac.signal);
      if (seqId !== state.seq) return;
      const nextDoc = new DOMParser().parseFromString(html, "text/html");

      const nextMain = nextDoc.querySelector("main.page-wrap");
      const curMain = document.querySelector("main.page-wrap");
      if (!nextMain || !curMain) throw new Error("missing_main");

      curMain.replaceWith(nextMain);

      const nextTitle = nextDoc.querySelector("title")?.textContent || "";
      if (nextTitle) document.title = nextTitle;

      const nextPage = nextDoc.body?.getAttribute("data-page");
      if (nextPage) document.body.setAttribute("data-page", nextPage);

      syncStyles(nextDoc);
      ensurePageScripts(nextDoc);
      applyWebNavConfig(url);
      updateNavActive(url);
      updateSearchValue(url);

      if (mode === "push") history.pushState({}, "", url.toString());
      else if (mode === "replace") history.replaceState({}, "", url.toString());

      try {
        window.scrollTo(0, 0);
      } catch {
        // ignore
      }

      window.dispatchEvent(
        new CustomEvent("bitlog:spa:afterSwap", {
          detail: { url: url.toString(), page: nextPage || "" }
        })
      );
    } catch (e) {
      // Fallback to full navigation on any unexpected error.
      if (e && String(e.name || "") === "AbortError") return;
      window.location.href = url.toString();
      return;
    } finally {
      document.body.removeAttribute("data-spa-loading");
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      if (!isPlainLeftClick(e)) return;
      const a = findAnchor(e.target);
      if (!shouldHandleAnchor(a)) return;
      e.preventDefault();
      void navigateTo(a.href, { history: "push" });
    },
    true
  );

  window.addEventListener("popstate", () => {
    void navigateTo(window.location.href, { history: "none" });
  });

  // Keep nav state consistent even without navigation (e.g. initial render).
  try {
    const u = new URL(window.location.href);
    applyWebNavConfig(u);
    updateNavActive(u);
    updateSearchValue(u);
  } catch {
    // ignore
  }

  try {
    window.__bitlogSpaNavigate = (href, opts) => navigateTo(href, opts);
  } catch {
    // ignore
  }
})();
