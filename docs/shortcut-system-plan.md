# Bitlog 快捷键 / 快捷操作（录制为主）改造计划

> 目标：把现有“写 JSON 配快捷键”的能力升级为一套 **命令（Action）系统**：可录制、可选择、可发现、可按权限/页面生效，并支持移动端（面板 + 手势）。

---

## 0. 背景与现状问题

当前快捷键配置主要存在以下痛点：
- **录入不友好**：站点级在 `设置页` 是纯 JSON 文本框，用户需要记住动作 key、页面 key、语法（chord/序列）。
- **不可发现**：用户不知道当前页面支持哪些动作、默认键位是什么、哪些已经被覆盖。
- **权限/作用域不清晰**：无法清晰表达“public 可用 vs 仅管理员可用”“Web vs Admin”“全局 vs 页面”。
- **移动端无等价物**：移动端不适合键盘快捷键，需要“可点的快速操作面板 + 少量手势”。

---

## 1. 需求与约束（已确认）

### 1.1 两端都要
- **Web + Admin** 两端都要支持快捷键/快捷操作，但按权限生效。
- 配置层级：保留 **站点默认** + **管理员个人覆盖**。

### 1.2 权限与能力
- **未登录不允许**触发“跳转后台/新建文章/发布”等管理员动作。
- Web/public 不提供 **UI 风格切换（webStyle/adminStyle）** 的动作。
- **light/dark** 是另一类动作：Web/public 允许（与 UI 风格切换完全分离）。

### 1.3 Web：上一篇/下一篇
- 仅做 Web（文章页）。
- 按 **当前列表顺序**（不是按时间线）。
- 若用户不是从列表进入（没有列表上下文），则 **不显示** 上一篇/下一篇（选项 A）。

### 1.4 移动端手势
- 手势只在 **文章正文区域** 生效。
- 需要规避：文本选择、代码块横向滚动、图片拖动、链接点击等误触场景。

### 1.5 UI 风格切换（webStyle/adminStyle）
- 管理员通过快捷命令切换时，必须写入 **站点配置（D1 settings）并全站生效**。

---

## 2. 总体设计：Action Registry + 多触发方式

把“功能”抽象为 **命令 Action**，再用不同触发方式去触发：
- 桌面端：键盘（chord/sequence）+ 命令面板
- 移动端：命令面板（主入口）+ 少量手势（文章正文）
- 配置：下拉选择动作 + 录制绑定（录制为主），JSON 仅作为高级导入/导出

### 2.1 Action Registry（动作注册表）需要声明的信息
每个 Action 需要声明：
- `id`：稳定标识（存储与匹配用）
- `label` / `description`
- `target`：`web` / `admin` / `both`
- `permission`：`public` / `admin`
- `scopes`：`global` 或指定页面（如 `web.post`、`admin.edit`）
- `bindingKinds`：允许的触发方式：`chord` / `sequence` / `gesture` / `panel`
- `defaultBindings`：默认绑定（可按端/页面/权限不同）
- `dangerLevel`：`normal` / `siteSetting`（会改站点配置、全站生效）

---

## 3. 存储模型（兼容现有 shortcuts JSON）

### 3.1 保留两层配置
- 站点默认：`settings.site.shortcuts_json`
- 个人覆盖：`admin_user_prefs.shortcuts_json`
- 生效规则：个人覆盖优先于站点默认（同 Action 同 scope 时覆盖）

### 3.2 结构建议（兼容旧结构）
继续保留 `global/contexts` 的总体形态，但将“键位绑定”收敛到 Action：
- `global`: 全局 action 绑定（如 `toggleLightDark`、`focusSearch`）
- `contexts`: 按页面/上下文分组的 action 绑定

上下文 key 统一规范：
- Web：`web.global`（可选）+ `web.home/web.articles/web.post/web.projects/web.tools/web.about`
- Admin：`admin.global` + `admin.posts/admin.edit/admin.settings/admin.account`

> 现有代码里 Web 使用 `<body data-page="...">`，Admin 使用 `route.page`；后续需要在解析层统一映射到上述 key，避免用户猜上下文名称。

---

## 4. 交互设计（录制为主 + 下拉选择）

### 4.1 配置 UI（站点级 / 个人级）
每个配置页面提供一致的结构化 UI：
1) 选择 **作用域**（全局 / 某页面）
2) 列表：每行一个 Action
   - 动作下拉（只显示当前端/权限/页面可用动作）
   - 绑定显示（展示 chord/sequence/手势）
   - `录制` / `清空` / 冲突提示
