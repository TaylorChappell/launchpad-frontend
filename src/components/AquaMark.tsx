export function AquaMark({ compact = false }: { compact?: boolean }) {
  return <span className={`aqua-mark ${compact ? "compact" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 42 42" fill="none">
      <path d="M6 24c5.1-6 10.1-6 15.1 0 5 6 9.9 6 14.9 0" />
      <path d="M9 15.5c4-3.8 8-3.8 12 0 4 3.8 8 3.8 12 0" />
    </svg>
  </span>;
}
