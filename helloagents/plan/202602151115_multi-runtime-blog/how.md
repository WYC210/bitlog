# 技术设计: multi-runtime-blog（单库 MVP：Workers + D1，可执行规范 v0.1）

## 1. 架构与约束
### 1.1 目标
- 用 **Cloudflare Workers + D1** 做出可上线的单库版本（读写/搜索/RSS/Sitemap/管理端/图片上传）。
- 未来扩展多数据库/多运行时：只预留抽象边界，不在 MVP 实现。

### 1.2 技术栈（MVP）
- **HTTP 框架**：Hono
- **数据库**：D1（单 binding：`DB`）
- **图片存储**：R2（可选 binding：`ASSETS_R2`），未绑定时禁用上传
- **渲染**：保存/发布时渲染 Markdown → HTML，并进行 XSS 清洗
- **Web**：Astro + React（SSR，运行时从 DB/API 取内容）
- **Admin**：Vite + React（SPA）

### 1.3 部署拓扑（同源/不同源都可）
- 推荐：**同源**（同一个 Worker 同时提供 Web SSR + `/api/*` + `/assets/*`），省去 CORS 与跨域会话问题。
- 允许：**不同源**（Web/Admin 与 API 分开部署）。建议保持同一主域（同站点 eTLD+1，例如 `admin.example.com` → `api.example.com`），优先走 Cookie 会话；若是完全不同站点，则改用 `Authorization: Bearer` token 模式更稳。
- 分离部署（推荐方案）：Web Worker 通过 **Service Binding** 调用 API Worker（同 Cloudflare 内部网络，无需 CORS，延迟更低；也便于保持 Cookie 同源策略由 Web Worker 统一代理）。
- Admin 部署：**Admin 静态站点由 Web Worker 分发**（例如 `/admin/*`），避免 Pages/独立站点带来的跨域会话与 CORS 复杂度。
- 推荐路由分流（同域，便于 Cookie）：`/api/*` + `/assets/*` → API Worker；其余路径（含 `/admin/*`）→ Web Worker。
- 约束：不同源时，浏览器端请求需显式携带凭证（`credentials: "include"`），服务端需启用 CORS 且允许 credentials（见 7.2）。

部署落地（已确认）：
- 使用同一主域名部署，并按“推荐路由分流”将 API 与 Web/Admin 绑定到不同 Worker（route 层分流）。

## 2. Workers 绑定与运行时配置（规范）
### 2.1 必选 binding
- `DB`：D1 数据库

### 2.2 可选 binding（图片）
- `ASSETS_R2`：R2 Bucket（推荐）

### 2.3 Service Binding（推荐）
- `API`：指向 API Worker 的 service binding（Web SSR / Admin BFF 可用；浏览器端同域直连 `/api/*` 时不依赖该 binding）

### 2.4 存储策略（必须遵守）
- 若存在 `ASSETS_R2` → 启用图片上传，文件存 R2，元数据存 D1
- 若不存在 `ASSETS_R2` → **禁用图片上传**（API 返回明确错误），允许文章引用外链图片

## 3. D1 数据模型（可执行 schema 规范）
> 说明：字段类型以 SQLite/D1 为准；时间统一使用 unix 毫秒（INTEGER）。

