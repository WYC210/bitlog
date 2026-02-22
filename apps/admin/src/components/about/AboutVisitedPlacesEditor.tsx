import React, { useMemo, useState } from "react";
import { safeParseJson, stringifyJson, trimOrUndef } from "./aboutUtils";

const DASH_CHARS_RE = /[\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const EXPLICIT_LEVEL_SEP_RE = /[-/\\>\u2192\u21D2]/;
const ITEM_SPLIT_RE = /[\r\n]+|[;；]+/g;
const COMMA_FAMILY_RE = /[,，、]+/g;
const TAIL_JOINER = "·";

function normalizeSegmentText(s: string): string {
  return String(s ?? "")
    .replace(DASH_CHARS_RE, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLevelParts(input: string, commaAsLevel: boolean): string[] {
  const s = normalizeSegmentText(input);
  if (!s) return [];
  const re = commaAsLevel ? /[-/\\>\u2192\u21D2,，、]+/g : /[-/\\>\u2192\u21D2]+/g;
  return s
    .split(re)
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function normalizeVisitedPlace(input: string, commaAsLevel: boolean): string | null {
  const raw = normalizeSegmentText(input);
  if (!raw) return null;
  const parts = splitLevelParts(raw, commaAsLevel);
  if (parts.length < 2) return null;

  const a = parts[0] ?? "";
  let b = parts[1] ?? "";
  const tail = parts.slice(2).filter(Boolean);
  if (tail.length) b = `${b}${TAIL_JOINER}${tail.join(TAIL_JOINER)}`;

  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return null;
  return `${left}-${right}`;
}

type ParseBulkResult = { items: string[]; invalid: string[] };

function parseBulkText(text: string): ParseBulkResult {
  const chunks = String(text ?? "")
    .split(ITEM_SPLIT_RE)
    .map((x) => x.trim())
    .filter(Boolean);

  const items: string[] = [];
  const invalid: string[] = [];

  for (const chunk of chunks) {
    const normalizedChunk = normalizeSegmentText(chunk);
    if (!normalizedChunk) continue;

    const hasExplicitLevelSep = EXPLICIT_LEVEL_SEP_RE.test(normalizedChunk);
    if (hasExplicitLevelSep) {
      // 有明确的层级分隔符时，把逗号族当作“多条条目分隔”。
      const subs = normalizedChunk
        .split(COMMA_FAMILY_RE)
        .map((x) => x.trim())
        .filter(Boolean);
      for (const sub of subs) {
        const v = normalizeVisitedPlace(sub, false);
        if (v) items.push(v);
        else invalid.push(sub);
      }
      continue;
    }

    // 无明确层级分隔符时，把逗号族当作“层级分隔”（如：中国，北京）。
    const v = normalizeVisitedPlace(normalizedChunk, true);
    if (v) items.push(v);
    else invalid.push(normalizedChunk);
  }

  return { items, invalid };
}

function parseValueToArray(text: string): { ok: true; value: string[] } | { ok: false; error: string } {
  const parsed = safeParseJson<any>(text);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v === null) return { ok: true, value: [] };
  if (!Array.isArray(v)) return { ok: true, value: [] };
  return { ok: true, value: v.filter((x) => typeof x === "string").map((x) => String(x)) };
}

function normalizeAndDedupe(values: string[]): { next: string[]; removed: number; invalid: number } {
  const out: string[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (const raw of values) {
    const v = normalizeVisitedPlace(raw, false) ?? normalizeVisitedPlace(raw, true);
    if (!v) {
      invalid++;
      continue;
    }
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return { next: out, removed: values.length - out.length - invalid, invalid };
}

export function AboutVisitedPlacesEditor(props: { value: string; onChange: (next: string) => void }) {
  const parsed = useMemo(() => parseValueToArray(props.value), [props.value]);
  const places = parsed.ok ? parsed.value : [];
  const [bulkText, setBulkText] = useState("");
  const [notice, setNotice] = useState<string>("");

  function setPlaces(next: string[]) {
    props.onChange(stringifyJson(next));
  }

  function move(index: number, dir: -1 | 1) {
    const next = places.slice();
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setPlaces(next);
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>旅行足迹（两段制：A-B）</div>
      <div className="muted">
        支持批量粘贴并自动标准化：`中国 - 北京` / `中国—北京` / `中国→北京` → `中国-北京`；超过两段会把尾巴合并进第二段：
        `中国-北京-海淀-中关村` → `中国-北京·海淀·中关村`。
      </div>

      <div style={{ height: 10 }} />

      <div className="row">
        <label className="field" style={{ textTransform: "none" }}>
          批量粘贴（每行/分号一条；逗号会智能识别）
          <textarea
            className="textarea"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"中国 - 北京\n中国—广东—深圳\n中国,上海\n中国-北京,中国-上海"}
            style={{ minHeight: 110 }}
          />
        </label>
      </div>
      <div className="nav">
        <button
          className="chip chip-primary"
          type="button"
          onClick={() => {
            const r = parseBulkText(bulkText);
            const appended = r.items.length;
            if (!appended && r.invalid.length) {
              setNotice(`未能解析：${r.invalid.slice(0, 3).join(" / ")}${r.invalid.length > 3 ? " …" : ""}`);
              return;
            }
            if (appended) {
              const combined = places.concat(r.items);
              const norm = normalizeAndDedupe(combined);
              setPlaces(norm.next);
              setBulkText("");
              const bits: string[] = [`已追加 ${appended} 条`];
              if (norm.removed > 0) bits.push(`去重移除 ${norm.removed} 条`);
              if (norm.invalid > 0) bits.push(`忽略无效 ${norm.invalid} 条`);
              setNotice(bits.join("；"));
            } else {
              setNotice("没有可追加的条目");
            }
          }}
        >
          解析并追加
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            const norm = normalizeAndDedupe(places);
            setPlaces(norm.next);
            const bits: string[] = ["已标准化"];
            if (norm.removed > 0) bits.push(`去重移除 ${norm.removed} 条`);
            if (norm.invalid > 0) bits.push(`忽略无效 ${norm.invalid} 条`);
            setNotice(bits.join("；"));
          }}
        >
          标准化并去重
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setPlaces([]);
            setNotice("已清空");
          }}
        >
          清空列表
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setPlaces(places.concat([""]));
            setNotice("");
          }}
        >
          添加一条
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
        </div>
      ) : null}

      <div style={{ height: 12 }} />

      {places.length === 0 ? (
        <div className="muted">暂无条目（可用上方“解析并追加”或手动添加）。</div>
      ) : (
        <div className="grid">
          {places.map((p, idx) => (
            <div key={`${p}-${idx}`} className="card" style={{ padding: 12 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap"
                }}
              >
                <strong style={{ fontSize: 13 }}>#{idx + 1}</strong>
                <div className="nav">
                  <button className="chip" type="button" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    上移
                  </button>
                  <button className="chip" type="button" onClick={() => move(idx, 1)} disabled={idx === places.length - 1}>
                    下移
                  </button>
                  <button
                    className="chip"
                    type="button"
                    onClick={() => {
                      const next = places.slice();
                      next.splice(idx, 1);
                      setPlaces(next);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
              <div style={{ height: 8 }} />
              <input
                className="input"
                value={p}
                onChange={(e) => {
                  const next = places.slice();
                  next[idx] = e.target.value;
                  setPlaces(next);
                }}
                onBlur={() => {
                  const v = trimOrUndef(p);
                  const normalized = v ? normalizeVisitedPlace(v, false) ?? normalizeVisitedPlace(v, true) : null;
                  if (!normalized) return;
                  if (normalized === p) return;
                  const next = places.slice();
                  next[idx] = normalized;
                  setPlaces(next);
                }}
                placeholder="中国-北京"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

