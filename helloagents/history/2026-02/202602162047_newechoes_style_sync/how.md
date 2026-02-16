# 技术设计: NewEchoes 样式同步（审计+预览）

## 技术方案
### 核心技术
- 静态 HTML 预览页（`docs/ui-style-sync/`）
- 原站样式审计（`newechoes_git` 源码对照）

### 实现要点
- 定位并记录原站背景层级：  
  - `newechoes_git/src/components/Layout.astro` 的 `body` 基础底色  
  - `newechoes_git/src/styles/global.css` 的 `body::after` 全局光晕  
  - `newechoes_git/src/components/ThemeToggle.astro` 的 view‑transition 径向遮罩  
  - `newechoes_git/src/styles/header.css` 的滚动头部半透明背景  
- 汇总为“背景层级模型”（底色 → 渐变/覆盖层 → 光晕/边框 → header 半透明层）。
- 在 `docs/ui-style-sync/base.css` 中实现 light/dark 背景渐变与光晕层级，保证全站一致。
- 在 `docs/ui-style-sync/theme-toggle.js` 中对齐主题切换过渡（时长、遮罩方式、触发时机）。
- 如需容器级别覆盖层，补充到关键预览页（先以首页为基准验证，再推广到其他页）。

## 架构设计
无架构调整，仅限预览与样式同步。

## 安全与性能
- **安全:** 无用户输入处理，仅静态预览。
- **性能:** 过渡动画限制时长与阴影强度，避免低端设备卡顿。

## 测试与部署
- **测试:** 逐页打开 `docs/ui-style-sync/*.html`，对照原站与截图检查渐变方向、层级和高亮效果。
- **部署:** 无。
