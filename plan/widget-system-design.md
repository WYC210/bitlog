# Widget System Design Document

## 概述

基于你提供的四个页面截图（天气、程序员的今日、地球足迹、今日新闻），我设计了一个现代化的侧边栏小组件系统。

## 设计原则

### 1. 视觉层次
- **主内容区域**：左侧占据主要空间，展示文章和核心内容
- **侧边栏组件**：右侧 320px 宽度，展示辅助信息
- **响应式布局**：移动端自动切换为单列布局

### 2. 设计系统
基于 UI/UX Pro Max 分析结果：
- **风格**：Swiss Modernism 2.0 - 网格系统、模块化、清晰层次
- **字体**：Space Grotesk (标题) + DM Sans (正文)
- **配色**：深色科技风 + 状态绿
  - Primary: #1E293B
  - Secondary: #334155
  - CTA: #22C55E
  - Background: #0F172A

### 3. 组件设计

#### Widget 容器
```css
.widget {
  padding: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}
```

#### 已实现的组件

1. **日期组件** (Date Widget)
   - 大号日期显示
   - 星期和月份信息
   - 自动更新

2. **天气组件** (Weather Widget)
   - 温度和天气状况
   - 湿度、风速、紫外线指数
   - 支持 API 集成

3. **GitHub 趋势** (GitHub Trending Widget)
   - 显示热门仓库
   - Star 数量和编程语言
   - 实时更新

4. **新闻组件** (News Widget)
   - 新闻标题和来源
   - 发布时间
   - 刷新按钮

5. **地图组件** (Location Widget)
   - 地图容器（可集成 Leaflet/Mapbox）
   - 位置信息
   - 访问统计

6. **统计组件** (Stats Widget)
   - 文章、项目、访问、订阅数量
   - 2x2 网格布局
   - 紧凑设计

## 文件结构

```
apps/web/public/
├── ui/
│   ├── base.css              # 基础样式（已存在）
│   ├── widgets.css           # 新增：组件样式
│   └── widgets.js            # 新增：组件逻辑
└── _templates/
    ├── home.html             # 原始首页
    └── home-with-widgets.html # 新增：带组件的首页
```

## 使用方法

### 1. 在模板中引入样式和脚本

```html
<link rel="stylesheet" href="/ui/widgets.css?__cv={{CACHE_VERSION}}" />
<script src="/ui/widgets.js?__cv={{CACHE_VERSION}}"></script>
```

### 2. 布局结构

```html
<div class="layout">
  <!-- 主内容 -->
  <div>
    <section>主要内容</section>
  </div>

  <!-- 侧边栏组件 -->
  <aside>
    <div style="display: grid; gap: 16px; position: sticky; top: 80px;">
      <!-- 各种 widget -->
    </div>
  </aside>
</div>
```

### 3. API 集成

在 `widgets.js` 中替换占位符函数：

```javascript
// 天气 API
async function fetchWeather() {
  const response = await fetch('YOUR_WEATHER_API_URL');
  return await response.json();
}

// GitHub API
async function fetchGitHubTrending() {
  const response = await fetch('https://api.github.com/search/repositories?q=stars:>1000&sort=stars');
  return await response.json();
}

// 新闻 API
async function fetchNews() {
  const response = await fetch('YOUR_NEWS_API_URL');
  return await response.json();
}
```

## 响应式设计

### 桌面端 (>980px)
- 主内容 + 侧边栏双列布局
- 侧边栏固定宽度 320px
- 组件使用 sticky 定位

### 平板/移动端 (<980px)
- 自动切换为单列布局
- 侧边栏移至主内容下方
- 组件宽度自适应

## 交互特性

### 1. 自动刷新
- 天气：每 30 分钟
- GitHub 趋势：每 1 小时
- 新闻：每 15 分钟
- 日期：每 1 分钟

### 2. 手动刷新
```javascript
// 全局刷新函数
window.widgetRefresh.weather();  // 刷新天气
window.widgetRefresh.github();   // 刷新 GitHub
window.widgetRefresh.news();     // 刷新新闻
window.widgetRefresh.all();      // 刷新全部
```

### 3. 滚动动画
- 组件进入视口时淡入
- 错开动画时间（0.1s 间隔）
- 支持 `prefers-reduced-motion`

## 可访问性

### WCAG 2.1 AA 标准
- ✅ 颜色对比度 4.5:1
- ✅ 键盘导航支持
- ✅ ARIA 标签
- ✅ 焦点状态可见
- ✅ 响应 `prefers-reduced-motion`

### 语义化 HTML
```html
<aside>           <!-- 侧边栏语义 -->
  <article>       <!-- 独立内容单元 -->
    <h3>          <!-- 标题层级 -->
    <button>      <!-- 可交互元素 -->
```

## 性能优化

### 1. CSS
- 使用 CSS 变量减少重复
- 避免昂贵的属性（box-shadow 使用 GPU 加速）
- 响应式图片和懒加载

### 2. JavaScript
- 防抖和节流
- IntersectionObserver 替代 scroll 事件
- 异步加载数据

### 3. 缓存策略
```javascript
// 使用 localStorage 缓存数据
const CACHE_KEY = 'widget_data';
const CACHE_DURATION = 15 * 60 * 1000; // 15 分钟
```

## 扩展性

### 添加新组件

1. 在 `widgets.css` 中定义样式：
```css
.my-widget {
  /* 样式 */
}
```

2. 在 HTML 中添加结构：
```html
<div class="widget">
  <div class="widget-header">
    <h3 class="widget-title">我的组件</h3>
  </div>
  <div class="widget-body">
    <!-- 内容 -->
  </div>
</div>
```

3. 在 `widgets.js` 中添加逻辑：
```javascript
async function updateMyWidget() {
  // 更新逻辑
}
```

## 主题支持

### 亮色/暗色模式
所有组件自动适配主题：

```css
[data-theme="dark"] .widget {
  background: var(--surface);
  border-color: var(--border);
}
```

### 自定义主题
修改 CSS 变量即可：

```css
:root {
  --widget-radius: 16px;
  --widget-padding: 16px;
  --widget-gap: 16px;
}
```

## 下一步

### 建议的改进
1. **集成真实 API**
   - OpenWeatherMap (天气)
   - GitHub API (趋势)
   - NewsAPI (新闻)
   - Leaflet/Mapbox (地图)

2. **添加更多组件**
   - RSS 订阅
   - 最近评论
   - 标签云
   - 归档日历

3. **用户自定义**
   - 拖拽排序
   - 显示/隐藏组件
   - 保存偏好设置

4. **数据持久化**
   - LocalStorage 缓存
   - IndexedDB 存储
   - Service Worker 离线支持

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 许可证

与项目主体保持一致
