import React, { useMemo, useState } from "react";
import { SelectBox } from "../SelectBox";
import { isValidExternalUrlOrPath, safeParseJson, stringifyJson, trimOrUndef } from "./aboutUtils";

type SkillLevel = "" | "beginner" | "intermediate" | "advanced" | "expert";

type SkillItem = {
  title?: string;
  description?: string;
  tags?: string[];
  icon?: string;
  level?: SkillLevel;
  url?: string;
};

const LEVEL_OPTIONS: Array<{ value: SkillLevel; label: string }> = [
  { value: "", label: "（无）" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" }
];

const ICON_PRESETS: Array<{ value: string; label: string }> = [
  { value: "", label: "（不填）" },
  { value: "frontend", label: "frontend" },
  { value: "backend", label: "backend" },
  { value: "design", label: "design" },
  { value: "mobile", label: "mobile" },
  { value: "devops", label: "devops" },
  { value: "database", label: "database" },
  { value: "ai", label: "ai" },
  { value: "writing", label: "writing" }
];

function normalizeTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function normalizeSkillItem(input: unknown): SkillItem {
  if (typeof input === "string") return { title: input };
  if (!input || typeof input !== "object") return {};
  const it = input as any;

  const title = trimOrUndef(it.title ?? it.TITLE ?? it.name ?? it.NAME);
  const description = trimOrUndef(it.description ?? it.DESCRIPTION ?? it.desc ?? it.DESC);

  const tagsSource = Array.isArray(it.tags)
    ? it.tags
    : Array.isArray(it.TAGS)
      ? it.TAGS
      : Array.isArray(it.items)
        ? it.items
        : Array.isArray(it.ITEMS)
          ? it.ITEMS
          : Array.isArray(it.stack)
            ? it.stack
            : Array.isArray(it.STACK)
              ? it.STACK
              : [];
  const tags = normalizeTags(tagsSource);

  const icon = trimOrUndef(it.icon);
  const url = trimOrUndef(it.url ?? it.URL);
  const levelRaw = trimOrUndef(it.level ?? it.LEVEL) ?? "";
  const level =
    levelRaw === "beginner" || levelRaw === "intermediate" || levelRaw === "advanced" || levelRaw === "expert"
      ? (levelRaw as SkillLevel)
      : "";

  const out: SkillItem = {};
  if (title) out.title = title;
  if (description) out.description = description;
  if (tags.length) out.tags = tags;
  if (icon) out.icon = icon;
  if (level) out.level = level;
  if (url) out.url = url;
  return out;
}

function parseValue(text: string): { ok: true; value: SkillItem[] } | { ok: false; error: string } {
  const parsed = safeParseJson<any>(text);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v === null) return { ok: true, value: [] };
  if (!Array.isArray(v)) return { ok: false, error: "Skills 必须是数组（JSON）" };
  return { ok: true, value: v.map(normalizeSkillItem) };
}

function cleanSkillItem(it: SkillItem): SkillItem {
  const title = trimOrUndef(it.title);
  const description = trimOrUndef(it.description);
  const icon = trimOrUndef(it.icon);
  const url = trimOrUndef(it.url);
  const level = (trimOrUndef(it.level) ?? "") as SkillLevel;
  const tags = normalizeTags(it.tags ?? []);

  const out: SkillItem = {};
  if (title) out.title = title;
  if (description) out.description = description;
  if (tags.length) out.tags = tags;
  if (icon) out.icon = icon;
  if (level) out.level = level;
  if (url) out.url = url;
  return out;
}

