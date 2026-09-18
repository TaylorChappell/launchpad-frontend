import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { activeCreatorLock, creatorLockPercentLabel, solscanAccountUrl } from "../creator-lock";
import { useRuntime } from "../context";
import type { Launch } from "../types";
import { RewardModeIcon } from "./RewardModeIcon";
import { DexScreenerIcon } from "./DexScreenerIcon";
import { launchAge } from "../time";

const compact = new Intl.NumberFormat("en-US", { notation:"compact", maximumFractionDigits:1 });

export function TokenMark({ launch, large=false }: { launch: Launch; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hue = [...launch.symbol].reduce((a,c) => a + c.charCodeAt(0), 0) % 55 + 175;
  useEffect(() => setImageFailed(false), [launch.imageUrl]);
  const showImage = Boolean(launch.imageUrl && !imageFailed);
  return <span className={"token-mark " + (large ? "large" : "")} style={!showImage ? { backgroundImage: "linear-gradient(145deg,hsl(" + hue + " 72% 47%),hsl(" + (hue + 38) + " 76% 18%))" } : undefined}>
    {showImage ? <img src={launch.imageUrl} alt="" onError={() => setImageFailed(true)}/> : launch.symbol.slice(0,2)}
  </span>;
}

export function AssetMark({ launch, reward = false }: { launch: Launch; reward?: boolean }) {
  const [failed, setFailed] = useState(false);
  const assetSymbol = reward ? launch.stockSymbol : launch.pairSymbol;
  const useSol = reward
    ? launch.stockSymbol.toUpperCase() === "SOL" || launch.stockMint === "So11111111111111111111111111111111111111112"
    : launch.pairType === "sol";
  const useOrca = assetSymbol.toUpperCase() === "ORCA";
  const logoUrl = useOrca ? `${import.meta.env.BASE_URL}orca-logo.png` : launch.stock.logoUrl;
  useEffect(() => setFailed(false), [logoUrl, reward, launch.pairType]);
  return <span className={`asset-mark ${useSol ? "solana" : useOrca ? "orca" : "stock"}`} aria-hidden="true">
    {useSol ? <svg viewBox="0 0 32 32"><defs><linearGradient id={"solana-" + launch.id + (reward ? "-reward" : "-pair")} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#9945ff"/><stop offset=".52" stopColor="#19fb9b"/><stop offset="1" stopColor="#00d1ff"/></linearGradient></defs><path fill={"url(#solana-" + launch.id + (reward ? "-reward" : "-pair") + ")"} d="M8 6h19l-3 4H5l3-4Zm-3 9h19l3 4H8l-3-4Zm3 9h19l-3 4H5l3-4Z"/></svg> : logoUrl && !failed ? <img src={logoUrl} alt="" onError={() => setFailed(true)}/> : <svg viewBox="0 0 32 32" className="generic-stock-mark"><path d="M6 25V14h5v11H6Zm8 0V7h5v18h-5Zm8 0V11h5v14h-5Z"/><path d="M4 27h24"/></svg>}
  </span>;
}

function marketCapTone(value: number) {
  if (value >= 1_000_000) return "cap-high";
  if (value >= 100_000) return "cap-warm";
  return "cap-normal";
}

export function TokenCard({ launch, featured = false, boosted = false }: { launch: Launch; sample?: boolean; featured?: boolean; boosted?: boolean }) {
  const { config } = useRuntime();
  const indexed = launch.aquaIndexed;
  const creatorLock = activeCreatorLock(launch.creatorLock);
  const creatorLockUrl = creatorLock ? solscanAccountUrl(creatorLock.vaultTokenAccount, config.network) : null;
  const rewardMode = launch.rewardMode ?? "holder_rewards";
  return <article className={`token-card ${featured ? "featured" : ""} ${boosted ? "boosted" : ""}`}>
    <Link className="token-card-link" to={"/token/" + launch.id}>
    <div className="token-head">
      <TokenMark launch={launch}/>
      <div><div className="token-title"><b>{launch.name}</b><span>{"$" + launch.symbol} / {launch.pairSymbol}</span></div><div className="token-pair"><AssetMark launch={launch}/>{launch.pairSymbol} market · {launchAge(launch.launchedAt, launch.createdAt).replace("Launched ", "")}</div></div>
      {boosted && <span className="boosted-market-badge"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 2.1 4.7L17 8.5l-3.7 3.3.9 5L10 14.2l-4.2 2.6.9-5L3 8.5l4.9-1.8L10 2Z"/></svg>Boosted</span>}

      <ArrowUpRight className="card-arrow" size={17}/>
    </div>
    {rewardMode === "holder_rewards" ? <div className="reward-card-focus"><span><RewardModeIcon mode="holder_rewards"/>HOLDER REWARD</span><strong>Earn {launch.stockSymbol}</strong><small>{"$" + compact.format(launch.rewardAccumulatedUsd)} accumulated · {"$" + compact.format(launch.rewardRedeemableUsd)} redeemable</small></div>
      : rewardMode === "buyback_burn" ? <div className="reward-card-focus mode-buyback"><span><RewardModeIcon mode="buyback_burn"/>BUYBACK &amp; BURN</span><strong>Buy. Burn. Reduce supply.</strong><small>The reward share buys this coin and permanently burns it.</small></div>
      : <div className="reward-card-focus mode-jackpot"><span><RewardModeIcon mode="jackpot"/>HOURLY JACKPOT</span><strong>5 holder winners</strong><small>50% · 20% · 20% · 5% · 5% every draw</small></div>}
    <div className="token-card-status">{launch.dexPaid && <span className="dex-paid-badge" title="DEX Screener profile paid" aria-label="DEX Screener profile paid"><DexScreenerIcon/></span>}</div><div className="token-stats"><Metric label="Market cap" value={indexed ? "$" + compact.format(launch.marketCapUsd) : "Indexing"} tone={indexed ? marketCapTone(launch.marketCapUsd) : ""}/><Metric label="24h volume" value={indexed ? "$" + compact.format(launch.volume24hUsd) : "Indexing"}/><Metric label="Holders" value={indexed ? compact.format(launch.holderCount) : "Indexing"}/></div>
    </Link>
    {creatorLock && creatorLockUrl && <div className="creator-lock-card"><span><i><LockKeyhole/></i><span><small>VERIFIED CREATOR LOCK</small><strong>{creatorLockPercentLabel(creatorLock)} locked</strong></span></span><a href={creatorLockUrl} target="_blank" rel="noreferrer">View lock <ExternalLink/></a></div>}
  </article>;
}

export function Metric({label,value,tone=""}:{label:string;value:string;tone?:string}) {
  return <div className="metric"><small>{label}</small><b className={tone}>{value}</b></div>;
}
