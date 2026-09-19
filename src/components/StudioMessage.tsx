import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function StudioMessage({ text }: { text: string }) {
  return (
    <div className="at-chat-copy">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
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
