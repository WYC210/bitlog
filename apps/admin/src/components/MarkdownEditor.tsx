import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, dropCursor, keymap } from "@codemirror/view";

export type MarkdownEditorHandle = {
  focus: () => void;
  getSelectionText: () => string;
  replaceSelection: (text: string, selectFromOffset?: number, selectToOffset?: number) => void;
  scrollToSelection: () => void;
  scrollToLine: (line1Based: number) => void;
  insertText: (text: string) => void;
};

export function isImageFile(file: File | null | undefined): file is File {
  return !!file && typeof file.type === "string" && file.type.startsWith("image/");
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    onUploadImage?: (file: File) => Promise<string>;
    onFocusChange?: (focused: boolean) => void;
  }
>(function MarkdownEditor(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const scrollToPos = (view: EditorView, pos: number) => {
    const behavior: ScrollBehavior =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "auto"
        : "smooth";
    const scroller = view.scrollDOM;
    const block = view.lineBlockAt(pos);
    const target = block.top + block.height / 2 - scroller.clientHeight / 2;
    const top = Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight));
    scroller.scrollTo({ top, behavior });
  };

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    getSelectionText: () => {
      const view = viewRef.current;
      if (!view) return "";
      const { from, to } = view.state.selection.main;
      if (from === to) return "";
      return view.state.sliceDoc(from, to);
    },
    replaceSelection: (text: string, selectFromOffset?: number, selectToOffset?: number) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const insert = text ?? "";
      const selectionFrom = typeof selectFromOffset === "number" ? from + Math.max(0, Math.trunc(selectFromOffset)) : from + insert.length;
      const selectionTo =
        typeof selectToOffset === "number"
          ? from + Math.max(0, Math.trunc(selectToOffset))
          : selectionFrom;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: selectionFrom, head: selectionTo }
      });
      view.focus();
    },
    scrollToSelection: () => {
      const view = viewRef.current;
      if (!view) return;
      const head = view.state.selection.main.head;
      scrollToPos(view, head);
      view.focus();
    },
    scrollToLine: (line1Based: number) => {
      const view = viewRef.current;
      if (!view) return;
      const want = Math.max(1, Math.min(Math.trunc(line1Based), view.state.doc.lines));
      const line = view.state.doc.line(want);
      view.dispatch({ selection: { anchor: line.from } });
      scrollToPos(view, line.from);
      view.focus();
    },
    insertText: (text: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    }
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onUpload = props.onUploadImage;
    const insertAt = (view: EditorView, text: string) => {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    };
    const uploadAndInsert = async (view: EditorView, file: File) => {
      if (!onUpload) return;
      try {
        const url = await onUpload(file);
        insertAt(view, `![](${url})\n`);
      } catch {
        // error handled by caller
      }
    };

    const state = EditorState.create({
      doc: props.value ?? "",
      extensions: [
        markdown(),
        EditorView.lineWrapping,
        drawSelection(),
        dropCursor(),
        keymap.of([
          indentWithTab,
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              props.onSave();
              return true;
            }
          }
        ]),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          props.onChange(u.state.doc.toString());
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const items = event.clipboardData?.files;
            const file = items && items.length ? items[0] : null;
            if (!isImageFile(file) || !onUpload) return false;
            event.preventDefault();
            void uploadAndInsert(view, file);
            return true;
          },
          drop: (event, view) => {
            const items = event.dataTransfer?.files;
            const file = items && items.length ? items[0] : null;
            if (!isImageFile(file) || !onUpload) return false;
            event.preventDefault();
            void uploadAndInsert(view, file);
            return true;
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    const onFocusChange = props.onFocusChange;
    if (onFocusChange) {
      const onFocusIn = () => onFocusChange(true);
      const onFocusOut = () => onFocusChange(false);
      view.dom.addEventListener("focusin", onFocusIn);
      view.dom.addEventListener("focusout", onFocusOut);
      return () => {
        view.dom.removeEventListener("focusin", onFocusIn);
        view.dom.removeEventListener("focusout", onFocusOut);
        viewRef.current?.destroy();
        viewRef.current = null;
      };
    }
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    const next = props.value ?? "";
    if (next === current) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
  }, [props.value]);

  return <div ref={hostRef} className="cm-host" />;
});
