function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function prettyJson(value) {
  try {
    if (typeof value === "string") {
      const t = value.trim();
      if (!t) return "";
      return JSON.stringify(JSON.parse(t), null, 2);
    }
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return typeof value === "string" ? value : String(value ?? "");
  }
}

function syntaxHighlightJson(jsonText) {
  const text = escapeHtml(String(jsonText ?? ""));
  return text.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      let cls = "number";
      if (m.startsWith('"')) cls = m.endsWith(":") ? "property" : "string";
      else if (m === "true" || m === "false") cls = "boolean";
      else if (m === "null") cls = "constant";
      return `<span class="token ${cls}">${m}</span>`;
    }
  );
}

function renderJsonBlock(title, value) {
  const jsonText = prettyJson(value);
  if (!jsonText.trim()) return "";
  return `
<details style="margin-top: 10px">
  <summary class="meta" style="cursor: pointer">${escapeHtml(title)}</summary>
  <pre style="margin: 10px 0 0"><code class="language-json">${syntaxHighlightJson(jsonText)}</code></pre>
</details>
`.trim();
}

function safeParseJson(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function renderTechStack(jsonText) {
  const parsed = safeParseJson(jsonText);
  if (!parsed) return `<div class="meta">未配置（可在后台「设置」-「关于页配置（/about）」里填写）</div>`;

  if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
    const chips = parsed
      .map((s) => `<span class="chip chip--teal">${escapeHtml(s)}</span>`)
      .join(" ");
    return `<div class="tag-list">${chips}</div>${renderJsonBlock("原始 JSON", parsed)}`;
  }

  if (Array.isArray(parsed) && parsed.every((x) => x && typeof x === "object")) {
    const blocks = parsed
      .map((g) => {
        const title = g.title ? String(g.title) : "";
        const items = Array.isArray(g.items) ? g.items : [];
        const chips = items
          .filter((x) => typeof x === "string")
          .map((s) => `<span class="chip chip--teal">${escapeHtml(s)}</span>`)
          .join(" ");
        return `
<div style="margin: 10px 0 0">
  ${title ? `<div style="font-weight: 800; margin-bottom: 8px">${escapeHtml(title)}</div>` : ""}
  <div class="tag-list">${chips}</div>
</div>
`.trim();
      })
      .join("");
    return `${blocks}${renderJsonBlock("原始 JSON", parsed)}`;
  }

  return `${renderJsonBlock("原始 JSON", parsed)}`;
}

function renderTimeline(jsonText) {
  const parsed = safeParseJson(jsonText);
  if (!parsed) return `<div class="meta">未配置（可在后台「设置」-「关于页配置（/about）」里填写）</div>`;

  if (!Array.isArray(parsed)) return renderJsonBlock("原始 JSON", parsed);

  const items = parsed
    .filter((x) => x && typeof x === "object")
    .map((it) => {
      const year = it.year ?? it.from ?? "";
      const title = it.title ? String(it.title) : it.TITLE ? String(it.TITLE) : "";
      const desc = it.description ? String(it.description) : it.desc ? String(it.desc) : "";
      return `
<div class="card" style="padding: 12px; margin: 10px 0 0">
  <div class="meta">${escapeHtml(String(year))}</div>
  <div style="font-weight: 800; margin-top: 4px">${escapeHtml(title)}</div>
  ${desc ? `<div class="meta" style="margin-top: 6px; white-space: pre-wrap">${escapeHtml(desc)}</div>` : ""}
</div>
`.trim();
    })
    .join("");

  return `${items || `<div class="meta">（空）</div>`}${renderJsonBlock("原始 JSON", parsed)}`;
}

function pickSkillIcon(kind) {
  const k = String(kind ?? "").toLowerCase();
  if (k.includes("ui") || k.includes("ux") || k.includes("design") || k.includes("设计")) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
  <line x1="8" y1="21" x2="16" y2="21"></line>
  <line x1="12" y1="17" x2="12" y2="21"></line>
</svg>`;
  }
  if (k.includes("back") || k.includes("server") || k.includes("api") || k.includes("后端")) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="2" y1="12" x2="22" y2="12"></line>
  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
</svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="16 18 22 12 16 6"></polyline>
  <polyline points="8 6 2 12 8 18"></polyline>
</svg>`;
}

