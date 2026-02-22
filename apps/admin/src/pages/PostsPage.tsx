import React, { useEffect, useRef, useState } from "react";
import type { AdminPostListItem, ApiError, SiteConfig } from "../api";
import { deleteAdminPost, importAdminPostsBatch, listAdminPosts } from "../api";
import { formatMs } from "../format";
import { SelectBox } from "../components/SelectBox";
import { strFromU8, unzipSync } from "fflate";
import type { AdminImportPostsItem } from "../api";

function normalizeWhitespace(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function parseWxrXmlToItems(xmlText: string): AdminImportPostsItem[] {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const pe = doc.getElementsByTagName("parsererror")[0];
  if (pe) throw new Error("Invalid WordPress XML");

  const out: AdminImportPostsItem[] = [];
  const items = Array.from(doc.getElementsByTagName("item"));
  const textOf = (parent: Element, tagName: string) => parent.getElementsByTagName(tagName)[0]?.textContent ?? "";

  for (const it of items) {
    const postType = normalizeWhitespace(textOf(it, "wp:post_type"));
    if (postType && postType !== "post") continue;

    const title = normalizeWhitespace(textOf(it, "title"));
    const contentHtml = String(textOf(it, "content:encoded") ?? "");
    if (!title || !contentHtml) continue;

    const excerptHtml = String(textOf(it, "excerpt:encoded") ?? "");
    const slug = normalizeWhitespace(textOf(it, "wp:post_name")) || null;
    const publishAt =
      normalizeWhitespace(textOf(it, "wp:post_date_gmt")) ||
      normalizeWhitespace(textOf(it, "wp:post_date")) ||
      null;

    const categories: string[] = [];
    const tags: string[] = [];
    for (const c of Array.from(it.getElementsByTagName("category"))) {
      const domain = (c.getAttribute("domain") ?? "").toLowerCase();
      const name = (c.textContent ?? "").trim();
      if (!name) continue;
      if (domain === "category") categories.push(name);
      if (domain === "post_tag") tags.push(name);
    }

    out.push({
      kind: "wordpress",
      title,
      content_html: contentHtml,
      excerpt_html: excerptHtml || null,
      slug,
      publish_at: publishAt,
      categories,
      tags
    });
  }

  return out;
}

export function PostsPage(props: { cfg: SiteConfig | null; onError: (m: string) => void }) {
  const [posts, setPosts] = useState<AdminPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    total: number;
    processed: number;
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function buildPagerItems(current: number, count: number): Array<number | "…"> {
    const page = Math.max(1, Math.min(count, current));
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

    const items: Array<number | "…"> = [];
    const push = (v: number | "…") => {
      const last = items[items.length - 1];
      if (v === "…" && last === "…") return;
      if (typeof v === "number" && last === v) return;
      items.push(v);
    };

    push(1);
    if (page - 2 > 2) push("…");
    for (const p of [page - 1, page, page + 1]) {
      if (p > 1 && p < count) push(p);
    }
    if (count - (page + 1) > 1) push("…");
    push(count);
    return items;
  }

  async function reload(opts?: { page?: number; pageSize?: number }) {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    setLoading(true);
    try {
      const params: { q?: string; status?: string; page?: number; pageSize?: number } = {};
      const qq = q.trim();
      if (qq) params.q = qq;
      if (status) params.status = status;
      params.page = nextPage;
      params.pageSize = nextPageSize;
       const r = await listAdminPosts(params);
       setPosts(r.posts);
       setHasMore(!!r.hasMore);
       setPage(r.page ?? nextPage);
       setPageSize(r.pageSize ?? nextPageSize);
       setTotal(typeof (r as any).total === "number" ? (r as any).total : null);
       setPageCount(typeof (r as any).pageCount === "number" ? (r as any).pageCount : null);
     } catch (e) {
       const err = e as ApiError;
       props.onError(err.message || "加载失败");
     } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="posts-page">
      <div className="card">
        <div className="row">
          <label>
            搜索（title）
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void reload({ page: 1 });
              }}
              placeholder="输入后点刷新"
            />
          </label>
          <label>
            状态
            <SelectBox
              value={status}
              options={[
                { value: "", label: "全部" },
                { value: "draft", label: "草稿" },
                { value: "published", label: "已发布" },
                { value: "scheduled", label: "定时" }
              ]}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
          </label>
          <label>
            每页
            <SelectBox
              value={String(pageSize)}
              options={[
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "30", label: "30" }
              ]}
              onChange={(v) => {
                const n = Math.max(1, Math.min(30, Number(v || "20")));
                setPageSize(n);
                setPage(1);
                void reload({ page: 1, pageSize: n });
              }}
            />
          </label>
        </div>
        <div style={{ height: 10 }} />
        <div className="nav">
          <button className="chip chip-primary" onClick={() => (window.location.hash = "#/posts/new")}>
            新建（Ctrl/Cmd+N）
          </button>
          <button
            className="chip"
            onClick={() => fileRef.current?.click()}
            disabled={loading || importing}
            title="上传 ZIP 批量导入文章"
          >
            {importing ? "导入中..." : "批量导入"}
          </button>
          <button className="chip" onClick={() => void reload()} disabled={loading}>
            {loading ? "加载中..." : "刷新"}
          </button>
        </div>
        <div className="nav" style={{ marginTop: 10, justifyContent: "center" }}>
          <div className="pager" aria-label="分页">
            <button
              className="pager-btn"
              disabled={loading || page <= 1}
              aria-label="上一页"
              onClick={async () => {
                const next = Math.max(1, page - 1);
                setPage(next);
                await reload({ page: next });
              }}
            >
              ‹
            </button>

            {buildPagerItems(page, Math.max(1, pageCount ?? page)).map((it, idx) =>
              it === "…" ? (
                <span key={`e:${idx}`} className="pager-ellipsis" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={`p:${it}`}
                  className={`pager-btn${it === page ? " is-active" : ""}`}
                  disabled={loading || it === page}
                  aria-label={`第 ${it} 页`}
                  onClick={async () => {
                    setPage(it);
                    await reload({ page: it });
                  }}
                >
                  {it}
                </button>
              )
            )}

            <button
              className="pager-btn"
              disabled={loading || (!!pageCount ? page >= pageCount : !hasMore)}
              aria-label="下一页"
              onClick={async () => {
                const next = page + 1;
                setPage(next);
                await reload({ page: next });
              }}
            >
              ›
            </button>
          </div>
          {typeof total === "number" ? <span className="muted">共 {total} 篇</span> : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!file) return;
            if (
              !confirm(
                `确认导入 ZIP？\n\n文件：${file.name}\n大小：${Math.round(file.size / 1024)} KB\n\n规则：全部发布；slug 冲突跳过；如果没有 slug，则按 title+date 冲突跳过。`
              )
            ) {
              return;
            }
            props.onError("");
            setImporting(true);
            setImportProgress(null);
            try {
              const zipBytes = new Uint8Array(await file.arrayBuffer());
              const map = unzipSync(zipBytes);
              const entries = Object.entries(map)
                .map(([path, bytes]) => ({ path: String(path ?? ""), bytes }))
                .filter((x) => x.path && !x.path.endsWith("/"));

              const mdEntries = entries.filter((x) => x.path.toLowerCase().endsWith(".md"));
              const xmlEntries = entries.filter((x) => x.path.toLowerCase().endsWith(".xml"));

              const importItems: AdminImportPostsItem[] = [];
              for (const m of mdEntries) {
                importItems.push({ kind: "markdown", path: m.path, content: strFromU8(m.bytes) });
              }
              for (const x of xmlEntries) {
                const xmlText = strFromU8(x.bytes);
                const wpItems = parseWxrXmlToItems(xmlText);
                for (const it of wpItems) importItems.push(it);
              }

              if (importItems.length === 0) {
                throw new Error("ZIP 中未找到 .md 或 WordPress .xml");
              }

              setImportProgress({ total: importItems.length, processed: 0, imported: 0, skipped: 0, failed: 0 });

              let totalImported = 0;
              let totalSkipped = 0;
              let totalFailed = 0;
              const allResults: any[] = [];

              for (let i = 0; i < importItems.length; i++) {
                const it = importItems[i];
                const isFinal = i === importItems.length - 1;

                try {
                  const r = await importAdminPostsBatch([it], { final: isFinal });
                  totalImported += r.imported;
                  totalSkipped += r.skipped;
                  totalFailed += r.failed;
                  allResults.push(...(r.items ?? []));
                } catch (ex) {
                  totalFailed += 1;
                  const err = ex as ApiError;
                  allResults.push({
                    ok: false,
                    source: it.kind,
                    path: (it as any).path ?? (it as any).title ?? `item:${i}`,
                    error: err.message || "导入失败"
                  });
                }

                setImportProgress({
                  total: importItems.length,
                  processed: i + 1,
                  imported: totalImported,
                  skipped: totalSkipped,
                  failed: totalFailed
                });
              }

              const sampleErrors = allResults.filter((x: any) => x && x.ok === false).slice(0, 6) as any[];
              const errText =
                sampleErrors.length > 0
                  ? `\n\n失败示例：\n${sampleErrors.map((x) => `- ${x.path}: ${x.error}`).join("\n")}`
                  : "";
              alert(`导入完成：\n- 已导入：${totalImported}\n- 已跳过：${totalSkipped}\n- 失败：${totalFailed}${errText}`);
              await reload();
            } catch (ex) {
              const err = ex as ApiError;
              props.onError(err.message || "导入失败");
            } finally {
              setImporting(false);
              setImportProgress(null);
            }
          }}
        />
      </div>

      {importProgress ? (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>导入进度</div>
          <div className="muted">
            已处理 {importProgress.processed}/{importProgress.total}
          </div>
          <div style={{ height: 6 }} />
          <div className="muted">
            已导入：{importProgress.imported}｜已跳过：{importProgress.skipped}｜失败：{importProgress.failed}
          </div>
        </div>
      ) : null}

      <div className="card posts-table">
        <table className="table">
          <thead>
            <tr>
              <th>标题</th>
              <th>状态</th>
              <th>发布时间</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 750 }}>{p.title}</div>
                  <div className="muted">/{p.slug}</div>
                </td>
                <td>{p.status}</td>
                <td>{formatMs(p.publish_at, props.cfg?.timezone ?? null)}</td>
                <td className="muted">{formatMs(p.updated_at, props.cfg?.timezone ?? null)}</td>
                <td>
                  <div className="nav">
                    <button className="chip" onClick={() => (window.location.hash = `#/posts/${p.id}`)}>
                      编辑
                    </button>
                    <button
                      className="chip"
                      onClick={async () => {
                        if (!confirm("硬删除该文章？")) return;
                        try {
                          await deleteAdminPost(p.id);
                          await reload();
                        } catch (e) {
                          const err = e as ApiError;
                          props.onError(err.message || "删除失败");
                        }
                      }}
                    >
                      删除
                    </button>
                    <a className="chip" href={`/articles/${encodeURIComponent(p.slug)}`} target="_blank" rel="noreferrer">
                      预览
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  暂无文章
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
