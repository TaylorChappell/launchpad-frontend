export type RuntimeConfig = {
  brand: "AQUA";
  useTestnet: boolean;
  network: "devnet" | "mainnet-beta";
  publicRpcUrl: string;
  aquaProgramId: string | null;
  programId: string | null;
  adminWallet?: string;
  programInitialized?: boolean;
  transactionsEnabled: boolean;
  transactionsDisabledReason?: string | null;
  whirlpools: { programId: string; config: string; tickSpacing: number; pair: string; supportedPairs?: Array<"SOL" | "STOCK">; liquidityLock: "permanent" };
  stockEligibility?: { minOrcaTvlUsd: number; minOrcaVolume24hUsd: number; requiresLivePool: boolean };
  launchEconomics?: {
    tokenSupply: string;
    tokenDecimals: number;
    liquiditySupplyBps: number;
    reserveSupplyBps: number;
    reserveCustody: string | null;
    startMarketCapUsd: number;
    liquidityUpperBound: string;
  };
  launchCost?: {
    platformFeeLamports: string;
    platformFeeSol: number;
    operationalDestination: string;
    estimatedNetworkAndRentSol: { minimum: number; maximum: number };
    estimatedTotalSol: { minimum: number; maximum: number };
    excludesOptionalInitialBuy: boolean;
  };
  fees: {
    transferFeeBps: number;
    platformBps: number;
    stockRewardsBps: number;
    universal: boolean;
    allocationWithoutCreatorLockBps?: { rewardsBps: number; buybackBps: number; treasuryBps: number; creatorBps: number };
    platformAllocationAtMaximumCreatorScore?: { treasuryBps: number; buybackBps: number; creatorBps: number };
  };
  rewardDistribution?: {
    enabled: boolean;
    epochSeconds: number;
    minimumRewardUsdCents: number;
    minimumClaimUsdCents: number;
    claimFeeBaseLamports: number;
    claimFeePerEpochLamports: number;
    swapSlippageBps: number;
    claimableOnchain: boolean;
  };
  creatorLocks: { minimumSeconds: number; maximumSeconds: number; maximumFeeShareBps: number; targetSupplyBps?: number; initialLiquidityExcluded?: boolean };
  sniperDefense: { supported: false; reason: string };
};

export type AdminDiagnostics = {
  generatedAt: number;
  flags: {
    feeKeeperEnabled: boolean;
    solFeeConversionEnabled: boolean;
    rewardDistributionEnabled: boolean;
    conversionMinimumUsdCents: number;
    conversionSlippageBps: number;
    rewardEpochSeconds: number;
    rewardMinimumUsdCents: number;
    keeperIntervalMs: number;
  };
  counts: Record<string, number>;
  runtime: {
    available: boolean;
    reason?: string;
    operator?: string;
    rewardOperator?: string;
    programId?: string;
    destinations?: { treasury: string; rewardBuyer: string; buybackBuyer: string; feeKeeper: string };
    balances?: { nativeLamports: string; rewardNativeLamports: string; wrappedSolLamports: string; reservedRewardLamports: string };
    markets?: Array<Record<string, unknown>>;
  };
  launches: Array<Record<string, unknown>>;
  diagnostics: Array<Record<string, unknown>>;
  conversions: Array<Record<string, unknown>>;
  settlements: Array<Record<string, unknown>>;
  rewardPurchases: Array<Record<string, unknown>>;
  rewardEpochs: Array<Record<string, unknown>>;
  creatorLocks: Array<Record<string, unknown>>;
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
  rewardAccumulatedUsd: number;
  rewardRedeemableUsd: number;
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
  marketCapUsd?: number;
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
  amountUsdCents: number;
  weightRawSeconds: string;
  proofHex: string[];
  claimedSignature: string | null;
};

export type WalletRewardHolding = {
  launchId: string;
  balanceRaw: string;
};

export type WalletRewardMarket = {
  launchId: string;
  balanceRaw: string;
  claimableEpochIds: string[];
  grossRedeemableUsdCents: number;
  pendingUsdCents: number;
  estimatedClaimFeeLamports: string;
  estimatedClaimFeeUsdCents: number;
  netClaimableUsdCents: number;
  minimumClaimUsdCents: number;
  canClaim: boolean;
  claimableUsdCents: number;
  accumulatingUsdCents: number;
};

export type WalletRewardsResponse = {
  rewards: WalletReward[];
  holdings: WalletRewardHolding[];
  markets: WalletRewardMarket[];
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

export type CreatorLock = {
  launchId: string;
  lockPda: string;
  vaultTokenAccount: string;
  creatorWallet: string;
  amountRaw: string;
  totalSupplyRaw: string;
  lockedAt: number;
  unlockAt: number;
  feeShareBps: number;
  status: "active" | "released";
  lockSignature: string;
  releaseSignature: string | null;
  updatedAt: number;
};

export type CreatorLockTransactionEnvelope = TransactionEnvelope & { feeShareBps: number };