function renderSkills(jsonText) {
  const parsed = safeParseJson(jsonText);
  if (!parsed) {
    return `<div class="meta">未配置：请在后台「设置」-「/about 配置」里填写「技能专长（JSON）」</div>`;
  }

  const list = Array.isArray(parsed) ? parsed : [];
  if (list.length === 0) return `<div class="meta">（空）</div>`;

  const cards = list
    .map((it) => {
      if (!it) return "";

      if (typeof it === "string") {
        const title = "技能";
        const tags = [it];
        return `
<div class="about-skill-card">
  <div class="about-skill-header">
    <div class="about-skill-icon">${pickSkillIcon(title)}</div>
    <h3 class="about-skill-title">${escapeHtml(title)}</h3>
  </div>
  <div class="about-skill-tags">
    ${tags.map((s) => `<span class="about-skill-tag">${escapeHtml(String(s))}</span>`).join("")}
  </div>
</div>
`.trim();
      }

      if (typeof it !== "object") return "";

      const title = it.title
        ? String(it.title)
        : it.TITLE
          ? String(it.TITLE)
          : it.name
            ? String(it.name)
            : "技能";
      const desc = it.description
        ? String(it.description)
        : it.DESCRIPTION
          ? String(it.DESCRIPTION)
          : it.desc
            ? String(it.desc)
            : "";
      const tagsRaw =
        Array.isArray(it.tags)
          ? it.tags
          : Array.isArray(it.TAGS)
            ? it.TAGS
            : Array.isArray(it.items)
              ? it.items
              : Array.isArray(it.ITEMS)
                ? it.ITEMS
                : Array.isArray(it.stack)
                  ? it.stack
                  : [];
      const tags = tagsRaw.filter((x) => typeof x === "string").map((x) => String(x));
      const iconKind = it.icon ? String(it.icon) : title;

      return `
<div class="about-skill-card">
  <div class="about-skill-header">
    <div class="about-skill-icon">${pickSkillIcon(iconKind)}</div>
    <h3 class="about-skill-title">${escapeHtml(title)}</h3>
  </div>
  ${desc ? `<p class="about-skill-description">${escapeHtml(desc)}</p>` : ""}
  ${tags.length ? `<div class="about-skill-tags">${tags
    .map((s) => `<span class="about-skill-tag">${escapeHtml(s)}</span>`)
    .join("")}</div>` : ""}
</div>
`.trim();
    })
    .filter(Boolean)
    .join("");

  return cards || `<div class="meta">（空）</div>`;
}

