# Bitlog 访问分析真实落地方案

本文基于当前仓库代码、当前 Cloudflare Worker 部署方式，以及已确认的 Cloudflare Web Analytics / Workers Analytics Engine 能力边界整理。

目标不是讨论“理论上能不能做”，而是明确：

- 现在立刻能上线什么
- 哪些要改代码才能上线
- 哪些需要改后台路由架构
- 每一项要怎么校验

---

## 1. 当前代码现状

### 1.1 部署和路由结构

- Web 站点由 `apps/web` 的 Worker 提供。
- 前台是同域 SSR + 局部 SPA 切页。
- 后台是同域静态 Admin，但当前是 `hash` 路由。

关键代码：

- [apps/web/src/app.ts](E:/wz/bitlog/apps/web/src/app.ts:579)
  - `/admin` 重定向到 `/admin/`
- [apps/web/src/app.ts](E:/wz/bitlog/apps/web/src/app.ts:581)
  - `/admin/*` 最终回退到 `/admin/index.html`
- [apps/admin/src/routes.ts](E:/wz/bitlog/apps/admin/src/routes.ts:8)
  - 后台通过 `window.location.hash` 解析页面
- [apps/web/public/ui/shortcuts.js](E:/wz/bitlog/apps/web/public/ui/shortcuts.js:412)
  - 后台跳转明确写成 `/admin/#/posts`、`/admin/#/settings`
- [apps/web/public/ui/spa-nav.js](E:/wz/bitlog/apps/web/public/ui/spa-nav.js:5)
  - 前台 SPA 路径为 `/`、`/articles`、`/hot`、`/projects`、`/tools`、`/about`
- [apps/web/public/ui/spa-nav.js](E:/wz/bitlog/apps/web/public/ui/spa-nav.js:371)
  - 前台切页使用 `history.pushState`

### 1.2 当前统计接入状态

- 仓库内没有发现你自己手写的 Web Analytics snippet 集成代码。
- 也没有发现你自己的 `sendBeacon` / 停留时长 / bounce 埋点代码。
- 现在更像是准备依赖 Cloudflare 控制台里的 Web Analytics 自动注入。

### 1.3 对统计最重要的现状结论

#### 前台

前台是真实路径，天然适合 Web Analytics：

- `/`
- `/articles`
- `/articles/:slug`
- `/projects`
- `/tools`
- `/tools/:slug`
- `/about`
- `/hot`

#### 后台

后台当前不是：

- `/admin/posts`
- `/admin/settings`
- `/admin/account`

而是：

- `/admin/#/posts`
- `/admin/#/settings`
- `/admin/#/account`

这意味着 Cloudflare Web Analytics 的 `Path` 维度大概率只能看到：

- `/admin`
- `/admin/`

而看不到 `#/posts` 这一层。

---

## 2. 你的访问分析页，按“卡片/模块”逐项拆解

以下以你 demo 里的访问分析页为目标。

### 2.1 可以直接由 Cloudflare Web Analytics 提供

| 页面模块 | 可行性 | 数据来源 | 备注 |
| --- | --- | --- | --- |
| 总访问量 | 可以 | Web Analytics `Page views` | 适合做总量卡片 |
| 访问趋势图 | 可以 | Web Analytics `Page views` 按时间聚合 | 可做 24h / 7d / 30d |
| 路径排行 | 可以 | Web Analytics `Path` 维度 | 前台路径没问题 |
| 流量来源 | 可以 | Web Analytics `Referer` 维度 | 可做来源占比 |
| 浏览器 | 可以 | Web Analytics `Browser` 维度 | 可做维度卡片 |
| 设备类型 | 可以 | Web Analytics `Device type` 维度 | 可做维度卡片 |
| Host/域名区分 | 可以 | Web Analytics `Host` 维度 | 适合区分主域/子域 |

这里的依据是 Cloudflare 官方文档确认提供：

- `Path`
- `Referer`
- `Browser`
- `Device type`
- `Host`

参考：

- Cloudflare Web Analytics Dimensions  
  https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/

