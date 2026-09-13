import { useEffect, useState } from "react";
import { ArrowUpRight, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import type { Launch } from "../types";

const compact = new Intl.NumberFormat("en-US", { notation:"compact", maximumFractionDigits:1 });

export function TokenMark({ launch, large=false }: { launch: Launch; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hue = [...launch.symbol].reduce((a,c) => a + c.charCodeAt(0), 0) % 55 + 175;
  useEffect(() => setImageFailed(false), [launch.imageUrl]);
  const showImage = Boolean(launch.imageUrl && !imageFailed);
  return <span className={`token-mark ${large ? "large" : ""}`} style={!showImage ? { backgroundImage: `linear-gradient(145deg,hsl(${hue} 72% 47%),hsl(${hue + 38} 76% 18%))` } : undefined}>
    {showImage ? <img src={launch.imageUrl} alt="" onError={() => setImageFailed(true)}/> : launch.symbol.slice(0,2)}
  </span>;
}

export function TokenCard({ launch, featured = false }: { launch: Launch; sample?: boolean; featured?: boolean }) {
  const indexed = launch.aquaIndexed;
  return <Link className={`token-card ${featured ? "featured" : ""}`} to={`/token/${launch.id}`}>
    <div className="token-head">
      <TokenMark launch={launch}/>
      <div><div className="token-title"><b>{launch.name}</b><span>${launch.symbol} / {launch.pairSymbol}</span></div><div className="token-pair"><Gift size={12}/>{launch.stockSymbol} rewards</div></div>
      <ArrowUpRight className="card-arrow" size={17}/>
    </div>
    <div className="reward-card-focus"><span><Gift/>HOLDER REWARD</span><strong>Earn {launch.stockSymbol}</strong><small>${compact.format(launch.rewardDistributedUsd)} distributed to holders</small></div>
    <div className="token-stats"><Metric label="Market cap" value={indexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/><Metric label="24h volume" value={indexed ? `$${compact.format(launch.volume24hUsd)}` : "Indexing"}/><Metric label="Holders" value={indexed ? compact.format(launch.holderCount) : "Indexing"}/></div>
  </Link>;
}

export function Metric({label,value,tone=""}:{label:string;value:string;tone?:string}) {
  return <div className="metric"><small>{label}</small><b className={tone}>{value}</b></div>;
}
