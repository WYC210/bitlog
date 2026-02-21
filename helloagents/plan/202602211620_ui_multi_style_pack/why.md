# 变更提案：5 种风格主题适配（Web 仅换皮；Admin 改为 Demo 布局）

## 需求背景
当前 Bitlog 已有一套“现有风格”（作为第 5 种风格，且为默认风格）。现在希望把 `docs/*-ui-demos` 中的 4 套风格（classic / glass / brutal / terminal）适配进真实站点，并且允许**前台（Web）与后台（Admin）独立选择并自由搭配**（例如：Web=Glass，Admin=Brutal）。

此外需要注意：
- Web：**整体布局不变**，只应用主题风格（颜色/字体/阴影/圆角/背景质感等）。
- Admin：**整体布局需要改成 demo 的布局**（参考 `docs/admin-ui-demos/*`），同时仍支持 5 套风格切换。

## 目标
1. 提供 5 套可选风格：
   - `current`（现有线上风格，默认）
   - `classic` / `glass` / `brutal` / `terminal`（来自 demo）
2. 站点级配置：在后台 `SettingsPage` 增加「Web 风格」与「Admin 风格」两个配置项，保存到 D1 `settings` 表，影响全站。
3. Web 不改布局：不改 `apps/web/public/_templates/*` 的结构语义，只在 `html/body` 增加挂载属性并加载皮肤 CSS。
4. Admin 改布局：将 `apps/admin` 的 React 页面结构调整为 demo 的信息架构与组件布局（topbar/nav/content/card 等），并保留现有功能（登录、文章列表、编辑器、设置、账号等）。

## 非目标（本次不做）
- 不做按用户（admin 用户）级别的主题偏好。
- 不改变 API 数据结构与 Markdown 渲染逻辑（仅 UI 呈现与布局/样式）。
- 不追求 Web 与 Admin 的组件代码复用（先保证落地与可维护）。

## 约束与边界
- 允许在 Web / Admin 的 `html` 或 `body` 上增加 `data-ui-style="..."`（以及必要的 class）用于样式挂载。
- Web 的主题切换必须不引入布局抖动：仅覆盖 token（CSS 变量）与非布局属性（颜色、背景、阴影、字体等），不改 grid/flow/flex 结构。
- Admin 的“demo 布局”以 `docs/admin-ui-demos/_shared/base.css` + 各主题 `theme.css` 的结构为参考基准。
- 主题切换需保持“现有博客”同等体验：支持 `light/dark` 明暗模式并带过渡动画（优先 View Transitions，降级为 CSS transition，遵循 `prefers-reduced-motion`）。

## 验收标准（可验证）
1. 默认情况下（未配置）Web 与 Admin 都呈现 `current` 风格。
2. 在 `SettingsPage` 选择 Web / Admin 风格并保存后：
   - Web 页面刷新即可生效（无需清缓存手工操作）。
   - Admin 页面在重新打开/刷新后生效（允许短暂加载后应用，但需控制闪烁）。
3. Web 布局与现状一致（页面结构、组件位置、间距体系不被主题切换破坏）。
4. Admin 布局与 demo 一致（信息架构与关键区域位置对齐），并且核心功能可用（登录、列表、编辑、保存、设置保存、上传等）。
5. `current/classic/glass/brutal/terminal` 五套风格在 Web 与 Admin 均支持 `light/dark` 切换，且切换有平滑过渡动画。
