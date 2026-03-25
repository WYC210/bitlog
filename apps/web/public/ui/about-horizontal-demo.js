(function () {
  const wrap = document.getElementById("demoScrollWrap");
  const track = document.getElementById("demoTrack");
  const progress = document.getElementById("demoProgressBar");
  if (!wrap || !track || !progress) return;

  const blocks = Array.from(document.querySelectorAll("[data-block]"));
  const navItems = Array.from(document.querySelectorAll(".demo-nav-item"));
  const brandBlock = document.querySelector(".demo-block-brand");
  const brandLaneElements = {
    top: document.querySelector('[data-brand-lane="top"]'),
    middle: document.querySelector('[data-brand-lane="middle"]'),
    bottom: document.querySelector('[data-brand-lane="bottom"]')
  };
  const echoBoard = document.getElementById("skillEchoBoard");
  const echoGlyph = document.getElementById("skillEchoGlyph");
  const echoName = document.getElementById("skillEchoName");
  const echoDesc = document.getElementById("skillEchoDesc");
  const echoRole = document.getElementById("skillEchoRole");
  const echoCue = document.getElementById("skillEchoCue");
  const echoUse = document.getElementById("skillEchoUse");
  const echoTail = document.getElementById("skillEchoTail");
  const careerBlock = document.querySelector(".demo-block-career");
  const careerStage = document.getElementById("careerStage");
  const careerHead = document.querySelector(".career-head");
  const careerScroll = document.querySelector(".career-z-scroll");
  const careerFlow = document.querySelector(".career-z-flow");
  const careerItems = Array.from(document.querySelectorAll("[data-career-item]"));
  const travelBlock = document.querySelector(".demo-block-travel-copy");
  const travelMapBlock = document.querySelector(".demo-block-travel-map");
  const travelMapSurface = document.getElementById("travelMapSurface");
  const nextBlock = document.querySelector(".demo-block-next-quote");
  const topRowGroups = new Set(["intro", "skills", "career"]);
  const bottomRowGroups = new Set(["travel", "next"]);

  const toneMap = {
    teal: {
      accent: "#47d4c4",
      soft: "#9bf1ff",
      halo: "rgba(71, 212, 196, 0.16)",
      ring: "rgba(71, 212, 196, 0.08)",
      line: "rgba(71, 212, 196, 0.34)",
      tail: "rgba(155, 241, 255, 0.56)",
      bars: ["34px", "62px", "94px", "48px"]
    },
    amber: {
      accent: "#f1b45f",
      soft: "#ffe3a7",
      halo: "rgba(241, 180, 95, 0.16)",
      ring: "rgba(241, 180, 95, 0.08)",
      line: "rgba(241, 180, 95, 0.34)",
      tail: "rgba(255, 227, 167, 0.56)",
      bars: ["26px", "70px", "88px", "54px"]
    },
    coral: {
      accent: "#f08c6c",
      soft: "#ffd0c2",
      halo: "rgba(240, 140, 108, 0.16)",
      ring: "rgba(240, 140, 108, 0.08)",
      line: "rgba(240, 140, 108, 0.34)",
      tail: "rgba(255, 208, 194, 0.56)",
      bars: ["30px", "58px", "102px", "42px"]
    },
    sky: {
      accent: "#68a8ff",
      soft: "#bcd4ff",
      halo: "rgba(104, 168, 255, 0.16)",
      ring: "rgba(104, 168, 255, 0.08)",
      line: "rgba(104, 168, 255, 0.34)",
      tail: "rgba(188, 212, 255, 0.56)",
      bars: ["38px", "54px", "92px", "60px"]
    },
    lime: {
      accent: "#8ecf67",
      soft: "#daf0ba",
      halo: "rgba(142, 207, 103, 0.16)",
      ring: "rgba(142, 207, 103, 0.08)",
      line: "rgba(142, 207, 103, 0.34)",
      tail: "rgba(218, 240, 186, 0.56)",
      bars: ["24px", "66px", "84px", "52px"]
    },
    violet: {
      accent: "#9f8cff",
      soft: "#ddd2ff",
      halo: "rgba(159, 140, 255, 0.16)",
      ring: "rgba(159, 140, 255, 0.08)",
      line: "rgba(159, 140, 255, 0.34)",
      tail: "rgba(221, 210, 255, 0.56)",
      bars: ["36px", "60px", "98px", "46px"]
    }
  };

  const skillEchoMap = {
    openai: {
      glyph: "◎",
      name: "OpenAI",
      desc: "偏向通用推理和产品接口层。它靠近边缘时，右侧就把“通用能力底座”这件事直接抬上来。",
      role: "Foundation API",
      cue: "General Reasoning",
      use: "Product Layer",
      tail: "OPENAI · FOUNDATION API · PRODUCT LAYER",
      tone: "teal"
    },
    claude: {
      glyph: "✦",
      name: "Claude",
      desc: "更像长文本协作和结构整理的伙伴。靠近分界线时，右侧回应的是“整理、推敲、压缩复杂度”。",
      role: "Long-context Partner",
      cue: "Structured Thinking",
      use: "Writing Workflow",
      tail: "CLAUDE · LONG CONTEXT · WRITING WORKFLOW",
      tone: "amber"
    },
    gemini: {
      glyph: "◌",
      name: "Gemini",
      desc: "偏向多模态入口。它进入边缘时，右侧回声会更轻、更开放，像一个多源输入的汇聚点。",
      role: "Multimodal Entry",
      cue: "Mixed Input",
      use: "Search + Media",
      tail: "GEMINI · MULTIMODAL ENTRY · SEARCH AND MEDIA",
      tone: "sky"
    },
    rest: {
      glyph: "{ }",
      name: "REST",
      desc: "不是模型，而是连接方式本身。它出现时，右侧提醒这整套能力最终仍要落回清晰的接口契约。",
      role: "Interface Contract",
      cue: "Transport Layer",
      use: "Service Boundary",
      tail: "REST · INTERFACE CONTRACT · SERVICE BOUNDARY",
      tone: "violet"
    },
    github: {
      glyph: "⌘",
      name: "GitHub",
      desc: "版本协作、自动化和发布路径都落在这里。它靠近边界时，右侧像是把“工程闭环”拉了出来。",
      role: "Source Hub",
      cue: "Ship Flow",
      use: "CI / Review",
      tail: "GITHUB · SOURCE HUB · CI REVIEW",
      tone: "teal"
    },
    cloudflare: {
      glyph: "◔",
      name: "Cloudflare",
      desc: "更像边缘侧的运行场。它来到边缘时，右侧回应的是速度、分发和全球触达。",
      role: "Edge Runtime",
      cue: "Global Reach",
      use: "Deploy Surface",
      tail: "CLOUDFLARE · EDGE RUNTIME · DEPLOY SURFACE",
      tone: "amber"
    },
    deepseek: {
      glyph: "△",
      name: "DeepSeek",
      desc: "更偏分析与替代思路。进入边缘时，右侧像是在提示：这里有另一种推理气质。",
      role: "Reasoning Alt",
      cue: "Alternative Path",
      use: "Fallback Brain",
      tail: "DEEPSEEK · REASONING ALT · FALLBACK BRAIN",
      tone: "coral"
    },
    qwen: {
      glyph: "Q",
      name: "Qwen",
      desc: "更适合进入本地或国产生态的工作流。它靠近边缘时，右侧回应的是“兼容”和“接入”这两个词。",
      role: "Ecosystem Fit",
      cue: "Compatible Link",
      use: "Local Stack",
      tail: "QWEN · ECOSYSTEM FIT · LOCAL STACK",
      tone: "lime"
    },
    ollama: {
      glyph: "◐",
      name: "Ollama",
      desc: "本地模型运行层。它靠近边缘时，右侧不再堆更多标签，而是把“本地推理”这个气质直接放大出来。",
      role: "Local Runtime",
      cue: "Edge-first",
      use: "Offline Workflow",
      tail: "OLLAMA · EDGE RESPONSE · LOCAL LOOP",
      tone: "teal"
    },
    perplexity: {
      glyph: "●",
      name: "Perplexity",
      desc: "更接近答案聚合与检索回传。它来到边缘时，右侧像是一束更快的搜索回声。",
      role: "Answer Search",
      cue: "Fast Retrieval",
      use: "Research Loop",
      tail: "PERPLEXITY · ANSWER SEARCH · RESEARCH LOOP",
      tone: "sky"
    },
    workers: {
      glyph: "W",
      name: "Workers",
      desc: "这是把能力真正跑起来的薄层执行环境。它靠近边缘时，右侧强调的是“落地执行”。",
      role: "Thin Runtime",
      cue: "Execution Edge",
      use: "Request Handling",
      tail: "WORKERS · THIN RUNTIME · REQUEST HANDLING",
      tone: "amber"
    },
    react: {
      glyph: "⚛",
      name: "React",
      desc: "最终这些能力还是要进入界面。它靠近边缘时，右侧回应的是组件、交互和视图编排。",
      role: "UI Engine",
      cue: "View Layer",
      use: "Interactive Surface",
      tail: "REACT · UI ENGINE · INTERACTIVE SURFACE",
      tone: "sky"
    },
    markdown: {
      glyph: "M↓",
      name: "Markdown",
      desc: "内容系统的入口格式。它来到边缘时，右侧像是把所有表达重新收束到文本本身。",
      role: "Content Format",
      cue: "Authoring First",
      use: "Writing Surface",
      tail: "MARKDOWN · CONTENT FORMAT · WRITING SURFACE",
      tone: "lime"
    },
    rehype: {
      glyph: "R",
      name: "Rehype",
      desc: "它代表内容管线中的结构转换。靠近边缘时，右侧回应的是“解析后如何呈现”。",
      role: "Render Pipeline",
      cue: "Structure Shift",
      use: "HTML Transform",
      tail: "REHYPE · RENDER PIPELINE · HTML TRANSFORM",
      tone: "violet"
    },
    prisma: {
      glyph: "P",
      name: "Prisma",
      desc: "数据模型和访问方式的稳定层。它出现时，右侧把注意力拉回到 schema 和演进。",
      role: "Data Model",
      cue: "Schema Layer",
      use: "Structured Store",
      tail: "PRISMA · DATA MODEL · STRUCTURED STORE",
      tone: "coral"
    },
    d1: {
      glyph: "D1",
      name: "D1",
      desc: "它代表轻量数据库与边缘数据的落点。靠近边缘时，右侧会更像一个存储节点被点亮。",
      role: "Edge Storage",
      cue: "Persist State",
      use: "SQLite Edge",
      tail: "D1 · EDGE STORAGE · SQLITE EDGE",
      tone: "amber"
    },
    telemetry: {
      glyph: "◒",
      name: "Telemetry",
      desc: "不是用户能直接看到的层，但它决定你是否知道页面到底发生了什么。",
      role: "Signal Trace",
      cue: "Observe State",
      use: "Insight Loop",
      tail: "TELEMETRY · SIGNAL TRACE · INSIGHT LOOP",
      tone: "violet"
    },
    design: {
      glyph: "✎",
      name: "Design",
      desc: "最后一层是感受。它来到边缘时，右侧回应的是节奏、留白和视觉判断本身。",
      role: "Visual Judgement",
      cue: "Editorial Tone",
      use: "Reading Rhythm",
      tail: "DESIGN · VISUAL JUDGEMENT · READING RHYTHM",
      tone: "coral"
    }
  };

  const brandBootstrap = {
    top: ["openai", "claude", "gemini", "rest", "github", "cloudflare"],
    middle: ["deepseek", "qwen", "ollama", "perplexity", "workers", "react"],
    bottom: ["markdown", "rehype", "prisma", "d1", "telemetry", "design"]
  };

  const isDesktop = () => window.matchMedia("(min-width: 1081px)").matches;

  const state = {
    currentX: 0,
    targetX: 0,
    maxX: 0,
    raf: 0,
    dragging: false,
    dragStartX: 0,
    dragStartTarget: 0,
    activeGroup: ""
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
    edgeThreshold: 46,
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
    raf: 0,
    lastTime: 0
  };

  const careerState = {
    focusX: 0,
    dropY: 0,
    maxCameraX: 0,
    travelMapProgress: 0,
    groupProgress: {
      intro: 0,
      skills: 0,
      career: 0,
      travel: 0,
      next: 0
    }
  };

  let brandLinks = [];
  let activeSkillKey = "ollama";
  let activeBrandLink = null;
  let flashTimer = 0;

  function clamp(value) {
    return Math.max(0, Math.min(state.maxX, value));
  }

  function clampCameraX(value) {
    return Math.max(0, Math.min(careerState.maxCameraX, value));
  }

  function clampUnit(value) {
    return Math.max(0, Math.min(1, value));
  }

  function easeOutBack(value) {
    const x = clampUnit(value);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function focusProgressForBlock(block) {
    if (!(block instanceof HTMLElement)) return 0;
    return clampCameraX(block.offsetLeft - Math.max(0, (wrap.clientWidth - block.offsetWidth) / 2));
  }

  function clearDesktopTrackLayout() {
    track.style.width = "";
    track.style.height = "";
    blocks.forEach((block) => {
      block.style.left = "";
      block.style.top = "";
      block.style.height = "";
    });
  }

  function measureCareerHeight(rowHeight, rowGap) {
    if (
      !(careerBlock instanceof HTMLElement) ||
      !(careerStage instanceof HTMLElement) ||
      !(careerHead instanceof HTMLElement) ||
      !(careerScroll instanceof HTMLElement) ||
      !(careerFlow instanceof HTMLElement)
    ) {
      return rowHeight + rowGap;
    }

    const boardStyles = window.getComputedStyle(careerBlock.querySelector(".career-board") || careerBlock);
    const stageStyles = window.getComputedStyle(careerStage);
    const scrollStyles = window.getComputedStyle(careerScroll);

    const boardPaddingY =
      (Number.parseFloat(boardStyles.paddingTop) || 0) +
      (Number.parseFloat(boardStyles.paddingBottom) || 0);
    const stageGap = Number.parseFloat(stageStyles.rowGap || stageStyles.gap) || 0;
    const scrollPaddingY =
      (Number.parseFloat(scrollStyles.paddingTop) || 0) +
      (Number.parseFloat(scrollStyles.paddingBottom) || 0);

    const naturalHeight =
      boardPaddingY +
      careerHead.offsetHeight +
      stageGap +
      scrollPaddingY +
      careerFlow.scrollHeight;

    return Math.max(rowHeight + rowGap, Math.ceil(naturalHeight));
  }

  function syncCareerBounds() {
    if (!isDesktop()) {
      careerState.focusX = 0;
      careerState.dropY = 0;
      careerState.maxCameraX = 0;
      careerState.travelMapProgress = 0;
      careerState.groupProgress = { intro: 0, skills: 0, career: 0, travel: 0, next: 0 };
      clearDesktopTrackLayout();
      renderTravelIntro();
      return;
    }

    const rowHeight = Math.max(520, wrap.clientHeight - 14);
    const rowGap = Math.max(88, Math.round(wrap.clientHeight * 0.18));
    const topBlocks = blocks.filter((block) => topRowGroups.has(block.getAttribute("data-group") || ""));
    const bottomBlocks = blocks.filter((block) => bottomRowGroups.has(block.getAttribute("data-group") || ""));
    const careerHeight = measureCareerHeight(rowHeight, rowGap);
    const lowerTop = Math.max(0, careerHeight - rowHeight);

    let topX = 0;
    topBlocks.forEach((block, index) => {
      const group = block.getAttribute("data-group") || "";
      const blockHeight = group === "career" ? careerHeight : rowHeight;
      block.style.left = `${topX}px`;
      block.style.top = "0px";
      block.style.height = `${blockHeight}px`;
      topX += block.offsetWidth - (index === topBlocks.length - 1 ? 0 : 1);
    });

    const lowerStartX =
      careerBlock instanceof HTMLElement
        ? careerBlock.offsetLeft + careerBlock.offsetWidth - 1
        : 0;
    let bottomX = lowerStartX;
    bottomBlocks.forEach((block, index) => {
      block.style.left = `${bottomX}px`;
      block.style.top = `${lowerTop}px`;
      block.style.height = `${rowHeight}px`;
      bottomX += block.offsetWidth - (index === bottomBlocks.length - 1 ? 0 : 1);
    });

    const canvasWidth = Math.max(topX, bottomX, wrap.clientWidth);
    const canvasHeight = Math.max(careerHeight, lowerTop + rowHeight);
    track.style.width = `${canvasWidth}px`;
    track.style.height = `${canvasHeight}px`;

    careerState.maxCameraX = Math.max(0, canvasWidth - wrap.clientWidth);
    careerState.focusX = focusProgressForBlock(careerBlock);
    careerState.dropY = lowerTop;
    careerState.travelMapProgress = focusProgressForBlock(travelMapBlock) + careerState.dropY;
    careerState.groupProgress = {
      intro: focusProgressForBlock(document.querySelector('[data-group="intro"]')),
      skills: focusProgressForBlock(document.querySelector('[data-group="skills"]')),
      career: careerState.focusX,
      travel: focusProgressForBlock(travelBlock) + careerState.dropY,
      next: focusProgressForBlock(nextBlock) + careerState.dropY
    };
    renderTravelIntro();
    renderCareerTimelineReveal();
  }

  function progressToCamera(progress) {
    const verticalStart = careerState.focusX;
    const verticalEnd = careerState.focusX + careerState.dropY;

    if (progress <= verticalStart) {
      return { x: progress, y: 0 };
    }

    if (progress <= verticalEnd) {
      return { x: careerState.focusX, y: progress - verticalStart };
    }

    return {
      x: clampCameraX(progress - careerState.dropY),
      y: careerState.dropY
    };
  }

  function routeDesktopDelta(delta) {
    if (delta !== 0) {
      state.targetX = clamp(state.targetX + delta);
    }
    startAnimation();
  }

  function renderTravelIntro() {
    if (!(travelMapSurface instanceof HTMLElement)) return;

    if (!isDesktop() || careerState.travelMapProgress <= 0) {
      travelMapSurface.style.setProperty("--travel-intro", "1");
      travelMapSurface.style.setProperty("--travel-pop", "1");
      return;
    }

    const start = careerState.travelMapProgress - wrap.clientWidth * 0.34;
    const end = careerState.travelMapProgress + wrap.clientWidth * 0.08;
    const raw = clampUnit((state.currentX - start) / Math.max(1, end - start));
    const pop = easeOutBack(raw);

    travelMapSurface.style.setProperty("--travel-intro", raw.toFixed(4));
    travelMapSurface.style.setProperty("--travel-pop", pop.toFixed(4));
  }

  function renderCareerTimelineReveal() {
    if (!careerItems.length) return;

    if (!isDesktop()) {
      careerItems.forEach((item) => {
        if (item instanceof HTMLElement) {
          item.style.setProperty("--career-item-progress", "1");
        }
      });
      return;
    }

    const wrapRect = wrap.getBoundingClientRect();
    const trigger = wrapRect.bottom - wrapRect.height * 0.12;
    const range = wrapRect.height * 0.42;

    careerItems.forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const rect = item.getBoundingClientRect();
      const progress = clampUnit((trigger - rect.top) / Math.max(1, range));
      item.style.setProperty("--career-item-progress", progress.toFixed(4));
    });
  }

  function applyEchoTone(toneKey) {
    if (!echoBoard) return;
    const tone = toneMap[toneKey] || toneMap.teal;
    echoBoard.style.setProperty("--echo-accent", tone.accent);
    echoBoard.style.setProperty("--echo-accent-soft", tone.soft);
    echoBoard.style.setProperty("--echo-halo", tone.halo);
    echoBoard.style.setProperty("--echo-ring", tone.ring);
    echoBoard.style.setProperty("--echo-line", tone.line);
    echoBoard.style.setProperty("--echo-tail", tone.tail);
    echoBoard.style.setProperty("--echo-bar-a", tone.bars[0]);
    echoBoard.style.setProperty("--echo-bar-b", tone.bars[1]);
    echoBoard.style.setProperty("--echo-bar-c", tone.bars[2]);
    echoBoard.style.setProperty("--echo-bar-d", tone.bars[3]);
  }

  function applyBrandState(currentLink) {
    brandLinks.forEach((link) => {
      link.classList.remove("is-current", "is-dimmed");
    });
  }

  function renderSkillEcho(skillKey, currentLink) {
    const entry = skillEchoMap[skillKey] || skillEchoMap.ollama;
    applyEchoTone(entry.tone);
    if (echoGlyph) echoGlyph.textContent = entry.glyph;
    if (echoName) echoName.textContent = entry.name;
    if (echoDesc) echoDesc.textContent = entry.desc;
    if (echoRole) echoRole.textContent = entry.role;
    if (echoCue) echoCue.textContent = entry.cue;
    if (echoUse) echoUse.textContent = entry.use;
    if (echoTail) echoTail.textContent = entry.tail;
    applyBrandState(currentLink);

    if (echoBoard) {
      echoBoard.classList.remove("is-flashing");
      window.clearTimeout(flashTimer);
      echoBoard.offsetWidth;
      echoBoard.classList.add("is-flashing");
      flashTimer = window.setTimeout(() => {
        echoBoard.classList.remove("is-flashing");
      }, 140);
    }
  }

  function createBrandItem(key) {
    const entry = skillEchoMap[key];
    const element = document.createElement("span");
    element.className = "brand-link";
    element.setAttribute("data-skill-key", key);

    const glyph = document.createElement("span");
    glyph.className = "brand-glyph";
    glyph.textContent = entry?.glyph || "•";

    const name = document.createElement("span");
    name.className = "brand-name";
    name.textContent = entry?.name || key;

    element.append(glyph, name);

    return {
      key,
      lane: "middle",
      x: 0,
      width: 0,
      element
    };
  }

  function renderBrandItem(item) {
    item.element.style.transform = `translate3d(${item.x}px, -50%, 0)`;
  }

  function mountLane(laneKey, keys, startX) {
    const laneElement = brandLaneElements[laneKey];
    if (!(laneElement instanceof HTMLElement)) return;

    let nextX = startX;
    keys.forEach((key) => {
      const item = createBrandItem(key);
      item.lane = laneKey;
      laneElement.appendChild(item.element);
      item.width = item.element.getBoundingClientRect().width;
      item.x = nextX;
      nextX += item.width + brandState.gap;
      renderBrandItem(item);
      brandState.items.push(item);
      brandState.lanes[laneKey].push(item);
      brandLinks.push(item.element);
    });
  }

  function buildBrandLoop() {
    const lanes = Object.values(brandLaneElements);
    if (lanes.some((lane) => !(lane instanceof HTMLElement))) return;

    brandState.items = [];
    brandState.lanes.top = [];
    brandState.lanes.middle = [];
    brandState.lanes.bottom = [];
    brandState.outerTurn = 0;
    brandLinks = [];

    lanes.forEach((lane) => {
      lane.innerHTML = "";
    });

    const middleWidth = brandLaneElements.middle?.clientWidth || 0;
    mountLane("top", brandBootstrap.top, 8);
    mountLane("middle", brandBootstrap.middle, -Math.max(150, middleWidth * 0.24));
    mountLane("bottom", brandBootstrap.bottom, 18);

    activeBrandLink =
      brandState.lanes.middle.find((item) => item.key === activeSkillKey)?.element ||
      brandState.lanes.middle[0]?.element ||
      null;
    renderSkillEcho(activeSkillKey, activeBrandLink);
  }

  function removeLaneItem(laneKey, item) {
    brandState.lanes[laneKey] = brandState.lanes[laneKey].filter((laneItem) => laneItem !== item);
  }

  function getLaneRightEdge(laneKey) {
    const laneElement = brandLaneElements[laneKey];
    return laneElement instanceof HTMLElement ? laneElement.clientWidth : 0;
  }

  function moveItemToLane(item, targetLane) {
    const targetElement = brandLaneElements[targetLane];
    if (!(targetElement instanceof HTMLElement)) return;

    removeLaneItem(item.lane, item);
    targetElement.appendChild(item.element);
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
    renderBrandItem(item);
  }

  function updateSkillEcho() {
    const middleItems = brandState.lanes.middle;
    if (!isDesktop() || !(brandBlock instanceof HTMLElement) || !middleItems.length) {
      applyBrandState(null);
      return;
    }

    const seamX = brandBlock.getBoundingClientRect().right;
    let closestItem = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    middleItems.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(center - seamX);
      if (distance < bestDistance) {
        bestDistance = distance;
        closestItem = item;
      }
    });

    if (!closestItem) {
      applyBrandState(null);
      return;
    }

    const triggerThreshold = Math.min(brandState.edgeThreshold, Math.max(26, closestItem.width * 0.26));
    const withinTriggerZone = bestDistance <= triggerThreshold;
    applyBrandState(withinTriggerZone ? closestItem.element : null);

    if (!withinTriggerZone) return;

    const nextKey = closestItem.key;
    const nextLink = closestItem.element;
    if (nextKey !== activeSkillKey || nextLink !== activeBrandLink) {
      activeSkillKey = nextKey;
      activeBrandLink = nextLink;
      renderSkillEcho(activeSkillKey, activeBrandLink);
    }
  }

  function tickBrandLoop(now) {
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

    transfers.forEach(({ item, targetLane }) => {
      moveItemToLane(item, targetLane);
    });

    brandState.items.forEach((item) => {
      renderBrandItem(item);
    });

    updateSkillEcho();
    brandState.raf = window.requestAnimationFrame(tickBrandLoop);
  }

  function ensureBrandLoop() {
    if (brandState.raf) return;
    brandState.lastTime = 0;
    brandState.raf = window.requestAnimationFrame(tickBrandLoop);
  }

  function syncBounds() {
    if (!isDesktop()) {
      state.maxX = 0;
      state.currentX = 0;
      state.targetX = 0;
      track.style.transform = "";
      syncCareerBounds();
      return;
    }

    syncCareerBounds();
    state.maxX = Math.max(0, careerState.maxCameraX + careerState.dropY);
    state.currentX = clamp(state.currentX);
    state.targetX = clamp(state.targetX);
  }

  function updateProgress() {
    const ratio = state.maxX > 0 ? state.currentX / state.maxX : 0;
    progress.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

    const wrapRect = wrap.getBoundingClientRect();
    const viewportCenter = wrapRect.left + wrapRect.width / 2;
    let activeBlock = blocks[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    blocks.forEach((block) => {
      const rect = block.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(center - viewportCenter);
      block.classList.toggle("is-near", distance < rect.width * 0.9);
      if (distance < bestDistance) {
        bestDistance = distance;
        activeBlock = block;
      }
    });

    blocks.forEach((block) => {
      block.classList.toggle("is-active", block === activeBlock);
    });

    const activeGroup = activeBlock ? activeBlock.getAttribute("data-group") || "" : "";
    state.activeGroup = activeGroup;
    navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.target === activeGroup);
    });
  }

  function scrollToGroup(group) {
    const target = document.querySelector(`[data-group="${group}"]`);
    if (!(target instanceof HTMLElement)) return;

    if (!isDesktop()) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    state.targetX = clamp(careerState.groupProgress[group] ?? 0);
    startAnimation();
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

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const group = item.dataset.target;
      if (!group) return;
      scrollToGroup(group);
    });
  });

  wrap.addEventListener(
    "wheel",
    (event) => {
      if (!isDesktop()) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      routeDesktopDelta(event.deltaY * 1.08);
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if (!isDesktop()) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      routeDesktopDelta(Math.round(wrap.clientWidth * 0.64));
    }
    if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      routeDesktopDelta(-Math.round(wrap.clientWidth * 0.64));
    }
  });

  wrap.addEventListener("mousedown", (event) => {
    if (!isDesktop()) return;
    state.dragging = true;
    state.dragStartX = event.clientX;
    state.dragStartTarget = state.targetX;
    wrap.style.cursor = "grabbing";
    startAnimation();
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.dragging || !isDesktop()) return;
    const delta = event.clientX - state.dragStartX;
    state.targetX = clamp(state.dragStartTarget - delta);
  });

  window.addEventListener("mouseup", () => {
    state.dragging = false;
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  });

  wrap.addEventListener("mouseleave", () => {
    if (!state.dragging) return;
    state.dragging = false;
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  });

  window.addEventListener("resize", () => {
    syncBounds();
    buildBrandLoop();
    updateProgress();
    updateSkillEcho();
    startAnimation();
    wrap.style.cursor = isDesktop() ? "grab" : "auto";
  });

  buildBrandLoop();
  ensureBrandLoop();
  syncBounds();
  updateProgress();
  updateSkillEcho();
  wrap.style.cursor = isDesktop() ? "grab" : "auto";
})();
