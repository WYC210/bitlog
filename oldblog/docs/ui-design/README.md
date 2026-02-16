# UI 设计功能文档（复刻基线）

> 目标：在不依赖现有前端框架的前提下，完整复刻现有 UI 与功能体验。
> 范围：覆盖所有页面与组件（排除 `src/content` 下的笔记内容）。

## 文档结构

1. `global-design.md`  
   全局布局、页面骨架、SEO/RSS 入口、主容器与页脚结构。

2. `navigation.md`  
   导航体系（主导航分组、子菜单、移动端菜单、搜索入口）。

3. `animations-transitions.md`  
   主题切换动画、页面转场、加载指示与关键动效。

4. `pages-home-about-projects-media.md`  
   首页 / 关于 / 项目 / 电影 / 书单 / 404 的布局与功能描述。

5. `pages-articles.md`  
   文章目录网格、文章详情、筛选页的布局与功能描述。

6. `components-interaction.md`  
   搜索、面包屑、目录（TOC）、阅读进度、返回顶部等交互组件。

7. `components-data.md`  
   数据展示组件：豆瓣、微信读书、Git 项目、世界地图、倒计时。

8. `styles.md`  
   视觉系统与样式约束（颜色、暗色模式、卡片、排版、滚动条、文章样式）。

## 复刻原则

- 仅描述“布局结构 + 功能行为”，避免复制重要代码片段。
- 以现有代码为事实来源（见各文档末尾的“来源参考”）。
- 不记录 `src/content` 下的笔记内容。
- 不展开组件状态/边界情况（已按需求排除）。

## 核心信息总览

- 主容器：`Layout.astro` 定义全局结构（Header / Main / Footer）
- 导航配置：`consts.ts` 的 `NAV_STRUCTURE`
- 主题与转场：`ThemeToggle.astro` + `swup-init.js`
- 文章体系：`src/pages/articles/*` + `ArticleFilter` + `Breadcrumb`

## 适用范围

- 当前前端实现版本（Astro + React 组件）
- 后续迁移到任意前端框架时可直接对照复刻
