# 工具迁移计划：newechoes_gitee → bitlog

> 状态说明：`[ ]` 待完成 `[x]` 已完成 `[~]` 进行中

---

## 背景

旧博客（`newechoes_gitee`，Astro + React）有完整的工具中心，包含游戏、API工具、实用工具三大类。
新博客（`bitlog`，Hono SSR + Cloudflare Workers）已有工具列表页 `/tools`，但只支持卡片展示和外链跳转。

**目标**：所有工具在新博客站内运行，不跳转外部，支持后台实时新增/管理，无需重新部署。

---

## 架构设计

### 两种模式

| 模式 | kind 值 | 适用场景 | 更新方式 |
|------|---------|---------|---------|
| 站内交互页面 | `page` | 所有有交互逻辑的工具 | 后台编辑 `client_code`，实时生效 |
| 纯外链跳转 | `link` | 仅导航到外部网站 | 后台修改 url，实时生效 |

### 工具页面渲染流程

```
用户访问 /tools/:slug
  → Web Worker 从 D1 查询工具记录
  → kind=link  → 新标签跳转 url
  → kind=page  → 生成 HTML 页面，内联 client_code
                  → <div id="tool-root"> + <script>(function(){ client_code })()</script>
```

### 内置复杂工具（游戏类）

游戏逻辑代码放静态文件，`client_code` 只存一行加载脚本：

```
apps/web/public/ui/tools/snake.js    ← 贪吃蛇完整逻辑
apps/web/public/ui/tools/gomoku.js   ← 五子棋完整逻辑
```

数据库 `client_code` 字段存：
```js
var s=document.createElement('script');s.src='/ui/tools/snake.js';document.head.appendChild(s);
```

---

## 工具清单

### 游戏娱乐（group: games）

| 工具 | slug | kind | 来源文件 | 状态 |
|------|------|------|---------|------|
| 贪吃蛇 | `snake` | `page` | `games/SnakeGame.tsx` → 重写为原生JS | `[x]` |
| 五子棋 | `gomoku` | `page` | `games/GomokuGame.tsx` → 重写为原生JS | `[x]` |

### API工具集（group: apis）

当前仅迁移以下 6 个（2026-02-19 确认），其余 API 工具先暂缓。

| 工具 | slug | kind | 依赖接口 | 状态 |
|------|------|------|---------|------|
| IP归属地查询 | `ip-location` | `page` | `/api/ip-location` | `[~]` |
| DNS解析查询 | `dns-query` | `page` | `/api/dns-query` | `[~]` |
| ICP备案查询 | `icp-query` | `page` | `/api/icp-query` | `[~]` |
| 手机号归属地 | `phone-location` | `page` | `/api/phone-location` | `[~]` |
| ASCII艺术字 | `ascii-art` | `page` | `/api/ascii-art` | `[~]` |
| JSON格式化 | `json-format` | `page` | `/api/json-format` | `[~]` |

### 实用工具集（group: utils）

| 工具 | slug | kind | 来源文件 | 状态 |
|------|------|------|---------|------|
| 图片对比 | `image-comparison` | `page` | `utils/ImageComparisonTool.tsx` | `[ ]` |
| 图片格式转换 | `image-converter` | `page` | `utils/ImageConverterTool.tsx` | `[ ]` |
| 图片编辑器 | `image-editor` | `page` | `utils/ImageEditorTool.tsx` | `[ ]` |
| JSON格式化 | `json-formatter` | `page` | `utils/JsonFormatterTool.tsx` | `[ ]` |
| 文本对比 | `text-diff` | `page` | `utils/TextDiffTool.tsx` | `[ ]` |
| 文本格式化 | `text-formatter` | `page` | `utils/TextFormatterTool.tsx` | `[ ]` |
| 表格转换 | `table-converter` | `page` | `utils/TableConverter.tsx` | `[ ]` |
| XML格式化 | `xml-formatter` | `page` | `utils/XmlFormatterTool.tsx` | `[ ]` |
| 视频比例转换 | `video-aspect` | `page` | `utils/VideoAspectConverter.tsx` | `[ ]` |
| 数学公式编辑器 | `math-formula` | `page` | `utils/MathFormulaEditor.tsx` | `[ ]` |

### 开发者工具（group: utils）

