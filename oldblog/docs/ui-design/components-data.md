# 数据类组件

## 豆瓣集合（DoubanCollection）

功能：
- 电影/图书集合展示，封面为主视觉。
- 支持无限滚动加载更多。
- 错误提示与重试入口。

展示形态：
- 多列网格卡片
- 封面图 + 标题链接

## 微信读书列表（WereadBookList）

功能：
- 读取指定书单 ID 的图书数据。
- 支持加载状态与错误提示。

展示形态：
- 多列网格卡片
- 封面图 + 书名 + 作者

## Git 项目集合（GitProjectCollection）

功能：
- 拉取 Git 平台项目列表（默认 GitHub）。
- 支持分页与加载状态。

展示形态：
- 瀑布流卡片
- 展示头像、项目名、描述、语言、Star/Fork、更新时间

## 世界地图（WorldHeatmap）

功能：
- 3D 地球可旋转、悬停显示国家/地区名称。
- 已去过地区高亮，未去过地区灰色提示。
- 支持主题切换、加载状态与错误兜底。

展示形态：
- 大尺寸 3D 地球画布 + 悬浮信息条

## 倒计时（Countdown）

功能：
- 展示目标日期的倒计时。
- 到期后显示“时间已到”。

展示形态：
- 四列时间块：天 / 时 / 分 / 秒

## 来源参考

- `src/components/DoubanCollection.tsx`
- `src/components/WereadBookList.tsx`
- `src/components/GitProjectCollection.tsx`
- `src/components/WorldHeatmap.tsx`
- `src/components/Countdown.tsx`
