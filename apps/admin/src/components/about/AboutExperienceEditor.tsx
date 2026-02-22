import React, { useMemo, useState } from "react";
import { isValidExternalUrlOrPath, safeParseJson, stringifyJson, trimOrUndef } from "./aboutUtils";

type ExperienceItem = {
  from?: string;
  to?: string;
  present?: boolean;
  title?: string;
  company?: string;
  description?: string;
  url?: string;
  date?: string; // legacy fallback
};

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizeYm(input: unknown): string | undefined {
  const s = String(input ?? "").trim();
  if (!s) return undefined;
  if (!YM_RE.test(s)) return undefined;
  return s;
}

function trimText(input: unknown): string | undefined {
  const s = String(input ?? "").trim();
  return s ? s : undefined;
}

function ymToNum(ym: string): number {
  const [y, m] = ym.split("-");
  const year = Number(y);
  const month = Number(m);
  return year * 12 + month;
}

function safeYmToNumMaybe(ym: string | undefined): number | null {
  const v = normalizeYm(ym);
  if (!v) return null;
  return ymToNum(v);
}

function tryParseDateText(dateText: string): { from?: string; to?: string; present?: boolean } {
  const text = String(dateText ?? "").trim();
  if (!text) return {};
  const present = /至今|present|now|current/i.test(text);
  const matches = text.match(/\d{4}-(0[1-9]|1[0-2])/g) ?? [];
  const from = matches.length >= 1 ? normalizeYm(matches[0]) : undefined;
  const to = matches.length >= 2 ? normalizeYm(matches[1]) : undefined;
  return { from, to, present: present || undefined };
}

function normalizeExperienceItem(input: unknown): ExperienceItem {
  if (!input || typeof input !== "object") return {};
  const it = input as any;

  const legacyDate = trimOrUndef(it.date ?? it.DATE ?? it.period ?? it.PERIOD);
  const parsedFrom = trimText(it.from ?? it.FROM);
  const parsedTo = trimText(it.to ?? it.TO);
  const parsedPresent = typeof it.present === "boolean" ? it.present : typeof it.PRESENT === "boolean" ? it.PRESENT : undefined;

  const bestEffort = legacyDate ? tryParseDateText(legacyDate) : {};

  const from = parsedFrom ?? bestEffort.from;
  const present = parsedPresent ?? bestEffort.present;
  const to = present ? undefined : parsedTo ?? bestEffort.to;

  const title = trimOrUndef(it.title ?? it.TITLE);
  const company = trimOrUndef(it.company ?? it.COMPANY ?? it.org ?? it.ORG);
  const description = trimOrUndef(it.description ?? it.DESCRIPTION ?? it.desc ?? it.DESC);
  const url = trimOrUndef(it.url ?? it.URL);

  const out: ExperienceItem = {};
  if (from) out.from = from;
  if (to) out.to = to;
  if (present) out.present = true;
  if (title) out.title = title;
  if (company) out.company = company;
  if (description) out.description = description;
  if (url) out.url = url;
  if (!from && legacyDate) out.date = legacyDate;
  return out;
}

function parseValue(text: string): { ok: true; value: ExperienceItem[] } | { ok: false; error: string } {
  const parsed = safeParseJson<any>(text);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v === null) return { ok: true, value: [] };
  if (!Array.isArray(v)) return { ok: false, error: "工作经历必须是数组（JSON）" };
  return { ok: true, value: v.filter((x) => x && typeof x === "object").map(normalizeExperienceItem) };
}

function cleanExperienceItem(it: ExperienceItem): ExperienceItem {
  // 注意：这里不能用强校验过滤（例如 normalizeYm），否则用户无法输入中间态（比如刚输入 "2022-" 就会被清空）。
  // 校验/高亮在渲染层做，保存时可由用户点击“标准化”手动清理。
  const from = trimText(it.from);
  const present = !!it.present;
  const to = present ? undefined : trimText(it.to);
  const title = trimOrUndef(it.title);
  const company = trimOrUndef(it.company);
  const description = trimOrUndef(it.description);
  const url = trimOrUndef(it.url);
  const date = !from ? trimOrUndef(it.date) : undefined;

  const out: ExperienceItem = {};
  if (from) out.from = from;
  if (to) out.to = to;
  if (present) out.present = true;
  if (title) out.title = title;
  if (company) out.company = company;
  if (description) out.description = description;
  if (url) out.url = url;
  if (date) out.date = date;
  return out;
}

function compareFromDesc(a: ExperienceItem, b: ExperienceItem): number {
  const av = safeYmToNumMaybe(a.from);
  const bv = safeYmToNumMaybe(b.from);
  const an = av === null ? -Infinity : av;
  const bn = bv === null ? -Infinity : bv;
  return bn - an;
}

