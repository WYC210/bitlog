import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectBoxOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export function SelectBox(props: {
  value: string;
  options: SelectBoxOption[];
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const id = useId();
  const listId = `selectbox-list-${id}`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const selectedIndex = useMemo(() => {
    const i = props.options.findIndex((o) => o.value === props.value);
    return i >= 0 ? i : -1;
  }, [props.options, props.value]);

  const selectedLabel = useMemo(() => {
    if (selectedIndex >= 0) return props.options[selectedIndex]?.label ?? "";
    return props.placeholder ?? "";
  }, [props.options, props.placeholder, selectedIndex]);

  function openWithIndex(nextIndex: number) {
    if (props.disabled) return;
    setOpen(true);
    setActiveIndex(nextIndex);
  }

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function commitValue(nextValue: string) {
    if (props.disabled) return;
    if (nextValue === props.value) {
      close(true);
      return;
    }
    props.onChange(nextValue);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const root = rootRef.current;
      if (root && root.contains(t)) return;
      close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`) ?? null;
    if (el) {
      try {
        el.focus();
        el.scrollIntoView({ block: "nearest" });
      } catch {
        // ignore
      }
    }
  }, [activeIndex, open]);

  function findNextEnabled(from: number, dir: 1 | -1): number {
    const n = props.options.length;
    if (n === 0) return -1;
    let i = Math.max(-1, Math.min(n, from));
    for (let step = 0; step < n; step++) {
      i += dir;
      if (i < 0) i = n - 1;
      if (i >= n) i = 0;
      if (!props.options[i]?.disabled) return i;
    }
    return -1;
  }

  const triggerClass = `select selectbox-trigger${props.disabled ? " is-disabled" : ""}${
    open ? " is-open" : ""
  }${props.className ? ` ${props.className}` : ""}`;

  return (
    <div className="selectbox" ref={rootRef}>
      <button
        ref={triggerRef}
        className={triggerClass}
        type="button"
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) close(false);
          else openWithIndex(selectedIndex >= 0 ? selectedIndex : findNextEnabled(-1, 1));
        }}
        onKeyDown={(e) => {
          if (props.disabled) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) openWithIndex(selectedIndex >= 0 ? selectedIndex : findNextEnabled(-1, 1));
            else setActiveIndex((i) => findNextEnabled(i, 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openWithIndex(selectedIndex >= 0 ? selectedIndex : findNextEnabled(props.options.length, -1));
            else setActiveIndex((i) => findNextEnabled(i, -1));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) openWithIndex(selectedIndex >= 0 ? selectedIndex : findNextEnabled(-1, 1));
          }
        }}
      >
        <span className="selectbox-value">{selectedLabel}</span>
        <span className="selectbox-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          className="selectbox-popover"
          ref={listRef}
          role="listbox"
          id={listId}
          aria-label={props.ariaLabel ?? "Select"}
        >
          {props.options.map((opt, idx) => {
            const selected = opt.value === props.value;
            const disabled = !!opt.disabled;
            return (
              <button
                key={opt.value}
                type="button"
                className={`selectbox-item${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                role="option"
                aria-selected={selected}
                disabled={disabled}
                data-idx={idx}
                onClick={() => commitValue(opt.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => findNextEnabled(i, 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => findNextEnabled(i, -1));
                  } else if (e.key === "Home") {
                    e.preventDefault();
                    setActiveIndex(findNextEnabled(-1, 1));
                  } else if (e.key === "End") {
                    e.preventDefault();
                    setActiveIndex(findNextEnabled(props.options.length, -1));
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!disabled) commitValue(opt.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    close(true);
                  }
                }}
              >
                <span className="selectbox-item-label">{opt.label}</span>
                {selected ? (
                  <span className="selectbox-check" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                ) : (
                  <span className="selectbox-check" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
