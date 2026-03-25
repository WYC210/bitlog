function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeParseJson(text) {
  const input = String(text ?? "").trim();
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function initialsFromText(text) {
  const clean = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!clean.length) return "BL";
  if (clean.length === 1) return clean[0].slice(0, 2).toUpperCase();
  return `${clean[0][0] ?? ""}${clean[1][0] ?? ""}`.toUpperCase();
}

function normalizeSkillEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return {
      title: entry,
      description: "",
      tags: [entry],
      level: "",
      url: ""
    };
  }
  if (typeof entry !== "object") return null;

  const title = String(entry.title ?? entry.TITLE ?? entry.name ?? "技能模块").trim();
  const description = String(entry.description ?? entry.DESCRIPTION ?? entry.desc ?? "").trim();
  const tagsRaw = Array.isArray(entry.tags)
    ? entry.tags
    : Array.isArray(entry.TAGS)
      ? entry.TAGS
      : Array.isArray(entry.items)
        ? entry.items
        : Array.isArray(entry.ITEMS)
          ? entry.ITEMS
          : Array.isArray(entry.stack)
            ? entry.stack
            : [];

  const tags = tagsRaw
    .filter((item) => typeof item === "string")
    .map((item) => String(item).trim())
    .filter(Boolean);
  const level = String(entry.level ?? entry.LEVEL ?? "").trim();
  const url = String(entry.url ?? entry.URL ?? "").trim();

  return {
    title: title || "技能模块",
    description,
    tags,
    level,
    url
  };
}

function normalizeExperienceEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const from = String(entry.from ?? entry.FROM ?? "").trim();
  const to = String(entry.to ?? entry.TO ?? "").trim();
  const present = entry.present === true || entry.PRESENT === true;
  const date = String(
    entry.date ??
      entry.DATE ??
      entry.period ??
      entry.PERIOD ??
      (from && present ? `${from} ~ Present` : from && to ? `${from} ~ ${to}` : from || entry.year || entry.YEAR || "")
  ).trim();
  const title = String(entry.title ?? entry.TITLE ?? "").trim();
  const company = String(entry.company ?? entry.COMPANY ?? entry.org ?? entry.ORG ?? "").trim();
  const description = String(entry.description ?? entry.DESCRIPTION ?? entry.desc ?? "").trim();

  if (!date && !title && !company && !description) return null;
  return { date, title, company, description };
}

function parseSkills(jsonText) {
  const parsed = safeParseJson(jsonText);
  const list = Array.isArray(parsed) ? parsed : [];
  return list.map(normalizeSkillEntry).filter(Boolean);
}

function parseExperience(jsonText) {
  const parsed = safeParseJson(jsonText);
  const list = Array.isArray(parsed) ? parsed : [];
  return list.map(normalizeExperienceEntry).filter(Boolean);
}

function parsePlaces(jsonText) {
  const parsed = safeParseJson(jsonText);
  return Array.isArray(parsed)
    ? parsed
        .filter((item) => typeof item === "string")
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
}

function formatVisitedPlaceLabel(place) {
  const raw = String(place ?? "").trim();
  if (!raw) return "";
  const index = raw.indexOf("-");
  if (index === -1) return raw;
  const left = raw.slice(0, index).trim();
  const right = raw.slice(index + 1).trim();
  return left && right ? `${right} / ${left}` : raw;
}

function collectTopTopics(skills) {
  const counts = new Map();
  skills.forEach((skill) => {
    skill.tags.forEach((tag) => {
      const key = String(tag).trim();
      if (!key) return;
      const prev = counts.get(key) || { label: key, count: 0 };
      prev.count += 1;
      counts.set(key, prev);
    });
  });

  const actual = Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);

  if (actual.length >= 4) return actual;

  return [
    { label: "JavaScript", count: 11 },
    { label: "React", count: 7 },
    { label: "Next.js", count: 7 },
    { label: "node.js", count: 6 },
    { label: "Minecraft", count: 5 },
    { label: "Python", count: 4 }
  ];
}

function createDefaultAboutPageContent(brandText) {
  const name = String(brandText ?? "").trim() || "Bitlog";
  return {
    hero: {
      kicker: "About / Opening",
      title: "把内容、产品、工程和表达，收束成一页更像作品集的关于我。",
      lead: "桌面端保留横向展开的阅读节奏，移动端则回退到稳定的纵向浏览。",
      description: "这页不再只是罗列信息，而是按技能、经历和足迹分段展开，让访客先感受到你在做什么，再继续进入文章和项目。"
    },
    profile: {
      name,
      role: "Product-minded engineer / Builder / Blog author",
      summary: "长期围绕内容系统、界面体验、后台配置和持续迭代做产品化实践。",
      avatarUrl: ""
    },
    skills: {
      kicker: "Skill Matrix",
      title: "技能专长",
      lead: "把能力结构拆成比例、重点模块和主题标签，读起来更像一张能力地图。"
    },
    career: {
      kicker: "Career Journey",
      title: "工作经历",
      lead: "每段经历只保留最关键的阶段变化和角色重点，不再堆成长段履历。"
    },
    travel: {
      kicker: "Travel Footprint",
      title: "旅行足迹",
      lead: "保留地图互动，把到过的地方单独做成一屏，视觉上更轻，信息上也更聚焦。"
    },
    next: {
      kicker: "Continue",
      title: "继续往下逛",
      quote: "文章、项目和热点不该停在页面末尾，它们应该像同一条浏览路径那样自然接上。",
      lead: "看完 about 之后，应该能自然衔接到文章、项目和热点，而不是停在页面末尾。",
      signature: name,
      bands: ["SEE YOU NEXT TIME", "ARTICLES / PROJECTS", "BEST WISHES", `FROM ${name.toUpperCase()}`],
      links: [
        { label: "查看文章", href: "/articles", variant: "primary" },
        { label: "浏览项目", href: "/projects", variant: "ghost" },
        { label: "今日热点", href: "/hot", variant: "ghost" }
      ]
    }
  };
}

function normalizeAboutSectionConfig(input, fallback) {
  const source = input && typeof input === "object" ? input : {};
  return {
    kicker: String(source.kicker ?? fallback.kicker).trim() || fallback.kicker,
    title: String(source.title ?? fallback.title).trim() || fallback.title,
    lead: String(source.lead ?? fallback.lead).trim() || fallback.lead
  };
}

function normalizeAboutPageLinks(input, fallback) {
  if (!Array.isArray(input)) return fallback;
  const links = input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const label = String(entry.label ?? "").trim();
      const href = String(entry.href ?? "").trim();
      if (!label || !href) return null;
      return {
        label,
        href,
        variant: String(entry.variant ?? "").trim().toLowerCase() === "ghost" ? "ghost" : "primary"
      };
    })
    .filter(Boolean);
  return links.length ? links.slice(0, 3) : fallback;
}

function normalizeAboutPageBands(input, fallback) {
  if (!Array.isArray(input)) return fallback;
  const bands = input
    .filter((item) => typeof item === "string")
    .map((item) => String(item).trim())
    .filter(Boolean);
  return bands.length ? bands.slice(0, 6) : fallback;
}

function normalizeAboutPageContent(raw, brandText) {
  const fallback = createDefaultAboutPageContent(brandText);
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return fallback;

  const heroSource = parsed.hero && typeof parsed.hero === "object" ? parsed.hero : {};
  const profileSource = parsed.profile && typeof parsed.profile === "object" ? parsed.profile : {};
  const nextSource = parsed.next && typeof parsed.next === "object" ? parsed.next : {};

  return {
    hero: {
      ...normalizeAboutSectionConfig(heroSource, fallback.hero),
      description: String(heroSource.description ?? fallback.hero.description).trim() || fallback.hero.description
    },
    profile: {
      name: String(profileSource.name ?? fallback.profile.name).trim() || fallback.profile.name,
      role: String(profileSource.role ?? fallback.profile.role).trim() || fallback.profile.role,
      summary: String(profileSource.summary ?? fallback.profile.summary).trim() || fallback.profile.summary,
      avatarUrl: String(profileSource.avatarUrl ?? fallback.profile.avatarUrl).trim()
    },
    skills: normalizeAboutSectionConfig(parsed.skills, fallback.skills),
    career: normalizeAboutSectionConfig(parsed.career, fallback.career),
    travel: normalizeAboutSectionConfig(parsed.travel, fallback.travel),
    next: {
      ...normalizeAboutSectionConfig(nextSource, fallback.next),
      quote: String(nextSource.quote ?? fallback.next.quote).trim() || fallback.next.quote,
      signature: String(nextSource.signature ?? fallback.next.signature).trim() || fallback.next.signature,
      bands: normalizeAboutPageBands(nextSource.bands, fallback.next.bands),
      links: normalizeAboutPageLinks(nextSource.links, fallback.next.links)
    }
  };
}

function buildCategoryItems(skills, experience, places) {
  return [
    { label: "开发", count: Math.max(skills.length, 1) + Math.max(experience.length - 1, 0) },
    { label: "内容", count: Math.max(Math.ceil(skills.length / 2), 1) },
    { label: "旅行", count: Math.max(Math.min(places.length, 8), 1) },
    { label: "产品", count: Math.max(Math.round(skills.length / 3), 1) },
    { label: "工具", count: Math.max(Math.min(skills.length, 4), 1) },
    { label: "研究", count: 1 }
  ].slice(0, 6);
}

function renderSkillCards(skills) {
  const defaults = [
    {
      title: "前端体验",
      description: "组件设计、动效节奏、排版细节和 Markdown 呈现一起决定页面质感。",
      tags: ["TypeScript", "Vite", "Animation", "Design System"]
    },
    {
      title: "服务与数据",
      description: "接口设计、缓存、权限和内容模型是我做站点时最常处理的一层。",
      tags: ["Hono", "D1", "SQL", "Validation"]
    },
    {
      title: "产品化闭环",
      description: "把后台配置、部署流程、内容编辑和前台体验串成真正可维护的系统。",
      tags: ["GitHub Actions", "Wrangler", "Observability", "CMS"]
    }
  ];

  const source = skills.length ? skills.slice(0, 3) : defaults;
  const accents = ["accent-cyan", "accent-orange", "accent-lime"];

  return source
    .map((skill, index) => {
      const tags = (skill.tags.length ? skill.tags : defaults[index]?.tags || []).slice(0, 4);
      return `
<article class="about-horizontal-skill-card ${accents[index % accents.length]}" data-reveal-item>
  <div class="about-horizontal-skill-icon">${String(index + 1).padStart(2, "0")}</div>
  <h3>${escapeHtml(skill.title)}</h3>
  <p>${escapeHtml(skill.description || defaults[index]?.description || "围绕内容、工程和表达搭建稳定的个人站点体验。")}</p>
  <div class="about-horizontal-skill-tags">
    ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
  </div>
</article>
`.trim();
    })
    .join("");
}

