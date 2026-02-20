# Glassmorphism Widget System - 设计文档

## 🎨 设计概述

基于你提供的参考图片，我重新设计了一个采用 **Glassmorphism（玻璃态）** 风格的小组件系统。这是一个现代化的设计风格，具有以下特点：

### 核心特性
- ✨ **毛玻璃效果** - 半透明背景 + 背景模糊
- 🌈 **渐变背景** - 紫色到粉色的渐变背景
- 💎 **光泽效果** - 悬停时的光线扫过动画
- 🎯 **深度层次** - 多层次的视觉深度
- 🔄 **流畅动画** - 平滑的过渡和交互效果

## 📁 文件结构

```
apps/web/public/
├── ui/
│   ├── base.css                    # 基础样式（已存在）
│   ├── dashboard-widgets.css       # 新增：Glassmorphism 组件样式
│   └── widgets.js                  # 原有的组件逻辑
├── _templates/
│   └── home.html                   # 已更新：集成 Glassmorphism 组件
└── dashboard.html                  # 新增：完整的 Dashboard 示例页面
```

## 🎨 设计系统

### 1. 配色方案

```css
/* 渐变背景 */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* 玻璃效果 */
--glass-bg: rgba(255, 255, 255, 0.1);
--glass-border: rgba(255, 255, 255, 0.2);
--glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
--glass-blur: 12px;

/* 暗色模式 */
[data-theme="dark"] {
  --glass-bg: rgba(30, 41, 59, 0.7);
  --glass-border: rgba(148, 163, 184, 0.2);
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}
```

### 2. 字体系统

基于 UI/UX Pro Max 推荐：

- **标题字体**: Fira Code - 适合技术/数据展示
- **正文字体**: Fira Sans - 清晰易读

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### 3. 组件样式

#### Glass Card 基础样式
```css
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 24px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### 悬停效果
```css
.glass-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 16px 48px 0 rgba(31, 38, 135, 0.5);
  border-color: rgba(255, 255, 255, 0.3);
}
```

#### 光线扫过动画
```css
.glass-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transition: left 0.5s ease;
}

.glass-card:hover::before {
  left: 100%;
}
```

## 🧩 组件类型

### 1. 天气卡片 (Weather Card)

**特点**:
- 大号温度显示（56px）
- 天气图标（64px emoji）
- 三列详细信息（湿度、风速、紫外线）

**使用场景**: 显示实时天气信息

```html
<div class="glass-card">
  <div class="glass-card-header">
    <h3 class="glass-card-title">
      <div class="glass-card-icon"><!-- SVG --></div>
      天气
    </h3>
    <span class="glass-card-badge">实时</span>
  </div>
  <div class="glass-card-body">
    <div class="weather-card-main">
      <div class="weather-card-icon">☀️</div>
      <div>
        <div class="weather-card-temp">22°</div>
        <div class="weather-card-desc">晴朗 · 空气良好</div>
      </div>
    </div>
    <div class="weather-card-details">
      <!-- 详细信息 -->
    </div>
  </div>
</div>
```

### 2. 统计卡片 (Stats Card)

**特点**:
- 大号数字（48px，Fira Code 字体）
- 渐变文字效果
- 变化趋势指示器（正/负）

**使用场景**: 显示关键指标

```html
<div class="glass-card">
  <div class="glass-card-header">
    <h3 class="glass-card-title">
      <div class="glass-card-icon"><!-- SVG --></div>
      文章总数
    </h3>
  </div>
  <div class="glass-card-body">
    <div class="stat-card-value">42</div>
    <div class="stat-card-label">已发布文章</div>
    <div class="stat-card-change positive">
      <svg><!-- 箭头 --></svg>
      +12% 本月
    </div>
  </div>
</div>
```

### 3. 列表卡片 (List Card)

**特点**:
- 图标 + 标题 + 副标题布局
- 悬停时向右滑动
- 半透明背景

**使用场景**: GitHub 趋势、新闻列表

```html
<div class="glass-card">
  <div class="glass-card-header">
    <h3 class="glass-card-title">
      <div class="glass-card-icon"><!-- SVG --></div>
      GitHub 趋势
    </h3>
    <span class="glass-card-badge">3</span>
  </div>
  <div class="glass-card-body">
    <div class="glass-list">
      <a href="#" class="glass-list-item">
        <div class="glass-list-item-icon"><!-- SVG --></div>
        <div class="glass-list-item-content">
          <div class="glass-list-item-title">项目名称</div>
          <div class="glass-list-item-subtitle">
            <span>语言</span>
            <span>•</span>
            <span>描述</span>
          </div>
        </div>
        <div class="glass-list-item-meta">⭐ 2.3k</div>
      </a>
    </div>
  </div>
