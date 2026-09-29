import { api, ApiError } from "./api";
import { rememberCandlePreview } from "./candle-preview-cache";
import { snapshotCandles, type CandleHistory, candleIntervals, type CandleInterval, type CandlePage, type ChartRange } from "./market-candles";

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

export async function loadCandlePage(id:string,interval:CandleInterval,before?:number):Promise<CandlePage>{
  const data=await api.candlePage(id,interval,before);
  if(data.source!=="indexed_pool_trades"||typeof data.currency!=="string"||!data.currency||(before!==undefined&&data.nextBefore!==null&&data.nextBefore>=before)||!Array.isArray(data.candles)||data.intervalSeconds!==candleIntervals[interval]||!(data.nextBefore===null||typeof data.nextBefore==="number")) {
    throw new Error("This candle interval needs the latest chart API.");
  }
  if(data.coverage&&(!Number.isFinite(data.coverage.from)||!Number.isFinite(data.coverage.to)||data.coverage.from<0||data.coverage.to<data.coverage.from))throw new Error("Chart history coverage is invalid.");
  if(before===undefined)rememberCandlePreview(id,interval,data);
  return data;
}
