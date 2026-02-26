# hotpush-main 内置 13 个热点源（用于 Bitlog「今日热点」）

本文件把 `hotpush-main/backend/app/utils/sources.py` 里的 13 个 `HOT_SOURCES` 按 Bitlog 的数据结构整理出来，方便你在后台逐条新增。

> Bitlog 侧不运行 `RSSHub-master` 源码；Bitlog 只是“拉取并解析 RSS/Atom”的聚合器。  
> `kind = rsshub` 的源必须依赖一个可用的 RSSHub 实例（你自建或第三方实例）。

## 字段含义（对应后台新增表单）

- `slug`：唯一标识（建议用小写 + 下划线，如 `douban_movie`）
- `name`：展示名称
- `category`：分类（用于页面筛选）
- `kind`：
  - `rsshub`：RSSHub route（`routeOrUrl` 填 route，如 `/hackernews/best`）
  - `rss`：直接 RSS URL（`routeOrUrl` 填完整 URL，如 `https://linux.do/latest.rss`）
- `routeOrUrl`：route 或 url
- `icon`：图标 URL（可空）
- `enabled`：是否启用

## RSSHub 实例配置（必需）

在 Bitlog 后台管理里设置：

- `hot.rsshub_url`：你的 RSSHub 基础地址（示例：`https://rsshub.example.com`）
- `hot.rsshub_fallback_urls`：可选，逗号分隔的备用实例（最多 5 个）

## 13 个源清单（含 icon）

图标统一来自 Google favicon：

`https://www.google.com/s2/favicons?domain=<domain>&sz=64`

| slug | name | category | kind | routeOrUrl | icon | cookie/备注 |
|---|---|---|---|---|---|---|
| weibo | 微博热搜 | 热搜榜 | rsshub | `/weibo/search/hot` | `https://www.google.com/s2/favicons?domain=weibo.com&sz=64` | 通常需要 RSSHub 配置 `WEIBO_COOKIE` |
| zhihu | 知乎热榜 | 热搜榜 | rsshub | `/zhihu/hot` | `https://www.google.com/s2/favicons?domain=zhihu.com&sz=64` | 一般不需要 cookie（取决于实例可用性） |
| bilibili | B站热搜 | 视频 | rsshub | `/bilibili/hot-search` | `https://www.google.com/s2/favicons?domain=bilibili.com&sz=64` | 通常需要 RSSHub 配置 `BILIBILI_COOKIE` |
| v2ex | V2EX 热门 | 技术 | rsshub | `/v2ex/topics/hot` | `https://www.google.com/s2/favicons?domain=v2ex.com&sz=64` | 一般不需要 cookie |
| hackernews | Hacker News | 技术 | rsshub | `/hackernews/best` | `https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64` | 一般不需要 cookie |
| juejin | 掘金热榜 | 技术 | rsshub | `/juejin/trending/all/weekly` | `https://www.google.com/s2/favicons?domain=juejin.cn&sz=64` | 一般不需要 cookie（可能受反爬影响） |
| linuxdo | Linux DO | 技术 | rss | `https://linux.do/latest.rss` | `https://www.google.com/s2/favicons?domain=linux.do&sz=64` | 直连 RSS：是否可用取决于你的部署网络环境 |
| sspai | 少数派 | 科技资讯 | rsshub | `/sspai/index` | `https://www.google.com/s2/favicons?domain=sspai.com&sz=64` | 一般不需要 cookie |
| pingwest | 品玩 | 科技资讯 | rsshub | `/pingwest/status` | `https://www.google.com/s2/favicons?domain=pingwest.com&sz=64` | 一般不需要 cookie |
| douban_movie | 豆瓣热映 | 影视 | rsshub | `/douban/movie/playing` | `https://www.google.com/s2/favicons?domain=douban.com&sz=64` | 一般不需要 cookie（可能受反爬/地区影响） |
| douban_book | 豆瓣新书 | 阅读 | rsshub | `/douban/book/latest` | `https://www.google.com/s2/favicons?domain=douban.com&sz=64` | 一般不需要 cookie（可能受反爬/地区影响） |
| zaobao | 联合早报 | 新闻 | rsshub | `/zaobao/realtime/china` | `https://www.google.com/s2/favicons?domain=zaobao.com&sz=64` | 一般不需要 cookie（实例可能报 503/限流） |
| thepaper | 澎湃新闻 | 新闻 | rsshub | `/thepaper/featured` | `https://www.google.com/s2/favicons?domain=thepaper.cn&sz=64` | 一般不需要 cookie |

## 示例文件

- JSON 示例（可作为“逐条新增时的参考”）：`docs/hot-sources-hotpush-main-13.json`

