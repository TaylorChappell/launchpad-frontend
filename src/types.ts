export type RuntimeConfig = {
  brand: "AQUA";
  useTestnet: boolean;
  network: "devnet" | "mainnet-beta";
  publicRpcUrl: string;
  aquaProgramId: string | null;
  programId: string | null;
  programInitialized?: boolean;
  transactionsEnabled: boolean;
  transactionsDisabledReason?: string | null;
  whirlpools: { programId: string; config: string; tickSpacing: number; pair: string; supportedPairs?: Array<"SOL" | "STOCK">; liquidityLock: "permanent" };
  stockEligibility?: { minOrcaTvlUsd: number; minOrcaVolume24hUsd: number; requiresLivePool: boolean };
  fees: { transferFeeBps: number; platformBps: number; stockRewardsBps: number; universal: boolean };
  creatorLocks: { minimumSeconds: number; maximumSeconds: number; maximumFeeShareBps: number };
  sniperDefense: { supported: false; reason: string };
};

export type StockOption = {
  symbol: string;
  underlyingSymbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUrl: string | null;
  isin: string | null;
  accent: string;
  restricted: boolean;
  halted: false;
  marketOpen: boolean | null;
  supportsAtomicSwaps: boolean;
  stablecoins: Array<{ symbol: string; mint: string }>;
  orcaSupported: true;
  tokenBadge: string;
  whirlpoolsConfig: string;
  referencePoolAddress: string | null;
  referencePairSymbol: string | null;
  orcaTvlUsd: number;
  orcaVolume24hUsd: number;
  verifiedAt: number;
};

export type LaunchStatus = "mint_pending" | "pool_pending" | "liquidity_pending" | "live";
export type IndexingStatus = "pending_indexing" | "orca_indexed" | "indexed";

export type Launch = {
  id: string;
  mint: string;
  bondingCurve: string;
  creatorWallet: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  metadataUri: string;
  stock: { symbol: string; name: string; mint: string; logoUrl: string | null; poolAddress: string | null; referenceTvlUsd?: number; referenceVolume24hUsd?: number };
  stockSymbol: string;
  stockName: string;
  stockMint: string;
  pairType: "sol" | "stock";
  pairSymbol: string;
  pairMint: string;
  tradingPair: { type: "sol" | "stock"; symbol: string; mint: string };
  pairVerified?: boolean;
  pairVerifiedAt?: number | null;
  status: LaunchStatus;
  progress: number;
  marketCapUsd: number;
  fdvUsd: number;
  tvlUsd: number;
  priceUsd: number;
  volume24hUsd: number;
  change24h: number;
  holderCount: number;
  rewardVaultStockRaw: string;
  rewardDistributedUsd: number;
  devBuyStockRaw: string;
  devBuySol: number;
  txCount: number;
  xUrl?: string | null;
  websiteUrl?: string | null;
  telegramUrl?: string | null;
  launchSignature?: string | null;
  whirlpoolAddress?: string | null;
  tokenBadge?: string | null;
  whirlpoolsConfig?: string | null;
  tickSpacing: number;
  initialPrice: number;
  curveEndPrice: number;
  transferFeeBps: number;
  tokenDecimals: number;
  totalSupplyRaw: string;
  liquiditySupplyRaw: string;
  reserveSupplyRaw?: string;
  supplyReserveAddress?: string | null;
  devBuyCurrency?: "SOL" | "USDC";
  devBuyAmountRaw?: string;
  positionMint?: string | null;
  positionAddress?: string | null;
  lockConfig?: string | null;
  liquidityLockedPermanently: boolean;
  poolActive: boolean;
  poolLiquidityRaw: string;
  positionLiquidityRaw: string;
  indexingStatus: IndexingStatus;
  aquaIndexed: boolean;
  orcaIndexed: boolean;
  externalIndexed: boolean;
  lastIndexedAt: number | null;
  creatorFeesAccruedRaw: string;
  rewardFeesAccruedRaw: string;
  buybackFeesAccruedRaw: string;
  treasuryFeesAccruedRaw: string;
  launchedAt: number | null;
  createdAt: number;
};

export type Trade = {
  id: string;
  wallet: string;
  side: "buy" | "sell";
  gross_quote_raw?: string;
  token_amount_raw?: string;
  price_usd_cents?: number;
  created_at?: number;
};

export type MarketSnapshot = {
  sampledAt: number;
  priceUsd: number;
  fdvUsd: number;
  tvlUsd: number;
  volume24hUsd: number;
  holderCount: number;
  txCount: number;
};

export type WalletReward = {
  epochId: string;
  launchId: string;
  stockSymbol: string;
  stockMint: string;
  stockDecimals: number;
  status: string;
  startsAt: number;
  endsAt: number;
  merkleRootHex: string;
  amountRaw: string;
  weightRawSeconds: string;
  proofHex: string[];
  claimedSignature: string | null;
};

export type TransactionEnvelope = {
  transactionBase64: string;
  transactionVersion: "legacy" | 0;
  recentBlockhash?: string;
  lastValidBlockHeight: number;
};

export type LaunchBatchEnvelope = TransactionEnvelope & { step: "pool" | "liquidity" | "lock" };
export type SignedTransactionEnvelope = LaunchBatchEnvelope & { signedTransactionBase64: string };
export type BatchStepValidation = { ready: true; step: "pool" | "liquidity" | "lock"; alreadyConfirmed?: boolean; confirmationRecorded?: boolean; signature?: string };

export type LaunchIntentResponse = TransactionEnvelope & {
  launchId: string;
  step: "mint";
  mint: string;
  market: string;
  next: string;
};

export type LaunchRetryResponse = Partial<TransactionEnvelope> & {
  launchId: string;
  step?: "pool" | "liquidity" | "lock";
  status?: "live";
  whirlpoolAddress?: string;
  positionMint?: string;
  liquidityLockedPermanently?: boolean;
  batch?: LaunchBatchEnvelope[];
};

export type LaunchConfirmation = Partial<TransactionEnvelope> & {
  confirmed: true;
  launchId: string;
  completedStep?: "mint" | "pool" | "liquidity";
  nextStep?: "pool" | "liquidity" | "lock";
  status?: "live";
  whirlpoolAddress?: string;
  positionMint?: string;
  liquidityLockedPermanently?: boolean;
  devBuyStockRaw?: string;
  devBuy?: (TransactionEnvelope & { quote?: Record<string, unknown> }) | null;
  mint?: string;
  devBuyCurrency?: "SOL" | "USDC";
  devBuyAmountRaw?: string;
  devBuyPlan?: { currency: "SOL" | "USDC"; transactions: Array<TransactionEnvelope & { kind: "conversion" | "buy"; label: string }>; buyAmountRaw?: string | null } | null;
  devBuyError?: string | null;
  creatorLockWizard?: string;
  batch?: LaunchBatchEnvelope[];
  indexingStatus?: IndexingStatus;
  lockReady?: boolean;
};