### 2.2 可以“近似映射”，但要改文案

| 页面模块 | 当前建议 | 原因 |
| --- | --- | --- |
| 独立访客 | 先改成 `Visits` 或 `访次` | Cloudflare 官方高层指标里明确的是 `Visits`，不是你现在 demo 文案里的“独立访客” |

Cloudflare 官方高层指标当前明确列出：

- Visits
- Page views
- Page load time
- Core Web Vitals

参考：

- High-level metrics  
  https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/

所以第一版后台如果你想少踩坑，我建议把：

- `独立访客`

先改成：

- `访次`

或者：

- `访问次数`

这样和 Cloudflare 原生口径更贴近。

### 2.3 不能直接靠 Web Analytics 做出来

| 页面模块 | 可行性 | 原因 |
| --- | --- | --- |
| 平均停留 | 不可直接获得 | 当前没有自定义会话级埋点 |
| 跳出率 | 不可直接获得 | 当前没有自定义会话级埋点 |
| 后台子页面排行，如 `/admin/posts`、`/admin/settings` | 不可直接获得 | 当前后台是 hash 路由 |
| 后台页面趋势图，按后台具体模块拆分 | 不可直接获得 | 同上，当前只会被压到 `/admin/` |

### 2.4 疑似可行，但必须先校验

| 页面模块 | 状态 | 原因 |
| --- | --- | --- |
| 前台 SPA 切页是否自动记成新页面 | 待校验 | 前台使用 `pushState`，Cloudflare 官方支持 SPA 自动追踪 |
| 后台 `/admin/` 整体访问是否被自动统计 | 待校验 | 理论上后台入口也是 HTML，但你现在依赖自动注入 |

参考：

- SPA 支持说明  
  https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/
- Web Analytics 启用说明  
  https://developers.cloudflare.com/web-analytics/get-started/

注意一条关键限制：

- Cloudflare 官方明确说 `hash-based routers are not supported`

这正好对应你现在后台的结构。

---

## 3. 推荐的真实落地路线

不建议一上来就追求你 demo 里的完整分析页。正确顺序应该是两阶段。

## 阶段 A：先上线可直接落地的分析页

目标：不改后台路由架构，不引入自定义事件系统，先让后台 `访问分析` 页有真实数据。

### 3.1 阶段 A 页面范围

第一版后台分析页只展示这些模块：

1. 总访问量
2. 访次
3. 访问趋势
4. 路径排行
5. 来源分布
6. 浏览器分布
7. 设备分布

### 3.2 阶段 A 数据来源

全部来自 Cloudflare Web Analytics：

- Page views
- Visits
- Path
- Referer
- Browser
- Device type
- Host

### 3.3 阶段 A 页面文案建议

把你现在 demo 里的这两项改掉：

- `独立访客` -> `访次`
- `平均停留` -> `页面加载时间` 或临时隐藏
- `跳出率` -> 临时隐藏

#### 推荐第一版卡片

- 页面浏览
- 访次
- 页面加载时间
- 设备占比

如果你要保持四张卡片结构，这是当前最稳的方案。

### 3.4 阶段 A 后台路径解释

第一版必须接受一个现实：

- 前台路径可以细分到 `/articles/slug`
- 后台路径只能先展示 `/admin/` 这一层汇总

不要在第一版里假装自己已经有：

- `/admin/posts`
- `/admin/settings`
- `/admin/account`

这些细粒度路径统计。

---

## 阶段 B：补自定义埋点，做成你想要的后台分析页

目标：补齐以下能力：

1. 平均停留
2. 跳出率
3. 后台虚拟页面路径统计
4. 更细的交互行为统计

推荐用：

- Cloudflare Web Analytics 负责基础流量
- Workers Analytics Engine 负责自定义事件

参考：

- Workers Analytics Engine 概览  
  https://developers.cloudflare.com/analytics/analytics-engine
- Get started with Workers Analytics Engine  
  https://developers.cloudflare.com/analytics/analytics-engine/get-started/
