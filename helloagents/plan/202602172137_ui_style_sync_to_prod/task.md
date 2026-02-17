# 任务清单：将 `docs/ui-style-sync` 实装到线上站点（Web + Admin）

目录：`helloagents/plan/202602172137_ui_style_sync_to_prod/`

目标：把 `docs/ui-style-sync/` 中已确认的 UI 规范与交互，落地到真实 Worker 页面（`apps/web`）与后台（`apps/admin`），做到**视觉一致**、**可维护**、**不破坏现有功能**。

---

## 0. 范围说明

### 0.1 覆盖页面
- Web（公开站点）
  - `/`（**替换为首页**：对应 `web-home*.html`）
  - `/articles`（文章列表：对应 `web-articles*.html`）
  - `/articles/:slug`（文章详情：对应 `web-post*.html`）
- Admin（管理端）
  - 登录、文章列表、编辑器、设置、账号（现有 React 页面；视觉参考 `admin-*.html`）

### 0.2 必须保留的现有能力（不可回归）
- Web：搜索、分类/标签过滤、TOC、缓存策略、快捷键（`SHORTCUTS_TEXT`）、GitHub embed 卡片等现有脚本
- Admin：CodeMirror 编辑、自动预览渲染、上传图片、布局切换（Write/Preview/Split）与偏好持久化

### 0.3 本任务不做（明确排除）
- 不改 API 数据结构、不改 Markdown 渲染逻辑（仅调整前端展示与交互）
- 不做“像 Notion 一样的精确滚动同步”（先实现可用的定位/聚焦逻辑）

---

## 1. Web：落地 `ui-style-sync` 设计体系

### 1.1 抽离可复用静态资源（CSS/JS）
- [ ] 将 `docs/ui-style-sync/base.css` 迁移为 Web 真实静态资源（建议：`apps/web/public/ui/base.css`）
- [ ] 将 `docs/ui-style-sync/theme-toggle.js` 迁移为 Web 真实静态资源（建议：`apps/web/public/ui/theme-toggle.js`）
- [ ] 规划缓存刷新策略（建议：`?v={{CACHE_VERSION}}`，由 `cfg.cacheVersion` 驱动）

### 1.2 新增/替换模板（`apps/web/public/_templates/*`）
- [ ] 新增 `home.html`（从 `docs/ui-style-sync/web-home*.html` 抽取结构；支持 light/dark 与主题切换）
- [ ] 重写 `articles.html`：改为 `site-header / container / layout / card` 等统一结构
- [ ] 重写 `post.html`：统一文章头部信息区、TOC/标签侧栏、代码块/图片基础样式与间距

### 1.3 Worker 渲染层适配（`apps/web/src/app.ts`）
- [ ] `/`：从 `302 -> /articles` 调整为渲染 `home.html`（或保留重定向但提供独立首页路由；两者择一）
- [ ] 列表卡片：将每条文章卡片改成“整卡可点击”（对齐 `ui-style-sync`）
- [ ] 传递新增模板变量（如 `CACHE_VERSION`、`THEME_DEFAULT` 等）并确保 `replaceAll` 不遗漏
- [ ] 保留并回填现有脚本：快捷键、search focus、embed 卡片逻辑等

### 1.4 自测清单（Web）
- [ ] `/`、`/articles`、`/articles/:slug` 在 375/768/1024/1440 宽度下无横向滚动条
- [ ] light/dark 切换：刷新后仍保持主题（localStorage 或 cookie；实现方式可选）
- [ ] 搜索、分类、标签、TOC、文章正文样式不回归（尤其是代码块/表格/图片）

---

## 2. Admin：将编辑器聚焦交互与视觉同步到真实 React 应用

### 2.1 视觉对齐（`apps/admin/src/styles.css`）
- [ ] 同步 card/chip/toolbar/网格间距等关键样式（参考 `docs/ui-style-sync/base.css` 的 token 与组件）
- [ ] 确认 hover/focus 不产生布局抖动（尤其是 chip 与按钮）

### 2.2 编辑器专注模式（Focus mode）
> 需求：在聚焦 Markdown 编辑区时，**竖向扩展编辑区**，同时把“标题/分类/状态/发布时间”等元信息区域**最小化/折叠**，让用户同时关注左侧编辑 + 右侧预览。

- [ ] 在 `EditorPage` 加入“编辑聚焦状态”（由 CodeMirror focus/blur 驱动）
- [ ] 聚焦时折叠元信息区（标题/summary/分类/标签/状态/发布时间/上传等），保留顶部操作区
- [ ] 聚焦时编辑器高度自适应增大（上限与最小高度可配置；窗口 resize 时更新）
- [ ] 离焦恢复元信息区，且不丢输入状态

### 2.3 预览触发时的左侧定位
- [ ] 点击“刷新预览”时：让左侧编辑器自动聚焦，并定位到当前光标附近（而不是跳到顶部）
- [ ] 点击预览内容时（可选）：按最近标题匹配并定位到 Markdown 对应段落；匹配不到则回退到光标定位

### 2.4 自测清单（Admin）
- [ ] Focus mode 在 Split/Write 下可用；Preview-only 不触发
- [ ] 折叠/展开动画在 `prefers-reduced-motion` 下自动关闭
- [ ] 不影响保存（Mod+S）、图片上传、布局切换与渲染预览

---

## 3. 验收标准（DoD）
- [ ] Web 与 Admin 的关键页面在视觉与交互上对齐 `docs/ui-style-sync` 方向
- [ ] 现有功能无明显回归（Web 搜索/过滤/TOC/快捷键；Admin 渲染/保存/上传/布局）
- [ ] 代码结构可维护：CSS/JS 资产位置清晰，模板变量清晰，避免大段重复 inline CSS