export function AboutExperienceEditor(props: { value: string; onChange: (next: string) => void }) {
  const parsed = useMemo(() => parseValue(props.value), [props.value]);
  const list = parsed.ok ? parsed.value : [];
  const [notice, setNotice] = useState("");

  function setList(next: ExperienceItem[]) {
    props.onChange(stringifyJson(next.map(cleanExperienceItem)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = list.slice();
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setList(next);
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>工作经历（时间线）</div>
      <div className="muted">时间精确到年月：YYYY-MM；可选择“至今”。空字段不会展示。</div>

      <div style={{ height: 10 }} />

      <div className="nav">
        <button
          className="chip"
          type="button"
          onClick={() => {
            setList(list.concat([{ from: "", present: true }]));
            setNotice("");
          }}
        >
          新增一条
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            const sorted = list.slice().sort(compareFromDesc);
            setList(sorted);
            setNotice("已按 from 倒序排序");
          }}
        >
          排序（from 倒序）
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setList(list.map(cleanExperienceItem));
            setNotice("已标准化（trim）");
          }}
        >
          标准化
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setList([]);
            setNotice("已清空");
          }}
        >
          清空
        </button>
      </div>

      {notice ? (
        <div className="muted" style={{ marginTop: 8 }}>
          {notice}
        </div>
      ) : null}
      {!parsed.ok ? (
        <div className="muted" style={{ marginTop: 8, color: "#ffb4b4" }}>
          {parsed.error}
          <div style={{ marginTop: 8 }}>
            <button className="chip" type="button" onClick={() => props.onChange("[]")}>
              重置为 []
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ height: 12 }} />

      {list.length === 0 ? (
        <div className="muted">暂无条目。</div>
      ) : (
        <div className="grid">
          {list.map((it, idx) => {
            const from = String(it.from ?? "");
            const to = String(it.to ?? "");
            const present = !!it.present;
            const urlOk = isValidExternalUrlOrPath(it.url);

            const fromOk = !from || YM_RE.test(from);
            const toOk = present ? true : !to || YM_RE.test(to);
            const rangeOk =
              !present && fromOk && toOk && from && to ? ymToNum(from) <= ymToNum(to) : true;

            return (
              <div key={`exp-${idx}`} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>#{idx + 1}</strong>
                  <div className="nav">
                    <button className="chip" type="button" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      上移
                    </button>
                    <button className="chip" type="button" onClick={() => move(idx, 1)} disabled={idx === list.length - 1}>
                      下移
                    </button>
                    <button
                      className="chip"
                      type="button"
                      onClick={() => {
                        const next = list.slice();
                        next.splice(idx, 1);
                        setList(next);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div className="row">
                  <label className="field">
                    from（YYYY-MM）
                    <input
                      className="input"
                      value={from}
                      onChange={(e) => {
                        const next = list.slice();
                        next[idx] = { ...it, from: e.target.value };
                        setList(next);
                      }}
                      placeholder="2022-03"
                      style={!fromOk ? { borderColor: "#ffb4b4" } : undefined}
                    />
                  </label>

                  <label className="field">
                    to（YYYY-MM）
                    <input
                      className="input"
                      value={to}
                      onChange={(e) => {
                        const next = list.slice();
                        next[idx] = { ...it, to: e.target.value };
                        setList(next);
                      }}
                      placeholder="2024-09"
                      disabled={present}
                      style={!toOk ? { borderColor: "#ffb4b4" } : undefined}
                    />
                    {!rangeOk ? <div className="muted" style={{ color: "#ffb4b4" }}>to 不能早于 from</div> : null}
                  </label>
                </div>

                <div style={{ height: 8 }} />

                <label className="field" style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none" }}>
                  <input
                    type="checkbox"
                    checked={present}
                    onChange={(e) => {
                      const next = list.slice();
                      const checked = e.target.checked;
                      next[idx] = { ...it, present: checked, to: checked ? "" : it.to };
                      setList(next);
                    }}
                  />
                  至今
                </label>

                <div style={{ height: 10 }} />

                <div className="row">
                  <label className="field">
                    title（可选）
                    <input
                      className="input"
                      value={it.title ?? ""}
                      onChange={(e) => {
                        const next = list.slice();
                        next[idx] = { ...it, title: e.target.value };
                        setList(next);
                      }}
                      placeholder="例如：高级前端工程师"
                    />
                  </label>
                  <label className="field">
                    company（可选）
                    <input
                      className="input"
                      value={it.company ?? ""}
                      onChange={(e) => {
                        const next = list.slice();
                        next[idx] = { ...it, company: e.target.value };
                        setList(next);
                      }}
                      placeholder="例如：某科技公司"
                    />
                  </label>
                </div>

                <div style={{ height: 10 }} />

                <label className="field">
                  description（可选）
                  <textarea
                    className="textarea"
                    value={it.description ?? ""}
                    onChange={(e) => {
                      const next = list.slice();
                      next[idx] = { ...it, description: e.target.value };
                      setList(next);
                    }}
                    placeholder="写两三条要点也可以"
                    style={{ minHeight: 80 }}
                  />
                </label>

                <div style={{ height: 10 }} />

                <label className="field">
                  url（可选）
                  <input
                    className="input"
                    value={it.url ?? ""}
                    onChange={(e) => {
                      const next = list.slice();
                      next[idx] = { ...it, url: e.target.value };
                      setList(next);
                    }}
                    placeholder="https://... 或 /path"
                    style={!urlOk ? { borderColor: "#ffb4b4" } : undefined}
                  />
                  {!urlOk ? <div className="muted" style={{ color: "#ffb4b4" }}>url 必须是 http(s) 或站内路径（以 / 开头）</div> : null}
                </label>

                {it.date ? (
                  <div className="muted" style={{ marginTop: 8 }}>
                    legacy date：{it.date}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
