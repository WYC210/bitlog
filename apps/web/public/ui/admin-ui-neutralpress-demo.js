const state = {
  page: "dashboard",
  theme: document.documentElement.dataset.demoTheme || "current",
  colorMode: document.documentElement.dataset.colorMode || "dark",
};

const themeLabels = {
  current: "Current",
  classic: "Classic",
  glass: "Glass",
};

const colorModeLabels = {
  light: "Light",
  dark: "Dark",
};

const root = document.documentElement;
root.dataset.demoTheme = state.theme;
root.dataset.colorMode = state.colorMode;
root.dataset.density = "compact";

const pageMeta = {
  dashboard: { title: "Dashboard", eyebrow: "Step 1 / Admin architecture demo" },
  posts: { title: "Posts", eyebrow: "Step 2 / Reports, trends, and workspace" },
  analytics: { title: "Analytics", eyebrow: "Step 3 / Overview, paths, and dimensions" },
  tags: { title: "Tags", eyebrow: "Step 4 / Taxonomy workspace" },
  settings: { title: "Settings", eyebrow: "Site / Settings overview" },
  account: { title: "Account", eyebrow: "Security / Preferences" },
};

const posts = [
  { id: 35, title: "Minecraft Meteor Usage Guide", category: "Games / Minecraft", tags: 2, status: "Published", views: 1948, publishedAt: "2025/08/12 01:51", updatedAt: "2026/02/14 01:37" },
  { id: 34, title: "Using Meilisearch for Site Search", category: "Development / Backend", tags: 2, status: "Published", views: 206, publishedAt: "2025/06/25 22:05", updatedAt: "2026/02/13 01:23" },
  { id: 33, title: "Timepulse: Modern Timer Panel", category: "Development / Frontend", tags: 4, status: "Published", views: 182, publishedAt: "2025/04/03 21:05", updatedAt: "2026/02/13 10:45" },
  { id: 32, title: "Next.js Server Action Dynamic Pages", category: "Development / Backend", tags: 3, status: "Published", views: 48, publishedAt: "2025/04/03 21:02", updatedAt: "2026/02/13 01:25" },
  { id: 31, title: "Self Network Audit with Wireshark", category: "Network Security", tags: 3, status: "Draft", views: 88, publishedAt: "2025/02/25 21:25", updatedAt: "2026/02/13 17:14" },
  { id: 30, title: "React Floating Hint Implementation", category: "Development / Frontend", tags: 1, status: "Published", views: 50, publishedAt: "2025/02/11 16:17", updatedAt: "2026/02/13 17:38" },
];

const pathStats = [
  ["/", 150, "22.5%"],
  ["/admin/dashboard", 45, "6.8%"],
  ["/admin", 45, "6.8%"],
  ["/messages", 43, "6.5%"],
  ["/admin/media", 31, "4.7%"],
  ["/login", 26, "3.9%"],
  ["/settings", 24, "3.6%"],
];

const tagStats = [
  { name: "JavaScript", count: 11, ratio: 13.9, color: "#37d0c5" },
  { name: "React", count: 7, ratio: 8.9, color: "#56d9ac" },
  { name: "Next.js", count: 6, ratio: 7.6, color: "#82dd82" },
  { name: "Node.js", count: 6, ratio: 7.6, color: "#a7da54" },
  { name: "Minecraft", count: 5, ratio: 6.3, color: "#d8c83f" },
  { name: "CSS", count: 4, ratio: 5.1, color: "#ef9946" },
  { name: "Bitlog", count: 3, ratio: 3.8, color: "#ef6a55" },
];

