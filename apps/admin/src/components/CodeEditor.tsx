import React, { useEffect, useRef } from "react";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

export function CodeEditor(props: {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  placeholder?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const save = props.onSave;
    const state = EditorState.create({
      doc: props.value ?? "",
      extensions: [
        lineNumbers(),
        oneDark,
        javascript(),
        EditorView.lineWrapping,
        props.placeholder ? placeholder(props.placeholder) : [],
        keymap.of(
          save
            ? [
                indentWithTab,
                {
                  key: "Mod-s",
                  preventDefault: true,
                  run: () => {
                    save();
                    return true;
                  }
                }
              ]
            : [indentWithTab]
        ),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          props.onChange(u.state.doc.toString());
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

  return (
    <div
      className="cm-host"
      data-placeholder={props.placeholder ?? ""}
      ref={hostRef}
    />
  );
}
