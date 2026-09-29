import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { cardTrend } from "../market-card";
import { cachedRead } from "../read-cache";
import { isPriceLive } from "../market-prices";
import type { MarketSnapshot } from "../types";

type History = Pick<MarketSnapshot, "sampledAt" | "priceUsd">[];
// Charts must not flood the API or block the market list. Only visible cards
// request history, with three reads in flight and one minute of shared caching.
const queue: Array<() => void> = [];
let active = 0;
function next() { while (active < 3 && queue.length) queue.shift()!(); }
function history(id: string): Promise<History> {
  return cachedRead(`card-trend:${id}`, () => new Promise<History>(resolve => {
    queue.push(() => {
      active++;
      void api.marketData(id, "24h").then(data => resolve(Array.isArray(data.snapshots) ? data.snapshots.map(({ sampledAt, priceUsd }) => ({ sampledAt, priceUsd })) : [])).catch(() => resolve([])).finally(() => { active--; next(); });
    });
    next();
  }), 60_000);
}

export function MarketCardTrend({ id, enabled, priceUsd, priceUpdatedAt, priceStatus }: { id: string; enabled: boolean; priceUsd: number; priceUpdatedAt?: number | null; priceStatus?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const gradient = useId().replaceAll(":", "");
  const [snapshots, setSnapshots] = useState<History>([]);
  const trend = useMemo(() => cardTrend(enabled && isPriceLive({ priceUpdatedAt, priceStatus })
    ? [...snapshots, { sampledAt: priceUpdatedAt!, priceUsd }]
    : snapshots), [snapshots, enabled, priceUsd, priceUpdatedAt, priceStatus]);
  useEffect(() => {
    setSnapshots([]);
    if (!enabled || !ref.current) return;
    let disposed = false;
    const load = () => { void history(id).then(value => { if (!disposed) setSnapshots(value); }); };
    if (!("IntersectionObserver" in window)) { load(); return () => { disposed = true; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    });
    observer.observe(ref.current);
    return () => { disposed = true; observer.disconnect(); };
  }, [id, enabled]);
  return <div ref={ref} className={`card-trend ${trend?.falling ? "is-falling" : ""}`}>
    {trend && <svg viewBox="0 0 180 78" preserveAspectRatio="none" role="img" aria-label="24-hour price history">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".1"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
      <path d={trend.area} fill={`url(#${gradient})`}/><path d={trend.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>}
  </div>;
}