| 工具 | slug | kind | 来源文件 | 状态 |
|------|------|------|---------|------|
| Base64编解码 | `base64` | `page` | `devtools/Base64Text.tsx` | `[x]` |
| 时间戳转换 | `timestamp` | `page` | `devtools/TimeConverter.tsx` | `[x]` |
| JWT解析 | `jwt-decoder` | `page` | `devtools/JwtDecoder.tsx` | `[x]` |
| 进制转换 | `number-converter` | `page` | `devtools/NumberConverter.tsx` | `[x]` |
| Unicode转换 | `unicode-converter` | `page` | `devtools/UnicodeConverter.tsx` | `[x]` |
| URL编解码 | `url-encoder` | `page` | `devtools/UrlEncoder.tsx` | `[x]` |

---

## 执行步骤

### Step 1：数据库 Migration `[x]`

**文件**：`apps/api/migrations/0004_tools_client_code.sql`

```sql
ALTER TABLE tools ADD COLUMN client_code TEXT NULL;
```

执行方式：
```bash
# 本地开发
npx wrangler d1 execute bitlog-db --local --file=apps/api/migrations/0004_tools_client_code.sql

# 生产环境
npx wrangler d1 execute bitlog-db --file=apps/api/migrations/0004_tools_client_code.sql
```

---

### Step 2：API 层改动 `[x]`

**文件**：`apps/api/src/services/tools.ts`

改动点：
- `ToolItem` 类型加 `clientCode: string | null`
- `ToolCreateInput` 加 `clientCode?: string | null`
- `ToolUpdateInput` 加 `clientCode?: string | null`
- `listToolsAdmin` / `listToolsPublic` 的 SELECT 加 `client_code`
- `createTool` 的 INSERT 加 `client_code`
- `updateTool` 的 UPDATE 加 `client_code` 处理
- `mapRow` 函数加 `clientCode: row.client_code ?? null`

**文件**：`apps/api/src/app.ts`

新增公开路由（在现有 `/api/tools` 路由附近）：
```typescript
// GET /api/tools/:slug — 按 slug 查单条工具（含 client_code）
app.get("/api/tools/:slug", async (c) => { ... })
```

---

### Step 3：Web 层新增工具详情路由 `[x]`

**文件**：`apps/web/src/app.ts`

在 `/tools` 路由之后新增：
```typescript
// GET /tools/:slug
app.get("/tools/:slug", async (c) => {
  // 1. 从 API 查工具
  // 2. kind=link → redirect
  // 3. kind=page → 生成内嵌 client_code 的 HTML 页面
  //    使用 page.html 模板，MAIN_CONTENT 包含：
  //    <div id="tool-root"></div>
  //    <script>(function(){ {{CLIENT_CODE}} })()</script>
})
```

同时修改 `/tools` 列表页：`kind=page` 的卡片 href 改为 `/tools/${slug}`。

---

### Step 4：后台管理界面改动 `[x]`

**文件**：`apps/admin/src/api.ts`

- `AdminToolItem` 加 `clientCode: string | null`
- `createAdminTool` payload 加 `clientCode?: string | null`
- `updateAdminTool` patch 加 `clientCode?: string | null`

**文件**：`apps/admin/src/pages/SettingsPage.tsx`

- 工具编辑表单的 draft state 加 `clientCode`
- 当 `draft.kind === 'page'` 时显示代码编辑 textarea
- 新建工具表单同样加 `clientCode` 字段

---

### Step 5：内置游戏静态文件 `[x]`

**目录**：`apps/web/public/ui/tools/`

需要创建的文件：
- `snake.js` — 贪吃蛇（原生 JS + Canvas，参考 `SnakeGame.tsx` 逻辑重写）
- `gomoku.js` — 五子棋（原生 JS + Canvas，参考 `GomokuGame.tsx` 逻辑重写）

每个文件的结构：
```js
// snake.js
(function() {
  const root = document.getElementById('tool-root');
  // 渲染游戏 UI 到 root
  // 初始化 Canvas
  // 游戏逻辑...
})();
```

数据库对应记录的 `client_code`：
```js
// snake 工具
var s=document.createElement('script');s.src='/ui/tools/snake.js';document.head.appendChild(s);
```

---

### Step 6：后台录入所有工具数据 `[~]`

按工具清单逐条在后台新增，每条记录包含：
- `slug`：见工具清单
- `title`：中文名称
- `description`：简短描述
- `groupKey`：`games` / `apis` / `utils`
- `kind`：`page`
- `client_code`：对应的 JS 代码（单行，从 `devtools-client-code.md` 复制）

**已完成**：
- [x] 开发者工具 6 项（base64、timestamp、jwt-decoder、number-converter、unicode-converter、url-encoder）
- [x] 游戏 2 项（snake、gomoku，client_code 为加载静态文件的一行脚本）

**待完成**：
- [ ] API工具 16 项（走独立后端接口实现）
- [ ] 实用工具 10 项（图片处理等，明日实现）

