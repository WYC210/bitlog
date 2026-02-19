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

function renderKvTable(obj, fields) {
  const rows = fields
    .map((f) => {
      const v = obj && typeof obj === "object" ? obj[f] : undefined;
      const text =
        v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `<tr><th style="text-align:left; width: 180px">${escapeHtml(f)}</th><td>${escapeHtml(text)}</td></tr>`;
    })
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
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
  if (!parsed) return `<div class="meta">未配置（可在后台 Settings 里填写 ${escapeHtml("about.tech_stack_json")}）</div>`;

  if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
    const chips = parsed
      .map((s) => `<span class="chip chip--teal">${escapeHtml(s)}</span>`)
      .join(" ");
    return `<div class="tag-list">${chips}</div>${renderJsonBlock("Raw JSON", parsed)}`;
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
    return `${blocks}${renderJsonBlock("Raw JSON", parsed)}`;
  }

  return `${renderJsonBlock("Raw JSON", parsed)}`;
}

function renderTimeline(jsonText) {
  const parsed = safeParseJson(jsonText);
  if (!parsed) return `<div class="meta">未配置（可在后台 Settings 里填写 ${escapeHtml("about.timeline_json")}）</div>`;

  if (!Array.isArray(parsed)) return renderJsonBlock("Raw JSON", parsed);

  const items = parsed
    .filter((x) => x && typeof x === "object")
    .map((it) => {
      const year = it.year ?? it.from ?? "";
      const title = it.title ? String(it.title) : "";
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

  return `${items || `<div class="meta">（空）</div>`}${renderJsonBlock("Raw JSON", parsed)}`;
}

async function fetchJson(path) {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

let heatmapInstance = null;
let lastVisitedPlaces = [];

async function loadConfigAndRender() {
  const techRoot = $("about-tech");
  const timelineRoot = $("about-timeline");

  const cfg = await fetchJson("/api/about-config");
  const config = cfg?.config ?? {};

  const techStackJson = typeof config.techStackJson === "string" ? config.techStackJson : "";
  const visitedPlacesJson = typeof config.visitedPlacesJson === "string" ? config.visitedPlacesJson : "";
  const timelineJson = typeof config.timelineJson === "string" ? config.timelineJson : "";

  if (techRoot) techRoot.innerHTML = renderTechStack(techStackJson);
  if (timelineRoot) timelineRoot.innerHTML = renderTimeline(timelineJson);

  const visitedParsed = safeParseJson(visitedPlacesJson);
  const visitedPlaces =
    Array.isArray(visitedParsed) ? visitedParsed.filter((x) => typeof x === "string") : [];
  lastVisitedPlaces = visitedPlaces;
}

async function refreshWeather() {
  const root = $("about-weather");
  if (!root) return;
  root.innerHTML = `<div class="meta">加载中...</div>`;
  try {
    const data = await fetchJson("/api/weather-now");
    const loc = data?.location ?? {};
    const weather = data?.weather ?? {};

    root.innerHTML = `
${renderKvTable(loc, ["ip", "country", "region", "city", "latitude", "longitude", "timezone", "source"])}
${renderJsonBlock("Raw IP Location", data?.raw?.ipLocation ?? null)}
${renderJsonBlock("Weather (uapis)", weather?.uapis ?? null)}
${renderJsonBlock("Weather (open-meteo)", weather?.openMeteo ?? null)}
`.trim();
  } catch (e) {
    root.innerHTML = `<div class="meta">请求失败：${escapeHtml(e?.message || String(e))}</div>`;
  }
}

async function refreshHistory() {
  const root = $("about-history");
  if (!root) return;
  root.innerHTML = `<div class="meta">加载中...</div>`;
  try {
    const data = await fetchJson("/api/programmer-history");
    const events = Array.isArray(data?.events) ? data.events : [];
    const list = events
      .slice(0, 10)
      .map((ev) => {
        const year = ev?.year ?? "";
        const title = ev?.title ? String(ev.title) : "";
        const desc = ev?.description ? String(ev.description) : "";
        return `
<div style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.08)">
  <div class="meta">${escapeHtml(String(year))}</div>
  <div style="font-weight: 800; margin-top: 4px">${escapeHtml(title)}</div>
  ${desc ? `<div class="meta" style="margin-top: 6px; white-space: pre-wrap">${escapeHtml(desc)}</div>` : ""}
</div>
`.trim();
      })
      .join("");

    root.innerHTML = `
<div class="meta">${escapeHtml(String(data?.date ?? ""))} ${escapeHtml(String(data?.message ?? ""))}</div>
${list || `<div class="meta" style="margin-top: 8px">（暂无事件）</div>`}
${renderJsonBlock("Raw JSON", data?.raw ?? null)}
`.trim();
  } catch (e) {
    root.innerHTML = `<div class="meta">请求失败：${escapeHtml(e?.message || String(e))}</div>`;
  }
}

function refreshNewsImage() {
  const img = $("about-news-image");
  if (!img) return;
  img.src = `/api/news-image?__t=${Date.now()}`;
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
  const btnWeather = $("aboutWeatherRefresh");
  if (btnWeather) btnWeather.addEventListener("click", () => void refreshWeather());
  const btnHistory = $("aboutHistoryRefresh");
  if (btnHistory) btnHistory.addEventListener("click", () => void refreshHistory());
  const btnHeatmap = $("aboutHeatmapReload");
  if (btnHeatmap) btnHeatmap.addEventListener("click", () => void mountHeatmap());

  refreshNewsImage();
  await loadConfigAndRender().catch(() => null);
  await Promise.all([refreshWeather(), refreshHistory()]);
  await mountHeatmap();
}

void main();
