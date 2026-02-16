# 任务清单: multi-runtime-blog（单库 MVP：Workers + D1）

目录: `helloagents/plan/202602151115_multi-runtime-blog/`

---

## 1. 架构与工程初始化（MVP 仅 Workers）
- [√] 1.1 确定后端框架与入口（Hono + Workers fetch），路由前缀统一 `/api/*`
- [√] 1.2 确定 D1 绑定名为 `DB`（单库，不做切换）
- [√] 1.3 确定图片存储为可选 R2（绑定名 `ASSETS_R2`）；未绑定时禁用上传
- [√] 1.4 明确默认管理员账号规则：`admin / 123456`（不强制“首次登录改密”；提供改密码接口）
- [√] 1.5 确定部署拓扑：Web+Admin Worker（SSR + 静态 `/admin/*`）+ API Worker（D1/R2）；Web 通过 Service Binding 调用 API；推荐同域路由分流（`/api/*`、`/assets/*`）

## 2. 数据库与迁移（D1）
- [√] 2.1 按 `how.md` 的 schema 建表并编写 migrations（admin_users/admin_sessions/rate_limit_counters/posts/categories/tags/post_tags/assets/settings）
- [√] 2.2 初始化默认管理员账号（admin/123456），写入 password_hash/salt/iterations
- [√] 2.3 实现文章写入的渲染管线：Markdown → HTML（表格/脚注/代码高亮=Prism/Refractor/文字模糊/嵌入短代码；允许原始 HTML）→ XSS sanitize → 写入 `content_html/content_text`
- [ ] 2.4 可选：编写导入脚本，从 `oldblog/src/content` 批量导入到 D1（生成 slug、标签、分类）

## 3. API（Workers 单运行时）
- [√] 3.1 公共端接口：posts 列表/详情（slug）、分类/标签、search、config、RSS/Sitemap
- [√] 3.2 管理端接口：password 登录、会话（D1 存 session/refresh；TTL 30 天 + 记住我；Cookie 优先）、文章 CRUD（草稿/发布/定时发布）、settings 更新
- [√] 3.2.1 管理端接口：管理员改密码（`PUT /api/admin/password`，旧密码校验 + 更新 PBKDF2 hash/salt/iterations）
- [√] 3.2.1.1 管理端接口：刷新会话（`POST /api/admin/refresh`，refresh token 轮换）
- [√] 3.2.2 settings 规则：强制配置 `site.base_url`；允许末尾 `/` 输入，保存时归一化去尾 `/`
- [√] 3.2.3 settings 规则：支持 `site.timezone`（IANA 时区名）；定时发布输入与展示按该时区解释
- [√] 3.2.4 settings 规则：可选配置 `site.embed_allowlist`（JSON 数组 host 白名单，空=禁用嵌入）
- [√] 3.2.5 settings 规则：缓存参数 `site.cache_public_ttl_seconds` / `site.cache_version`（发布/配置变更递增 version）
- [√] 3.2.6 settings 规则：快捷键配置 `site.shortcuts_json`（全局 + contexts 覆盖；后台可编辑）
 - [√] 3.3 图片上传接口（仅当绑定 `ASSETS_R2`）：上传→存 R2→写 assets 元数据→返回同源 URL
 - [√] 3.4 统一错误码与日志字段（便于排障）

## 4. 存储（图片）
- [√] 4.1 R2 存储实现：写入 key 规则 `images/YYYY/MM/<sha256>.<ext>`，支持去重
- [√] 4.2 访问实现：`GET /assets/<storage_key>` 同源分发，设置强缓存头
- [√] 4.3 未绑定 R2：上传接口禁用并返回明确错误提示

## 5. 前端（Web + Admin）与设计规范落地
- [√] 5.0 UI 原型（静态 HTML）：文章详情页定稿（`test.html`：left 布局 + 右侧 sticky 目录 + 二级自动展开/收缩 + 分类/标签在窄屏自动折叠）
- [√] 5.0.1 UI 原型（静态 HTML）：文章列表页定稿（`test-articles.html`：搜索常驻导航栏 + 右侧分类/标签筛选 + 列表卡片 + 分页占位）
- [√] 5.1 Web（MVP：Workers + SSR 模板）：实现 left 边缘化文章页（主文偏左 + 右侧页边栏 TOC）与文章列表/筛选/搜索
- [√] 5.2 Admin（Vite+React，Worker 分发 `/admin/*`）：登录、文章编辑（Markdown）、发布/定时发布（按 `site.timezone`）、图片上传（若启用）、站点设置（含 `site.base_url/site.timezone`）
- [√] 5.3 快捷键（Web）：`Ctrl/Cmd+F` 聚焦导航栏搜索（焦点不在输入框时生效）
- [√] 5.4 快捷键（Admin）：`Ctrl/Cmd+N` 新建文章
- [√] 5.5 快捷键（Web）：回到首页（默认 `Ctrl/Cmd+H`，若与浏览器冲突则提示并建议改为 `alt+h` 或 `g h`）
- [√] 5.6 快捷键（可配置）：读取 `site.shortcuts_json`，按上下文启用/覆盖；后台页面可编辑并即时生效
- [√] 5.7 快捷键（Web+Admin）：上一页/下一页（默认 `g b` / `g n`；基于 history/router，若无历史则无动作或回退策略）

## 6. 安全检查
- [√] 6.1 输入校验与参数化查询（禁止拼接 SQL），审计注入/越权路径
- [√] 6.2 登录保护：限速、密码哈希（PBKDF2）、会话安全（HttpOnly/SameSite/Origin 校验）
- [√] 6.3 上传保护（R2）：类型/大小白名单、鉴权、hash 去重、防滥用
- [√] 6.4 站外嵌入安全策略（已选方案A）：短代码渲染固定模板 + `site.embed_allowlist` 控制 provider/host（不放开任意 iframe）
- [√] 6.5 搜索防滥用：限制 `q` 长度/切词数量/分页上限 + `/api/search` 限速（D1 计数，返回 429）

## 7. 测试与验证
- [ ] 7.1 关键路径：列表/筛选/搜索/阅读/登录/发布/定时发布可见性
- [ ] 7.2 安全验证：XSS 清洗有效、草稿不外泄、上传鉴权与限制生效
- [ ] 7.3 性能检查：分页与缓存头策略合理
- [ ] 7.4 缓存验证：公共端 GET 命中缓存；发布/配置变更后通过 `site.cache_version` 触发软失效
- [ ] 7.5 删除验证：文章/资源硬删除后不可访问（含缓存失效与 R2 对象删除）
- [ ] 7.6 快捷键验证：`Ctrl/Cmd+F` 聚焦搜索、`Ctrl/Cmd+N` 新建文章不误触输入框/编辑器快捷键
- [ ] 7.7 快捷键验证：回到首页快捷键在常见浏览器中可用；若配置为保留组合（如 `Ctrl+H`）则前端提示冲突并允许修改
- [ ] 7.8 快捷键验证：上一页/下一页在 Web/Admin 中生效且不与输入框/编辑器冲突

## 8. 部署与文档
- [√] 8.1 Cloudflare Workers：Web+Admin Worker 与 API Worker 的 `wrangler.toml`（含 Service Binding、route 分流、D1、可选 R2）与部署说明
- [√] 8.2 站点设置通过 `/api/config` 下发（不依赖重新部署）