- Write to Analytics Engine  
  https://developers.cloudflare.com/workers/examples/analytics-engine/
- Query from a Worker  
  https://developers.cloudflare.com/analytics/analytics-engine/worker-querying/

### 3.5 阶段 B 要新增的事件类型

建议至少定义 4 类事件。

#### 事件 1：虚拟页面浏览 `page_view`

用于补齐后台 hash 路由统计。

建议字段：

- `event = page_view`
- `host`
- `pathname`
- `virtual_path`
- `page_type`
- `is_admin`
- `referrer_host`
- `session_id`

示例：

- 前台文章页
  - `pathname = /articles/my-post`
  - `virtual_path = /articles/my-post`
  - `page_type = article`
  - `is_admin = 0`

- 后台文章页
  - `pathname = /admin/`
  - `virtual_path = /admin/posts`
  - `page_type = admin_posts`
  - `is_admin = 1`

#### 事件 2：会话开始 `session_start`

用于后续计算 bounce 和 session 层指标。

建议字段：

- `session_id`
- `landing_virtual_path`
- `host`
- `is_admin`
- `referrer_host`
- `device_type`

#### 事件 3：会话结束 `session_end`

用于计算停留时长。

建议字段：

- `session_id`
- `duration_ms`
- `page_count`
- `last_virtual_path`
- `is_bounce`

#### 事件 4：关键交互 `action`

用于未来扩展后台分析。

建议字段：

- `action_name`
- `virtual_path`
- `target_id`
- `target_type`

例子：

- `open_post_editor`
- `publish_post`
- `search_posts`
- `filter_tags`

---

## 4. 后台 hash 路由问题，怎么补

这是整套方案里最关键的现实问题。

## 方案 1：短期最稳，保留 hash 路由，自己补“虚拟路径”

这是我最建议你现在做的。

做法：

1. 后台仍然保持 `#/posts`、`#/settings`
2. 每次 hash 变化时，前端手动上报一个 `page_view`
3. 在事件里写：
   - `pathname = /admin/`
   - `virtual_path = /admin/posts`

这样你的后台分析页就能展示：

- `/admin/posts`
- `/admin/settings`
- `/admin/account`

但这套数据来自你自己的 Analytics Engine，不是原生 Web Analytics。

### 为什么推荐这个方案

- 不需要重写后台路由
- 不影响现有构建
- 能最快把 demo 里的“后台路径排行”做成真的

## 方案 2：中期改造，把后台改成真路径

目标变成：

- `/admin/posts`
- `/admin/settings`
- `/admin/account`

而不是：

- `/admin/#/posts`

这会带来两个好处：

1. Cloudflare Web Analytics 可以直接按真实路径统计后台页面
2. 后台 URL 语义更清晰

但它是明显更大的改造，涉及：

- React Router 方案切换
- Worker 回退规则
- 后台内部跳转逻辑
- 现有快捷键 / 侧栏链接

对于你当前阶段，我不建议先做这个。

---

## 5. 数据接入建议

## 5.1 第一版接口层

建议在 `apps/api` 里新增一组专门的后台分析接口：

- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/trend`
- `GET /api/admin/analytics/paths`
- `GET /api/admin/analytics/dimensions`

第一版可以先返回 mock + 手工拼接格式，等 Cloudflare 数据接入后再替换。

## 5.2 最稳的查询来源

### 来源 A：Cloudflare Web Analytics

用来填这些模块：

- overview 的 page views / visits
- trend
- top paths
- referer
- browser
- device type

### 来源 B：Workers Analytics Engine

用来填这些模块：

- admin virtual paths
- avg session duration
- bounce rate
- custom actions

---

## 6. 推荐的后台访问分析页版本拆分

## V1：一周内能做出的真实版本

展示：

- 页面浏览
- 访次
- 趋势图
- 前台路径排行
- 来源
- 浏览器
- 设备

不展示：

- 平均停留
- 跳出率
- 后台页面级排行

## V2：补自定义埋点后的版本

新增：

- 平均停留
- 跳出率
- 后台虚拟路径排行
- 后台模块趋势图

## V3：产品级版本

新增：

- 按文章 slug 统计
- 按标签统计入口流量
- 按后台操作行为统计
- 发布转化漏斗

---

## 7. 逐项校验清单

这部分可以直接拿去操作。

## 7.1 校验 Web Analytics 是否真的注入

操作：

1. 打开 `https://你的域名/`
2. F12 -> Elements
3. 搜以下关键词：
   - `cloudflareinsights`
   - `cf-beacon`
   - `beacon.min.js`