function renderExperience(jsonText) {
  const parsed = safeParseJson(jsonText);
  if (!parsed) {
    return `<div class="meta">未配置：请在后台「设置」-「/about 配置」里填写「工作经历（JSON）」</div>`;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return `<div class="meta">（空）</div>`;

  const items = parsed
    .filter((x) => x && typeof x === "object")
    .map((it) => {
      const date =
        it.date ??
        it.DATE ??
        it.from ??
        it.FROM ??
        it.period ??
        it.PERIOD ??
        (typeof it.year === "number" ? String(it.year) : it.year ?? "") ??
        (typeof it.YEAR === "number" ? String(it.YEAR) : it.YEAR ?? "") ??
        "";
      const title = it.title ? String(it.title) : "";
      const company = it.company
        ? String(it.company)
        : it.COMPANY
          ? String(it.COMPANY)
          : it.org
            ? String(it.org)
            : it.ORG
              ? String(it.ORG)
              : "";
      const desc = it.description
        ? String(it.description)
        : it.DESCRIPTION
          ? String(it.DESCRIPTION)
          : it.desc
            ? String(it.desc)
            : "";
      if (!title && !desc && !company && !date) return "";
      return `
<div class="about-timeline-item">
  ${date ? `<div class="about-timeline-date">${escapeHtml(String(date))}</div>` : ""}
  ${title ? `<h3 class="about-timeline-title">${escapeHtml(title)}</h3>` : ""}
  ${company ? `<div class="about-timeline-company">${escapeHtml(company)}</div>` : ""}
  ${desc ? `<p class="about-timeline-description">${escapeHtml(desc)}</p>` : ""}
</div>
`.trim();
    })
    .filter(Boolean)
    .join("");

  return items || `<div class="meta">（空）</div>`;
}

async function fetchJson(path) {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

let heatmapInstance = null;
let lastVisitedPlaces = [];

function findSidebarCardByTitle(keyword) {
  const kw = String(keyword ?? "").trim();
  if (!kw) return null;
  const cards = document.querySelectorAll(".about-sidebar .glass-card");
  for (const card of cards) {
    const title = card.querySelector(".glass-card-title")?.textContent || "";
    if (title.includes(kw)) return card;
  }
  return null;
}

function openMeteoToCondition(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) return { icon: "🌤️", text: "天气" };
  if (c === 0) return { icon: "☀️", text: "晴朗" };
  if (c === 1) return { icon: "🌤️", text: "多云" };
  if (c === 2) return { icon: "⛅", text: "多云" };
  if (c === 3) return { icon: "☁️", text: "阴" };
  if (c === 45 || c === 48) return { icon: "🌫️", text: "雾" };
  if ([51, 53, 55, 56, 57].includes(c)) return { icon: "🌦️", text: "毛毛雨" };
  if ([61, 63, 65, 66, 67].includes(c)) return { icon: "🌧️", text: "下雨" };
  if ([71, 73, 75, 77].includes(c)) return { icon: "❄️", text: "下雪" };
  if ([80, 81, 82].includes(c)) return { icon: "🌧️", text: "阵雨" };
  if ([95, 96, 99].includes(c)) return { icon: "⛈️", text: "雷雨" };
  return { icon: "🌤️", text: "天气" };
}

async function loadConfigAndRender() {
  const skillsRoot = $("about-skills") || $("about-tech");
  const expRoot = $("about-experience") || $("about-timeline");

  const cfg = await fetchJson("/api/about-config");
  const config = cfg?.config ?? {};

  const techStackJson = typeof config.techStackJson === "string" ? config.techStackJson : "";
  const visitedPlacesJson = typeof config.visitedPlacesJson === "string" ? config.visitedPlacesJson : "";
  const timelineJson = typeof config.timelineJson === "string" ? config.timelineJson : "";

  if (skillsRoot) skillsRoot.innerHTML = renderSkills(techStackJson);
  if (expRoot) expRoot.innerHTML = renderExperience(timelineJson);

  const visitedParsed = safeParseJson(visitedPlacesJson);
  const visitedPlaces =
    Array.isArray(visitedParsed) ? visitedParsed.filter((x) => typeof x === "string") : [];
  lastVisitedPlaces = visitedPlaces;
}

async function updateSidebarWeather() {
  const card = findSidebarCardByTitle("实时天气");
  if (!card) return;

  const tempEl = card.querySelector(".weather-card-temp");
  const descEl = card.querySelector(".weather-card-desc");
  const iconEl = card.querySelector(".weather-card-icon");
  const detailEls = card.querySelectorAll(".weather-detail-value");

  try {
    const data = await fetchJson("/api/weather-now");
    const loc = data?.location ?? {};
    const city = String(loc?.city ?? loc?.region ?? loc?.country ?? "").trim();

    const om = data?.weather?.openMeteo ?? null;
    const current = om?.current ?? null;
    const temp = typeof current?.temperature_2m === "number" ? current.temperature_2m : null;
    const humidity =
      typeof current?.relative_humidity_2m === "number" ? current.relative_humidity_2m : null;
    const wind =
      typeof current?.wind_speed_10m === "number" ? current.wind_speed_10m : null;
    const code = current?.weather_code;
    const cond = openMeteoToCondition(code);

    if (tempEl) tempEl.textContent = temp === null ? "—" : `${Math.round(temp)}°`;
    if (iconEl) iconEl.textContent = cond.icon;
    if (descEl) {
      const left = city ? `${city} · ` : "";
      descEl.textContent = `${left}${cond.text}`;
    }

    if (detailEls.length >= 1) detailEls[0].textContent = humidity === null ? "—" : `${Math.round(humidity)}%`;
    if (detailEls.length >= 2) detailEls[1].textContent = wind === null ? "—" : `${Math.round(wind)} km/h`;
    if (detailEls.length >= 3) detailEls[2].textContent = "—";
  } catch (e) {
    if (descEl) descEl.textContent = `获取失败：${String(e?.message || e)}`;
  }
}

async function updateSidebarBrief() {
  const card = findSidebarCardByTitle("今日快讯");
  if (!card) return;
  const list = card.querySelector(".glass-list");
  const badge = card.querySelector(".glass-card-badge");
  if (!list) return;

  try {
    const data = await fetchJson("/api/programmer-history");
    const events = Array.isArray(data?.events) ? data.events : [];
    const top = events.slice(0, 3);
    if (badge) badge.textContent = String(top.length);

    list.innerHTML = top
      .map((ev) => {
        const year = ev?.year ?? "";
        const title = ev?.title ? String(ev.title) : "";
        const subtitle = year ? `${year}` : "";
        return `
<div class="glass-list-item">
  <div class="glass-list-item-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  </div>
  <div class="glass-list-item-content">
    <div class="glass-list-item-title">${escapeHtml(title)}</div>
    <div class="glass-list-item-subtitle"><span>${escapeHtml(subtitle || "历史今日")}</span></div>
  </div>
</div>
`.trim();
      })
      .join("");
  } catch {
    // ignore
  }
}

async function updateSidebarTravel() {
  const card = findSidebarCardByTitle("旅行足迹");
  if (!card) return;
  const list = card.querySelector(".glass-list");
  const badge = card.querySelector(".glass-card-badge");
  if (!list) return;

  try {
    const cfg = await fetchJson("/api/about-config");
    const placesJson = typeof cfg?.config?.visitedPlacesJson === "string" ? cfg.config.visitedPlacesJson : "";
    const parsed = safeParseJson(placesJson);
    const places = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    if (badge) badge.textContent = String(places.length);

    list.innerHTML = places
      .map((p) => {
        const title = String(p);
        return `
<div class="glass-list-item">
  <div class="glass-list-item-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  </div>
  <div class="glass-list-item-content">
    <div class="glass-list-item-title">${escapeHtml(title)}</div>
  </div>
</div>
`.trim();
      })
      .join("");
  } catch {
    // ignore
  }
}

function refreshNewsImage() {
  const img = $("about-news-image");
  if (!img) return;
  if (!img.getAttribute("data-zoom-bound")) {
    img.setAttribute("data-zoom-bound", "1");
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.addEventListener("click", () => {
      const src = String(img.currentSrc || img.src || "").trim();
      if (!src) return;
      window.open(src, "_blank", "noopener,noreferrer");
    });

    if (!$("about-news-hint")) {
      try {
        const section = img.closest("section");
        const meta = section ? section.querySelector(".meta") : null;
        if (meta) meta.textContent = "每日新闻图片";
      } catch {
        // ignore
      }

      const hint = document.createElement("div");
      hint.className = "meta";
      hint.style.marginTop = "6px";
      hint.textContent = "点击查看大图";
      img.insertAdjacentElement("afterend", hint);
    }

    const mq = window.matchMedia ? window.matchMedia("(min-width: 1680px)") : null;
    const onChange = () => refreshNewsImage();
    if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else if (mq && typeof mq.addListener === "function") mq.addListener(onChange);
    window.addEventListener("resize", onChange, { passive: true });
  }

  const mq = window.matchMedia ? window.matchMedia("(min-width: 1680px)") : null;
  const wide = mq ? mq.matches : window.innerWidth >= 1680;
  const hint = $("about-news-hint");
  if (!wide) {
    img.removeAttribute("src");
    if (hint) hint.style.display = "none";
    return;
  }
  if (hint) hint.style.display = "";
  if (!img.getAttribute("src")) img.src = `/api/news-image?__t=${Date.now()}`;
}

let floatNewsEls = null;

function ensureFloatNewsCard() {
  if (floatNewsEls) return floatNewsEls;

  const root = document.createElement("div");
  root.id = "about-float-news";
  root.className = "glass-card about-float-news";
  root.style.display = "none";

  const header = document.createElement("div");
  header.className = "glass-card-header";

  const title = document.createElement("div");
  title.className = "glass-card-title";
  title.innerHTML = `
<span class="glass-card-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 4h16v16H4z"></path>
    <path d="M8 8h8M8 12h8M8 16h5"></path>
  </svg>
</span>
<span>每日新闻</span>
`.trim();

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.alignItems = "center";

  const openBtn = document.createElement("a");
  openBtn.className = "chip";
  openBtn.href = "/api/news-image";
  openBtn.target = "_blank";
  openBtn.rel = "noopener noreferrer";
  openBtn.textContent = "查看";
  openBtn.title = "新窗口打开";

  actions.appendChild(openBtn);
  header.appendChild(title);
  header.appendChild(actions);

  const body = document.createElement("div");
  body.className = "glass-card-body";

  root.appendChild(header);
  root.appendChild(body);
  document.body.appendChild(root);

  floatNewsEls = { root, body };
  return floatNewsEls;
}

function setupFloatingNewsImage() {
  const img = $("about-news-image");
  const inlineWrap = $("about-news-inline");
  if (!img || !inlineWrap) return;

  const floatCard = ensureFloatNewsCard();
  const mq = window.matchMedia ? window.matchMedia("(min-width: 1860px)") : null;

  const apply = () => {
    const enabled = mq ? mq.matches : window.innerWidth >= 1860;
    if (enabled) {
      document.body.classList.add("about-float-news-enabled");
      floatCard.root.style.display = "";
      if (!floatCard.body.contains(img)) floatCard.body.appendChild(img);
      return;
    }

    document.body.classList.remove("about-float-news-enabled");
    floatCard.root.style.display = "none";
    if (!inlineWrap.contains(img)) inlineWrap.appendChild(img);
  };

  if (!img.getAttribute("data-float-wired")) {
    img.setAttribute("data-float-wired", "1");
    if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", apply);
    else if (mq && typeof mq.addListener === "function") mq.addListener(apply);
    window.addEventListener("resize", apply, { passive: true });
  }

  apply();
}

async function mountHeatmap() {
  const root = $("about-heatmap");
  if (!root) return;

  if (heatmapInstance && typeof heatmapInstance.destroy === "function") {
    heatmapInstance.destroy();
    heatmapInstance = null;
  }

  root.innerHTML = `<div class="meta">加载 3D 地球中...</div>`;
  try {
    const mod = await import("./world-heatmap.js");
    heatmapInstance = await mod.initWorldHeatmap(root, lastVisitedPlaces);
  } catch (e) {
    root.innerHTML = `<div class="meta">加载失败：${escapeHtml(e?.message || String(e))}</div>`;
  }
}

async function main() {
  const btnHeatmap = $("aboutHeatmapReload");
  if (btnHeatmap) btnHeatmap.addEventListener("click", () => void mountHeatmap());

  refreshNewsImage();
  await loadConfigAndRender().catch(() => null);
  await mountHeatmap();
  void updateSidebarBrief();
  void updateSidebarTravel();
}
let previewEl = null;
function ensureImagePreview() {
  if (previewEl) return previewEl;

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.display = "none";
  overlay.style.pointerEvents = "none";

  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.left = "16px";
  panel.style.top = "92px";
  panel.style.bottom = "16px";
  panel.style.width = "min(520px, 92vw)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "10px";
  panel.style.padding = "12px";
  panel.style.borderRadius = "16px";
  panel.style.border = "1px solid rgba(255,255,255,0.12)";
  panel.style.background = "rgba(15, 23, 42, 0.72)";
  panel.style.backdropFilter = "blur(12px)";
  panel.style.boxShadow = "0 18px 70px rgba(0,0,0,0.55)";
  panel.style.pointerEvents = "auto";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "10px";

  const title = document.createElement("div");
  title.className = "meta";
  title.style.fontWeight = "800";
  title.textContent = "每日新闻图片";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "chip";
  closeBtn.textContent = "关闭";

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const img = document.createElement("img");
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.maxHeight = "calc(100vh - 160px)";
  img.style.objectFit = "contain";
  img.style.borderRadius = "12px";
  img.style.border = "1px solid rgba(255,255,255,0.10)";
  img.style.background = "rgba(0,0,0,0.2)";
  img.alt = "news-image";
  panel.appendChild(img);
  overlay.appendChild(panel);

  const close = () => {
    overlay.style.display = "none";
    img.src = "";
  };

  closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  document.body.appendChild(overlay);
  const applyLayout = () => {
    const small = window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
    if (small) {
      // Mobile: use fullscreen modal.
      overlay.style.pointerEvents = "auto";
      overlay.style.background = "rgba(0,0,0,0.72)";
      overlay.style.backdropFilter = "blur(8px)";
      panel.style.left = "50%";
      panel.style.top = "50%";
      panel.style.bottom = "auto";
      panel.style.transform = "translate(-50%, -50%)";
      panel.style.width = "min(96vw, 720px)";
      panel.style.maxHeight = "92vh";
    } else {
      // Desktop: left floating panel (doesn't block page).
      overlay.style.pointerEvents = "none";
      overlay.style.background = "transparent";
      overlay.style.backdropFilter = "";
      panel.style.left = "16px";
      panel.style.top = "92px";
      panel.style.bottom = "16px";
      panel.style.transform = "";
      panel.style.width = "min(520px, 92vw)";
      panel.style.maxHeight = "";
    }
  };

  window.addEventListener("resize", applyLayout, { passive: true });
  applyLayout();

  previewEl = { overlay, img, close, applyLayout };
  return previewEl;
}

function openImagePreview(url) {
  const u = String(url ?? "").trim();
  if (!u) return;
  const p = ensureImagePreview();
  if (typeof p.applyLayout === "function") p.applyLayout();
  p.img.src = u;
  p.overlay.style.display = "block";
}

void main();
