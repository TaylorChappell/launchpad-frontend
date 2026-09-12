export function AquaMark({ compact = false }: { compact?: boolean }) {
  return <span className={`aqua-mark ${compact ? "compact" : ""}`} aria-hidden="true"><img src={`${import.meta.env.BASE_URL}aqua-logo.png`} alt="" /></span>;
}
