# 🎨 Bitlog 样式优化 - 完整使用指南

## 📋 目录

1. [快速开始](#快速开始)
2. [页面概览](#页面概览)
3. [自定义配置](#自定义配置)
4. [常见问题](#常见问题)
5. [最佳实践](#最佳实践)

---

## 🚀 快速开始

### 1. 启动项目

```bash
# 进入项目目录
cd apps/web

# 安装依赖（如果还没安装）
npm install

# 启动开发服务器
npm run dev
```

### 2. 访问页面

```
首页：        http://localhost:3000/
关于我：      http://localhost:3000/about
文章列表：    http://localhost:3000/articles
文章详情：    http://localhost:3000/post/xxx
Dashboard：   http://localhost:3000/dashboard.html
```

### 3. 查看效果

所有页面都已经应用了新的 Glassmorphism 风格样式，你可以：
- 🌓 切换亮色/暗色模式（右上角按钮）
- 📱 调整浏览器窗口大小查看响应式效果
- 🖱️ 悬停在卡片上查看动画效果
- ⌨️ 使用键盘导航测试无障碍性

---

## 📄 页面概览

### 1. 首页 (/)

**特点**：
- ✨ Glassmorphism 风格侧边栏小组件
- 🌈 渐变背景（紫色到粉色）
- 💎 毛玻璃效果
- 🔄 自动刷新数据

**小组件**：
- 天气卡片 - 显示实时天气信息
- 统计卡片 - 显示文章、项目、访问、订阅数量
- GitHub 趋势 - 显示热门仓库
- 今日新闻 - 显示最新科技新闻

**自定义**：
```html
<!-- 修改统计数据 -->
<div class="stat-card-value">42</div>  <!-- 改为你的数据 -->
```

### 2. 关于我页面 (/about)

**特点**：
- 👤 Hero 区域（头像 + 介绍）
- 📊 统计卡片（4 个数据展示）
- 💼 技能专长（3 个技能卡片）
- 📅 工作经历时间线
- 📧 联系方式和社交链接

**自定义**：
```html
<!-- 修改头像 -->
<img class="about-avatar" src="/images/your-avatar.jpg" alt="头像" />

<!-- 修改技能标签 -->
<span class="about-skill-tag">React</span>
<span class="about-skill-tag">Vue</span>
```

### 3. 文章列表页 (/articles)

**特点**：
- 🎯 增强的文章卡片
- 🏷️ 分类和标签筛选
- 📌 侧边栏（分类、标签）
- 🔍 搜索高亮
- ✨ 悬停动画

**功能**：
- 点击分类/标签筛选文章
- 使用搜索框搜索文章
- 悬停查看文章预览

### 4. 文章详情页 (/post/xxx)

**特点**：
- 📝 优化的文章头部
- 📖 增强的正文排版
- 📑 目录导航（TOC）
- 💬 美化的引用块
- 🖼️ 图片样式优化

**功能**：
- 点击目录快速跳转
- 滚动时目录高亮当前章节
- 代码块带复制按钮

---

## 🎨 自定义配置

### 1. 修改主题颜色

在 `apps/web/public/ui/base.css` 中修改：

```css
:root {
  /* 主色调 */
  --primary: #4b6bff;
  --primary-700: #2541b7;
  --primary-100: #ebf0ff;

  /* 成功色 */
  --success: #10b981;

  /* 危险色 */
  --danger: #ef4444;

  /* 圆角 */
  --radius: 16px;
  --radius-sm: 12px;

  /* 阴影 */
  --shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  --shadow-soft: 0 6px 16px rgba(15, 23, 42, 0.06);
}
```

### 2. 修改渐变背景

在 `apps/web/public/ui/dashboard-widgets.css` 中修改：

```css
.dashboard-container {
  /* 默认：紫色到粉色 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  /* 蓝色系 */
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

  /* 橙色系 */
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);

  /* 绿色系 */
  background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
}
```

### 3. 调整玻璃透明度

在 `apps/web/public/ui/dashboard-widgets.css` 中修改：

```css
:root {
  /* 更透明（更模糊） */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-blur: 16px;

  /* 更不透明（更清晰） */
  --glass-bg: rgba(255, 255, 255, 0.15);
  --glass-blur: 8px;
}
```

### 4. 修改字体

在 `apps/web/public/ui/dashboard-widgets.css` 中修改：

```css
@import url('https://fonts.googleapis.com/css2?family=Your+Font:wght@400;500;600;700&display=swap');

:root {
  --font-heading: 'Your Font', sans-serif;
  --font-body: 'Your Font', sans-serif;
}
```

### 5. 调整动画速度

在各个样式文件中修改：

```css
.element {
  /* 更快 */
  transition: all 0.2s ease;

  /* 更慢 */
  transition: all 0.5s ease;

  /* 禁用动画 */
  transition: none;
}
```

---

## 🔧 常见问题

### Q1: 小组件不显示数据？

**A**: 小组件使用的是模拟数据，需要集成真实 API。

在 `apps/web/public/ui/dashboard-widgets.js` 中修改：

```javascript
// 天气 API
async fetch() {
  const response = await fetch('YOUR_WEATHER_API_URL');
  return await response.json();
}

// GitHub API
async fetch() {
  const response = await fetch('https://api.github.com/...');
  return await response.json();
}
```

### Q2: 样式没有生效？

**A**: 清除浏览器缓存或强制刷新（Ctrl+Shift+R / Cmd+Shift+R）。

### Q3: 深色模式切换不工作？

**A**: 检查 `theme-toggle.js` 是否正确加载：

```html
<script src="/ui/theme-toggle.js?__cv={{CACHE_VERSION}}"></script>
```

### Q4: 移动端显示异常？

**A**: 确认 viewport meta 标签存在：

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

### Q5: 动画太多导致性能问题？

**A**: 在 CSS 中禁用部分动画：

```css
/* 禁用特定动画 */
.glass-card::before {
  display: none;
}

/* 或使用 prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

### Q6: 如何修改头像？

**A**: 在 `page.html` 中修改图片路径：

```html
<img class="about-avatar" src="/images/your-avatar.jpg" alt="头像" />
```

### Q7: 如何添加新的技能卡片？

**A**: 复制现有的技能卡片结构：

```html
<div class="about-skill-card">
  <div class="about-skill-header">
    <div class="about-skill-icon">
      <!-- SVG 图标 -->
    </div>
    <h3 class="about-skill-title">新技能</h3>
  </div>
  <p class="about-skill-description">技能描述</p>
  <div class="about-skill-tags">
    <span class="about-skill-tag">标签1</span>
  </div>
</div>
```

### Q8: 如何修改联系方式？

**A**: 在 `page.html` 中修改链接：

```html
<a class="about-contact-link" href="mailto:your@email.com">
  <svg><!-- 图标 --></svg>
  发送邮件
</a>
```

---

## 💡 最佳实践

### 1. 性能优化

**图片优化**：
```html
<!-- 使用 WebP 格式 -->
<img src="image.webp" alt="描述" loading="lazy" />

<!-- 使用响应式图片 -->
<img
  srcset="image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w"
  sizes="(max-width: 640px) 100vw, 640px"
  src="image-640w.jpg"
  alt="描述"
/>
```

**CSS 优化**：
```css
/* 使用 GPU 加速 */
.element {
  transform: translateZ(0);
  will-change: transform, opacity;
}

/* 避免昂贵的属性 */
.element {
  /* 好 */
  transform: translateY(-4px);

  /* 差 */
  top: -4px;
}
```

**JavaScript 优化**：
```javascript
// 使用防抖
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// 使用 IntersectionObserver
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // 加载内容
    }
  });
});
```

### 2. 无障碍性

**语义化 HTML**：
```html
<!-- 好 -->
<nav aria-label="主导航">
  <a href="/">首页</a>
