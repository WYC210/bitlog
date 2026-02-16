# assets 模块

## 职责
- 管理静态资源（图片、wasm、脚本依赖）

## 行为规范
- wasm 资源需在构建阶段可被加载
- 公共资源放置于 `public/`

## 依赖关系
- components 依赖 wasm 与静态资源
- 相关目录：`src/assets`、`public`
