import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Copy, ExternalLink, Info, LockKeyhole } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useRuntime } from "../context";
import { solscanAccountUrl } from "../creator-lock";
import type { CreatorLock, Launch } from "../types";
import { MarketSocialLinks } from "./MarketSocialLinks";
import { CoinSettings } from "./CoinSettings";
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
    <CoinSettings key={launch.id} launch={launch}/>
    {open && <MarketSheet launch={launch} title="Market details" closeLabel="Close details" onClose={close}>
      <div className="market-details-content">
        {(launch.description || launch.xUrl || launch.websiteUrl || launch.telegramUrl) && <section className="market-details-about">
          {launch.description && <p>{launch.description}</p>}
          <MarketSocialLinks launch={launch}/>
        </section>}
        <div className="market-details-metrics">
          <Metric label="Market cap" value={launch.aquaIndexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/>
          <Metric label="Liquidity" value={launch.aquaIndexed ? `$${compact.format(launch.tvlUsd)}` : "Indexing"}/>
          <Metric label="Holders" value={launch.holderCount.toLocaleString()}/>
        </div>
        <dl className="market-details-facts">
          <div><dt>Trading pair</dt><dd>{launch.symbol} / {launch.pairSymbol}</dd></div>
          <div><dt>{mode === "buyback_burn" ? "Burn asset" : mode === "jackpot" ? "Prize asset" : "Reward asset"}</dt><dd>{mode === "buyback_burn" ? launch.symbol : mode === "jackpot" ? "SOL" : launch.stockSymbol}</dd></div>
          <div><dt>Creator</dt><dd><WalletIdentity wallet={launch.creatorWallet}/></dd></div>
          <div><dt>Developer buy</dt><dd>{developerBuy}</dd></div>
        </dl>
        <dl className="market-details-locks">
          <div><dt><LockKeyhole size={14} aria-hidden="true"/>LP lock</dt><dd><span className={launch.liquidityLockedPermanently ? "verified-lock" : ""}>{launch.liquidityLockedPermanently ? "Permanently locked" : "Not verified"}</span>{launch.lockConfig && <a href={solscanAccountUrl(launch.lockConfig, config.network)} target="_blank" rel="noreferrer" aria-label="Verify LP lock" title="Verify LP lock"><ExternalLink size={14}/></a>}</dd></div>
          <div><dt>Creator lock</dt><dd>{creatorLock?.status === "active" ? `Until ${new Date(creatorLock.unlockAt * 1000).toLocaleString()}` : "None verified"}</dd></div>
        </dl>
        {!launch.showcase && <>
          <div className="market-mint"><div><small>Token mint</small><code title={launch.mint}>{launch.mint.slice(0, 8)}…{launch.mint.slice(-6)}</code></div><button aria-label="Copy token mint" title="Copy full token mint" onClick={() => { void navigator.clipboard.writeText(launch.mint).then(() => toast.success("Mint copied"), () => toast.error("Clipboard unavailable")); }}><Copy size={17}/></button></div>
          <details className="market-chain-details"><summary>On-chain details<ChevronDown size={16}/></summary>
            <code className="market-full-mint">{launch.mint}</code>
            <div className="market-details-links">
              <a href={solscanAccountUrl(launch.mint, config.network)} target="_blank" rel="noreferrer">Inspect mint <ExternalLink size={13}/></a>
              <a href={solscanAccountUrl(launch.whirlpoolAddress || launch.mint, config.network)} target="_blank" rel="noreferrer">Pool explorer <ExternalLink size={13}/></a>
              {launch.marketPolicyAddress && <a href={solscanAccountUrl(launch.marketPolicyAddress, config.network)} target="_blank" rel="noreferrer">Mode policy <ExternalLink size={13}/></a>}
            </div><p className="market-details-note">DEX profile payment is not an endorsement or security assessment.</p>
          </details>
        </>}
      </div>
    </MarketSheet>}
  </>;
}