const SKILL_TONE_KEYS = ["cyan", "sky", "orange", "violet", "lime", "gold"];
const SKILL_ICON_GLYPHS = {
  frontend: "⚛",
  backend: "{ }",
  design: "✎",
  mobile: "▣",
  devops: "⌘",
  database: "D1",
  ai: "◎",
  writing: "M↓"
};
const SKILL_ICON_LABELS = {
  frontend: "Frontend System",
  backend: "Backend Service",
  design: "Design Direction",
  mobile: "Mobile Surface",
  devops: "Delivery Flow",
  database: "Data Layer",
  ai: "AI Workflow",
  writing: "Writing Pipeline"
};
const SKILL_LEVEL_LABELS = {
  beginner: "Beginner Focus",
  intermediate: "Intermediate Flow",
  advanced: "Advanced Practice",
  expert: "Expert Depth"
};
const SKILL_LABEL_GLYPHS = {
  openai: "◎",
  claude: "✦",
  gemini: "◌",
  rest: "{ }",
  api: "{ }",
  github: "⌘",
  cloudflare: "◔",
  workers: "W",
  worker: "W",
  ollama: "◐",
  perplexity: "●",
  deepseek: "△",
  qwen: "Q",
  react: "⚛",
  vue: "V",
  nextjs: "N",
  "next.js": "N",
  typescript: "TS",
  javascript: "JS",
  markdown: "M↓",
  rehype: "R",
  prisma: "P",
  d1: "D1",
  hono: "H",
  sql: "SQL",
  nodejs: "N",
  "node.js": "N",
  python: "Py",
  figma: "✎",
  css: "CSS"
};

function skillSlug(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w.-]+/g, "");
}

function detectSkillGlyph(label, icon) {
  const iconKey = String(icon ?? "").trim().toLowerCase();
  if (iconKey && SKILL_ICON_GLYPHS[iconKey]) return SKILL_ICON_GLYPHS[iconKey];
  const normalized = String(label ?? "").trim().toLowerCase();
  if (!normalized) return "•";
  if (SKILL_LABEL_GLYPHS[normalized]) return SKILL_LABEL_GLYPHS[normalized];
  const compact = normalized.replace(/\s+/g, "");
  if (SKILL_LABEL_GLYPHS[compact]) return SKILL_LABEL_GLYPHS[compact];
  const letters = String(label ?? "").trim().replace(/[^\p{L}\p{N}]+/gu, "");
  return letters ? letters.slice(0, Math.min(2, letters.length)).toUpperCase() : "•";
}

function createFallbackSkills() {
  return [
    {
      title: "AI Workflow",
      description: "围绕模型调用、接口整合和工作流设计建立稳定的 AI 生产链路。",
      tags: ["OpenAI", "Claude", "Gemini", "REST"],
      icon: "ai",
      level: "advanced"
    },
    {
      title: "Frontend System",
      description: "处理页面结构、交互反馈、组件节奏和内容呈现，让前台体验更完整。",
      tags: ["React", "TypeScript", "Markdown", "CSS"],
      icon: "frontend",
      level: "advanced"
    },
    {
      title: "Infra Delivery",
      description: "把部署、缓存、边缘执行和版本管理串成稳定的发布闭环。",
      tags: ["Cloudflare", "Workers", "D1", "GitHub"],
      icon: "devops",
      level: "advanced"
    }
  ];
}

function buildSkillShowcaseModel(skills) {
  const source = skills.length ? skills : createFallbackSkills();
  const rawEntries = [];
  const seenLabels = new Set();

  source.forEach((skill, skillIndex) => {
    const title = String(skill.title ?? "").trim() || `技能模块 ${skillIndex + 1}`;
    const tags = (Array.isArray(skill.tags) ? skill.tags : []).map((tag) => String(tag).trim()).filter(Boolean);
    const labels = (tags.length ? tags.slice(0, 5) : [title]).filter(Boolean);
    const cue =
      SKILL_LEVEL_LABELS[String(skill.level ?? "").trim().toLowerCase()] ||
      SKILL_ICON_LABELS[String(skill.icon ?? "").trim().toLowerCase()] ||
      "Configured Skill";
    const use = (tags.length ? tags.slice(0, 2) : [title]).join(" + ");
    const desc = String(skill.description ?? "").trim() || `围绕 ${title} 做长期迭代和交付。`;

    labels.forEach((label, labelIndex) => {
      const dedupeKey = String(label).trim().toLowerCase();
      if (!dedupeKey || seenLabels.has(dedupeKey)) return;
      seenLabels.add(dedupeKey);
      rawEntries.push({
        key: `skill-${skillIndex}-${skillSlug(label) || labelIndex}`,
        label,
        glyph: detectSkillGlyph(label, skill.icon),
        tone: SKILL_TONE_KEYS[(skillIndex + labelIndex) % SKILL_TONE_KEYS.length],
        name: label,
        desc,
        role: title,
        cue,
        use,
        tail: `${label} · ${title} · ${use}`
      });
    });

    if (!seenLabels.has(title.toLowerCase())) {
      seenLabels.add(title.toLowerCase());
      rawEntries.push({
        key: `skill-${skillIndex}-title`,
        label: title,
        glyph: detectSkillGlyph(title, skill.icon),
        tone: SKILL_TONE_KEYS[skillIndex % SKILL_TONE_KEYS.length],
        name: title,
        desc,
        role: title,
        cue,
        use,
        tail: `${title} · ${cue} · ${use}`
      });
    }
  });

  const baseEntries = rawEntries.length
    ? rawEntries
    : [
        {
          key: "skill-fallback-openai",
          label: "OpenAI",
          glyph: "◎",
          tone: "cyan",
          name: "OpenAI",
          desc: "围绕模型调用、接口整合和工作流设计建立稳定的 AI 生产链路。",
          role: "AI Workflow",
          cue: "Advanced Practice",
          use: "OpenAI + Claude",
          tail: "OpenAI · AI Workflow · OpenAI + Claude"
        }
      ];
  const entries = [];
  let cloneIndex = 0;
  while (entries.length < 15) {
    baseEntries.forEach((entry) => {
      if (entries.length >= 15) return;
      entries.push({
        ...entry,
        key: cloneIndex === 0 ? entry.key : `${entry.key}-clone-${cloneIndex}`
      });
    });
    cloneIndex += 1;
  }

  const lanes = { top: [], middle: [], bottom: [] };
  entries.forEach((entry, index) => {
    const lane = index % 3 === 0 ? "top" : index % 3 === 1 ? "middle" : "bottom";
    lanes[lane].push(entry);
  });

  const entryMap = new Map(entries.map((entry) => [entry.key, entry]));
  const initialEntry = lanes.middle[0] || entries[0];
  return { lanes, entryMap, initialEntry };
}

function renderSkillBrandWall() {
  return `
<div class="about-horizontal-brand-row about-horizontal-brand-row-top">
  <div class="about-horizontal-brand-track" data-brand-lane="top"></div>
</div>
<div class="about-horizontal-brand-row about-horizontal-brand-row-middle">
  <div class="about-horizontal-brand-track" data-brand-lane="middle"></div>
</div>
<div class="about-horizontal-brand-row about-horizontal-brand-row-bottom">
  <div class="about-horizontal-brand-track" data-brand-lane="bottom"></div>
</div>
`.trim();
}

function renderSkillSignalBoard(skills) {
  const showcase = buildSkillShowcaseModel(skills);
  const entry = showcase.initialEntry;
  return `
<div class="about-horizontal-signal-board" id="aboutSkillSignalBoard">
  <div class="about-horizontal-signal-cosmos" aria-hidden="true">
    <span class="about-horizontal-signal-streak is-1"></span>
    <span class="about-horizontal-signal-streak is-2"></span>
    <span class="about-horizontal-signal-streak is-3"></span>
    <span class="about-horizontal-signal-streak is-4"></span>
    <span class="about-horizontal-signal-orbit is-a"></span>
    <span class="about-horizontal-signal-orbit is-b"></span>
  </div>

  <div class="about-horizontal-signal-head">
    <span class="about-horizontal-topic-kicker">Signal Echo</span>
    <span class="about-horizontal-signal-note">中排图标靠近右侧分界线时，这里会自动切换</span>
  </div>

  <div class="about-horizontal-signal-stage">
    <div class="about-horizontal-signal-glyph" id="aboutSkillSignalGlyph">${escapeHtml(entry.glyph)}</div>
    <div class="about-horizontal-signal-copy">
      <div class="about-horizontal-signal-name" id="aboutSkillSignalName">${escapeHtml(entry.name)}</div>
      <p class="about-horizontal-signal-desc" id="aboutSkillSignalDesc">${escapeHtml(entry.desc)}</p>
    </div>
  </div>

  <div class="about-horizontal-signal-wave" aria-hidden="true">
    <span class="about-horizontal-signal-bar is-a"></span>
    <span class="about-horizontal-signal-bar is-b"></span>
    <span class="about-horizontal-signal-bar is-c"></span>
    <span class="about-horizontal-signal-bar is-d"></span>
  </div>

  <div class="about-horizontal-signal-meta">
    <div class="about-horizontal-signal-item">
      <span class="about-horizontal-signal-label">Role</span>
      <strong id="aboutSkillSignalRole">${escapeHtml(entry.role)}</strong>
    </div>
    <div class="about-horizontal-signal-item">
      <span class="about-horizontal-signal-label">Cue</span>
      <strong id="aboutSkillSignalCue">${escapeHtml(entry.cue)}</strong>
    </div>
    <div class="about-horizontal-signal-item">
      <span class="about-horizontal-signal-label">Use</span>
      <strong id="aboutSkillSignalUse">${escapeHtml(entry.use)}</strong>
    </div>
  </div>

  <div class="about-horizontal-signal-tail" id="aboutSkillSignalTail">${escapeHtml(entry.tail)}</div>
</div>
`.trim();
}

function renderExperienceCardsLegacy(experience) {
  const defaults = [
    {
      date: "2019",
      title: "开始做站点",
      company: "",
      description: "从静态页面、博客主题和小型后台开始，逐渐建立自己的内容和前端基础。"
    },
    {
      date: "2021",
      title: "形成工程体系",
      company: "",
      description: "开始更系统地处理组件抽象、接口约束、内容结构和部署链路。"
    },
    {
      date: "2023",
      title: "前后端整合",
      company: "",
      description: "把前台、后台、数据库和内容工作流串成统一的产品闭环。"
    },
    {
      date: "Now",
      title: "持续打磨表达",
      company: "",
      description: "开始更关注页面结构、视觉叙事和整体观感，希望博客本身也是作品。"
    }
  ];

  const source = experience.length ? experience.slice(0, 4) : defaults;
  return source
    .map((item, index) => {
      const company = item.company ? `<div class="about-horizontal-career-company">${escapeHtml(item.company)}</div>` : "";
      const extra = index === source.length - 1 ? " highlight" : "";
      return `
<article class="about-horizontal-career-card${extra}">
  <div class="about-horizontal-career-date">${escapeHtml(item.date || `阶段 ${index + 1}`)}</div>
  <h3>${escapeHtml(item.title || "阶段")}</h3>
  ${company}
  <p>${escapeHtml(item.description || "围绕内容、工程、表达和长期维护不断调整自己的工作方式。")}</p>
</article>
`.trim();
    })
    .join("");
}