### 3.1 admin_users
- `id TEXT PRIMARY KEY`
- `username TEXT UNIQUE NOT NULL`
- `password_hash BLOB NOT NULL`
- `password_salt BLOB NOT NULL`
- `password_iterations INTEGER NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

默认账号（MVP 固定）：
- `username = "admin"`
- `password = "123456"`

> 安全提示：该默认密码仅用于 MVP 上线前期；生产环境强烈建议尽快修改（本方案不强制“首次登录改密”，但支持改密码接口）。

### 3.1.1 admin_sessions（会话/刷新）
> 说明：采用“D1 存 session/refresh”模式，支持 30 天记住我 + 可撤销/可登出。
- `id TEXT PRIMARY KEY`（session id，随机）
- `admin_user_id TEXT NOT NULL`
- `refresh_token_hash BLOB NOT NULL`（对 refresh token 做 hash 存储，避免明文落库）
- `expires_at INTEGER NOT NULL`（unix ms）
- `created_at INTEGER NOT NULL`
- `last_seen_at INTEGER NOT NULL`
- `user_agent TEXT NULL`
- `ip TEXT NULL`
- `UNIQUE (refresh_token_hash)`
- `INDEX admin_sessions_admin (admin_user_id, expires_at)`

### 3.2 posts
- `id TEXT PRIMARY KEY`
- `slug TEXT UNIQUE NOT NULL`
- `title TEXT NOT NULL`
- `summary TEXT NOT NULL DEFAULT ''`
- `category_id TEXT NULL`（分类单选）
- `status TEXT NOT NULL`：`draft|published|scheduled`
- `publish_at INTEGER NULL`（定时发布点）
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `content_md TEXT NOT NULL`
- `content_html TEXT NOT NULL`（渲染 + sanitize 后的 HTML）
- `content_text TEXT NOT NULL`（用于 LIKE 搜索：从 HTML 提取纯文本并 lower）
- `cover_asset_id TEXT NULL`

索引：
- `INDEX posts_status_publish_at (status, publish_at)`
- `INDEX posts_updated_at (updated_at)`
- `INDEX posts_category (category_id)`

对外可见规则（公共端必须一致）：
- 文章可见条件为：`status IN ('published','scheduled') AND publish_at IS NOT NULL AND publish_at <= now_ms`
- 草稿（`draft`）永远不出现在公开列表/搜索/RSS/Sitemap

时间与时区（规则）：
- `publish_at` 存储为 UTC epoch ms（INTEGER）
- 展示与定时发布输入按 `site.timezone` 解释（见 3.6 settings）

slug 生成（规则）：
- 从 `title` 生成基础 slug（slugify）；若结果为空（例如全中文）则回退为 `post-<short_id>`
- 冲突时自动追加后缀：`-2`、`-3`…（直到唯一）

### 3.3 categories（单分类体系）
- `id TEXT PRIMARY KEY`
- `slug TEXT UNIQUE NOT NULL`
- `name TEXT UNIQUE NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

### 3.4 tags / post_tags
tags：
- `id TEXT PRIMARY KEY`
- `slug TEXT UNIQUE NOT NULL`
- `name TEXT UNIQUE NOT NULL`
- `created_at INTEGER NOT NULL`

post_tags：
- `post_id TEXT NOT NULL`
- `tag_id TEXT NOT NULL`
- `PRIMARY KEY (post_id, tag_id)`
- `INDEX post_tags_tag (tag_id, post_id)`

### 3.5 assets（仅图片）
- `id TEXT PRIMARY KEY`
- `kind TEXT NOT NULL`：固定 `image`
- `storage_provider TEXT NOT NULL`：固定 `r2`
- `storage_key TEXT NOT NULL`：如 `images/YYYY/MM/<sha256>.<ext>`
- `mime TEXT NOT NULL`
- `size_bytes INTEGER NOT NULL`
- `sha256_hex TEXT NOT NULL`（用于去重）
- `width INTEGER NULL`
- `height INTEGER NULL`
- `created_at INTEGER NOT NULL`
- `created_by TEXT NULL`（admin id）
- `UNIQUE (storage_provider, storage_key)`
- `UNIQUE (sha256_hex)`（推荐启用）

### 3.6 settings（不依赖重新部署）
- `key TEXT PRIMARY KEY`
- `value TEXT NOT NULL`（JSON 字符串或纯字符串）
- `updated_at INTEGER NOT NULL`

建议内置 key：
- `site.title`
- `site.description`
- `site.base_url`（**强制后台配置**；用于 RSS/Sitemap 生成绝对 URL，避免反代/多域名下的 canonical 不确定性）
- `site.timezone`（可配置，IANA 时区名，如 `Asia/Shanghai`、`America/Los_Angeles`；默认取 Admin 浏览器的 `Intl.DateTimeFormat().resolvedOptions().timeZone` 并写入 settings）
- `site.embed_allowlist`（可选，JSON 数组：允许嵌入的 host 白名单；为空表示禁用嵌入）
- `site.cache_public_ttl_seconds`（可选，公共 GET 缓存 TTL；默认建议 60）
- `site.cache_version`（可选，公共缓存版本号；发布/配置变更时递增，用于跨 Worker 的缓存“软失效”）
- `site.shortcuts_json`（可选，JSON：全局/分页面快捷键映射；可在后台修改）
- `site.nav_json`
- `site.theme_default`

