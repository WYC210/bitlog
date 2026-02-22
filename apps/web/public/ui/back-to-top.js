(function () {
  const btn = document.getElementById("scrollToTop");
  if (!btn) return;

  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SHOW_AFTER_PX = 480;
  let visible = false;

  function setVisible(next) {
    const v = !!next;
    if (v === visible) return;
    visible = v;
    btn.classList.toggle("visible", visible);
  }

  function onScroll() {
    try {
      setVisible(window.scrollY > SHOW_AFTER_PX);
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
  onScroll();
})();

