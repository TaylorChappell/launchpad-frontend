import { SlidersHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function StudioMessage({ text, onOpenVariables, actionsDisabled = false }: { text: string; onOpenVariables?: () => void; actionsDisabled?: boolean }) {
  return (
    <div className="at-chat-copy">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => props.href === "#atlantis-variables" ? (
            onOpenVariables ? <button type="button" className="at-chat-variable-action" disabled={actionsDisabled} onClick={onOpenVariables}><SlidersHorizontal size={14}/>Open variables</button> : <span>{props.children}</span>
          ) : (
            <a
              href={props.href}
              title={props.title}
              target="_blank"
              rel="noreferrer"
            >
              {props.children}
            </a>
          ),
          table: (props) => (
            <div
              className="at-table-scroll"
              role="region"
              aria-label="Table"
              tabIndex={0}
            >
              <table>{props.children}</table>
            </div>
          ),
        }}
      >
        {text.replace(/\u2014/g, " - ")}
      </ReactMarkdown>
    </div>
  );
}
