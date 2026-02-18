# Bitlog UI 重设计计划

> 状态说明：⬜ 待执行 / 🔄 进行中 / ✅ 已完成

---

## 涉及文件清单

| 文件 | 用途 |
|------|------|
| `apps/admin/src/styles.css` | admin 全局样式 |
| `apps/admin/src/pages/EditorPage.tsx` | 编辑器页面 |
| `apps/admin/src/App.tsx` | admin 主框架（topbar/nav） |
| `apps/admin/src/pages/PostsPage.tsx` | 文章列表页 |
| `apps/admin/src/pages/AccountPage.tsx` | 账号页 |
| `apps/admin/src/pages/SettingsPage.tsx` | 设置页 |
| `apps/web/public/ui/base.css` | 前台全局样式 |
| `apps/web/src/app.ts` | 前台 HTML 渲染逻辑 |

---

## PHASE 1 — Admin 后台重设计

### Task 1.1 — Admin 设计系统重建 ⬜

**文件：** `apps/admin/src/styles.css`

- [ ] CSS 变量对齐前台 `base.css` token 体系（`--surface-2`、`--shadow`、`--focus` 等）
- [ ] 新增 `--radius-btn: 10px`（按钮改方形圆角，告别 pill 形）
- [ ] 新增 `--color-github`、`--color-gitee` 平台色变量
- [ ] `.chip` 保留 pill 形用于标签，新增 `.btn` 三档：`primary` / `secondary` / `ghost`
- [ ] 表单 `input/select/textarea` focus 加蓝色光晕动画
- [ ] 间距系统：用 CSS gap 替代 `<div style={{height:10}}/>`（样式层面）
- [ ] 新增 `.toast` 组件样式（右下角滑入，success/error 两种）
- [ ] `.card` padding 从 14px → 20px
- [ ] `.toolbox-btn` 换成方形图标按钮样式

---

### Task 1.2 — Toolbox SVG 图标替换 ⬜

**文件：** `apps/admin/src/pages/EditorPage.tsx`

替换汉字图标为内联 Lucide SVG（无需安装依赖）：

