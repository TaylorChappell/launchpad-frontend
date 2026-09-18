import type { WalletNotification, AdminDiagnostics, AnalyticsResponse, BatchStepValidation, CreatorLock, CreatorLockBalance, CreatorLockTransactionEnvelope, CumulativeRewardClaimConfirmation, CumulativeRewardClaimEnvelope, GovernanceMarket, GovernanceResponse, Launch, LaunchConfirmation, LaunchIntentResponse, LaunchRetryResponse, MarketGovernanceResponse, MarketProposalType, MarketSnapshot, RewardModeState, RuntimeConfig, StockOption, Trade, TransactionEnvelope, WalletRewardsResponse } from "./types";

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
  notifications: (wallet: string) => request<{ notifications: WalletNotification[] }>(`/api/notifications/${encodeURIComponent(wallet)}`),
  config: () => request<RuntimeConfig>("/api/config"),
  analytics: () => request<AnalyticsResponse>("/api/analytics"),
  launches: () => request<{ launches: Launch[] }>("/api/launches"),
  launch: (id: string) => request<{ launch: Launch; trades: Trade[]; tradesHasMore?: boolean; creatorLock: CreatorLock | null; rewardModeState: RewardModeState }>(`/api/launches/${encodeURIComponent(id)}`),
  trades: (id: string, offset: number, limit = 10) => request<{ trades: Trade[]; hasMore: boolean }>(`/api/launches/${encodeURIComponent(id)}/trades?offset=${offset}&limit=${limit}`),
  marketData: (id: string) => request<{ snapshots: MarketSnapshot[] }>(`/api/launches/${encodeURIComponent(id)}/market-data`),
  search: (query: string) => request<{ launches: Launch[] }>(`/api/search?q=${encodeURIComponent(query)}`),
  stocks: () => request<{ stocks: StockOption[] }>("/api/stocks"),
  rewards: (wallet: string) => request<WalletRewardsResponse>(`/api/rewards/${encodeURIComponent(wallet)}`),
  governance: (wallet?: string | null) => request<GovernanceResponse>(`/api/governance${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`),
  governanceVoteChallenge: (wallet: string, targetMint: string) => request<{ challenge: string; message: string; expiresAt: number; market: GovernanceMarket }>("/api/governance/vote-challenge", json({ wallet, targetMint })),
  governanceVote: (body: { wallet: string; targetMint: string; challenge: string; message: string; signature: string }) => request<GovernanceResponse>("/api/governance/vote", json(body)),
  governanceUnboostChallenge: (wallet: string) => request<{ challenge: string; message: string; expiresAt: number }>("/api/governance/unboost-challenge", json({ wallet })),
  governanceUnboost: (body: { wallet: string; challenge: string; message: string; signature: string }) => request<GovernanceResponse>("/api/governance/unboost", json(body)),
  marketGovernance: (id: string, wallet?: string | null) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`),
  marketProposalChallenge: (id: string, body: { action: "create" | "vote" | "details" | "challenge" | "activity"; wallet: string; proposalId?: string; content: unknown }) => request<{ challenge: string; message: string; expiresAt: number }>(`/api/launches/${encodeURIComponent(id)}/proposals/challenge`, json(body)),
  createMarketProposal: (id: string, body: { wallet: string; type: MarketProposalType; payload: Record<string, unknown>; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals`, json(body)),
  voteMarketProposal: (id: string, proposalId: string, body: { wallet: string; choice: "yes" | "no"; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/vote`, json(body)),
  submitDexDetails: (id: string, proposalId: string, body: { wallet: string; details: Record<string, unknown>; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/details`, json(body)),
  submitDeveloperActivity: (id: string, proposalId: string, body: { wallet: string; activity: Record<string, unknown>; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/activity`, json(body)),
  challengeMarketProposal: (id: string, proposalId: string, body: { wallet: string; reason: string; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/challenges`, json(body)),
  rewardClaim: (epochId: string, claimant: string) => request<TransactionEnvelope>(`/api/rewards/${encodeURIComponent(epochId)}/claim-transaction`, json({ claimant })),
  confirmRewardClaim: (epochId: string, claimant: string, signature: string) => request<{ claimed: true; signature: string }>(`/api/rewards/${encodeURIComponent(epochId)}/confirm`, json({ claimant, signature })),
  cumulativeRewardClaim: (launchId: string, claimant: string) => request<CumulativeRewardClaimEnvelope>(`/api/rewards/markets/${encodeURIComponent(launchId)}/claim-transaction`, json({ claimant })),
  confirmCumulativeRewardClaim: (launchId: string, claimant: string, signature: string, sequence: string) => request<CumulativeRewardClaimConfirmation>(`/api/rewards/markets/${encodeURIComponent(launchId)}/confirm`, json({ claimant, signature, sequence })),
  creatorFeeQuote: (amountRaw: string, totalSupplyRaw: string, durationSeconds: number) => request<{ feeShareBps: number }>(`/api/creator-fee-quote?amountRaw=${encodeURIComponent(amountRaw)}&totalSupplyRaw=${encodeURIComponent(totalSupplyRaw)}&durationSeconds=${durationSeconds}`),
  creatorLockBalance: (id: string, creator: string) => request<CreatorLockBalance>(`/api/launches/${encodeURIComponent(id)}/creator-lock/balance?creator=${encodeURIComponent(creator)}`),
  creatorLockTransaction: (id: string, creator: string, amountRaw: string, durationSeconds: number) => request<CreatorLockTransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-lock/transaction`, json({ creator, amountRaw, durationSeconds })),
  creatorLockReleaseTransaction: (id: string, creator: string) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-lock/release-transaction`, json({ creator })),
  confirmCreatorLock: (id: string, creator: string, signature: string) => request<{ confirmed: true; creatorLock: CreatorLock }>(`/api/launches/${encodeURIComponent(id)}/creator-lock/confirm`, json({ creator, signature })),
  creatorFeesClaimTransaction: (id: string, creator: string) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-fees/claim-transaction`, json({ creator })),
  upload: (body: FormData) => request<{ imageId: string; imageUrl: string }>("/api/uploads", { method: "POST", body }),
  createLaunch: (body: unknown) => request<LaunchIntentResponse>("/api/launches", json(body)),
  retryLaunchTransaction: (id: string, creator: string) => request<LaunchRetryResponse>(`/api/launches/${encodeURIComponent(id)}/retry-transaction`, json({ creator })),
  confirmLaunch: (id: string, signature: string) => request<LaunchConfirmation>(`/api/launches/${encodeURIComponent(id)}/confirm`, json({ signature })),
  validateBatchStep: (id: string, step: "pool" | "liquidity" | "lock", signedTransactionBase64: string) => request<BatchStepValidation>(`/api/launches/${encodeURIComponent(id)}/validate-batch-step`, json({ step, signedTransactionBase64 })),
  devBuyTransaction: (id: string, body: { trader: string; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/dev-buy-transaction`, json(body)),
  tradeQuote: (id: string, query: { side: "buy" | "sell"; buyCurrency: "PAIR" | "SOL"; amountRaw: string; slippageBps: number }, signal?: AbortSignal) => request<{ route: "orca" | "jupiter" | "jupiter_then_orca"; quote: Record<string, unknown> }>(`/api/launches/${encodeURIComponent(id)}/quote?${new URLSearchParams({ ...query, slippageBps: String(query.slippageBps) })}`, { signal }),
  tradeTransaction: (id: string, body: { trader: string; side: "buy" | "sell"; buyCurrency?: "PAIR" | "SOL"; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope & { quote?: Record<string, unknown>; minimumOutputRaw?: string; route?: "orca" | "jupiter" | "jupiter_then_orca"; inputSymbol?: string; outputSymbol?: string; followUp?: { buyCurrency: "PAIR"; amountRaw: string } }>(`/api/launches/${encodeURIComponent(id)}/trade-transaction`, json(body)),
  adminChallenge: (wallet: string) => request<{ challenge: string; message: string; expiresAt: number }>(`/api/admin/challenge?wallet=${encodeURIComponent(wallet)}`),
  adminSession: (body: { wallet: string; challenge: string; message: string; signature: string }) => request<{ token: string; expiresAt: number }>("/api/admin/session", json(body)),
  adminDiagnostics: (token: string, includeRuntime = false) => request<AdminDiagnostics>(`/api/admin/diagnostics?runtime=${includeRuntime}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(includeRuntime ? 90_000 : 30_000) }),
  adminWithdrawProposal: (token: string, id: string) => request<{ signature: string; destination: string; lamports: string }>(`/api/admin/proposals/${encodeURIComponent(id)}/withdraw`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  adminDexAccess: (token: string, id: string, managedByAqua: boolean, reference: string) => request<unknown>(`/api/admin/launches/${encodeURIComponent(id)}/dex-access`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ managedByAqua, reference }) }),
  adminMarkProposalPaid: (token: string, id: string, orderReference: string, managedByAqua = false) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/mark-paid`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ orderReference, managedByAqua }) }),
  adminCompleteProposal: (token: string, id: string, reference: string) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ reference }) }),
  adminResolveProposalChallenge: (token: string, id: string, uphold: boolean) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/resolve-challenge`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uphold }) }),
};