function renderTravelPills(places) {
  if (!places.length) {
    return `<div class="about-horizontal-empty">还没有配置旅行足迹，可以继续在后台 JSON 中维护。</div>`;
  }
  return places
    .slice(0, 10)
    .map(
      (place) =>
        `<button class="about-horizontal-travel-pill" type="button" data-place="${escapeHtml(place)}">${escapeHtml(
          formatVisitedPlaceLabel(place)
        )}</button>`
    )
    .join("");
}

function renderPortraitMedia(content, avatarText) {
  if (content.profile.avatarUrl) {
    return `<img class="about-horizontal-portrait-photo" src="${escapeHtml(content.profile.avatarUrl)}" alt="${escapeHtml(
      content.profile.name
    )}">`;
  }
  return `<div class="about-horizontal-portrait-avatar">${escapeHtml(avatarText)}</div>`;
}

function renderNextLinks(links) {
  return links
    .map(
      (link, index) => `
<a href="${escapeHtml(link.href)}" class="about-horizontal-next-link${link.variant === "ghost" ? " ghost" : " is-primary"}">
  <span class="about-horizontal-next-link-index">${String(index + 1).padStart(2, "0")}</span>
  <span class="about-horizontal-next-link-label">${escapeHtml(link.label)}</span>
  <span class="about-horizontal-next-link-arrow" aria-hidden="true">&#8599;</span>
</a>
`.trim()
    )
    .join("");
}

function renderNextBands(bands) {
  const source = Array.isArray(bands) && bands.length ? bands : ["SEE YOU NEXT TIME", "ARTICLES / PROJECTS", "BEST WISHES", "FROM BITLOG"];
  return `
<div class="about-horizontal-next-bands" aria-hidden="true">
  ${source
    .map((item, index) => {
      const repeatCount = item.length > 18 ? 4 : 5;
      const line = `${Array.from({ length: repeatCount }, () => item).join(" / ")} /`;
      const copy = `<span class="about-horizontal-next-band-copy">${escapeHtml(line)}</span>`;
      return `
  <div class="about-horizontal-next-band${index % 2 ? " reverse" : ""}" style="--about-next-band-duration:${22 + index * 4}s">
    <div class="about-horizontal-next-band-track">${copy}${copy}</div>
  </div>`;
    })
    .join("")}
</div>
`.trim();
}

function renderVerticalTitle(title) {
  const chars = Array.from(String(title ?? ""));
  return `
<span class="about-horizontal-vertical-title-text" aria-label="${escapeHtml(title)}">
  ${chars.map((char) => `<span class="about-horizontal-vertical-title-char">${escapeHtml(char)}</span>`).join("")}
</span>
`.trim();
}

function renderAboutAppLegacy(data) {
  const content = data.content;
  const avatarText = initialsFromText(content.profile.name);
  return `
<div class="about-horizontal-app">
  <div class="about-horizontal-wrap" id="aboutHorizontalWrap">
    <div class="about-horizontal-track" id="aboutHorizontalTrack">
      <section class="about-horizontal-panel about-horizontal-panel-intro" data-panel="intro" data-panel-title="关于">
        <div class="about-horizontal-intro-copy about-horizontal-intro-story">
          <div class="about-horizontal-intro-banner">${escapeHtml(content.hero.kicker)}</div>
          <div class="about-horizontal-intro-main">
            <div class="about-horizontal-intro-overline">About / 关于</div>
            <h1>${escapeHtml(content.hero.title)}</h1>
            <p class="about-horizontal-lead">${escapeHtml(content.hero.lead)}</p>
            <p class="about-horizontal-intro-body">${escapeHtml(content.hero.description)}</p>
          </div>
        </div>

        <div class="about-horizontal-intro-side about-horizontal-identity-grid">
          <div class="about-horizontal-identity-block about-horizontal-identity-avatar">
            <div class="about-horizontal-portrait-frame">
              <div class="about-horizontal-portrait-glow"></div>
              ${renderPortraitMedia(content, avatarText)}
            </div>
          </div>

          <div class="about-horizontal-identity-block about-horizontal-identity-meta">
            <div class="about-horizontal-identity-copy">
              <div class="about-horizontal-portrait-name">${escapeHtml(content.profile.name)}</div>
              <div class="about-horizontal-identity-group">
                <div class="about-horizontal-identity-label">职位 / 职业</div>
                <div class="about-horizontal-portrait-role">${escapeHtml(content.profile.role)}</div>
              </div>
            </div>
          </div>

          <div class="about-horizontal-identity-block about-horizontal-identity-summary">
            <div class="about-horizontal-identity-group">
              <div class="about-horizontal-identity-label">简介</div>
              <p class="about-horizontal-profile-summary">${escapeHtml(content.profile.summary)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-skills" data-panel="skills" data-panel-title="${escapeHtml(
        content.skills.title
      )}">
        <div class="about-horizontal-skills-shell">
          <aside class="about-horizontal-vertical-label about-horizontal-skills-label">
            <span class="about-horizontal-vertical-kicker">${escapeHtml(content.skills.kicker)}</span>
            <span class="about-horizontal-vertical-title">${renderVerticalTitle(content.skills.title)}</span>
          </aside>

          <div class="about-horizontal-skills-main">
            <div class="about-horizontal-skills-layout">
              <div class="about-horizontal-brand-board">
                <div class="about-horizontal-brand-wall">
                  ${renderSkillBrandWall()}
                </div>
              </div>

              <div class="about-horizontal-skills-side">
                ${renderSkillSignalBoard(data.skills)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-career" data-panel="career" data-panel-title="${escapeHtml(
        content.career.title
      )}">
        <div class="about-horizontal-section-shell about-horizontal-career-shell">
          <aside class="about-horizontal-vertical-label about-horizontal-section-label about-horizontal-career-label">
            <span class="about-horizontal-vertical-kicker">${escapeHtml(content.career.kicker)}</span>
            <span class="about-horizontal-vertical-title">${renderVerticalTitle(content.career.title)}</span>
          </aside>

          <div class="about-horizontal-section-main about-horizontal-career-main">
            <p class="about-horizontal-panel-lead about-horizontal-career-lead">${escapeHtml(content.career.lead)}</p>
            <div class="about-horizontal-career-line">
              ${renderExperienceCards(data.experience)}
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-travel" data-panel="travel" data-panel-title="${escapeHtml(
        content.travel.title
      )}">
        <div class="about-horizontal-section-shell about-horizontal-travel-shell">
          <aside class="about-horizontal-vertical-label about-horizontal-section-label about-horizontal-travel-label">
            <span class="about-horizontal-vertical-kicker">${escapeHtml(content.travel.kicker)}</span>
            <span class="about-horizontal-vertical-title">${renderVerticalTitle(content.travel.title)}</span>
          </aside>

          <div class="about-horizontal-section-main about-horizontal-travel-main">
            <div class="about-horizontal-travel-copy">
              <p class="about-horizontal-panel-lead about-horizontal-travel-lead">${escapeHtml(content.travel.lead)}</p>
          <div class="about-horizontal-travel-actions">
            <button class="about-horizontal-action ghost" id="aboutHeatmapReload" type="button">重载地图</button>
          </div>
          <div class="about-horizontal-travel-list">
            ${renderTravelPills(data.places)}
          </div>
        </div>

            <div class="about-horizontal-map-card">
              <div class="about-horizontal-map-surface" id="about-heatmap"></div>
              <div class="about-horizontal-map-caption">3D World Heatmap</div>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-next" data-panel="next" data-panel-title="${escapeHtml(
        content.next.title
      )}">
        <div class="about-horizontal-next-board">
          <div class="about-horizontal-next-body">
            <div class="about-horizontal-next-copy">
              <div class="about-horizontal-next-heading">
                <div class="about-horizontal-kicker">${escapeHtml(content.next.kicker)}</div>
                <div class="about-horizontal-next-title">${escapeHtml(content.next.title)}</div>
              </div>
              <blockquote class="about-horizontal-next-quote">${escapeHtml(content.next.quote)}</blockquote>
              <p class="about-horizontal-panel-lead">${escapeHtml(content.next.lead)}</p>
            </div>

            <div class="about-horizontal-next-rail">
              <div class="about-horizontal-next-signature">
                <span class="about-horizontal-next-signature-label">Signature</span>
                <strong>${escapeHtml(content.next.signature || content.profile.name)}</strong>
                <span>${escapeHtml(content.profile.role)}</span>
              </div>

              <div class="about-horizontal-next-links">
                ${renderNextLinks(content.next.links)}
              </div>
            </div>
          </div>

          ${renderNextBands(content.next.bands)}
        </div>
      </section>
    </div>
  </div>

  <div class="about-horizontal-progress">
    <div class="about-horizontal-progress-bar" id="aboutHorizontalProgressBar"></div>
  </div>
</div>
`.trim();
}

