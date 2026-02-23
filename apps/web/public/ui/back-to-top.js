(function () {
  const btn = document.getElementById("scrollToTop");
  if (!btn) return;

  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SHOW_AFTER_PX = 480;
  let visible = false;

  const svgNS = "http://www.w3.org/2000/svg";
  const R = 46;
  const CIRC = 2 * Math.PI * R;

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
  btn.insertBefore(ring, btn.firstChild);

  function syncRingGeometry() {
    try {
      const w = btn.offsetWidth || btn.getBoundingClientRect().width || 48;
      const h = btn.offsetHeight || btn.getBoundingClientRect().height || 48;
      // Keep the ring large enough so its inner edge reaches the button edge (avoid a dark seam on dark backgrounds).
      // `4px` works well for both 44px and 48px buttons in this UI.
      const pad = 4;
      ring.style.inset = `-${pad}px`;
      ring.style.width = `calc(100% + ${pad * 2}px)`;
      ring.style.height = `calc(100% + ${pad * 2}px)`;
    } catch {
      // ignore
    }
  }

  function setVisible(next) {
    const v = !!next;
    if (v === visible) return;
    visible = v;
    btn.classList.toggle("visible", visible);
  }

  function getScrollProgress() {
    const el = document.scrollingElement || document.documentElement;
    const max = (el && el.scrollHeight ? el.scrollHeight : 0) - (el && el.clientHeight ? el.clientHeight : 0);
    if (!max || max <= 0) return 0;
    const p = (el && typeof el.scrollTop === "number" ? el.scrollTop : window.scrollY) / max;
    if (!Number.isFinite(p)) return 0;
    return Math.max(0, Math.min(1, p));
  }

  let raf = 0;
  function scheduleUpdate() {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      const p = getScrollProgress();
      indicator.setAttribute("stroke-dashoffset", String(CIRC * (1 - p)));
    });
  }

  function onScroll() {
    try {
      setVisible(window.scrollY > SHOW_AFTER_PX);
      scheduleUpdate();
    } catch {
      // ignore
    }
  }

  btn.addEventListener("click", () => {
    try {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    syncRingGeometry();
    scheduleUpdate();
  });
  syncRingGeometry();
  onScroll();
})();
