import {Children,cloneElement,isValidElement,useId,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {CircleAlert,RefreshCw,LockKeyhole,Unlock,X,ChevronDown,ChevronRight} from "lucide-react";
import type {StudioConfig,StudioFile} from "../studio-api";
import {useDialog} from "./useDialog";

export function StudioWorking({label}: {label: string}) {
  return <div className="at-thinking" role="status" aria-live="polite">
    <span className="at-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
    <span>{label}</span>
  </div>;
}
export function StudioSetupCard({
  issues,
  onRetry,
  busy,
  compact = false,
  deposits = false,
}: {
  issues: StudioConfig["setup"]["issues"];
  onRetry: () => void;
  busy: boolean;
  compact?: boolean;
  deposits?: boolean;
}) {
  return (
    <section
      className={`at-setup-card ${compact ? "compact" : ""}`}
      aria-label={deposits ? "AQUA deposit setup" : "Studio AI setup"}
    >
      <header>
        <span><CircleAlert size={18} /></span>
        <div>
          <strong>{deposits ? "AQUA deposits unavailable" : "AI setup incomplete"}</strong>
          <small>{deposits ? "Existing USD credit is unaffected." : "Editing and exports still work."}</small>
        </div>
      </header>
      <div className="at-setup-list">
        {issues.map((issue) => (
          <div key={issue.code}>
            <span aria-hidden="true" />
            <div>
              <strong>{issue.title}</strong>
              <p>{issue.detail}</p>
              {issue.variables.length > 0 && (
                <div className="at-variable-list">
                  {issue.variables.map((variable) => (
                    <code key={variable}>{variable}</code>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button disabled={busy} onClick={onRetry}>
        <RefreshCw size={14} />
        Check again
      </button>
    </section>
  );
}
export function Field({
  label,
  locked,
  onLock,
  children,
}: {
  label: string;
  locked: boolean;
  onLock: () => void;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="at-field">
      <div className="at-field-label">
        <span id={labelId}>{label}</span>
        <button
          type="button"
          title={
            locked
              ? "Atlantis will keep this unchanged"
              : "Keep this unchanged when Atlantis makes edits"
          }
          aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
          aria-pressed={locked}
          onClick={onLock}
        >
          {locked ? <LockKeyhole size={13} /> : <Unlock size={13} />}
          <span>{locked ? "Keep this" : ""}</span>
        </button>
      </div>
      {Children.map(children, (child) =>
        isValidElement<Record<string, unknown>>(child) &&
        typeof child.type === "string" &&
        ["input", "select", "textarea"].includes(child.type)
          ? cloneElement(child, { "aria-labelledby": labelId })
          : child,
      )}
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref=useDialog<HTMLDivElement>(true,onClose);
  return createPortal(
    <div
      className="at-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`at-dialog ${className}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function FileTree({
  files,
  folders,
  selected,
  onSelect,
  prefix = "",
}: {
  files: StudioFile[];
  folders: string[];
  selected: string;
  onSelect: (path: string) => void;
  prefix?: string;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  const all = [...files.map((f) => f.path), ...folders.map((f) => f + "/")];
  const children = [
    ...new Set(
      all
        .filter((p) => p.startsWith(prefix))
        .map((p) => p.slice(prefix.length).split("/")[0])
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      Number(files.some((f) => f.path === prefix + a)) -
        Number(files.some((f) => f.path === prefix + b)) || a.localeCompare(b),
  );
  return (
    <div className="at-tree">
      {children.map((name) => {
        const path = prefix + name,
          file = files.find((f) => f.path === path),
          collapsed = closed.includes(path);
        return file ? (
          <button
            className={selected === path ? "selected" : ""}
            key={path}
            onClick={() => onSelect(path)}
            title={path}
          >
            <span className="at-file-dot" />
            {name}
            {file.locked && <LockKeyhole size={11} />}
          </button>
        ) : (
          <div key={path}>
            <button
              onClick={() =>
                setClosed((old) =>
                  collapsed ? old.filter((p) => p !== path) : [...old, path],
                )
              }
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
              <strong>{name}</strong>
            </button>
            {!collapsed && (
              <FileTree
                files={files}
                folders={folders}
                selected={selected}
                onSelect={onSelect}
                prefix={path + "/"}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
