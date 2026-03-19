(function () {
  const KEY = "__bitlogBackToTopManager";
  const existing = window[KEY];
  if (existing && typeof existing.sync === "function") {
    existing.sync();
    return;
  }

  const SHOW_AFTER_PX = 480;
  const svgNS = "http://www.w3.org/2000/svg";
  const R = 46;
  const CIRC = 2 * Math.PI * R;

  const state = {
    btn: null,
    ring: null,
    indicator: null,
    visible: false,
    raf: 0
  };

  function prefersReducedMotion() {
    return !!(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isPostPage() {
    return String(document.body?.getAttribute("data-page") || "").trim() === "post";
  }

  function createArrowIcon() {
    const icon = document.createElementNS(svgNS, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("aria-hidden", "true");

    const pathA = document.createElementNS(svgNS, "path");
    pathA.setAttribute("d", "M12 19V5");
    pathA.setAttribute("stroke", "currentColor");
    pathA.setAttribute("stroke-width", "2");
    pathA.setAttribute("stroke-linecap", "round");

    const pathB = document.createElementNS(svgNS, "path");
    pathB.setAttribute("d", "M5 12l7-7 7 7");
    pathB.setAttribute("stroke", "currentColor");
    pathB.setAttribute("stroke-width", "2");
    pathB.setAttribute("stroke-linecap", "round");
    pathB.setAttribute("stroke-linejoin", "round");

    icon.appendChild(pathA);
    icon.appendChild(pathB);
    return icon;
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.className = "scroll-to-top";
    btn.id = "scrollToTop";
    btn.type = "button";
    btn.setAttribute("aria-label", "返回顶部");
    btn.setAttribute("title", "返回顶部");
    btn.appendChild(createArrowIcon());
    return btn;
  }

  function createRing() {
    const ring = document.createElementNS(svgNS, "svg");
    ring.setAttribute("viewBox", "0 0 100 100");
    ring.setAttribute("aria-hidden", "true");
    ring.classList.add("scroll-to-top-ring");

    const track = document.createElementNS(svgNS, "circle");
    track.setAttribute("cx", "50");
    track.setAttribute("cy", "50");
    track.setAttribute("r", String(R));
    track.setAttribute("fill", "none");
    track.setAttribute("stroke-width", "6");
    track.classList.add("scroll-to-top-ring-track");

    const indicator = document.createElementNS(svgNS, "circle");
    indicator.setAttribute("cx", "50");
    indicator.setAttribute("cy", "50");
    indicator.setAttribute("r", String(R));
    indicator.setAttribute("fill", "none");
    indicator.setAttribute("stroke-width", "6");
    indicator.setAttribute("stroke-linecap", "round");
    indicator.setAttribute("stroke-dasharray", `${CIRC} ${CIRC}`);
    indicator.setAttribute("stroke-dashoffset", String(CIRC));
    indicator.classList.add("scroll-to-top-ring-indicator");

    ring.appendChild(track);
    ring.appendChild(indicator);
    return { ring, indicator };
  }

  function syncRingGeometry() {
    const btn = state.btn;
    const ring = state.ring;
    if (!btn || !ring || !btn.isConnected) return;
    try {
      const pad = 4;
      ring.style.inset = `-${pad}px`;
      ring.style.width = `calc(100% + ${pad * 2}px)`;
      ring.style.height = `calc(100% + ${pad * 2}px)`;
    } catch {
      // ignore
    }
  }

  function attachButton(btn) {
    if (!btn) return;

    let ring = btn.querySelector(":scope > .scroll-to-top-ring");
    let indicator = ring?.querySelector(".scroll-to-top-ring-indicator") ?? null;
    if (!(ring instanceof SVGElement) || !(indicator instanceof SVGElement)) {
      const created = createRing();
      ring = created.ring;
      indicator = created.indicator;
      btn.insertBefore(ring, btn.firstChild);
    }

    if (btn.dataset.backToTopBound !== "1") {
      btn.dataset.backToTopBound = "1";
      btn.addEventListener("click", () => {
        try {
          window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        } catch {
          window.scrollTo(0, 0);
        }
      });
    }

    state.btn = btn;
    state.ring = ring;
    state.indicator = indicator;
    syncRingGeometry();
  }

  function ensureButton() {
    if (!isPostPage()) {
      for (const el of Array.from(document.querySelectorAll(".scroll-to-top"))) {
        el.remove();
      }
      state.btn = null;
      state.ring = null;
      state.indicator = null;
      state.visible = false;
      return null;
    }

    let btn = document.getElementById("scrollToTop");
    if (!(btn instanceof HTMLButtonElement)) {
      btn = createButton();
      document.body.appendChild(btn);
    }
    attachButton(btn);
    return btn;
  }

  function getScrollProgress() {
    const el = document.scrollingElement || document.documentElement;
    const max =
      (el && el.scrollHeight ? el.scrollHeight : 0) -
      (el && el.clientHeight ? el.clientHeight : 0);
    if (!max || max <= 0) return 0;
    const p = (el && typeof el.scrollTop === "number" ? el.scrollTop : window.scrollY) / max;
    if (!Number.isFinite(p)) return 0;
    return Math.max(0, Math.min(1, p));
  }

  function setVisible(next) {
    const btn = state.btn;
    if (!btn) return;
    const visible = !!next;
    state.visible = visible;
    btn.classList.toggle("visible", visible);
  }

  function updateProgress() {
    state.raf = 0;
    if (!state.indicator || !state.btn) return;
    const p = getScrollProgress();
    state.indicator.setAttribute("stroke-dashoffset", String(CIRC * (1 - p)));
  }

  function scheduleUpdate() {
    if (state.raf) return;
    state.raf = window.requestAnimationFrame(updateProgress);
  }

  function handleScroll() {
    const btn = ensureButton();
    if (!btn) return;
    try {
      setVisible(window.scrollY > SHOW_AFTER_PX);
      scheduleUpdate();
    } catch {
      // ignore
    }
  }

  function sync() {
    const btn = ensureButton();
    if (!btn) return;
    syncRingGeometry();
    handleScroll();
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", sync);
  window.addEventListener("bitlog:spa:afterSwap", sync);

  const api = { sync };
  window[KEY] = api;
  sync();
})();
