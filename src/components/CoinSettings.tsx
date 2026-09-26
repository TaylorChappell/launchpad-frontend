import { useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import type { Launch } from "../types";
import { MarketSheet } from "./MarketSheet";
import { CoinFeeBreakdown } from "./CoinFeeBreakdown";
import "../coin-settings.css";

export function CoinSettings({ launch }: { launch: Launch }) {
  const [open, setOpen] = useState(false);
  const marketing = launch.marketingMode ?? "automatic";
  const dex = launch.dexFundingMode ?? "automatic";
  const mode = launch.rewardMode === "buyback_burn" ? "Buyback & Burn" : launch.rewardMode === "jackpot" ? "Hourly Jackpot" : "Holder Rewards";
  return <>
    <button className="market-more-details market-coin-settings" aria-haspopup="dialog" onClick={() => setOpen(true)}><SlidersHorizontal size={18}/><span>Coin settings</span><ChevronRight size={18}/></button>
    {open && <MarketSheet launch={launch} title="Coin settings" closeLabel="Close coin settings" onClose={() => setOpen(false)}>
      <div className="market-details-content coin-settings-content">
        <section><h3>Trading fees</h3><CoinFeeBreakdown rewardFeeBps={launch.rewardFeeBps ?? (launch.transferFeeBps ?? 200)-100} orcaFeeRate={launch.orcaFeeRate}/></section>
        <section><h3>Rewards &amp; community</h3><dl className="market-details-facts">
          <div><dt>Reward mode</dt><dd>{mode}</dd></div>
          <div><dt>Ripple share</dt><dd>{(launch.rippleRewardBps ?? 1500)/100}% of trading rewards</dd></div>
          <div><dt>Community Boost to Ripple</dt><dd>10%</dd></div>
          <div><dt>Marketing</dt><dd>{marketing === "off" ? "Off" : marketing === "proposal" ? "Proposal only" : "Automatic + proposals"}</dd></div>
          <div><dt>DEX fund</dt><dd>{dex === "proposal" ? "Proposal only" : "Automatic + proposals"}</dd></div>
        </dl><p className="coin-settings-note">Ripple comes from the reward budget after operating and campaign allocations. It adds no extra token fee. The token fee and Ripple share were set at launch.</p></section>
      </div>
    </MarketSheet>}
  </>;
}
