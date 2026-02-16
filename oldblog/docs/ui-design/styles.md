# 视觉系统与样式约束

## 颜色体系

- 主色：蓝紫渐变体系（primary-50 ~ primary-950）
- 中性色：gray-50 ~ gray-950
- 深色模式：dark-bg / dark-surface / dark-card / dark-border

## 背景与容器

- 默认背景：浅色 `bg-gray-50`，深色 `bg-dark-bg`
- 卡片容器：圆角 + 阴影 + 边框，悬停上浮

## 文章卡片（article-card）

- 卡片为纵向结构，含图标、标题、摘要、日期、入口
- 悬停时阴影加深并上移
- 深色模式下背景与边框自动切换

## 排版与正文样式（文章页）

- 标题层级明确：H1/H2 带底部分隔线与渐变装饰
- 引用区块：浅色背景 + 左侧彩色边线
- 链接：底部细线强调
- `details/summary` 可折叠样式

## 目录 TOC 样式

- 当前阅读条目左侧高亮条
- 子级目录可折叠

## 滚动条样式

- 全局统一细滚动条
- 深色模式使用独立配色
- 搜索结果区滚动条更细

## 来源参考

- `src/styles/global.css`
- `src/styles/articles.css`
- `src/styles/articles-table.css`
- `src/styles/articles-code.css`
- `src/styles/header.css`
