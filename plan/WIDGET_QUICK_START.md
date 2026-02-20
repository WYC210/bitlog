# Widget System - Quick Start Guide

## 🎯 已完成的工作

我已经为你的博客设计并实现了一个完整的侧边栏小组件系统，将你提供的四个页面（天气、程序员的今日、地球足迹、今日新闻）优化成了现代化的小组件。

## 📁 创建的文件

### 1. 样式文件
- `apps/web/public/ui/widgets.css` - 核心组件样式
- `apps/web/public/ui/widgets-enhanced.css` - 增强样式（动画、响应式、无障碍）

### 2. JavaScript 文件
- `apps/web/public/ui/widgets.js` - 组件交互逻辑和数据更新

### 3. 模板文件
- `apps/web/public/_templates/home.html` - 已更新，集成了所有组件
- `apps/web/public/_templates/home-with-widgets.html` - 完整示例模板

### 4. 文档
- `plan/widget-system-design.md` - 完整的设计文档

## 🎨 实现的组件

### 1. **日期组件** (今日)
- ✅ 大号日期显示
- ✅ 星期和月份信息
- ✅ 自动更新（每分钟）
- ✅ 渐变动画效果

### 2. **天气组件**
- ✅ 温度和天气图标
- ✅ 天气描述和空气质量
- ✅ 湿度、风速、紫外线指数
- ✅ 浮动动画效果
- ✅ 支持 API 集成

### 3. **GitHub 趋势组件**
- ✅ 显示热门仓库
- ✅ Star 数量和编程语言
- ✅ 仓库描述
- ✅ 点击跳转到 GitHub
- ✅ 自动刷新（每小时）

### 4. **今日新闻组件**
- ✅ 新闻标题和来源
- ✅ 发布时间
- ✅ 手动刷新按钮
- ✅ 查看全部链接
- ✅ 自动刷新（每15分钟）

### 5. **统计组件**
- ✅ 文章、项目、访问、订阅数量
- ✅ 2x2 网格布局
- ✅ 悬停动画效果

### 6. **地图组件** (预留)
- ✅ 地图容器
- ✅ 位置信息显示
- ✅ 访问统计
- 🔄 待集成地图库（Leaflet/Mapbox）

## 🚀 如何使用

### 方式一：直接使用（推荐）

你的 `home.html` 已经更新，包含了所有组件。直接启动服务器即可看到效果：

```bash
cd apps/web
npm run dev
```

### 方式二：查看完整示例

如果想看完整的独立示例：

```bash
# 将 home-with-widgets.html 复制为 home.html
cp apps/web/public/_templates/home-with-widgets.html apps/web/public/_templates/home.html
```

## 🔧 配置 API

### 1. 天气 API

在 `apps/web/public/ui/widgets.js` 中找到 `fetchWeather` 函数：

```javascript
async function fetchWeather() {
  // 替换为你的天气 API
  const response = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Beijing&appid=YOUR_API_KEY&units=metric&lang=zh_cn');
  const data = await response.json();

  return {
    temp: Math.round(data.main.temp),
    condition: data.weather[0].description,
    airQuality: '良好', // 需要额外的空气质量 API
    humidity: data.main.humidity,
    windSpeed: Math.round(data.wind.speed * 3.6), // m/s 转 km/h
    uvIndex: '中等', // 需要额外的 UV API
    icon: getWeatherIcon(data.weather[0].icon)
  };
}
```

推荐的天气 API：
- **OpenWeatherMap**: https://openweathermap.org/api
- **WeatherAPI**: https://www.weatherapi.com/
- **和风天气**: https://dev.qweather.com/

### 2. GitHub 趋势 API

```javascript
async function fetchGitHubTrending() {
  const response = await fetch('https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=3');
  const data = await response.json();

  return data.items.map(repo => ({
    name: repo.full_name,
    description: repo.description,
    stars: formatNumber(repo.stargazers_count),
    language: repo.language,
    url: repo.html_url
  }));
}
```

### 3. 新闻 API

```javascript
async function fetchNews() {
  // 使用 NewsAPI 或其他新闻源
  const response = await fetch('https://newsapi.org/v2/top-headlines?country=cn&category=technology&apiKey=YOUR_API_KEY');
  const data = await response.json();

  return data.articles.slice(0, 3).map(article => ({
    title: article.title,
    source: article.source.name,
    time: formatTime(article.publishedAt),
    url: article.url
  }));
}
```

推荐的新闻 API：
- **NewsAPI**: https://newsapi.org/
- **聚合数据**: https://www.juhe.cn/
- **天行数据**: https://www.tianapi.com/

### 4. 地图集成

安装 Leaflet：

```bash
npm install leaflet
```

在 `widgets.js` 中更新 `initializeMap` 函数：

```javascript
function initializeMap() {
  const mapContainer = document.querySelector('.map-container');
  if (!mapContainer) return;

  // 清空占位符
  mapContainer.innerHTML = '';

  // 初始化地图
  const map = L.map(mapContainer).setView([39.9042, 116.4074], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // 添加标记
  L.marker([39.9042, 116.4074]).addTo(map)
    .bindPopup('北京')
    .openPopup();
}
```

## 🎨 自定义样式