function splitTagsFromInput(raw: string): string[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s
    .split(/[,，\n\r\t]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function AboutSkillsEditor(props: { value: string; onChange: (next: string) => void }) {
  const parsed = useMemo(() => parseValue(props.value), [props.value]);
  const skills = parsed.ok ? parsed.value : [];

  const [tagDraftByIndex, setTagDraftByIndex] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<string>("");

  function setSkills(next: SkillItem[]) {
    props.onChange(stringifyJson(next.map(cleanSkillItem)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = skills.slice();
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setSkills(next);
  }

  function addTag(index: number, raw: string) {
    const incoming = splitTagsFromInput(raw);
    if (!incoming.length) return;
    const next = skills.slice();
    const it = { ...(next[index] ?? {}) } as SkillItem;
    const tags = normalizeTags([...(it.tags ?? []), ...incoming]);
    it.tags = tags.length ? tags : undefined;
    next[index] = it;
    setSkills(next);
    setTagDraftByIndex((prev) => ({ ...prev, [index]: "" }));
  }

  function removeTag(index: number, tag: string) {
    const next = skills.slice();
    const it = { ...(next[index] ?? {}) } as SkillItem;
    const tags = (it.tags ?? []).filter((t) => t !== tag);
    it.tags = tags.length ? tags : undefined;
    next[index] = it;
    setSkills(next);
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>技能专长（结构化）</div>
      <div className="muted">每条支持：title/description/tags/icon + 可选 level/url（空值不展示）。</div>

      <div style={{ height: 10 }} />

      <div className="nav">
        <button
          className="chip"
          type="button"
          onClick={() => {
            setSkills(skills.concat([{ title: "" }]));
            setNotice("");
          }}
        >
          新增一条
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            const cleaned = skills.map(cleanSkillItem);
            setSkills(cleaned);
            setNotice("已标准化（trim/去重）");
          }}
        >
          标准化
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setSkills([]);
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

      {skills.length === 0 ? (
        <div className="muted">暂无条目。</div>
      ) : (
        <div className="grid">
          {skills.map((it, idx) => {
            const tags = normalizeTags(it.tags ?? []);
            const urlOk = isValidExternalUrlOrPath(it.url);
            const tagDraft = String(tagDraftByIndex[idx] ?? "");
            return (
              <div key={`skill-${idx}`} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>#{idx + 1}</strong>
                  <div className="nav">
                    <button className="chip" type="button" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      上移
                    </button>
                    <button className="chip" type="button" onClick={() => move(idx, 1)} disabled={idx === skills.length - 1}>
                      下移
                    </button>
                    <button
                      className="chip"
                      type="button"
                      onClick={() => {
                        const next = skills.slice();
                        next.splice(idx, 1);
                        setSkills(next);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div className="row">
                  <label className="field">
                    title
                    <input
                      className="input"
                      value={it.title ?? ""}
                      onChange={(e) => {
                        const next = skills.slice();
                        next[idx] = { ...it, title: e.target.value };
                        setSkills(next);
                      }}
                      placeholder="例如：前端开发"
                    />
                  </label>

                  <label className="field">
                    level（可选）
                    <SelectBox
                      value={(it.level ?? "") as SkillLevel}
                      options={LEVEL_OPTIONS}
                      onChange={(v) => {
                        const next = skills.slice();
                        next[idx] = { ...it, level: (v || "") as SkillLevel };
                        setSkills(next);
                      }}
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
                      const next = skills.slice();
                      next[idx] = { ...it, description: e.target.value };
                      setSkills(next);
                    }}
                    placeholder="一句话描述即可"
                    style={{ minHeight: 80 }}
                  />
                </label>

                <div style={{ height: 10 }} />

                <div className="row">
                  <label className="field">
                    icon（可选）
                    <input
                      className="input"
                      value={it.icon ?? ""}
                      onChange={(e) => {
                        const next = skills.slice();
                        next[idx] = { ...it, icon: e.target.value };
                        setSkills(next);
                      }}
                      placeholder="例如：frontend"
                    />
                  </label>
                  <label className="field">
                    推荐
                    <SelectBox
                      value={(it.icon ?? "") as any}
                      options={ICON_PRESETS.map((o) => ({ value: o.value, label: o.label }))}
                      onChange={(v) => {
                        const next = skills.slice();
                        next[idx] = { ...it, icon: v };
                        setSkills(next);
                      }}
                    />
                  </label>
                </div>

                <div style={{ height: 10 }} />

                <label className="field">
                  url（可选，最多 1 条）
                  <input
                    className="input"
                    value={it.url ?? ""}
                    onChange={(e) => {
                      const next = skills.slice();
                      next[idx] = { ...it, url: e.target.value };
                      setSkills(next);
                    }}
                    placeholder="https://... 或 /path"
                    style={!urlOk ? { borderColor: "#ffb4b4" } : undefined}
                  />
                  {!urlOk ? <div className="muted" style={{ color: "#ffb4b4" }}>url 必须是 http(s) 或站内路径（以 / 开头）</div> : null}
                </label>

                <div style={{ height: 10 }} />

                <div className="field" style={{ textTransform: "none" }}>
                  tags（回车添加，退格删除）
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="chip"
                        onClick={() => removeTag(idx, t)}
                        title="点击删除"
                      >
                        {t} ×
                      </button>
                    ))}
                  </div>
                  <div style={{ height: 8 }} />
                  <input
                    className="input"
                    value={tagDraft}
                    onChange={(e) => setTagDraftByIndex((prev) => ({ ...prev, [idx]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(idx, tagDraft);
                      } else if (e.key === "Backspace" && !tagDraft) {
                        if (tags.length === 0) return;
                        removeTag(idx, tags[tags.length - 1]!);
                      }
                    }}
                    onBlur={() => {
                      if (!tagDraft.trim()) return;
                      addTag(idx, tagDraft);
                    }}
                    placeholder="React, TypeScript"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