| 原图标 | 替换为 |
|--------|--------|
| 模（模糊） | EyeOff SVG |
| ` （行内代码） | Code SVG |
| {} （代码块） | FileCode SVG |
| 链（链接） | Link SVG |
| 图（图片） | Image SVG |
| 嵌（嵌入） | Layers SVG |

- [ ] 替换全部 6 个 `toolbox-icon` 内的汉字为对应 SVG
- [ ] `toolbox-icon` 尺寸从 22px → 20px，改为纯 SVG 容器

---

### Task 1.3 — 保存改 Toast ⬜

**文件：** `apps/admin/src/pages/EditorPage.tsx`

- [ ] 删除 `alert("已保存")`
- [ ] 新增内联 `useToast` hook（state + setTimeout 自动消失 3s）
- [ ] 渲染 `<div class="toast toast-success">已保存</div>` 到页面右下角
- [ ] 错误提示也走 toast（`toast-error`）

---

### Task 1.4 — 编辑器页面布局优化 ⬜

**文件：** `apps/admin/src/pages/EditorPage.tsx`

- [ ] 删除所有 `<div style={{ height: 10 }} />`，改用 CSS gap
- [ ] nav 区域按钮层级重构：
  - "返回列表" → `.btn.ghost`（带左箭头 SVG）
  - "预览" → `.btn.secondary`
  - "保存" → `.btn.primary`（更大 padding，更明显）
  - 布局切换（写作/预览/分屏）→ segmented control 样式
- [ ] 表单 label 明确 `font-size: 13px; font-weight: 600`
- [ ] 图片上传区域改成虚线拖拽区样式

---

### Task 1.5 — App.tsx topbar 优化 ⬜

**文件：** `apps/admin/src/App.tsx`

- [ ] brand 文字加渐变色（对齐前台）
- [ ] nav 链接 active 状态加蓝色背景高亮
- [ ] topbar 高度明确为 60px

---

## PHASE 2 — 前台文章页重设计

### Task 2.1 — 分类/标签彩色系统 ⬜

**文件：** `apps/web/src/app.ts` + `apps/web/public/ui/base.css`

**`app.ts` 改动：**
- [ ] 新增 `hashColor(str)` 函数，根据名称 hash 出 6 种颜色之一：`blue / purple / green / orange / pink / teal`
- [ ] 文章卡片 `catChip` 从 `chip primary` → `chip chip--{color}`
- [ ] 文章详情页 `catChip` 和 `tagChips` 同样加颜色 class
- [ ] 侧边栏 `renderChipsWithActive` 也加颜色

**`base.css` 改动：**
- [ ] 新增 6 种颜色 chip 变体（light mode）：
  ```css
  .chip--blue   { color: #1d4ed8; background: #eff6ff; border-color: #bfdbfe; }
  .chip--purple { color: #6d28d9; background: #f5f3ff; border-color: #ddd6fe; }
  .chip--green  { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
  .chip--orange { color: #92400e; background: #fffbeb; border-color: #fde68a; }
  .chip--pink   { color: #9d174d; background: #fdf2f8; border-color: #fbcfe8; }
  .chip--teal   { color: #134e4a; background: #f0fdfa; border-color: #99f6e4; }
  ```
- [ ] dark mode 对应变体（降低饱和度）

---

### Task 2.2 — 文章卡片视觉升级 ⬜

**文件：** `apps/web/public/ui/base.css`

- [ ] `.article-card` 左边加 3px 蓝色竖线（hover 时显现）
- [ ] 标题 hover 时颜色变为 `--primary`
- [ ] meta 行（日期 + 分类）间距优化

---

## PHASE 3 — 前台项目页重设计

### Task 3.1 — 项目卡片结构重构 ⬜

**文件：** `apps/web/src/app.ts`

- [ ] 卡片结构改为带头像的横排布局（对标截图风格）
- [ ] avatar URL 规则：
  - GitHub: `https://github.com/{owner}.png?size=48`（从 fullName 解析 owner）
  - Gitee: `https://gitee.com/{owner}.png?size=48`
- [ ] 平台 badge 改为 `repo-platform--github`（黑底白字）/ `repo-platform--gitee`（红底白字）
- [ ] meta pills 加 SVG 小图标（star / fork）

---

### Task 3.2 — 项目卡片样式 ⬜

**文件：** `apps/web/public/ui/base.css`

- [ ] `.repo-card__inner` flex 横排，avatar 左侧 48px 圆形
- [ ] `.repo-platform--github` → `background: #24292e; color: #fff`
- [ ] `.repo-platform--gitee` → `background: #c0392b; color: #fff`
- [ ] 卡片 hover 时左边出现蓝色竖线

---

## PHASE 4 — 前台工具中心重设计

### Task 4.1 — 工具卡片结构重构 ⬜

**文件：** `apps/web/src/app.ts`

- [ ] 根据 `groupKey` 自动分配内联 SVG 图标：
  - `games` → gamepad SVG
  - `apis` → code SVG
  - `utils` → wrench SVG
  - `other` → grid SVG
- [ ] 如果 `t.icon` 字段有值，优先使用（支持后台自定义）
- [ ] 卡片结构加图标区域 `<div class="tool-card__icon tool-card__icon--{group}">`
- [ ] group chip 改为彩色（games=紫、apis=蓝、utils=绿、other=灰）
- [ ] 去掉冗余的 kind chip

---

### Task 4.2 — 工具卡片样式 ⬜

**文件：** `apps/web/public/ui/base.css`

- [ ] `.tool-card__icon` 40×40 圆角方块，带渐变背景
- [ ] 4 种 group 颜色渐变：
  - games: 紫色 `#7c3aed → #a78bfa`
  - apis: 蓝色 `#2563eb → #60a5fa`
  - utils: 绿色 `#059669 → #34d399`
  - other: 灰色 `#475569 → #94a3b8`
- [ ] 卡片整体 padding 加大到 20px

---

## 执行顺序

```
Phase 1: 1.1 → 1.2 → 1.3 → 1.4 → 1.5   (admin 后台)
Phase 2: 2.1 → 2.2                        (前台文章页)
Phase 3: 3.1 → 3.2                        (前台项目页)
Phase 4: 4.1 → 4.2                        (前台工具中心)
```

---

## 进度记录

| Task | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| 1.1 Admin 设计系统 | ✅ 已完成 | 2026-02-18 | CSS 变量、btn/chip/card/toast/table/upload-zone 全部重建 |
| 1.2 Toolbox SVG 图标 | ✅ 已完成 | 2026-02-18 | 6 个汉字图标替换为 Lucide 内联 SVG |
| 1.3 保存改 Toast | ✅ 已完成 | 2026-02-18 | useToast hook + toast-success/toast-error |
| 1.4 编辑器布局优化 | ✅ 已完成 | 2026-02-18 | 删除 height:10 spacer，nav 按钮升级为 btn 系统，segmented switcher |
| 1.5 Topbar 优化 | ✅ 已完成 | 2026-02-18 | brand 渐变色，nav 改 btn-ghost/btn-secondary active 高亮 |
| 2.1 分类/标签彩色系统 | ✅ 已完成 | 2026-02-18 | hashColor() + chip--{color} 6色，前台所有 catChip/tagChips/sidebar 更新 |
| 2.2 文章卡片升级 | ✅ 已完成 | 2026-02-18 | 左边蓝色竖线 hover，标题 hover 变 primary |
| 3.1 项目卡片结构 | ✅ 已完成 | 2026-02-18 | avatar + repo-card__inner 横排，platform badge 独立 class |
| 3.2 项目卡片样式 | ✅ 已完成 | 2026-02-18 | github 黑/gitee 红 badge，hover 蓝色竖线，avatar 圆形 |
| 4.1 工具卡片结构 | ✅ 已完成 | 2026-02-18 | groupKey 自动分配 SVG 图标，去掉 kind chip |
| 4.2 工具卡片样式 | ✅ 已完成 | 2026-02-18 | tool-card__icon 40px 渐变方块，4 种 group 颜色，padding 20px |
