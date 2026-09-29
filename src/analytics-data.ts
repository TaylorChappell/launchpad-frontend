import { api, API_URL } from "./api";
import { autoRewardsApi } from "./auto-rewards-api";
import { createAnalyticsCache } from "./analytics-cache";
import type { AnalyticsResponse } from "./types";

export const analyticsRanges = ["24h", "7d", "30d", "all"] as const;
export type AnalyticsRange = typeof analyticsRanges[number];
export const analyticsPeriodLabel = (range: AnalyticsRange) => range === "all" ? "All-time total"
  : range === "24h" ? "Last 24 hours" : range === "7d" ? "Last 7 days" : "Last 30 days";
export const analyticsSnapshots = createAnalyticsCache<AnalyticsResponse>(`aqua:analytics:v1:${API_URL}`, (value, range): value is AnalyticsResponse => {
  const data = value as AnalyticsResponse | null;
  return Boolean(data && (data.range === range || range === "all" && data.range === undefined)
    && data.totals && Number.isFinite(data.totals.rewardsAccumulatedUsd) && Number.isFinite(data.totals.buybackSol)
    && Number.isFinite(data.totals.liveMarkets) && Array.isArray(data.rewardHistory) && Array.isArray(data.buybackHistory)
    && Array.isArray(data.markets) && Array.isArray(data.recentBuybacks) && Array.isArray(data.claimedAssets));
}, 4);
export const loadAnalytics = (range: AnalyticsRange, refresh = false) => analyticsSnapshots.load(range, () => api.analytics(range), refresh);

/** Warm the small fixed set once the requested overview is ready. These reads
 * share the same promises as visible panels, including during rapid switching. */
export async function preloadAnalytics() {
  await Promise.allSettled(analyticsRanges.flatMap(range => [loadAnalytics(range), autoRewardsApi.activity(null, 0, "", range)]));
}
