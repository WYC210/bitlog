(() => {
  if (window.__bitlogNavMenuInstalled) return;
  window.__bitlogNavMenuInstalled = true;

  const header = document.querySelector(".site-header");
  const toggle = document.getElementById("navMenuToggle");
  const nav = document.getElementById("siteMainNav") || document.querySelector(".nav.nav-main");
  if (!header || !toggle || !nav) return;

  const media = window.matchMedia("(max-width: 560px)");
  const isMobile = () => media.matches;
  const isOpen = () => header.getAttribute("data-nav-open") === "1";
  const syncExpanded = () => toggle.setAttribute("aria-expanded", isOpen() ? "true" : "false");

  const setOpen = (open) => {
    const next = isMobile() && !!open;
    if (next) {
      header.setAttribute("data-nav-open", "1");
      if (typeof window.__bitlogOpenSearch === "function") window.__bitlogOpenSearch(false);
    } else {
      header.removeAttribute("data-nav-open");
    }
    syncExpanded();
  };

  syncExpanded();

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    setOpen(!isOpen());
  });

  document.addEventListener("pointerdown", (e) => {
    if (!isMobile() || !isOpen()) return;
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (toggle.contains(t) || nav.contains(t)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    try {
      toggle.focus();
    } catch {
      // ignore
    }
  });

  nav.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest("a[href]")) return;
    setOpen(false);
  });

  const onMediaChange = () => {
    if (!isMobile()) setOpen(false);
  };
  if (typeof media.addEventListener === "function") media.addEventListener("change", onMediaChange);
  else if (typeof media.addListener === "function") media.addListener(onMediaChange);

  try {
    window.__bitlogSetNavOpen = (open) => setOpen(open !== false);
  } catch {
    // ignore
  }
})();
