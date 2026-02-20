# Bitlog 部署到 Cloudflare（含 GitHub Actions 自动部署）

本项目由 2 个 Cloudflare Worker 组成：

- `apps/api`：API Worker（必须绑定 D1；可选绑定 R2 用于图片上传）
- `apps/web`：Web Worker（SSR 页面 + 静态 `/admin/*`），通过 Service Binding 调用 `apps/api`

> 仓库内默认按同域分流示例配置为：`wyc.indevs.in`（Zone：`indevs.in`），路由写在 `apps/web/wrangler.toml` 与 `apps/api/wrangler.toml`。
>
> 如果你要在 CI 里部署到自己的域名/Zone，GitHub Actions 会在部署前自动 patch 这两个文件的 `routes[].pattern` 与 `zone_name`（见下文 Secrets：`CLOUDFLARE_ROUTE_HOSTNAME` / `CLOUDFLARE_ZONE_NAME`）。

---

## 0. 前置条件（必须确认）

1) 你的 Cloudflare 账号里已经添加了 `indevs.in` 这个站点（Zone），并且 DNS 是生效的（能新增/修改记录）。

2) 你已经准备好一个 **Cloudflare API Token**（推荐用 Token，不用 Global API Key），并有权限：

- Account（账户级）
  - Workers Scripts：Edit
  - D1：Edit
- Zone（域名级，`indevs.in`）
  - Workers Routes：Edit

如果你之后要启用 R2 图片上传，再加上 R2 的读写权限。

---

## 1) Cloudflare 侧一次性准备

### 1.1 新建 D1 数据库（名字建议：`bitlog`）

你可以在 Cloudflare Dashboard 创建，或本地用 wrangler：

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create bitlog
```

创建后你会得到一个 `database_id`（形如 UUID）。把它保存下来，后面要放到 GitHub Secret：`CLOUDFLARE_D1_DATABASE_ID`。

### 1.2 DNS：确保 `wyc.indevs.in` 能解析（橙云代理）

到 Cloudflare 的 DNS 面板，新增一条记录（示例）：

- Type：A
- Name：`wyc`
- IPv4：`192.0.2.1`（随便填一个占位 IP 即可）
- Proxy status：Proxied（橙云）

> Workers 路由绑定依赖这条记录在 Cloudflare 代理之下。

---

## 2) GitHub Actions 自动部署（推荐）

仓库已包含 workflow：`.github/workflows/deploy-cloudflare.yml`，会在 push 到默认分支时自动（本仓库默认分支为 `master`；同时也兼容 `main`）：

1) 安装依赖
2) patch `apps/api/wrangler.toml` 与 `apps/web/wrangler.toml` 的 routes/zone_name（用于改域名或 Zone）
3) 将 `apps/api/wrangler.toml` 里的 `database_id` 替换成你的 `CLOUDFLARE_D1_DATABASE_ID`
4) 执行 D1 migrations
5) 部署 `apps/api`
6) （可选）同步 `apps/api` 的 Worker Secrets
7) 部署 `apps/web`（会先构建 Admin 静态资源到 `apps/web/public/admin/`）
8) （可选）同步 `apps/web` 的 Worker Secrets

### 2.1 在 GitHub 新增 Secrets

GitHub 仓库 -> Settings -> Secrets and variables -> Actions -> New repository secret：

- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID
- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token
- `CLOUDFLARE_D1_DATABASE_ID`：你创建的 D1 的 `database_id`
- `CLOUDFLARE_ZONE_NAME`：你的 Zone（例如：`indevs.in`）
- `CLOUDFLARE_ROUTE_HOSTNAME`：你要绑定的路由域名（例如：`wyc.indevs.in`）

可选（用于自动同步 Worker Secrets，支持 `.env` 或 JSON 格式，见 `wrangler secret bulk --help`）：

- `CLOUDFLARE_API_WORKER_SECRETS`：部署到 `apps/api` 的 secrets
- `CLOUDFLARE_WEB_WORKER_SECRETS`：部署到 `apps/web` 的 secrets

### 2.2 触发部署

- push 一次代码到默认分支（或手动在 Actions 里点 `Run workflow`）
- 打开 GitHub Actions 查看日志，确认 deploy 成功

---

## 3) 手动部署（不走 GitHub Actions）

> 适合你想先在本地跑通再接 CI 的情况。

### 3.1 安装依赖

```bash
pnpm install -r
```

### 3.2 填写 D1 database_id

把你的 `database_id` 写入：

- `apps/api/wrangler.toml`：`d1_databases[0].database_id`

### 3.3 应用 migrations 到远端 D1

```bash
pnpm exec wrangler d1 migrations apply bitlog --cwd apps/api -c wrangler.toml
```

### 3.4 部署

```bash
pnpm run deploy:api
pnpm run deploy:web
```

---

## 4) 部署后必做检查（第一次）

1) 打开站点首页：

- `https://wyc.indevs.in/`

2) 打开后台并立刻改密码：

- `https://wyc.indevs.in/admin/`
- 默认账号：`admin / 123456`

3) 在后台设置里填写（否则 RSS / Sitemap 可能会报错）：

- `site.base_url`：`https://wyc.indevs.in`
- 站点标题、描述、时区等

4) 验证 API 正常（示例）：

- `https://wyc.indevs.in/api/config`（应返回 `ok: true` 的 JSON）

---

## 5) 常见问题

### Q1：部署时报 “zone_name 不存在 / route 绑定失败”

原因通常是：

- `indevs.in` 没在当前 Cloudflare 账号下（没有 Zone）
- 你的 API Token 没有 `Zone -> Workers Routes: Edit` 权限
- DNS 记录 `wyc` 没有橙云代理

### Q2：RSS / Sitemap 报 `Missing site.base_url`

到后台设置里把 `site.base_url` 填成 `https://wyc.indevs.in`。

### Q3：想启用 R2 图片上传

1) 在 Cloudflare 创建 R2 bucket
2) 取消注释 `apps/api/wrangler.toml` 的 `r2_buckets` 并填 bucket 名
3) 重新部署 `apps/api`
4) 确保 API Token 有 R2 相关权限
