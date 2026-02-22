# Bitlog `/about` 配置录入优化：修改计划（替代手写 JSON）

> 目标：把「技能专长（JSON）」「旅行足迹（地点列表 JSON）」「工作经历（JSON）」从纯 JSON 文本框升级为**结构化编辑器**（录入友好、可发现、可校验、可预览），同时保留“高级：JSON 导入/导出”作为兜底。

---

## 0. 背景与痛点（与快捷键 JSON 同类）

当前 `/about` 的三块配置依赖用户手写 JSON，常见问题：
- 录入成本高：字段名/层级/引号/逗号容易错，改一条就可能整段 JSON 失效。
- 不可发现：不知道字段是否必填、枚举值有哪些（如 `level`）、`icon` 怎么写。
- 缺少语义校验：JSON 能解析不代表语义正确（时间格式、两段地点规则、重复项、空条目）。
- 缺少高频操作能力：批量粘贴、去重、排序（拖拽）、预览、撤销/重做。

---

## 1. 已确认的需求与规则

### 1.1 技能专长（Skills）
- 字段：`title/description/tags/icon` + 可选 `level/url`
- `level`：**枚举**（在 UI 中下拉选择）
- `url`：每条 **最多 1 个**（可选；有值才展示）
- 其他字段空/未填：前台不显示（不强制必填，按“有就展示”）

### 1.2 旅行足迹（Visited places）
- 数据结构仍为 `string[]`（纯文本）
- 目标规范：`A-B`（只保留 1 个半角短横线 `-`，两侧无空格）
- 支持“智能识别并自动标准化”：
  - `中国 - 北京`、`中国—北京` 等统一为 `中国-北京`
  - 支持多分隔符输入（`- / \\ > → , ，；` 等），批量粘贴可拆条
- 只允许两段：超过两段时**自动把尾巴合并进第二段**，用 `·` 连接，不丢信息：
  - `中国-北京-海淀-中关村` → `中国-北京·海淀·中关村`

### 1.3 工作经历（Experience）
- 按“时间段维度”编辑与展示（时间线）
- 时间精度：YYYY-MM（年月）
- 允许“至今”
- 字段均可选：有值才展示；空则不展示
  - 仍建议 `from`（开始年月）为最小必填，否则无法排序/展示时间线

---

## 2. 数据模型（存储层保持兼容）

仍使用 settings 表的三个 key：
- `about.tech_stack_json`：技能专长（JSON 文本）
- `about.visited_places_json`：旅行足迹（JSON 文本，数组字符串）
- `about.timeline_json`：工作经历（JSON 文本，数组对象）

### 2.1 Skills（建议 canonical 形态）
数组元素为对象（兼容现有 about 页解析逻辑）：
```json
{
  "title": "前端开发",
  "description": "…",
  "tags": ["React", "TypeScript"],
  "icon": "frontend",
  "level": "advanced",
  "url": "https://…"
}
```

### 2.2 Visited places（canonical 形态）
```json
["中国-北京", "中国-广东"]
```

### 2.3 Experience（建议 canonical 形态）
```json
{
  "from": "2022-03",
  "to": "2024-09",
  "present": false,
  "title": "前端工程师",
  "company": "某公司",
  "description": "…",
  "url": "https://…"
}
```
`present=true` 时要求 `to` 为空或忽略。

---

## 3. UI/交互设计（编辑器形态）

### 3.1 通用能力（3 块共用）
- 列表卡片编辑：新增/删除/上下移动（或拖拽排序）
- 即时校验：逐条标红 + 明确错误原因（不会“选了就消失”/不会静默丢数据）
- 批量粘贴入口（Visited places 必须）
- 一键“标准化/去重”按钮
- “高级：JSON”折叠区：导入/导出/格式化（保留 power-user 能力）

> 下拉选择统一使用现有 `SelectBox`（popover），避免原生 `<select>` 的整屏体验问题。

### 3.2 Skills 编辑器
每条卡片字段：
- `title`：输入框
- `description`：多行（可选）
- `tags`：chips 输入（回车添加、退格删除、去重、trim）
- `icon`：下拉（提供推荐值 + 允许自定义字符串）
- `level`：下拉枚举（例如：`beginner/intermediate/advanced/expert`）
- `url`：输入框（可选，保存时校验 http(s)/站内路径）

### 3.3 Visited places 编辑器
两种录入方式：
- 手动逐条添加（每条一个输入框）
- 批量粘贴（textarea）：按换行/分号拆条；在条目内部按多分隔符识别层级

标准化流程（保存前自动执行）：
1) 统一横线字符为 `-`
2) 去除 `-` 两侧空格
3) 识别分隔符并切分为段
4) 超过两段时合并尾巴：`B = parts[1] + '·' + parts[2..].join('·')`
5) 规范化后去重（保留第一次出现的顺序）

### 3.4 Experience（时间线）编辑器
每条卡片字段：
- `from`：年月（YYYY-MM）
- `present`：开关（至今）
- `to`：年月（仅 `present=false` 时可填）
- `title/company/description/url`：全可选

校验：
- `from` 格式合法
- `to`（如有）格式合法且 `from <= to`
- 排序：默认按 `from` 倒序；允许用户手动调整展示顺序（若需要）

---

## 4. 前台展示（/about 页）需要同步的改造点

当前 `apps/web/public/ui/about/about.js` 已支持多种字段别名，但不识别 `from/to/present` 的组合展示。
计划：
- Experience：支持把 `from/to/present` 计算成展示字符串（如 `2022-03 ~ 2024-09`、`2022-03 ~ 至今`）。
- Skills：如 `level/url` 有值则展示为徽标/链接；无则不展示。
- Visited places：仍按数组字符串渲染，不改变 wasm/地图依赖的输入类型。

---

## 5. 实施步骤（建议按小步迭代）

### P0：规格落地（无破坏）
- 明确 `level` 枚举值与中文文案
- 明确 `icon` 推荐列表与自定义策略
- 明确 visited places 的“逗号歧义规则”（条目分隔 vs 层级分隔）

### P1：Visited places 编辑器（最先收益）
- 结构化列表 + 批量粘贴 + 标准化/去重 + 合并尾巴
- 保存仍写回 `about.visited_places_json`

### P2：Skills 编辑器
- tags chips + icon/level SelectBox + url 校验
- 保存仍写回 `about.tech_stack_json`

### P3：Experience 时间线编辑器
- 月份输入 + 至今开关 + 语义校验
- 保存仍写回 `about.timeline_json`

### P4：/about 预览与展示增强
- Admin 内侧边预览（或新窗口预览）对齐前台渲染
- 前台 about.js 增强支持 `from/to/present`、`level/url`

---

## 6. 验收标准（可操作）
- 不需要手写 JSON，也能完成三块配置的新增/修改/删除/排序/保存。
- 批量粘贴能自动拆分、标准化、合并尾巴、不丢信息，且能提示无效行原因。
- 保存前能定位错误（第几条/哪个字段），不会出现“操作后条目消失”。
- 前台 `/about` 对 `level/url`、`from/to/present` 有值即展示、空则不展示，表现稳定。

