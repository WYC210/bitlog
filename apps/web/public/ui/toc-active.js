// Bitlog UI sync preview - post TOC active highlight.
(function () {
  const tocRoot = document.querySelector(".post-toc .toc");
  if (!tocRoot) return;

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const links = Array.from(tocRoot.querySelectorAll("a.toc-link[data-toc-id]"));
  const groups = Array.from(tocRoot.querySelectorAll(".toc-group[data-toc-group]"));

  const items = links
    .map((link) => {
      const id = String(link.getAttribute("data-toc-id") || "").trim();
      const group = String(link.getAttribute("data-toc-group") || "").trim();
      const target = id ? document.getElementById(id) : null;
      return { link, id, group, target };
    })
    .filter((x) => x.id && x.target);

  if (items.length === 0) return;

  let activeId = "";
  let openGroup = "";

  function setActive(nextId) {
    const id = String(nextId || "");
    if (!id || id === activeId) return;
    activeId = id;
    const groupId = items.find((x) => x.id === id)?.group ?? "";
    if (groupId && groupId !== openGroup) {
      openGroup = groupId;
      for (const g of groups) {
        const gid = String(g.getAttribute("data-toc-group") || "").trim();
        g.classList.toggle("is-open", gid === openGroup);
      }
    }
    for (const it of items) {
      it.link.classList.toggle("active", it.id === id);
    }
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
  if (!openGroup) {
    const first = items.find((x) => x.group);
    if (first?.group) {
      openGroup = first.group;
      for (const g of groups) {
        const gid = String(g.getAttribute("data-toc-group") || "").trim();
        g.classList.toggle("is-open", gid === openGroup);
      }
    }
  }
})();
