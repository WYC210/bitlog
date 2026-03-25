import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from "/third/three/three.module.js";
import { OrbitControls } from "/third/three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "/third/three/examples/jsm/renderers/CSS2DRenderer.js";
import initWasm, { GeoProcessor } from "/wasm/geo/geo_wasm.js";

function getColors() {
  return {
    earthBase: "#07111f",
    border: "#7f91b5",
    visitedBorder: "#5eead4",
    chinaBorder: "#fb7185",
    highlight: "#ffd166",
    labelBg: "rgba(3, 10, 24, 0.74)",
    labelText: "#f8fbff"
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildStar(x, y, scaleBias = 1) {
  const star = document.createElement("span");
  const sizeRoll = Math.random();
  const size =
    sizeRoll > 0.94 ? randomBetween(3.1, 4.5) : sizeRoll > 0.72 ? randomBetween(2.1, 3.2) : randomBetween(1.1, 2.2);

  star.className = "about-horizontal-star";
  if (size > 3) {
    star.classList.add("is-large");
  } else if (size > 2) {
    star.classList.add("is-medium");
  }

  star.style.setProperty("--star-x", `${x.toFixed(2)}%`);
  star.style.setProperty("--star-y", `${y.toFixed(2)}%`);
  star.style.setProperty("--star-size", `${(size * scaleBias).toFixed(2)}px`);
  star.style.setProperty("--star-opacity", randomBetween(0.48, 1).toFixed(2));
  star.style.setProperty("--star-scale", randomBetween(0.82, 1.36).toFixed(2));
  star.style.setProperty("--star-duration", `${randomBetween(2.4, 6.1).toFixed(2)}s`);
  star.style.setProperty("--star-delay", `${(-randomBetween(0, 5.8)).toFixed(2)}s`);

  return star;
}

function createConstellation() {
  const layer = document.createElement("div");
  layer.className = "about-horizontal-constellation";
  layer.innerHTML = `
    <span class="constellation-star c1"></span>
    <span class="constellation-star c2"></span>
    <span class="constellation-star c3"></span>
    <span class="constellation-star c4"></span>
    <span class="constellation-line l1"></span>
    <span class="constellation-line l2"></span>
    <span class="constellation-line l3"></span>
  `;
  return layer;
}

function createStarfield(count = 220) {
  const layer = document.createElement("div");
  layer.className = "about-horizontal-starfield";

  const nebulaLayer = document.createElement("div");
  nebulaLayer.className = "about-horizontal-nebula";
  layer.appendChild(nebulaLayer);

  const starsLayer = document.createElement("div");
  starsLayer.className = "about-horizontal-stars";
  layer.appendChild(starsLayer);

  const constellationLayer = createConstellation();
  layer.appendChild(constellationLayer);

  const shootingLayer = document.createElement("div");
  shootingLayer.className = "about-horizontal-shooting-layer";
  layer.appendChild(shootingLayer);

  for (let index = 0; index < count; index += 1) {
    let x = randomBetween(2, 98);
    let y = randomBetween(2, 98);

    if (index < 56) {
      const t = index / 55;
      x = 8 + t * 84 + randomBetween(-5.5, 5.5);
      y = 18 + t * 42 + randomBetween(-9, 9);
    }

    starsLayer.appendChild(buildStar(x, y));
  }

  return { layer, shootingLayer };
}

function spawnShootingStar(layer) {
  if (!(layer instanceof HTMLElement)) return;

  const shootingStar = document.createElement("span");
  shootingStar.className = "about-horizontal-shooting-star";
  shootingStar.style.top = `${randomBetween(8, 36).toFixed(2)}%`;
  shootingStar.style.left = `${randomBetween(4, 26).toFixed(2)}%`;
  shootingStar.style.animationDuration = `${randomBetween(1.8, 2.8).toFixed(2)}s`;
  layer.appendChild(shootingStar);

  window.setTimeout(() => {
    shootingStar.remove();
  }, 3200);
}

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry && typeof child.geometry.dispose === "function") child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m?.dispose?.());
      else if (typeof child.material.dispose === "function") child.material.dispose();
    }
  });
}

