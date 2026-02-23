// Bitlog UI sync preview - post TOC active highlight.
(function () {
  const tocPanel = document.querySelector(".post-toc");
  if (tocPanel && tocPanel.tagName === "DETAILS") {
    const mq = window.matchMedia ? window.matchMedia("(max-width: 980px)") : null;
    const apply = () => {
      try {
        if (mq && mq.matches) tocPanel.removeAttribute("open");
        else tocPanel.setAttribute("open", "");
      } catch {
        // ignore
      }
    };
    apply();
    try {
      mq && mq.addEventListener && mq.addEventListener("change", apply);
    } catch {
      // ignore
    }
  }

  const tocRoot = document.querySelector(".post-toc .toc");
  if (!tocRoot) return;

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const links = Array.from(tocRoot.querySelectorAll("a.toc-link[data-toc-id]"));
  const groups = Array.from(tocRoot.querySelectorAll(".toc-group[data-toc-group]"));

  const groupMeta = groups
    .map((el) => {
      const id = String(el.getAttribute("data-toc-group") || "").trim();
      const toggle = el.querySelector("button.toc-toggle");
      const children = el.querySelector(".toc-children");
      const hasChildren = !!(children && children.querySelector("a.toc-link-h3"));
      return { el, id, toggle, hasChildren };
    })
    .filter((g) => g.id);
  const groupById = new Map(groupMeta.map((g) => [g.id, g]));

  const items = links
    .map((link) => {
      const id = String(link.getAttribute("data-toc-id") || "").trim();
      const group = String(link.getAttribute("data-toc-group") || "").trim();
      const target = id ? document.getElementById(id) : null;
      return { link, id, group, target };
    })
    .filter((x) => x.id && x.target);

  if (items.length === 0) return;

  const itemById = new Map(items.map((x) => [x.id, x]));

  let activeId = "";

  function syncToggle(groupId) {
    const g = groupById.get(groupId);
    if (!g || !g.toggle || !g.hasChildren) return;
    try {
      g.toggle.setAttribute("aria-expanded", g.el.classList.contains("is-open") ? "true" : "false");
    } catch {
      // ignore
    }
  }

  function setGroupOpen(groupId, open, reason) {
    const g = groupById.get(groupId);
    if (!g) return;
    g.el.classList.toggle("is-open", !!(open && g.hasChildren));
    syncToggle(groupId);
  }

  function applyAutoOpen(groupId) {
    if (!groupId) return;
    for (const g of groupMeta) {
      if (g.id === groupId) {
        setGroupOpen(g.id, true, "auto");
      } else {
        setGroupOpen(g.id, false, "auto");
      }
    }
  }

  function setActive(nextId) {
    const id = String(nextId || "");
    const groupId = itemById.get(id)?.group ?? "";
    applyAutoOpen(groupId);
    if (!id || id === activeId) return;
    activeId = id;
    for (const it of items) {
      it.link.classList.toggle("active", it.id === id);
    }
  }

  for (const g of groupMeta) {
    if (!g.toggle || !g.hasChildren) continue;
    g.toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !g.el.classList.contains("is-open");
      setGroupOpen(g.id, next, "manual");
    });
    syncToggle(g.id);
  }

  for (const it of items) {
    it.link.addEventListener("click", (e) => {
      if (!it.target) return;
      e.preventDefault();
      try {
        it.target.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start"
        });
        history.replaceState(null, "", `#${encodeURIComponent(it.id)}`);
      } catch {
        // ignore
      }
      setActive(it.id);
    });
  }

  function syncFromLocationHash() {
    const raw = String(location.hash || "").replace(/^#/, "");
    if (!raw) return;
    const decoded = decodeURIComponent(raw);
    if (items.some((x) => x.id === decoded)) setActive(decoded);
  }

  syncFromLocationHash();
  window.addEventListener("hashchange", () => syncFromLocationHash());

  const topOffset = 86;
  let raf = 0;
  function updateFromScroll() {
    raf = 0;
    // Pick the last heading above the top offset.
    let candidate = items[0]?.id ?? "";
    let bestTop = -Infinity;
    for (const it of items) {
      const el = it.target;
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top <= topOffset + 1 && top > bestTop) {
        bestTop = top;
        candidate = it.id;
      }
    }
    if (candidate) setActive(candidate);
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(updateFromScroll);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();

  // Initialize: open group for first section.
  const first = items.find((x) => x.group);
  if (first?.group) applyAutoOpen(first.group);
})();
