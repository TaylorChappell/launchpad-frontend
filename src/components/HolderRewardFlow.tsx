import { ArrowRight, Clock3, Coins, Droplets, Sparkles } from "lucide-react";

export function HolderRewardFlow() {
  return <div className="reward-flow" aria-label="AQUA turns trading activity into time-weighted stock rewards for holders">
    <div className="reward-flow-top"><span>HOW VALUE FLOWS</span><b><i/>HOLDER FIRST</b></div>
    <div className="reward-flow-stage">
      <div className="flow-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="flow-source flow-node"><Coins/><small>Every trade</small><strong>1% reward stream</strong></div>
      <ArrowRight className="flow-arrow"/>
      <div className="flow-vault flow-node"><span className="vault-orbit"><Droplets/></span><small>Stock vault</small><strong>NVDAx</strong><em>Purchased in batches</em></div>
      <ArrowRight className="flow-arrow"/>
      <div className="flow-holders">
        <span><img src={`${import.meta.env.BASE_URL}aqua-logo.png`} alt=""/><b>Amount</b></span>
        <span><Clock3/><b>Time</b></span>
        <span><Sparkles/><b>Rewards</b></span>
      </div>
    </div>
    <div className="reward-flow-foot"><span><b>AQUA Score</b> balances how much you hold with how long you hold it.</span><strong>balance × time</strong></div>
  </div>;
}
