import { useMemo } from "react";
import type { MarketSnapshot } from "../types";

type Candle = { start: number; end: number; open: number; high: number; low: number; close: number };

const money = new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric" });

function valueOf(point: MarketSnapshot) {
  return Number(point.marketCapUsd ?? point.fdvUsd ?? 0);
}

function makeCandles(points: MarketSnapshot[], maximum = 42) {
  const clean = [...points].filter((point) => Number.isFinite(valueOf(point)) && valueOf(point) >= 0).sort((a, b) => a.sampledAt - b.sampledAt);
  if (!clean.length) return [];
  const bucketSize = Math.max(1, Math.ceil(clean.length / maximum));
  const result: Candle[] = [];
  for (let index = 0; index < clean.length; index += bucketSize) {
    const bucket = clean.slice(index, index + bucketSize);
    const values = bucket.map(valueOf);
    result.push({ start: bucket[0].sampledAt, end: bucket[bucket.length - 1].sampledAt, open: values[0], high: Math.max(...values), low: Math.min(...values), close: values[values.length - 1] });
  }
  return result;
}

export function MarketCapCandles({ snapshots }: { snapshots: MarketSnapshot[] }) {
  const candles = useMemo(() => makeCandles(snapshots), [snapshots]);
  if (!candles.length) return <div className="page-loading">Market-cap candles will appear after the first index passes.</div>;

  const width = 820, height = 310, left = 16, right = 78, top = 18, bottom = 34;
  const innerWidth = width - left - right, innerHeight = height - top - bottom;
  let minimum = Math.min(...candles.map((item) => item.low));
  let maximum = Math.max(...candles.map((item) => item.high));
  if (minimum === maximum) { const padding = Math.max(1, maximum * .02); minimum -= padding; maximum += padding; }
  const range = maximum - minimum;
  const y = (value: number) => top + ((maximum - value) / range) * innerHeight;
  const step = innerWidth / candles.length;
  const bodyWidth = Math.max(3, Math.min(13, step * .56));
  const first = candles[0], last = candles[candles.length - 1];

  return <div className="candles">
    <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label="Market-cap candlestick chart">
      {[0,1,2,3,4].map((line) => {
        const value = maximum - range * line / 4;
        const lineY = y(value);
        return <g key={line}><line x1={left} x2={width - right + 8} y1={lineY} y2={lineY} className="candle-grid"/><text x={width - right + 15} y={lineY + 4} className="candle-axis">{money.format(value)}</text></g>;
      })}
      {candles.map((candle, index) => {
        const x = left + step * index + step / 2;
        const rising = candle.close >= candle.open;
        const topBody = y(Math.max(candle.open, candle.close));
        const bottomBody = y(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(2, bottomBody - topBody);
        return <g key={candle.start + "-" + index} className={rising ? "candle-up" : "candle-down"}>
          <title>{date.format(new Date(candle.start * 1000)) + " — O " + money.format(candle.open) + " H " + money.format(candle.high) + " L " + money.format(candle.low) + " C " + money.format(candle.close)}</title>
          <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} className="candle-wick"/>
          <rect x={x - bodyWidth / 2} y={topBody} width={bodyWidth} height={bodyHeight} rx="1.5" className="candle-body"/>
        </g>;
      })}
      <text x={left} y={height - 8} className="candle-time">{date.format(new Date(first.start * 1000))}</text>
      <text x={width - right + 8} y={height - 8} textAnchor="end" className="candle-time">{date.format(new Date(last.end * 1000))}</text>
    </svg>
    <div className="candle-legend"><span><i className="up"/>Market cap rose</span><span><i className="down"/>Market cap fell</span><small>OHLC candles are grouped from AQUA index snapshots.</small></div>
  </div>;
}
