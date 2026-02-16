# Bitlog Markdown 格式演示（可直接粘贴到后台编辑器）

下面这些能力来自你项目里的渲染器（`remark-gfm` + 自定义短代码 + Refractor 高亮 + HTML 白名单清洗）。

---

## 1) 表格（GFM Table）

| 字段 | 类型 | 说明 |
| --- | :--: | ---: |
| title | string | 左对齐 / 居中 / 右对齐演示 |
| tags | string[] | 支持中文 |
| publish_at | number | 时间戳（ms） |

---

## 2) 脚注（GFM Footnote）

这是一个脚注示例[^1]，也可以有多个脚注[^long]。

[^1]: 脚注内容写在文末（或任意位置，只要能被解析到）。
[^long]: 支持多行脚注：  
    第二行用缩进或空格继续。

---

## 3) 代码高亮（Refractor）

使用三反引号代码块，并写“语言名”。你项目内已注册的语言包括：
`javascript`、`typescript`、`tsx`、`jsx`、`json`、`bash`、`rust`、`sql`、`markdown`。

> 注意：不写语言名（例如只写 ```）时不会触发高亮。

```typescript
export function add(a: number, b: number) {
  return a + b
}
```

```bash
pnpm run dev:api
pnpm run dev:web
```

```sql
SELECT key, value
FROM settings
WHERE key = 'site.title';
```

```rust
fn main() {
    println!("hello");
}
```

---

## 4) 文字模糊（||text||）

把内容包在双竖线里即可：||这段文字会被模糊处理||。

也可以在一句话中混合：发布前请先确认 ||敏感信息|| 已处理。

> 注意：这里必须是半角字符 `|`（不是全角 `｜`），并且不要放在代码块/行内代码里。

---

## 5) 嵌入短代码（@[provider](value)）

格式：`@[provider](value)`（注意 `](` 之间不要漏掉括号）。

你项目当前支持的 provider：
- `github`：渲染一个 GitHub 卡片链接
- `youtube`：渲染 YouTube iframe（或降级为外链）
- `bilibili`：渲染 Bilibili iframe（或降级为外链）
- `embed`：通用 iframe（仅允许 https 且域名在 allowlist 内，否则降级为外链）

示例：

@[github](openai/openai-cookbook)

@[youtube](dQw4w9WgXcQ)

@[bilibili](BV1xx411c7mD)

@[embed](https://player.bilibili.com/player.html?bvid=BV1xx411c7mD)

> 说明：iframe 只会在“白名单域名 + https + data-bitlog-embed=1”条件下保留；不满足时会被清洗或降级为普通链接。
>
> GitHub 卡片会在页面加载后从 GitHub API 拉取仓库信息（失败时会保留为普通卡片链接）。

---

## 6) 原始 HTML（允许，但会做 XSS 清洗）

你可以直接写 HTML（会被解析进正文），但会做安全清洗：
- 会移除 `style` 和所有 `on*` 事件属性（例如 `onclick`）
- `<script>` 等不在白名单内的标签会被移除
- `<iframe>` 不是通过短代码生成的话，`src` 会被清掉（相当于不显示）

示例（可直接写在 Markdown 里）：

<details>
  <summary>点击展开</summary>
  <p>这里是原始 HTML 内容（允许的标签会保留）。</p>
  <p><span onclick="alert('xss')">这行的 onclick 会被清掉</span></p>
</details>
