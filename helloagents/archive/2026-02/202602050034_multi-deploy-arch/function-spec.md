# 功能与函数设计清单（概要）

## 0. 运行时策略
- 全平台 TypeScript（Workers/Edge/VPS）
- 暂不使用 WASM；如未来需要，仅作为可选加速模块
- 运行时/DB/OSS 任意组合（受平台限制）
- 站点列表来自静态配置文件（site-config.json）
- 多后端可并行部署，前端按配置选择
- 多数据库条目仅用于切换，不做跨库同步
- 认证支持可插拔主登录 Provider 与 MFA Provider（默认 password；可选 Passkey/OAuth（微信/GitHub 等）/TOTP 等），按配置启停
- 多站点登录采用“每站点独立 token”
- 兼容实现策略：统一功能接口；弱能力库用多步骤实现（如搜索/Upsert/复杂查询）

## 1. 公共端功能（读）
- listPosts(params): 分页/标签过滤
- getPostBySlug(slug): 文章详情
- listCategories(): 分类列表（单分类）
- getCategoryBySlug(slug): 分类详情
- listPostsByCategory(slug): 分类下文章
- listTags(): 标签列表
- listPages(): 页面列表
- getPageBySlug(slug): 页面详情
- search(query): 站内搜索
- loadSiteConfig(): 读取静态 site-config.json（站点列表/默认站点/后端映射）

## 2. 管理端功能（写）
- listAuthProviders(): 查询已启用/可用的主登录方式
- enrollAuthProvider(providerType, payload): 绑定/启用主登录方式（如 Passkey/OAuth（微信/GitHub）/邮箱）
- startAuthChallenge(providerType): 发起主登录挑战
- verifyAuthChallenge(providerType, payload): 校验主登录挑战
- disableAuthProvider(providerId): 关闭/解绑主登录方式
- setPassword(payload): 设置/更新默认 password
- listMfaProviders(): 查询已启用/可用的二次验证
- enrollMfaProvider(providerType, payload): 绑定/启用二次验证（如 TOTP/微信）
- startMfaChallenge(providerType): 发起二次验证挑战
- verifyMfaChallenge(providerType, payload): 校验二次验证
- disableMfaProvider(providerId): 关闭/解绑二次验证
- adminSessionRefresh(): 刷新会话
- adminLogout(): 退出
- createPost/updatePost/deletePost
- createCategory/updateCategory/deleteCategory
- createTag/updateTag/deleteTag
- createPage/updatePage/deletePage
- uploadAsset/deleteAsset
- getSettings/updateSettings
- updateSiteNodes（站点列表与默认站点）

## 3. 站点切换（手动）
- getSiteList(): 从配置文件读取可用站点
- selectSite(siteId): 保存用户偏好
- optional: probeLatency(siteId): 手动测速并显示结果

## 4. Adapter 层（跨 Profile）

### DB Adapter
- posts: list/get/create/update/delete
- categories: list/get/create/update/delete
- tags: list/get/create/update/delete
- pages: list/get/create/update/delete
- assets: create/list/delete
- settings: get/set
- siteNodes: list/upsert/delete
- adminAccounts: get/set
- adminAuthProviders: list/create/update/delete
- adminMfaProviders: list/create/update/delete
- adminSessions: create/revoke/validate

### OSS Adapter
- upload(file, meta)
- delete(key)
- getPublicUrl(key)
- getSignedUrl(key, ttl)

### Auth Adapter（可插拔主登录 + MFA Provider）
- listAuthProviders()
- enrollAuthProvider(providerType, payload)
- startAuthChallenge(providerType)
- verifyAuthChallenge(providerType, payload)
- disableAuthProvider(providerId)
- listMfaProviders()
- startMfaEnroll(providerType)
- verifyMfaEnroll(providerType, payload)
- startMfaChallenge(providerType)
- verifyMfaChallenge(providerType, payload)
- disableMfaProvider(providerId)
- issueSession(adminId)

## 5. 配置与 Profile 管理
- loadConfig(): 读取环境变量/配置文件
- validateConfig(): 校验 Profile/DB/OSS
- resolveProfile(): 选择运行 Profile
- resolveDbProvider(): 选择 DB Provider
- resolveOssProvider(): 选择 OSS Provider
- resolveAuthProviders(): 选择可用的主登录 Provider
- resolveMfaProviders(): 选择可用的 MFA Provider

## 6. 运行时差异封装
- edgeFetch(): 统一 fetch 行为
- dbClientFactory(): 按 Profile 生成 DB Client
- storageClientFactory(): 按 Provider 生成 OSS Client

---

## 交付说明
- 本文仅定义“需要的功能与函数”，不包含具体实现
- 具体 API 路径与参数可在实现阶段细化

## 7. 部署与发布
- deployStatic(): 前端平台原生发布（Vercel/Netlify/CF Pages/腾讯 Pages）
- deployEdge(): Edge/Workers 原生发布（wrangler/平台 CLI）
- buildDockerImage(): 使用 CI 构建镜像
- pushDockerImage(): 推送到 GHCR/Docker Hub
- releaseTag(): 版本化发布