</div>
```

### 4. 进度卡片 (Progress Card)

**特点**:
- 进度条带闪光动画
- 渐变填充效果
- 百分比显示

**使用场景**: 项目进度、任务完成度

```html
<div class="glass-card">
  <div class="glass-card-header">
    <h3 class="glass-card-title">
      <div class="glass-card-icon"><!-- SVG --></div>
      项目进度
    </h3>
  </div>
  <div class="glass-card-body">
    <div class="progress-card-item">
      <div class="progress-card-header">
        <span class="progress-card-label">博客重构</span>
        <span class="progress-card-value">85%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width: 85%"></div>
      </div>
    </div>
  </div>
</div>
```

### 5. 活动流卡片 (Activity Feed Card)

**特点**:
- 时间线布局
- 图标 + 内容 + 时间
- 连接线效果

**使用场景**: 最近活动、操作记录

```html
<div class="glass-card">
  <div class="glass-card-header">
    <h3 class="glass-card-title">
      <div class="glass-card-icon"><!-- SVG --></div>
      最近活动
    </h3>
  </div>
  <div class="glass-card-body">
    <div class="activity-feed">
      <div class="activity-item">
        <div class="activity-icon"><!-- SVG --></div>
        <div class="activity-content">
          <div class="activity-title">发布新文章</div>
          <div class="activity-time">2小时前</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## 🎯 交互效果

### 1. 悬停动画

```css
/* 卡片悬停 */
.glass-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 16px 48px 0 rgba(31, 38, 135, 0.5);
}

/* 列表项悬停 */
.glass-list-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(4px);
}

/* 按钮悬停 */
.glass-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}
```

### 2. 加载动画

```css
/* 进度条闪光 */
@keyframes progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-bar-fill::after {
  animation: progress-shimmer 2s infinite;
}
```

### 3. 入场动画

```javascript
// 卡片依次淡入
cards.forEach((card, index) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';

  setTimeout(() => {
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }, index * 100);
});
```

## 📱 响应式设计

### 断点设置

```css
/* 桌面端 */
.dashboard-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

/* 平板端 (< 768px) */
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .glass-card {
    padding: 20px;
  }
}

/* 移动端 (< 640px) */
@media (max-width: 640px) {
  .stat-card-value {
    font-size: 36px;
  }

  .weather-card-temp {
    font-size: 42px;
  }
}
```

## ♿ 无障碍支持

### 1. 键盘导航

```css
.glass-card:focus-visible,
.glass-list-item:focus-visible,
.glass-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 4px;
}
```

### 2. 减少动画

```css
@media (prefers-reduced-motion: reduce) {
  .glass-card,
  .glass-list-item,
  .glass-btn {
    transition: none;
  }

  .glass-card:hover {
    transform: none;
  }

  .progress-bar-fill::after {
    animation: none;
  }
}
```

### 3. 颜色对比度

- 文字颜色: `rgba(255, 255, 255, 0.95)` - 对比度 > 4.5:1
- 副标题颜色: `rgba(255, 255, 255, 0.7)` - 对比度 > 3:1
- 边框颜色: `rgba(255, 255, 255, 0.2)` - 清晰可见

## 🚀 使用方法

### 1. 引入样式

在 `home.html` 中：

```html
<link rel="stylesheet" href="/ui/base.css?__cv={{CACHE_VERSION}}" />
<link rel="stylesheet" href="/ui/dashboard-widgets.css?__cv={{CACHE_VERSION}}" />
```

### 2. 添加组件

```html
<aside>
  <div class="dashboard-grid" style="grid-template-columns: 1fr; gap: 20px;">
    <!-- 天气卡片 -->
    <div class="glass-card">...</div>

    <!-- 统计卡片 -->
    <div class="glass-card">...</div>

    <!-- GitHub 趋势 -->
    <div class="glass-card">...</div>

    <!-- 新闻卡片 -->
    <div class="glass-card">...</div>
  </div>
</aside>
```

