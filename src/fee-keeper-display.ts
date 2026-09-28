export function keeperAmount(value: string | null | undefined, decimals = 9, places = 6): string {
  if (value == null || !/^\d+$/.test(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return "—";
  const raw = BigInt(value), scale = 10n ** BigInt(decimals);
  const precision = Math.min(decimals, Math.max(0, places));
  const fraction = (raw % scale).toString().padStart(decimals, "0").slice(0, precision).replace(/0+$/, "");
  if (raw > 0n && raw < scale && !fraction) return `<${precision ? `0.${"0".repeat(precision - 1)}1` : "1"}`;
  return `${(raw / scale).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export function keeperUsd(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export type KeeperRange = "1h" | "24h" | "7d" | "max";
export type KeeperPolicy = { maxImpactBps?: number; mode?: string; buyBudgetApplied?: boolean; quote?: {
  observedAt: number; grossRaw: string; inputRaw: string; estimatedSolLamports: string;
  estimatedUsdCents: string; impactBps: number;
} };
export type KeeperStep = {
  step: string; signature: string; status: string; bytes: number | null;
  feeLamports: string | null; createdAt: number | null; updatedAt: number | null;
};
export type KeeperConversion = {
  id: string; launchId: string; symbol: string; name: string; decimals: number; status: string; route: string | null;
  grossRaw: string; inputRaw: string | null; inputLossRaw: string; solLamports: string | null;
  createdAt: number; updatedAt: number; soldAt: number | null; estimatedSaleTime: boolean; error: string | null;
  slicePolicy: KeeperPolicy | null; withdrawSignature: string | null; poolSignature: string | null;
  swapSignature: string | null; payoutSignature: string | null; stepCount: number; steps: KeeperStep[];
};
export type KeeperMarket = {
  launchId: string; symbol: string; name: string; mint: string; decimals: number; vaultRaw: string; vaultUsd: number | null;
  indexedAt: number | null; status: string | null; stage: string | null; message: string | null;
  lastAttemptAt: number | null; lastSuccessAt: number | null; batchBudgetRaw: string | null; batchRemainingRaw: string | null;
  nextSliceAt: number | null; pacing: { status?: string; observedAt?: number; backlogUsd?: number; sliceUsd?: number;
    impactBps?: number; estimatedClearAt?: number; targetClearAt?: number;
    catchup?: {mode?: string; reason?: string; behind?: boolean; participationBps?: number; buyBudgetRaw?: string} } | null;
  backlogRaw?: string; backlogUsd?: number | null; incomingHourUsd?: number | null; convertedHourUsd?: number | null; estimatedClearAt?: number | null;
  conversionId: string | null; conversionStatus: string | null; plannedRaw: string | null; plannedCurrentUsd: number | null;
  slicePolicy: KeeperPolicy | null; conversionError: string | null;
};
export type AdminFeeKeeperResponse = {
  generatedAt: number; range: KeeperRange; search: string;
  settings: { enabled: boolean; conversionEnabled: boolean; slicingEnabled: boolean; intervalMs: number;
    conversionIntervalMs?: number; catchupEnabled?: boolean; buyParticipationBps?: number;
    minimumUsd: number; preferredSliceUsd: number; clearHours: number; maxImpactBps: number; slippageBps: number };
  summary: { lastSaleAt?:number|null; markets: number; active: number; blocked: number; lastAttemptAt: number | null;
    throughput?: {backlogUsd: number | null; incomingHourUsd: number | null; convertedHourUsd: number | null; catchupMarkets: number; unknownPrices: number};
    sales: { count: number; solLamports: string; averageLamports: string; largestLamports: string; estimatedTimeCount: number };
    transactions: { confirmed: number; feeLamports: string; missingFeeCount: number } };
  queue: KeeperMarket[]; queueLimit: number; history: KeeperConversion[];
  total: number; offset: number; limit: number; hasMore: boolean;
};

export function keeperSteps(conversion: KeeperConversion): KeeperStep[] {
  const steps = [...conversion.steps];
  const seen = new Set(steps.map(step => step.signature));
  for (const [step, signature] of [["withdraw", conversion.withdrawSignature], ["pool", conversion.poolSignature],
    ["swap", conversion.swapSignature], ["payout", conversion.payoutSignature]] as const) {
    if (signature && !seen.has(signature)) {
      steps.push({ step, signature, status: "recorded", bytes: null, feeLamports: null, createdAt: null, updatedAt: null });
      seen.add(signature);
    }
  }
  return steps.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

// This describes recorded activity, not a separate daemon's process health.
export function keeperHealth(data: AdminFeeKeeperResponse) {
  const last=data.summary.lastAttemptAt;
  if(!last||data.generatedAt-last>Math.max(180_000,data.settings.intervalMs*3))return {label:"Stale",tone:"stale",message:"No recent keeper update. Check the keeper service and its connection."};
  if(data.summary.blocked>0)return {label:"Needs attention",tone:"blocked",message:`${data.summary.blocked} market${data.summary.blocked===1?"":"s"} blocked. Open the affected row for the reason.`};
  if(data.summary.active>0)return {label:"Running",tone:"running",message:`${data.summary.active} conversion${data.summary.active===1?"":"s"} in progress. Review the queue for the next step.`};
  return {label:"Waiting",tone:"waiting",message:"Recent checks recorded. Markets may be waiting for enough fees, buying activity or a safe quote."};
}
