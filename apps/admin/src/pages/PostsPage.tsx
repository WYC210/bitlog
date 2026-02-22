import React, { useEffect, useRef, useState } from "react";
import type { AdminPostListItem, ApiError, SiteConfig } from "../api";
import { deleteAdminPost, importAdminPostsZip, listAdminPosts } from "../api";
import { formatMs } from "../format";
import { SelectBox } from "../components/SelectBox";

export function PostsPage(props: { cfg: SiteConfig | null; onError: (m: string) => void }) {
  const [posts, setPosts] = useState<AdminPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const params: { q?: string; status?: string } = {};
      const qq = q.trim();
      if (qq) params.q = qq;
      if (status) params.status = status;
      const r = await listAdminPosts(params);
      setPosts(r.posts);
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入后点刷新" />
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
              onChange={setStatus}
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
            title="Upload ZIP to import posts"
          >
            {importing ? "Importing..." : "Bulk Import"}
          </button>
          <button className="chip" onClick={() => void reload()} disabled={loading}>
            {loading ? "加载中..." : "刷新"}
          </button>
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
                `Import ZIP?\n\nFile: ${file.name}\nSize: ${Math.round(file.size / 1024)} KB\n\nRules: publish all; skip on slug conflict; if slug missing, skip on title+date.`
              )
            ) {
              return;
            }
            props.onError("");
            setImporting(true);
            try {
              const r = await importAdminPostsZip(file);
              const sampleErrors = r.items.filter((x: any) => x && x.ok === false).slice(0, 6) as any[];
              const errText =
                sampleErrors.length > 0
                  ? `\n\nSample failures:\n${sampleErrors.map((x) => `- ${x.path}: ${x.error}`).join("\n")}`
                  : "";
              alert(`Import done:\n- Imported: ${r.imported}\n- Skipped: ${r.skipped}\n- Failed: ${r.failed}${errText}`);
              await reload();
            } catch (ex) {
              const err = ex as ApiError;
              props.onError(err.message || "Import failed");
            } finally {
              setImporting(false);
            }
          }}
        />
      </div>

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
