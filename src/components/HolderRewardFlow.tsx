import { ChartNoAxesCombined, Gift, RefreshCcw, Users } from "lucide-react";

export function HolderRewardFlow() {
  return <div className="hero-current" role="img" aria-label="Trading activity flows through AQUA into stock rewards, holders, and AQUA buybacks">
    <div className="current-haze" aria-hidden="true"/>
    <div className="current-ring ring-one" aria-hidden="true"/>
    <div className="current-ring ring-two" aria-hidden="true"/>
    <div className="current-ring ring-three" aria-hidden="true"/>
    <span className="current-node node-trade" aria-hidden="true"><ChartNoAxesCombined strokeWidth={1.7}/></span>
    <span className="current-node node-reward" aria-hidden="true"><Gift strokeWidth={1.7}/></span>
    <span className="current-node node-holders" aria-hidden="true"><Users strokeWidth={1.7}/></span>
    <span className="current-node node-buyback" aria-hidden="true"><RefreshCcw strokeWidth={1.7}/></span>
    <div className="current-core" aria-hidden="true"><span/><img src={`${import.meta.env.BASE_URL}aqua-logo.png`} alt=""/></div>
    <div className="current-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="current-water" aria-hidden="true"><i/><i/><i/></div>
  </div>;
}