`site.base_url` 校验与归一化（MVP 规则）：
- 允许输入：`https://example.com` 或 `https://example.com/`（允许末尾 `/`）
- 必须：以 `http://` 或 `https://` 开头；不允许包含 `#` 或 `?`
- 存储归一化：保存时去掉末尾 `/`（例如把 `https://example.com/` 存成 `https://example.com`），后续拼接路径时统一用 `${baseUrl}/path`

`site.timezone` 校验（MVP 规则）：
- 必须是 IANA 时区名（例如 `Asia/Shanghai`），服务端用 `Intl.DateTimeFormat(..., { timeZone })` try/catch 校验

`site.embed_allowlist` 规则（MVP）：
- 存储格式：JSON 数组（例如 `["player.bilibili.com","www.youtube.com"]`）
- 归一化：统一转小写；不允许包含协议/路径（只允许 host）
默认建议值（MVP，可在后台修改）：
- `["github.com","www.youtube.com","www.youtube-nocookie.com","player.bilibili.com"]`

`site.shortcuts_json` 规则（MVP）：
- 存储格式：JSON 对象（建议结构如下）
  - `global`: 全站快捷键
  - `contexts`: 按页面/区域上下文（例如 `web.articles`、`web.post`、`admin.editor`）覆盖 `global`（已选：使用“上下文粒度”，不直接绑定到路由字符串）
- 推荐使用 `mod` 表示跨平台修饰键（Windows/Linux=Ctrl，macOS=Cmd）
- 组合键规范（建议）：`mod+f`、`mod+n`、`alt+h`、`g h`（支持两段式按键序列）
- 浏览器保留快捷键提示：类似 `Ctrl+H`（历史记录）、`Cmd+H`（隐藏应用）通常无法可靠拦截；若后台配置了保留组合，前端应提示“不可用/冲突”，并回退为可用组合

## 4. Markdown 渲染与 XSS 清洗（必须）
### 4.1 写入时渲染（强约束）
- `content_md` 在保存/发布时渲染为 HTML，并进行 sanitize
- 读取接口只返回 `content_html`（可选同时返回 md 供管理端编辑）
- 需支持：表格（GFM）、脚注、代码高亮、文字模糊（spoiler/blur）、嵌入短代码（见 4.5）；允许原始 HTML（但必须 sanitize）

### 4.2 允许原始 HTML + 必须 sanitize
白名单建议（MVP）：
- 允许标签：`p, br, hr, h1..h6, a, img, code, pre, blockquote, ul, ol, li, strong, em, del, table, thead, tbody, tr, th, td, details, summary, span, sup, section`
- 允许属性：
  - `a`: `href, title, rel, target, id, class, aria-label`
  - `img`: `src, alt, title, width, height, loading, decoding`
  - `code/pre/span/sup/section`: `class, id`
  - `ol/li`: `class, id`
  - 通用：允许 `data-*` 与 `aria-*`（用于脚注与可访问性），但禁止 `style` 与任何 `on*`
- 允许协议：`http, https`（可选 `mailto`）；禁止 `javascript:` 等
- 禁止：`style`、任何 `on*` 事件、`script/iframe/object/embed` 等
- 外链：自动补齐 `rel="noopener noreferrer"`

### 4.3 文字模糊（MVP 约定）
- 推荐写法（作者直接写）：`<span class="blur">这段文字默认模糊</span>`
- 可选写法（后续可做语法糖）：`||这段文字默认模糊||` → 渲染为 `<span class="blur">...</span>`
- UI 行为（默认）：桌面端 hover 解除模糊；移动端点击切换（实现阶段在 Web 端完成）

### 4.4 代码高亮（策略选择）
> 这里的“构建时/运行时”指 **Web 页面渲染时机**，不是指“写入时渲染管线”。
- 构建时高亮（偏 SSG）：在前端构建阶段把代码块高亮进静态 HTML；优点是线上最省 CPU，缺点是内容变更常伴随重建，不适合“内容在 DB 且频繁发布”的形态。
- 运行时高亮（偏 SSR/CSR）：在每次请求/渲染时高亮；优点是实现简单、所见即所得，缺点是请求更慢且更吃 Workers CPU。
- **推荐（MVP）**：在“写入时渲染管线”完成高亮（保存/发布时高亮一次，存入 `content_html`），公开端读取直接返回预渲染 HTML。

高亮引擎选型（MVP 已定）：
- 采用 **Prism/Refractor**（更轻、更适合 Workers 包体积与冷启动约束）
- 语言不识别时降级为普通 code block（不报错、不阻塞发布）