async function fetchJson(path) {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

let heatmapInstance = null;
let currentCleanup = null;
let initRunning = false;

function destroyCurrentView() {
  if (typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }
  if (heatmapInstance && typeof heatmapInstance.destroy === "function") {
    heatmapInstance.destroy();
  }
  heatmapInstance = null;
}

async function mountHeatmap(places) {
  const root = $("about-heatmap");
  if (!root) return null;
  root.innerHTML = `<div class="about-horizontal-meta">正在加载 3D 地图...</div>`;

  try {
    const mod = await import("./world-heatmap.js");
    heatmapInstance = await mod.initWorldHeatmap(root, places);
    return heatmapInstance;
  } catch (error) {
    root.innerHTML = `<div class="about-horizontal-meta">地图加载失败：${escapeHtml(error?.message || String(error))}</div>`;
    return null;
  }
}

function initHorizontalScrollerLegacy(container, data) {
  const wrap = container.querySelector("#aboutHorizontalWrap");
  const track = container.querySelector("#aboutHorizontalTrack");
  const progress = container.querySelector("#aboutHorizontalProgressBar");
  const panels = Array.from(container.querySelectorAll("[data-panel]"));
  const revealGroups = Array.from(container.querySelectorAll("[data-reveal-group]")).map((group) => ({
    element: group,
    items: Array.from(group.querySelectorAll("[data-reveal-item]"))
  }));
  const showcase = buildSkillShowcaseModel(data.skills);
  const brandLaneElements = {
    top: container.querySelector('[data-brand-lane="top"]'),
    middle: container.querySelector('[data-brand-lane="middle"]'),
    bottom: container.querySelector('[data-brand-lane="bottom"]')
  };
  const signalBoard = container.querySelector("#aboutSkillSignalBoard");
  const signalGlyph = container.querySelector("#aboutSkillSignalGlyph");
  const signalName = container.querySelector("#aboutSkillSignalName");
  const signalDesc = container.querySelector("#aboutSkillSignalDesc");
  const signalRole = container.querySelector("#aboutSkillSignalRole");
  const signalCue = container.querySelector("#aboutSkillSignalCue");
  const signalUse = container.querySelector("#aboutSkillSignalUse");
  const signalTail = container.querySelector("#aboutSkillSignalTail");

  if (!wrap || !track || !progress || !panels.length) return () => {};

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
  const toneMap = {
    cyan: {
      accent: "color-mix(in srgb, var(--about-cyan) 74%, white)",
      soft: "color-mix(in srgb, var(--about-cyan) 42%, white)",
      halo: "color-mix(in srgb, var(--about-cyan) 18%, transparent)",
      ring: "color-mix(in srgb, var(--about-cyan) 10%, transparent)",
      line: "color-mix(in srgb, var(--about-cyan) 30%, transparent)",
      tail: "color-mix(in srgb, var(--about-cyan) 44%, var(--muted))",
      bars: ["30px", "58px", "96px", "46px"]
    },
    sky: {
      accent: "#78a6ff",
      soft: "#c8daff",
      halo: "rgba(120, 166, 255, 0.18)",
      ring: "rgba(120, 166, 255, 0.08)",
      line: "rgba(120, 166, 255, 0.34)",
      tail: "rgba(200, 218, 255, 0.58)",
      bars: ["36px", "56px", "90px", "58px"]
    },
    orange: {
      accent: "var(--about-orange)",
      soft: "#ffd3ad",
      halo: "rgba(255, 155, 82, 0.18)",
      ring: "rgba(255, 155, 82, 0.08)",
      line: "rgba(255, 155, 82, 0.34)",
      tail: "rgba(255, 211, 173, 0.58)",
      bars: ["24px", "66px", "86px", "52px"]
    },
    violet: {
      accent: "#a88bff",
      soft: "#e0d5ff",
      halo: "rgba(168, 139, 255, 0.18)",
      ring: "rgba(168, 139, 255, 0.08)",
      line: "rgba(168, 139, 255, 0.34)",
      tail: "rgba(224, 213, 255, 0.58)",
      bars: ["38px", "62px", "98px", "44px"]
    },
    lime: {
      accent: "var(--about-lime)",
      soft: "#e0f6b8",
      halo: "rgba(179, 232, 103, 0.18)",
      ring: "rgba(179, 232, 103, 0.08)",
      line: "rgba(179, 232, 103, 0.34)",
      tail: "rgba(224, 246, 184, 0.58)",
      bars: ["28px", "62px", "84px", "48px"]
    },
    gold: {
      accent: "var(--about-gold)",
      soft: "#ffe6ad",
      halo: "rgba(246, 202, 112, 0.18)",
      ring: "rgba(246, 202, 112, 0.08)",
      line: "rgba(246, 202, 112, 0.34)",
      tail: "rgba(255, 230, 173, 0.58)",
      bars: ["32px", "54px", "92px", "50px"]
    }
  };
  const brandState = {
    items: [],
    lanes: {
      top: [],
      middle: [],
      bottom: []
    },
    laneOrder: ["top", "bottom"],
    outerTurn: 0,
    gap: 24,
    laneEntryOffset: {
      top: 10,
      bottom: 24
    },
    handoffLead: {
      middleToOuter: 18,
      outerToMiddle: 18
    },
    speeds: {
      top: 32,
      middle: 58,
      bottom: 41
    },
    edgeThreshold: 46,
    raf: 0,
    lastTime: 0
  };
  let activeShowcaseKey = showcase.initialEntry?.key || null;
  let flashTimer = 0;

  function clamp(value) {
    return Math.max(0, Math.min(state.maxX, value));
  }

  function isLockedInteractiveTarget(target) {
    return target instanceof Element && !!target.closest('[data-horizontal-scroll-lock="true"]');
  }

  function setRevealProgress(item, value) {
    const progressValue = Math.max(0, Math.min(1, value));
    item.style.setProperty("--item-progress", progressValue.toFixed(3));
    item.classList.toggle("is-visible", progressValue > 0.08);
  }

  function applySignalTone(toneKey) {
    if (!(signalBoard instanceof HTMLElement)) return;
    const tone = toneMap[toneKey] || toneMap.cyan;
    signalBoard.style.setProperty("--signal-accent", tone.accent);
    signalBoard.style.setProperty("--signal-soft", tone.soft);
    signalBoard.style.setProperty("--signal-halo", tone.halo);
    signalBoard.style.setProperty("--signal-ring", tone.ring);
    signalBoard.style.setProperty("--signal-line", tone.line);
    signalBoard.style.setProperty("--signal-tail", tone.tail);
    signalBoard.style.setProperty("--signal-bar-a", tone.bars[0]);
    signalBoard.style.setProperty("--signal-bar-b", tone.bars[1]);
    signalBoard.style.setProperty("--signal-bar-c", tone.bars[2]);
    signalBoard.style.setProperty("--signal-bar-d", tone.bars[3]);
  }

  function renderSignalEntry(entryKey) {
    const entry = showcase.entryMap.get(entryKey) || showcase.initialEntry;
    if (!entry) return;
    applySignalTone(entry.tone);
    if (signalGlyph) signalGlyph.textContent = entry.glyph;
    if (signalName) signalName.textContent = entry.name;
    if (signalDesc) signalDesc.textContent = entry.desc;
    if (signalRole) signalRole.textContent = entry.role;
    if (signalCue) signalCue.textContent = entry.cue;
    if (signalUse) signalUse.textContent = entry.use;
    if (signalTail) signalTail.textContent = entry.tail;
    if (signalBoard instanceof HTMLElement) {
      signalBoard.classList.remove("is-flashing");
      window.clearTimeout(flashTimer);
      signalBoard.offsetWidth;
      signalBoard.classList.add("is-flashing");
      flashTimer = window.setTimeout(() => {
        signalBoard.classList.remove("is-flashing");
      }, 140);
    }
  }

  function createBrandNode(entry) {
    const node = document.createElement("span");
    node.className = "about-horizontal-brand-link";
    node.setAttribute("data-skill-key", entry.key);
    node.innerHTML = `<span class="about-horizontal-brand-glyph">${escapeHtml(entry.glyph)}</span><span class="about-horizontal-brand-label">${escapeHtml(
      entry.label
    )}</span>`;
    return {
      ...entry,
      lane: "middle",
      x: 0,
      width: 0,
      element: node
    };
  }

  function renderBrandNode(item) {
    item.element.style.transform = `translate3d(${item.x}px, -50%, 0)`;
  }

  function mountBrandLane(laneKey, entries, startX) {
    const lane = brandLaneElements[laneKey];
    if (!(lane instanceof HTMLElement)) return;
    let nextX = startX;
    entries.forEach((entry) => {
      const item = createBrandNode(entry);
      item.lane = laneKey;
      lane.appendChild(item.element);
      item.width = item.element.getBoundingClientRect().width;
      item.x = nextX;
      nextX += item.width + brandState.gap;
      renderBrandNode(item);
      brandState.items.push(item);
      brandState.lanes[laneKey].push(item);
    });
  }

  function getLaneRightEdge(laneKey) {
    const lane = brandLaneElements[laneKey];
    return lane instanceof HTMLElement ? lane.clientWidth : 0;
  }

  function removeBrandItem(laneKey, item) {
    brandState.lanes[laneKey] = brandState.lanes[laneKey].filter((laneItem) => laneItem !== item);
  }

  function moveBrandItem(item, targetLane) {
    const lane = brandLaneElements[targetLane];
    if (!(lane instanceof HTMLElement)) return;

    removeBrandItem(item.lane, item);
    lane.appendChild(item.element);
    item.lane = targetLane;

    if (targetLane === "middle") {
      const leftMost = brandState.lanes.middle.length
        ? Math.min(...brandState.lanes.middle.map((laneItem) => laneItem.x))
        : 0;
      item.x = Math.min(-item.width - brandState.gap, leftMost - item.width - brandState.gap);
    } else {
      const laneWidth = getLaneRightEdge(targetLane);
      const entryOffset = brandState.laneEntryOffset[targetLane] || 20;
      const rightMost = brandState.lanes[targetLane].length
        ? Math.max(...brandState.lanes[targetLane].map((laneItem) => laneItem.x + laneItem.width))
        : laneWidth;
      item.x = Math.max(laneWidth + entryOffset, rightMost + brandState.gap);
    }

    brandState.lanes[targetLane].push(item);
    renderBrandNode(item);
  }

  function buildBrandLoop() {
    Object.values(brandLaneElements).forEach((lane) => {
      if (lane instanceof HTMLElement) lane.innerHTML = "";
    });
    brandState.items = [];
    brandState.lanes.top = [];
    brandState.lanes.middle = [];
    brandState.lanes.bottom = [];
    brandState.outerTurn = 0;

    const middleWidth = getLaneRightEdge("middle");
    mountBrandLane("top", showcase.lanes.top, 8);
    mountBrandLane("middle", showcase.lanes.middle, -Math.max(150, middleWidth * 0.24));
    mountBrandLane("bottom", showcase.lanes.bottom, 18);
  }

  function updateSkillSignal() {
    const middleItems = brandState.lanes.middle;
    const brandBoard = container.querySelector(".about-horizontal-brand-board");
    if (!isDesktop() || !(brandBoard instanceof HTMLElement) || !middleItems.length) return;

    const seamX = brandBoard.getBoundingClientRect().right;
    let closest = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    middleItems.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(center - seamX);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = item;
      }
    });

    if (!closest) return;

    const triggerThreshold = Math.min(brandState.edgeThreshold, Math.max(26, closest.width * 0.26));
    if (bestDistance > triggerThreshold) return;
    if (closest.key === activeShowcaseKey) return;
    activeShowcaseKey = closest.key;
    renderSignalEntry(activeShowcaseKey);
  }

  function tickBrandLoop(now) {
    if (!isDesktop()) {
      brandState.raf = 0;
      return;
    }

    if (!brandState.lastTime) brandState.lastTime = now;
    const delta = Math.min(40, Math.max(12, now - brandState.lastTime));
    const dt = delta / 1000;
    brandState.lastTime = now;
    const transfers = [];

    brandState.items.forEach((item) => {
      const direction = item.lane === "middle" ? 1 : -1;
      item.x += direction * brandState.speeds[item.lane] * dt;

      if (item.lane === "middle") {
        const laneWidth = getLaneRightEdge("middle");
        if (item.x > laneWidth - brandState.handoffLead.middleToOuter) {
          const targetLane = brandState.laneOrder[brandState.outerTurn % brandState.laneOrder.length];
          brandState.outerTurn += 1;
          transfers.push({ item, targetLane });
        }
      } else if (item.x + item.width < brandState.handoffLead.outerToMiddle) {
        transfers.push({ item, targetLane: "middle" });
      }
    });

    transfers.forEach(({ item, targetLane }) => moveBrandItem(item, targetLane));
    brandState.items.forEach((item) => renderBrandNode(item));
    updateSkillSignal();
    brandState.raf = requestAnimationFrame(tickBrandLoop);
  }

  function startBrandLoop() {
    if (!isDesktop()) return;
    if (brandState.raf) return;
    brandState.lastTime = 0;
    brandState.raf = requestAnimationFrame(tickBrandLoop);
  }

  function stopBrandLoop() {
    if (brandState.raf) cancelAnimationFrame(brandState.raf);
    brandState.raf = 0;
    brandState.lastTime = 0;
  }

  function updateRevealGroups() {
    if (!isDesktop()) {
      revealGroups.forEach(({ element, items }) => {
        element.style.setProperty("--reveal-progress", "1");
        items.forEach((item) => setRevealProgress(item, 1));
      });
      return;
    }

    const wrapRect = wrap.getBoundingClientRect();
    const appearFrom = wrapRect.right;
    const settleAt = wrapRect.left + wrapRect.width * 0.34;
    const distanceSpan = Math.max(1, appearFrom - settleAt);

    revealGroups.forEach(({ element, items }) => {
      const rect = element.getBoundingClientRect();
      const rawProgress = (appearFrom - rect.left) / distanceSpan;
      const groupProgress = Math.max(0, Math.min(1, rawProgress));
      element.style.setProperty("--reveal-progress", groupProgress.toFixed(3));

      const count = Math.max(1, items.length);
      items.forEach((item, index) => {
        const start = index * (0.5 / count);
        const end = Math.min(1, start + 0.42);
        const itemProgress = (groupProgress - start) / Math.max(0.001, end - start);
        setRevealProgress(item, itemProgress);
      });
    });
  }

  function syncBounds() {
    if (!isDesktop()) {
      state.maxX = 0;
      state.currentX = 0;
      state.targetX = 0;
      track.style.transform = "";
      updateRevealGroups();
      return;
    }
    state.maxX = Math.max(0, track.scrollWidth - wrap.clientWidth);
    state.currentX = clamp(state.currentX);
    state.targetX = clamp(state.targetX);
  }

  function updateProgress() {
    const ratio = state.maxX > 0 ? state.currentX / state.maxX : 0;
    progress.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

    const wrapRect = wrap.getBoundingClientRect();
    const viewportCenter = wrapRect.left + wrapRect.width / 2;
    const edgeThreshold = 2;
    const isAtStart = state.currentX <= edgeThreshold;
    const isAtEnd = state.maxX - state.currentX <= edgeThreshold;
    let active = isAtEnd ? panels[panels.length - 1] : panels[0];
    let best = Number.POSITIVE_INFINITY;

    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(center - viewportCenter);
      panel.classList.toggle("is-near", distance < rect.width * 0.75);
      if (!isAtStart && !isAtEnd && distance < best) {
        best = distance;
        active = panel;
      }
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel === active);
    });

    updateRevealGroups();
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
    updateProgress();

    if (Math.abs(state.targetX - state.currentX) >= 0.2 || state.dragging) {
      state.raf = requestAnimationFrame(render);
      return;
    }
    state.raf = 0;
  }

  function startAnimation() {
    if (state.raf) return;
    state.raf = requestAnimationFrame(render);
  }

  function scrollToPanel(id) {
    const target = container.querySelector(`[data-panel="${id}"]`);
    if (!(target instanceof HTMLElement)) return;
    if (!isDesktop()) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    state.targetX = clamp(target.offsetLeft - 24);
    startAnimation();
  }

  const onWheel = (event) => {
    if (!isDesktop()) return;
    if (isLockedInteractiveTarget(event.target)) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    state.targetX = clamp(state.targetX + event.deltaY * 1.18);
    startAnimation();
  };

  const onKeyDown = (event) => {
    if (!isDesktop()) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      state.targetX = clamp(state.targetX + Math.round(wrap.clientWidth * 0.72));
      startAnimation();
    }
    if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      state.targetX = clamp(state.targetX - Math.round(wrap.clientWidth * 0.72));
      startAnimation();
    }
  };

  const onMouseDown = (event) => {
    if (!isDesktop()) return;
    if (isLockedInteractiveTarget(event.target)) return;
    state.dragging = true;
    state.dragStartX = event.clientX;
    state.dragStartTarget = state.targetX;
    wrap.style.cursor = "grabbing";
    startAnimation();
  };

  const onMouseMove = (event) => {
    if (!state.dragging || !isDesktop()) return;
    const delta = event.clientX - state.dragStartX;
    state.targetX = clamp(state.dragStartTarget - delta);
  };

  const onMouseUp = () => {
    state.dragging = false;
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  };

  const onResize = () => {
    syncBounds();
    stopBrandLoop();
    buildBrandLoop();
    startBrandLoop();
    updateProgress();
    startAnimation();
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  };

  container.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href") || "";
      const id = href.slice(1);
      if (!id) return;
      const exists = container.querySelector(`[data-panel="${id}"]`);
      if (!exists) return;
      event.preventDefault();
      scrollToPanel(id);
    });
  });

  wrap.addEventListener("wheel", onWheel, { passive: false });
  wrap.addEventListener("mousedown", onMouseDown);
  wrap.addEventListener("mouseleave", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);

  buildBrandLoop();
  renderSignalEntry(activeShowcaseKey);
  startBrandLoop();
  syncBounds();
  updateProgress();
  wrap.style.cursor = isDesktop() ? "grab" : "auto";

  return () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    stopBrandLoop();
    window.clearTimeout(flashTimer);
    wrap.removeEventListener("wheel", onWheel);
    wrap.removeEventListener("mousedown", onMouseDown);
    wrap.removeEventListener("mouseleave", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
  };
}

