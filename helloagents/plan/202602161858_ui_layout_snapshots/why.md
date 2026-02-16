# 变更提案：UI 布局快照 HTML

## 需求背景
当前 UI 分为服务端渲染的前台模板和 React 管理后台。希望为每个页面生成独立的 HTML 快照，
无需运行项目即可快速查看布局。

## 变更范围
1. 为每个页面新增静态 HTML 快照（前台文章列表/详情；后台登录/列表/编辑/设置/账号）。
2. 复用现有 CSS，使快照布局与线上结构一致。
3. 提供简单的本地预览说明。

## 影响范围
- 模块：前台模板、后台页面（仅作为结构参考）。
- 文件：新增 `docs/ui-snapshots/*.html` 与 `docs/ui-snapshots/README.md`。
- API/数据：无变更。

## 核心场景
### 需求：静态布局快照
**模块：** 前台 UI / 后台 UI  
为每个页面提供独立 HTML 快照，便于不启动服务的情况下查看布局。

#### 场景：前台布局查看
- 期望：`web-articles.html` 与 `web-post.html` 在浏览器中可打开并展示代表性布局。

#### 场景：后台布局查看
- 期望：`admin-login.html`、`admin-posts.html`、`admin-editor.html`、`admin-settings.html`、
  `admin-account.html` 在浏览器中可打开并展示代表性布局。

## 风险
- 风险：快照可能与真实 UI 逐渐偏离。
- 规避：保持 DOM 结构一致并复用现有 CSS；示例数据明确标注为占位内容。
