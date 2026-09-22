export function pairCatalogPollDelay(result: { refreshing?: boolean; warning?: string; customPairWarning?: string; retryAfterMs?: number }, elapsedMs: number): number | null {
  if (elapsedMs >= 120_000) return null;
  if (result.refreshing) return 2000;
  if (result.warning || result.customPairWarning) return Math.min(30_000, Math.max(1000, result.retryAfterMs ?? 5000));
  return null;
}