function renderExperienceCards(experience) {
  const defaults = [
    {
      date: "2019",
      title: "Started Building",
      company: "",
      description: "从静态页面和小型后台开始，逐步搭起内容、界面和工程基础。"
    },
    {
      date: "2021",
      title: "System Thinking",
      company: "",
      description: "开始更系统地处理组件抽象、接口约束、内容结构和部署链路。"
    },
    {
      date: "2023",
      title: "Full-stack Integration",
      company: "",
      description: "把前台、后台、数据和内容工作流逐步串成统一的产品闭环。"
    },
    {
      date: "Now",
      title: "Refining Expression",
      company: "",
      description: "更关注页面叙事、阅读节奏和整体观感，让博客本身也像作品。"
    },
    {
      date: "Future",
      title: "Keep Moving",
      company: "",
      description: "继续把文章、项目和个人表达串成一条更完整、更自然的浏览路径。"
    }
  ];

  const source = experience.length ? experience : defaults;
  return source
    .map((item, index) => {
      const company = item.company ? `<div class="about-horizontal-career-company">${escapeHtml(item.company)}</div>` : "";
      const side = index % 2 === 0 ? " is-left" : " is-right";
      const extra = index === source.length - 1 ? " highlight" : "";
      return `
<article class="about-horizontal-career-item${side}${extra}" data-career-item>
  <div class="about-horizontal-career-dot" aria-hidden="true"></div>
  <div class="about-horizontal-career-card">
    <div class="about-horizontal-career-date">${escapeHtml(item.date || `阶段 ${index + 1}`)}</div>
    <h3>${escapeHtml(item.title || "阶段")}</h3>
    ${company}
    <p>${escapeHtml(item.description || "围绕内容、工程、表达和长期维护持续调整自己的工作方式。")}</p>
  </div>
</article>
`.trim();
    })
    .join("");
}

