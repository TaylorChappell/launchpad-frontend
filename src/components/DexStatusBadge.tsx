import { DexScreenerIcon } from "./DexScreenerIcon";
import { dexBadgeState } from "../dex-status";

const states = {
  vote: { label: "DEX vote", title: "Holders are voting on a DEX Screener proposal" },
  funding: { label: "DEX funding", title: "Market rewards are accumulating toward the DEX Screener funding target" },
  funded: { label: "DEX funded", title: "DEX funding target reached; profile payment is awaiting confirmation" },
  paid: { label: "DEX paid", title: "DEX Screener profile paid, not an endorsement or security verification" },
};

export function DexStatusBadge({ state }: { state: ReturnType<typeof dexBadgeState> }) {
  if (!state) return null;
  const { label, title } = states[state];
  return <span className={`dex-status-badge is-${state}`} title={title}><DexScreenerIcon/><span>{label}</span></span>;
}