### 4.5 嵌入（可选，需确认）
默认：sanitize **不允许** `iframe/video/audio/script` 等高风险标签。

若需要支持“视频/站外内容嵌入”，需要做这些改动（安全优先）：
- 方案A（已选，MVP）：增加**短代码/语法糖**，由渲染管线生成受控的 embed HTML，而不是允许任意原始 iframe。
- 方案B（延后）：在 sanitize 白名单中放开 `iframe` 并做 allowlist+CSP（更灵活但风险更高）。

嵌入开关（MVP 约定）：
- `site.embed_allowlist` 为空：一律不渲染/不透传 iframe（写入时 sanitize 会剔除）
- `site.embed_allowlist` 非空：启用方案A（短代码渲染），并按 allowlist 限制允许的 provider/host

短代码格式（MVP）：
- `@[youtube](VIDEO_ID)` → 生成固定模板 iframe（host 固定为 `www.youtube.com` / `www.youtube-nocookie.com` 二选一，最终以实现为准）
- `@[bilibili](BV_ID_OR_AV_ID)` → 生成固定模板 iframe（host 固定为 `player.bilibili.com`）
- `@[github](OWNER/REPO)` → 生成“链接卡片”（不使用 iframe；指向 `https://github.com/OWNER/REPO`；不做在线抓取/预览，避免引入外部请求与缓存/安全复杂度）
- `@[embed](https://HOST/PATH...)` → 生成受控 iframe（仅当 `HOST` 在 `site.embed_allowlist` 中；用于后续后台新增域名后无需发版）

规则（MVP）：
- provider → host 映射为固定表（不允许自定义 src）
- 若 provider 对应 host 不在 `site.embed_allowlist`：渲染为普通链接（或直接移除，最终以实现为准）
- iframe 必须强制属性：`loading="lazy"`、`referrerpolicy="no-referrer"`，以及合适的 `sandbox`（最小权限）

## 5. 搜索（LIKE + 加权相关度，MVP）
### 5.1 搜索字段（已确认）
- `title`、`summary`、`content_text`、`tags(name/slug)`

### 5.2 相关度打分（可执行规则）
权重：
- title：10
- tags：6
- summary：3
- content_text：1

排序：
- `ORDER BY score DESC, publish_at DESC, updated_at DESC`

过滤：
- `score > 0`
- 仅搜索对外可见文章（同 3.2 规则）

### 5.3 多关键词（已确认：OR）
- 规则：按空白切分关键词（去空、去重、最大数量可设上限）
- 语义：关键词之间为 **OR**（任一关键词匹配任一字段即可得分）
- 排序仍按 score 优先（同 5.2）

### 5.4 搜索限制（MVP，防滥用）
- `q` 最大长度：200
- 切词最大数量：8（超过截断）
- 每页：默认 10，最大 30
- 页码/offset 上限：最多取前 3000 条结果（超过返回空/报错二选一，最终以实现为准）
- 速率限制（已定）：按 IP 对 `/api/search` 做限速（60 次/分钟），超过返回 429
- 计数实现（已定）：使用 D1 计数（见 11）

## 6. 图片上传与访问（R2，MVP）
### 6.1 上传范围
- 仅图片：`image/png, image/jpeg, image/webp, image/gif`
- 禁用：`image/svg+xml`
- 大小限制：建议 `<= 10MB`（具体值实现阶段可配）

### 6.2 去重与 key 规则
- 计算 `sha256`（hex）
- key：`images/YYYY/MM/<sha256>.<ext>`
- 若 `sha256_hex` 已存在：返回已有 asset（不重复存）

### 6.3 同源访问 URL
- Worker 提供：`GET /assets/<storage_key>`
- 响应头：`Cache-Control: public, max-age=31536000, immutable`（key 不变前提）

