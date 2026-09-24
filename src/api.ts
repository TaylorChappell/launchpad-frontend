import {readWithRetry} from "./read-retry";
import type { DexProfile, LaunchRelayStatus, SignedTransactionEnvelope } from "./types";
import {cachedRead,clearReadCache} from "./read-cache";
import type { WalletNotification, AdminDiagnostics, AnalyticsResponse, BatchStepValidation, CreatorLock, CreatorLockBalance, CreatorLockTransactionEnvelope, CumulativeRewardClaimConfirmation, CumulativeRewardClaimEnvelope, GovernanceMarket, GovernanceResponse, Launch, LaunchConfirmation, LaunchIntentResponse, LaunchRetryResponse, MarketGovernanceResponse, MarketProposalType, MarketSnapshot, RewardModeState, RuntimeConfig, StockOption, Trade, TransactionEnvelope, WalletRewardsResponse } from "./types";

import { resolveApiOrigin } from "./api-origin";
export const API_URL = resolveApiOrigin(import.meta.env.VITE_API_URL, window.AQUA_CONFIG?.API_URL);

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

export type AddressClaimMarket = { launchId: string; name: string; symbol: string; availableLamports: string; pendingLamports: string };
export type AddressClaimChallenge = { id: string; token: string; wallet: string; launchId: string; depositAddress: string; amountLamports: number; expiresAt: number };
const addressClaimAuth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function uncachedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
  const perform=async()=>{
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init, signal });
  const body = await response.json().catch(() => ({})) as T & { error?: string; code?: string; rebuildRequired?: boolean };
  if (!response.ok) throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status, body);
  return body;
  };
  return !init?.method||init.method==="GET"?readWithRetry(perform,signal):perform();
}

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const read=!init?.method||init.method==="GET";
  if(!read){const result=await uncachedRequest<T>(path,init);clearReadCache();return result;}
  if(init?.signal || new Headers(init?.headers).has("Authorization"))return uncachedRequest<T>(path,init);
  return cachedRead(path,()=>uncachedRequest<T>(path,init),path==="/api/stocks"?60_000:2000);
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  addressClaimLookup: (wallet: string) => uncachedRequest<{ wallet: string; claimsEnabled: boolean; markets: AddressClaimMarket[] }>(`/api/address-claims/${encodeURIComponent(wallet)}`),
  addressClaimStart: (wallet: string, launchId: string) => request<AddressClaimChallenge>("/api/address-claims/challenges", json({wallet,launchId})),
  addressClaimStatus: (id: string, token: string) => uncachedRequest<{ verified: boolean; signature: string | null; expiresAt: number; claimed: boolean }>(`/api/address-claims/challenges/${encodeURIComponent(id)}`,{headers:addressClaimAuth(token)}),
  addressClaimVerify: (id: string, token: string, signature: string) => request<{verified:boolean;signature:string}>(`/api/address-claims/challenges/${encodeURIComponent(id)}/verify`,{...json({signature}),headers:{"Content-Type":"application/json",...addressClaimAuth(token)}}),
  addressClaimPayout: (id: string, token: string) => request<{id:string;status:string;signature:string|null}>(`/api/address-claims/challenges/${encodeURIComponent(id)}/claim`,{...json({}),headers:{"Content-Type":"application/json",...addressClaimAuth(token)}}),
  showcase: (signal?:AbortSignal) => request<{enabled:boolean;launches:Launch[]}>("/api/showcase",{signal}),
  marketPrices: (signal?:AbortSignal) => request<{prices:import("./market-prices").MarketPrice[]}>("/api/market-prices",{signal}),
  notifications: (wallet: string) => request<{ notifications: WalletNotification[] }>(`/api/notifications/${encodeURIComponent(wallet)}`),
  config: () => request<RuntimeConfig>("/api/config"),
  analytics: () => request<AnalyticsResponse>("/api/analytics"),
  launches: (params: Record<string,string|number> = {}, signal?: AbortSignal) => request<{ launches: Launch[]; hasMore: boolean; nextOffset: number }>(`/api/launches?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}`, {signal}),
  holdings: (wallet: string) => request<{ holdings: Array<{launch:Launch;balanceRaw:string;balanceUpdatedAt:number;valueUsd:number|null}> }>(`/api/wallets/${encodeURIComponent(wallet)}/holdings`),
  position: (wallet:string,id:string) => request<{balanceRaw:string;balanceUpdatedAt:number|null;valueUsd:number|null;valueSol:number|null;quoteSymbol:string;note:string;pnl:{available:false;reason:string}|{available:true;quoteDecimals:number;costBasis:number;bought:number;sold:number;realized:number;unrealized:number|null;total:number|null;returnPercent:number|null}}>(`/api/wallets/${encodeURIComponent(wallet)}/positions/${encodeURIComponent(id)}`),
  holdingGovernance:(wallet:string)=>request<{proposals:Array<{id:string;launch_id:string;symbol:string;type:string;status:string;funded_usd_cents:string;target_usd_cents:string;withdrawn_lamports:string;withdrawal_signature:string|null;dex_order_reference:string|null;updated_at:number}>}>(`/api/wallets/${encodeURIComponent(wallet)}/governance`),
  claimHistory: (wallet: string) => request<{lifetime:Array<{stock_mint:string;symbol:string;decimals:number;amount_raw:string}>;hasMore:boolean;claims:Array<{launch_id:string;name:string;symbol:string;reward_symbol:string;stock_decimals:number;amount_raw:string;signature:string;claimed_at:number;kind:string}>}>(`/api/wallets/${encodeURIComponent(wallet)}/claim-history`),
  holders: (id: string, offset=0) => request<{summary:{total:string;top_ten:string;creator:string};holders:Array<{wallet:string;balance_raw:string;last_accrual_at:number;creator_wallet:string;indexed_total_raw:string}>;hasMore:boolean;note:string}>(`/api/launches/${encodeURIComponent(id)}/holders?offset=${offset}`),
  launch: (id: string) => request<{ launch: Launch; trades: Trade[]; tradesHasMore?: boolean; creatorLock: CreatorLock | null; rewardModeState: RewardModeState }>(`/api/launches/${encodeURIComponent(id)}`),
  trades: (id: string, offset: number, limit = 10, before?: Trade) => request<{ trades: Trade[]; hasMore: boolean }>(`/api/launches/${encodeURIComponent(id)}/trades?offset=${before?.block_time ? 0:offset}&limit=${limit}${before?.block_time ? "&before="+before.block_time+"&beforeId="+encodeURIComponent(before.id):""}`),
  marketData: (id: string, range = "24h") => request<{ snapshots: MarketSnapshot[] }>(`/api/launches/${encodeURIComponent(id)}/market-data?range=${encodeURIComponent(range)}`),
  search: (query: string, signal?: AbortSignal) => request<{ launches: Launch[] }>(`/api/search?q=${encodeURIComponent(query)}`, {signal}),
  stocks: () => request<{ stocks: StockOption[]; customPairsEnabled?: boolean; customPairWarning?: string }>("/api/stocks"),
  pairCatalog: (signal?: AbortSignal) => uncachedRequest<{ stocks: StockOption[]; refreshing?: boolean; retryAfterMs?: number; customPairsEnabled?: boolean; customPairWarning?: string; warning?: string }>("/api/stocks?progressive=true", { signal }),
  lookupPair: (mint: string, signal?: AbortSignal) => uncachedRequest<{ stock: StockOption }>(`/api/pairs/lookup?mint=${encodeURIComponent(mint)}`, { signal }),
  rewards: (wallet: string) => request<WalletRewardsResponse>(`/api/rewards/${encodeURIComponent(wallet)}`),
  governance: (wallet?: string | null, signal?: AbortSignal) => request<GovernanceResponse>(`/api/governance${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`, {signal}),
  governanceVoteChallenge: (wallet: string, targetMint: string) => request<{ challenge: string; message: string; expiresAt: number; market: GovernanceMarket }>("/api/governance/vote-challenge", json({ wallet, targetMint })),
  governanceVote: (body: { wallet: string; targetMint: string; challenge: string; message: string; signature: string }) => request<GovernanceResponse>("/api/governance/vote", json(body)),
  governanceUnboostChallenge: (wallet: string) => request<{ challenge: string; message: string; expiresAt: number }>("/api/governance/unboost-challenge", json({ wallet })),
  governanceUnboost: (body: { wallet: string; challenge: string; message: string; signature: string }) => request<GovernanceResponse>("/api/governance/unboost", json(body)),
  marketGovernance: (id: string, wallet?: string | null) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`),
  marketProposalChallenge: (id: string, body: { action: "create" | "vote" | "details" | "challenge" | "activity"; wallet: string; proposalId?: string; content: unknown }) => request<{ challenge: string; message: string; expiresAt: number }>(`/api/launches/${encodeURIComponent(id)}/proposals/challenge`, json(body)),
  createMarketProposal: (id: string, body: { wallet: string; type: MarketProposalType; payload: Record<string, unknown>; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals`, json(body)),
  voteMarketProposal: (id: string, proposalId: string, body: { wallet: string; choice: "yes" | "no" | "5" | "10" | "20"; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/vote`, json(body)),
  submitDexDetails: (id: string, proposalId: string, body: { wallet: string; details: Record<string, unknown>; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/details`, json(body)),
  submitDeveloperActivity: (id: string, proposalId: string, body: { wallet: string; activity: Record<string, unknown>; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/activity`, json(body)),
  challengeMarketProposal: (id: string, proposalId: string, body: { wallet: string; reason: string; challenge: string; message: string; signature: string }) => request<MarketGovernanceResponse>(`/api/launches/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/challenges`, json(body)),
  rewardClaim: (epochId: string, claimant: string) => request<TransactionEnvelope>(`/api/rewards/${encodeURIComponent(epochId)}/claim-transaction`, json({ claimant })),
  confirmRewardClaim: (epochId: string, claimant: string, signature: string) => request<{ claimed: true; signature: string }>(`/api/rewards/${encodeURIComponent(epochId)}/confirm`, json({ claimant, signature })),
  cumulativeRewardClaim: (launchId: string, claimant: string) => request<CumulativeRewardClaimEnvelope>(`/api/rewards/markets/${encodeURIComponent(launchId)}/claim-transaction`, json({ claimant })),
  confirmCumulativeRewardClaim: (launchId: string, claimant: string, signature: string, sequence: string) => request<CumulativeRewardClaimConfirmation>(`/api/rewards/markets/${encodeURIComponent(launchId)}/confirm`, json({ claimant, signature, sequence })),
  creatorFeeQuote: (amountRaw: string, totalSupplyRaw: string, durationSeconds: number, launchId?: string) => request<{ feeShareBps: number; estimatedLockedRaw?: string; estimatedTransferFeeRaw?: string; totalLockedRaw?: string; unlockAt?: number }>(`/api/creator-fee-quote?amountRaw=${encodeURIComponent(amountRaw)}&totalSupplyRaw=${encodeURIComponent(totalSupplyRaw)}&durationSeconds=${durationSeconds}${launchId ? `&launchId=${encodeURIComponent(launchId)}` : ""}`),
  creatorFeeSummary: (id: string, wallet: string) => uncachedRequest<import("./types").CreatorFeeSummary>(`/api/launches/${encodeURIComponent(id)}/creator-fees?wallet=${encodeURIComponent(wallet)}`),
  claimCreatorSol: (id: string, token: string, requestId: string) => request<{ id: string; status: "pending" | "paid"; signature: string | null }>(`/api/launches/${encodeURIComponent(id)}/creator-fees/claim`, { ...json({ requestId }), headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }),
  creatorLockBalance: (id: string, creator: string) => request<CreatorLockBalance>(`/api/launches/${encodeURIComponent(id)}/creator-lock/balance?creator=${encodeURIComponent(creator)}`),
  creatorLockTransaction: (id: string, creator: string, amountRaw: string, durationSeconds: number) => request<CreatorLockTransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-lock/transaction`, json({ creator, amountRaw, durationSeconds })),
  creatorLockReleaseTransaction: (id: string, creator: string) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/creator-lock/release-transaction`, json({ creator })),
  confirmCreatorLock: (id: string, creator: string, signature: string) => request<{ confirmed: true; creatorLock: CreatorLock }>(`/api/launches/${encodeURIComponent(id)}/creator-lock/confirm`, json({ creator, signature })),
  upload: (body: FormData, token: string) => request<{ imageId: string; imageUrl: string }>("/api/uploads", { method: "POST", body, headers: { Authorization: `Bearer ${token}` } }),
  createLaunch: (body: unknown) => request<LaunchIntentResponse>("/api/launches", json(body)),
  retryLaunchTransaction: (id: string, creator: string) => request<LaunchRetryResponse>(`/api/launches/${encodeURIComponent(id)}/retry-transaction`, json({ creator })),
  submitLaunchBatch: (id: string, transactions: SignedTransactionEnvelope[], signal?: AbortSignal) => request<LaunchRelayStatus>(`/api/launches/${encodeURIComponent(id)}/submit-batch`, { ...json({ transactions: transactions.map(({ step, signedTransactionBase64 }) => ({ step, signedTransactionBase64 })) }), signal }),
  launchSubmission: (id: string, signal?: AbortSignal) => uncachedRequest<LaunchRelayStatus>(`/api/launches/${encodeURIComponent(id)}/submission`, { signal }),
  launchDevBuyPlan: (id: string, creator: string) => request<LaunchConfirmation>(`/api/launches/${encodeURIComponent(id)}/dev-buy-plan`, json({ creator })),
  confirmLaunch: (id: string, signature: string) => request<LaunchConfirmation>(`/api/launches/${encodeURIComponent(id)}/confirm`, json({ signature })),
  validateBatchStep: (id: string, step: "pool" | "liquidity" | "lock", signedTransactionBase64: string) => request<BatchStepValidation>(`/api/launches/${encodeURIComponent(id)}/validate-batch-step`, json({ step, signedTransactionBase64 })),
  devBuyTransaction: (id: string, body: { trader: string; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope>(`/api/launches/${encodeURIComponent(id)}/dev-buy-transaction`, json(body)),
  tradeQuote: (id: string, query: { side: "buy" | "sell"; buyCurrency: "PAIR" | "SOL"; amountRaw: string; slippageBps: number }, signal?: AbortSignal) => request<{ route: "orca" | "jupiter" | "jupiter_then_orca"; quote: Record<string, unknown> }>(`/api/launches/${encodeURIComponent(id)}/quote?${new URLSearchParams({ ...query, slippageBps: String(query.slippageBps) })}`, { signal }),
  tradeTransaction: (id: string, body: { trader: string; side: "buy" | "sell"; buyCurrency?: "PAIR" | "SOL"; amountRaw: string; slippageBps: number }) => request<TransactionEnvelope & { quote?: Record<string, unknown>; minimumOutputRaw?: string; route?: "orca" | "jupiter" | "jupiter_then_orca"; inputSymbol?: string; outputSymbol?: string; followUp?: { buyCurrency: "PAIR"; amountRaw: string } }>(`/api/launches/${encodeURIComponent(id)}/trade-transaction`, json(body)),
  adminChallenge: (wallet: string) => request<{ challenge: string; message: string; expiresAt: number }>(`/api/admin/challenge?wallet=${encodeURIComponent(wallet)}`),
  adminSession: (body: { wallet: string; challenge: string; message: string; signature: string }) => request<{ token: string; expiresAt: number }>("/api/admin/session", json(body)),
  adminCommunityReports:(token:string,offset=0)=>request<{posts:import('./community-api').CommunityPost[];hasMore:boolean}>(`/api/admin/community-reports?offset=${offset}`,{headers:{Authorization:`Bearer ${token}`}}),
  adminModerateCommunity:(token:string,launchId:string,postId:string,action:'delete'|'dismiss')=>request<{ok:boolean}>(`/api/admin/community/${encodeURIComponent(launchId)}/${encodeURIComponent(postId)}`,{...json({action}),headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}}),
  adminDiagnostics: (token: string, includeRuntime = false) => request<AdminDiagnostics>(`/api/admin/diagnostics?runtime=${includeRuntime}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(includeRuntime ? 90_000 : 30_000) }),
  adminAutomaticDexDetails: (token: string, id: string, details: DexProfile) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/details`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(details) }),
  adminWithdrawProposal: (token: string, id: string) => request<{ signature: string; destination: string; lamports: string }>(`/api/admin/proposals/${encodeURIComponent(id)}/withdraw`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  adminDexAccess: (token: string, id: string, managedByAqua: boolean, reference: string) => request<unknown>(`/api/admin/launches/${encodeURIComponent(id)}/dex-access`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ managedByAqua, reference }) }),
  adminMarkProposalPaid: (token: string, id: string, orderReference: string, managedByAqua = false) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/mark-paid`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ orderReference, managedByAqua }) }),
  adminCompleteProposal: (token: string, id: string, reference: string) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ reference }) }),
  adminResolveProposalChallenge: (token: string, id: string, uphold: boolean) => request<unknown>(`/api/admin/proposals/${encodeURIComponent(id)}/resolve-challenge`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uphold }) }),
};
