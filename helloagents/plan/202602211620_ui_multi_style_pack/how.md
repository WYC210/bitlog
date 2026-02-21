# 技术方案：5 风格主题系统 + Web/Admin 独立选择

## 1. 现状概览（代码结构）
- API（D1 设置存储）：`apps/api/src/services/settings.ts`（读取 `settings` 表） + `apps/api/src/app.ts`（`/api/config`、`/api/admin/settings`）。
- Web（Worker SSR + 模板）：`apps/web/src/app.ts` 渲染 `apps/web/public/_templates/*.html`，样式位于 `apps/web/public/ui/*.css`，明暗切换基于 `html[data-theme]` + `localStorage("ui-theme")`。
- Admin（Vite + React）：`apps/admin/src/*`，全局样式 `apps/admin/src/styles.css`，构建产物输出至 `apps/web/public/admin/`（由 `pnpm run dev:web/deploy:web` 触发）。
- Demo 参考：
  - Web demo：`docs/blog-ui-demos/*`
  - Admin demo：`docs/admin-ui-demos/*`

## 2. 配置与数据模型（站点级）
新增 2 个站点设置 key（写入 D1 `settings` 表）：
- `ui.web_style`: `"current" | "classic" | "glass" | "brutal" | "terminal"`
- `ui.admin_style`: `"current" | "classic" | "glass" | "brutal" | "terminal"`

实现要点：
- 在 `getSiteConfig()` 中把两项读出并下发到 `/api/config` 响应。
- 在 `setSettings()` 中对这两个 key 做白名单校验（非法值返回 400）。
- 保持现有 `bumpCacheVersion()`：当 Admin 保存设置时自动递增 cacheVersion，用于 Web HTML/CSS/JS 资源的缓存刷新。

## 3. Web：不改布局的“换皮”策略
目标：只改变风格，不动页面结构与布局。

### 3.1 挂载方式
在模板 `apps/web/public/_templates/*.html` 的 `<html>` 上加入：
- `data-ui-style="{{UI_WEB_STYLE}}"`

由 `apps/web/src/app.ts` 在 `replaceAll()` 时注入 `UI_WEB_STYLE`（取自 `/api/config` 的 `ui.web_style`，缺省为 `current`）。

### 3.2 样式组织
新增一个 Web 风格覆盖文件（放在基础样式之后加载）：
- `apps/web/public/ui/style-pack.css`

其内容只做两类事情：
1) **Token 覆盖（优先）**：基于 `[data-ui-style="..."]` 覆盖 `apps/web/public/ui/base.css` 使用的 CSS 变量，例如：
   - 颜色：`--bg/--surface/--text/--muted/--border/--primary/...`
   - 阴影/圆角：`--shadow/--radius/...`
   - 字体：terminal 风格覆盖 `--font` 或直接覆盖 `body { font-family: ... }`
2) **背景质感（可选）**：例如 terminal 扫描线、brutal 更硬的边框/阴影效果等；但禁止改动布局属性（display/grid/flex/width/position 等）。

### 3.3 与 light/dark 的关系
- 继续保留现有 `data-theme="light|dark"` 机制与 `theme-toggle.js`。
- `data-ui-style` 与 `data-theme` 正交：风格控制“设计语言”，明暗控制“色阶”。实现上优先使用 CSS 变量叠加：
  - `:root` 定义 current 风格的 light tokens
  - `[data-theme="dark"]` 覆盖 dark tokens
  - `[data-ui-style="glass"]` 覆盖 glass 风格 tokens（两套：light 与 dark 可分别覆盖）

### 3.4 过渡动画一致性
Web 端主题切换需要保留现有过渡体验：
- 优先：使用 `document.startViewTransition` 的遮罩扩散过渡（并配合 ripple）。
- 降级：添加 `html.theme-transition`，让颜色/背景/边框/阴影等走统一 transition（约 320ms）。
- 无障碍：`prefers-reduced-motion: reduce` 时禁用动画。

## 4. Admin：改为 Demo 布局 + 5 风格切换
目标：页面布局与 `docs/admin-ui-demos/*` 对齐，同时保留现有业务能力。

### 4.1 布局对齐策略
以 `docs/admin-ui-demos/_shared/base.css` 的结构为基准，在 React 中复刻其 DOM 结构与 class 命名：
- `topbar`：品牌 + 搜索（可选）+ 主导航
- `page/content`：左侧列表区域 + 右侧侧栏（或卡片区）
- `card/pill/chip/btn`：与 demo 统一的组件语义与 class

实现方式建议：
- 新增 `apps/admin/src/layouts/AdminShell.tsx`（或类似）：
  - 负责渲染 topbar/nav
  - 根据 route 渲染主区域
  - 设置 `document.body.dataset.page`（模拟 demo 的 `data-page` 用于高亮）

### 4.2 样式组织（推荐复用 demo）
将 demo 的样式体系引入 Admin：
- 基础样式：从 `docs/admin-ui-demos/_shared/base.css` 同步到 `apps/admin/src/ui/base.css`
- 主题覆盖：从 `docs/admin-ui-demos/{classic|glass|brutal|terminal}/theme.css` 同步到 `apps/admin/src/ui/themes.css`（或分文件）
- 第 5 种 `current`：基于现有 `apps/admin/src/styles.css` 的 token 体系，提供一个 `current` 覆盖块（或把现有 token 抽成 `current` 主题覆盖文件）

Admin 通过 `data-ui-style` 挂载主题：
- `document.documentElement.setAttribute("data-ui-style", cfg.adminStyle)`
  - cfg 来自 `/api/config`
  - 允许用 localStorage 做启动阶段兜底，待接口返回后以站点配置覆盖

### 4.3 SettingsPage：站点级主题切换入口
在现有 `apps/admin/src/pages/SettingsPage.tsx` 增加两项选择器：
- Web 风格（写 `ui.web_style`）
- Admin 风格（写 `ui.admin_style`）

保存路径仍走现有 `updateSettings()` -> `/api/admin/settings`，并依赖 API 侧 `bumpCacheVersion()` 刷新 Web 端缓存版本。

### 4.4 Admin 明暗模式与过渡动画
Admin 也需要支持 `light/dark` 并带过渡动画，策略与 Web 对齐：
- 交互：提供一个主题按钮（位置建议放在 topbar actions）。
- 存储：站点级仍以 `settings` 为准；为减少首次闪烁，允许用 localStorage 做启动兜底。
- 动画：同样优先 View Transitions + ripple，降级为 CSS transition，遵循 `prefers-reduced-motion`。

## 5. 风险与规避
- 风险：Admin 是静态资源，站点级配置变更后首次打开可能闪烁（先默认 current，后应用配置）。
  - 规避：在 Admin 启动时先读取 localStorage 的上次应用值，随后以 `/api/config` 覆盖并写回 localStorage。
- 风险：Web “只换皮”范围失控导致布局变化。
  - 规避：Web 皮肤文件只允许覆盖 CSS 变量与非布局属性；在 code review / diff 上严格把关。
- 风险：demo token 与现有 web token 命名不一致导致主题还原度不足。
  - 规避：以“变量映射表”方式逐步补齐（先覆盖全局背景/文字/卡片/按钮四大类，必要时再补局部修饰）。