## 7. API 契约（MVP 最小集合）
公共端：
- `GET /api/config`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /api/tags`
- `GET /api/categories`
- `GET /api/search?q=...`
- `GET /rss.xml`
- `GET /sitemap.xml`

管理端：
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `POST /api/admin/refresh`
- `GET /api/admin/me`
- `PUT /api/admin/password`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `POST /api/admin/assets/images`（仅当 R2 绑定时启用）
- `PUT /api/admin/settings`

### 7.1 管理端鉴权/会话（MVP）
- 登录方式：固定管理员密码登录（`admin / 123456`），不强制“首次登录改密”（建议尽快修改）
- 会话 TTL：30 天；支持“记住我”（默认开启）
- 会话载体（优先）：HttpOnly Cookie（`Secure` + `SameSite=Lax`；不同源且同站点时前端需 `credentials: "include"`）
- 会话载体（兜底，可选）：`Authorization: Bearer <token>`（用于完全不同站点/不便使用 Cookie 的部署）
- 管理员允许改密码：提供 `PUT /api/admin/password`（旧密码校验 + PBKDF2 重新生成 hash/salt/iterations）
- 会话存储（已定）：D1 存 session/refresh（见 3.1.1）；logout 删除 session；refresh 轮换 refresh token（旧 token 失效）

### 7.2 CORS（仅当不同源部署时启用）
- Origin：白名单（来自配置），不允许 `*`
- `Access-Control-Allow-Credentials: true`
- 允许 Header：`content-type, authorization`
- 处理 preflight（OPTIONS）

## 10. 缓存（公共端，必须）
目标：公共阅读路径必须启用缓存，避免每次请求都打到 D1/渲染。

缓存建议（MVP）：
- 缓存范围：公共 GET（文章列表/详情、tags/categories、RSS/Sitemap、`/api/config`、`/api/search`）
- 不缓存：`/api/admin/*`、上传接口、任何带鉴权的响应
- TTL：`settings.site.cache_public_ttl_seconds`（默认 60 秒）
- 跨 Worker 软失效：Web/API 在生成缓存 key 时拼入 `settings.site.cache_version`
  - 触发递增（已定）：发布/修改文章、更新站点配置时递增 `site.cache_version`（旧缓存无需主动 purge，也会自然过期）

## 11. 限速（D1 计数，已定）
目标：对 `/api/search` 做稳定可控的限速，避免被刷爆 D1。

### 11.1 数据表（建议）
`rate_limit_counters`：
- `key TEXT NOT NULL`（例如 `search:<ip>`）
- `window_start INTEGER NOT NULL`（unix ms，按分钟对齐）
- `count INTEGER NOT NULL`
- `expires_at INTEGER NOT NULL`
- `PRIMARY KEY (key, window_start)`
- `INDEX rate_limit_expires (expires_at)`

### 11.2 规则（固定窗口）
- window：1 分钟（按当前时间向下取整到分钟）
- limit：60 / window
- 每次请求：原子自增；若 count 超限返回 429
- 清理：按 `expires_at` 定期清理（可懒清理：每 N 次请求清一次）

## 8. UI 规范（边缘化 left）
- 桌面端：主文偏左（约 65–75ch），右侧页边栏（TOC/元信息）sticky
- 移动端：单列，页边栏折叠到正文下方
- 文章页必须包含：标题、发布时间、分类、标签、正文、TOC（可折叠）

### 8.1 全局快捷键（MVP）
Web（公开站）：
- `Ctrl+F` / `Cmd+F`：当焦点不在输入框时，聚焦导航栏搜索（替代“回到顶部再搜索”的成本）
- `Ctrl+H` / `Cmd+H`：回到首页（⚠️ 常见浏览器/系统保留键，可能无法可靠拦截；若不可用需在后台改为 `alt+h` 或 `g h`）
- `g b`：回到上一页（调用 history back；若无历史则不动作/回首页，最终以实现为准）
- `g n`：前进到下一页（调用 history forward；若无历史则不动作，最终以实现为准）

Admin（后台）：
- `Ctrl+N` / `Cmd+N`：新建文章（跳转到“新建文章”页面/弹窗）
- `g b`：回到上一页（路由返回/关闭弹窗，最终以实现为准）
- `g n`：前进到下一页（若存在）

### 8.2 可配置快捷键（后台可改）
目标：每个页面/上下文都能配置 1 个或多个快捷键，管理员可在后台自由修改组合键，不需要重新部署。

默认上下文建议（MVP）：
- `web.global`: 聚焦搜索、回到首页
- `admin.global`: 新建文章

配置示例（`site.shortcuts_json`）：
```json
{
  "global": {
    "goBack": "g b",
    "goForward": "g n",
    "goHome": "alt+h",
    "focusSearch": "mod+f"
  },
  "contexts": {
    "admin.global": {
      "newPost": "mod+n"
    }
  }
}
```

## 9. RSS / Sitemap（规则确认）
- 只包含对外可见文章（已发布 + 定时已到点）
- 草稿永不包含
