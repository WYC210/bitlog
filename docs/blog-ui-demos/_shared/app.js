(function () {
  const page = document.body?.getAttribute("data-page") || "";
  const links = Array.from(document.querySelectorAll("[data-nav] a[data-page]"));
  for (const a of links) {
    a.setAttribute("aria-current", a.getAttribute("data-page") === page ? "page" : "false");
  }
})();

