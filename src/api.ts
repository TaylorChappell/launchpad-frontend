import type { AdminDiagnostics, AnalyticsResponse, BatchStepValidation, CreatorLock, CreatorLockBalance, CreatorLockTransactionEnvelope, Launch, LaunchConfirmation, LaunchIntentResponse, LaunchRetryResponse, MarketSnapshot, RuntimeConfig, StockOption, Trade, TransactionEnvelope, WalletRewardsResponse } from "./types";

const DEFAULT_API_URL = "https://launchpad-backend-production-63dc.up.railway.app";
const cleanUrl = (value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim().replace(/\/$/, "") : null;
export const API_URL = cleanUrl(import.meta.env.VITE_API_URL) ?? cleanUrl(window.AQUA_CONFIG?.API_URL) ?? DEFAULT_API_URL;

export class ApiError extends Error {
  status: number;
  code?: string;
  rebuildRequired: boolean;

  constructor(message: string, status: number, body: { code?: string; rebuildRequired?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.rebuildRequired = Boolean(body.rebuildRequired);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as T & { error?: string; code?: string; rebuildRequired?: boolean };
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status, body);
  return body;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  config: () => request<RuntimeConfig>("/api/config"),
  analytics: () => request<AnalyticsResponse>("/api/analytics"),
  launches: () => request<{ launches: Launch[] }>("/api/launches"),
  launch: (id: string) => request<{ launch: Launch; trades: Trade[]; tradesHasMore?: boolean; creatorLock: CreatorLock | null }>(`/api/launches/${encodeURIComponent(id)}`),
  trades: (id: string, offset: number, limit = 10) => request<{ trades: Trade[]; hasMore: boolean }>(`/api/launches/${encodeURIComponent(id)}/trades?offset=${offset}&limit=${limit}`),
  marketData: (id: string) => request<{ snapshots: MarketSnapshot[] }>(`/api/launches/${encodeURIComponent(id)}/market-data`),
  search: (query: string) => request<{ launches: Launch[] }>(`/api/search?q=${encodeURIComponent(query)}`),
  stocks: () => request<{ stocks: StockOption[] }>("/api/stocks"),
  rewards: (wallet: string) => request<WalletRewardsResponse>(`/api/rewards/${encodeURIComponent(wallet)}`),
  rewardClaim: (epochId: string, claimant: string) => request<TransactionEnvelope>(`/api/rewards/${encodeURIComponent(epochId)}/claim-transaction`, json({ claimant })),
  confirmRewardClaim: (epochId: string, claimant: string, signature: string) => request<{ claimed: true; signature: string }>(`/api/rewards/${encodeURIComponent(epochId)}/confirm`, json({ claimant, signature })),
  creatorFeeQuote: (amountRaw: string, totalSupplyRaw: string, durationSeconds: number) => request<{ feeShareBps: number }>(`/api/creator-fee-quote?amountRaw=${encodeURIComponent(amountRaw)}&totalSupplyRaw=${encodeURIComponent(totalSupplyRaw)}&durationSeconds=${durationSeconds}`),
  creatorLockBalance: (id: string, creator: string) => request<CreatorLockBalance>(`/api/launches/${encodeURIComponent(id)}/creator-lock/balance?creator=${encodeURIComponent(creator)}`),
  creatorLockTransaction: (id: string, creator: string, amountRaw: string, durationSeconds: number) => request<CreatorLockTransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-lock/transaction`, json({ creator, amountRaw, durationSeconds })),
  creatorLockReleaseTransaction: (id: string, creator: string) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-lock/release-transaction`, json({ creator })),
  creatorFeesClaimTransaction: (id: string, creator: string) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-fees/claim-transaction`, json({ creator })),
  upload: (body: FormData) => request<{ imageId: string; imageUrl: string }>("/api/uploads", { method: "POST", body }),
  createLaunch: (body: unknown) => request<LaunchIntentResponse>("/api/launches", json(body)),
  retryLaunchTransaction: (id: string, creator: string) => request<LaunchRetryResponse>(`/api/launches/${encodeURIComponent(id)}/retry-transaction`, json({ creator })),
  confirmLaunch: (id: string, signature: string) => request<LaunchConfirmation>(`/api/launches/${encodeURIComponent(id)}/confirm`, json({ signature })),
  validateBatchStep: (id: string, step: "pool" | "liquidity" | "lock", signedTransactionBase64: string) => request<BatchStepValidation>(`/api/launches/${encodeURIComponent(id)}/validate-batch-step`, json({ step, signedTransactionBase64 })),
  devBuyTransaction: (id: string, body: { trader: string; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/dev-buy-transaction`, json(body)),
  tradeTransaction: (id: string, body: { trader: string; side: "buy" | "sell"; buyCurrency?: "PAIR" | "SOL"; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope & { route?: "orca" | "jupiter" | "jupiter_then_orca"; inputSymbol?: string; outputSymbol?: string; followUp?: { buyCurrency: "PAIR"; amountRaw: string } }>(`/api/launches/${encodeURIComponent(id)}/trade-transaction`, json(body)),
  adminChallenge: (wallet: string) => request<{ challenge: string; message: string; expiresAt: number }>(`/api/admin/challenge?wallet=${encodeURIComponent(wallet)}`),
  adminSession: (body: { wallet: string; challenge: string; message: string; signature: string }) => request<{ token: string; expiresAt: number }>("/api/admin/session", json(body)),
  adminDiagnostics: (token: string) => request<AdminDiagnostics>("/api/admin/diagnostics", { headers: { Authorization: `Bearer ${token}` } }),
};