3) 高级：导入/导出 JSON（默认折叠）

### 4.2 录制规则
- chord：支持 `mod/ctrl/alt/shift + key`（显示为标准化字符串，如 `mod+s`）
- sequence：支持 `g b` 这类序列，提供超时窗口（例如 900ms），并展示录制进度
- 录制过程提供：撤销/重录/取消
- 冲突检测：同 scope 内同绑定提示冲突（并展示冲突目标）
- 保留键提示：对常见浏览器保留键（如 `ctrl+h`）给出“可能无效”的提示

---

## 5. 可发现性：命令面板（Web + Admin）

### 5.1 面板能力
- 入口：桌面端 `?` 打开；移动端提供按钮（底部/顶部图标）
- 展示：当前页面可用动作 + 全局动作（按权限过滤）
- 搜索：按动作名称过滤
- 每项显示：动作名称、说明、当前绑定（键位/手势）

### 5.2 高影响动作（站点配置类）
对 `dangerLevel=siteSetting` 的动作：
- 在面板中显著标注“全站生效”
- 展示当前值（如 `webStyle=current`）
- 执行后提示“已应用，全站生效”
- 建议提供“回到上一风格”的快捷动作（撤销路径），即使不强制二次确认

---

## 6. Web：上一篇/下一篇（按列表顺序，且无上下文不显示）

### 6.1 列表上下文的获取
当用户从 `/articles` 列表点击进入文章时，保存列表上下文（建议 `sessionStorage`）：
- 当前筛选条件（q/category/tag/page/pageSize）
- 当前列表顺序（slug 数组，或至少相邻 slug）
- 当前文章 slug（或索引）

### 6.2 文章页行为
- 有上下文：显示/启用 `上一篇/下一篇`（键盘 + 手势 + 面板）
- 无上下文（直接打开链接/刷新丢失）：不显示/不启用（选项 A）

---

## 7. 移动端适配（命令面板为主 + 少量手势）

### 7.1 命令面板（移动端主入口）
- 所有可用动作均可“点触发”
- 显示绑定信息（若有）

### 7.2 手势（仅文章正文区域）
- 文章页正文区域：左滑 = 下一篇；右滑 = 上一篇
- 必须排除的场景：
  - 正在选择文字
  - 在代码块/横向可滚动区域
  - 在图片/可拖拽区域
  - 点击链接/按钮的交互
- 无列表上下文时不启用手势（与 prev/next 显示规则一致）

---

## 8. 动作清单（首版建议）

### 8.1 Web / public（不包含 webStyle/adminStyle 切换）
- `openCommandPalette`：打开命令面板（`?` / 移动端按钮）
- `focusSearch`：聚焦搜索（建议 `/`）
- `toggleLightDark`：切换 light/dark（public 允许）
- `goHome`：去首页
- `goArticles`：去文章列表
- `goProjects`：去项目页
- `goTools`：去工具页
- `goAbout`：去关于页
- `postPrev` / `postNext`：上一篇/下一篇（仅 `web.post` 且有列表上下文）

### 8.2 Admin / admin-only
- `openCommandPalette`
- `goSite`：回站点（如 `/articles`）
- `goAdminPosts` / `goAdminSettings` / `goAdminAccount`
- `newPost`
- `editorSave` / `editorPublish` / `editorRefreshPreview`（仅 `admin.edit`）
- `setWebStyle:*` / `setAdminStyle:*`（站点配置类，全站生效，仅 Admin）

---

## 9. 分阶段实施计划（P0 ~ P5）

### P0：止血（校验 + 提示 + 文档）
- JSON 保存校验与错误提示
- 最小冲突提示
- 支持动作/上下文说明（帮助内容）

### P1：Action Registry + 统一解析层
- 动作注册表
- 统一上下文 key 映射
- 兼容旧 shortcuts JSON

### P2：配置 UI（下拉选择 + 录制为主）
- 站点级默认配置 UI
- 个人覆盖配置 UI
- 支持 chord/sequence 录制与冲突提示

### P3：命令面板（Web + Admin）
- `?` 面板
- 移动端按钮入口
- 按页面/权限过滤动作

### P4：移动端手势（文章正文）
- 文章正文区域手势
- 误触规避与降级逻辑

### P5：站点配置类动作（webStyle/adminStyle 全站生效）
- 面板内值选择与“全站生效”提示
- 执行后刷新缓存（依赖 `cache_version`）
- 可选：提供撤销（回到上一风格）

