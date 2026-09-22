import type { Launch, MarketGovernanceResponse } from "./types";

export function dexBadgeState(launch: Pick<Launch, "dexPaid" | "dexFundingStatus">, governance?: Pick<MarketGovernanceResponse, "dexPaid" | "proposals"> | null) {
  if (governance?.dexPaid || launch.dexPaid) return "paid";
  const statuses = governance
    ? governance.proposals.filter(p => p.type === "dex_payment" || p.type === "dex_update").map(p => p.status)
    : [launch.dexFundingStatus];
  if (statuses.some(status => status === "ready" || status === "withdrawing" || status === "withdrawn")) return "funded";
  if (statuses.includes("funding")) return "funding";
  if (statuses.includes("voting")) return "vote";
  return null;
}
