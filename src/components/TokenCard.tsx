import { MarketSocialLinks } from "./MarketSocialLinks";
import { RecentUpdateBell } from "./RecentUpdateBell";
import { assetLogoUrl } from "../asset-logo";
import { useEffect, useId, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { activeCreatorLock, creatorLockPercentLabel } from "../creator-lock";
import type { Launch } from "../types";
import { DexStatusBadge } from "./DexStatusBadge";
import { dexBadgeState } from "../dex-status";
import { cardAmount, cardJackpotTop, cardRawAmount } from "../market-card";
import { MarketCardTrend } from "./MarketCardTrend";
import { RewardModeIcon } from "./RewardModeIcon";
import { launchAge } from "../time";

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
  const gradient = useId().replaceAll(":", "");
  const useSol = reward
    ? launch.stockMint === "So11111111111111111111111111111111111111112"
    : launch.pairType === "sol";
  const useOrca = (reward ? launch.stockMint : launch.pairMint) === "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE";
  const logoUrl = useOrca ? `${import.meta.env.BASE_URL}orca-logo.png` : assetLogoUrl(reward ? launch.stock?.logoUrl : launch.pairLogoUrl ?? (launch.pairMint === launch.stockMint ? launch.stock?.logoUrl : null));
  useEffect(() => setFailed(false), [logoUrl, reward, launch.pairType]);
  return <span className={`asset-mark ${useSol ? "solana" : useOrca ? "orca" : "stock"}`} aria-hidden="true">
    {useSol ? <svg viewBox="0 0 32 32"><defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#9945ff"/><stop offset=".52" stopColor="#19fb9b"/><stop offset="1" stopColor="#00d1ff"/></linearGradient></defs><path fill={`url(#${gradient})`} d="M8 6h19l-3 4H5l3-4Zm-3 9h19l3 4H8l-3-4Zm3 9h19l-3 4H5l3-4Z"/></svg> : logoUrl && !failed ? <img src={logoUrl} alt="" onError={() => setFailed(true)}/> : <svg viewBox="0 0 32 32" className="generic-stock-mark"><path d="M6 25V14h5v11H6Zm8 0V7h5v18h-5Zm8 0V11h5v14h-5Z"/><path d="M4 27h24"/></svg>}
  </span>;
}

function CardRewards({ launch }: { launch: Launch }) {
  const mode = launch.rewardMode ?? "holder_rewards";
  const jackpot = launch.jackpotSummary;
  const rewardSymbol = jackpot?.rewardSymbol ?? "SOL";
  const title = mode === "buyback_burn" ? `Burn ${launch.symbol}` : mode === "jackpot" ? `Win ${rewardSymbol}` : `Earn ${launch.stockSymbol}`;
  const stats = mode === "buyback_burn"
    ? [{ label: "SOL spent", value: cardAmount(launch.burnSummary?.totalSol) }, { label: `${launch.symbol} burned`, value: cardRawAmount(launch.burnSummary?.totalTokenRaw, launch.tokenDecimals) }]
    : mode === "jackpot"
    ? [{ label: `Pool · ${rewardSymbol}`, value: cardRawAmount(jackpot?.currentPotRaw, jackpot?.rewardDecimals ?? 9) }, { label: `1st prize · ${rewardSymbol}`, value: cardRawAmount(cardJackpotTop(jackpot?.currentPotRaw), jackpot?.rewardDecimals ?? 9) }]
    : [{ label: "Accumulated", value: cardAmount(launch.rewardAccumulatedUsd, true) }, { label: "Redeemable", value: cardAmount(launch.rewardRedeemableUsd, true) }];
  return <div className={`reward-card-focus card-reward-strip ${mode === "buyback_burn" ? "mode-buyback" : mode === "jackpot" ? "mode-jackpot" : ""}`}>
    <div className="card-reward-heading"><RewardModeIcon mode={mode}/><div><span>{mode === "buyback_burn" ? "BUYBACK & BURN" : mode === "jackpot" ? "HOURLY JACKPOT" : "HOLDER REWARDS"}</span><strong title={title}>{title}</strong></div></div>
    <dl className="card-reward-stats">{stats.map(stat => <div key={stat.label}><dt title={stat.label}>{stat.label}</dt><dd title={stat.value}>{stat.value}</dd></div>)}</dl>
  </div>;
}

export function TokenCard({ launch, featured = false, boosted = false }: { launch: Launch; sample?: boolean; featured?: boolean; boosted?: boolean }) {
  const indexed = launch.aquaIndexed;
  const creatorLock = activeCreatorLock(launch.creatorLock);
  const dexStatus = dexBadgeState(launch);
  return <article className={`token-card aqua-market-card ${featured ? "featured" : ""} ${boosted ? "boosted" : ""}`}>
    <Link className="token-card-link" to={"/token/" + launch.id} aria-label={`View ${launch.name} market`}>
      <div className="token-head">
        <TokenMark launch={launch}/>
        <div className="card-identity"><div className="token-title"><b title={launch.name}>{launch.name}</b></div><div className="card-subtitle"><span title={`$${launch.symbol}`}>${launch.symbol}</span><span>·</span><span>{launchAge(launch.launchedAt, launch.createdAt).replace("Launched ", "")}</span></div></div>
      </div>
      {(featured || boosted) && <div className="card-tags">{featured && <span className="market-tag">AQUA featured</span>}{boosted && <span className="market-tag card-boost-tag">Community boost</span>}</div>}
      <div className="card-market-overview">
        <div className="card-cap"><small>Market cap</small><strong>{indexed ? cardAmount(launch.marketCapUsd, true) : "Indexing"}</strong><div className="token-pair"><AssetMark launch={launch}/><span title={`${launch.pairSymbol} pair`}>{launch.pairSymbol} pair</span></div></div>
        <div className="card-market-art"><MarketCardTrend id={launch.id} enabled={Boolean(indexed)} priceUsd={launch.priceUsd} priceUpdatedAt={launch.priceUpdatedAt} priceStatus={launch.priceStatus}/><div className="card-pair-medallion" aria-hidden="true"><AssetMark launch={launch}/></div></div>
      </div>
      <CardRewards launch={launch}/>
      <div className="token-stats"><Metric label="24h volume" value={indexed ? cardAmount(launch.volume24hUsd, true) : "Indexing"}/><Metric label="Holders" value={indexed ? cardAmount(launch.holderCount) : "Indexing"}/></div>
    </Link>
    <footer className="card-footer">
      {(dexStatus || creatorLock) && <div className="token-card-status"><DexStatusBadge state={dexStatus}/>{creatorLock && <span className="creator-lock-badge" title="Verified creator lock" aria-label={`${creatorLockPercentLabel(creatorLock)} of supply locked by the creator`}><LockKeyhole aria-hidden="true"/>{creatorLockPercentLabel(creatorLock)} locked</span>}</div>}
      <MarketSocialLinks launch={launch} className="token-card-socials"/>
    </footer>
    <RecentUpdateBell at={launch.latestProjectUpdateAt} launchId={launch.id}/>
  </article>;
}

export function Metric({label,value,tone=""}:{label:string;value:string;tone?:string}) {
  return <div className="metric"><small>{label}</small><b className={tone}>{value}</b></div>;
}
