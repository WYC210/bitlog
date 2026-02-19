# How：实现方案（Option A：纯原生 JS + 自托管资源）

## 总体思路

- Web 前台（`apps/web`）新增 `/about` 路由，用现有 `page.html` 模板渲染页面骨架。
- 交互部分统一由一个自托管脚本入口负责（例如 `/ui/about/about.js`）。
- 后端（`apps/api`）提供 first-party 同源接口：天气、新闻图片、程序员历史事件、about 配置读取。
- 后台（`apps/admin`）在「站点设置」页新增 About 配置编辑（存 settings），前台 `/about` 读取并渲染。

## 路由与页面

### 1) 主导航加入「关于我」

更新 `apps/web/public/_templates/*.html`：
- 增加 `<a ... href="/about">关于我</a>`
- 需要在模板变量中增加 `{{NAV_ABOUT_ACTIVE}}`（与其他 active 类一致）

### 2) Web 路由新增 `/about`

在 `apps/web/src/app.ts` 增加：
- `GET /about`：渲染模块容器
  - `实时天气`：`<div id="about-weather"></div>`
  - `今日快讯`：`<img id="about-news-image" ...>` + `<div id="about-history"></div>`
  - `技术栈`：`<div id="about-tech"></div>`
  - `旅行足迹`：`<div id="about-heatmap"></div>`
  - `过往`：`<div id="about-timeline"></div>`
- 在页面末尾引入脚本：`<script type="module" src="/ui/about/about.js?__cv={{CACHE_VERSION}}"></script>`

## 后端 API（first-party）

### 1) `GET /api/weather-now`

- 输入：无（基于 request IP）
- 行为：
  - 从 `cf-connecting-ip` / `x-forwarded-for` 取 IP
  - 用 IP → 定位城市（上游定位/或复用现有 ip-location 能力）
  - 调用天气上游接口（返回字段如 province/city/adcode/weather/weather_code/temperature/wind_direction/wind_power/humidity/report_time 等）
- 输出：
  - `{ ok: true, ...所有字段..., raw }`
  - 若上游返回已经是 JSON，raw 保留原始对象
- 约束：超时、rate limit、上游错误用统一 `{ ok:false, error:{...} }`

### 2) `GET /api/news-image`

- 代理“每日新闻图片”上游
- 直接返回图片二进制（设置正确 `content-type`）
- 缓存：允许短缓存（例如 5~30 分钟）以减轻上游压力

### 3) `GET /api/programmer-history`

- 代理上游 `history/programmer/today`
- 输出结构对齐：
  - `{ ok:true, message, date, events:[...] }`

### 4) `GET /api/about-config`

- 从 settings 读取 about 相关 key（JSON 文本）
- 输出：
  - `{ ok:true, config:{ techStack, visitedPlaces, timeline } }`
- 说明：该接口公开，不返回敏感字段

## 后台配置（settings）

沿用现有 settings 模型（`/api/admin/settings`）：
- 新增 keys（建议）：
  - `about.tech_stack_json`：数组（技术项：name/icon/color/desc/category 等）
  - `about.travel_places_json`：字符串数组（如 `"中国-北京"`）
  - `about.timeline_json`：数组（时间线节点）
  - （可选）`about.module_order_json` / `about.modules_enabled_json`
- Admin UI：在 `SettingsPage` 加一个 About 区域：
  - 3 个 CodeEditor（已支持高亮/格式化）
  - 保存时一起写入 settings（并触发 cache_version bump）

## 旅行足迹 3D 地球（关键：自托管 + 纯 JS）

### 资源迁移（自托管）

从 `newechoes_gitee` 迁移到 `apps/web/public`：
- maps：
  - `newechoes_gitee/public/maps/world.zh.json` → `apps/web/public/maps/world.zh.json`
  - `newechoes_gitee/public/maps/china.json` → `apps/web/public/maps/china.json`
- wasm：
  - `newechoes_gitee/src/assets/wasm/geo/geo_wasm.js` → `apps/web/public/wasm/geo/geo_wasm.js`
  - `newechoes_gitee/src/assets/wasm/geo/geo_wasm_bg.wasm` → `apps/web/public/wasm/geo/geo_wasm_bg.wasm`

### WASM MIME 类型

需要确保 `.wasm` 返回头 `Content-Type: application/wasm`：
- Cloudflare 静态资源通常能正确识别，但若不正确会触发 `instantiate` fallback（能跑但更慢）
- 如遇到 MIME 问题：在 Web Worker 层对 `/wasm/*.wasm` 追加 content-type header

### Three.js 取用方式（自托管）

不使用 CDN，原因：稳定性与可控性。
做法：
- 把 `three` 的 ESM 文件及所需 examples（OrbitControls/CSS2DRenderer）放入 `apps/web/public/vendor/three/`
- `about.js`/`world-heatmap.js` 用相对路径 `import` 加载

### 代码迁移策略

将 `newechoes_gitee/src/components/WorldHeatmap.tsx` 抽离为纯函数模块：
- `apps/web/public/ui/about/world-heatmap.js`
  - 导出 `initWorldHeatmap(el, visitedPlaces, opts)`
  - 内部负责加载 maps + wasm + three 并初始化场景
- `apps/web/public/ui/about/about.js`
  - 请求 `/api/about-config`
  - 渲染技术栈/过往模块
  - 调用 `initWorldHeatmap(...)`

## 同步策略（后台修改如何及时生效）

- 默认：刷新/重进页面即同步（因为 `/about` 与 `/api/about-config` 会获取最新）
- 可选增强（后续迭代）：
  - 定时轮询 `site.cache_version`（或在 `/api/about-config` 返回 version）
  - 检测到版本变化后自动刷新模块数据/提示用户刷新页面

## 风险与规避

- 上游接口不可用：返回标准错误，前端展示错误态并允许重试
- IP 自动定位不准：允许在 About 配置中增加“默认城市覆盖”（可选）
- WASM/Three 资源路径与 MIME：上线前在 Cloudflare 环境实测
- 性能：3D 地球延迟加载（页面可先显示 skeleton/占位）

