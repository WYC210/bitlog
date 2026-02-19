# Task：执行清单（按小步可验证拆分）

## 0. 准备

- [ ] 确认 About 页面模块顺序与文案（已确认：导航含“关于我”，模块按需求）
- [ ] 确认 3D 地球采用方案：Option A + 自托管（已确认）

## 1. Web：导航 + /about 页面骨架

- [ ] 更新模板导航：`apps/web/public/_templates/home.html` 增加“关于我”
- [ ] 更新模板导航：`apps/web/public/_templates/articles.html` 增加“关于我”
- [ ] 更新模板导航：`apps/web/public/_templates/post.html` 增加“关于我”
- [ ] 更新模板导航：`apps/web/public/_templates/page.html` 增加“关于我”并加 `{{NAV_ABOUT_ACTIVE}}`
- [ ] 新增路由：`apps/web/src/app.ts` 增加 `GET /about`（渲染模块容器 + 引入 `/ui/about/about.js`）

验收：
- [ ] 点击导航进入 `/about`，页面正常渲染且无控制台报错

## 2. API：新增 first-party 接口

- [ ] `apps/api/src/app.ts` 增加 `GET /api/weather-now`（IP 定位 + 天气上游 + 全字段返回）
- [ ] `apps/api/src/app.ts` 增加 `GET /api/news-image`（代理图片，设置正确 content-type）
- [ ] `apps/api/src/app.ts` 增加 `GET /api/programmer-history`（代理 JSON，events 列表）
- [ ] `apps/api/src/app.ts` 增加 `GET /api/about-config`（读取 settings about keys 并解析 JSON）

验收：
- [ ] 四个接口分别能返回 ok=true 的数据/图片
- [ ] 上游失败时返回 ok=false 且前端可展示错误

## 3. Admin：About 配置可编辑

- [ ] `apps/admin/src/pages/SettingsPage.tsx` 新增 About 配置区块（3 个 CodeEditor）
- [ ] 增加公开读取接口 `GET /api/about-config`（从 settings 读取 about keys 并解析 JSON）
- [ ] Admin 保存配置走现有 `PUT /api/admin/settings`（保存后会 bump cache_version）

验收：
- [ ] 后台保存配置成功，刷新 `/about` 能看到配置变化

## 4. 静态资源：maps + wasm + three 自托管

- [ ] 迁移 maps 到 `apps/web/public/maps/`
- [ ] 迁移 wasm 到 `apps/web/public/wasm/geo/`
- [ ] 引入 three 到 `apps/web/public/vendor/three/`（含 examples）
- [ ] 如 wasm MIME 不正确，补充 Web 层路由修正 header

验收：
- [ ] 浏览器能直接访问 maps / wasm 文件
- [ ] `.wasm` 响应头为 `application/wasm`（或至少地球能正常初始化）

## 5. 前端脚本：About 渲染 + 3D 地球初始化

- [ ] 新增 `apps/web/public/ui/about/about.js`
  - 拉取 `/api/about-config`
  - 渲染技术栈/过往
  - 加载新闻图片与历史事件（调用对应 API）
  - 天气调用 `/api/weather-now` 并展示全字段
- [ ] 新增 `apps/web/public/ui/about/world-heatmap.js`
  - 从旧 `WorldHeatmap.tsx` 抽离核心逻辑为纯 JS
  - 支持 visitedPlaces 输入

验收：
- [ ] `/about` 首屏可用：天气/快讯展示正常
- [ ] 3D 地球可交互且不阻塞其他模块渲染

## 6. 回归与发布

- [ ] Typecheck：`npx tsc -p apps/api/tsconfig.json --noEmit`
- [ ] Typecheck：`npx tsc -p apps/web/tsconfig.json --noEmit`
- [ ] Typecheck：`pnpm -C apps/admin typecheck`
- [ ] Cloudflare 环境实测 `/about`、wasm/mime、图片接口
- [ ] （可选）加版本同步：前端轮询 cache_version 或在 `/api/about-config` 返回 version
