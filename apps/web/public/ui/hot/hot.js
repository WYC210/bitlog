(function () {
  if (document.body?.getAttribute?.("data-page") !== "hot") return;

  let eventSource = null;
  let requestSeq = 0;
  let currentCategory = "all";
  let sideOpen = true;
  let sideMobile = false;
  let loadStartedAt = 0;
  let loadingHideTimer = null;

  const sourceOrder = new Map();
  const sourceState = new Map();
  const sourceStatusCache = new Map();
  const cachedListsBySource = new Map();
  let cachedCategoryKeys = [];
  let cachedSources = [];
  const HERO_SUBTITLE = "实时聚合全网热点资讯";

  const SIDE_OPEN_KEY = "bl-hot-side-open";
  const LOCAL_SOURCE_ICON_MAP = {
    hackernews: "/ui/hot/icons/hackernews.png",
    v2ex: "/ui/hot/icons/v2ex.jpg",
    juejin: "/ui/hot/icons/juejin.png",
    sspai: "/ui/hot/icons/sspai.png",
    pingwest: "/ui/hot/icons/pingwest.png",
    zaobao: "/ui/hot/icons/zaobao.png",
    douban_movie: "/ui/hot/icons/douban.png",
    douban_book: "/ui/hot/icons/douban.png"
  };

  function $(id) {
    return document.getElementById(id);
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 1200px)").matches;
  }

  function readDesktopSideOpen() {
    try {
      return localStorage.getItem(SIDE_OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  }

  function writeDesktopSideOpen(open) {
    try {
      localStorage.setItem(SIDE_OPEN_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function applySideState(open, opts) {
    const persist = !opts || opts.persist !== false;
    const page = document.querySelector(".hot-page");
    const panel = $("hot-sidePanel");
    const toggle = $("hotSideToggle");
    const floatBtn = $("hotSideFloat");
    const backdrop = $("hotSideBackdrop");

    sideOpen = !!open;

    if (page) page.setAttribute("data-side", sideOpen ? "open" : "closed");
    if (panel) panel.setAttribute("data-open", sideOpen ? "true" : "false");

    if (toggle) {
      toggle.textContent = sideOpen ? "收起" : "状态栏";
      toggle.setAttribute("aria-expanded", sideOpen ? "true" : "false");
    }

    if (floatBtn) {
      floatBtn.setAttribute("aria-expanded", sideOpen ? "true" : "false");
    }

    if (backdrop) {
      backdrop.classList.toggle("is-active", sideOpen && sideMobile);
    }

    document.body.classList.toggle("hot-side-open", sideOpen && sideMobile);

    if (!sideMobile && persist) writeDesktopSideOpen(sideOpen);
  }

  function syncSideStateForViewport() {
    const nowMobile = isMobileViewport();
    if (nowMobile === sideMobile) return;
    sideMobile = nowMobile;
    if (sideMobile) applySideState(false, { persist: false });
    else applySideState(readDesktopSideOpen(), { persist: false });
    renderSidePanel();
  }

  function initSidePanelState() {
    sideMobile = isMobileViewport();
    applySideState(sideMobile ? false : readDesktopSideOpen(), { persist: false });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(String(raw ?? "{}"));
    } catch {
      return {};
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }

  function closeStream() {
    if (!eventSource) return;
    try {
      eventSource.close();
    } catch {
      // ignore
    }
    eventSource = null;
  }

  function setRefreshLoading(loading) {
    const btn = $("hotRefreshBtn");
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? "刷新中..." : "刷新";
  }

  function renderStatus() {
    const el = $("hot-status");
    if (el) el.textContent = HERO_SUBTITLE;
  }

  function setLoadingDockState(state) {
    const dock = $("hotLoadingDock");
    if (dock) dock.setAttribute("data-state", state);
  }

  function setLoadingText(text) {
    const el = $("hotLoadingText");
    if (el) el.textContent = text;
  }

  function setProgress(completed, total) {
    const value = Number.isFinite(completed) ? Math.max(0, Math.trunc(completed)) : 0;
    const max = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
    const countEl = $("hotLoadingCount");
    const fillEl = $("hotLoadingFill");

    if (countEl) countEl.textContent = `${value} / ${max}`;
    if (fillEl) {
      const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
      fillEl.style.width = `${pct}%`;
    }
  }

  function startLoadingDock(message) {
    if (loadingHideTimer) {
      clearTimeout(loadingHideTimer);
      loadingHideTimer = null;
    }
    setLoadingDockState("running");
    setLoadingText(message || "正在抓取来源...");
    setProgress(0, 0);
  }

  function finishLoadingDock(completed, total) {
    setProgress(completed, total);
    setLoadingText("加载完成");
    setLoadingDockState("done");

    if (loadingHideTimer) clearTimeout(loadingHideTimer);
    loadingHideTimer = setTimeout(() => {
      setLoadingDockState("hidden");
      loadingHideTimer = null;
    }, 1200);
  }

  function showLoadingFailure(message) {
    setLoadingDockState("done");
    setLoadingText(message || "加载失败");
    if (loadingHideTimer) clearTimeout(loadingHideTimer);
    loadingHideTimer = null;
  }

  function formatClock(ms) {
    const t = Number(ms);
    if (!Number.isFinite(t) || t <= 0) return "--:--";
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function normalizeCategoryLabel(s) {
    const t = String(s ?? "").trim();
    return t || "未分类";
  }

  function resolveLocalIcon(sourceSlug, sourceName) {
    const slug = String(sourceSlug ?? "").trim().toLowerCase();
    if (slug && LOCAL_SOURCE_ICON_MAP[slug]) return LOCAL_SOURCE_ICON_MAP[slug];

    const name = String(sourceName ?? "").trim().toLowerCase();
    if (!name) return "";

    if (name.includes("hacker news")) return LOCAL_SOURCE_ICON_MAP.hackernews;
    if (name.includes("v2ex")) return LOCAL_SOURCE_ICON_MAP.v2ex;
    if (name.includes("掘金")) return LOCAL_SOURCE_ICON_MAP.juejin;
    if (name.includes("少数派")) return LOCAL_SOURCE_ICON_MAP.sspai;
    if (name.includes("品玩")) return LOCAL_SOURCE_ICON_MAP.pingwest;
    if (name.includes("联合早报")) return LOCAL_SOURCE_ICON_MAP.zaobao;
    if (name.includes("豆瓣")) return LOCAL_SOURCE_ICON_MAP.douban_movie;

    return "";
  }

  function bindHotSourceIconFallbacks(root) {
    if (!(root instanceof Element)) return;

    root.querySelectorAll("img.hot-source-img").forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.bound === "1") return;
      img.dataset.bound = "1";

      img.addEventListener("error", () => {
        const fallback = String(img.getAttribute("data-hot-fallback") ?? "").trim();
        const current = String(img.getAttribute("src") ?? "").trim();

        if (fallback && current !== fallback) {
          img.setAttribute("src", fallback);
          img.setAttribute("data-hot-fallback", "");
          return;
        }

        const holder = img.closest(".hot-source-icon");
        if (!(holder instanceof HTMLElement)) return;

        const initial = String(img.getAttribute("data-hot-initial") ?? "?")
          .slice(0, 1)
          .toUpperCase();
        holder.innerHTML = `<span class="hot-source-fallback" aria-hidden="true">${escapeHtml(initial || "?")}</span>`;
      });
    });
  }

  function renderCategories(categoryKeys, active) {
    const wrap = $("hot-categories");
    if (!wrap) return;

    const keys = Array.isArray(categoryKeys) ? categoryKeys.slice() : [];
    const items = [{ key: "all", label: "全部" }].concat(
      keys.map((k) => ({ key: k, label: normalizeCategoryLabel(k) }))
    );

    wrap.innerHTML = items
      .map((it) => {
        const cls = it.key === active ? "chip is-active" : "chip";
        return `<button class="${cls}" type="button" data-hot-cat="${escapeHtml(it.key)}">${escapeHtml(it.label)}</button>`;
      })
      .join("\n");
  }

  function sortListsBySourceOrder(lists) {
    const arr = Array.isArray(lists) ? lists.slice() : [];
    return arr.sort((a, b) => {
      const sa = String(a?.source ?? "");
      const sb = String(b?.source ?? "");
      const oa = sourceOrder.has(sa) ? sourceOrder.get(sa) : 1000000;
      const ob = sourceOrder.has(sb) ? sourceOrder.get(sb) : 1000000;
      if (oa !== ob) return oa - ob;
      return sa.localeCompare(sb);
    });
  }

  function cacheSourcesCatalog(categories, sources) {
    cachedSources = Array.isArray(sources) ? sources.slice() : [];
    const categoryKeys = [];
    const seen = new Set();

    for (const s of cachedSources) {
      const slug = String(s?.slug ?? "").trim();
      if (!slug) continue;
      const cat = String(s?.category ?? "").trim();
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        categoryKeys.push(cat);
      }
      const prev = sourceStatusCache.get(slug) || {};
      sourceStatusCache.set(slug, {
        ...prev,
        slug,
        name: String(s?.name ?? prev?.name ?? slug),
        category: String(s?.category ?? prev?.category ?? "")
      });
    }

    if (!categoryKeys.length && categories && typeof categories === "object") {
      for (const key of Object.keys(categories)) {
        const cat = String(key ?? "").trim();
        if (!cat || seen.has(cat)) continue;
        seen.add(cat);
        categoryKeys.push(cat);
      }
    }

    cachedCategoryKeys = categoryKeys;
  }

  function cacheHotListItem(item) {
    const key = String(item?.source ?? "").trim();
    if (!key) return;
    cachedListsBySource.set(key, item);
  }

  function getCachedCategorySnapshot(category) {
    const cat = String(category || "all").trim();
    const filteredSources = filterSourcesByCategory(cachedSources, cat);
    const allowed = new Set(
      filteredSources
        .map((s) => String(s?.slug ?? "").trim())
        .filter(Boolean)
    );
    const lists = sortListsBySourceOrder(
      Array.from(cachedListsBySource.values()).filter((l) => allowed.has(String(l?.source ?? "").trim()))
    );
    return { filteredSources, lists };
  }

  function tryRenderFromCache(category) {
    if (!Array.isArray(cachedSources) || cachedSources.length === 0) return false;
    const cat = String(category || "all").trim();
    const { filteredSources, lists } = getCachedCategorySnapshot(cat);
    if (filteredSources.length === 0) return false;
    if (cat !== "all" && lists.length === 0 && cachedListsBySource.size === 0) return false;

    renderCategories(cachedCategoryKeys, cat);
    buildSourceState(filteredSources);
    renderLists(lists);
    const stats = summarizeSourceState();
    setProgress(stats.completed, stats.total);
    renderStatus();
    setLoadingDockState("hidden");
    setRefreshLoading(false);
    return true;
  }

  function renderLists(lists) {
    const grid = $("hot-grid");
    if (!grid) return;

    const arr = Array.isArray(lists) ? lists : [];
    if (!arr.length) {
      grid.innerHTML = '<div class="hot-empty-row"><div class="meta">暂无热点数据</div></div>';
      return;
    }

    grid.innerHTML = arr
      .map((l, idx) => {
        const sourceSlugRaw = String(l?.source ?? "");
        const sourceNameRaw = String(l?.sourceName || l?.source || "未知源");
        const sourceName = escapeHtml(sourceNameRaw);
        const category = escapeHtml(l?.category || "未分类");
        const remoteIcon = String(l?.icon ?? "").trim();
        const localIcon = resolveLocalIcon(sourceSlugRaw, sourceNameRaw);
        const initial = escapeHtml(sourceNameRaw.slice(0, 1).toUpperCase());

        const icon = (() => {
          if (!remoteIcon && !localIcon) {
            return `<span class="hot-source-fallback" aria-hidden="true">${initial || "?"}</span>`;
          }
          const src = remoteIcon || localIcon;
          const fallback = remoteIcon && localIcon ? localIcon : "";
          return `<img class="hot-source-img" src="${escapeHtml(src)}" data-hot-fallback="${escapeHtml(fallback)}" data-hot-initial="${initial || "?"}" alt="" width="22" height="22" loading="lazy" decoding="async" />`;
        })();

        const items = Array.isArray(l?.items) ? l.items.slice(0, 10) : [];
        const timeText = formatClock(Number(l?.updatedAt ?? 0));

        const body = items.length
          ? `<ol class="hot-item-list">\n${items
              .map((it, itemIdx) => {
                const href = escapeHtml(String(it?.url ?? ""));
                const title = escapeHtml(String(it?.title ?? "未命名条目"));
                return `<li class="hot-item">\n  <a class="hot-item-link" href="${href}" target="_blank" rel="noopener noreferrer">\n    <span class="hot-item-rank">${itemIdx + 1}</span>\n    <span class="hot-item-title">${title}</span>\n  </a>\n</li>`;
              })
              .join("\n")}\n</ol>`
          : '<div class="meta hot-empty">该源暂无条目</div>';

        return `<section class="hot-feed-block">\n  <div class="hot-card-head">\n    <div class="hot-source">\n      <div class="hot-source-icon">${icon}</div>\n      <div class="hot-source-main">\n        <div class="hot-source-name">${sourceName}</div>\n        <div class="meta hot-source-meta">${category}</div>\n      </div>\n    </div>\n    <div class="hot-source-side">\n      <div class="hot-source-order">#${idx + 1}</div>\n      <div class="meta hot-source-time">${escapeHtml(timeText)}</div>\n    </div>\n  </div>\n  ${body}\n</section>`;
      })
      .join("\n");

    bindHotSourceIconFallbacks(grid);
  }

  function buildSourceState(sources) {
    sourceOrder.clear();
    sourceState.clear();

    (Array.isArray(sources) ? sources : []).forEach((s, idx) => {
      const slug = String(s?.slug ?? "").trim();
      if (!slug) return;
      const cached = sourceStatusCache.get(slug);
      sourceOrder.set(slug, idx);
      sourceState.set(slug, {
        slug,
        name: String(s?.name ?? slug),
        category: String(s?.category ?? ""),
        status: String(cached?.status ?? "pending"),
        message: String(cached?.message ?? ""),
        elapsedMs: Number.isFinite(cached?.elapsedMs) ? Number(cached.elapsedMs) : null
      });
    });

    renderSidePanel();
  }

  function setSourceStatus(slug, status, message, elapsedMs) {
    const key = String(slug ?? "").trim();
    if (!key) return;

    const prev = sourceState.get(key) || sourceStatusCache.get(key) || { slug: key };
    const done = status === "success" || status === "failed";
    const computedMs = done
      ? Math.max(
          0,
          Math.trunc(
            Number.isFinite(elapsedMs)
              ? Number(elapsedMs)
              : loadStartedAt > 0
                ? Date.now() - loadStartedAt
                : 0
          )
        )
      : null;

    const next = {
      ...prev,
      slug: key,
      status,
      message: String(message ?? "").trim(),
      elapsedMs: computedMs
    };

    sourceStatusCache.set(key, next);
    if (!sourceState.has(key)) return;
    sourceState.set(key, next);
    renderSidePanel();
  }

  function summarizeSourceState() {
    let total = 0;
    let success = 0;
    let failed = 0;
    let pending = 0;

    for (const item of sourceState.values()) {
      total += 1;
      if (item.status === "success") success += 1;
      else if (item.status === "failed") failed += 1;
      else pending += 1;
    }

    return { total, success, failed, pending, completed: success + failed };
  }

  function renderSidePanel() {
    const listEl = $("hot-sideList");

    if (!listEl) return;

    const sorted = Array.from(sourceState.values()).sort((a, b) => {
      const oa = sourceOrder.has(a.slug) ? sourceOrder.get(a.slug) : 1000000;
      const ob = sourceOrder.has(b.slug) ? sourceOrder.get(b.slug) : 1000000;
      if (oa !== ob) return oa - ob;
      return a.slug.localeCompare(b.slug);
    });

    if (!sorted.length) {
      listEl.innerHTML = '<div class="hot-side-empty">暂无来源</div>';
      return;
    }

    listEl.innerHTML = sorted
      .map((item) => {
        const statusClass =
          item.status === "success" ? "is-success" : item.status === "failed" ? "is-failed" : "is-pending";
        const latencyText = Number.isFinite(item.elapsedMs) && item.elapsedMs >= 0 ? `${item.elapsedMs} ms` : "--";
        return `<div class="hot-side-item ${statusClass}">\n  <span class="hot-side-item-dot"></span>\n  <span class="hot-side-item-name">${escapeHtml(item.name)}</span>\n  <span class="hot-side-item-latency">${escapeHtml(latencyText)}</span>\n</div>`;
      })
      .join("\n");
  }

  function filterSourcesByCategory(allSources, category) {
    const arr = Array.isArray(allSources) ? allSources : [];
    if (!category || category === "all") return arr;
    return arr.filter((s) => String(s?.category ?? "").trim() === category);
  }

  async function loadFallbackJson(activeCategory, fresh, listsBySource) {
    const qs = new URLSearchParams();
    if (activeCategory && activeCategory !== "all") qs.set("category", activeCategory);
    if (fresh) qs.set("fresh", "1");

    const data = await fetchJson(`/api/hot${qs.toString() ? `?${qs.toString()}` : ""}`);
    const lists = Array.isArray(data?.lists) ? data.lists : [];
    const failedList = Array.isArray(data?.failed) ? data.failed : [];

    listsBySource.clear();

    for (const it of lists) {
      const key = String(it?.source ?? "");
      if (key) {
        listsBySource.set(key, it);
        cacheHotListItem(it);
        setSourceStatus(key, "success", "", Date.now() - loadStartedAt);
      }
    }

    for (const it of failedList) {
      setSourceStatus(
        String(it?.slug ?? ""),
        "failed",
        String(it?.message ?? "抓取失败"),
        Date.now() - loadStartedAt
      );
    }

    renderLists(sortListsBySourceOrder(Array.from(listsBySource.values())));

    const stats = summarizeSourceState();
    setProgress(stats.completed, stats.total);
    renderStatus();
    finishLoadingDock(stats.completed, stats.total);
  }

  async function load(activeCategory, opts) {
    const reqId = ++requestSeq;
    currentCategory = activeCategory || "all";
    const fresh = opts && opts.fresh === true;

    if (!fresh && tryRenderFromCache(currentCategory)) {
      closeStream();
      return;
    }

    loadStartedAt = Date.now();
    closeStream();
    setRefreshLoading(true);

    renderStatus();
    startLoadingDock("正在抓取来源...");
    renderLists([]);

    try {
      const sourcesResp = await fetchJson(`/api/hot/sources?fresh=1`);
      if (reqId !== requestSeq) return;

      const allSources = Array.isArray(sourcesResp?.sources) ? sourcesResp.sources : [];
      cacheSourcesCatalog(sourcesResp?.categories || {}, allSources);
      if (currentCategory !== "all" && !cachedCategoryKeys.includes(currentCategory)) {
        currentCategory = "all";
      }
      renderCategories(cachedCategoryKeys, currentCategory);
      const filteredSources = filterSourcesByCategory(cachedSources, currentCategory);
      buildSourceState(filteredSources);

      const listsBySource = new Map();
      const cachedSnapshot = getCachedCategorySnapshot(currentCategory);
      for (const it of cachedSnapshot.lists) {
        const key = String(it?.source ?? "").trim();
        if (key) listsBySource.set(key, it);
      }
      renderLists(sortListsBySourceOrder(Array.from(listsBySource.values())));
      const totalSources = filteredSources.length;
      setProgress(0, totalSources);

      if (typeof EventSource !== "function") {
        await loadFallbackJson(currentCategory, fresh, listsBySource);
        if (reqId === requestSeq) setRefreshLoading(false);
        return;
      }

      const qs = new URLSearchParams();
      if (currentCategory && currentCategory !== "all") qs.set("category", currentCategory);
      if (fresh) qs.set("fresh", "1");

      let gotAnyEvent = false;
      let fallbackTried = false;

      const streamUrl = `/api/hot/stream${qs.toString() ? `?${qs.toString()}` : ""}`;
      const es = new EventSource(streamUrl);
      eventSource = es;

      es.addEventListener("start", (e) => {
        if (reqId !== requestSeq || eventSource !== es) return;
        const data = safeJsonParse(e.data);
        const total = Number(data?.total ?? totalSources ?? 0);
        gotAnyEvent = true;
        setProgress(0, total);
        setLoadingText(total > 0 ? "流式抓取中..." : "等待数据返回...");
      });

      es.addEventListener("hotlist", (e) => {
        if (reqId !== requestSeq || eventSource !== es) return;
        const data = safeJsonParse(e.data);
        const key = String(data?.source ?? "");
        if (key) {
          listsBySource.set(key, data);
          cacheHotListItem(data);
          setSourceStatus(key, "success", "", Number(data?.elapsedMs ?? NaN));
        }
        renderLists(sortListsBySourceOrder(Array.from(listsBySource.values())));
      });

      es.addEventListener("failed", (e) => {
        if (reqId !== requestSeq || eventSource !== es) return;
        const data = safeJsonParse(e.data);
        setSourceStatus(
          String(data?.slug ?? ""),
          "failed",
          String(data?.message ?? "抓取失败"),
          Number(data?.elapsedMs ?? NaN)
        );
      });

      es.addEventListener("progress", (e) => {
        if (reqId !== requestSeq || eventSource !== es) return;
        const data = safeJsonParse(e.data);
        const completed = Number(data?.completed ?? 0);
        const total = Number(data?.total ?? totalSources ?? 0);
        gotAnyEvent = true;
        setProgress(completed, total);
        const progressText = total > 0 ? `流式抓取中（${Math.min(completed, total)}/${total}）` : "流式抓取中...";
        setLoadingText(progressText);
        renderStatus();
      });

      es.addEventListener("done", (e) => {
        if (reqId !== requestSeq || eventSource !== es) return;
        const data = safeJsonParse(e.data);

        const total = Number(data?.total ?? totalSources ?? 0);
        const completed = Number(data?.completed ?? summarizeSourceState().completed);
        const failedCount = Number(data?.failed ?? summarizeSourceState().failed);

        renderStatus();
        finishLoadingDock(completed, total);

        closeStream();
        setRefreshLoading(false);
      });

      es.addEventListener("error", async () => {
        if (reqId !== requestSeq || eventSource !== es) return;
        closeStream();

        if (!gotAnyEvent && !fallbackTried) {
          fallbackTried = true;
          try {
            await loadFallbackJson(currentCategory, fresh, listsBySource);
          } catch (err) {
            const msg = String(err?.message || err || "未知错误");
            renderStatus();
            showLoadingFailure(`加载失败：${msg}`);
          } finally {
            if (reqId === requestSeq) setRefreshLoading(false);
          }
          return;
        }

        renderStatus();
        showLoadingFailure("连接中断，已展示部分结果");
        setRefreshLoading(false);
      });
    } catch (err) {
      if (reqId !== requestSeq) return;
      const msg = String(err?.message || err || "未知错误");
      renderStatus();
      showLoadingFailure(`加载失败：${msg}`);
      setRefreshLoading(false);
    }
  }

  function bindCategoryClicks() {
    const wrap = $("hot-categories");
    if (!wrap || wrap.dataset.bound === "1") return;
    wrap.dataset.bound = "1";

    wrap.addEventListener("click", (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button[data-hot-cat]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const cat = btn.getAttribute("data-hot-cat") || "all";
      if (String(cat) === String(currentCategory)) return;
      void load(cat);
    });
  }

  function bindRefresh() {
    const refreshBtn = $("hotRefreshBtn");
    if (refreshBtn && refreshBtn.dataset.bound !== "1") {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", () => void load(currentCategory, { fresh: true }));
    }

  }

  function bindSideControls() {
    const toggle = $("hotSideToggle");
    const floatBtn = $("hotSideFloat");
    const backdrop = $("hotSideBackdrop");

    if (toggle && toggle.dataset.bound !== "1") {
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", () => {
        applySideState(!sideOpen);
      });
    }

    if (floatBtn && floatBtn.dataset.bound !== "1") {
      floatBtn.dataset.bound = "1";
      floatBtn.addEventListener("click", () => {
        applySideState(true, { persist: false });
      });
    }

    if (backdrop && backdrop.dataset.bound !== "1") {
      backdrop.dataset.bound = "1";
      backdrop.addEventListener("click", () => {
        applySideState(false, { persist: false });
      });
    }

    window.addEventListener("resize", syncSideStateForViewport);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && sideOpen && sideMobile) applySideState(false, { persist: false });
    });
  }

  initSidePanelState();
  bindCategoryClicks();
  bindRefresh();
  bindSideControls();
  void load("all");
})();
