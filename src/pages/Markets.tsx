import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleCheck, Clock3, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { HolderRewardFlow } from "../components/HolderRewardFlow";
import { AquaGlyph, type AquaGlyphKind } from "../components/AquaIcons";
import { useRuntime } from "../context";

type DataState = "loading" | "live" | "empty" | "offline";
const compactMoney = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", notation:"compact", maximumFractionDigits:1 });

export function Markets() {
  const { config } = useRuntime();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<DataState>("loading");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    api.launches().then((data) => {
      setLaunches(data.launches);
      setState(data.launches.length ? "live" : "empty");
      setUpdatedAt(new Date());
    }).catch(() => setState("offline"));
  }, []);

  const platform = useMemo(() => {
    const revenue = launches.reduce((sum,item) => sum + Number(item.volume24hUsd || 0), 0) * config.fees.platformBps / 10_000;
    return { revenue, buybacks: revenue * .5, stocks: launches.reduce((sum,item) => sum + Number(item.rewardDistributedUsd || 0), 0) };
  }, [launches, config.fees.platformBps]);
  const filtered = useMemo(() => launches
    .filter((item) => tab === "all" || (tab === "curve" ? item.status !== "orca" : item.status === "orca"))
    .sort((a, b) => Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)), [launches, tab]);

  return <main className="explore-page">
    <section className="product-hero">
      <div className="hero-copy">
        <h1>Launch a coin.<br/><span>Build a portfolio.</span></h1>
        <p>AQUA turns trading activity into tokenized stock rewards for holders. Distribution is based on how much each wallet holds and how long it stays committed.</p>
        <div className="hero-actions">
          <Link className="primary" to="/create">Launch a holder-first coin <ArrowRight size={17}/></Link>
          <a className="secondary-button" href="#markets">Explore reward markets</a>
        </div>
        <div className="platform-metrics">
          <PlatformMetric icon="revenue" label="24h platform revenue" value={compactMoney.format(platform.revenue)} note="From indexed market volume"/>
          <PlatformMetric icon="buyback" label="AQUA buyback allocation" value={compactMoney.format(platform.buybacks)} note="50% of platform revenue"/>
          <PlatformMetric icon="rewards" label="Stock rewards airdropped" value={compactMoney.format(platform.stocks)} note="Across launched markets"/>
        </div>
      </div>
      <HolderRewardFlow />
    </section>

    <section className="aqua-flywheel">
      <div className="flywheel-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <header><span className="eyebrow">THE AQUA FLYWHEEL</span><h2>Every launch can strengthen AQUA.</h2><p>Half of platform revenue is committed to buying the main AQUA token from the market. Holder stock rewards remain in a separate route.</p></header>
      <div className="flywheel-track">
        <FlywheelStep icon="markets" title="Markets trade" text="Activity grows across coins launched on AQUA."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="earn" title="Platform earns" text="The platform fee creates AQUA revenue."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="aquaBuy" title="50% buys AQUA" text="Half of that revenue buys the main AQUA token."/>
        <ArrowRight className="flywheel-arrow"/>
        <FlywheelStep icon="growth" title="AQUA grows" text="The ecosystem feeds value back into its core token."/>
      </div>
    </section>

    <section className="creator-locking">
      <div className="creator-locking-copy">
        <h2>Lock supply.<br/><span>Earn a larger fee share.</span></h2>
        <p>Creators can lock part of their coin in AQUA’s verified vault. The more supply they lock, and the longer they commit it for, the larger the share of their coin’s trading fees they can earn.</p>
        <Link to="/create">Launch a coin <ArrowRight size={16}/></Link>
      </div>
      <div className="creator-locking-model" aria-label="Creator fee model">
        <div className="lock-factor">
          <span>More supply locked</span>
          <div className="lock-water-track"><i className="supply-level"/></div>
          <small>Verified commitment</small>
        </div>
        <b className="lock-operator">+</b>
        <div className="lock-factor">
          <span>Longer lock period</span>
          <div className="lock-water-track"><i className="duration-level"/></div>
          <small>Longer alignment</small>
        </div>
        <b className="lock-operator">=</b>
        <div className="lock-result">
          <span>Higher creator fee share</span>
          <strong>Earn from each trade</strong>
          <small>The rate applies while the verified lock remains active.</small>
        </div>
      </div>
    </section>

    <section className="market-workspace" id="markets">
      <header className="workspace-heading">
        <div>
          <h2>Markets</h2>
          <p>The most popular coins launched through AQUA, ranked by 24 hour trading volume.</p>
        </div>
        {state !== "empty" && <div className={`data-badge ${state}`}>
          {state === "live" ? <CircleCheck/> : state === "loading" ? <Clock3/> : <Database/>}
          <span><b>{state === "live" ? "LIVE DATA" : state === "loading" ? "LOADING" : "OFFLINE"}</b><small>{state === "live" && updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : state === "offline" ? "Backend unavailable" : "Fetching indexed markets"}</small></span>
        </div>}
      </header>

      <div className="market-controls">
        <div className="tabs" aria-label="Market status">{[["all", "All"], ["curve", "Wavebreak"], ["orca", "Whirlpools"]].map(([value, label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
      </div>

      {state === "loading" ? <div className="market-skeletons">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid">{filtered.map((launch, index) => <TokenCard key={launch.id} launch={launch} sample={false} featured={index === 0}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state"><Database/><h3>{state === "offline" ? "Markets unavailable" : launches.length ? "No markets in this stage" : "No markets launched yet"}</h3><p>{state === "offline" ? "AQUA could not reach the market index. Try again shortly." : launches.length ? "Choose another market stage." : "Launched coins will appear here once they have indexed."}</p></div>}
    </section>

  </main>;
}

function PlatformMetric({icon,label,value,note}:{icon:AquaGlyphKind;label:string;value:string;note:string}) { return <div className="platform-metric"><span><AquaGlyph kind={icon}/></span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>; }
function FlywheelStep({icon,title,text}:{icon:AquaGlyphKind;title:string;text:string}) { return <article className="flywheel-step"><span><AquaGlyph kind={icon}/></span><b>{title}</b><p>{text}</p></article>; }
