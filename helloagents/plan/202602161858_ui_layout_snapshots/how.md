# 技术设计：UI 布局快照 HTML

## 技术方案
- 目录：`docs/ui-snapshots/`。
- 前台页面：基于 `apps/web/public/_templates/articles.html` 与 `post.html`，替换模板变量为示例数据，并保持结构与 CSS 不变。
- 后台页面：编写与 React 页面结构一致的静态 HTML，样式复用 `apps/admin/src/styles.css`。
- JS 尽量少或不使用；快照仅用于展示布局。

## 实施要点
- 后台快照使用共享样式块或复制 `styles.css`。
- 统一占位内容（标题、chip、表格、标签），保证布局可读。
- 新增 `docs/ui-snapshots/README.md`，包含预览步骤与文件清单。

## 安全与性能
- 安全：不包含真实账号、Token 或生产 URL。
- 性能：纯静态 HTML，无运行时依赖。

## 测试与发布
- 手动：逐个打开快照 HTML，与当前 UI 布局进行目视对比。