const tagRecords = [
  { slug: "javascript", name: "JavaScript", description: "-", posts: 11, createdAt: "2026/02/13 01:26" },
  { slug: "nextjs", name: "Next.js", description: "-", posts: 6, createdAt: "2026/02/13 06:14" },
  { slug: "nodejs", name: "node.js", description: "-", posts: 6, createdAt: "2026/02/13 01:58" },
  { slug: "minecraft", name: "Minecraft", description: "-", posts: 5, createdAt: "2026/02/13 06:08" },
  { slug: "paper", name: "Paper", description: "-", posts: 2, createdAt: "2026/02/13 01:14" },
  { slug: "pjax", name: "PJAX", description: "-", posts: 2, createdAt: "2026/02/13 01:19" },
  { slug: "bing", name: "Bing", description: "-", posts: 1, createdAt: "2026/02/13 01:23" },
  { slug: "c-yu-yan", name: "C语言", description: "-", posts: 1, createdAt: "2026/02/13 18:32" },
  { slug: "css", name: "css", description: "-", posts: 1, createdAt: "2026/02/13 19:08" },
  { slug: "dao-ji-shi", name: "倒计时", description: "-", posts: 1, createdAt: "2026/02/13 06:11" },
  { slug: "dns", name: "DNS", description: "-", posts: 1, createdAt: "2026/02/13 06:41" },
  { slug: "hikvision", name: "Hikvision", description: "-", posts: 1, createdAt: "2026/02/13 18:51" },
  { slug: "hooks", name: "Hooks", description: "-", posts: 1, createdAt: "2026/02/13 01:41" },
];

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const view = document.getElementById("demoView");
const titleEl = document.getElementById("demoTitle");
const eyebrowEl = document.getElementById("demoEyebrow");
const toastEl = document.getElementById("demoToast");
const modalEl = document.getElementById("demoModal");
const modalTitleEl = document.getElementById("demoModalTitle");
const modalEyebrowEl = document.getElementById("demoModalEyebrow");
const modalBodyEl = document.getElementById("demoModalBody");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildLinePath(points, width, height, padding) {
  const max = Math.max(...points, 1);
  const stepX = (width - padding * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (point / max) * (height - padding * 2);
    return [x, y];
  });
  const line = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord[0]},${coord[1]}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0]},${height - padding} L${coords[0][0]},${height - padding} Z`;
  return { line, area };
}

function renderSparkline(primary, secondary) {
  const width = 720;
  const height = 240;
  const padding = 18;
  const first = buildLinePath(primary, width, height, padding);
  const second = buildLinePath(secondary, width, height, padding);
  return `
    <div class="demo-line-chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <path class="demo-line-fill" d="${first.area}"></path>
        <path class="demo-line-stroke" d="${first.line}"></path>
        <path class="demo-line-stroke is-secondary" d="${second.line}"></path>
      </svg>
    </div>
  `;
}

function renderHeatmap(levels) {
  return `<div class="demo-heatmap-grid">${levels.map((level) => `<div class="demo-heat" data-level="${level}"></div>`).join("")}</div>`;
}

function renderPostsHeatmap() {
  const levels = [
    0, 0, 1, 0, 0, 2, 3, 0, 1, 0, 0, 0, 4, 2, 0, 1,
    0, 0, 0, 0, 2, 0, 1, 4, 0, 3, 0, 0, 1, 2, 0, 0,
    0, 4, 0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 3, 0, 0, 2,
  ];
  return `
    <div class="demo-month-heatmap">
      <div class="demo-month-heatmap-grid">
        ${levels.map((level) => `<div class="demo-heat demo-month-heat" data-level="${level}"></div>`).join("")}
      </div>
      <div class="demo-month-labels">
        ${monthLabels.map((label) => `<span>${label}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderDashboard() {
  const stats = [
    ["Health checks", "06", "5 items passing, 1 item needs manual review", "Redis 29ms / D1 slow query: 1"],
    ["Content assets", "35", "30 published posts and 5 drafts", "15 new posts in the last 30 days"],
    ["Traffic summary", "666", "127 unique visitors, avg stay 21:11", "Bounce rate 81.9%"],
    ["Tag pool", "36", "28 active tags and 3 isolated entries", "7 new tags in the last week"],
  ];
  const heatLevels = [0, 0, 1, 0, 0, 2, 3, 0, 1, 0, 0, 0, 4, 2, 0, 1, 0, 0, 0, 0, 2, 0, 1, 4, 0, 3, 0, 0, 1, 2, 0, 0, 0, 4, 0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 3, 0, 0, 2];

  return `
    <section class="demo-page">
      <div class="demo-grid demo-grid-stats">
        ${stats.map(([label, value, body, foot]) => `
          <article class="demo-panel demo-stat-card">
            <div><p class="demo-eyebrow">${label}</p><strong>${value}</strong></div>
            <p class="demo-note">${body}</p>
            <div class="demo-stat-card-foot"><span>${foot}</span><span class="demo-signal">Live</span></div>
          </article>
        `).join("")}
      </div>

      <div class="demo-grid demo-grid-dashboard">
        <section class="demo-panel">
          <div class="demo-panel-head">
            <div><p class="demo-eyebrow">Bitlog dashboard</p><h3>Admin control workspace</h3></div>
            <span class="demo-chip">Bitlog admin</span>
          </div>
          <div class="demo-summary-row" style="margin-top:18px;">
            <div class="demo-summary-metric"><span>Posts queue</span><strong>35</strong><p>Published, drafts, and scheduled content in one stream.</p></div>
            <div class="demo-summary-metric"><span>Media items</span><strong>179</strong><p>Reserved for upload flow, storage strategy, and recycle bin.</p></div>
            <div class="demo-summary-metric"><span>Pending comments</span><strong>12</strong><p>Keep moderation, abuse hits, and hidden entries visible.</p></div>
          </div>
          <div class="demo-action-grid" style="margin-top:18px;">
            <button class="demo-action" type="button" data-action="open-card" data-card="New post"><strong>New post</strong><span>Jump into the main editor flow and replace this panel later with the React page.</span></button>
            <button class="demo-action" type="button" data-action="open-card" data-card="Upload media"><strong>Upload media</strong><span>Connect asset storage, cover cropping, and file strategy next.</span></button>
            <button class="demo-action" type="button" data-action="open-card" data-card="Traffic analysis"><strong>Traffic analysis</strong><span>Split into source, path, and device layers after the layout settles.</span></button>
          </div>
          <div class="demo-architecture-list">
            <div class="demo-architecture-item"><strong>Why this admin feels structured</strong><span>The point is not React itself. The point is that information hierarchy, table density, and action paths were designed together.</span></div>
            <div class="demo-architecture-item"><strong>How to use this demo</strong><span>Lock the layout first, then split these static panels into React components and connect them to real APIs.</span></div>
          </div>
        </section>

        <section class="demo-panel">
          <div class="demo-panel-head">
            <div><p class="demo-eyebrow">Content rhythm</p><h3>Yearly publishing heatmap</h3></div>
            <small>Use a calmer statistical language before connecting real post dates.</small>
          </div>
          <div class="demo-heatmap" style="margin-top:18px;">
            <div class="demo-summary-row">
              <div class="demo-summary-metric"><span>2024</span><strong>9</strong><p>Publishing clusters around July through December.</p></div>
              <div class="demo-summary-metric"><span>Reading</span><strong>Mid-season push</strong><p>Good fit for future quarterly reports and weekly content overviews.</p></div>
            </div>
            ${renderHeatmap(heatLevels)}
          </div>
        </section>

        <div class="demo-dashboard-stack">
          <section class="demo-panel">
            <div class="demo-panel-head">
              <div><p class="demo-eyebrow">Quick actions</p><h3>Keyboard-first shortcuts</h3></div>
              <span class="demo-chip">Shortcuts</span>
            </div>
            <div class="demo-dashboard-actions" style="margin-top:18px;">
              ${[
                ["Open posts workspace", "Jump straight into the dense list workbench.", "G P"],
                ["Open tag manager", "Review isolated tags and duplicate definitions.", "G T"],
                ["Open analytics", "Switch to source and path analysis.", "G A"],
                ["Open command panel", "Keep one fast entry point for future commands.", "CMD"],
              ].map(([title, desc, key]) => `
                <button class="demo-dashboard-action-row" type="button" data-action="${title === "Open command panel" ? "open-command" : "notify"}" data-message="${title} entry is reserved for the real page flow.">
                  <span><strong>${title}</strong><span>${desc}</span></span>
                  <span class="demo-dashboard-action-kbd">${key}</span>
                </button>
              `).join("")}
            </div>
          </section>
        </div>
      </div>
    </section>
  `;
}

function renderPosts() {
  return `
    <section class="demo-page">
      <div class="demo-grid demo-grid-three">
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Posts report</p><h3>Library status</h3></div><button class="demo-chip" type="button" data-action="notify" data-message="Hook refresh to the real posts API later.">Refresh</button></div>
          <div class="demo-table-meta" style="margin-top:18px;">
            <div class="demo-table-meta-row"><span>Total posts</span><strong>35</strong></div>
            <div class="demo-table-meta-row"><span>Published</span><strong>30</strong></div>
            <div class="demo-table-meta-row"><span>Drafts</span><strong>5</strong></div>
            <div class="demo-table-meta-row"><span>Latest publish</span><strong>2025/08/12</strong></div>
          </div>
        </section>
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Growth trend</p><h3>Last 12 months</h3></div></div>
          <p class="demo-note" style="margin-top:18px;">The heatmap reads publishing rhythm more clearly than a dense bar chart in this admin context.</p>
          ${renderPostsHeatmap()}
        </section>
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Batch actions</p><h3>Workbench capabilities</h3></div></div>
          <div class="demo-architecture-list">
            <div class="demo-architecture-item"><strong>Bulk action bar</strong><span>Publish, archive, comment settings, and delete states belong here.</span></div>
            <div class="demo-architecture-item"><strong>Advanced filters</strong><span>Status, author, date, tags, and category belong in a secondary layer.</span></div>
            <div class="demo-architecture-item"><strong>Quick edit drawer</strong><span>Edit title, slug, and tags without leaving the list.</span></div>
          </div>
        </section>
      </div>

      <section class="demo-panel demo-table-shell">
        <div class="demo-workbench-head">
          <div>
            <p class="demo-eyebrow">Posts workspace</p>
            <h3>Dense editorial workbench</h3>
            <p class="demo-note">Lock table density, batch actions, filters, and pagination first. Replace the mock data after the interface settles.</p>
          </div>
          <div class="demo-table-actions">
            <button class="demo-btn demo-btn-primary" type="button" data-action="open-card" data-card="New post">New post</button>
            <button class="demo-btn" type="button" data-action="notify" data-message="Advanced filter drawer is reserved here.">Filter</button>
            <button class="demo-btn" type="button" data-action="notify" data-message="Batch action status bar is reserved here.">Bulk actions</button>
          </div>
        </div>
        <div class="demo-workbench-stats">
          <span class="demo-workbench-stat">Current page <strong>6</strong> items</span>
          <span class="demo-workbench-stat">Published <strong>4</strong> posts</span>
          <span class="demo-workbench-stat">Draft <strong>1</strong> post</span>
          <span class="demo-workbench-stat">High traffic <strong>1</strong> post</span>
        </div>
        <div class="demo-inline-tools" style="margin-bottom:16px;">
          <input class="demo-input" value="Search title, slug, or summary..." readonly />
          <span class="demo-filter">Status / All</span>
          <span class="demo-filter">Per page / 25</span>
          <span class="demo-filter">Sort / Updated</span>
          <span class="demo-filter">Author / Yan Bin</span>
        </div>
        <div class="demo-inline-tools" style="margin-bottom:16px;">
          <button class="demo-btn" type="button" data-action="notify" data-message="Bulk publish hook is reserved here.">Bulk publish</button>
          <button class="demo-btn" type="button" data-action="notify" data-message="Bulk archive hook is reserved here.">Bulk archive</button>
          <button class="demo-btn" type="button" data-action="notify" data-message="Bulk delete confirmation is reserved here.">Bulk delete</button>
          <span class="demo-filter">Selected / 2</span>
        </div>
        <div class="demo-table-wrap">
          <table class="demo-table">
            <thead>
              <tr>
                <th class="is-center">Pick</th>
                <th class="is-number">ID</th>
                <th>Title</th>
                <th>Category</th>
                <th class="is-center">Tags</th>
                <th class="is-center">Status</th>
                <th class="is-number">Views</th>
                <th>Published</th>
                <th>Updated</th>
                <th class="is-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${posts.map((post, index) => `
                <tr>
                  <td class="is-center">${index < 2 ? "■" : "□"}</td>
                  <td class="is-number">${post.id}</td>
                  <td><strong>${escapeHtml(post.title)}</strong><small>/posts/${post.id} · SEO score ${92 - index * 4}</small></td>
                  <td>${escapeHtml(post.category)}</td>
                  <td class="is-center"><span class="demo-badge">${post.tags}</span></td>
                  <td class="is-center"><span class="demo-badge ${post.status === "Published" ? "is-success" : "is-warning"}">${post.status}</span></td>
                  <td class="is-number">${post.views.toLocaleString("en-US")}</td>
                  <td>${post.publishedAt}</td>
                  <td>${post.updatedAt}</td>
                  <td class="is-center"><div class="demo-table-actions">
                    <button class="demo-table-action" type="button" data-action="row-preview" data-title="${escapeHtml(post.title)}">View</button>
                    <button class="demo-table-action" type="button" data-action="notify" data-message="Quick edit drawer is reserved here.">Edit</button>
                    <button class="demo-table-action" type="button" data-action="notify" data-message="Post analytics bridge is reserved here.">Data</button>
                    <button class="demo-table-action" type="button" data-action="notify" data-message="Delete confirmation is reserved here.">Del</button>
                  </div></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="demo-table-footer">
          <span>Showing 1 - 6 of 35 posts in this static demo page.</span>
          <div class="demo-pagination">
            <button class="demo-page-btn" type="button">‹</button>
            <button class="demo-page-btn is-active" type="button">1</button>
            <button class="demo-page-btn" type="button">2</button>
            <button class="demo-page-btn" type="button">3</button>
            <button class="demo-page-btn" type="button">›</button>
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderAnalytics() {
  const primary = [28, 32, 38, 42, 54, 61, 58, 69, 76, 82, 77, 86];
  const secondary = [18, 21, 23, 28, 34, 39, 37, 46, 52, 57, 55, 62];

  return `
    <section class="demo-page">
      <div class="demo-grid demo-grid-stats">
        ${[
          ["Total visits", "666", "Last 24 hours"],
          ["Unique visitors", "127", "Deduplicated readers"],
          ["Avg. duration", "21:11", "Session length"],
          ["Bounce rate", "81.9%", "Single-page exits"],
        ].map(([label, value, foot]) => `
          <article class="demo-panel demo-stat-card">
            <div><p class="demo-eyebrow">${label}</p><strong>${value}</strong></div>
            <div class="demo-stat-card-foot"><span>${foot}</span><span class="demo-signal">Live</span></div>
          </article>
        `).join("")}
      </div>
      <div class="demo-grid demo-grid-wide">
        <section class="demo-panel">
          <div class="demo-panel-head">
            <div><p class="demo-eyebrow">Traffic trend</p><h3>Visits and visitors</h3></div>
            <span class="demo-chip">Last 12 slots</span>
          </div>
          ${renderSparkline(primary, secondary)}
          <div class="demo-legend">
            <span>Visits</span>
            <span class="is-secondary">Visitors</span>
          </div>
        </section>
        <section class="demo-panel">
          <div class="demo-panel-head">
            <div><p class="demo-eyebrow">Top paths</p><h3>Entry distribution</h3></div>
          </div>
          <div class="demo-path-list" style="margin-top:18px;">
            ${pathStats.map(([path, count, ratio]) => `
              <div class="demo-path-item">
                <div class="demo-path-row"><strong>${path}</strong><span>${count} · ${ratio}</span></div>
                <div class="demo-path-track"><div class="demo-path-fill" style="width:${ratio};"></div></div>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderTags() {
  return `
    <section class="demo-page">
      <div class="demo-tags-layout demo-tags-layout-reference">
        <div class="demo-tags-left-column">
          <section class="demo-panel demo-tags-panel demo-tags-report-panel">
            <div class="demo-panel-head">
              <div><p class="demo-eyebrow">标签统计</p><h3>标签统计</h3></div>
            </div>
            <div class="demo-tags-report-copy">
              <p>当前共有 36 个标签，其中 36 个被使用。</p>
              <p>最近一周新增了 36 个。</p>
              <p>最近更新于: 2026/02/14 15:38:33 (缓存) <span class="demo-tags-refresh">⟳</span></p>
            </div>
          </section>

          <button class="demo-panel demo-tags-panel demo-tags-create-panel" type="button" data-action="open-card" data-card="新建标签">
            <span>＋ 新建标签</span>
          </button>

          <section class="demo-panel demo-tags-panel demo-tags-distribution-panel">
            <div class="demo-panel-head">
              <div><p class="demo-eyebrow">标签使用分布</p><h3>标签使用分布</h3></div>
            </div>
            <div class="demo-tags-distribution">
              <div class="demo-table-meta">
                ${tagStats.map((tag) => `
                  <div class="demo-table-meta-row">
                    <span class="demo-tags-legend-label"><i style="background:${tag.color}"></i>${tag.name}</span>
                    <strong>${tag.count}</strong>
                    <span>${tag.ratio}%</span>
                  </div>
                `).join("")}
              </div>
              <div class="demo-tags-donut">
                <div class="demo-donut" style="background:conic-gradient(${tagStats.map((tag, index) => `${tag.color} ${index * 12}% ${(index + 1) * 12}%`).join(", ")})">
                  <div class="demo-donut-center"><div><strong>36</strong><p class="demo-note">标签</p></div></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="demo-panel demo-tags-panel demo-tags-table-panel">
          <div class="demo-panel-head demo-tags-table-title">
            <div><p class="demo-eyebrow">标签列表</p><h3>标签列表</h3></div>
          </div>
          <div class="demo-table-wrap demo-table-wrap-tags">
            <table class="demo-table demo-table-tags demo-table-tags-reference">
              <thead>
                <tr>
                  <th class="is-center">□</th>
                  <th>Slug</th>
                  <th>标签名称</th>
                  <th>描述</th>
                  <th class="is-number">文章数</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                ${tagRecords.map((tag, index) => `
                  <tr>
                    <td class="is-center">${index < 2 ? "□" : "□"}</td>
                    <td><span class="demo-tags-slug">${escapeHtml(tag.slug)}</span></td>
                    <td><strong>${escapeHtml(tag.name)}</strong></td>
                    <td>${escapeHtml(tag.description)}</td>
                    <td class="is-number"><span class="demo-tags-posts">${tag.posts}</span></td>
                    <td>${tag.createdAt}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div class="demo-tags-table-footer">
            <span>共 36 条 / 第 1 - 25 条 /</span>
            <button class="demo-tags-page-size" type="button">25 条/页 <span>⌄</span></button>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="demo-page">
      <div class="demo-grid demo-grid-two">
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Site settings</p><h3>Global controls</h3></div></div>
          <div class="demo-architecture-list">
            <div class="demo-architecture-item"><strong>General</strong><span>Title, description, routes, and public profile metadata belong here.</span></div>
            <div class="demo-architecture-item"><strong>Content policy</strong><span>Comment defaults, visibility rules, and publishing behavior should be grouped here.</span></div>
            <div class="demo-architecture-item"><strong>Theme bridge</strong><span>Connect the admin visual system to the public site theme only after structure is stable.</span></div>
          </div>
        </section>
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Operational notes</p><h3>Rollout checklist</h3></div></div>
          <div class="demo-inline-tools" style="margin-top:18px;">
            <span class="demo-filter">Route access</span>
            <span class="demo-filter">Audit trail</span>
            <span class="demo-filter">Backup schedule</span>
          </div>
          <p class="demo-note" style="margin-top:18px;">This block can later host environment flags, sync status, and deployment safeguards.</p>
        </section>
      </div>
    </section>
  `;
}

function renderAccount() {
  return `
    <section class="demo-page">
      <div class="demo-grid demo-grid-two">
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Profile</p><h3>Owner account</h3></div></div>
          <div class="demo-summary-row" style="margin-top:18px;">
            <div class="demo-summary-metric"><span>Name</span><strong>Yan Bin</strong><p>Primary site owner and content operator.</p></div>
            <div class="demo-summary-metric"><span>Role</span><strong>Admin</strong><p>Full access to editorial, taxonomy, analytics, and site settings.</p></div>
          </div>
          <div class="demo-inline-tools" style="margin-top:18px;">
            <button class="demo-btn demo-btn-primary" type="button" data-action="notify" data-message="Password update flow is reserved here.">Update password</button>
          </div>
        </section>
        <section class="demo-panel">
          <div class="demo-panel-head"><div><p class="demo-eyebrow">Preferences</p><h3>Workspace behavior</h3></div></div>
          <div class="demo-architecture-list">
            <div class="demo-architecture-item"><strong>Editor layout</strong><span>Single column, preview split, and dual-pane options should persist across devices.</span></div>
            <div class="demo-architecture-item"><strong>Shortcut scopes</strong><span>Keep shortcut scopes clear: global, admin, and public-site only.</span></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderPage() {
  const meta = pageMeta[state.page];
  titleEl.textContent = meta.title;
  eyebrowEl.textContent = meta.eyebrow;
  if (state.page === "dashboard") view.innerHTML = renderDashboard();
  if (state.page === "posts") view.innerHTML = renderPosts();
  if (state.page === "analytics") view.innerHTML = renderAnalytics();
  if (state.page === "tags") view.innerHTML = renderTags();
  if (state.page === "settings") view.innerHTML = renderSettings();
  if (state.page === "account") view.innerHTML = renderAccount();
  document.querySelectorAll(".demo-nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.page === state.page));
  document.querySelectorAll("[data-theme]").forEach((button) => button.classList.toggle("is-active", button.dataset.theme === state.theme));
  document.querySelectorAll("[data-color-mode-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.colorModeTarget === state.colorMode));
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function openModal(title, eyebrow, body) {
  modalTitleEl.textContent = title;
  modalEyebrowEl.textContent = eyebrow;
  modalBodyEl.innerHTML = body;
  modalEl.hidden = false;
}

function closeModal() {
  modalEl.hidden = true;
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-page], [data-theme], [data-color-mode-target], [data-action]");
  if (!target) return;

  if (target.dataset.page) {
    state.page = target.dataset.page;
    renderPage();
    return;
  }

  if (target.dataset.theme) {
    state.theme = target.dataset.theme;
    root.dataset.demoTheme = state.theme;
    renderPage();
    showToast(`Switched to ${themeLabels[state.theme] || state.theme} theme`);
    return;
  }

  if (target.dataset.colorModeTarget) {
    state.colorMode = target.dataset.colorModeTarget;
    root.dataset.colorMode = state.colorMode;
    renderPage();
    showToast(`Switched to ${colorModeLabels[state.colorMode] || state.colorMode} mode`);
    return;
  }

  const action = target.dataset.action;
  if (action === "close-modal") {
    closeModal();
    return;
  }

  if (action === "open-command") {
    openModal("Command panel", "Command palette", `
      <div class="demo-architecture-list">
        <div class="demo-architecture-item"><strong>Go to dashboard</strong><span>g d</span></div>
        <div class="demo-architecture-item"><strong>Create new post</strong><span>c n</span></div>
        <div class="demo-architecture-item"><strong>Open tag manager</strong><span>g t</span></div>
        <div class="demo-architecture-item"><strong>Toggle color mode</strong><span>shift + d</span></div>
      </div>
    `);
    return;
  }

  if (action === "open-card") {
    const card = target.dataset.card || "Feature card";
    openModal(card, "Architecture note", `<p>This block is a placeholder panel for now. Replace it with a dedicated React route or feature module after the layout is finalized.</p>`);
    return;
  }

  if (action === "row-preview") {
    const title = target.dataset.title || "Post preview";
    openModal(title, "Posts workspace", `<p>This can become a quick-preview drawer: keep the table on the left and show summary, tags, status, and shortcut actions on the right.</p>`);
    return;
  }

  if (action === "notify") {
    showToast(target.dataset.message || "Demo action");
  }
});

renderPage();
