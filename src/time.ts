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
