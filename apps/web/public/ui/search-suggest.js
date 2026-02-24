(() => {
  const input = document.getElementById("navSearch");
  const form = input ? input.closest("form.search") : null;
  if (!input || !form) return;

  const root = document.createElement("div");
  root.className = "search-suggest";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", "搜索建议");
  root.hidden = true;
  form.appendChild(root);

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const tokenize = (q) =>
    String(q ?? "")
      .trim()
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);

  const highlightHtml = (text, tokens) => {
    let html = escapeHtml(text);
    for (const t of tokens) {
      if (!t) continue;
      const re = new RegExp(escapeRegExp(t), "gi");
      html = html.replace(re, (m) => `<mark>${escapeHtml(m)}</mark>`);
    }
    return html;
  };

  let timer = null;
  let lastQ = "";
  let seq = 0;

  const hide = () => {
    root.hidden = true;
    root.innerHTML = "";
  };

  const header = document.querySelector(".site-header");
  const toggleBtn = document.getElementById("navSearchToggle");

  const isSearchOpen = () => (header ? header.getAttribute("data-search-open") === "1" : false);
  const setSearchOpen = (open) => {
    if (!header) return;
    if (open) {
      header.setAttribute("data-search-open", "1");
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
      window.setTimeout(() => {
        try {
          input.focus();
          input.select();
        } catch {}
      }, 0);
      return;
    }
    header.removeAttribute("data-search-open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
    hide();
  };

  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", isSearchOpen() ? "true" : "false");
    toggleBtn.addEventListener("click", () => setSearchOpen(!isSearchOpen()));
  }

  document.addEventListener("pointerdown", (e) => {
    if (!toggleBtn) return;
    if (!isSearchOpen()) return;
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (header && header.contains(t)) return;
    setSearchOpen(false);
  });

  try {
    window.__bitlogOpenSearch = (open) => setSearchOpen(open !== false);
  } catch {}

  const showLoading = (q) => {
    root.hidden = false;
    root.innerHTML = `<div class="search-suggest__meta">搜索：<strong>${escapeHtml(q)}</strong> …</div>`;
  };

  const render = (q, ms, results) => {
    const tokens = tokenize(q);
    const items = (results ?? []).slice(0, 8);
    const meta = `<div class="search-suggest__meta">找到 <strong>${items.length}</strong> 条结果（${(
      ms / 1000
    ).toFixed(3)} 秒）</div>`;

    const list = items.length
      ? `<div class="search-suggest__list">${items
          .map((r) => {
            const title = highlightHtml(r.title ?? "", tokens);
            const summary = highlightHtml(r.summary ?? "", tokens);
            const href = `/articles/${encodeURIComponent(String(r.slug ?? ""))}`;
            return `<a class="search-suggest__item" href="${href}">
  <div class="search-suggest__title">${title || "（无标题）"}</div>
  ${summary ? `<div class="search-suggest__desc">${summary}</div>` : ""}
</a>`;
          })
          .join("")}</div>`
      : `<div class="search-suggest__empty">暂无匹配</div>`;

    root.hidden = false;
    root.innerHTML = meta + list;
  };

  const fetchSuggest = async (q, mySeq) => {
    const t0 = performance.now();
    showLoading(q);
    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&page=1&pageSize=8`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (mySeq !== seq) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mySeq !== seq) return;
      const t1 = performance.now();
      render(q, t1 - t0, data?.results ?? []);
    } catch {
      if (mySeq !== seq) return;
      root.hidden = false;
      root.innerHTML = `<div class="search-suggest__empty">搜索失败（网络或限流）</div>`;
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    const q = String(input.value ?? "").trim();
    if (!q) {
      lastQ = "";
      hide();
      return;
    }
    timer = setTimeout(() => {
      if (q === lastQ) return;
      lastQ = q;
      seq++;
      void fetchSuggest(q, seq);
    }, 160);
  };

  input.addEventListener("input", schedule);
  input.addEventListener("focus", schedule);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hide();
      if (toggleBtn) setSearchOpen(false);
      input.blur();
    }
  });

  document.addEventListener("mousedown", (e) => {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (form.contains(t)) return;
    hide();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const active = document.activeElement;
    if (active && form.contains(active)) return;
    hide();
  });
})();
