# 全局设计与布局框架

## 页面骨架

- 全局骨架由 `Layout.astro` 负责：Header → Main → Footer  
  主体内容统一位于 `main`，顶部预留 `pt-16` 对应固定 Header 高度。
- 主容器宽度：`max-w-7xl`，左右留白为响应式 `px-4 / sm:px-6 / lg:px-8`。
- 主体最小高度：`min-h-screen`，页面整体布局采用纵向 Flex。

## 页面类型（语义）

`Layout.astro` 通过 `pageType` 指定语义类型：
- `page`：普通页面
- `article`：文章详情
- `directory`：目录或列表页（文章网格/筛选）

## SEO 与元信息

- 站点级标题与描述来自 `consts.ts`：
  - `SITE_TITLE`（站点标题）
  - `SITE_DESCRIPTION`（站点描述）
- 全局 SEO 组件：`AstroSeo`（页面级 title/description/OG/Tag）
- 文章页增加 `article:published_time` 与 `article:tag`

## RSS / Sitemap

- 全站 RSS：`/rss.xml`
- Sitemap：`/sitemap.xml`
- 文章页可附加专用 RSS（`rssLink`）

## 暗色模式全局策略

- 主题状态写入 `document.documentElement.dataset.theme`
- 主题切换会影响：背景、文字、边框、卡片、滚动条等

## 视觉基线

- 背景：浅色 `bg-gray-50`，深色 `bg-dark-bg`
- 文字基色：浅色 `text-gray-*`，深色 `text-gray-*`
- 卡片与面板使用统一圆角与阴影策略（详见 `styles.md`）

## 来源参考

- `src/components/Layout.astro`
- `src/consts.ts`
- `src/components/Footer.astro`
