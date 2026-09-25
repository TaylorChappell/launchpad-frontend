import type { Launch } from "./types";
export type MarketPage = { launches: Launch[]; hasMore: boolean; nextOffset: number };
type Snapshot = { key: string; at: number; data: MarketPage };
const snapshots = new Map<string, Snapshot>();
const storageKey = "aqua:market-snapshots:v1";
const maxAge = 5 * 60_000;
const maxEntries = 8;
let restored = false;
function valid(value: Snapshot, now: number) {
  return value && typeof value.key === "string" && Number.isFinite(value.at) && now >= value.at && now - value.at < maxAge && Array.isArray(value.data?.launches) && typeof value.data.hasMore === "boolean" && Number.isInteger(value.data.nextOffset);
}
export function readMarketSnapshot(key: string, now = Date.now()): MarketPage | null {
  if (!restored) {
    restored = true;
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) for (const value of saved.slice(-maxEntries)) if (valid(value, now)) snapshots.set(value.key, value);
    } catch { /* A fresh request still works without storage. */ }
  }
  const value = snapshots.get(key);
  if (!value || !valid(value, now)) { snapshots.delete(key); return null; }
  return value.data;
}
export function saveMarketSnapshot(key: string, data: MarketPage, now = Date.now()) {
  snapshots.delete(key);
  snapshots.set(key, { key, at: now, data });
  for (const [id, value] of snapshots) if (!valid(value, now)) snapshots.delete(id);
  while (snapshots.size > maxEntries) snapshots.delete(snapshots.keys().next().value!);
  try { sessionStorage.setItem(storageKey, JSON.stringify([...snapshots.values()])); } catch { /* Memory cache remains available. */ }
}
