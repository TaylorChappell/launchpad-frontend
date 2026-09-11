import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleCheck, Clock3, Database, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../fixtures";
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
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [stock, setStock] = useState("stock");

  useEffect(() => {
    api.launches().then((data) => {
      setLaunches(data.launches);
      setState(data.launches.length ? "live" : "empty");
      setUpdatedAt(new Date());
    }).catch(() => setState("offline"));
  }, []);

  const sampleMode = state !== "live";
  const source = sampleMode ? DEMO : launches;
  const platform = useMemo(() => {
    const revenue = source.reduce((sum,item) => sum + Number(item.volume24hUsd || 0), 0) * config.fees.platformBps / 10_000;
    return { revenue, buybacks: revenue * .5, stocks: source.reduce((sum,item) => sum + Number(item.rewardDistributedUsd || 0), 0) };
  }, [source, config.fees.platformBps]);
  const filtered = useMemo(() => source.filter((item) =>
    (tab === "all" || item.status === tab) &&
    (stock === "all" || (stock === "stock" ? Boolean(item.stockSymbol) : !item.stockSymbol)) &&
    [item.name, item.symbol, item.mint, item.stockSymbol].some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase()))
  ), [source, query, tab, stock]);

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
          <PlatformMetric icon="revenue" label="24h platform revenue" value={compactMoney.format(platform.revenue)} note={sampleMode ? "Preview market estimate" : "From indexed market volume"}/>
          <PlatformMetric icon="buyback" label="AQUA buyback allocation" value={compactMoney.format(platform.buybacks)} note="50% of platform revenue"/>
          <PlatformMetric icon="rewards" label="Stock rewards airdropped" value={compactMoney.format(platform.stocks)} note={sampleMode ? "Across preview markets" : "Across indexed markets"}/>
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
        <p className="creator-locking-note"><strong>Dev buys stay unlocked at launch.</strong> A separate locking flow lets the creator choose the amount and duration before fee rewards begin.</p>
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
          <h2>{sampleMode ? "Discover the model" : "Explore holder rewards"}</h2>
          <p>{sampleMode ? "Illustrative markets show how stock rewards appear. Sample values are never presented as live activity." : "Compare the stock asset, reward vault and holder community behind every market."}</p>
        </div>
        <div className={`data-badge ${state}`}>
          {state === "live" ? <CircleCheck/> : state === "loading" ? <Clock3/> : <Database/>}
          <span><b>{state === "live" ? "LIVE DATA" : state === "loading" ? "LOADING" : "SAMPLE DATA"}</b><small>{state === "live" && updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : state === "offline" ? "Backend unavailable" : "No launches indexed yet"}</small></span>
        </div>
      </header>

      <div className="market-controls">
        <div className="tabs" aria-label="Market status">{[["all", "All"], ["curve", "Launching"], ["orca", "On Orca"]].map(([value, label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
        <div className="filters"><select aria-label="Filter by reward type" value={stock} onChange={(event) => setStock(event.target.value)}><option value="stock">Stock rewards</option><option value="all">All markets</option><option value="sol">No stock reward</option></select><label><Search size={16}/><input aria-label="Search markets" placeholder="Search coin or stock reward" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>
      </div>

      {state === "loading" ? <div className="market-skeletons">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid">{filtered.map((launch, index) => <TokenCard key={launch.id} launch={launch} sample={sampleMode} featured={index === 0}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state"><Search/><h3>No matching markets</h3><p>Try another coin, ticker, or reward asset.</p></div>}
    </section>

  </main>;
}

function PlatformMetric({icon,label,value,note}:{icon:AquaGlyphKind;label:string;value:string;note:string}) { return <div className="platform-metric"><svg className="liquid-card-frame" viewBox="0 0 240 160" preserveAspectRatio="none" aria-hidden="true"><path d="M18 3 C52 0 69 8 105 4 C149 0 174 9 221 4 C232 4 237 12 237 24 V123 C237 138 226 151 211 153 H25 C11 153 3 142 3 128 V23 C3 11 8 5 18 3 Z"/></svg><span><AquaGlyph kind={icon}/></span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>; }
function FlywheelStep({icon,title,text}:{icon:AquaGlyphKind;title:string;text:string}) { return <article className="flywheel-step"><span><AquaGlyph kind={icon}/></span><b>{title}</b><p>{text}</p></article>; }