function renderAboutApp(data) {
  const content = data.content;
  const avatarText = initialsFromText(content.profile.name);
  return `
<div class="about-horizontal-app">
  <div class="about-horizontal-wrap" id="aboutHorizontalWrap">
    <div class="about-horizontal-track" id="aboutHorizontalTrack">
      <section class="about-horizontal-panel about-horizontal-panel-intro" data-panel="intro" data-panel-title="关于">
        <div class="about-horizontal-intro-copy about-horizontal-intro-story">
          <div class="about-horizontal-intro-banner">${escapeHtml(content.hero.kicker)}</div>
          <div class="about-horizontal-intro-main">
            <div class="about-horizontal-intro-overline">About / 关于</div>
            <h1>${escapeHtml(content.hero.title)}</h1>
            <p class="about-horizontal-lead">${escapeHtml(content.hero.lead)}</p>
            <p class="about-horizontal-intro-body">${escapeHtml(content.hero.description)}</p>
          </div>
        </div>

        <div class="about-horizontal-intro-side about-horizontal-identity-grid">
          <div class="about-horizontal-identity-block about-horizontal-identity-avatar">
            <div class="about-horizontal-portrait-frame">
              <div class="about-horizontal-portrait-glow"></div>
              ${renderPortraitMedia(content, avatarText)}
            </div>
          </div>

          <div class="about-horizontal-identity-block about-horizontal-identity-meta">
            <div class="about-horizontal-identity-copy">
              <div class="about-horizontal-portrait-name">${escapeHtml(content.profile.name)}</div>
              <div class="about-horizontal-identity-group">
                <div class="about-horizontal-identity-label">职位 / 职业</div>
                <div class="about-horizontal-portrait-role">${escapeHtml(content.profile.role)}</div>
              </div>
            </div>
          </div>

          <div class="about-horizontal-identity-block about-horizontal-identity-summary">
            <div class="about-horizontal-identity-group">
              <div class="about-horizontal-identity-label">简介</div>
              <p class="about-horizontal-profile-summary">${escapeHtml(content.profile.summary)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-skills" data-panel="skills" data-panel-title="${escapeHtml(
        content.skills.title
      )}">
        <div class="about-horizontal-skills-shell">
          <aside class="about-horizontal-vertical-label about-horizontal-skills-label">
            <span class="about-horizontal-vertical-kicker">${escapeHtml(content.skills.kicker)}</span>
            <span class="about-horizontal-vertical-title">${renderVerticalTitle(content.skills.title)}</span>
          </aside>

          <div class="about-horizontal-skills-main">
            <div class="about-horizontal-skills-layout">
              <div class="about-horizontal-brand-board">
                <div class="about-horizontal-brand-wall">
                  ${renderSkillBrandWall()}
                </div>
              </div>

              <div class="about-horizontal-skills-side">
                ${renderSkillSignalBoard(data.skills)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-career" data-panel="career" data-panel-title="${escapeHtml(
        content.career.title
      )}">
        <div class="about-horizontal-section-shell about-horizontal-career-shell">
          <aside class="about-horizontal-vertical-label about-horizontal-section-label about-horizontal-career-label">
            <span class="about-horizontal-vertical-kicker">${escapeHtml(content.career.kicker)}</span>
            <span class="about-horizontal-vertical-title">${renderVerticalTitle(content.career.title)}</span>
          </aside>

          <div class="about-horizontal-section-main about-horizontal-career-main">
            <div class="about-horizontal-career-head" id="aboutCareerHead">
              <p class="about-horizontal-panel-lead about-horizontal-career-lead">${escapeHtml(content.career.lead)}</p>
            </div>

            <div class="about-horizontal-career-stage" id="aboutCareerStage">
              <div class="about-horizontal-career-scroll" id="aboutCareerScroll">
                <div class="about-horizontal-career-flow" id="aboutCareerFlow">
                  <div class="about-horizontal-career-axis" aria-hidden="true"></div>
                  ${renderExperienceCards(data.experience)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-travel" data-panel="travel" data-panel-title="${escapeHtml(
        content.travel.title
      )}">
        <div class="about-horizontal-section-shell about-horizontal-travel-shell">
          <aside class="about-horizontal-vertical-label about-horizontal-section-label about-horizontal-travel-label">
            <span class="about-horizontal-vertical-kicker">${escapeHtml(content.travel.kicker)}</span>
            <span class="about-horizontal-vertical-title">${renderVerticalTitle(content.travel.title)}</span>
          </aside>

          <div class="about-horizontal-section-main about-horizontal-travel-main">
            <div class="about-horizontal-travel-copy">
              <p class="about-horizontal-panel-lead about-horizontal-travel-lead">${escapeHtml(content.travel.lead)}</p>
              <div class="about-horizontal-travel-actions">
                <button class="about-horizontal-action ghost" id="aboutHeatmapReload" type="button">重载地图</button>
              </div>
              <div class="about-horizontal-travel-list">
                ${renderTravelPills(data.places)}
              </div>
            </div>

            <div class="about-horizontal-map-card" id="aboutTravelMapCard">
              <div class="about-horizontal-map-surface" id="about-heatmap"></div>
              <div class="about-horizontal-map-caption">3D World Heatmap</div>
            </div>
          </div>
        </div>
      </section>

      <section class="about-horizontal-panel about-horizontal-panel-next" data-panel="next" data-panel-title="${escapeHtml(
        content.next.title
      )}">
        <div class="about-horizontal-next-board">
          <div class="about-horizontal-next-body">
            <div class="about-horizontal-next-copy">
              <div class="about-horizontal-next-heading">
                <div class="about-horizontal-kicker">${escapeHtml(content.next.kicker)}</div>
                <div class="about-horizontal-next-title">${escapeHtml(content.next.title)}</div>
              </div>
              <blockquote class="about-horizontal-next-quote">${escapeHtml(content.next.quote)}</blockquote>
              <p class="about-horizontal-panel-lead">${escapeHtml(content.next.lead)}</p>
            </div>

            <div class="about-horizontal-next-rail">
              <div class="about-horizontal-next-signature">
                <span class="about-horizontal-next-signature-label">Signature</span>
                <strong>${escapeHtml(content.next.signature || content.profile.name)}</strong>
                <span>${escapeHtml(content.profile.role)}</span>
              </div>

              <div class="about-horizontal-next-links">
                ${renderNextLinks(content.next.links)}
              </div>
            </div>
          </div>

          ${renderNextBands(content.next.bands)}
        </div>
      </section>
    </div>
  </div>

  <div class="about-horizontal-progress">
    <div class="about-horizontal-progress-bar" id="aboutHorizontalProgressBar"></div>
  </div>
</div>
`.trim();
}

