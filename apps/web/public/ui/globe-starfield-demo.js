import { initWorldHeatmap } from "/ui/about/world-heatmap.js";

const SAMPLE_PLACES = [
  "中国-北京",
  "中国-上海",
  "中国-广东",
  "中国-云南",
  "中国-浙江",
  "中国-湖北",
  "中国-四川",
  "中国-新疆",
  "中国-辽宁",
  "中国-台湾"
];

const COPY = {
  "day-stars": {
    title: "Day A: pale upper-atmosphere sky with sparse visible stars.",
    body: "This version keeps a celestial layer in daylight. You still get a bright sky, but there are faint stars and a weak orbital light band behind the globe."
  },
  "day-atmosphere": {
    title: "Day B: no stars, only solar glow, haze, and atmospheric scattering.",
    body: "This version removes the starfield completely and pushes the scene toward a clean daylight atmosphere study with a stronger sun disk and brighter air layers."
  },
  night: {
    title: "Night mode: dense stars, a brighter galaxy band, and occasional shooting stars.",
    body: "This is the full space route: darker base, larger star density, warmer constellation points, and intermittent meteors cutting across the frame."
  }
};

const SKY_CONFIG = {
  "day-stars": {
    starCount: 76,
    clusterCount: 18,
    twinkleRatio: 0.45,
    shooting: false
  },
  "day-atmosphere": {
    starCount: 0,
    clusterCount: 0,
    twinkleRatio: 0,
    shooting: false
  },
  night: {
    starCount: 220,
    clusterCount: 56,
    twinkleRatio: 0.78,
    shooting: true
  }
};

const root = document.documentElement;
const body = document.body;
const globeMount = document.getElementById("demoStarfieldGlobe");
const titleEl = document.getElementById("globeDemoTitle");
const bodyEl = document.getElementById("globeDemoBody");
const starsLayer = document.getElementById("globeDemoStars");
const shootingLayer = document.getElementById("globeDemoShooting");
const themeButtons = Array.from(document.querySelectorAll("[data-theme-target]"));

let heatmap = null;
let activeTheme = "night";
let shootingTimer = null;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clearNode(node) {
  if (!(node instanceof HTMLElement)) return;
  node.replaceChildren();
}

function buildStar(theme, x, y, scaleBias = 1) {
  const star = document.createElement("span");
  const tierRoll = Math.random();
  const baseSize =
    tierRoll > 0.93 ? randomBetween(3.1, 4.4) : tierRoll > 0.72 ? randomBetween(2, 3) : randomBetween(1, 2.1);
  const opacityBase = theme === "night" ? randomBetween(0.55, 1) : randomBetween(0.38, 0.78);
  const duration = theme === "night" ? randomBetween(2.4, 6.2) : randomBetween(4.8, 8.2);

  star.className = "globe-demo-star";
  if (baseSize > 3) {
    star.classList.add("is-large");
  } else if (baseSize > 2) {
    star.classList.add("is-medium");
  }

  if (Math.random() < SKY_CONFIG[theme].twinkleRatio) {
    star.classList.add("is-twinkle");
  }

  star.style.setProperty("--x", `${x}%`);
  star.style.setProperty("--y", `${y}%`);
  star.style.setProperty("--size", `${(baseSize * scaleBias).toFixed(2)}px`);
  star.style.setProperty("--opacity", opacityBase.toFixed(3));
  star.style.setProperty("--star-opacity", opacityBase.toFixed(3));
  star.style.setProperty("--delay", `${randomBetween(0, 4).toFixed(2)}s`);
  star.style.setProperty("--twinkle", `${duration.toFixed(2)}s`);

  return star;
}

function pickStarPosition(theme, index, total) {
  if (theme === "day-stars") {
    if (index < SKY_CONFIG[theme].clusterCount) {
      const orbitRatio = index / Math.max(1, total);
      const angle = randomBetween(-0.55, 0.7);
      const radius = randomBetween(22, 42) + orbitRatio * 8;
      return {
        x: 48 + Math.cos(angle) * radius,
        y: 46 + Math.sin(angle) * radius * 0.52
      };
    }

    return {
      x: randomBetween(8, 92),
      y: randomBetween(8, 72)
    };
  }

  if (theme === "night") {
    if (index < SKY_CONFIG[theme].clusterCount) {
      const t = index / Math.max(1, SKY_CONFIG[theme].clusterCount - 1);
      const x = 8 + t * 84 + randomBetween(-6, 6);
      const y = 18 + t * 42 + randomBetween(-10, 10);
      return { x, y };
    }

    return {
      x: randomBetween(2, 98),
      y: randomBetween(2, 98)
    };
  }

  return { x: 50, y: 50 };
}

function renderStars(theme) {
  if (!(starsLayer instanceof HTMLElement)) return;

  clearNode(starsLayer);

  const config = SKY_CONFIG[theme];
  if (!config || config.starCount <= 0) return;

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < config.starCount; index += 1) {
    const position = pickStarPosition(theme, index, config.starCount);
    const star = buildStar(theme, position.x, position.y, theme === "night" ? 1 : 0.92);
    fragment.appendChild(star);
  }

  starsLayer.appendChild(fragment);
}

function spawnShootingStar() {
  if (!(shootingLayer instanceof HTMLElement) || activeTheme !== "night") return;

  const shootingStar = document.createElement("span");
  shootingStar.className = "globe-demo-shooting-star";
  shootingStar.style.top = `${randomBetween(8, 36).toFixed(2)}%`;
  shootingStar.style.left = `${randomBetween(4, 28).toFixed(2)}%`;
  shootingStar.style.animationDuration = `${randomBetween(1.9, 2.8).toFixed(2)}s`;
  shootingLayer.appendChild(shootingStar);

  window.setTimeout(() => {
    shootingStar.remove();
  }, 3200);
}

function stopShootingStars() {
  if (shootingTimer) {
    window.clearInterval(shootingTimer);
    shootingTimer = null;
  }

  clearNode(shootingLayer);
}

function syncShootingStars(theme) {
  stopShootingStars();

  if (!SKY_CONFIG[theme]?.shooting) return;

  shootingTimer = window.setInterval(() => {
    if (Math.random() > 0.42) {
      spawnShootingStar();
    }
  }, 1800);
}

function applyTheme(theme) {
  activeTheme = theme;

  const isNight = theme === "night";
  body.setAttribute("data-demo-theme", theme);
  root.setAttribute("data-theme", isNight ? "dark" : "light");

  themeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-theme-target") === theme);
  });

  const nextCopy = COPY[theme] || COPY["day-stars"];
  if (titleEl) titleEl.textContent = nextCopy.title;
  if (bodyEl) bodyEl.textContent = nextCopy.body;

  renderStars(theme);
  syncShootingStars(theme);
}

async function mountDemoGlobe() {
  if (!(globeMount instanceof HTMLElement)) return;
  heatmap = await initWorldHeatmap(globeMount, SAMPLE_PLACES);
  heatmap?.setAutoRotateEnabled?.(true);
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextTheme = button.getAttribute("data-theme-target") || "day-stars";
    applyTheme(nextTheme);
  });
});

applyTheme("night");
void mountDemoGlobe();
