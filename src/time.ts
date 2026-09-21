export function buybackAge(createdAt: number | string, now = Date.now()) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  const elapsed = Math.max(0, now - date.getTime());
  if (elapsed > 2 * 86_400_000) {
    return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  }
  if (elapsed < 60_000) return "Just now";
  const [count, unit] = elapsed < 3_600_000
    ? [Math.floor(elapsed / 60_000), "min"]
    : elapsed < 86_400_000
      ? [Math.floor(elapsed / 3_600_000), "hour"]
      : [Math.floor(elapsed / 86_400_000), "day"];
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

export function launchAge(launchedAt: number | null | undefined, createdAt?: number) {
  const raw = launchedAt ?? (createdAt ? Math.floor(createdAt / 1_000) : 0);
  if (!raw) return "Launch time pending";
  const seconds = Math.max(0, Math.floor(Date.now() / 1_000) - raw);
  if (seconds < 60) return "Launched just now";
  if (seconds < 3_600) return `Launched ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `Launched ${Math.floor(seconds / 3_600)}h ago`;
  if (seconds < 2_592_000) return `Launched ${Math.floor(seconds / 86_400)}d ago`;
  if (seconds < 31_536_000) return `Launched ${Math.floor(seconds / 2_592_000)}mo ago`;
  return `Launched ${Math.floor(seconds / 31_536_000)}y ago`;
}
