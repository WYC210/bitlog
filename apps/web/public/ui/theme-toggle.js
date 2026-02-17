// Bitlog UI sync preview - theme transition behavior.
(function () {
  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const storageKey = "ui-theme";
  const stored = localStorage.getItem(storageKey);
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (stored) {
    root.setAttribute("data-theme", stored);
  }

  function setTheme(next) {
    root.setAttribute("data-theme", next);
    localStorage.setItem(storageKey, next);
  }

  function createRipple(x, y, next) {
    if (!toggle) {
      return;
    }
    const rect = toggle.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "theme-ripple";
    ripple.style.left = `${x - rect.left}px`;
    ripple.style.top = `${y - rect.top}px`;
    ripple.style.setProperty(
      "--theme-ripple-color",
      next === "dark" ? "230, 230, 230" : "20, 20, 20",
    );
    toggle.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function applyTheme(next, event) {
    const current = root.getAttribute("data-theme") || "light";
    if (current === next) {
      return;
    }

    const rect = toggle ? toggle.getBoundingClientRect() : null;
    const x =
      event?.clientX ??
      (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y =
      event?.clientY ??
      (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    if (rect) {
      createRipple(x, y, next);
    }

    if (!document.startViewTransition || reduceMotion) {
      root.classList.add("theme-transition");
      setTheme(next);
      window.setTimeout(() => {
        root.classList.remove("theme-transition");
      }, 360);
      return;
    }

    const gradientOffset = 0.75;
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><defs><radialGradient id="toggle-theme-gradient"><stop offset="${gradientOffset}"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><circle cx="4" cy="4" r="4" fill="url(#toggle-theme-gradient)"/></svg>`;
    const maskUrl = `data:image/svg+xml;base64,${btoa(maskSvg)}`;
    const maxDistance = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const maxRadius = Math.ceil(maxDistance / gradientOffset);
    const duration = 700;

    root.classList.add("theme-transition-active");

    const transition = document.startViewTransition(() => {
      setTheme(next);
    });

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
      if (style) {
        style.remove();
      }
    });
  }

  if (toggle) {
    toggle.addEventListener("click", (event) => {
      const current = root.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next, event);
    });
  }
})();
