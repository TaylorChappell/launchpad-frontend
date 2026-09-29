import { useEffect, useMemo, useRef, useState } from "react";
import { cachedRead } from "../read-cache";
import { isPriceLive } from "../market-prices";
import { loadCandleHistory } from "../candle-history";
import { chartCandles, compactCandles, withLiveCandle, type CandleHistory } from "../market-candles";
import { CandleChart } from "./CandleChart";

// Visible cards only, with three reads in flight and a minute of shared caching.
const queue: Array<() => void> = [];
let active = 0;
function next() { while (active < 3 && queue.length) queue.shift()!(); }
function history(id: string): Promise<CandleHistory> {
  return cachedRead(`card-candles:${id}`, () => new Promise<CandleHistory>((resolve,reject) => {
    queue.push(() => {
      active++;
      void loadCandleHistory(id,"24h").then(resolve,reject).finally(() => { active--; next(); });
    });
    next();
  }), 60_000);
}

export function MarketCardTrend({ id, enabled, priceUsd, priceUpdatedAt, priceStatus }: { id: string; enabled: boolean; priceUsd: number; priceUpdatedAt?: number | null; priceStatus?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<CandleHistory | null>(null);
  const candles = useMemo(() => loaded ? compactCandles(chartCandles(withLiveCandle(loaded,
    enabled && isPriceLive({priceUpdatedAt,priceStatus}) ? {sampledAt:priceUpdatedAt!,priceUsd,marketCapUsd:0} : undefined),"price")) : [], [loaded,enabled,priceUsd,priceUpdatedAt,priceStatus]);
  useEffect(() => {
    setLoaded(null);
    if (!enabled || !ref.current) return;
    let disposed = false;
    const load = () => { void history(id).then(value => { if (!disposed) setLoaded(value); }).catch(()=>{}); };
    if (!("IntersectionObserver" in window)) { load(); return () => { disposed = true; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    });
    observer.observe(ref.current);
    return () => { disposed = true; observer.disconnect(); };
  }, [id, enabled]);
  const falling=candles.length>0&&candles.at(-1)!.close<candles[0].open;
  return <div ref={ref} className={`card-trend ${falling?"is-falling":""}`}>
    {candles.length>0&&<CandleChart candles={candles} viewKey={id} mini/>}
  </div>;
}
