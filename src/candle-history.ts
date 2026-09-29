import { api, ApiError } from "./api";
import { snapshotCandles, type CandleHistory, type ChartRange } from "./market-candles";

export async function loadCandleHistory(id: string, range: ChartRange): Promise<CandleHistory> {
  try {
    const data = await api.usdCandles(id,range);
    if (Array.isArray(data.candles) && Number.isFinite(data.intervalSeconds) && data.intervalSeconds > 0) return data;
  } catch (error) {
    // Rollouts and showcase markets can still expose the older snapshot route.
    if (!(error instanceof ApiError) || ![404,405].includes(error.status)) throw error;
  }
  const data = await api.marketData(id,range);
  if (!Array.isArray(data.snapshots)) throw new Error("Chart history is unavailable.");
  return snapshotCandles(data.snapshots,range);
}
