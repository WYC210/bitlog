# 任务清单：5 风格主题适配（Web 换皮 + Admin Demo 布局）
目录：`helloagents/plan/202602211620_ui_multi_style_pack/`

## 0. 风格定义（确认项）
- [ ] 风格枚举：`current/classic/glass/brutal/terminal`
- [ ] 默认值：Web=`current`、Admin=`current`

## 1. API：站点配置新增（D1 settings）
- [ ] `apps/api/src/services/settings.ts`：新增 key `ui.web_style`、`ui.admin_style`，纳入 `getSiteConfig()` 输出
- [ ] `apps/api/src/services/settings.ts`：对新增 key 做值域校验（非法值 400）
- [ ] `apps/api/src/app.ts`：确认 `/api/config` 返回包含这两项（并被 cache 体系覆盖）
- [ ] （可选）为新 key 写一段最小单测/脚本（如仓库没有测试则跳过）

## 2. Admin：SettingsPage 增加配置入口（站点级）
- [ ] `apps/admin/src/api.ts`：扩展 `SiteConfig` 类型（增加 `webStyle/adminStyle` 或直出 string 字段）
- [ ] `apps/admin/src/pages/SettingsPage.tsx`：新增「Web 风格」「Admin 风格」两个选择器
- [ ] 保存走 `/api/admin/settings`：写入 `ui.web_style` / `ui.admin_style`
- [ ] 保存后刷新 `getConfig()` 并在 Admin 端立即应用 `data-ui-style`（避免需要手动刷新）

## 3. Web：仅换皮（不改布局）
- [ ] `apps/web/public/_templates/*.html`：在 `<html>` 增加 `data-ui-style="{{UI_WEB_STYLE}}"`
- [ ] `apps/web/src/app.ts`：模板变量注入 `UI_WEB_STYLE`（缺省 `current`）
- [ ] `apps/web/public/ui/style-pack.css`：新增风格覆盖（仅 tokens + 非布局修饰）
- [ ] 模板引入 `style-pack.css`（确保在 `base.css` 之后）
- [ ] 手工自测：`/`、`/articles`、`/articles/:slug`、`/about`、`/projects`、`/tools`
  - [ ] 375/768/1024/1440 宽度无布局断裂
  - [ ] light/dark 切换仍可用

## 4. Admin：改为 demo 布局（保持功能）
参考：`docs/admin-ui-demos/*`（尤其是 `_shared/base.css` 与各页 html）。

- [ ] 引入 demo 样式体系
  - [ ] `apps/admin/src/ui/base.css`：同步 `docs/admin-ui-demos/_shared/base.css`
  - [ ] `apps/admin/src/ui/themes.css`：同步 4 套 demo `theme.css` + `current` 覆盖
  - [ ] `apps/admin/src/main.tsx`：改为引入新样式入口
- [ ] 复刻 demo 布局结构（React 组件/DOM）
  - [ ] `apps/admin/src/App.tsx`：重构为 demo 的 topbar/nav + content 架构
  - [ ] `apps/admin/src/pages/LoginPage.tsx`：对齐 demo login 布局
  - [ ] `apps/admin/src/pages/PostsPage.tsx`：对齐 demo posts 布局
  - [ ] `apps/admin/src/pages/EditorPage.tsx`：对齐 demo editor 布局（保留 CodeMirror/上传/保存/布局切换等）
  - [ ] `apps/admin/src/pages/AccountPage.tsx`、`apps/admin/src/pages/SettingsPage.tsx`：对齐 demo 对应页面结构
- [ ] Admin 主题应用
  - [ ] App 启动：`getConfig()` 后设置 `html[data-ui-style]`
  - [ ] localStorage 兜底（减少 FOUC）：`ui-admin-style-last`

## 5. 联调与验收
- [ ] 本地：`pnpm run dev:api` + `pnpm run dev:web`
- [ ] 在 Admin 保存风格配置后：
  - [ ] Web 刷新可立即看到新风格（依赖 cacheVersion bump）
  - [ ] Admin 刷新/重新打开可看到新风格
- [ ] 回归：文章 CRUD、上传、设置保存、快捷键、Web 搜索/TOC/代码高亮不回归