4. F12 -> Network
5. 刷新页面后搜：
   - `beacon`
   - `insights`

预期：

- 能看到 Cloudflare 的 beacon 脚本或请求

如果看不到：

- 说明自动注入没有生效
- 这时应该切换到手动 JS snippet

参考：

- Enabling Cloudflare Web Analytics  
  https://developers.cloudflare.com/web-analytics/get-started/

## 7.2 校验前台 SPA 切页统计

操作：

1. 打开首页
2. 点击到 `/articles`
3. 点击到 `/projects`
4. 点击到 `/about`
5. 看 Network 里是否每次切页都出现新 beacon 请求

预期：

- 每次前台切页都应出现新统计请求

如果没有：

- 说明虽然使用了 `pushState`，但自动 SPA 跟踪没有工作
- 需要切换到手动 snippet 或手动 page_view 上报

## 7.3 校验后台整体 `/admin/` 是否统计成功

操作：

1. 打开 `/admin/`
2. 完整停留几秒
3. 刷新几次
4. 过几分钟后查看 Web Analytics 的 `Path`

预期：

- 至少能看到 `/admin/` 一条记录

## 7.4 校验后台 hash 子页是否被压扁

操作：

1. 依次访问：
   - `/admin/#/posts`
   - `/admin/#/settings`
   - `/admin/#/account`
2. 查看 Web Analytics 的 `Path`

预期：

- 大概率仍然只会出现 `/admin/`

如果结果真是这样：

- 就证明后台细粒度路径统计必须走“虚拟路径埋点”

## 7.5 校验 Worker 自动注入是否被响应头干扰

Cloudflare 官方明确说明：

- 如果页面响应带 `Cache-Control: public, no-transform`
- 自动注入不会生效

你的仓库里目前看到这个头在 SSE API 上，而不是 HTML 主页面：

- [apps/api/src/app.ts](E:/wz/bitlog/apps/api/src/app.ts:909)

所以当前它不是“已确认阻塞项”，但仍建议实际抓包确认前台/后台 HTML 响应头。

操作：

1. F12 -> Network
2. 点开首页 HTML 请求
3. 看 Response Headers 的 `cache-control`
4. 再对 `/admin/` 做同样检查

如果看到：

- `public, no-transform`

那就不要再用自动注入，直接改成手动 snippet。

---

## 8. 最终建议

### 现在就做

1. 先把访问分析页第一版收敛成 Cloudflare 原生能支持的模块
2. 文案改成真实口径
3. 先把前台真实路径统计跑通
4. 确认后台至少能拿到 `/admin/` 总量

### 下一步做

1. 在后台前端补 `virtual_path` 上报
2. 用 Workers Analytics Engine 存后台 hash 页面统计
3. 再把平均停留、跳出率补上

### 现在不要做

1. 不要直接把 demo 里的“独立访客 / 平均停留 / 跳出率”全都照搬成真实指标
2. 不要假设 Web Analytics 会自动识别 `#/posts`
3. 不要第一步就重构后台成 Browser Router

---

## 9. 推荐执行顺序

### 第 1 步

确认 Web Analytics 注入成功。

### 第 2 步

先做后台访问分析页 V1，只接：

- 页面浏览
- 访次
- 趋势
- 路径
- 来源
- 浏览器
- 设备

### 第 3 步

设计 `virtual_path` 事件格式。

### 第 4 步

接 Workers Analytics Engine。

### 第 5 步

补后台 hash 页面统计、停留时长、跳出率。

