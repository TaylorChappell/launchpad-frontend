import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeDollarSign, Clock3, ExternalLink, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { AquaGlyph, type AquaGlyphKind } from "../components/AquaIcons";
import { HolderRewardFlow } from "../components/HolderRewardFlow";
import { OrcaMark } from "../components/OrcaMark";
import { PageBubbles } from "../components/PageBubbles";
import { api } from "../api";
import { useRuntime } from "../context";
import type { Launch } from "../types";

const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function HowItWorks() {
  const { config } = useRuntime();
  const [launches, setLaunches] = useState<Launch[]>([]);

  useEffect(() => {
    api.launches().then((data) => setLaunches(data.launches.filter((launch) => launch.status === "live"))).catch(() => setLaunches([]));
  }, []);

  const platform = useMemo(() => {
    const revenue = launches.reduce((sum, item) => sum + Number(item.volume24hUsd || 0), 0) * config.fees.platformBps / 10_000;
    const maximumScoreBuybackBps = config.fees.platformAllocationAtMaximumCreatorScore?.buybackBps ?? 2_500;
    return {
      revenue,
      buybacks: revenue * maximumScoreBuybackBps / 10_000,
      stocks: launches.reduce((sum, item) => sum + Number(item.rewardDistributedUsd || 0), 0),
    };
  }, [launches, config.fees.platformBps, config.fees.platformAllocationAtMaximumCreatorScore]);

  return <main className="how-story-page">
    <PageBubbles count={20}/>
    <section className="product-hero how-story-hero">
      <div className="hero-copy">
        <h1>Built on Orca.<br/><span>Designed for holders.</span></h1>
        <p>AQUA launches coins directly into Orca Whirlpools. Creators choose a SOL or xStock trading pair, plus one permanent tokenized-stock reward asset. AQUA turns the reward share into claims weighted by balance and time held.</p>
        <div className="hero-actions">
          <Link className="primary" to="/">Explore markets <ArrowRight size={17}/></Link>
          <a className="secondary-button orca-visit-button" href="https://www.orca.so/" target="_blank" rel="noreferrer"><OrcaMark/>Visit Orca <ExternalLink size={14}/></a>
        </div>
        <div className="platform-metrics">
          <PlatformMetric label="24h platform revenue" value={compactMoney.format(platform.revenue)} note="From live market volume"/>
          <PlatformMetric label="AQUA buyback allocation" value={compactMoney.format(platform.buybacks)} note="At maximum creator score"/>
          <PlatformMetric label="Stocks airdropped" value={compactMoney.format(platform.stocks)} note="Across live AQUA markets"/>
        </div>
      </div>
      <HolderRewardFlow/>
    </section>

    <section className="aqua-flywheel how-flywheel unframed-flywheel">
      <div className="flywheel-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <header><h2>Every launch can strengthen AQUA.</h2><p>Half of platform revenue is committed to buying the main AQUA token from the market. Holder stock rewards remain in a separate route.</p></header>
      <div className="flywheel-track">
        <FlywheelStep icon="markets" title="Markets trade" text="Activity grows across AQUA coins."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="earn" title="AQUA earns" text="The platform fee creates revenue."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="aquaBuy" title="Buyback allocation" text="The fixed buyback wallet receives its onchain share."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="growth" title="Value returns" text="Growth flows back into the ecosystem."/>
      </div>
    </section>

    <section className="creator-locking how-creator-locking">
      <div className="creator-locking-copy">
        <h2>Lock supply.<br/><span>Earn a larger fee share.</span></h2>
        <p>Creators can lock tokens they buy after launch in AQUA’s verified vault. Five percent of supply locked for one year reaches the 25% cap; smaller or shorter locks earn proportionally less while active.</p>
      </div>
      <div className="creator-locking-model creator-locking-current" aria-label="More supply locked for longer can earn a larger creator fee share">
        <div className="locking-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <div className="locking-input-row">
          <div className="locking-factor-bubble"><span><LockKeyhole/></span><small>Supply locked</small><strong>Lock more</strong><em>Verified onchain</em></div>
          <div className="locking-flow" aria-hidden="true"><i/><i/><i/></div>
          <div className="locking-factor-bubble"><span><Clock3/></span><small>Lock duration</small><strong>Commit longer</strong><em>Time verified</em></div>
        </div>
        <div className="locking-merge" aria-hidden="true"><i/><i/><i/></div>
        <div className="locking-fee-pool"><span><BadgeDollarSign/></span><div><small>Creator fee share</small><strong>Up to 25% of the platform stream</strong><em>Earned only while the lock stays active</em></div><div className="locking-pool-water" aria-hidden="true"><i/><i/><i/></div></div>
      </div>
    </section>
  </main>;
}

function PlatformMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="platform-metric"><small>{label}</small><strong>{value}</strong><em>{note}</em></div>;
}

function FlywheelStep({ icon, title, text }: { icon: AquaGlyphKind; title: string; text: string }) {
  return <article className="flywheel-step"><span><AquaGlyph kind={icon}/></span><b>{title}</b><p>{text}</p></article>;
}
