# Bitlog Markdown 示例文档

这份文档用于一次性展示你项目里“当前已支持”的 Markdown / GFM / 自定义短代码能力：
`remark-parse` + `remark-gfm` + 自定义 inline 解析（blur/shortcode）+ `rehype-raw` + HTML 白名单清洗 + Refractor 高亮。

---

## 0 目录演示

这里会生成 TOC（通常取 `##` / `###` 标题）。你可以往下滚动看到很多二级/三级标题。

写法（示例）：

```markdown
## 0 目录演示

### 0.1 二级标题

### 0.2 二级标题
```

---

## 1 基础排版

普通段落：Bitlog 支持标准 Markdown 段落换行。

这是第二段。

写法：

```markdown
普通段落：Bitlog 支持标准 Markdown 段落换行。

这是第二段。
```

### 1.1 强调 / 删除线 / 行内代码

- **加粗**：`**加粗**`
- _斜体_：`*斜体*`
- ~~删除线~~：`~~删除线~~`（GFM）
- 行内代码：`const a = 1`

写法：

```markdown
**加粗**

*斜体*

~~删除线~~

行内代码：`const a = 1`
```

### 1.2 链接 / 自动链接（GFM Autolink literal）

- 普通链接：[OpenAI Cookbook](https://github.com/openai/openai-cookbook)
- 直接贴 URL 也会自动变成链接（GFM）：https://example.com

写法：

```markdown
[OpenAI Cookbook](https://github.com/openai/openai-cookbook)

https://example.com
```

### 1.3 图片

![示例图片](https://picsum.photos/960/480)

写法：

```markdown
![示例图片](https://picsum.photos/960/480)
```

---

## 2 列表（含任务列表）

### 2.1 无序列表

- 列表项 A
- 列表项 B
  - 子项 B-1
  - 子项 B-2

写法：

```markdown
- 列表项 A
- 列表项 B
  - 子项 B-1
  - 子项 B-2
```

### 2.2 有序列表

1. 第一步
2. 第二步
3. 第三步

写法：

```markdown
1. 第一步
2. 第二步
3. 第三步
```

### 2.3 任务列表（GFM Task list）

- [x] 已完成
- [ ] 未完成
- [ ] 另一个未完成

写法：

```markdown
- [x] 已完成
- [ ] 未完成
- [ ] 另一个未完成
```

---

## 3 引用 / 分割线

> 这是引用块（blockquote）。
>
> 支持多段引用。

写法：

```markdown
> 这是引用块（blockquote）。
>
> 支持多段引用。
```

分割线写法：

```markdown
---
```

---

## 4 表格（GFM Table）

| 字段       |   类型   |                       说明 |
| ---------- | :------: | -------------------------: |
| title      |  string  | 左对齐 / 居中 / 右对齐演示 |
| tags       | string[] |                   支持中文 |
| publish_at |  number  |               时间戳（ms） |

写法：

```markdown
| 字段       |   类型   |                       说明 |
| ---------- | :------: | -------------------------: |
| title      |  string  | 左对齐 / 居中 / 右对齐演示 |
| tags       | string[] |                   支持中文 |
| publish_at |  number  |               时间戳（ms） |
```

---

## 5 脚注（GFM Footnote）

这是一个脚注示例[^1]，也可以有多个脚注[^long]。

[^1]: 脚注内容写在文末（或任意位置，只要能被解析到）。

[^long]:
    支持多行脚注：  
    第二行用缩进或空格继续。

写法：

```markdown
这是一个脚注示例[^1]，也可以有多个脚注[^long]。

[^1]: 脚注内容写在文末（或任意位置，只要能被解析到）。

[^long]:
    支持多行脚注：  
    第二行用缩进或空格继续。
```

---

## 6 代码块（高亮 + 复制按钮）

使用三反引号代码块，并写“语言名”。你项目内已注册（可高亮）的语言包括（按类别）：

- Web：`javascript` `typescript` `tsx` `jsx` `json` `diff`
- Shell：`bash` `powershell` `docker`
- Backend：`python` `go` `rust` `sql` `php` `ruby`
- JVM：`java` `kotlin`
- C 系：`c` `cpp` `csharp` `clike`
- Markup：`markup` `css` `scss` `yaml` `toml` `graphql` `markdown`

> 说明：不同语言名可能有别名；如果某个 fenced code 没高亮，优先改用上面列表里的语言名（例如 `markup`）。

```typescript
export function add(a: number, b: number) {
  return a + b;
}
```

```java
class Hello {
  public static void main(String[] args) {
    System.out.println("hello");
  }
}
```

```diff
diff --git a/a.txt b/a.txt
index 1111111..2222222 100644
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,2 @@
-hello
+hello world
```

```bash
pnpm run dev:api
pnpm run dev:web
```

写法（示例）：

````markdown
```typescript
export function add(a: number, b: number) {
  return a + b;
}
```

```diff
diff --git a/a.txt b/a.txt
index 1111111..2222222 100644
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,2 @@
-hello
+hello world
```
````

---

## 7 文字模糊（||text||）

把内容包在双竖线里即可：||这段文字会被模糊处理||。

也可以在一句话中混合：发布前请先确认 ||敏感信息|| 已处理。

> 注意：这里必须是半角字符 `|`（不是全角 `｜`），并且不要放在代码块/行内代码里。

写法：

```markdown
||这段文字会被模糊处理||

发布前请先确认 ||敏感信息|| 已处理。
```

---

## 8 嵌入短代码（@[provider](value)）

格式：`@[provider](value)`（注意 `](` 之间不要漏掉括号）。

当前支持的 provider：

- `github`：渲染 GitHub Repo 卡片（页面加载后拉取 GitHub API 信息）
- `gitee`：渲染 Gitee Repo 卡片（通过你自己的 `/api/embed/gitee` 同源接口拉取信息）
- `youtube`：渲染 YouTube iframe（或降级为外链）
- `bilibili`：渲染 Bilibili iframe（或降级为外链）
- `embed`：通用 iframe（仅允许 https 且域名在 allowlist 内，否则降级为外链）

示例：

@[github](openai/openai-cookbook)

@[gitee](openeuler/oec-application)

@[youtube](dQw4w9WgXcQ)

@[bilibili](BV1xx411c7mD)

@[embed](https://player.bilibili.com/player.html?bvid=BV1xx411c7mD)

> 说明：iframe 只会在“白名单域名 + https + sandbox/allow 等安全属性”条件下保留；不满足时会被清洗或降级为普通链接。

写法：

```markdown
@[github](openai/openai-cookbook)

@[gitee](openeuler/oec-application)

@[youtube](dQw4w9WgXcQ)

@[bilibili](BV1xx411c7mD)

@[embed](https://player.bilibili.com/player.html?bvid=BV1xx411c7mD)
```

---

## 9 原始 HTML（允许，但会做 XSS 清洗）

你可以直接写 HTML（会被解析进正文），但会做安全清洗：

- 会移除 `style` 和所有 `on*` 事件属性（例如 `onclick`）
- `<script>` 等不在白名单内的标签会被移除
- `<iframe>` 不是通过短代码生成的话，`src` 会被清掉（相当于不显示）

示例（可直接写在 Markdown 里）：

<details>
  <summary>点击展开</summary>
  <p>这里是原始 HTML 内容（允许的标签会保留）。</p>
  <p><span onclick="alert('xss')">这行的 onclick 会被清掉</span></p>
  <p>你也可以手写模糊：<span class="blur">这段也会模糊</span></p>
</details>

写法：

```html
<details>
  <summary>点击展开</summary>
  <p>这里是原始 HTML 内容（允许的标签会保留）。</p>
  <p><span onclick="alert('xss')">这行的 onclick 会被清掉</span></p>
  <p>你也可以手写模糊：<span class="blur">这段也会模糊</span></p>
</details>
```