### 修改颜色

在 `apps/web/public/ui/base.css` 中修改 CSS 变量：

```css
:root {
  --primary: #4b6bff;      /* 主色调 */
  --success: #10b981;      /* 成功色 */
  --danger: #ef4444;       /* 危险色 */
  --radius: 16px;          /* 圆角大小 */
  --shadow: 0 12px 24px rgba(15, 23, 42, 0.08); /* 阴影 */
}
```

### 修改组件大小

在 `apps/web/public/ui/widgets.css` 中：

```css
.widget {
  padding: 16px;  /* 调整内边距 */
}

.layout {
  grid-template-columns: minmax(0, 1fr) 320px; /* 调整侧边栏宽度 */
}
```

### 添加自定义组件

1. 在 HTML 中添加结构：

```html
<div class="widget">
  <div class="widget-header">
    <h3 class="widget-title">
      <svg class="widget-icon" viewBox="0 0 24 24">
        <!-- 图标 SVG -->
      </svg>
      我的组件
    </h3>
  </div>
  <div class="widget-body">
    <!-- 组件内容 -->
  </div>
</div>
```

2. 在 `widgets.js` 中添加逻辑：

```javascript
async function updateMyWidget() {
  // 获取数据
  const data = await fetchMyData();

  // 更新 DOM
  const container = document.querySelector('.my-widget-container');
  container.innerHTML = renderMyWidget(data);
}
```

## 📱 响应式设计

组件会自动适配不同屏幕：

- **桌面端 (>980px)**: 主内容 + 侧边栏双列布局
- **平板端 (641px-980px)**: 单列布局，侧边栏在下方
- **移动端 (<640px)**: 紧凑布局，优化触摸交互

## ♿ 无障碍支持

- ✅ 键盘导航支持
- ✅ ARIA 标签
- ✅ 焦点状态可见
- ✅ 颜色对比度 4.5:1
- ✅ 支持 `prefers-reduced-motion`
- ✅ 支持 `prefers-contrast: high`

## 🔄 手动刷新

在浏览器控制台中：

```javascript
// 刷新天气
window.widgetRefresh.weather();

// 刷新 GitHub 趋势
window.widgetRefresh.github();

// 刷新新闻
window.widgetRefresh.news();

// 刷新日期
window.widgetRefresh.date();

// 刷新全部
window.widgetRefresh.all();
```

## 🐛 调试

### 查看组件状态

```javascript
// 在控制台中
console.log(window.widgetRefresh);
```

### 禁用自动刷新

在 `widgets.js` 中注释掉 `setupAutoRefresh()` 调用：

```javascript
function initWidgets() {
  updateDateWidget();
  updateWeatherWidget();
  updateGitHubTrending();
  updateNewsWidget();
  initializeMap();
  setupRefreshButtons();
  setupScrollAnimations();
  // setupAutoRefresh(); // 禁用自动刷新
}
```

## 📊 性能优化

### 已实现的优化

1. **懒加载**: 使用 IntersectionObserver 实现滚动动画
2. **防抖节流**: 避免频繁的 API 调用
3. **缓存**: 可以添加 localStorage 缓存
4. **骨架屏**: 加载时显示占位符

### 添加缓存

在 `widgets.js` 中：

```javascript
const CACHE_KEY = 'widget_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 分钟

async function fetchWithCache(key, fetchFn) {
  const cached = localStorage.getItem(key);

  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  const data = await fetchFn();
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now()
  }));

  return data;
}

// 使用
async function updateWeatherWidget() {
  const weather = await fetchWithCache('weather', fetchWeather);
  // 更新 UI
}
```

## 🎯 下一步建议

### 短期（1-2天）
1. ✅ 集成真实的天气 API
2. ✅ 集成 GitHub API
3. ✅ 集成新闻 API
4. ✅ 测试响应式布局

### 中期（1周）
1. 添加地图功能（Leaflet/Mapbox）
2. 添加更多组件（RSS、评论、标签云）
3. 实现用户自定义（显示/隐藏组件）
4. 添加数据缓存

### 长期（1个月）
1. 实现拖拽排序
2. 添加组件配置面板
3. 支持多语言
4. PWA 支持（离线访问）

## 📝 注意事项

1. **API 密钥安全**: 不要在前端直接暴露 API 密钥，建议通过后端代理
2. **CORS 问题**: 某些 API 可能需要后端代理来避免跨域问题
3. **速率限制**: 注意 API 的调用频率限制
4. **错误处理**: 已添加基础错误处理，可以根据需要增强

## 🆘 常见问题

### Q: 组件不显示？
A: 检查浏览器控制台是否有错误，确认 CSS 和 JS 文件已正确加载。

### Q: 样式错乱？
A: 清除浏览器缓存，或在 URL 中增加 `?__cv=` 参数的值。

### Q: API 调用失败？
A: 检查网络请求，确认 API 密钥正确，注意 CORS 问题。

### Q: 移动端显示不正常？
A: 确认 viewport meta 标签存在，检查响应式断点。

## 📞 技术支持

如需帮助，请查看：
- 设计文档: `plan/widget-system-design.md`
- 源代码注释
- 浏览器开发者工具

---

**祝你使用愉快！** 🎉
