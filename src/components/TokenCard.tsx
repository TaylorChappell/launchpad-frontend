import { isPriceLive } from "../market-prices";
import { RecentUpdateBell } from "./RecentUpdateBell";
import { assetLogoUrl } from "../asset-logo";
import { useEffect, useState } from "react";
import { BadgeCheck, Flame, Gift, LockKeyhole, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { activeCreatorLock, creatorLockPercentLabel } from "../creator-lock";
import type { Launch } from "../types";
import { formatJackpotAmount } from "../jackpot-format";
import { launchAge } from "../time";

const compact = new Intl.NumberFormat("en-US", { notation:"compact", maximumFractionDigits:1 });

export function TokenMark({ launch, large=false }: { launch: Launch; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hue = [...launch.symbol].reduce((a,c) => a + c.charCodeAt(0), 0) % 55 + 175;
  useEffect(() => setImageFailed(false), [launch.imageUrl]);
  const showImage = Boolean(launch.imageUrl && !imageFailed);
  return <span className={"token-mark " + (large ? "large" : "")} style={!showImage ? { backgroundImage: "linear-gradient(145deg,hsl(" + hue + " 72% 47%),hsl(" + (hue + 38) + " 76% 18%))" } : undefined}>
    {showImage ? <img src={launch.imageUrl} alt="" loading={large?"eager":"lazy"} decoding="async" onError={() => setImageFailed(true)}/> : launch.symbol.slice(0,2)}
  </span>;
}

export function AssetMark({ launch, reward = false }: { launch: Launch; reward?: boolean }) {
  const [failed, setFailed] = useState(false);
  const useSol = reward
    ? launch.stockMint === "So11111111111111111111111111111111111111112"
    : launch.pairType === "sol";
  const useOrca = (reward ? launch.stockMint : launch.pairMint) === "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE";
  const logoUrl = useOrca ? `${import.meta.env.BASE_URL}orca-logo.png` : assetLogoUrl(reward ? launch.stock.logoUrl : launch.pairLogoUrl ?? launch.stock.logoUrl);
  useEffect(() => setFailed(false), [logoUrl, reward, launch.pairType]);
  return <span className={`asset-mark ${useSol ? "solana" : useOrca ? "orca" : "stock"}`} aria-hidden="true">
    {useSol ? <svg viewBox="0 0 32 32"><defs><linearGradient id={"solana-" + launch.id + (reward ? "-reward" : "-pair")} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#9945ff"/><stop offset=".52" stopColor="#19fb9b"/><stop offset="1" stopColor="#00d1ff"/></linearGradient></defs><path fill={"url(#solana-" + launch.id + (reward ? "-reward" : "-pair") + ")"} d="M8 6h19l-3 4H5l3-4Zm-3 9h19l3 4H8l-3-4Zm3 9h19l-3 4H5l3-4Z"/></svg> : logoUrl && !failed ? <img src={logoUrl} alt="" onError={() => setFailed(true)}/> : <svg viewBox="0 0 32 32" className="generic-stock-mark"><path d="M6 25V14h5v11H6Zm8 0V7h5v18h-5Zm8 0V11h5v14h-5Z"/><path d="M4 27h24"/></svg>}
  </span>;
}

export function TokenCard({ launch, featured = false, boosted = false }: { launch: Launch; sample?: boolean; featured?: boolean; boosted?: boolean }) {
  const indexed = launch.aquaIndexed;
  const mode = launch.rewardMode ?? "holder_rewards";
  const creatorLock = activeCreatorLock(launch.creatorLock);
  const reward = mode === "holder_rewards" ? `Earn ${launch.stockSymbol}` : mode === "buyback_burn" ? "Buyback & burn" : "Hourly jackpot";
  const total = mode === "holder_rewards" ? `$${compact.format(launch.rewardAccumulatedUsd)} rewarded` : mode === "buyback_burn" ? (launch.burnSummary ? `${compact.format(Number(launch.burnSummary.totalTokenRaw) / 10 ** launch.tokenDecimals)} burned` : "") : (launch.jackpotSummary ? `${formatJackpotAmount(launch.jackpotSummary.currentPotRaw,launch.jackpotSummary.rewardDecimals)} ${launch.jackpotSummary.rewardSymbol} pot` : "");
  return <article className={`token-card compact-token-card ${featured ? "featured" : ""} ${boosted ? "boosted" : ""}`}>
    <Link className="token-card-link" to={"/token/"+launch.id}>
      <div className="token-head"><TokenMark launch={launch}/><div className="compact-token-identity"><div className="token-title"><b>{launch.name}</b><span>${launch.symbol}</span></div><div className="token-pair"><AssetMark launch={launch}/><span>{launch.pairSymbol}</span><i>·</i><time>{launchAge(launch.launchedAt,launch.createdAt).replace("Launched ","")}</time>{boosted&&<Zap size={13} aria-label="Community boosted"/>}{creatorLock&&<LockKeyhole size={12} aria-label={`${creatorLockPercentLabel(creatorLock)} creator locked`}/>}</div></div></div>
      <div className="compact-card-metrics"><div><span>Market cap</span><strong>{indexed?"$"+compact.format(launch.marketCapUsd):"Indexing"}</strong>{indexed&&<small className={launch.change24h>=0?"positive":"negative"}>{launch.change24h>0?"+":""}{launch.change24h.toFixed(1)}%</small>}</div><div><span>24h volume</span><strong>{indexed?"$"+compact.format(launch.volume24hUsd):"—"}</strong></div></div>
      <div className="compact-card-reward"><span>{mode==="holder_rewards"?<Gift size={13}/>:mode==="buyback_burn"?<Flame size={13}/>:<Trophy size={13}/>}<b>{reward}</b></span><small>{total}</small>{launch.dexPaid&&<BadgeCheck size={15} aria-label="DEX profile paid"/>}</div>
      {indexed&&!isPriceLive(launch)&&<span className="compact-price-delayed" title="Price is delayed" aria-label="Price is delayed"/>}
    </Link>
    <RecentUpdateBell at={launch.latestProjectUpdateAt} launchId={launch.id}/>
  </article>;
}

export function Metric({label,value,tone=""}:{label:string;value:string;tone?:string}) {
  return <div className="metric"><small>{label}</small><b className={tone}>{value}</b></div>;
}

