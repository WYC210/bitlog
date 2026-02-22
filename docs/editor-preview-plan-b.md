# 方案 B：保留服务端渲染的“聪明实时预览”改造计划

目标：继续使用 `POST /api/admin/render` 作为预览渲染的唯一来源，但显著减少无效请求/并发堆积，降低触发 Cloudflare/WAF 频控与 Worker CPU 压力，同时保持预览结果与线上一致。

非目标：不在本方案内引入“本地 Markdown 渲染”（方案 A）。

---

## 现状（需要优化的点）

- `apps/admin/src/pages/EditorPage.tsx`：`content` 变化后用 `setTimeout(..., 350ms)` 触发一次 `renderAdminMarkdown(content)`。
- 已有 `previewSeq` 防止“旧请求结果覆盖新结果”，但 **不会取消旧请求**：
  - 用户快速输入时，旧请求仍会在网络与服务端占用资源；
  - 当服务端限流/变慢时，客户端可能出现大量 in-flight 请求（即使 UI 不应用旧结果，服务端仍会做渲染）。

---

## 设计原则

- “减少请求数量”优先于“更快刷新”：预览延迟允许略增加（例如 800–1500ms），但要避免并发与抖动。
- “可恢复”：遇到 `429/5xx` 时自动降频/暂停自动预览，用户仍可手动点“刷新预览”。
- “只在需要时预览”：只有在 `layout=preview/split` 且页面可见时才触发自动预览。

---

## 修改清单（按优先级）

### P0（强烈建议，本周内完成）

1) 客户端请求可取消（AbortController）
- 改造 `apps/admin/src/api.ts`
  - `renderAdminMarkdown(content_md, opts?)` 支持传入 `AbortSignal`。
  - 如 `apiJson()` 未透传 `signal`，需要让 `apiJson(url, init)` 接收并传给 `fetch`。
- 改造 `apps/admin/src/pages/EditorPage.tsx`
  - 保存一个 `renderAbortRef`：
    - 每次发起新预览前 `abort()` 上一次请求；
    - 本次请求用新的 `AbortController` 的 `signal`。
  - `catch` 里识别 `AbortError`：不展示错误、不影响 UI（属于正常取消）。

验收：
- 快速连续输入时，Network 面板中旧的 `/api/admin/render` 请求应被取消（canceled）。
- 服务端日志/指标中，渲染耗时尖峰降低（至少不再因为并发堆积而恶化）。

2) 自动预览触发条件收紧
- 在 `apps/admin/src/pages/EditorPage.tsx` 的 effect 中增加 gating：
  - `autoPreview=false` 不触发（已有）。
  - `layout === "write"` 时不触发自动预览（减少后台运行）。
  - `document.visibilityState !== "visible"` 时不触发；从隐藏→可见时，触发一次“落后补偿”渲染（可选）。

验收：
- 切到写作模式或切换浏览器 tab 后不再后台刷预览。

3) debounce 调整 + 基于耗时自适应（简单版）
- 将固定 `350ms` 调整为默认 `800ms`（可在 UI 里做成设置项，或写死）。
- 自适应（简单版）：
  - 记录上一轮预览渲染（从发请求到拿到响应）的耗时；
  - 如果耗时 > 800ms，则将下一次 debounce 增加到 1200–1500ms（上限），避免越慢越刷。

验收：
- 慢网络/慢渲染时，请求频率自动下降，不会出现“越卡越多请求”。

4) 429/5xx 的降频与“自动预览暂停”
- 预览请求返回 `429`：进入退避（例如 5s/10s 逐步增长），并在预览区提示“自动预览已降频/暂停，可手动刷新”。
- 连续 N 次（例如 3 次）失败：自动关闭 `autoPreview`，要求用户手动恢复。
- 对于 `400`（参数问题）直接提示错误，不做重试。

验收：
- 人为触发限流（例如快速输入）时不会刷屏报错，也不会持续高频打接口。

---

### P1（建议完成，提升体验与稳定性）

5) 内容去重（避免无意义重渲染）
- 维护 `lastRenderedContent` 或 `lastRenderedHash`：
  - 如果 `content` 与已渲染的内容一致，则不发请求；
  - 手动“刷新预览”仍可强制重渲染。
- Hash 可先用简单策略：
  - 直接 string compare（已足够覆盖绝大多数场景）；如需更强，可再引入 `crypto.subtle.digest("SHA-256", ...)`。

6) 请求合并（只保留“最新一份”）
- 若正在渲染（in-flight），后续输入只更新“最新待渲染内容”，不要立刻触发第二个请求；
- 当前请求结束后，只渲染最新那一份（相当于“边输入边排队，但队列长度永远是 1”）。
- 这能进一步降低“中间状态”渲染次数（尤其在 render 很慢时）。

7) 预览更新策略优化
- “正在渲染”时不清空旧预览（保留上一次的 HTML），只显示加载状态。
- 预览错误时保留旧预览，并展示可关闭的错误提示条。

---

### P2（可选：服务端配合进一步降载）

8) 服务端 render 结果短 TTL 缓存（仅内存）
- 在 `apps/api/src/app.ts` 的 `/api/admin/render`：
  - 以 `(adminId, sha256(content_md))` 为 key 做 5–30 秒缓存；
  - 命中直接返回（绕过统一渲染管线），对“来回切换/重复请求”很有效。
- 注意：Worker 进程可能随时回收，缓存是 best-effort，不应影响正确性。

9) 增强可观测性（便于你判断是否触发 Cloudflare 保护）
- 客户端：可选加一个 debug 开关，记录预览请求频率/取消次数/平均耗时。
- 服务端：对 `/api/admin/render` 记录 `render_ms`、`md_len`、`rate_limited`（已有部分限流能力，可补齐日志字段）。

---

## 变更涉及文件（预估）

- `apps/admin/src/api.ts`：`renderAdminMarkdown` 支持 `signal`；如需则让 `apiJson` 透传 `fetch` 选项。
- `apps/admin/src/pages/EditorPage.tsx`：增加 AbortController、触发条件、退避与暂停逻辑、自适应 debounce、请求合并（可分阶段实现）。
- （可选）`apps/api/src/app.ts`：服务端 render 缓存与日志增强。

---

## 回归测试清单（上线前自测）

- 快速连续输入 10 秒：Network 中 `/api/admin/render` 大量请求应被取消/合并；服务端不应出现持续 429。
- 切到“写作”模式/切换浏览器 tab：不应继续请求 render。
- 手动点“刷新预览”：即使自动预览关闭也能正常渲染。
- 模拟 429/500：UI 提示合理，自动预览会降频/暂停且可恢复。

