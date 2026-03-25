(function () {
  const revealCards = Array.from(document.querySelectorAll(".reveal-card"));
  const viewButtons = Array.from(document.querySelectorAll("[data-view]"));
  const articleFlow = document.getElementById("articleFlow");

  function bindReveal() {
    if (!("IntersectionObserver" in window)) {
      revealCards.forEach((card) => card.classList.add("is-visible"));
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
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.12
      }
    );

    revealCards.forEach((card) => observer.observe(card));
  }

  function setView(view) {
    if (!articleFlow) return;
    articleFlow.classList.toggle("is-compact", view === "compact");
    viewButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view || "editorial");
    });
  });

  bindReveal();
  setView("editorial");
})();
