import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function NoticeDialog(props: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      props.onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [props.open, props]);

  if (!props.open) return null;

  const title = props.title ?? "提示";
  const confirmText = props.confirmText ?? "确定";

  return createPortal(
    <div
      className="notice-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        // Prevent click-through: keep the overlay mounted until click closes it.
        e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        props.onOpenChange(false);
      }}
    >
      <div className="notice-panel" role="document">
        <div className="notice-title">{title}</div>
        <div className="notice-message">{props.message}</div>
        <div className="notice-actions">
          <button
            ref={confirmRef}
            className="chip chip-primary"
            type="button"
            onClick={() => props.onOpenChange(false)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

