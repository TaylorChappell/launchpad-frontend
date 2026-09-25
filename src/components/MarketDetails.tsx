import { useEffect, useState } from "react";
import { ChevronRight, Copy, ExternalLink, Globe2, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useRuntime } from "../context";
import { solscanAccountUrl } from "../creator-lock";
import type { CreatorLock, Launch } from "../types";
import { MarketSheet } from "./MarketSheet";
import { Metric } from "./TokenCard";
import { WalletIdentity } from "./WalletIdentity";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });

export function MarketDetails({ launch, creatorLock, developerBuy }: {
  launch: Launch; creatorLock: CreatorLock | null; developerBuy: string;
}) {
  const { config } = useRuntime();
  const [params, setParams] = useSearchParams();
  const legacyTab = params.get("tab");
  const [open, setOpen] = useState(() => legacyTab === "project");
  useEffect(() => { setOpen(legacyTab === "project"); }, [launch.id, legacyTab]);
  const close = () => {
    setOpen(false);
    if (legacyTab === "project") setParams(previous => {
      const next = new URLSearchParams(previous); next.set("tab", "transactions"); return next;
    }, { replace: true });
  };
  const mode = launch.rewardMode ?? "holder_rewards";
  return <>
    <button className="market-more-details" aria-haspopup="dialog" onClick={() => setOpen(true)}><Info size={18}/><span>More details</span><ChevronRight size={18}/></button>
    {open && <MarketSheet launch={launch} title="Market details" closeLabel="Close details" onClose={close}>
      <div className="market-details-content">
        <section className="market-details-about"><h3>About {launch.name}</h3><p>{launch.description || "This market has no description yet."}</p>
          {(launch.xUrl || launch.websiteUrl) && <div className="market-details-links">{launch.xUrl && <a href={launch.xUrl} target="_blank" rel="noreferrer">X <ExternalLink size={14}/></a>}{launch.websiteUrl && <a href={launch.websiteUrl} target="_blank" rel="noreferrer"><Globe2 size={15}/>Website <ExternalLink size={14}/></a>}</div>}
        </section>
        <section><h3>Market overview</h3><div className="market-details-metrics">
          <Metric label="Market cap" value={launch.aquaIndexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/>
          <Metric label="Liquidity" value={launch.aquaIndexed ? `$${compact.format(launch.tvlUsd)}` : "Indexing"}/>
          <Metric label="Trading pair" value={`${launch.symbol} / ${launch.pairSymbol}`}/>
          <Metric label={mode === "buyback_burn" ? "Burn asset" : mode === "jackpot" ? "Prize asset" : "Reward asset"} value={mode === "buyback_burn" ? launch.symbol : mode === "jackpot" ? "SOL" : launch.stockSymbol}/>
        </div><dl className="market-details-facts">
          <div><dt>Holders</dt><dd>{launch.holderCount.toLocaleString()}</dd></div>
          <div><dt>Creator</dt><dd><WalletIdentity wallet={launch.creatorWallet}/></dd></div>
          <div><dt>Developer buy</dt><dd>{developerBuy}</dd></div>
        </dl></section>
        <section><h3>Locks &amp; verification</h3><dl className="market-details-facts">
          <div><dt>Opening LP lock</dt><dd>{launch.liquidityLockedPermanently ? "Permanently locked" : "Not verified"}</dd></div>
          <div><dt>Creator token lock</dt><dd>{creatorLock?.status === "active" ? `Active until ${new Date(creatorLock.unlockAt * 1000).toLocaleString()}` : "No active verified lock"}</dd></div>
        </dl><div className="market-details-links">
          {launch.lockConfig && <a href={solscanAccountUrl(launch.lockConfig, config.network)} target="_blank" rel="noreferrer">Verify LP lock <ExternalLink size={14}/></a>}
          {launch.marketPolicyAddress && <a href={solscanAccountUrl(launch.marketPolicyAddress, config.network)} target="_blank" rel="noreferrer">Mode policy <ExternalLink size={14}/></a>}
        </div><p className="market-details-note">DEX profile payment is not an endorsement or security assessment.</p></section>
        {!launch.showcase && <section><h3>On-chain details</h3><div className="market-mint"><small>Token mint</small><code>{launch.mint}</code><button aria-label="Copy token mint" onClick={() => { void navigator.clipboard.writeText(launch.mint).then(() => toast.success("Mint copied"), () => toast.error("Clipboard unavailable")); }}><Copy size={17}/></button></div><div className="market-details-links">
          <a href={solscanAccountUrl(launch.mint, config.network)} target="_blank" rel="noreferrer">Inspect mint <ExternalLink size={14}/></a>
          <a href={solscanAccountUrl(launch.whirlpoolAddress || launch.mint, config.network)} target="_blank" rel="noreferrer">Pool explorer <ExternalLink size={14}/></a>
        </div></section>}
      </div>
    </MarketSheet>}
  </>;
}
