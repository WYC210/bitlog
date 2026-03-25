(function () {
  const stage = document.getElementById("projectsDemoStage");
  const track = document.getElementById("projectsDemoTrack");
  const progress = document.getElementById("projectsDemoProgressBar");
  const parallaxLayers = Array.from(document.querySelectorAll("[data-parallax-layer]"));

  if (!stage || !track || !progress) return;

  const isDesktop = () => window.matchMedia("(min-width: 1081px)").matches;
  const state = {
    currentX: 0,
    targetX: 0,
    maxX: 0,
    raf: 0,
    dragging: false,
    dragStartX: 0,
    dragStartTarget: 0
  };

  function clamp(value) {
    return Math.max(0, Math.min(state.maxX, value));
  }

  function syncBounds() {
    if (!isDesktop()) {
      state.currentX = 0;
      state.targetX = 0;
      state.maxX = 0;
      track.style.transform = "";
      parallaxLayers.forEach((layer) => {
        layer.style.transform = "";
      });
      progress.style.width = "0%";
      return;
    }

    state.maxX = Math.max(0, track.scrollWidth - stage.clientWidth);
    state.currentX = clamp(state.currentX);
    state.targetX = clamp(state.targetX);
  }

  function updateProgressAndParallax() {
    const ratio = state.maxX > 0 ? state.currentX / state.maxX : 0;
    progress.style.width = `${ratio * 100}%`;

    parallaxLayers.forEach((layer) => {
      const strength = Number(layer.getAttribute("data-parallax-layer") || "0");
      const offset = -state.currentX * strength;
      layer.style.transform = `translate3d(${offset}px, 0, 0)`;
    });
  }

  function render() {
    if (!isDesktop()) {
      state.raf = 0;
      return;
    }

    state.currentX += (state.targetX - state.currentX) * 0.11;
    if (Math.abs(state.targetX - state.currentX) < 0.2) {
      state.currentX = state.targetX;
    }

    track.style.transform = `translate3d(${-state.currentX}px, 0, 0)`;
    updateProgressAndParallax();

    if (Math.abs(state.targetX - state.currentX) >= 0.2 || state.dragging) {
      state.raf = window.requestAnimationFrame(render);
      return;
    }

    state.raf = 0;
  }

  function startAnimation() {
    if (state.raf) return;
    state.raf = window.requestAnimationFrame(render);
  }

  function scrollToHash(hash) {
    const id = String(hash || "").replace(/^#/, "");
    if (!id) return;
    const target = document.getElementById(id);
    if (!(target instanceof HTMLElement)) return;

    if (!isDesktop()) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    state.targetX = clamp(target.offsetLeft);
    startAnimation();
  }

  stage.addEventListener("wheel", function (event) {
    if (!isDesktop()) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    state.targetX = clamp(state.targetX + event.deltaY * 1.2);
    startAnimation();
  }, { passive: false });

  stage.addEventListener("mousedown", function (event) {
    if (!isDesktop()) return;
    state.dragging = true;
    state.dragStartX = event.clientX;
    state.dragStartTarget = state.targetX;
    stage.style.cursor = "grabbing";
    startAnimation();
  });

  window.addEventListener("mousemove", function (event) {
    if (!state.dragging || !isDesktop()) return;
    const delta = event.clientX - state.dragStartX;
    state.targetX = clamp(state.dragStartTarget - delta);
  });

  window.addEventListener("mouseup", function () {
    state.dragging = false;
    stage.style.cursor = isDesktop() ? "grab" : "auto";
  });

  window.addEventListener("keydown", function (event) {
    if (!isDesktop()) return;

    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      state.targetX = clamp(state.targetX + Math.round(stage.clientWidth * 0.68));
      startAnimation();
    }

    if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      state.targetX = clamp(state.targetX - Math.round(stage.clientWidth * 0.68));
      startAnimation();
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      const href = anchor.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      scrollToHash(href);
    });
  });

  window.addEventListener("resize", function () {
    syncBounds();
    updateProgressAndParallax();
    startAnimation();
    stage.style.cursor = isDesktop() ? "grab" : "auto";
  });

  syncBounds();
  updateProgressAndParallax();
  stage.style.cursor = isDesktop() ? "grab" : "auto";
})();
