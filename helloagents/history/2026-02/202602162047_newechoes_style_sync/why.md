# 变更提案: NewEchoes 样式同步（审计+预览）

## 需求背景
当前 Bitlog 的 UI 预览与原博客 NewEchoes 存在明显视觉偏差，尤其是背景渐变层级、选中高亮与主题切换过渡。需要先基于原站代码审计这些细节，再把结论同步到 `docs/ui-style-sync/` 的 HTML 预览中，供你审阅确认后再进入实际改造。

## 变更内容
1. 梳理原站 light/dark 的背景层级、渐变走向与全局光晕（含边框/阴影）。
2. 对齐选中高亮、hover/focus 样式与主题切换过渡细节。
3. 更新 UI 预览 HTML/CSS，形成可对照的审阅基线。

## 影响范围
- **模块:** `docs/ui-style-sync`、`helloagents/plan`
- **文件:** `docs/ui-style-sync/base.css`、`docs/ui-style-sync/theme-toggle.js`、`docs/ui-style-sync/*.html`、`docs/ui-style-sync/README.md`
- **API:** 无
- **数据:** 无

## 核心场景

### 需求: 背景渐变复刻
**模块:** `docs/ui-style-sync`
基于原站实现，明确背景底色/渐变层/光晕边框的叠加顺序与颜色参数。

#### 场景: 梳理原站背景层级
在 `newechoes_git` 中定位背景相关实现并形成可执行对照清单。
- 预期结果：给出 light/dark 背景层级与渐变参数清单，可直接落到预览 CSS。

### 需求: 交互高亮与主题过渡细节
**模块:** `docs/ui-style-sync`
对齐选中高亮（导航/卡片/目录）、hover/focus 与主题切换过渡效果。

#### 场景: 复刻主题切换过渡
参照原站 view‑transition + 径向遮罩（ripple/mask）逻辑，整理可复用实现。
- 预期结果：预览版主题切换具备可感知的过渡与遮罩效果。

## 风险评估
- **风险:** 与原站实际观感仍有偏差（截图视角/运行环境差异）。
- **缓解:** 对照原站运行结果与截图逐项核验，必要时补充更多参考页面。
