import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/yaml/register.js";
import type { StudioFile } from "../studio-api";
(
  globalThis as typeof globalThis & { MonacoEnvironment: unknown }
).MonacoEnvironment = { getWorker: () => new EditorWorker() };
export default function StudioEditor({
  file,
  onChange,
}: {
  file: StudioFile;
  onChange: (value: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    editor = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined),
    change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    if (!host.current) return;
    const extension = file.path.split(".").pop() ?? "";
    const language =
      (
        {
          js: "javascript",
          mjs: "javascript",
          ts: "typescript",
          tsx: "typescript",
          html: "html",
          css: "css",
          json: "json",
          md: "markdown",
          yml: "yaml",
          yaml: "yaml",
        } as Record<string, string>
      )[extension] ?? "plaintext";
    const instance = monaco.editor.create(host.current, {
      value: file.content,
      language,
      theme: "vs-dark",
      automaticLayout: true,
      fontSize: 13,
      lineHeight: 21,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 18 },
      tabSize: 2,
      wordWrap: "on",
      ariaLabel: `Edit ${file.path}`,
    });
    editor.current = instance;
    const subscription = instance.onDidChangeModelContent(() =>
      change.current(instance.getValue()),
    );
    return () => {
      subscription.dispose();
      instance.getModel()?.dispose();
      instance.dispose();
      editor.current = undefined;
    };
  }, [file.path]);
  useEffect(() => {
    if (editor.current && editor.current.getValue() !== file.content)
      editor.current.setValue(file.content);
  }, [file.content]);
  return <div className="at-code-editor" ref={host} />;
}