function initHorizontalScroller(container, data) {
  const wrap = container.querySelector("#aboutHorizontalWrap");
  const track = container.querySelector("#aboutHorizontalTrack");
  const progress = container.querySelector("#aboutHorizontalProgressBar");
  const panels = Array.from(container.querySelectorAll("[data-panel]"));
  const panelMap = new Map(panels.map((panel) => [panel.getAttribute("data-panel") || "", panel]));
  const revealGroups = Array.from(container.querySelectorAll("[data-reveal-group]")).map((group) => ({
    element: group,
    items: Array.from(group.querySelectorAll("[data-reveal-item]"))
  }));
  const showcase = buildSkillShowcaseModel(data.skills);
  const careerPanel = panelMap.get("career");
  const careerHead = container.querySelector("#aboutCareerHead");
  const careerStage = container.querySelector("#aboutCareerStage");
  const careerScroll = container.querySelector("#aboutCareerScroll");
  const careerFlow = container.querySelector("#aboutCareerFlow");
  const careerItems = Array.from(container.querySelectorAll("[data-career-item]"));
  const travelPanel = panelMap.get("travel");
  const nextPanel = panelMap.get("next");
  const travelMapCard = container.querySelector("#aboutTravelMapCard");
  const topPanels = ["intro", "skills", "career"].map((key) => panelMap.get(key)).filter(Boolean);
  const lowerPanels = ["travel", "next"].map((key) => panelMap.get(key)).filter(Boolean);
  const brandLaneElements = {
    top: container.querySelector('[data-brand-lane="top"]'),
    middle: container.querySelector('[data-brand-lane="middle"]'),
    bottom: container.querySelector('[data-brand-lane="bottom"]')
  };
  const signalBoard = container.querySelector("#aboutSkillSignalBoard");
  const signalGlyph = container.querySelector("#aboutSkillSignalGlyph");
  const signalName = container.querySelector("#aboutSkillSignalName");
  const signalDesc = container.querySelector("#aboutSkillSignalDesc");
  const signalRole = container.querySelector("#aboutSkillSignalRole");
  const signalCue = container.querySelector("#aboutSkillSignalCue");
  const signalUse = container.querySelector("#aboutSkillSignalUse");
  const signalTail = container.querySelector("#aboutSkillSignalTail");

  if (!wrap || !track || !progress || !panels.length || !(careerPanel instanceof HTMLElement)) return () => {};

  const isDesktop = () => window.matchMedia("(min-width: 1081px)").matches;
  const state = {
    currentX: 0,
    targetX: 0,
    maxX: 0,
    raf: 0,
    dragging: false,
    dragStartX: 0,
    dragStartTarget: 0,
    activePanel: "intro"
  };
  const routeState = {
    focusX: 0,
    dropY: 0,
    maxCameraX: 0,
    panelProgress: {
      intro: 0,
      skills: 0,
      career: 0,
      travel: 0,
      next: 0
    }
  };
  const toneMap = {
    cyan: {
      accent: "color-mix(in srgb, var(--about-cyan) 74%, white)",
      soft: "color-mix(in srgb, var(--about-cyan) 42%, white)",
      halo: "color-mix(in srgb, var(--about-cyan) 18%, transparent)",
      ring: "color-mix(in srgb, var(--about-cyan) 10%, transparent)",
      line: "color-mix(in srgb, var(--about-cyan) 30%, transparent)",
      tail: "color-mix(in srgb, var(--about-cyan) 44%, var(--muted))",
      bars: ["30px", "58px", "96px", "46px"]
    },
    sky: {
      accent: "#78a6ff",
      soft: "#c8daff",
      halo: "rgba(120, 166, 255, 0.18)",
      ring: "rgba(120, 166, 255, 0.08)",
      line: "rgba(120, 166, 255, 0.34)",
      tail: "rgba(200, 218, 255, 0.58)",
      bars: ["36px", "56px", "90px", "58px"]
    },
    orange: {
      accent: "var(--about-orange)",
      soft: "#ffd3ad",
      halo: "rgba(255, 155, 82, 0.18)",
      ring: "rgba(255, 155, 82, 0.08)",
      line: "rgba(255, 155, 82, 0.34)",
      tail: "rgba(255, 211, 173, 0.58)",
      bars: ["24px", "66px", "86px", "52px"]
    },
    violet: {
      accent: "#a88bff",
      soft: "#e0d5ff",
      halo: "rgba(168, 139, 255, 0.18)",
      ring: "rgba(168, 139, 255, 0.08)",
      line: "rgba(168, 139, 255, 0.34)",
      tail: "rgba(224, 213, 255, 0.58)",
      bars: ["38px", "62px", "98px", "44px"]
    },
    lime: {
      accent: "var(--about-lime)",
      soft: "#e0f6b8",
      halo: "rgba(179, 232, 103, 0.18)",
      ring: "rgba(179, 232, 103, 0.08)",
      line: "rgba(179, 232, 103, 0.34)",
      tail: "rgba(224, 246, 184, 0.58)",
      bars: ["28px", "62px", "84px", "48px"]
    },
    gold: {
      accent: "var(--about-gold)",
      soft: "#ffe6ad",
      halo: "rgba(246, 202, 112, 0.18)",
      ring: "rgba(246, 202, 112, 0.08)",
      line: "rgba(246, 202, 112, 0.34)",
      tail: "rgba(255, 230, 173, 0.58)",
      bars: ["32px", "54px", "92px", "50px"]
    }
  };
  const brandState = {
    items: [],
    lanes: {
      top: [],
      middle: [],
      bottom: []
    },
    laneOrder: ["top", "bottom"],
    outerTurn: 0,
    gap: 24,
    laneEntryOffset: {
      top: 10,
      bottom: 24
    },
    handoffLead: {
      middleToOuter: 18,
      outerToMiddle: 18
    },
    speeds: {
      top: 32,
      middle: 58,
      bottom: 41
    },
    edgeThreshold: 46,
    raf: 0,
    lastTime: 0
  };
  let activeShowcaseKey = showcase.initialEntry?.key || null;
  let flashTimer = 0;

  function clamp(value) {
    return Math.max(0, Math.min(state.maxX, value));
  }

  function clampUnit(value) {
    return Math.max(0, Math.min(1, value));
  }

  function clampCameraX(value) {
    return Math.max(0, Math.min(routeState.maxCameraX, value));
  }

  function easeOutBack(value) {
    const x = clampUnit(value);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function isLockedInteractiveTarget(target) {
    return target instanceof Element && !!target.closest('[data-horizontal-scroll-lock="true"]');
  }

  function setRevealProgress(item, value) {
    const progressValue = Math.max(0, Math.min(1, value));
    item.style.setProperty("--item-progress", progressValue.toFixed(3));
    item.classList.toggle("is-visible", progressValue > 0.08);
  }

  function applySignalTone(toneKey) {
    if (!(signalBoard instanceof HTMLElement)) return;
    const tone = toneMap[toneKey] || toneMap.cyan;
    signalBoard.style.setProperty("--signal-accent", tone.accent);
    signalBoard.style.setProperty("--signal-soft", tone.soft);
    signalBoard.style.setProperty("--signal-halo", tone.halo);
    signalBoard.style.setProperty("--signal-ring", tone.ring);
    signalBoard.style.setProperty("--signal-line", tone.line);
    signalBoard.style.setProperty("--signal-tail", tone.tail);
    signalBoard.style.setProperty("--signal-bar-a", tone.bars[0]);
    signalBoard.style.setProperty("--signal-bar-b", tone.bars[1]);
    signalBoard.style.setProperty("--signal-bar-c", tone.bars[2]);
    signalBoard.style.setProperty("--signal-bar-d", tone.bars[3]);
  }

  function renderSignalEntry(entryKey) {
    const entry = showcase.entryMap.get(entryKey) || showcase.initialEntry;
    if (!entry) return;
    applySignalTone(entry.tone);
    if (signalGlyph) signalGlyph.textContent = entry.glyph;
    if (signalName) signalName.textContent = entry.name;
    if (signalDesc) signalDesc.textContent = entry.desc;
    if (signalRole) signalRole.textContent = entry.role;
    if (signalCue) signalCue.textContent = entry.cue;
    if (signalUse) signalUse.textContent = entry.use;
    if (signalTail) signalTail.textContent = entry.tail;
    if (signalBoard instanceof HTMLElement) {
      signalBoard.classList.remove("is-flashing");
      window.clearTimeout(flashTimer);
      signalBoard.offsetWidth;
      signalBoard.classList.add("is-flashing");
      flashTimer = window.setTimeout(() => {
        signalBoard.classList.remove("is-flashing");
      }, 140);
    }
  }

  function createBrandNode(entry) {
    const node = document.createElement("span");
    node.className = "about-horizontal-brand-link";
    node.setAttribute("data-skill-key", entry.key);
    node.innerHTML = `<span class="about-horizontal-brand-glyph">${escapeHtml(entry.glyph)}</span><span class="about-horizontal-brand-label">${escapeHtml(
      entry.label
    )}</span>`;
    return {
      ...entry,
      lane: "middle",
      x: 0,
      width: 0,
      element: node
    };
  }

  function renderBrandNode(item) {
    item.element.style.transform = `translate3d(${item.x}px, -50%, 0)`;
  }

  function mountBrandLane(laneKey, entries, startX) {
    const lane = brandLaneElements[laneKey];
    if (!(lane instanceof HTMLElement)) return;
    let nextX = startX;
    entries.forEach((entry) => {
      const item = createBrandNode(entry);
      item.lane = laneKey;
      lane.appendChild(item.element);
      item.width = item.element.getBoundingClientRect().width;
      item.x = nextX;
      nextX += item.width + brandState.gap;
      renderBrandNode(item);
      brandState.items.push(item);
      brandState.lanes[laneKey].push(item);
    });
  }

  function getLaneRightEdge(laneKey) {
    const lane = brandLaneElements[laneKey];
    return lane instanceof HTMLElement ? lane.clientWidth : 0;
  }

  function removeBrandItem(laneKey, item) {
    brandState.lanes[laneKey] = brandState.lanes[laneKey].filter((laneItem) => laneItem !== item);
  }

  function moveBrandItem(item, targetLane) {
    const lane = brandLaneElements[targetLane];
    if (!(lane instanceof HTMLElement)) return;

    removeBrandItem(item.lane, item);
    lane.appendChild(item.element);
    item.lane = targetLane;

    if (targetLane === "middle") {
      const leftMost = brandState.lanes.middle.length
        ? Math.min(...brandState.lanes.middle.map((laneItem) => laneItem.x))
        : 0;
      item.x = Math.min(-item.width - brandState.gap, leftMost - item.width - brandState.gap);
    } else {
      const laneWidth = getLaneRightEdge(targetLane);
      const entryOffset = brandState.laneEntryOffset[targetLane] || 20;
      const rightMost = brandState.lanes[targetLane].length
        ? Math.max(...brandState.lanes[targetLane].map((laneItem) => laneItem.x + laneItem.width))
        : laneWidth;
      item.x = Math.max(laneWidth + entryOffset, rightMost + brandState.gap);
    }

    brandState.lanes[targetLane].push(item);
    renderBrandNode(item);
  }

  function buildBrandLoop() {
    Object.values(brandLaneElements).forEach((lane) => {
      if (lane instanceof HTMLElement) lane.innerHTML = "";
    });
    brandState.items = [];
    brandState.lanes.top = [];
    brandState.lanes.middle = [];
    brandState.lanes.bottom = [];
    brandState.outerTurn = 0;

    const middleWidth = getLaneRightEdge("middle");
    mountBrandLane("top", showcase.lanes.top, 8);
    mountBrandLane("middle", showcase.lanes.middle, -Math.max(150, middleWidth * 0.24));
    mountBrandLane("bottom", showcase.lanes.bottom, 18);
  }

  function updateSkillSignal() {
    const middleItems = brandState.lanes.middle;
    const brandBoard = container.querySelector(".about-horizontal-brand-board");
    if (!isDesktop() || !(brandBoard instanceof HTMLElement) || !middleItems.length) return;

    const seamX = brandBoard.getBoundingClientRect().right;
    let closest = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    middleItems.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(center - seamX);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = item;
      }
    });

    if (!closest) return;

    const triggerThreshold = Math.min(brandState.edgeThreshold, Math.max(26, closest.width * 0.26));
    if (bestDistance > triggerThreshold) return;
    if (closest.key === activeShowcaseKey) return;
    activeShowcaseKey = closest.key;
    renderSignalEntry(activeShowcaseKey);
  }

  function tickBrandLoop(now) {
    if (!isDesktop()) {
      brandState.raf = 0;
      return;
    }

    if (!brandState.lastTime) brandState.lastTime = now;
    const delta = Math.min(40, Math.max(12, now - brandState.lastTime));
    const dt = delta / 1000;
    brandState.lastTime = now;
    const transfers = [];

    brandState.items.forEach((item) => {
      const direction = item.lane === "middle" ? 1 : -1;
      item.x += direction * brandState.speeds[item.lane] * dt;

      if (item.lane === "middle") {
        const laneWidth = getLaneRightEdge("middle");
        if (item.x > laneWidth - brandState.handoffLead.middleToOuter) {
          const targetLane = brandState.laneOrder[brandState.outerTurn % brandState.laneOrder.length];
          brandState.outerTurn += 1;
          transfers.push({ item, targetLane });
        }
      } else if (item.x + item.width < brandState.handoffLead.outerToMiddle) {
        transfers.push({ item, targetLane: "middle" });
      }
    });

    transfers.forEach(({ item, targetLane }) => moveBrandItem(item, targetLane));
    brandState.items.forEach((item) => renderBrandNode(item));
    updateSkillSignal();
    brandState.raf = requestAnimationFrame(tickBrandLoop);
  }

  function startBrandLoop() {
    if (!isDesktop()) return;
    if (brandState.raf) return;
    brandState.lastTime = 0;
    brandState.raf = requestAnimationFrame(tickBrandLoop);
  }

  function stopBrandLoop() {
    if (brandState.raf) cancelAnimationFrame(brandState.raf);
    brandState.raf = 0;
    brandState.lastTime = 0;
  }

  function updateRevealGroups() {
    if (!isDesktop()) {
      revealGroups.forEach(({ element, items }) => {
        element.style.setProperty("--reveal-progress", "1");
        items.forEach((item) => setRevealProgress(item, 1));
      });
      return;
    }

    const wrapRect = wrap.getBoundingClientRect();
    const appearFrom = wrapRect.right;
    const settleAt = wrapRect.left + wrapRect.width * 0.34;
    const distanceSpan = Math.max(1, appearFrom - settleAt);

    revealGroups.forEach(({ element, items }) => {
      const rect = element.getBoundingClientRect();
      const rawProgress = (appearFrom - rect.left) / distanceSpan;
      const groupProgress = Math.max(0, Math.min(1, rawProgress));
      element.style.setProperty("--reveal-progress", groupProgress.toFixed(3));

      const count = Math.max(1, items.length);
      items.forEach((item, index) => {
        const start = index * (0.5 / count);
        const end = Math.min(1, start + 0.42);
        const itemProgress = (groupProgress - start) / Math.max(0.001, end - start);
        setRevealProgress(item, itemProgress);
      });
    });
  }

  function focusProgressForPanel(panel) {
    if (!(panel instanceof HTMLElement)) return 0;
    return clampCameraX(panel.offsetLeft - Math.max(0, (wrap.clientWidth - panel.offsetWidth) / 2));
  }

  function clearDesktopTrackLayout() {
    track.style.width = "";
    track.style.height = "";
    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      panel.style.left = "";
      panel.style.top = "";
      panel.style.height = "";
    });
  }

  function measureCareerHeight(rowHeight, rowGap) {
    if (
      !(careerHead instanceof HTMLElement) ||
      !(careerStage instanceof HTMLElement) ||
      !(careerScroll instanceof HTMLElement) ||
      !(careerFlow instanceof HTMLElement)
    ) {
      return rowHeight + rowGap;
    }

    const mainStyles = window.getComputedStyle(careerPanel.querySelector(".about-horizontal-career-main") || careerPanel);
    const stageStyles = window.getComputedStyle(careerStage);
    const scrollStyles = window.getComputedStyle(careerScroll);
    const mainGap = Number.parseFloat(mainStyles.rowGap || mainStyles.gap) || 0;
    const stagePaddingY =
      (Number.parseFloat(stageStyles.paddingTop) || 0) + (Number.parseFloat(stageStyles.paddingBottom) || 0);
    const scrollPaddingY =
      (Number.parseFloat(scrollStyles.paddingTop) || 0) + (Number.parseFloat(scrollStyles.paddingBottom) || 0);

    const naturalHeight = careerHead.offsetHeight + mainGap + stagePaddingY + scrollPaddingY + careerFlow.scrollHeight;
    return Math.max(rowHeight + rowGap, Math.ceil(naturalHeight));
  }

  function renderTravelIntro() {
    if (!(travelMapCard instanceof HTMLElement)) return;

    if (!isDesktop() || routeState.panelProgress.travel <= 0) {
      travelMapCard.style.setProperty("--travel-intro", "1");
      travelMapCard.style.setProperty("--travel-pop", "1");
      return;
    }

    const start = routeState.panelProgress.travel - wrap.clientWidth * 0.48;
    const end = routeState.panelProgress.travel + wrap.clientWidth * 0.02;
    const raw = clampUnit((state.currentX - start) / Math.max(1, end - start));
    const pop = easeOutBack(raw);

    travelMapCard.style.setProperty("--travel-intro", raw.toFixed(4));
    travelMapCard.style.setProperty("--travel-pop", pop.toFixed(4));
  }

  function renderCareerTimelineReveal() {
    if (!careerItems.length) return;

    if (!isDesktop()) {
      careerItems.forEach((item) => {
        if (item instanceof HTMLElement) item.style.setProperty("--career-item-progress", "1");
      });
      return;
    }

    const verticalEnd = routeState.focusX + routeState.dropY;
    if (state.currentX >= verticalEnd - 2) {
      careerItems.forEach((item) => {
        if (item instanceof HTMLElement) item.style.setProperty("--career-item-progress", "1");
      });
      return;
    }

    const wrapRect = wrap.getBoundingClientRect();
    const trigger = wrapRect.bottom - wrapRect.height * 0.12;
    const range = wrapRect.height * 0.42;

    careerItems.forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const rect = item.getBoundingClientRect();
      const itemProgress = clampUnit((trigger - rect.top) / Math.max(1, range));
      item.style.setProperty("--career-item-progress", itemProgress.toFixed(4));
    });
  }

  function syncDesktopRoute() {
    const rowHeight = Math.max(540, wrap.clientHeight - 12);
    const rowGap = Math.max(88, Math.round(wrap.clientHeight * 0.18));
    const careerHeight = measureCareerHeight(rowHeight, rowGap);
    const lowerTop = Math.max(0, careerHeight - 1);

    let topX = 0;
    topPanels.forEach((panel, index) => {
      if (!(panel instanceof HTMLElement)) return;
      const blockHeight = panel === careerPanel ? careerHeight : rowHeight;
      panel.style.left = `${topX}px`;
      panel.style.top = "0px";
      panel.style.height = `${blockHeight}px`;
      topX += panel.offsetWidth - (index === topPanels.length - 1 ? 0 : 1);
    });

    let bottomX = topX;
    if (travelPanel instanceof HTMLElement) {
      const travelLeft = Math.max(0, careerPanel.offsetLeft + (careerPanel.offsetWidth - travelPanel.offsetWidth) / 2);
      travelPanel.style.left = `${travelLeft}px`;
      travelPanel.style.top = `${lowerTop}px`;
      travelPanel.style.height = `${rowHeight}px`;
      bottomX = travelLeft + travelPanel.offsetWidth;

      if (nextPanel instanceof HTMLElement) {
        nextPanel.style.left = `${bottomX - 1}px`;
        nextPanel.style.top = `${lowerTop}px`;
        nextPanel.style.height = `${rowHeight}px`;
        bottomX = nextPanel.offsetLeft + nextPanel.offsetWidth;
      }
    } else {
      lowerPanels.forEach((panel, index) => {
        if (!(panel instanceof HTMLElement)) return;
        panel.style.left = `${bottomX}px`;
        panel.style.top = `${lowerTop}px`;
        panel.style.height = `${rowHeight}px`;
        bottomX += panel.offsetWidth - (index === lowerPanels.length - 1 ? 0 : 1);
      });
    }

    const canvasWidth = Math.max(topX, bottomX, wrap.clientWidth);
    const canvasHeight = Math.max(careerHeight, lowerTop + rowHeight);
    track.style.width = `${canvasWidth}px`;
    track.style.height = `${canvasHeight}px`;

    routeState.maxCameraX = Math.max(0, canvasWidth - wrap.clientWidth);
    routeState.focusX = focusProgressForPanel(careerPanel);
    routeState.dropY = lowerTop;
    routeState.panelProgress = {
      intro: focusProgressForPanel(panelMap.get("intro")),
      skills: focusProgressForPanel(panelMap.get("skills")),
      career: routeState.focusX,
      travel: focusProgressForPanel(travelPanel) + routeState.dropY,
      next: focusProgressForPanel(nextPanel) + routeState.dropY
    };

    renderTravelIntro();
    renderCareerTimelineReveal();
  }

  function progressToCamera(progress) {
    const verticalStart = routeState.focusX;
    const verticalEnd = routeState.focusX + routeState.dropY;

    if (progress <= verticalStart) return { x: progress, y: 0 };
    if (progress <= verticalEnd) return { x: routeState.focusX, y: progress - verticalStart };

    return {
      x: clampCameraX(progress - routeState.dropY),
      y: routeState.dropY
    };
  }

  function routeDesktopDelta(delta) {
    if (delta !== 0) state.targetX = clamp(state.targetX + delta);
    startAnimation();
  }

  function syncBounds() {
    if (!isDesktop()) {
      state.maxX = 0;
      state.currentX = 0;
      state.targetX = 0;
      track.style.transform = "";
      clearDesktopTrackLayout();
      routeState.focusX = 0;
      routeState.dropY = 0;
      routeState.maxCameraX = 0;
      routeState.panelProgress = { intro: 0, skills: 0, career: 0, travel: 0, next: 0 };
      renderTravelIntro();
      renderCareerTimelineReveal();
      updateRevealGroups();
      return;
    }

    syncDesktopRoute();
    state.maxX = Math.max(0, routeState.maxCameraX + routeState.dropY);
    state.currentX = clamp(state.currentX);
    state.targetX = clamp(state.targetX);
  }

  function updateProgress() {
    const ratio = state.maxX > 0 ? state.currentX / state.maxX : 0;
    progress.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

    const wrapRect = wrap.getBoundingClientRect();
    const viewportCenter = wrapRect.left + wrapRect.width / 2;
    const edgeThreshold = 2;
    const isAtStart = state.currentX <= edgeThreshold;
    const isAtEnd = state.maxX - state.currentX <= edgeThreshold;
    let active = isAtEnd ? panels[panels.length - 1] : panels[0];
    let best = Number.POSITIVE_INFINITY;

    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(center - viewportCenter);
      panel.classList.toggle("is-near", distance < rect.width * 0.75);
      if (!isAtStart && !isAtEnd && distance < best) {
        best = distance;
        active = panel;
      }
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel === active);
    });

    state.activePanel = active?.getAttribute("data-panel") || "intro";
    updateRevealGroups();
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

    const camera = progressToCamera(state.currentX);
    track.style.transform = `translate3d(${-camera.x}px, ${-camera.y}px, 0)`;
    renderTravelIntro();
    renderCareerTimelineReveal();
    updateProgress();

    if (Math.abs(state.targetX - state.currentX) >= 0.2 || state.dragging) {
      state.raf = requestAnimationFrame(render);
      return;
    }
    state.raf = 0;
  }

  function startAnimation() {
    if (state.raf) return;
    state.raf = requestAnimationFrame(render);
  }

  function scrollToPanel(id) {
    const target = panelMap.get(id);
    if (!(target instanceof HTMLElement)) return;
    if (!isDesktop()) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    state.targetX = clamp(routeState.panelProgress[id] ?? 0);
    startAnimation();
  }

  const onWheel = (event) => {
    if (!isDesktop()) return;
    if (isLockedInteractiveTarget(event.target)) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    routeDesktopDelta(event.deltaY * 1.08);
  };

  const onKeyDown = (event) => {
    if (!isDesktop()) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      routeDesktopDelta(Math.round(wrap.clientWidth * 0.64));
    }
    if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      routeDesktopDelta(-Math.round(wrap.clientWidth * 0.64));
    }
  };

  const onMouseDown = (event) => {
    if (!isDesktop()) return;
    if (isLockedInteractiveTarget(event.target)) return;
    state.dragging = true;
    state.dragStartX = event.clientX;
    state.dragStartTarget = state.targetX;
    wrap.style.cursor = "grabbing";
    startAnimation();
  };

  const onMouseMove = (event) => {
    if (!state.dragging || !isDesktop()) return;
    const delta = event.clientX - state.dragStartX;
    state.targetX = clamp(state.dragStartTarget - delta);
  };

  const onMouseUp = () => {
    state.dragging = false;
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  };

  const onResize = () => {
    syncBounds();
    stopBrandLoop();
    buildBrandLoop();
    startBrandLoop();
    renderTravelIntro();
    renderCareerTimelineReveal();
    updateProgress();
    startAnimation();
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  };

  container.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href") || "";
      const id = href.slice(1);
      if (!id) return;
      if (!panelMap.get(id)) return;
      event.preventDefault();
      scrollToPanel(id);
    });
  });

  wrap.addEventListener("wheel", onWheel, { passive: false });
  wrap.addEventListener("mousedown", onMouseDown);
  wrap.addEventListener("mouseleave", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);

  buildBrandLoop();
  renderSignalEntry(activeShowcaseKey);
  startBrandLoop();
  syncBounds();
  updateProgress();
  wrap.style.cursor = isDesktop() ? "grab" : "auto";

  return () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    stopBrandLoop();
    window.clearTimeout(flashTimer);
    wrap.removeEventListener("wheel", onWheel);
    wrap.removeEventListener("mousedown", onMouseDown);
    wrap.removeEventListener("mouseleave", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
  };
}

