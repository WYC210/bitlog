import React, { useEffect, useMemo, useRef, useState } from "react";
import { isTypingTarget, normalizeRecordedChord } from "../shortcuts/shortcuts";

export type SwitchMenuLayout = "arc" | "grid" | "dial" | "cmd";
export type CommandMenuConfirmMode = "enter" | "release";

export type SwitchMenuItem = {
  id: string;
  title: string;
  desc: string;
  hash: string;
};

const LAYOUT_KEY = "bitlog:admin:switchMenu:layout";
const BINDINGS_KEY = "bitlog:admin:switchMenu:bindings";
const CONFIRM_MODE_KEY = "bitlog:admin:switchMenu:confirmMode";

type SwitchMenuConfirmMode = CommandMenuConfirmMode;

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
    return raw === "grid" || raw === "dial" || raw === "cmd" ? (raw as SwitchMenuLayout) : "arc";
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

function readConfirmMode(): SwitchMenuConfirmMode {
  try {
    const raw = String(localStorage.getItem(CONFIRM_MODE_KEY) || "").toLowerCase();
    return raw === "release" ? "release" : "enter";
  } catch {
    return "enter";
  }
}

function isHashTarget(t: string): boolean {
  return String(t || "").trim().startsWith("#");
}

function navigateTo(target: string) {
  const t = String(target || "").trim();
  if (!t) return;
  if (isHashTarget(t)) {
    window.location.hash = t;
  } else {
    window.location.href = t;
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

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}



export function SwitchMenu(props: {
  enabled: boolean;
  items: SwitchMenuItem[];
  layout?: SwitchMenuLayout;
  confirmMode?: SwitchMenuConfirmMode;
}) {
  const items = props.items ?? [];
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<SwitchMenuLayout>(() => props.layout ?? readLayout());
  const [bindings, setBindings] = useState<Record<string, string>>(() => readBindings());
  const [confirmMode, setConfirmMode] = useState<SwitchMenuConfirmMode>(() => props.confirmMode ?? readConfirmMode());
  const [activeIndex, setActiveIndex] = useState(0);
  const [bindMode, setBindMode] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [handleRevealed, setHandleRevealed] = useState(false);

  const cmdInputRef = useRef<HTMLInputElement | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const handleHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openRef = useRef(open);
  const enabledRef = useRef(props.enabled);
  const layoutRef = useRef(layout);
  const bindModeRef = useRef(bindMode);
  const activeRef = useRef(activeIndex);
  const bindingsRef = useRef(bindings);
  const confirmModeRef = useRef(confirmMode);
  const holdArmedRef = useRef(false);
  const cmdQueryRef = useRef(cmdQuery);
  const visibleRef = useRef<Array<{ it: SwitchMenuItem; idx: number }>>([]);
  const layoutPropRef = useRef<SwitchMenuLayout | undefined>(props.layout);
  const confirmPropRef = useRef<SwitchMenuConfirmMode | undefined>(props.confirmMode);
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    startTs: number;
    dragging: boolean;
    consumeClick: boolean;
  }>({ startX: 0, startY: 0, startTs: 0, dragging: false, consumeClick: false });

  useEffect(() => void (enabledRef.current = props.enabled), [props.enabled]);
  useEffect(() => void (openRef.current = open), [open]);
  useEffect(() => void (layoutRef.current = layout), [layout]);
  useEffect(() => void (bindModeRef.current = bindMode), [bindMode]);
  useEffect(() => void (activeRef.current = activeIndex), [activeIndex]);
  useEffect(() => void (bindingsRef.current = bindings), [bindings]);
  useEffect(() => void (confirmModeRef.current = confirmMode), [confirmMode]);
  useEffect(() => void (cmdQueryRef.current = cmdQuery), [cmdQuery]);
  useEffect(() => void (layoutPropRef.current = props.layout), [props.layout]);
  useEffect(() => void (confirmPropRef.current = props.confirmMode), [props.confirmMode]);

  useEffect(() => {
    return () => {
      if (handleHideTimerRef.current) clearTimeout(handleHideTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!props.layout) return;
    setLayout(props.layout);
  }, [props.layout]);

  useEffect(() => {
    if (!props.confirmMode) return;
    setConfirmMode(props.confirmMode);
  }, [props.confirmMode]);

  useEffect(() => {
    if (!props.enabled) return;
    if (typeof window === "undefined") return;

    const isCoarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    if (!isCoarse) return;

    const HOLD_MS = 420;
    const CANCEL_MOVE_PX = 14;
    const selIgnore = "a,button,input,textarea,select,label,[contenteditable='true'],[role='button'],[role='textbox']";

    let tracking = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;

    const clearHold = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const openMenu = () => {
      clearHold();
      if (openRef.current) return;
      setBindMode(false);
      setCmdQuery("");
      const nextLayout = layoutPropRef.current ?? readLayout();
      setLayout(nextLayout);
      setBindings(readBindings());
      const cm = nextLayout === "cmd" ? "enter" : (confirmPropRef.current ?? readConfirmMode());
      setConfirmMode(cm);
      setActiveIndex(bestMatchIndex(items, window.location.hash));
      setOpen(true);
    };

    const shouldIgnore = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return true;
      if (isTypingTarget(el)) return true;
      if (el.closest(selIgnore)) return true;
      const sel = window.getSelection?.();
      if (sel && String(sel.toString() || "").trim()) return true;
      return false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!enabledRef.current) return;
      if (openRef.current) return;
      if (e.pointerType !== "touch") return;
      if (shouldIgnore(e.target)) return;

      tracking = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      clearHold();
      longPressTimerRef.current = setTimeout(openMenu, HOLD_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!tracking) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) >= CANCEL_MOVE_PX) {
        tracking = false;
        pointerId = null;
        clearHold();
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      tracking = false;
      pointerId = null;
      clearHold();
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerEnd, { passive: true });
    document.addEventListener("pointercancel", onPointerEnd, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown as any);
      document.removeEventListener("pointermove", onPointerMove as any);
      document.removeEventListener("pointerup", onPointerEnd as any);
      document.removeEventListener("pointercancel", onPointerEnd as any);
      clearHold();
    };
  }, [props.enabled, items]);

  const chordByHash = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [spec, hash] of Object.entries(bindings)) {
      out[String(hash)] = spec;
    }
    return out;
  }, [bindings]);

  const visible = useMemo(() => {
    if (layout !== "cmd") return items.map((it, idx) => ({ it, idx }));
    const q = String(cmdQuery || "").trim().toLowerCase();
    if (!q) return items.map((it, idx) => ({ it, idx }));
    return items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => `${it.title} ${it.desc}`.toLowerCase().includes(q));
  }, [items, layout, cmdQuery]);

  useEffect(() => void (visibleRef.current = visible), [visible]);

  const selected = visible[wrapIndex(activeIndex, visible.length)]?.it;
  const selectedChord = selected?.hash ? chordByHash[selected.hash] : undefined;

  useEffect(() => {
    if (!open) return;
    if (layout !== "cmd") return;
    const t = setTimeout(() => cmdInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, layout]);

  const revealHandle = () => {
    setHandleRevealed(true);
    if (handleHideTimerRef.current) clearTimeout(handleHideTimerRef.current);
    handleHideTimerRef.current = setTimeout(() => setHandleRevealed(false), 2600);
  };

  useEffect(() => {
    if (layout !== "cmd") return;
    if (visible.length === 0) return;
    if (activeIndex >= visible.length) setActiveIndex(0);
  }, [layout, visible.length, activeIndex]);

  useEffect(() => {
    if (!props.enabled) return;

    const onKeydown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      if (isAltBackquote(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        setBindMode(false);
        setCmdQuery("");
        const nextLayout = layoutPropRef.current ?? readLayout();
        setLayout(nextLayout);
        setBindings(readBindings());
        const cm = nextLayout === "cmd" ? "enter" : (confirmPropRef.current ?? readConfirmMode());
        setConfirmMode(cm);
        if (cm === "release") {
          if (openRef.current) return;
          holdArmedRef.current = true;
          const idx = bestMatchIndex(items, window.location.hash);
          setActiveIndex(idx);
          setOpen(true);
          return;
        }

        holdArmedRef.current = false;
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
      const visibleNow =
        layoutNow === "cmd"
          ? visibleRef.current
          : items.map((it, idx) => ({ it, idx }));

      if (openNow) {
        if (layoutNow === "cmd") {
          if (e.key === "Escape") {
            if (cmdQueryRef.current.trim()) {
              e.preventDefault();
              e.stopPropagation();
              setCmdQuery("");
              setActiveIndex(0);
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            holdArmedRef.current = false;
            setOpen(false);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex((v) => wrapIndex(v - 1, visibleNow.length));
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex((v) => wrapIndex(v + 1, visibleNow.length));
            return;
          }
          if (e.key === "Enter") {
            const t = visibleNow[wrapIndex(idxNow, visibleNow.length)]?.it?.hash;
            if (!t) return;
            e.preventDefault();
            e.stopPropagation();
            navigateTo(t);
            holdArmedRef.current = false;
            setOpen(false);
            return;
          }
          return;
        }

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
          holdArmedRef.current = false;
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
          navigateTo(t);
          holdArmedRef.current = false;
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
      navigateTo(target);
    };

    const onKeyup = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      if (confirmModeRef.current !== "release") return;
      if (!openRef.current) return;
      if (!holdArmedRef.current) return;
      if (layoutRef.current === "cmd") return;
      if (e.code !== "Backquote" && String(e.key || "").toLowerCase() !== "alt") return;

      if (bindModeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        holdArmedRef.current = false;
        setBindMode(false);
        setOpen(false);
        return;
      }

      const t = items[wrapIndex(activeRef.current, items.length)]?.hash;
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      holdArmedRef.current = false;
      navigateTo(t);
      setOpen(false);
    };

    window.addEventListener("keydown", onKeydown, true);
    window.addEventListener("keyup", onKeyup, true);
    return () => {
      window.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("keyup", onKeyup, true);
    };
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
      const mode = layoutRef.current;
      if (mode !== "arc" && mode !== "dial") return;
      if (!openRef.current) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (d > 0) setActiveIndex((v) => wrapIndex(v + 1, items.length));
      else if (d < 0) setActiveIndex((v) => wrapIndex(v - 1, items.length));
    };

    overlay.addEventListener("wheel", onWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", onWheel as any);
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    // Prevent hover feedback loops from causing ultra-fast scrolling in arc layout.
    // Also provide controlled edge-hover scrolling with acceleration + max speed.
    let rafId = 0;
    let edgeDir = 0; // -1 left, +1 right, 0 none
    let intervalMs = 340;
    let lastStepTs = 0;
    let lastHoverIdx = -1;
    let lastHoverStepAt = 0;

    const edgePct = 0.18;
    const minIntervalMs = 180;
    const accel = 0.965;

    const stop = () => {
      edgeDir = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      intervalMs = 340;
      lastStepTs = 0;
    };

    const tick = (ts: number) => {
      if (!openRef.current || layoutRef.current !== "arc" || bindModeRef.current) {
        stop();
        return;
      }
      if (edgeDir === 0) {
        rafId = 0;
        return;
      }
      if (items.length > 1 && ts - lastStepTs >= intervalMs) {
        lastStepTs = ts;
        setActiveIndex((v) => wrapIndex(v + edgeDir, items.length));
        intervalMs = Math.max(minIntervalMs, Math.floor(intervalMs * accel));
      }
      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafId) return;
      lastStepTs = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!openRef.current) return;
      if (layoutRef.current !== "arc") return;
      if (bindModeRef.current) return;

      const rect = overlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const leftZone = rect.width * edgePct;
      const rightZone = rect.width * (1 - edgePct);
      const nextDir = x < leftZone ? -1 : x > rightZone ? 1 : 0;

      if (nextDir !== edgeDir) {
        edgeDir = nextDir;
        intervalMs = 340;
        lastStepTs = performance.now();
        if (edgeDir === 0) stop();
        else start();
      }

      if (edgeDir !== 0) return;

      const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const tile = hit?.closest?.(".switch-tile") as HTMLElement | null;
      const raw = tile?.getAttribute?.("data-idx");
      if (!raw) return;
      const idx = Number(raw);
      if (!Number.isFinite(idx)) return;
      const now = performance.now();
      const activeNow = wrapIndex(activeRef.current, items.length);
      if (idx === lastHoverIdx && idx === activeNow) return;
      if (now - lastHoverStepAt < 120) return;
      lastHoverStepAt = now;
      lastHoverIdx = idx;

      setActiveIndex((v) => {
        const n = items.length;
        if (n <= 1) return 0;
        const cur = wrapIndex(v, n);
        const target = wrapIndex(idx, n);
        let d = target - cur;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;
        if (Math.abs(d) <= 1) return target;
        return wrapIndex(cur + Math.sign(d), n);
      });
    };

    const onPointerLeave = () => stop();

    overlay.addEventListener("pointermove", onPointerMove, { passive: true });
    overlay.addEventListener("pointerleave", onPointerLeave as any, { passive: true });
    return () => {
      overlay.removeEventListener("pointermove", onPointerMove as any);
      overlay.removeEventListener("pointerleave", onPointerLeave as any);
      stop();
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const el = stripRef.current;
    if (!el) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let startTs = 0;
    let lastX = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (!openRef.current) return;
      if (layoutRef.current !== "arc") return;
      if (bindModeRef.current) return;
      if (items.length <= 1) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      tracking = true;
      startX = t.clientX;
      startY = t.clientY;
      lastX = t.clientX;
      startTs = performance.now();
      swipeRef.current.dragging = false;
      swipeRef.current.consumeClick = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (layoutRef.current !== "arc") return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      lastX = t.clientX;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!swipeRef.current.dragging) {
        if (Math.abs(dx) < 10) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.25) return;
        swipeRef.current.dragging = true;
      }

      if (!swipeRef.current.dragging) return;
      swipeRef.current.consumeClick = true;
      // Must be non-passive to stop page scrolling on some mobile webviews.
      e.preventDefault();
    };

    const finish = (endX: number) => {
      const dragging = swipeRef.current.dragging;
      tracking = false;
      swipeRef.current.dragging = false;

      if (!dragging) {
        swipeRef.current.consumeClick = false;
        return;
      }

      swipeRef.current.consumeClick = true;
      const dx = endX - startX;
      const dt = Math.max(1, performance.now() - startTs);
      const vx = dx / dt; // px/ms

      const shouldStep = Math.abs(dx) >= 34 || (Math.abs(dx) >= 16 && Math.abs(vx) >= 0.35);
      if (shouldStep) {
        if (dx < 0) setActiveIndex((v) => wrapIndex(v + 1, items.length));
        else setActiveIndex((v) => wrapIndex(v - 1, items.length));
      }

      // Clear soon even if no click is synthesized.
      window.setTimeout(() => {
        swipeRef.current.consumeClick = false;
      }, 420);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.changedTouches?.[0];
      const endX = t ? t.clientX : lastX;
      finish(endX);
    };

    const onTouchCancel = () => {
      if (!tracking) return;
      tracking = false;
      swipeRef.current.dragging = false;
      swipeRef.current.consumeClick = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchmove", onTouchMove as any);
      el.removeEventListener("touchend", onTouchEnd as any);
      el.removeEventListener("touchcancel", onTouchCancel as any);
    };
  }, [open, items.length]);

  if (!props.enabled) return null;

  const accentForHash = (hash: string): string => {
    const h = String(hash ?? "");
    if (h === "/" || h.startsWith("/?")) return "#4b6bff";
    if (h.startsWith("/articles")) return "#34d399";
    if (h.startsWith("/projects")) return "#4b6bff";
    if (h.startsWith("/tools")) return "#22c55e";
    if (h.startsWith("/about")) return "#f59e0b";
    if (h.startsWith("#/settings")) return "#ff2d55";
    if (h.startsWith("#/posts/new")) return "#22c55e";
    if (h.startsWith("#/posts")) return "#34d399";
    if (h.startsWith("#/projects")) return "#4b6bff";
    if (h.startsWith("#/tools")) return "#22c55e";
    if (h.startsWith("#/about")) return "#f59e0b";
    if (h.startsWith("#/me")) return "#7c3aed";
    return "var(--accent)";
  };

  const iconForHash = (hash: string) => {
    const h = String(hash ?? "");
    if (h === "/" || h.startsWith("/?")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    if (h.startsWith("/articles")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Z" />
          <path d="M8 7h8" strokeLinecap="round" />
          <path d="M8 11h8" strokeLinecap="round" />
          <path d="M8 15h6" strokeLinecap="round" />
        </svg>
      );
    }
    if (h.startsWith("/projects")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 7h8v10H3z" />
          <path d="M13 7h8v10h-8z" />
        </svg>
      );
    }
    if (h.startsWith("/tools")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    }
    if (h.startsWith("/about")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c2-4 6-6 8-6s6 2 8 6" strokeLinecap="round" />
        </svg>
      );
    }
    if (h.startsWith("#/settings")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.2-2-3.5-2.2.6a8.4 8.4 0 0 0-1.7-1L13 4h-4L7.4 7.9a8.4 8.4 0 0 0-1.7 1L3.5 8.3l-2 3.5L3.5 13a7.8 7.8 0 0 0 .1 1l-2 1.2 2 3.5 2.2-.6a8.4 8.4 0 0 0 1.7 1L9 20h4l1.6-3.9a8.4 8.4 0 0 0 1.7-1l2.2.6 2-3.5-2-1.2Z" />
        </svg>
      );
    }
    if (h.startsWith("#/projects")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 7h8v10H3z" />
          <path d="M13 7h8v10h-8z" />
          <path d="M6 10h2" />
          <path d="M16 14h2" />
        </svg>
      );
    }
    if (h.startsWith("#/tools")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    }
    if (h.startsWith("#/about")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c2-4 6-6 8-6s6 2 8 6" strokeLinecap="round" />
        </svg>
      );
    }
    if (h.startsWith("#/posts/new")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 5v14" strokeLinecap="round" />
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 4h16v6H4z" />
        <path d="M4 14h16v6H4z" />
      </svg>
    );
  };

  const shouldCloseFromBackdropClick = (target: HTMLElement | null) => {
    if (!target) return false;
    if (target.closest(".switch-cmd-panel")) return false;
    if (target.closest(".switch-tile")) return false;
    if (target.closest(".switch-dial")) return false;
    const layoutNow = layoutRef.current;
    if ((layoutNow === "grid" || layoutNow === "dial") && target.closest(".switch-strip")) return false;
    return true;
  };

  const stripLayoutClass =
    layout === "arc" ? "is-arc" : layout === "grid" ? "is-grid" : layout === "cmd" ? "is-cmd" : "is-dial";

  return (
    <>
      <button
        type="button"
        className={`switch-handle${handleRevealed ? " is-revealed" : ""}${open ? " is-hidden" : ""}`}
        aria-label="快捷菜单"
        onClick={() => {
          if (!handleRevealed) {
            revealHandle();
            return;
          }
          setBindMode(false);
          setCmdQuery("");
          const nextLayout = layoutPropRef.current ?? readLayout();
          setLayout(nextLayout);
          setBindings(readBindings());
          const cm = nextLayout === "cmd" ? "enter" : (confirmPropRef.current ?? readConfirmMode());
          setConfirmMode(cm);
          setActiveIndex(bestMatchIndex(items, window.location.hash));
          setOpen(true);
        }}
      >
        <span className="switch-handle-dot" aria-hidden="true" />
        <span className="switch-handle-label">菜单</span>
      </button>
      {open ? (
        <div
       ref={overlayRef}
       className="switch-overlay"
       role="dialog"
       aria-modal="true"
       onClickCapture={(e) => {
         if (swipeRef.current.consumeClick) {
           swipeRef.current.consumeClick = false;
           e.preventDefault();
           e.stopPropagation();
           return;
         }
         const target = e.target as HTMLElement | null;
         if (!shouldCloseFromBackdropClick(target)) return;
         e.preventDefault();
         e.stopPropagation();
         holdArmedRef.current = false;
         setOpen(false);
       }}
       onPointerDownCapture={(e) => {
         if (e.pointerType === "mouse" && (e as any).button !== 0) return;
         const target = e.target as HTMLElement | null;
         if (!shouldCloseFromBackdropClick(target)) return;
         // Prevent click-through: keep the overlay mounted until the click handler closes it.
         e.preventDefault();
         e.stopPropagation();
       }}
     >
      <div className="switch-scene">
        {layout === "dial" || layout === "cmd" ? null : (
          <div className="switch-info" aria-hidden="true">
            <div className="switch-info-title">{selected?.title ?? ""}</div>
            <div className="switch-info-desc">
              {bindMode
                ? "按下快捷键绑定（Esc 取消）"
                : selectedChord
                  ? `快捷键：${selectedChord} · ${selected?.desc ?? ""}`
                  : selected?.desc ?? ""}
            </div>
          </div>
        )}

        <div
          ref={stripRef}
          className={`switch-strip ${stripLayoutClass}`}
          onClickCapture={(e) => {
            if (!swipeRef.current.consumeClick) return;
            swipeRef.current.consumeClick = false;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {layout === "cmd" ? (
            <div className="switch-cmd-panel" onMouseDown={(e) => e.stopPropagation()}>
              <div className="switch-cmd-head">
                <input
                  ref={cmdInputRef}
                  className="switch-cmd-input"
                  value={cmdQuery}
                  onChange={(e) => {
                    setCmdQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder="搜索页面…"
                />
              </div>
              <div className="switch-cmd-list" role="listbox" aria-label="菜单列表">
                {visible.length === 0 ? (
                  <div className="switch-cmd-empty">无匹配</div>
                ) : (
                  visible.map(({ it }, i) => {
                    const isSelected = i === wrapIndex(activeIndex, visible.length);
                    const chord = chordByHash[it.hash];
                    return (
                      <button
                        key={it.id}
                        type="button"
                        className={`switch-cmd-item${isSelected ? " is-active" : ""}`}
                        aria-selected={isSelected ? "true" : "false"}
                        onMouseEnter={() => setActiveIndex(i)}
                        onFocus={() => setActiveIndex(i)}
                        onClick={() => {
                          holdArmedRef.current = false;
                          navigateTo(it.hash);
                          setOpen(false);
                        }}
                      >
                        <div className="switch-cmd-main">
                          <div className="switch-cmd-title">{it.title}</div>
                          <div className="switch-cmd-desc">{it.desc}</div>
                        </div>
                        {chord ? <kbd className="switch-cmd-kbd">{chord}</kbd> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : layout === "dial" ? (
            <div
              className={`switch-dial ${items.length > 10 ? "is-dense" : ""}`}
              onPointerMoveCapture={(e) => {
                const n = items.length;
                if (n <= 0) return;
                const el = e.currentTarget as HTMLElement;
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dx = e.clientX - cx;
                const dy = e.clientY - cy;

                // Keep it responsive: even near center it should still select a direction.
                const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
                const fromTop = (deg + 90 + 360) % 360;
                const seg = 360 / n;
                const idx = wrapIndex(Math.floor((fromTop + seg / 2) / seg), n);
                setActiveIndex(idx);
              }}
            >
              <div
                className="switch-dial-wheel"
                style={{
                  ["--wedge-mid" as any]: `${(wrapIndex(activeIndex, items.length) * 360) / Math.max(1, items.length)}deg`,
                  ["--wedge-span" as any]: `${Math.min(140, Math.max(32, (360 / Math.max(1, items.length)) * 0.92))}deg`,
                  ["--wedge-accent" as any]: accentForHash(selected?.hash ?? "")
                }}
                onClick={() => {
                  if (bindModeRef.current) return;
                  const t = items[wrapIndex(activeRef.current, items.length)]?.hash;
                  if (!t) return;
                  holdArmedRef.current = false;
                  navigateTo(t);
                  setOpen(false);
                }}
              >
                <div className="switch-dial-ring" aria-hidden="true" />
                <div className="switch-dial-wedge" aria-hidden="true" />
              </div>

              <div className="switch-dial-center" aria-hidden="true">
                <div className="switch-dial-center-title">{selected?.title ?? ""}</div>
                <div className="switch-dial-center-desc">
                  {bindMode
                    ? "按下快捷键绑定（Esc 取消）"
                    : selectedChord
                      ? `快捷键：${selectedChord}`
                      : confirmMode === "release"
                        ? "松开确认"
                        : "Enter 确认"}
                </div>
              </div>

              <div className="switch-dial-items">
                {items.map((it, i) => {
                  const n = Math.max(1, items.length);
                  const mid = -90 + (i * 360) / n;
                  const p = polar(50, 50, 47.2, mid);
                  const isSelected = i === wrapIndex(activeIndex, items.length);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className="switch-dial-item"
                      aria-selected={isSelected ? "true" : "false"}
                      style={{
                        left: `${p.x.toFixed(3)}%`,
                        top: `${p.y.toFixed(3)}%`,
                        ["--switch-accent" as any]: accentForHash(it.hash)
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      onFocus={() => setActiveIndex(i)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        holdArmedRef.current = false;
                        navigateTo(it.hash);
                        setOpen(false);
                      }}
                      title={it.title}
                    >
                      <span className="switch-dial-item-ico" aria-hidden="true">
                        {iconForHash(it.hash)}
                      </span>
                      <span className="switch-dial-item-label">{it.title}</span>
                    </button>
                  );
                })}
              </div>
              <div className="switch-dial-knob" aria-hidden="true" />
            </div>
          ) : (
            items.map((it, i) => {
              const isSelected = i === wrapIndex(activeIndex, items.length);
              const chord = chordByHash[it.hash];
              return (
                <button
                key={it.id}
                type="button"
                className="switch-tile"
                aria-selected={isSelected ? "true" : "false"}
                data-idx={i}
                style={{ ["--switch-accent" as any]: accentForHash(it.hash) }}
                onMouseEnter={() => {
                  if (layout !== "arc") setActiveIndex(i);
                }}
                onClick={() => {
                  holdArmedRef.current = false;
                  navigateTo(it.hash);
                  setOpen(false);
                }}
                >
                  <div className="switch-tile-center">
                    <span className="switch-tile-ico" aria-hidden="true">
                      {iconForHash(it.hash)}
                    </span>
                    <div className="switch-tile-title">{it.title}</div>
                    {chord ? <kbd className="switch-tile-kbd">{chord}</kbd> : null}
                    <div className="switch-tile-desc">{it.desc}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
      ) : null}
    </>
  );
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