### 3. 添加动画脚本

```html
<script>
  (function () {
    const cards = document.querySelectorAll('.glass-card');

    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';

      setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 100);
    });
  })();
</script>
```

## 🎨 自定义主题

### 修改背景渐变

```css
.dashboard-container {
  /* 默认：紫色到粉色 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  /* 蓝色到青色 */
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

  /* 橙色到粉色 */
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);

  /* 绿色到蓝色 */
  background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
}
```

### 修改玻璃透明度

```css
:root {
  /* 更透明 */
  --glass-bg: rgba(255, 255, 255, 0.05);

  /* 更不透明 */
  --glass-bg: rgba(255, 255, 255, 0.15);

  /* 调整模糊程度 */
  --glass-blur: 8px;  /* 更清晰 */
  --glass-blur: 16px; /* 更模糊 */
}
```

### 修改圆角大小

```css
:root {
  /* 更圆润 */
  --card-radius: 24px;

  /* 更方正 */
  --card-radius: 12px;
}
```

## 📊 性能优化

### 1. GPU 加速

```css
.glass-card {
  /* 使用 transform 和 opacity 触发 GPU 加速 */
  transform: translateZ(0);
  will-change: transform, opacity;
}
```

### 2. 减少重绘

```css
/* 使用 transform 代替 top/left */
.glass-card:hover {
  transform: translateY(-8px); /* ✓ 好 */
  /* top: -8px; */ /* ✗ 差 */
}
```

### 3. 懒加载

```javascript
// 使用 IntersectionObserver 延迟加载卡片
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
});

cards.forEach(card => observer.observe(card));
```

## 🔧 API 集成

### 天气 API

```javascript
async function fetchWeather() {
  const response = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Beijing&appid=YOUR_KEY');
  const data = await response.json();

  // 更新 DOM
  document.querySelector('.weather-card-temp').textContent = `${Math.round(data.main.temp)}°`;
  document.querySelector('.weather-card-icon').textContent = getWeatherIcon(data.weather[0].icon);
}
```

### GitHub API

```javascript
async function fetchGitHubTrending() {
  const response = await fetch('https://api.github.com/search/repositories?q=stars:>1000&sort=stars');
  const data = await response.json();

  // 渲染列表
  const list = document.querySelector('.glass-list');
  list.innerHTML = data.items.slice(0, 3).map(repo => `
    <a href="${repo.html_url}" class="glass-list-item">
      <div class="glass-list-item-content">
        <div class="glass-list-item-title">${repo.full_name}</div>
        <div class="glass-list-item-subtitle">${repo.language}</div>
      </div>
      <div class="glass-list-item-meta">⭐ ${formatNumber(repo.stargazers_count)}</div>
    </a>
  `).join('');
}
```

## 📝 示例页面

### 完整 Dashboard

访问 `/dashboard.html` 查看完整的 Dashboard 示例，包含：

- ✅ 天气卡片
- ✅ 统计卡片（文章、访问量）
- ✅ GitHub 趋势
- ✅ 今日新闻
- ✅ 项目进度
- ✅ 最近活动
- ✅ 访问趋势图表

### 集成到首页

你的 `home.html` 已经更新，侧边栏使用了 Glassmorphism 风格的组件。

## 🎯 下一步

### 短期优化
1. ✅ 集成真实 API 数据
2. ✅ 添加加载状态
3. ✅ 实现数据刷新
4. ✅ 添加错误处理

### 中期改进
1. 添加更多组件类型（日历、地图、聊天）
2. 实现拖拽排序
3. 支持组件配置
4. 添加数据缓存

### 长期规划
1. 组件市场
2. 主题商店
3. 数据可视化
4. 实时协作

## 🆘 常见问题

### Q: 背景模糊效果不显示？
A: 确保浏览器支持 `backdrop-filter`。Safari 需要 `-webkit-backdrop-filter`。

### Q: 卡片悬停效果卡顿？
A: 使用 `will-change: transform` 提前告知浏览器优化。

### Q: 移动端性能差？
A: 减少 `backdrop-filter` 的模糊程度，或在移动端禁用。

### Q: 暗色模式下看不清？
A: 调整 `--glass-bg` 的透明度，增加不透明度。

---

**设计完成！** 🎉 现在你有一个现代化的 Glassmorphism 风格的小组件系统了。
