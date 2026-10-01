export const marketFilterKeys = ["pair", "mode", "dex", "minCap", "maxCap", "minVolume", "minLiquidity", "minHolders", "ageHours"] as const;
export const marketPreferencesKey = "aqua:market-preferences:v1";

// Only persist discovery controls, never a search term or unrelated URL state.
export function marketPreferences(params: URLSearchParams): URLSearchParams {
  const saved = new URLSearchParams();
  const sort = params.get("sort") ?? "volume";
  saved.set("sort", ["volume", "market_cap", "trending", "recent", "watchlist"].includes(sort) ? sort : "volume");
  for (const key of marketFilterKeys) {
    const value = params.get(key)?.trim();
    if (!value || value === "all") continue;
    if (key === "pair") { if (value.length <= 32) saved.set(key, value); }
    else if (key === "mode") { if (["holder_rewards", "buyback_burn", "jackpot"].includes(value)) saved.set(key, value); }
    else if (key === "dex") { if (["paid", "unpaid"].includes(value)) saved.set(key, value); }
    else if (key === "ageHours") { if (["1", "24", "168", "720"].includes(value)) saved.set(key, value); }
    else if (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e15 && (key !== "minHolders" || Number.isInteger(Number(value)))) saved.set(key, value);
  }
  if (saved.has("minCap") && saved.has("maxCap") && Number(saved.get("minCap")) > Number(saved.get("maxCap"))) {
    saved.delete("minCap"); saved.delete("maxCap");
  }
  return saved;
}

export function readMarketPreferences(): URLSearchParams {
  try { return marketPreferences(new URLSearchParams(localStorage.getItem(marketPreferencesKey) ?? "")); }
  catch { return marketPreferences(new URLSearchParams()); }
}

export function saveMarketPreferences(params: URLSearchParams): URLSearchParams {
  const saved = marketPreferences(params);
  try { localStorage.setItem(marketPreferencesKey, saved.toString()); } catch { /* Discovery still works when storage is unavailable. */ }
  return saved;
}
