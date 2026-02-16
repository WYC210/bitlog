# 任务清单: NewEchoes 样式同步（审计+预览）

目录: `helloagents/plan/202602162047_newechoes_style_sync/`

---

## 1. 样式审计
- [√] 1.1 在 `newechoes_git/src/components/Layout.astro` 与 `newechoes_git/src/styles/global.css` 中确认背景底色/光晕边框层级，验证 why.md#需求-背景渐变复刻-场景-梳理原站背景层级
- [√] 1.2 在 `newechoes_git/src/components/ThemeToggle.astro` 与 `newechoes_git/src/styles/theme-toggle.css` 中确认主题切换过渡与遮罩细节，验证 why.md#需求-交互高亮与主题过渡细节-场景-复刻主题切换过渡
- [√] 1.3 在 `newechoes_git/src/styles/articles.css` 与 `newechoes_git/src/styles/header.css` 中补全高亮/渐变细节，验证 why.md#需求-交互高亮与主题过渡细节-场景-复刻主题切换过渡

## 2. 预览实现
- [√] 2.1 在 `docs/ui-style-sync/base.css` 中实现 light/dark 背景渐变层级与光晕，验证 why.md#需求-背景渐变复刻-场景-梳理原站背景层级
- [√] 2.2 在 `docs/ui-style-sync/theme-toggle.js` 中对齐主题切换过渡参数与遮罩方式，验证 why.md#需求-交互高亮与主题过渡细节-场景-复刻主题切换过渡
- [-] 2.3 在 `docs/ui-style-sync/web-home.html` 与 `docs/ui-style-sync/web-home.dark.html` 中补充必要的背景层容器（如需要），验证 why.md#需求-背景渐变复刻-场景-梳理原站背景层级
  > 备注: 背景层级已通过 `body` 背景与全局伪元素实现，无需额外容器。

## 3. 安全检查
- [√] 3.1 执行安全检查（按G9: 输入验证、敏感信息处理、权限控制、EHRB风险规避）

## 4. 文档更新
- [√] 4.1 更新 `docs/ui-style-sync/README.md` 的预览说明与校验要点

## 5. 测试
- [X] 5.1 手工打开 `docs/ui-style-sync/web-home.html`/`web-home.dark.html` 对照原站截图核验渐变与过渡效果
  > 备注: 当前环境无法手动打开浏览器，请你本地核验。
