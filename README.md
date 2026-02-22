# Bitlog（Workers + D1 单库 MVP）

本仓库当前实现为 **2 个 Worker**：

- `apps/api`：API Worker（D1 必选，R2 可选）
- `apps/web`：Web+Admin Worker（SSR 页面 + 静态 `/admin/*`），通过 Service Binding 调用 `apps/api`

## 快速开始（本地）

安装依赖：

```bash
pnpm install -r
```

1. 启动 API（需要先把 `apps/api/wrangler.toml` 里的 `database_id` 替换成你的 D1）

创建 D1 并应用 migrations：

```bash
# Remote D1 (deploy / `wrangler dev --remote`)
wrangler d1 create bitlog
wrangler d1 migrations apply bitlog --cwd apps/api -c wrangler.toml

# Local D1 (default `wrangler dev` without `--remote`)
wrangler d1 migrations apply bitlog --local --cwd apps/api -c wrangler.toml
```

```bash
pnpm run dev:api
```

2. 配置 Web 在本地通过 HTTP 访问 API（绕过 Service Binding），在 `apps/web/.dev.vars` 写：

```bash
API_BASE_URL=http://127.0.0.1:8787
```

3. 启动 Web（会先构建 Admin 静态资源到 `apps/web/public/admin/`）

```bash
pnpm run dev:web
```

端口默认：API `8787`，Web `8788`。

## 部署（Cloudflare）

1. 部署 API：

```bash
pnpm run deploy:api
```

2. 部署 Web（会自动 `pnpm -C apps/admin run build`）：

```bash
pnpm run deploy:web
```

### 同域路由分流（推荐）

推荐让两套 Worker 同域工作：

- `bitlog-web`：`your-domain.com/*`
- `bitlog-api`：`your-domain.com/api/*`、`your-domain.com/assets/*`、`your-domain.com/rss.xml`、`your-domain.com/sitemap.xml`

这样浏览器访问 `/api/*` 会直接落到 API Worker；Web Worker 仍然通过 Service Binding 访问 API（并在本地开发时支持同源转发）。
