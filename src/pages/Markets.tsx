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

    <section className="holder-standard">
      <h2>A coin can do more<br/>than trade.</h2>
      <div className="holder-standard-copy">
        <p>Each market can buy tokenized stocks for its holders.</p>
        <p>AQUA weighs each reward by how much is held and for how long. Creators launch the coin. Eligible holders receive the stock rewards.</p>
      </div>
    </section>

    <section className="aqua-flywheel">
      <svg className="liquid-section-frame" viewBox="0 0 1200 470" preserveAspectRatio="none" aria-hidden="true"><path d="M31 4 C162 0 220 13 342 6 S575 0 701 7 S931 1 1168 5 C1185 6 1196 18 1196 38 V389 C1196 432 1170 459 1125 464 H61 C24 461 5 439 4 402 V45 C4 21 13 8 31 4 Z"/><path className="frame-current" d="M31 4 C162 0 220 13 342 6 S575 0 701 7 S931 1 1168 5"/></svg>
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

    <section className="score-band">
      <div className="score-copy"><h2>Holding longer should matter.</h2><p>A momentary snapshot can reward wallets that arrive seconds before distribution. AQUA’s model is designed to combine eligible balance and holding time for a fairer share.</p><Link to="/how-it-works">See the reward model <ArrowRight size={16}/></Link></div>
      <div className="score-demo">
        <div className="score-formula"><span>eligible balance</span><b>×</b><span>holding time</span><b>=</b><strong>AQUA Score</strong></div>
        <div className="score-bars"><ScoreBar name="Mara" detail="1,000 coins · 30 days" width="100%"/><ScoreBar name="Jules" detail="1,000 coins · 7 days" width="23%"/><ScoreBar name="Ari" detail="250 coins · 30 days" width="25%"/></div>
        <small>Illustrative example. Final rules depend on the deployed reward program.</small>
      </div>
    </section>

  </main>;
}

function ScoreBar({name,detail,width}:{name:string;detail:string;width:string}) { return <div><span><b>{name}</b><small>{detail}</small></span><i><em style={{width}}/></i></div>; }
function PlatformMetric({icon,label,value,note}:{icon:AquaGlyphKind;label:string;value:string;note:string}) { return <div className="platform-metric"><svg className="liquid-card-frame" viewBox="0 0 240 160" preserveAspectRatio="none" aria-hidden="true"><path d="M18 3 C52 0 69 8 105 4 C149 0 174 9 221 4 C232 4 237 12 237 24 V123 C237 138 226 151 211 153 H25 C11 153 3 142 3 128 V23 C3 11 8 5 18 3 Z"/><path className="frame-current" d="M18 3 C52 0 69 8 105 4 C149 0 174 9 221 4"/></svg><span><AquaGlyph kind={icon}/></span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>; }
function FlywheelStep({icon,title,text}:{icon:AquaGlyphKind;title:string;text:string}) { return <article className="flywheel-step"><span><AquaGlyph kind={icon}/></span><b>{title}</b><p>{text}</p></article>; }
