import type { Trade } from "./types";

export function mergeTrades(previous: Trade[], incoming: Trade[]): Trade[] {
  const seen = new Map(previous.map(trade => [trade.id, trade]));
  for (const trade of incoming) seen.set(trade.id, trade);
  return [...seen.values()].sort((a, b) => tradeTime(b) - tradeTime(a) || String(b.id).localeCompare(String(a.id)));
}

export function tradeTime(trade: Trade): number {
  return trade.block_time ? Number(trade.block_time) * 1000 : Number(trade.created_at);
}
