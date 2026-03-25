(function () {
  const article = document.getElementById("demoArticle");
  const progressBar = document.getElementById("readingProgressBar");
  const progressValue = document.getElementById("readingProgressValue");
  const tocLinks = Array.from(document.querySelectorAll("[data-toc-link]"));
  const sections = tocLinks
    .map((link) => {
      const href = link.getAttribute("href") || "";
      const id = href.startsWith("#") ? href.slice(1) : "";
      const target = id ? document.getElementById(id) : null;
      return target ? { id, link, target } : null;
    })
    .filter(Boolean);
  const revealBlocks = Array.from(document.querySelectorAll(".reveal-block"));

  if (!article || !progressBar || !progressValue) return;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateReadingProgress() {
    const rect = article.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const total = Math.max(1, rect.height - viewportHeight * 0.4);
    const consumed = clamp(viewportHeight * 0.22 - rect.top, 0, total);
    const ratio = consumed / total;
    const percent = Math.round(ratio * 100);

    progressBar.style.width = `${percent}%`;
    progressValue.textContent = `${percent}%`;
  }

  function updateActiveToc() {
    const pivot = (window.innerHeight || document.documentElement.clientHeight || 0) * 0.28;
    let active = sections[0] || null;

    sections.forEach((entry) => {
      if (entry.target.getBoundingClientRect().top - pivot <= 0) {
        active = entry;
      }
    });

    tocLinks.forEach((link) => {
      link.classList.toggle("is-active", active ? link === active.link : false);
    });
  }

  function bindReveal() {
    if (!("IntersectionObserver" in window)) {
      revealBlocks.forEach((block) => block.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -14% 0px",
        threshold: 0.16
      }
    );

    revealBlocks.forEach((block) => observer.observe(block));
  }

  function update() {
    updateReadingProgress();
    updateActiveToc();
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  bindReveal();
  update();
})();
