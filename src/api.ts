import type { Launch, LaunchConfirmation, LaunchIntentResponse, RuntimeConfig, StockOption, Trade, TransactionEnvelope, WalletReward } from "./types";

const DEFAULT_API_URL = "https://launchpad-backend-production-63dc.up.railway.app";
const cleanUrl = (value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim().replace(/\/$/, "") : null;
export const API_URL = cleanUrl(window.AQUA_CONFIG?.API_URL) ?? cleanUrl(import.meta.env.VITE_API_URL) ?? DEFAULT_API_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  config: () => request<RuntimeConfig>("/api/config"),
  launches: () => request<{ launches: Launch[] }>("/api/launches"),
  launch: (id: string) => request<{ launch: Launch; trades: Trade[] }>(`/api/launches/${encodeURIComponent(id)}`),
  search: (query: string) => request<{ launches: Launch[] }>(`/api/search?q=${encodeURIComponent(query)}`),
  stocks: () => request<{ stocks: StockOption[] }>("/api/stocks"),
  rewards: (wallet: string) => request<{ rewards: WalletReward[] }>(`/api/rewards/${encodeURIComponent(wallet)}`),
  rewardClaim: (epochId: string, claimant: string) => request<TransactionEnvelope>(`/api/rewards/${encodeURIComponent(epochId)}/claim-transaction`, json({ claimant })),
  upload: (body: FormData) => request<{ imageId: string; imageUrl: string }>("/api/uploads", { method: "POST", body }),
  createLaunch: (body: unknown) => request<LaunchIntentResponse>("/api/launches", json(body)),
  confirmLaunch: (id: string, signature: string) => request<LaunchConfirmation>(`/api/launches/${encodeURIComponent(id)}/confirm`, json({ signature })),
  tradeTransaction: (id: string, body: { trader: string; side: "buy" | "sell"; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/trade-transaction`, json(body)),
};
