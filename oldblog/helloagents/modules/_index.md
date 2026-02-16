# 模块索引

> 通过此文件快速定位模块文档

## 模块清单

| 模块 | 职责 | 状态 | 文档 |
|------|------|------|------|
| pages | 页面与路由 | ✅ | [pages.md](./pages.md) |
| components | UI 组件与交互 | ✅ | [components.md](./components.md) |
| styles | 样式与主题 | ✅ | [styles.md](./styles.md) |
| plugins | 构建与页面过渡 | ✅ | [plugins.md](./plugins.md) |
| assets | 静态资源与 wasm | ✅ | [assets.md](./assets.md) |

## 模块依赖关系

```
pages → components → styles
pages → plugins
components → assets
```

## 状态说明
- ✅ 稳定
- 🚧 开发中
- 📝 规划中
