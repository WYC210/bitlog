# 任务清单：newechoes 样式细节审计（全量）

目标：逐项核对 `newechoes_git` 的视觉细节，作为 UI 同步的基线清单。

---

## 1. 主题与背景
- [ ] 1.1 明亮模式整体背景：`Layout.astro` 使用 `bg-gray-50`（接近 #f8fafc），整体基调偏浅灰。`newechoes_git/src/components/Layout.astro:324`
- [ ] 1.2 黑夜模式整体背景：`--color-dark-bg: #0f172a`，`[data-theme='dark']` 直接设置 `background-color: var(--bg-primary)`。`newechoes_git/src/styles/global.css:35`、`newechoes_git/src/styles/global.css:52`
- [ ] 1.3 全局发光边框：`body::after` 2px 边框 + inset 光晕 + 3s 呼吸动画；暗色使用 `global-glow-pulse-dark`。`newechoes_git/src/styles/global.css:498`
- [ ] 1.4 滚动条色系：亮色 track #f1f5f9 / thumb #94a3b8；暗色 track #1e293b / thumb #475569。`newechoes_git/src/styles/global.css:72`

## 2. 颜色变量与层级
- [ ] 2.1 主色阶：primary 50–950（#f5f7ff → #0c1b5c）。`newechoes_git/src/styles/global.css:8`
- [ ] 2.2 暗色层级：dark-bg #0f172a / dark-surface #1e293b / dark-card #334155 / dark-border #475569。`newechoes_git/src/styles/global.css:35`
- [ ] 2.3 暗色文本：text #e2e8f0 / secondary #94a3b8。`newechoes_git/src/styles/global.css:39`

## 3. 顶栏与导航（含选中高亮）
- [ ] 3.1 顶栏滚动态：`#header-bg.scrolled` 亮色 rgba(249,250,251,0.8) + blur + 多层阴影；暗色 rgba(15,23,42,0.8) + 阴影。`newechoes_git/src/styles/header.css:4`
- [ ] 3.2 导航高亮层 1：`#nav-primary-highlight` 背景 primary-100；暗色使用 `color-mix` primary-800 30%。`newechoes_git/src/styles/header.css:21`
- [ ] 3.3 导航高亮层 2：`#nav-secondary-highlight` 背景 `color-mix` primary-300 80%；暗色 primary-700 60%。`newechoes_git/src/styles/header.css:28`
- [ ] 3.4 悬停高亮层：`#nav-hover-highlight` 在 Header 里使用 `bg-primary-100/50`（暗色 `bg-primary-800/20`）。`newechoes_git/src/components/Header.astro:44`
- [ ] 3.5 选中态文字颜色：active = primary-700（暗色 primary-300）；inactive = gray-600（暗色 gray-300）。`newechoes_git/src/styles/header.css:55`

## 4. 搜索框与结果面板
- [ ] 4.1 搜索输入框：`bg-white dark:bg-gray-800`、`border-gray-300 dark:border-gray-600`、`rounded-lg/xl`、`focus:ring-primary-500`、`focus:shadow-md`。`newechoes_git/src/components/Search.tsx:1568`
- [ ] 4.2 搜索结果浮层：`bg-white dark:bg-gray-800`、`border`、`shadow-xl`。`newechoes_git/src/components/Search.tsx:1400`
- [ ] 4.3 结果 hover 高亮：`hover:bg-primary-200/80`（暗色 `primary-800/20`）并加边框高亮。`newechoes_git/src/components/Search.tsx:1418`

## 5. 卡片系统（文章卡/工具卡等）
- [ ] 5.1 基础卡片：边框 gray-200、白底、圆角 0.75rem、阴影 10/15，hover 上移 -0.25rem + 更强阴影。`newechoes_git/src/styles/global.css:130`
- [ ] 5.2 暗色卡片：bg gray-800 / border gray-700；标题 hover 变 primary-300。`newechoes_git/src/styles/global.css:141`
- [ ] 5.3 卡片图标底色：primary-100（暗色 rgba(75,107,255,0.2)）。`newechoes_git/src/styles/global.css:164`

## 6. 文章内容排版（Prose）
- [ ] 6.1 标题风格：h1/h2 下边框 + 渐变短线；h3 左侧竖条渐变。`newechoes_git/src/styles/articles.css:23`
- [ ] 6.2 引用块：左边框 primary-500 + 灰底；暗色改为 dark-surface + primary-400。`newechoes_git/src/styles/articles.css:86`
- [ ] 6.3 details 组件：summary 渐变底 + 左边框；展开态颜色加强；暗色使用 dark-card。`newechoes_git/src/styles/articles.css:118`

## 7. 筛选区（ArticleFilter）选中高亮
- [ ] 7.1 筛选容器：`bg-white dark:bg-gray-800`、`rounded-xl`、`shadow-lg`、`border`。`newechoes_git/src/components/ArticleFilter.tsx:1596`
- [ ] 7.2 日期范围：起止日期 `bg-primary-600 text-white`；范围内 `bg-primary-100`（暗色 `primary-900/30`）；非选中 hover gray-100/dark gray-700。`newechoes_git/src/components/ArticleFilter.tsx:202`
- [ ] 7.3 排序下拉：选中项 `bg-primary-50`（暗色 `primary-900/20`）+ `text-primary-700`（暗色 `primary-300`）。`newechoes_git/src/components/ArticleFilter.tsx:1753`
- [ ] 7.4 标签选择：checkbox `text-primary-600` + `focus:ring-primary-500`；选中标签 chips 使用 `bg-primary-50` / `dark:bg-primary-900/30` + `border-primary-100`。`newechoes_git/src/components/ArticleFilter.tsx:1903`
- [ ] 7.5 分页：当前页 `bg-primary-600 text-white`，禁用态置灰。`newechoes_git/src/components/ArticleFilter.tsx:2401`

## 8. 交互焦点与高亮
- [ ] 8.1 focus-visible：3px 蓝色外描边 + 外发光；暗色增亮。`newechoes_git/src/styles/global.css:532`
- [ ] 8.2 默认 focus 取消：button/a/input/textarea/select 全部移除默认 outline。`newechoes_git/src/styles/global.css:545`

## 9. 主题切换与过渡
- [ ] 9.1 主题切换 ripple：`theme-toggle.css` 控制水波纹尺寸、颜色与持续时间。`newechoes_git/src/styles/theme-toggle.css:2`
- [ ] 9.2 View Transitions：禁用 root 过渡动画，设置 z-index 叠层。`newechoes_git/src/styles/theme-toggle.css:26`
- [ ] 9.3 Swup 过渡：`transition-fade`、`swup-transition-article`、`#article-content` 统一 0.3s 渐隐。`newechoes_git/src/styles/swup-transitions.css:5`
- [ ] 9.4 加载旋转：多层 ring + 暗色背景适配。`newechoes_git/src/styles/swup-transitions.css:31`

---

备注：以上为已确认细节列表；若仍需补充页面级细节（如项目/工具页特有卡片样式），可在后续补充。