---

### Step 7：验证测试 `[~]`

- [ ] `/tools` 列表页正常显示所有工具卡片
- [ ] `kind=page` 工具点击后进入 `/tools/:slug` 页面
- [ ] `kind=link` 工具点击后新标签打开外链
- [ ] 后台新增工具后前台立即可见（无需重新部署）
- [ ] 后台修改 `client_code` 后工具功能立即更新
- [ ] 游戏工具正常运行（贪吃蛇、五子棋）
- [ ] API工具正常调用并展示结果
- [ ] 开发者工具纯客户端逻辑正常
- [ ] 移动端响应式正常

---

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `apps/api/migrations/0004_tools_client_code.sql` | 数据库 migration |
| `apps/api/src/services/tools.ts` | 工具 CRUD 服务层 |
| `apps/api/src/app.ts` | API 路由（新增 `/api/tools/:slug`） |
| `apps/web/src/app.ts` | Web 路由（新增 `/tools/:slug`） |
| `apps/web/public/ui/tools/snake.js` | 贪吃蛇静态文件 |
| `apps/web/public/ui/tools/gomoku.js` | 五子棋静态文件 |
| `apps/admin/src/api.ts` | 后台 API 客户端 |
| `apps/admin/src/pages/SettingsPage.tsx` | 后台工具管理界面 |

## 旧博客源文件索引

| 文件 | 说明 |
|------|------|
| `newechoes_gitee/src/components/ToolsPage.tsx` | 工具中心主页面 |
| `newechoes_gitee/src/components/apis/ApiTools.tsx` | API工具集（16个工具） |
| `newechoes_gitee/src/components/games/SnakeGame.tsx` | 贪吃蛇游戏 |
| `newechoes_gitee/src/components/games/GomokuGame.tsx` | 五子棋游戏 |
| `newechoes_gitee/src/components/utils/UtilityTools.tsx` | 实用工具集入口 |
| `newechoes_gitee/src/components/devtools/DeveloperTools.tsx` | 开发者工具集入口 |
| `newechoes_gitee/src/components/devtools/Base64Text.tsx` | Base64编解码 |
| `newechoes_gitee/src/components/devtools/JwtDecoder.tsx` | JWT解析 |
| `newechoes_gitee/src/components/devtools/TimeConverter.tsx` | 时间戳转换 |
| `newechoes_gitee/src/components/devtools/NumberConverter.tsx` | 进制转换 |
| `newechoes_gitee/src/components/devtools/UnicodeConverter.tsx` | Unicode转换 |
| `newechoes_gitee/src/components/devtools/UrlEncoder.tsx` | URL编解码 |
| `newechoes_gitee/src/components/utils/ImageComparisonTool.tsx` | 图片对比 |
| `newechoes_gitee/src/components/utils/ImageConverterTool.tsx` | 图片格式转换 |
| `newechoes_gitee/src/components/utils/ImageEditorTool.tsx` | 图片编辑器 |
| `newechoes_gitee/src/components/utils/JsonFormatterTool.tsx` | JSON格式化 |
| `newechoes_gitee/src/components/utils/TextDiffTool.tsx` | 文本对比 |
| `newechoes_gitee/src/components/utils/TextFormatterTool.tsx` | 文本格式化 |
| `newechoes_gitee/src/components/utils/TableConverter.tsx` | 表格转换 |
| `newechoes_gitee/src/components/utils/XmlFormatterTool.tsx` | XML格式化 |
| `newechoes_gitee/src/components/utils/VideoAspectConverter.tsx` | 视频比例转换 |
| `newechoes_gitee/src/components/utils/MathFormulaEditor.tsx` | 数学公式编辑器 |

---

## 注意事项

1. **缓存**：`apps/web/src/app.ts` 的工具页有缓存（`maybeCachePage`），`/tools/:slug` 路由不要加缓存，否则修改 `client_code` 后不会立即生效。

2. **XSS 安全**：`client_code` 内联到 HTML 时，代码本身不需要 escapeHtml（它是 JS 代码），但要用 IIFE `(function(){...})()` 包裹隔离作用域。

3. **不使用 `/api/proxy`**：API 工具建议都走独立后端接口（同源），前端只传入参数并渲染返回 JSON。

4. **`/api/vegetable-prices` 接口**：蔬菜价格查询依赖此接口，需确认是否已实现。

5. **游戏移动端适配**：贪吃蛇和五子棋需要触摸事件支持，重写时注意加上 touch 事件监听。

6. **`kind=page` 工具的 url 字段**：可以留空，也可以存 API 端点地址作为备注，不影响功能。
