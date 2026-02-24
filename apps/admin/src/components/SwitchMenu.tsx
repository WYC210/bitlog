import React, { useEffect, useMemo, useRef, useState } from "react";
import { isTypingTarget, normalizeRecordedChord } from "../shortcuts/shortcuts";

export type SwitchMenuLayout = "arc" | "grid";

export type SwitchMenuItem = {
  id: string;
  title: string;
  desc: string;
  hash: string;
};

const LAYOUT_KEY = "bitlog:admin:switchMenu:layout";
const BINDINGS_KEY = "bitlog:admin:switchMenu:bindings";

function wrapIndex(idx: number, n: number): number {
  if (n <= 0) return 0;
  return ((idx % n) + n) % n;
}

function isAltBackquote(e: KeyboardEvent): boolean {
  return !!e.altKey && !e.ctrlKey && !e.metaKey && String(e.code || "") === "Backquote";
}

function readLayout(): SwitchMenuLayout {
  try {
    const raw = String(localStorage.getItem(LAYOUT_KEY) || "").toLowerCase();
    return raw === "grid" ? "grid" : "arc";
  } catch {
    return "arc";
  }
}

function writeLayout(next: SwitchMenuLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, next);
  } catch {
    // ignore
  }
}

function readBindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as any)) {
      const key = String(k || "").trim().toLowerCase();
      const target = String(val || "").trim();
      if (!key || !target) continue;
      out[key] = target;
    }
    return out;
  } catch {
    return {};
  }
}

