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

function skillLevelToLabel(level) {
  const l = String(level ?? "").trim().toLowerCase();
  if (l === "beginner") return "Beginner";
  if (l === "intermediate") return "Intermediate";
  if (l === "advanced") return "Advanced";
  if (l === "expert") return "Expert";
  return "";
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

      const levelLabel = skillLevelToLabel(it.level ?? it.LEVEL);
      const url = it.url ? String(it.url) : it.URL ? String(it.URL) : "";
      const metaBits = [];
      if (levelLabel) metaBits.push(`<span class="about-skill-tag">${escapeHtml(levelLabel)}</span>`);
      if (url) {
        metaBits.push(
          `<a class="about-skill-tag" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Link</a>`
        );
      }
      const metaHtml = metaBits.length ? `<div class="about-skill-tags">${metaBits.join("")}</div>` : "";

      return `
<div class="about-skill-card">
  <div class="about-skill-header">
    <div class="about-skill-icon">${pickSkillIcon(iconKind)}</div>
    <h3 class="about-skill-title">${escapeHtml(title)}</h3>
  </div>
  ${desc ? `<p class="about-skill-description">${escapeHtml(desc)}</p>` : ""}
  ${metaHtml}
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
      const from = it.from ?? it.FROM ?? "";
      const to = it.to ?? it.TO ?? "";
      const present = it.present === true || it.PRESENT === true;
      const computedDate =
        from && present
          ? `${String(from)} ~ Present`
          : from && to
            ? `${String(from)} ~ ${String(to)}`
            : from
              ? String(from)
              : "";

      const date =
        computedDate ||
        it.date ||
        it.DATE ||
        it.period ||
        it.PERIOD ||
        (typeof it.year === "number" ? String(it.year) : it.year ?? "") ||
        (typeof it.YEAR === "number" ? String(it.YEAR) : it.YEAR ?? "") ||
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
let aboutSidebarFlags = { travel: true };

function flashElement(el) {
  if (!el) return;
  el.classList.remove("bitlog-flash");
  // Force reflow to restart animation.
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;
  el.classList.add("bitlog-flash");
  window.setTimeout(() => el.classList.remove("bitlog-flash"), 1200);
}

function scrollToHeatmap(opts) {
  const place = opts?.place ? String(opts.place) : "";
  const heatmap = $("about-heatmap");
  if (!heatmap) return;
  const card = heatmap.closest(".card") || heatmap;

  try {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    // ignore
  }
  flashElement(card);

  if (place && heatmapInstance && typeof heatmapInstance.focusPlace === "function") {
    try {
      heatmapInstance.focusPlace(place);
    } catch {
      // ignore
    }
  }
}

function setGlassCardTitle(card, title) {
  const el = card ? card.querySelector(".glass-card-title") : null;
  if (!el) return;
  const next = String(title ?? "").trim();
  if (!next) return;
  // 模板里的标题通常会包含多个 TextNode（换行/缩进 + 实际文本）。
  // 直接替换第一个 TextNode 会导致“历史上的今日 今日快讯”同时出现。
  // 这里统一移除所有 TextNode，再追加一个干净的文本节点。
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) el.removeChild(node);
  }
  el.appendChild(document.createTextNode(next));
}

function formatVisitedPlaceLabel(place) {
  const s = String(place ?? "").trim();
  if (!s) return "";
  const i = s.indexOf("-");
  if (i === -1) return s.replaceAll("·", " · ");
  const left = s.slice(0, i).trim();
  const right = s.slice(i + 1).trim().replaceAll("·", " · ");
  if (!left || !right) return s.replaceAll("·", " · ");
  return `${right} · ${left}`;
}

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
  aboutSidebarFlags = {
    travel: config.sidebarTravelEnabled !== false
  };
  const travelCard = document.getElementById("about-travel-card");
  if (travelCard) travelCard.style.display = aboutSidebarFlags.travel ? "" : "none";

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
  setGlassCardTitle(card, "历史上的今日");

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

async function updateSidebarTravel() {
  const card = document.getElementById("about-travel-card") || findSidebarCardByTitle("旅行足迹");
  if (!card) return;
  const list = card.querySelector(".glass-list");
  const badge = card.querySelector(".glass-card-badge");
  if (!list) return;

  const header = card.querySelector(".glass-card-header");
  if (header && !header.getAttribute("data-travel-wired")) {
    header.setAttribute("data-travel-wired", "1");
    header.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.closest?.(".glass-list-item") || t.closest?.("a"))) return;
      scrollToHeatmap({});
    });
  }

  if (!list.getAttribute("data-travel-wired")) {
    list.setAttribute("data-travel-wired", "1");
    list.addEventListener("click", (e) => {
      const a = e.target?.closest?.(".glass-list-item");
      if (!a) return;
      e.preventDefault?.();

      for (const it of Array.from(list.querySelectorAll(".glass-list-item.is-active"))) it.classList.remove("is-active");
      a.classList.add("is-active");

      const place = a.getAttribute("data-place") || "";
      scrollToHeatmap({ place });
    });
  }

  try {
    const cfg = await fetchJson("/api/about-config");
    const placesJson = typeof cfg?.config?.visitedPlacesJson === "string" ? cfg.config.visitedPlacesJson : "";
    const parsed = safeParseJson(placesJson);
    let places = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").map((x) => String(x)) : [];
    if (!places.length && Array.isArray(lastVisitedPlaces) && lastVisitedPlaces.length) places = lastVisitedPlaces.slice();
    if (badge) badge.textContent = String(places.length);

    const maxShow = 8;
    const shown = places.slice(0, maxShow);

    const bodyHtml = shown
      .map((p) => {
        const label = formatVisitedPlaceLabel(p);
        const place = String(p);
        return `
<a href="#about-heatmap" class="glass-list-item" data-place="${escapeHtml(place)}">
  <div class="glass-list-item-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  </div>
  <div class="glass-list-item-content">
    <div class="glass-list-item-title">${escapeHtml(label)}</div>
  </div>
</a>
`.trim();
      })
      .join("");

    const more = places.length - shown.length;
    const moreHtml =
      more > 0
        ? `
<a href="#about-heatmap" class="glass-list-item" data-place="">
  <div class="glass-list-item-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M8 12h8"></path>
      <path d="M12 8v8"></path>
    </svg>
  </div>
  <div class="glass-list-item-content">
    <div class="glass-list-item-title">${escapeHtml(`还有 ${more} 条…`)}</div>
  </div>
</a>
`.trim()
        : "";

    const emptyHtml = `
<a href="#about-heatmap" class="glass-list-item" data-place="">
  <div class="glass-list-item-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
  </div>
  <div class="glass-list-item-content">
    <div class="glass-list-item-title">（未配置）</div>
  </div>
</a>
`.trim();

    list.innerHTML = places.length ? [bodyHtml, moreHtml].filter(Boolean).join("") : emptyHtml;
  } catch {
    // ignore
  }
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
  if (document.body?.getAttribute?.("data-page") !== "about") return;

  const btnHeatmap = $("aboutHeatmapReload");
  if (btnHeatmap && !btnHeatmap.getAttribute("data-wired")) {
    btnHeatmap.setAttribute("data-wired", "1");
    btnHeatmap.addEventListener("click", () => void mountHeatmap());
  }

  await loadConfigAndRender().catch(() => null);
  await mountHeatmap();
  if (aboutSidebarFlags.travel) void updateSidebarTravel();
}
let initRunning = false;
async function initAbout() {
  if (initRunning) return;
  if (document.body?.getAttribute?.("data-page") !== "about") return;
  if (!$("about-skills") && !$("about-tech")) return;

  initRunning = true;
  try {
    await main();
  } finally {
    initRunning = false;
  }
}

try {
  window.__bitlogAboutInit = initAbout;
} catch {
  // ignore
}

window.addEventListener("bitlog:spa:afterSwap", () => {
  void initAbout();
});

void initAbout();