export async function initWorldHeatmap(container, visitedPlaces) {
  if (!container) throw new Error("Missing container");
  const places = Array.isArray(visitedPlaces) ? visitedPlaces : [];

  container.innerHTML = "";
  container.style.position = "relative";
  let shootingTimer = null;
  const { layer: starfield, shootingLayer } = createStarfield();
  container.appendChild(starfield);

  const setStatus = () => {};

  setStatus("Loading...");

  const colors = getColors();

  const scene = new Scene();
  scene.background = null;

  const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.copy(new Vector3(-2.1, 3.41, -6.5));
  camera.lookAt(0, 0, 0);

  function getViewportSize() {
    const rect = container.getBoundingClientRect();
    let width = Math.max(1, Math.round(rect.width || container.clientWidth || 1));
    let height = Math.max(1, Math.round(rect.height || container.clientHeight || 1));
    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    if (isMobile) {
      const side = Math.max(260, Math.min(width, 360));
      container.style.height = `${side}px`;
      height = side;
      width = Math.max(1, Math.round(container.getBoundingClientRect().width || width));
    } else {
      container.style.height = "";
    }

    return { width, height };
  }

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    precision: "highp"
  });
  renderer.sortObjects = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  {
    const { width, height } = getViewportSize();
    renderer.setSize(width, height);
  }
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.domElement.style.pointerEvents = "none";
  renderer.domElement.style.outline = "none";
  renderer.domElement.style.boxShadow = "none";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.position = "relative";
  renderer.domElement.style.zIndex = "2";
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  {
    const { width, height } = getViewportSize();
    labelRenderer.setSize(width, height);
  }
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.width = "100%";
  labelRenderer.domElement.style.height = "100%";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelRenderer.domElement.style.zIndex = "3";
  container.appendChild(labelRenderer.domElement);

  const earth = new Mesh(
    new SphereGeometry(2.0, 64, 64),
    new MeshBasicMaterial({ color: colors.earthBase, transparent: true, opacity: 0.9 })
  );
  earth.renderOrder = 1;
  scene.add(earth);

  scene.add(new AmbientLight(0xffffff, 0.8));
  const dir = new DirectionalLight(0xffffff, 0.6);
  dir.position.set(6, 4, 6);
  scene.add(dir);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.rotateSpeed = 0.2;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;
  controls.minDistance = 5;
  controls.maxDistance = 15;
  controls.minPolarAngle = Math.PI * 0.1;
  controls.maxPolarAngle = Math.PI * 0.9;

  let autoRotateEnabled = true;
  let hoverPaused = false;
  let interactive = false;
  const updateAutoRotate = () => {
    controls.autoRotate = !!autoRotateEnabled && !hoverPaused;
  };
  updateAutoRotate();

  const pauseAutoRotate = () => {
    hoverPaused = true;
    updateAutoRotate();
  };
  const resumeAutoRotate = () => {
    hoverPaused = false;
    updateAutoRotate();
  };

  const activationLayer = document.createElement("button");
  activationLayer.type = "button";
  activationLayer.setAttribute("aria-label", "Activate globe interaction");
  activationLayer.style.position = "absolute";
  activationLayer.style.inset = "0";
  activationLayer.style.zIndex = "6";
  activationLayer.style.border = "0";
  activationLayer.style.padding = "0";
  activationLayer.style.margin = "0";
  activationLayer.style.background = "transparent";
  activationLayer.style.outline = "none";
  activationLayer.style.boxShadow = "none";
  activationLayer.style.cursor = "pointer";
  activationLayer.style.zIndex = "6";
  container.appendChild(activationLayer);

  const setInteractive = (enabled) => {
    interactive = !!enabled;
    renderer.domElement.style.pointerEvents = interactive ? "auto" : "none";
    activationLayer.style.pointerEvents = interactive ? "none" : "auto";
    activationLayer.style.cursor = interactive ? "default" : "pointer";
    container.classList.toggle("is-interactive", interactive);
    if (interactive) {
      container.setAttribute("data-horizontal-scroll-lock", "true");
      renderer.domElement.focus({ preventScroll: true });
      pauseAutoRotate();
    } else {
      container.removeAttribute("data-horizontal-scroll-lock");
      resumeAutoRotate();
    }
  };
  setInteractive(false);

  const onAutoEnter = () => pauseAutoRotate();
  const onAutoLeave = () => resumeAutoRotate();
  const onAutoPointerUp = () => resumeAutoRotate();
  const onActivate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!interactive) setInteractive(true);
  };
  const onDocumentPointerDown = (event) => {
    if (!interactive) return;
    if (container.contains(event.target)) return;
    setInteractive(false);
  };
  const onEscape = (event) => {
    if (event.key !== "Escape" || !interactive) return;
    setInteractive(false);
  };

  renderer.domElement.addEventListener("mouseenter", onAutoEnter, { passive: true });
  renderer.domElement.addEventListener("mouseleave", onAutoLeave, { passive: true });
  renderer.domElement.addEventListener("pointerdown", onAutoEnter, { passive: true });
  activationLayer.addEventListener("pointerdown", onActivate);
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  window.addEventListener("keydown", onEscape);
  window.addEventListener("pointerup", onAutoPointerUp, { passive: true });

  const hoverEl = null;

  const worldUrl = "/maps/world.zh.json";
  const chinaUrl = "/maps/china.json";

  setStatus("Loading maps...");
  const [worldData, chinaData] = await Promise.all([
    fetch(worldUrl).then((r) => r.json()),
    fetch(chinaUrl).then((r) => r.json())
  ]);

  setStatus("Loading WASM...");
  await initWasm();
  const geo = new GeoProcessor();
  geo.process_geojson(
    JSON.stringify(worldData),
    JSON.stringify(chinaData),
    JSON.stringify(places),
    2.0
  );

  setStatus("Building lines...");
  const boundaryLines = geo.get_boundary_lines() || [];

  const group = new Group();
  earth.add(group);

  const linesByName = new Map();
  const lineMetaByName = new Map();

  const computeBaseColor = (name, isVisited) => {
    const s = String(name ?? "");
    const china = s === "中国" || s.startsWith("中国-") || s.toLowerCase() === "china" || s.toLowerCase().startsWith("china-");
    if (isVisited) return colors.visitedBorder;
    if (china) return colors.chinaBorder;
    return colors.border;
  };

  for (const boundaryLine of boundaryLines) {
    const points = Array.isArray(boundaryLine?.points) ? boundaryLine.points : [];
    const name = String(boundaryLine?.region_name ?? "");
    const isVisited = !!boundaryLine?.is_visited;
    if (!name || points.length < 2) continue;

    const pts = points.map((p) => new Vector3(p.x, p.y, p.z));
    const geom = new BufferGeometry().setFromPoints(pts);
    const base = computeBaseColor(name, isVisited);
    const mat = new LineBasicMaterial({
      color: base,
      linewidth: isVisited ? 1.8 : 1.2,
      transparent: true,
      opacity: isVisited ? 0.95 : 0.85
    });
    const line = new Line(geom, mat);
    line.userData = { name, isVisited, baseColor: base };
    line.renderOrder = isVisited ? 3 : 2;
    group.add(line);

    const list = linesByName.get(name) || [];
    list.push(line);
    linesByName.set(name, list);
    lineMetaByName.set(name, { isVisited });
  }

  const allRegionNames = Array.from(linesByName.keys());

  const raycaster = new Raycaster();
  const mouse = new Vector2();
  let hoveredName = null;

  const setHover = (name) => {
    const next = name ? String(name) : null;
    if (next === hoveredName) return;

    const prev = hoveredName;
    hoveredName = next;

    const resetLines = (n) => {
      const list = linesByName.get(n) || [];
      for (const line of list) {
        const base = line.userData?.baseColor;
        if (base) line.material.color.set(base);
        line.material.opacity = line.userData?.isVisited ? 0.95 : 0.85;
      }
    };

    const highlightLines = (n) => {
      const list = linesByName.get(n) || [];
      for (const line of list) {
        line.material.color.set(colors.highlight);
        line.material.opacity = 1.0;
      }
    };

    if (prev) resetLines(prev);
    if (next) highlightLines(next);

    if (!next) {
      if (hoverEl) {
        hoverEl.style.display = "none";
        hoverEl.textContent = "";
      }
      return;
    }
    if (hoverEl) {
      hoverEl.style.display = "";
      hoverEl.textContent = next;
    }
  };

  function resolveFocusName(place) {
    const raw = String(place ?? "").trim();
    if (!raw) return null;

    const candidates = [];
    const rawNoTail = raw.split("·")[0] ?? raw;
    candidates.push(raw);
    candidates.push(rawNoTail);

    if (raw.includes("-")) {
      const parts = raw.split("-").map((x) => x.trim()).filter(Boolean);
      const left = parts[0] ?? "";
      const right = parts[1] ?? "";
      const rightNoTail = right.split("·")[0] ?? right;
      if (right) candidates.push(right);
      if (rightNoTail) candidates.push(rightNoTail);
      if (left) candidates.push(left);
      if (right && left) candidates.push(`${left}-${rightNoTail}`);
    }

    for (const c of candidates) {
      if (!c) continue;
      if (linesByName.has(c)) return c;
    }

    for (const c of candidates) {
      if (!c) continue;
      for (const n of allRegionNames) {
        if (n === c) return n;
        if (n.endsWith(`-${c}`)) return n;
        if (n.includes(c)) return n;
      }
    }

    return null;
  }

  function focusPlace(place) {
    const raw = String(place ?? "").trim();
    if (!raw) {
      setHover(null);
      return true;
    }

    const name = resolveFocusName(raw);
    if (!name) return false;
    setHover(name);
    return true;
  }

  const onMouseMove = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.set(x, y);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(earth, false)[0];
    if (!hit) return setHover(null);
    const p = hit.point;
    const name = geo.find_nearest_country(p.x, p.y, p.z, 0.28);
    setHover(name || null);
  };

  const onMouseLeave = () => setHover(null);

  renderer.domElement.addEventListener("mousemove", onMouseMove, { passive: true });
  renderer.domElement.addEventListener("mouseleave", onMouseLeave, { passive: true });

  const resize = () => {
    const { width, height } = getViewportSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
  };

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(container);
  resize();

  let raf = null;
  const animate = () => {
    raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  };
  animate();
  shootingTimer = window.setInterval(() => {
    if (Math.random() > 0.4) {
      spawnShootingStar(shootingLayer);
    }
  }, 1800);

  setStatus("");

  return {
    focusPlace,
    setAutoRotateEnabled(enabled) {
      autoRotateEnabled = !!enabled;
      updateAutoRotate();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      if (shootingTimer) window.clearInterval(shootingTimer);
      ro?.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseleave", onMouseLeave);
      renderer.domElement.removeEventListener("mouseenter", onAutoEnter);
      renderer.domElement.removeEventListener("mouseleave", onAutoLeave);
      renderer.domElement.removeEventListener("pointerdown", onAutoEnter);
      activationLayer.removeEventListener("pointerdown", onActivate);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerup", onAutoPointerUp);
      controls.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      container.innerHTML = "";
    }
  };
}