function writeBindings(next: Record<string, string>) {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function bestMatchIndex(items: SwitchMenuItem[], currentHash: string): number {
  const h = String(currentHash || "").trim();
  if (!h) return 0;
  let bestIdx = -1;
  let bestLen = -1;
  for (let i = 0; i < items.length; i++) {
    const target = items[i]?.hash ?? "";
    if (!target) continue;
    if (h === target || h.startsWith(target + "/") || h.startsWith(target + "?")) {
      if (target.length > bestLen) {
        bestLen = target.length;
        bestIdx = i;
      }
    }
    if (target === "#/posts" && /^#\/posts\/[^/]+/.test(h)) {
      if (target.length > bestLen) {
        bestLen = target.length;
        bestIdx = i;
      }
    }
  }
  return bestIdx >= 0 ? bestIdx : 0;
}

function getCols(): number {
  return window.matchMedia?.("(max-width: 560px)")?.matches ? 1 : 2;
}

export function SwitchMenu(props: { enabled: boolean; items: SwitchMenuItem[] }) {
  const items = props.items ?? [];
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<SwitchMenuLayout>(() => readLayout());
  const [bindings, setBindings] = useState<Record<string, string>>(() => readBindings());
  const [activeIndex, setActiveIndex] = useState(0);
  const [bindMode, setBindMode] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const openRef = useRef(open);
  const enabledRef = useRef(props.enabled);
  const layoutRef = useRef(layout);
  const bindModeRef = useRef(bindMode);
  const activeRef = useRef(activeIndex);
  const bindingsRef = useRef(bindings);

  useEffect(() => void (enabledRef.current = props.enabled), [props.enabled]);
  useEffect(() => void (openRef.current = open), [open]);
  useEffect(() => void (layoutRef.current = layout), [layout]);
  useEffect(() => void (bindModeRef.current = bindMode), [bindMode]);
  useEffect(() => void (activeRef.current = activeIndex), [activeIndex]);
  useEffect(() => void (bindingsRef.current = bindings), [bindings]);

  const chordByHash = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [spec, hash] of Object.entries(bindings)) {
      out[String(hash)] = spec;
    }
    return out;
  }, [bindings]);

  const selected = items[wrapIndex(activeIndex, items.length)];
  const selectedChord = selected?.hash ? chordByHash[selected.hash] : undefined;

  useEffect(() => {
    if (!props.enabled) return;

    const onKeydown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      if (isAltBackquote(e)) {
        e.preventDefault();
        e.stopPropagation();
        setBindMode(false);
        setLayout(readLayout());
        setBindings(readBindings());
        setOpen((v) => {
          const next = !v;
          if (next) {
            const idx = bestMatchIndex(items, window.location.hash);
            setActiveIndex(idx);
          }
          return next;
        });
        return;
      }

      const openNow = openRef.current;
      const layoutNow = layoutRef.current;
      const bindNow = bindModeRef.current;
      const idxNow = activeRef.current;
      const bindingsNow = bindingsRef.current;

      if (openNow) {
        if (bindNow) {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setBindMode(false);
            return;
          }
          const spec = normalizeRecordedChord(e);
          if (spec === null) return;
          if (spec === "") return;
          const target = items[wrapIndex(idxNow, items.length)]?.hash;
          if (!target) return;
          e.preventDefault();
          e.stopPropagation();

          const nextBindings: Record<string, string> = { ...bindingsNow };
          // Ensure 1 chord => 1 route and 1 route => 1 chord.
          for (const [k, v] of Object.entries(nextBindings)) {
            if (String(k) === spec) delete nextBindings[k];
            if (String(v) === target) delete nextBindings[k];
          }
          nextBindings[spec] = target;
          setBindings(nextBindings);
          writeBindings(nextBindings);
          setBindMode(false);
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setBindMode(false);
          setOpen(false);
          return;
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((v) => wrapIndex(v - 1, items.length));
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((v) => wrapIndex(v + 1, items.length));
          return;
        }
        if (e.key === "ArrowUp" && layoutNow === "grid") {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((v) => wrapIndex(v - getCols(), items.length));
          return;
        }
        if (e.key === "ArrowDown" && layoutNow === "grid") {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((v) => wrapIndex(v + getCols(), items.length));
          return;
        }

        if (e.key === "Enter") {
          const t = items[wrapIndex(idxNow, items.length)]?.hash;
          if (!t) return;
          e.preventDefault();
          e.stopPropagation();
          window.location.hash = t;
          setOpen(false);
          return;
        }

        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          e.stopPropagation();
          setBindMode(true);
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          const t = items[wrapIndex(idxNow, items.length)]?.hash;
          if (!t) return;
          e.preventDefault();
          e.stopPropagation();
          const nextBindings: Record<string, string> = {};
          for (const [k, v] of Object.entries(bindingsNow)) {
            if (String(v) === t) continue;
            nextBindings[k] = v;
          }
          setBindings(nextBindings);
          writeBindings(nextBindings);
          return;
        }
        return;
      }

      const spec = normalizeRecordedChord(e);
      if (spec === null || spec === "") return;
      const target = bindingsNow[spec];
      if (!target) return;

      const typing = isTypingTarget(e.target);
      const hasModifier = spec.includes("+");
      if (typing && !hasModifier) return;

      e.preventDefault();
      e.stopPropagation();
      window.location.hash = target;
    };

    window.addEventListener("keydown", onKeydown, true);
    return () => window.removeEventListener("keydown", onKeydown, true);
  }, [items, props.enabled]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (layoutRef.current !== "arc") return;
      const el = stripRef.current;
      if (!el) return;
      layoutArc(el, activeRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (layout !== "arc") return;
    const el = stripRef.current;
    if (!el) return;
    layoutArc(el, activeIndex);
  }, [open, layout, activeIndex, items.length]);

  useEffect(() => {
    if (!open) return;
    if (layout !== "grid") return;
    const el = stripRef.current;
    if (!el) return;
    const tile = el.querySelector<HTMLElement>(`[data-idx="${wrapIndex(activeIndex, items.length)}"]`);
    tile?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [open, layout, activeIndex, items.length]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const onWheel = (e: WheelEvent) => {
      if (layoutRef.current !== "arc") return;
      if (!openRef.current) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (d > 0) setActiveIndex((v) => wrapIndex(v + 1, items.length));
      else if (d < 0) setActiveIndex((v) => wrapIndex(v - 1, items.length));
    };

    overlay.addEventListener("wheel", onWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", onWheel as any);
  }, [open, items.length]);

  if (!props.enabled) return null;

  return open ? (
    <div
      ref={overlayRef}
      className="switch-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="switch-scene">
        <div className="switch-info" aria-hidden="true">
          <div className="switch-info-title">{selected?.title ?? ""}</div>
          <div className="switch-info-desc">
            {bindMode ? "按下快捷键绑定（Esc 取消）" : selectedChord ? `快捷键：${selectedChord} · ${selected?.desc ?? ""}` : selected?.desc ?? ""}
          </div>
        </div>

        <div ref={stripRef} className={`switch-strip ${layout === "arc" ? "is-arc" : "is-grid"}`}>
          {items.map((it, i) => {
            const isSelected = i === wrapIndex(activeIndex, items.length);
            return (
              <button
                key={it.id}
                type="button"
                className="switch-tile"
                aria-selected={isSelected ? "true" : "false"}
                data-idx={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  window.location.hash = it.hash;
                  setOpen(false);
                }}
              >
                <div className="switch-tile-top">
                  <div className="switch-tile-title">{it.title}</div>
                </div>
                <div className="switch-tile-bottom">
                  <div className="switch-tile-desc">{it.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;
}

function layoutArc(container: HTMLElement, selectedIdx: number) {
  const tiles = Array.from(container.querySelectorAll<HTMLElement>(".switch-tile"));
  if (tiles.length === 0) return;
  const rect = container.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w < 60 || h < 120) return;

  const n = tiles.length;
  const first = tiles[0];
  if (!first) return;
  const tileW = first.getBoundingClientRect().width || 320;

  const stepByWidth = (w - tileW) / 4;
  const xStep = Math.max(tileW * 0.82, Math.min(tileW * 1.02, stepByWidth));

  const yBase = 0;
  const yCurve = Math.max(1.4, h * 0.004);
  const centerLift = Math.min(12, h * 0.03);

  const selectedZ = 110;
  const zStep = 70;
  const ryStep = 7.2;
  const rzStep = 0.8;
  const maxVisible = 4;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!t) continue;
    let offset = i - selectedIdx;
    if (offset > n / 2) offset -= n;
    if (offset < -n / 2) offset += n;
    const abs = Math.abs(offset);
    const hidden = abs > maxVisible;

    const x = offset * xStep;
    const y = yBase + Math.pow(abs, 1.55) * yCurve - (abs === 0 ? centerLift : 0);
    const z = abs === 0 ? selectedZ : -abs * zStep;

    const baseScale = Math.max(0.66, 1 - abs * 0.1);
    const scale = abs === 0 ? baseScale + 0.08 : baseScale;
    const opacity = hidden ? 0 : Math.max(0.02, 1 - abs * 0.2);
    const blur = hidden ? 16 : abs * 0.7;

    t.style.setProperty("--cf-x", `${x}px`);
    t.style.setProperty("--cf-y", `${y}px`);
    t.style.setProperty("--cf-z", `${z}px`);
    t.style.setProperty("--cf-ry", `${-offset * ryStep}deg`);
    t.style.setProperty("--cf-rz", `${offset * -rzStep}deg`);
    t.style.setProperty("--cf-s", String(scale));
    t.style.setProperty("--cf-blur", `${blur}px`);

    t.style.opacity = String(opacity);
    t.style.pointerEvents = hidden ? "none" : "auto";
    t.style.zIndex = String(1000 - abs);
  }
}
