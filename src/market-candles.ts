import type { MarketSnapshot } from "./types";

export type ChartRange = "1h" | "24h" | "7d" | "all";
export type OHLC = { open: number; high: number; low: number; close: number };
export type UsdCandle = { time: number; lastSampleAt: number; price: OHLC; cap: OHLC | null };
export type CandleHistory = { intervalSeconds: number; candles: UsdCandle[] };
export type ChartCandle = OHLC & { time: number };
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const valid = (v: OHLC | null | undefined): v is OHLC => !!v && [v.open,v.high,v.low,v.close].every(positive)
  && v.high >= Math.max(v.open,v.close) && v.low <= Math.min(v.open,v.close);
const seconds = (time: number) => Math.floor(time < 1e12 ? time : time / 1000);
const ohlc = (value: number): OHLC => ({open:value,high:value,low:value,close:value});
const append = (bar: OHLC, value: number): OHLC => ({ ...bar, high:Math.max(bar.high,value), low:Math.min(bar.low,value), close:value });

/** Compatibility for older APIs and the explicitly labelled staging showcases. */
export function snapshotCandles(snapshots: Pick<MarketSnapshot,"sampledAt"|"priceUsd"|"marketCapUsd"|"fdvUsd">[], range: ChartRange): CandleHistory {
  const intervalSeconds = {"1h":300,"24h":900,"7d":3600,all:86400}[range];
  const rows = [...new Map(snapshots.filter(p => positive(p.sampledAt) && positive(p.priceUsd))
    .map(p => [seconds(p.sampledAt),p])).values()].sort((a,b)=>seconds(a.sampledAt)-seconds(b.sampledAt));
  const candles: UsdCandle[] = [];
  for (const point of rows) {
    const time = Math.floor(seconds(point.sampledAt)/intervalSeconds)*intervalSeconds;
    const lastSampleAt = seconds(point.sampledAt)*1000;
    const cap = point.marketCapUsd ?? point.fdvUsd;
    const previous = candles.at(-1);
    if (previous?.time === time) {
      previous.price = append(previous.price,point.priceUsd);
      previous.cap = positive(cap) && previous.cap ? append(previous.cap,cap) : null;
      previous.lastSampleAt = lastSampleAt;
    } else candles.push({time,lastSampleAt,price:ohlc(point.priceUsd),cap:positive(cap)?ohlc(cap):null});
  }
  return {intervalSeconds,candles};
}

export function chartCandles(history: CandleHistory, metric: "price"|"cap"): ChartCandle[] {
  return [...new Map(history.candles.filter(p => positive(p.time) && valid(p[metric]))
    .map(p => [seconds(p.time),{time:seconds(p.time),...p[metric]!}])).values()].sort((a,b)=>a.time-b.time);
}

/** Display executed pair prices in dollars, without generating any new bars.
 * Historical USD is an estimate at this reference rate, not recorded trade-time FX.
 * Apply one rate to the complete loaded history so paged bars use the same units.
 */
export function usdTradeCandles(history: CandleHistory & {currency:string}, metric:"price"|"cap", pairPriceUsd?:number|null):ChartCandle[] {
  const rate=history.currency==="USD"?1:pairPriceUsd;
  if(!positive(rate))return [];
  return chartCandles(history,metric).map(bar=>({time:bar.time,open:bar.open*rate,high:bar.high*rate,low:bar.low*rate,close:bar.close*rate}))
    .filter(bar=>valid(bar));
}

/** Keep sparse markets readable: two trades must not become two giant candles. */
export function initialCandleRange(count:number,width:number) {
  const visible=Math.max(80,Math.ceil(Math.max(0,width-90)/5));
  const from=count<visible?-5:count-visible+12;
  return {from,to:from+visible};
}

// Only extend the latest candle with a newer, live indexed price. Do not join
// missing periods, reuse a stale quote or reconstruct past USD using today's FX.
export function withLiveCandle(history: CandleHistory, point?: { sampledAt: number; priceUsd: number; marketCapUsd: number }): CandleHistory {
  if (!point || !positive(point.priceUsd) || !positive(point.sampledAt) || !positive(history.intervalSeconds)) return history;
  const previous = history.candles.at(-1);
  if (previous && point.sampledAt <= previous.lastSampleAt) return history;
  const time = Math.floor(seconds(point.sampledAt)/history.intervalSeconds)*history.intervalSeconds;
  if (previous && time < previous.time) return history;
  const cap = positive(point.marketCapUsd) ? point.marketCapUsd : null;
  const next: UsdCandle = previous?.time === time
    ? {...previous,lastSampleAt:point.sampledAt,price:append(previous.price,point.priceUsd),cap:cap && previous.cap ? append(previous.cap,cap) : null}
    : {time,lastSampleAt:point.sampledAt,price:ohlc(point.priceUsd),cap:cap?ohlc(cap):null};
  return {...history,candles:[...history.candles.slice(0,previous?.time===time?-1:undefined),next]};
}

export function candlePrice(value: number, currency = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  if(currency!=="USD"){
    const amount=Math.abs(value)>=1000?new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:2}).format(value)
      :value!==0&&Math.abs(value)<.000001?value.toExponential(2):new Intl.NumberFormat("en",{maximumSignificantDigits:5}).format(value);
    return `${amount} ${currency}`;
  }
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
  if (value !== 0 && Math.abs(value) < .000001) return `$${value.toExponential(2)}`;
  return new Intl.NumberFormat("en",{style:"currency",currency:"USD",maximumSignificantDigits:5}).format(value);
}

export function compactCandles(candles: ChartCandle[], limit = 32): ChartCandle[] {
  const size=Math.max(1,Math.ceil(candles.length/limit));
  const result:ChartCandle[]=[];
  for(let i=0;i<candles.length;i+=size){
    const group=candles.slice(i,i+size);
    result.push({time:group[0].time,open:group[0].open,high:Math.max(...group.map(p=>p.high)),low:Math.min(...group.map(p=>p.low)),close:group.at(-1)!.close});
  }
  return result;
}

export const candleIntervals = {"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400} as const;
export type CandleInterval = keyof typeof candleIntervals;
export type CandlePage = CandleHistory & { source:"indexed_pool_trades"; currency:string; nextBefore: number | null; historyPending?:boolean };
/** Merge by bucket, preserving older loaded history while refreshing current bars. */
export function mergeCandleHistory(previous: CandleHistory, incoming: CandleHistory): CandleHistory {
  if(previous.intervalSeconds!==incoming.intervalSeconds)return incoming;
  const rows=new Map(previous.candles.map(p=>[p.time,p]));
  for(const p of incoming.candles){
    const old=rows.get(p.time);
    if(!old||p.lastSampleAt>=old.lastSampleAt)rows.set(p.time,p);
  }
  return {...previous,candles:[...rows.values()].sort((a,b)=>a.time-b.time)};
}
