import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export type MarkdownEditorHandle = {
  focus: () => void;
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
  }
>(function MarkdownEditor(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
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
