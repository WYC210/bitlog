# 任务清单：编辑器“聪明实时预览”（方案 B）

目录：`helloagents/plan/202602220847_editor_preview_smart/`

---

## 1. Admin API：支持可取消渲染请求
- [✓] 1.1 在 `apps/admin/src/api.ts` 扩展 `renderAdminMarkdown(content_md, opts?)` 支持 `AbortSignal`

## 2. Admin Editor：请求合并与触发条件收紧
- [✓] 2.1 在 `apps/admin/src/pages/EditorPage.tsx` 加入 `AbortController`：新预览前取消上一次请求，忽略 `AbortError`
- [✓] 2.2 在 `apps/admin/src/pages/EditorPage.tsx` 收紧自动预览触发条件：仅 `layout !== "write"` 且页面可见时触发
- [✓] 2.3 将自动预览 debounce 从 `350ms` 调整为默认 `800ms`，并基于上一轮耗时自适应（上限 `1500ms`）
- [✓] 2.4 实现请求合并：同一时刻最多 1 个 in-flight，仅保留最新待渲染内容
- [✓] 2.5 处理 `429/5xx`：退避与暂停自动预览，手动“刷新预览”可强制渲染，连续失败阈值后自动关闭 `autoPreview`

## 3. 安全检查
- [✓] 3.1 确认取消请求不泄露错误信息；`AbortError` 不应提示为失败

## 4. 验证
- [✓] 4.1 本地跑 `pnpm run typecheck`
- [ ] 4.2 手动回归：快速输入/切换布局/切换 tab/模拟 429/500/手动刷新