async function renderAboutPage() {
  const container = document.querySelector(".about-container");
  if (!container) return;

  document.body.classList.remove("about-ready");
  destroyCurrentView();

  const response = await fetchJson("/api/about-config");
  const config = response?.config ?? {};
  const brandText = document.querySelector(".brand")?.textContent?.trim() || "Bitlog";
  const data = {
    skills: parseSkills(config.techStackJson),
    experience: parseExperience(config.timelineJson),
    places: parsePlaces(config.visitedPlacesJson),
    content: normalizeAboutPageContent(config.pageJson, brandText)
  };

  container.innerHTML = renderAboutApp(data);

  const scrollerCleanup = initHorizontalScroller(container, data);
  await mountHeatmap(data.places);

  const reloadButton = $("aboutHeatmapReload");
  const placeButtons = Array.from(container.querySelectorAll("[data-place]"));

  const onReload = () => {
    if (heatmapInstance && typeof heatmapInstance.destroy === "function") {
      heatmapInstance.destroy();
      heatmapInstance = null;
    }
    void mountHeatmap(data.places);
  };

  const onPlaceClick = (event) => {
    const button = event.currentTarget;
    const place = button.getAttribute("data-place") || "";
    container.querySelectorAll("[data-place].is-active").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    if (heatmapInstance && typeof heatmapInstance.focusPlace === "function") {
      heatmapInstance.focusPlace(place);
    }
  };

  reloadButton?.addEventListener("click", onReload);
  placeButtons.forEach((button) => button.addEventListener("click", onPlaceClick));

  currentCleanup = () => {
    scrollerCleanup();
    reloadButton?.removeEventListener("click", onReload);
    placeButtons.forEach((button) => button.removeEventListener("click", onPlaceClick));
  };

  document.body.classList.add("about-ready");
}

async function initAbout() {
  if (initRunning) return;
  if (document.body?.getAttribute?.("data-page") !== "about") return;

  initRunning = true;
  try {
    await renderAboutPage();
  } catch (error) {
    const container = document.querySelector(".about-container");
    if (container) {
      container.innerHTML = `<div class="about-horizontal-error">关于我页面加载失败：${escapeHtml(
        error?.message || String(error)
      )}</div>`;
    }
    document.body.classList.add("about-ready");
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
