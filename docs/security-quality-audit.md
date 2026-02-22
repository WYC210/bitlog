# Bitlog 代码审查（安全 / 质量 / 性能）

日期：2026-02-21（更新：2026-02-21）  
范围：`apps/api`（Workers API）、`apps/web`（Web Workers SSR/模板）、`apps/admin`（React Admin）、`packages/db`（SQL helper）  
说明：这是一次面向“可优化 / 需要限制 / 防抖 / 参数校验”的审查记录；不逐行审阅 `node_modules/`、构建产物与无关目录。

---

## TL;DR（重点结论）

已做得比较好（原有实现）：
- Markdown 渲染允许原始 HTML，但有后置 sanitize（白名单 tag/attr + iframe allowlist + sandbox 等安全默认值）。
- Public 工具/搜索等接口已有固定窗口限流（search/proxy/admin_login）。
- 前端已有关键“输入触发型请求”的防抖（站内搜索建议、后台预览渲染）。
- 多处接口已有格式/长度/枚举校验（域名、手机号、JSON format、上传类型/大小等）。

本次修复已落地（P0/P1 均已完成，见“修复状态”）。

---

## 修复状态（已完成 / 未完成）

### 已完成（P0）

0) 禁用/强制初始化默认管理员口令
- 不再自动创建 `admin/123456` 默认管理员。
- Admin 登录页不再预填密码、不再提示默认口令。
- 若数据库不存在管理员，后台登录会返回 `ADMIN_NOT_INITIALIZED`（503），需要你手动在建表/初始化时插入管理员记录。

1) Posts：`status/publish_at` 服务端校验并返回 400
- create/update 对 `status` 枚举与 `publish_at` 类型/有效性做显式校验，避免触发 DB CHECK 变 500、避免写入脏数据。

2) `/api/admin/render` 加 `MAX_MD_CHARS` +（可选）限流
- 增加最大长度限制（当前 `MAX_MD_CHARS = 500_000`）。
- 增加 adminId 维度限流（当前 600/min）。

3) `/api/port-scan` host 严格校验 + 禁内网/保留地址
- host 只允许域名/IPv4/IPv6（含 URL 输入会提取 hostname）。
- 明确拒绝 IPv4 私网/保留网段；IPv6 做了基础拦截（`::1`、`fe80:`、`fc/fd` 等）。

4) Tools `kind=link` 限制 URL scheme
- 后端保存时限制：仅允许 `http/https` 或站内相对路径 `/...`，拒绝其它 scheme/异常字符/超长 URL。
- Web 端跳转前再兜底校验，不合法直接 404。

5) 收紧非 GET 同源/CSRF
- admin 的 POST/PUT/DELETE 路由要求必须带且匹配 `Origin`，并对 `Sec-Fetch-Site/Referer` 做同源兜底校验。

### 已完成（P1）

6) `/assets/*` 读取限制 key 前缀或用 DB 校验
- 已完成：公开读取仅允许 `images/` 前缀且做了基础 key 规范化校验（长度/字符集/禁止 `..` 等）。

7) `getSiteConfig` 短 TTL 内存缓存
- 已完成：为 `getSiteConfig` 增加短 TTL（当前 5s）内存缓存，并在 `setSettings/bumpCacheVersion` 时主动失效。

8) 统一上游请求超时/错误映射
- 已完成：将 gitee embed 上游请求改为 `fetchWithTimeout`（10s）并带 `user-agent`。

9) RSS CDATA 安全处理
- 已完成：对所有 CDATA 内容做 `]]>` 安全拆分替换，避免破坏 XML。

---

## 待评估（可选）

- `port-scan`：目前未对“域名解析到内网/保留 IP”的情况做 DNS 解析拦截（只拦字面量 IP + 部分 IPv6）。若要进一步收紧，需要增加解析与私网拦截（会增加上游依赖与时延）。
- 外部请求一致性：目前只补齐了 gitee embed 的超时；其余上游请求建议持续保持 `fetchWithTimeout` + 统一错误映射策略。

---

## 变更影响（上线注意事项）

### 管理员初始化（重要）

由于已禁用默认管理员账号，**如果线上数据库里还没有任何管理员**：
- `/api/admin/login` 会返回 503，错误码 `ADMIN_NOT_INITIALIZED`（预期行为）
- 需要你在建表/初始化时手动插入首个管理员记录

注意：
- `admin_users.password_hash/password_salt/password_iterations` 存的是 PBKDF2 派生结果，不是明文密码；插入时需要写入正确的二进制值与 iterations。
- 如果你希望我给你加一个“只在本地运行的一次性初始化脚本”来生成插入值（不暴露到线上 API），我可以直接补上。

---

## 备注：仍建议持续关注的点

- `port-scan`：目前对“域名解析到内网 IP”的情况未做 DNS 解析拦截（只拦了字面量 IP + 部分 IPv6），如果你希望进一步收紧，可增加解析与私网拦截（会增加上游依赖与时延，需要权衡）。
- Markdown sanitize：当前是“允许原始 HTML + 后置清洗”的模式，后续若扩展允许标签/属性，建议配套 XSS 回归用例。
