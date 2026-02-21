(function () {
  const root = document.documentElement;
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
})();

