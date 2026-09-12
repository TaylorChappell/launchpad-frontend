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
  whirlpools: { programId: string; config: string; tickSpacing: number; pair: string; liquidityLock: "permanent" };
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
  restricted: true;
  halted: false;
  marketOpen: boolean | null;
  supportsAtomicSwaps: boolean;
  stablecoins: Array<{ symbol: string; mint: string }>;
  orcaSupported: true;
  tokenBadge: string;
  whirlpoolsConfig: string;
  verifiedAt: number;
};

export type LaunchStatus = "mint_pending" | "pool_pending" | "liquidity_pending" | "live";

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
  stock: { symbol: string; name: string; mint: string; logoUrl: string | null; poolAddress: string | null };
  stockSymbol: string;
  stockName: string;
  stockMint: string;
  status: LaunchStatus;
  progress: number;
  marketCapUsd: number;
  priceUsd: number;
  volume24hUsd: number;
  change24h: number;
  holderCount: number;
  rewardVaultStockRaw: string;
  rewardDistributedUsd: number;
  devBuyStockRaw: string;
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
  positionMint?: string | null;
  positionAddress?: string | null;
  lockConfig?: string | null;
  liquidityLockedPermanently: boolean;
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

export type LaunchIntentResponse = TransactionEnvelope & {
  launchId: string;
  step: "mint";
  mint: string;
  market: string;
  next: string;
};

export type LaunchRetryResponse = TransactionEnvelope & {
  launchId: string;
  step: "pool" | "liquidity" | "lock";
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
  creatorLockWizard?: string;
};
