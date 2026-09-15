import { useMemo } from "react";
import type { MarketSnapshot } from "../types";

const money = new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric" });

function timestampMs(value: number) {
  return value < 1_000_000_000_000 ? value * 1_000 : value;
}

function marketCap(point: MarketSnapshot) {
  return Number(point.marketCapUsd ?? point.fdvUsd ?? 0);
}

function chartPoints(snapshots: MarketSnapshot[], maximum = 100) {
  const clean = [...snapshots]
    .map((point) => ({ sampledAt: point.sampledAt, value: marketCap(point) }))
    .filter((point) => Number.isFinite(point.value) && point.value >= 0)
    .sort((a, b) => a.sampledAt - b.sampledAt);
  if (clean.length <= maximum) return clean;
  const step = (clean.length - 1) / (maximum - 1);
  return Array.from({ length: maximum }, (_, index) => clean[Math.round(index * step)]);
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const middle = (current.x + next.x) / 2;
    path += ` C ${middle} ${current.y}, ${middle} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function MarketCapLine({ snapshots }: { snapshots: MarketSnapshot[] }) {
  const points = useMemo(() => chartPoints(snapshots), [snapshots]);
  if (!points.length) return <div className="page-loading">The market-cap line will appear after the first index pass.</div>;

  const width = 820;
  const height = 310;
  const left = 16;
  const right = 78;
  const top = 18;
  const bottom = 34;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  let minimum = Math.min(...points.map((point) => point.value));
  let maximum = Math.max(...points.map((point) => point.value));
  if (minimum === maximum) {
    const padding = Math.max(1, maximum * .02);
    minimum -= padding;
    maximum += padding;
  } else {
    const padding = (maximum - minimum) * .08;
    minimum = Math.max(0, minimum - padding);
    maximum += padding;
  }
  const range = maximum - minimum;
  const plotted = points.map((point, index) => ({
    x: left + (points.length === 1 ? innerWidth / 2 : index / (points.length - 1) * innerWidth),
    y: top + (maximum - point.value) / range * innerHeight,
  }));
  const line = smoothPath(plotted);
  const area = `${line} L ${plotted[plotted.length - 1].x} ${top + innerHeight} L ${plotted[0].x} ${top + innerHeight} Z`;
  const last = plotted[plotted.length - 1];

  return <div className="market-cap-line">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Market-cap line chart">
      <defs><linearGradient id="market-cap-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#57dfe0" stopOpacity=".24"/><stop offset="1" stopColor="#57dfe0" stopOpacity="0"/></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((index) => {
        const value = maximum - range * index / 4;
        const y = top + innerHeight * index / 4;
        return <g key={index}><line x1={left} x2={width - right + 8} y1={y} y2={y} className="market-line-grid"/><text x={width - right + 15} y={y + 4} className="market-line-axis">{money.format(value)}</text></g>;
      })}
      <path d={area} className="market-line-area"/>
      <path d={line} className="market-line-stroke"/>
      <circle cx={last.x} cy={last.y} r="4" className="market-line-point"/>
      <text x={left} y={height - 8} className="market-line-time">{date.format(new Date(timestampMs(points[0].sampledAt)))}</text>
      <text x={width - right + 8} y={height - 8} textAnchor="end" className="market-line-time">{date.format(new Date(timestampMs(points[points.length - 1].sampledAt)))}</text>
    </svg>
    <div className="market-line-caption">Market cap from AQUA index snapshots</div>
  </div>;
}
