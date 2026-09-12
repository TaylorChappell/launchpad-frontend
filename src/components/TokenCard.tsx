import { ArrowUpRight, Gift, LockKeyhole, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { Launch } from "../types";

const compact = new Intl.NumberFormat("en-US", { notation:"compact", maximumFractionDigits:1 });

export function TokenMark({ launch, large=false }: { launch: Launch; large?: boolean }) {
  const hue = [...launch.symbol].reduce((a,c) => a + c.charCodeAt(0), 0) % 55 + 175;
  return <span className={`token-mark ${large ? "large" : ""}`} style={{backgroundImage: launch.imageUrl ? `url(${launch.imageUrl})` : `linear-gradient(145deg,hsl(${hue} 72% 47%),hsl(${hue + 38} 76% 18%))`}}>{launch.imageUrl ? "" : launch.symbol.slice(0,2)}</span>;
}

export function TokenCard({ launch, featured = false }: { launch: Launch; sample?: boolean; featured?: boolean }) {
  return <Link className={`token-card ${featured ? "featured" : ""}`} to={`/token/${launch.id}`}>
    <div className="token-head">
      <TokenMark launch={launch}/>
      <div><div className="token-title"><b>{launch.name}</b><span>${launch.symbol}</span></div><div className="token-pair"><Gift size={12}/>{launch.stockSymbol} rewards</div></div>
      <ArrowUpRight className="card-arrow" size={17}/>
    </div>
    <div className="reward-card-focus"><span><Gift/>HOLDER REWARD</span><strong>Earn {launch.stockSymbol}</strong><small>${compact.format(launch.rewardDistributedUsd)} distributed to holders</small></div>
    <div className="token-stats"><Metric label="Market cap" value={`$${compact.format(launch.marketCapUsd)}`}/><Metric label="24h volume" value={`$${compact.format(launch.volume24hUsd)}`}/><Metric label="Holders" value={compact.format(launch.holderCount)}/></div>
    <div className="token-foot"><span><LockKeyhole size={14}/>Liquidity locked</span><strong><Users size={14}/>{compact.format(launch.holderCount)}</strong></div>
    <div className="market-status"><span className={launch.status === "live" ? "orca" : launch.status}/><small>{launch.status === "live" ? "Trading in an Orca Whirlpool" : "Launch transactions in progress"}</small></div>
  </Link>;
}

export function Metric({label,value,tone=""}:{label:string;value:string;tone?:string}) {
  return <div className="metric"><small>{label}</small><b className={tone}>{value}</b></div>;
}
