import type { MarketSnapshot } from "./types";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function cardAmount(value: number | null | undefined, currency = false): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  const prefix = currency ? "$" : "";
  if (value > 0 && value < .01) return `<${prefix}0.01`;
  return prefix + (value < 1 ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : compact.format(value));
}

export function cardRawAmount(raw: string | undefined, decimals: number): string {
  if (!raw || !/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return "—";
  return cardAmount(Number(raw) / 10 ** decimals);
}

export function cardTrend(snapshots: Pick<MarketSnapshot, "sampledAt" | "priceUsd">[]) {
  const byTime = new Map<number, number>();
  for (const point of snapshots) {
    if (Number.isFinite(point.sampledAt) && point.sampledAt > 0 && Number.isFinite(point.priceUsd) && point.priceUsd >= 0) byTime.set(point.sampledAt, point.priceUsd);
  }
  const points = [...byTime].sort((a, b) => a[0] - b[0]);
  if (points.length < 2) return null;
  const prices = points.map(point => point[1]);
  const min = Math.min(...prices), max = Math.max(...prices);
  const first = points[0], last = points[points.length - 1];
  // Bound SVG size while preserving the real timestamps, first and last sample.
  const count = Math.min(points.length, 48);
  const sampled = Array.from({ length: count }, (_, i) => points[Math.round(i * (points.length - 1) / (count - 1))]);
  const path = sampled.map(([time, price], i) => {
    const x = 2 + (time - first[0]) / (last[0] - first[0]) * 176;
    const y = max === min ? 36 : 64 - (price - min) / (max - min) * 54;
    return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return { path, area: `${path} L178,76 L2,76 Z`, falling: last[1] < first[1] };
}
