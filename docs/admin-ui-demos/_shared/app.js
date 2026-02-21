(function () {
  const root = document.documentElement;
  const THEME_KEY = "bitlog_demo_theme";
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark") return v;
    } catch {}
    return "dark";
  }

  function setTheme(next) {
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }

  setTheme(getTheme());

  function createRipple(toggle, x, y, next) {
    if (!toggle) return;
    const rect = toggle.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "theme-ripple";
    ripple.style.left = `${x - rect.left}px`;
    ripple.style.top = `${y - rect.top}px`;
    ripple.style.setProperty("--theme-ripple-color", next === "dark" ? "230, 230, 230" : "20, 20, 20");
    toggle.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function applyTheme(toggle, next, event) {
    const current = root.getAttribute("data-theme") || "dark";
    if (current === next) return;

    const rect = toggle ? toggle.getBoundingClientRect() : null;
    const x = event?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = event?.clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    if (rect) createRipple(toggle, x, y, next);

    if (!document.startViewTransition || reduceMotion) {
      root.classList.add("theme-transition");
      applyTheme(btn, next, event);
      window.setTimeout(() => {
        btn.textContent = next === "dark" ? "☾" : "☼";
      }, 0);
      window.setTimeout(() => root.classList.remove("theme-transition"), 360);
      return;
    }

    const gradientOffset = 0.75;
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><defs><radialGradient id="toggle-theme-gradient"><stop offset="${gradientOffset}"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><circle cx="4" cy="4" r="4" fill="url(#toggle-theme-gradient)"/></svg>`;
    const maskUrl = `data:image/svg+xml;base64,${btoa(maskSvg)}`;
    const maxDistance = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const maxRadius = Math.ceil(maxDistance / gradientOffset);
    const duration = 700;

    root.classList.add("theme-transition-active");

    const transition = document.startViewTransition(() => setTheme(next));

    transition.ready.then(() => {
      const style = document.createElement("style");
      style.id = "theme-transition-temp-style";
      const baseStyles = `
        animation: none !important;
        -webkit-mask-image: url('${maskUrl}') !important;
        mask-image: url('${maskUrl}') !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        z-index: 1000 !important;
      `;
      const initialStyle = `
        ${baseStyles}
        -webkit-mask-position: ${x}px ${y}px !important;
        mask-position: ${x}px ${y}px !important;
        -webkit-mask-size: 0 !important;
        mask-size: 0 !important;
      `;
      const finalStyle = `
        ${baseStyles}
        -webkit-mask-position: ${x - maxRadius}px ${y - maxRadius}px !important;
        mask-position: ${x - maxRadius}px ${y - maxRadius}px !important;
        -webkit-mask-size: ${maxRadius * 2}px !important;
        mask-size: ${maxRadius * 2}px !important;
        transition: -webkit-mask-position ${duration / 1000}s ease-out,
          -webkit-mask-size ${duration / 1000}s ease-out,
          mask-position ${duration / 1000}s ease-out,
          mask-size ${duration / 1000}s ease-out !important;
      `;

      style.textContent = `::view-transition-new(root) { ${initialStyle} }`;
      document.head.appendChild(style);

      requestAnimationFrame(() => {
        style.textContent = `::view-transition-new(root) { ${finalStyle} }`;
      });
    });

    transition.finished.finally(() => {
      root.classList.remove("theme-transition-active");
      const style = document.getElementById("theme-transition-temp-style");
      if (style) style.remove();
    });
  }

  const collapseBtn = document.getElementById("btnCollapse");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      const next = root.getAttribute("data-sidebar") === "collapsed" ? "expanded" : "collapsed";
      root.setAttribute("data-sidebar", next);
      try {
        localStorage.setItem("bitlog_demo_sidebar", next);
      } catch {}
    });
  }

  try {
    const saved = localStorage.getItem("bitlog_demo_sidebar");
    if (saved === "collapsed" || saved === "expanded") root.setAttribute("data-sidebar", saved);
  } catch {}

  const page = document.body?.getAttribute("data-page") || "";
  const links = Array.from(document.querySelectorAll("[data-nav] a[data-page]"));
  for (const a of links) {
    a.setAttribute("aria-current", a.getAttribute("data-page") === page ? "page" : "false");
  }

  const actions = document.querySelector(".topbar .actions");
  if (actions && !document.getElementById("btnTheme")) {
    const btn = document.createElement("button");
    btn.className = "iconbtn";
    btn.id = "btnTheme";
    btn.type = "button";
    btn.title = "切换主题";
    btn.setAttribute("aria-label", "切换主题");
    btn.textContent = root.getAttribute("data-theme") === "dark" ? "☾" : "☼";
    btn.textContent = root.getAttribute("data-theme") === "dark" ? "☾" : "☼";
    btn.addEventListener("click", (event) => {
      const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
      btn.textContent = next === "dark" ? "☾" : "☼";
    });
    actions.appendChild(btn);
  }
})();
