import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MarketSnapshot } from "../types";

const money = new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 2 });
const windows = { "1H": 3_600_000, "24H": 86_400_000, "7D": 604_800_000, "ALL": Infinity };
export function MarketCapLine({ snapshots, range: selected, onRangeChange }: { snapshots: MarketSnapshot[]; range: string; onRangeChange: (range:string)=>void }) {
  const range = selected.toUpperCase() as keyof typeof windows;
  const [metric,setMetric] = useState<"cap"|"price">("cap");
  const points = useMemo(() => [...new Map(snapshots.map((point) => ({
    time: point.sampledAt < 1e12 ? point.sampledAt * 1000 : point.sampledAt,
    value: Number(metric === "price" ? point.priceUsd : point.marketCapUsd ?? point.fdvUsd),
  })).filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value) && point.value >= 0).map((point) => [point.time, point])).values()].sort((a, b) => a.time - b.time), [snapshots,metric]);
  const cutoff = Date.now() - windows[range];
  const visible = points.filter((point) => point.time >= cutoff);
  return <div className="market-cap-line interactive-market-chart">
    <div className="chart-controls"><div aria-label="Chart timeframe">{(Object.keys(windows) as Array<keyof typeof windows>).map((value) => <button key={value} aria-pressed={range === value} onClick={() => onRangeChange(value.toLowerCase())}>{value === "ALL" ? "All time" : value}</button>)}</div><div><button aria-pressed={metric==="cap"} onClick={()=>setMetric("cap")}>Market cap</button><button aria-pressed={metric==="price"} onClick={()=>setMetric("price")}>Price</button></div></div>
    {visible.length ? <div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={visible} margin={{ top: 16, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
      <defs><linearGradient id="market-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#278fc3" stopOpacity={0.2}/><stop offset="100%" stopColor="#278fc3" stopOpacity={0.01}/></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#e2edf2"/>
      <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value: number) => new Date(value).toLocaleString([], range === "1H" || range === "24H" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" })} minTickGap={55} tickLine={false} axisLine={false} tick={{ fill: "#527083", fontSize: 11 }}/>
      <YAxis orientation="right" width={72} tickFormatter={(value: number) => money.format(value)} domain={["auto", "auto"]} tickLine={false} axisLine={false} tick={{ fill: "#527083", fontSize: 11 }}/>
      <Tooltip labelFormatter={(value) => new Date(Number(value)).toLocaleString()} formatter={(value) => [new Intl.NumberFormat("en",{style:"currency",currency:"USD",maximumSignificantDigits:5}).format(Number(value)), metric === "cap" ? "Market cap" : "Price"]} contentStyle={{ background: "#fff", color: "#163d52", border: "1px solid #c5dce8", borderRadius: 8, fontSize: 12 }}/>
      <Area type="linear" dataKey="value" stroke="#2086bd" strokeWidth={2} fill="url(#market-chart-fill)" isAnimationActive={false} dot={visible.length === 1} activeDot={{ r: 4 }}/>
    </AreaChart></ResponsiveContainer></div> : <div className="chart-no-data">{points.length ? "No indexed snapshots in this timeframe. Try All time." : "Waiting for the first market snapshot."}</div>}
  </div>;
}