</nav>

<!-- 差 -->
<div class="nav">
  <a href="/">首页</a>
</div>
```

**键盘导航**：
```html
<!-- 添加 tabindex -->
<div tabindex="0" role="button" aria-label="关闭">×</div>

<!-- 焦点状态 -->
<style>
  button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
</style>
```

**颜色对比度**：
```css
/* 确保对比度 > 4.5:1 */
.text {
  color: #0f172a; /* 深色文字 */
  background: #ffffff; /* 白色背景 */
}
```

### 3. 响应式设计

**移动优先**：
```css
/* 默认移动端样式 */
.element {
  font-size: 14px;
}

/* 桌面端样式 */
@media (min-width: 768px) {
  .element {
    font-size: 16px;
  }
}
```

**断点设置**：
```css
/* 移动端 */
@media (max-width: 640px) { }

/* 平板端 */
@media (min-width: 641px) and (max-width: 980px) { }

/* 桌面端 */
@media (min-width: 981px) { }
```

### 4. 代码组织

**CSS 文件结构**：
```css
/* 1. 变量 */
:root { }

/* 2. 基础样式 */
body { }

/* 3. 布局 */
.container { }

/* 4. 组件 */
.card { }

/* 5. 工具类 */
.text-center { }

/* 6. 响应式 */
@media { }

/* 7. 深色模式 */
[data-theme="dark"] { }

/* 8. 动画 */
@keyframes { }
```

**命名规范**：
```css
/* BEM 命名 */
.block { }
.block__element { }
.block--modifier { }

/* 或使用语义化命名 */
.card { }
.card-header { }
.card-body { }
.card-footer { }
```

### 5. 维护建议

**定期检查**：
- ✅ 浏览器兼容性
- ✅ 响应式布局
- ✅ 无障碍性
- ✅ 性能指标
- ✅ 代码质量

**工具推荐**：
- Lighthouse - 性能和无障碍性检查
- axe DevTools - 无障碍性检查
- Chrome DevTools - 调试和性能分析
- BrowserStack - 跨浏览器测试

---

## 📚 相关文档

- [完整优化总结](./COMPLETE_OPTIMIZATION_SUMMARY.md)
- [Glassmorphism 设计文档](./GLASSMORPHISM_DESIGN.md)
- [关于我页面优化](./ABOUT_PAGE_OPTIMIZATION.md)
- [快速开始指南](./QUICK_START_GLASSMORPHISM.md)

---

## 🎯 下一步

### 短期优化（1-2天）
1. ✅ 集成真实 API 数据
2. ✅ 添加真实的头像和图片
3. ✅ 更新统计数据
4. ✅ 测试所有页面

### 中期改进（1周）
1. 添加更多小组件类型
2. 实现拖拽排序功能
3. 添加用户自定义配置
4. 优化加载性能

### 长期规划（1个月）
1. 组件市场
2. 主题商店
3. 数据可视化
4. PWA 支持

---

## 🆘 获取帮助

如果遇到问题：

1. **查看文档** - 阅读相关文档文件
2. **检查控制台** - 查看浏览器控制台错误
3. **清除缓存** - 强制刷新浏览器
4. **检查文件** - 确认所有文件都已正确加载

---

**🎉 祝你使用愉快！**

你的博客现在拥有现代化的设计和出色的用户体验。如果有任何问题或需要进一步的帮助，随时告诉我！