---

## 10. 验收与回归测试清单

### 桌面端
- 不看文档也能在 `?` 面板里找到“本页可用动作”
- 录制 chord/sequence 生效、冲突提示准确
- public 端不出现 `webStyle/adminStyle` 切换动作

### Web 文章页
- 从列表进入：上一篇/下一篇可用（键盘/面板/手势）
- 直接打开链接：上一篇/下一篇不显示

### 移动端
- 面板可用，手势只在正文生效且不误触

### 站点配置类动作
- Admin 切换 `webStyle/adminStyle` 后全站生效（含缓存刷新）
- 面板明确标注“全站生效”，并展示当前值

---

## 11. 快捷键录制执行计划（按你给的动作顺序）
> 目标：先把「用户能录入 + 用户知道有哪些快捷键」跑通；键位先按默认建议，后续允许个人覆盖微调。

### 11.1 第 0 次准备（管理员）
- 确认登录态：未登录不允许录制/触发 admin-only 动作。
- 确认上下文 key：`web.*` / `admin.*`（见 3.2 上下文规范）。
- 打开命令面板入口：桌面端默认 `?`，移动端提供按钮入口（P3）。

### 11.2 录制顺序（站点默认 → 个人覆盖）
1) **Web 全局（public 可用）**
   - 聚焦搜索：`focusSearch`
   - 切换 light/dark：`toggleLightDark`
   - 跳转首页：`goHome`
   - 跳转项目页：`goProjects`
2) **Web 文章页（仅 `web.post` 且有列表上下文）**
   - 上一篇：`postPrev`
   - 下一篇：`postNext`
3) **Admin 全局（admin-only）**
   - 跳转前台：`goSite`
   - 跳转后台页面：`goAdminPosts` / `goAdminSettings` / `goAdminAccount`
   - 新建文章：`newPost`
4) **编辑器页（仅 `admin.edit`）**
   - 刷新预览：`editorRefreshPreview`
   - 保存：`editorSave`
   - 发布：`editorPublish`
5) **站点配置类（admin-only，danger=siteSetting，全站生效）**
   - 切换 `webStyle`：`setWebStyle:*`
   - 切换 `adminStyle`：`setAdminStyle:*`

> 说明：`webStyle/adminStyle` 不给 Web/public；但 `toggleLightDark` 是 public 可用动作（与 UI 风格切换分离）。

### 11.3 每个动作的录制步骤（录制为主 + 下拉选择）
- 在配置 UI 中选择“作用域”（全局 / 当前页面上下文）。
- 每行选择一个 Action（下拉框），点击“录制”绑定 chord/sequence（或选择面板/手势）。
- 出现冲突提示时：优先保留高频动作的键位；低频动作改用 sequence 或只放命令面板。
- 保存后立即在当前页面验证：输入框/编辑器聚焦时不触发导航类动作（避免误触）。

---

## 12. 默认键位建议（首版）
> 原则：桌面端兼容 Mac/Win（`mod`=⌘/Ctrl）；尽量避开浏览器强保留；低频导航优先用 sequence。

### 12.1 Web / public（全局）
- `?`：`openCommandPalette`
- `/`：`focusSearch`（输入聚焦时不抢）
- `shift+d`：`toggleLightDark`
- `g h`：`goHome`
- `g p`：`goProjects`

### 12.2 Web / post（仅有列表上下文时启用）
- `k`：`postPrev`
- `j`：`postNext`

### 12.3 Admin（全局）
- `?`：`openCommandPalette`
- `g s`：`goSite`
- `g p`：`goAdminPosts`
- `g ,`：`goAdminSettings`
- `g a`：`goAdminAccount`
- `c n`：`newPost`

### 12.4 Admin / editor
- `mod+s`：`editorSave`
- `mod+shift+r`：`editorRefreshPreview`（避开浏览器刷新冲突）
- `mod+shift+p`：`editorPublish`

### 12.5 站点配置类（全站生效）
- 不建议给固定键位；优先只放命令面板（搜索 `webStyle` / `adminStyle`）。

---

## 13. 移动端快捷适配（不依赖键盘）
- 主入口：命令面板按钮（P3），支持搜索、分组展示“当前页可用动作”。
- 文章正文区域手势（P4）：
  - 左滑：`postNext`
  - 右滑：`postPrev`
  - 仅在：有列表上下文时启用；并排除文字选择/代码块横滑/图片拖拽/点击链接等场景（见 1.4 / 7.2）。
