import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDollarSign, Coins, Gift, LockKeyhole, TimerReset, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { AquaGlyph, type AquaGlyphKind } from "../components/AquaIcons";
import { HolderRewardFlow } from "../components/HolderRewardFlow";
import { PageBubbles } from "../components/PageBubbles";
import { api } from "../api";
import { useRuntime } from "../context";
import type { Launch } from "../types";

const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function HowItWorks() {
  const { config } = useRuntime();
  const [launches, setLaunches] = useState<Launch[]>([]);

  useEffect(() => {
    api.launches().then((data) => setLaunches(data.launches)).catch(() => setLaunches([]));
  }, []);

  const platform = useMemo(() => {
    const revenue = launches.reduce((sum, item) => sum + Number(item.volume24hUsd || 0), 0) * config.fees.platformBps / 10_000;
    return {
      revenue,
      buybacks: revenue * .5,
      stocks: launches.reduce((sum, item) => sum + Number(item.rewardDistributedUsd || 0), 0),
    };
  }, [launches, config.fees.platformBps]);

  return <main className="how-story-page">
    <PageBubbles count={16}/>
    <section className="product-hero how-story-hero">
      <div className="hero-copy">
        <h1>Launch a coin.<br/><span>Build a portfolio.</span></h1>
        <p>AQUA turns market activity into tokenized stock rewards for holders. Each reward is weighted by how much a wallet holds and how long it stays committed.</p>
        <div className="hero-actions">
          <Link className="primary" to="/create">Launch a holder-first coin <ArrowRight size={17}/></Link>
          <Link className="secondary-button" to="/">Explore markets</Link>
        </div>
        <div className="platform-metrics">
          <PlatformMetric icon="revenue" label="24h platform revenue" value={compactMoney.format(platform.revenue)} note="From indexed market volume"/>
          <PlatformMetric icon="buyback" label="AQUA buyback allocation" value={compactMoney.format(platform.buybacks)} note="50% of platform revenue"/>
          <PlatformMetric icon="rewards" label="Stocks airdropped" value={compactMoney.format(platform.stocks)} note="Across AQUA markets"/>
        </div>
      </div>
      <HolderRewardFlow/>
    </section>

    <section className="how-mechanism">
      <header><h2>One market. One permanent reward asset.</h2><p>The stock selected at launch stays attached to the coin, from its Orca market to every future holder reward.</p></header>
      <div className="holder-flow" aria-label="AQUA holder reward flow">
        <FlowNode icon={<CircleDollarSign/>} label="The coin trades" detail="Activity runs through Orca"/>
        <ArrowRight/>
        <FlowNode icon={<Gift/>} label="Rewards accumulate" detail="The stock route stays separate" featured/>
        <ArrowRight/>
        <FlowNode icon={<TimerReset/>} label="Holding is measured" detail="Balance and time build weight"/>
        <ArrowRight/>
        <FlowNode icon={<Users/>} label="Holders claim" detail="Published proofs unlock stock"/>
      </div>
    </section>

    <section className="aqua-flywheel how-flywheel">
      <div className="flywheel-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <header><h2>Every launch can strengthen AQUA.</h2><p>Half of platform revenue is committed to buying the main AQUA token from the market. Holder stock rewards remain in a separate route.</p></header>
      <div className="flywheel-track">
        <FlywheelStep icon="markets" title="Markets trade" text="Activity grows across AQUA coins."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="earn" title="AQUA earns" text="The platform fee creates revenue."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="aquaBuy" title="50% buys AQUA" text="Half of revenue buys the core token."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="growth" title="Value returns" text="Growth flows back into the ecosystem."/>
      </div>
    </section>

    <section className="creator-locking how-creator-locking">
      <div className="creator-locking-copy">
        <h2>Lock supply.<br/><span>Earn a larger fee share.</span></h2>
        <p>Creators can lock part of their coin in AQUA’s verified vault. More supply and a longer commitment can unlock a larger share of that coin’s platform fee.</p>
      </div>
      <div className="creator-locking-model" aria-label="Creator fee model">
        <div className="lock-factor"><span>Supply locked</span><div className="lock-water-track"><i className="supply-level"/></div><small>Verified onchain</small></div>
        <b className="lock-operator">+</b>
        <div className="lock-factor"><span>Lock duration</span><div className="lock-water-track"><i className="duration-level"/></div><small>Longer alignment</small></div>
        <b className="lock-operator">=</b>
        <div className="lock-result"><span>Creator fee share</span><strong>Earn from each trade</strong><small>Only while the verified lock is active</small></div>
      </div>
    </section>

    <section className="score-explanation how-score">
      <div className="technical-intro"><h2>Rewards follow conviction.</h2><p>Eligible balance gains weight for every second it remains held. Selling reduces the future weight of that balance.</p><div className="formula-large"><span>balance</span><b>×</b><span>time held</span><b>=</b><strong>reward share</strong></div></div>
      <div className="score-example"><header><b>Example reward period</b><small>Illustrative</small></header><ExampleRow name="Mara" holding="1,000 coins for 30 days" score="30,000" share="67.4%" width="100%"/><ExampleRow name="Jules" holding="1,000 coins for 7 days" score="7,000" share="15.7%" width="23%"/><ExampleRow name="Ari" holding="250 coins for 30 days" score="7,500" share="16.9%" width="25%"/><footer>Each eligible wallet receives its share of the paired stock.</footer></div>
    </section>

    <section className="how-foundation">
      <article><span><Coins/></span><div><h3>Direct Orca market</h3><p>The coin opens in a stock-paired Whirlpool with active liquidity.</p></div></article>
      <article><span><LockKeyhole/></span><div><h3>Locked launch liquidity</h3><p>The initial liquidity position is permanently locked.</p></div></article>
      <article><span><CheckCircle2/></span><div><h3>Verifiable claims</h3><p>Reward allocations use published proofs that wallets can verify.</p></div></article>
    </section>
  </main>;
}

function PlatformMetric({ icon, label, value, note }: { icon: AquaGlyphKind; label: string; value: string; note: string }) {
  return <div className="platform-metric"><span><AquaGlyph kind={icon}/></span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>;
}

function FlywheelStep({ icon, title, text }: { icon: AquaGlyphKind; title: string; text: string }) {
  return <article className="flywheel-step"><span><AquaGlyph kind={icon}/></span><b>{title}</b><p>{text}</p></article>;
}

function FlowNode({ icon, label, detail, featured = false }: { icon: React.ReactNode; label: string; detail: string; featured?: boolean }) {
  return <div className={`flow-step ${featured ? "featured" : ""}`}><span>{icon}</span><b>{label}</b><small>{detail}</small></div>;
}

function ExampleRow({ name, holding, score, share, width }: { name: string; holding: string; score: string; share: string; width: string }) {
  return <div className="example-row"><span><b>{name}</b><small>{holding}</small></span><div><i style={{ width }}/></div><strong>{score}<small>score · {share}</small></strong></div>;
}
