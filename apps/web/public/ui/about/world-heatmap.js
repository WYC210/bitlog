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

function isDarkMode() {
  return (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark"
  );
}

function getColors() {
  const dark = isDarkMode();
  return {
    earthBase: dark ? "#1e293b" : "#2a4d69",
    border: dark ? "#6b7280" : "#e0e0e0",
    visitedBorder: dark ? "#10b981" : "#0d9488",
    chinaBorder: dark ? "#f87171" : "#ef4444",
    highlight: dark ? "#fcd34d" : "#60a5fa",
    labelBg: dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
    labelText: dark ? "#f9fafb" : "#0f172a"
  };
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

  const statusEl = document.createElement("div");
  statusEl.className = "chip";
  statusEl.style.position = "absolute";
  statusEl.style.top = "10px";
  statusEl.style.left = "10px";
  statusEl.style.zIndex = "5";
  statusEl.style.pointerEvents = "none";
  container.appendChild(statusEl);

  const setStatus = (s) => {
    statusEl.textContent = s || "";
    statusEl.style.display = s ? "" : "none";
  };

  setStatus("Loading...");

  const colors = getColors();

  const scene = new Scene();
  scene.background = null;

  const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.copy(new Vector3(-2.1, 3.41, -6.5));
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    precision: "highp"
  });
  renderer.sortObjects = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
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

  const hoverEl = document.createElement("div");
  hoverEl.style.position = "absolute";
  hoverEl.style.right = "10px";
  hoverEl.style.top = "10px";
  hoverEl.style.padding = "6px 10px";
  hoverEl.style.borderRadius = "999px";
  hoverEl.style.background = colors.labelBg;
  hoverEl.style.color = colors.labelText;
  hoverEl.style.fontSize = "12px";
  hoverEl.style.fontWeight = "700";
  hoverEl.style.pointerEvents = "none";
  hoverEl.style.display = "none";
  container.appendChild(hoverEl);

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
      hoverEl.style.display = "none";
      hoverEl.textContent = "";
      return;
    }
    hoverEl.style.display = "";
    hoverEl.textContent = next;
  };

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

  const themeObserver = new MutationObserver(() => {
    const next = getColors();
    earth.material.color.set(next.earthBase);
    hoverEl.style.background = next.labelBg;
    hoverEl.style.color = next.labelText;

    colors.earthBase = next.earthBase;
    colors.border = next.border;
    colors.visitedBorder = next.visitedBorder;
    colors.chinaBorder = next.chinaBorder;
    colors.highlight = next.highlight;
    colors.labelBg = next.labelBg;
    colors.labelText = next.labelText;

    for (const [name, list] of linesByName.entries()) {
      const meta = lineMetaByName.get(name) || { isVisited: false };
      const base = computeBaseColor(name, meta.isVisited);
      for (const line of list) {
        line.userData.baseColor = base;
        if (hoveredName !== name) line.material.color.set(base);
      }
    }
    if (hoveredName) {
      const list = linesByName.get(hoveredName) || [];
      for (const line of list) line.material.color.set(colors.highlight);
    }
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"]
  });

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
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

  setStatus("");

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      themeObserver.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseleave", onMouseLeave);
      controls.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      container.innerHTML = "";
    }
  };
}
