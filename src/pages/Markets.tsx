import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleCheck, Clock3, Database, Search, ShieldCheck, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../fixtures";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { LiquidityFlow } from "../components/LiquidityFlow";
import { useRuntime } from "../context";

type DataState = "loading" | "live" | "empty" | "offline";

export function Markets() {
  const { config } = useRuntime();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<DataState>("loading");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [stock, setStock] = useState("all");

  useEffect(() => {
    api.launches().then((data) => {
      setLaunches(data.launches);
      setState(data.launches.length ? "live" : "empty");
      setUpdatedAt(new Date());
    }).catch(() => setState("offline"));
  }, []);

  const sampleMode = state !== "live";
  const source = sampleMode ? DEMO : launches;
  const filtered = useMemo(() => source.filter((item) =>
    (tab === "all" || item.status === tab) &&
    (stock === "all" || (stock === "stock" ? Boolean(item.stockSymbol) : !item.stockSymbol)) &&
    [item.name, item.symbol, item.mint, item.stockSymbol].some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase()))
  ), [source, query, tab, stock]);

  return <main className="explore-page">
    <section className="product-hero">
      <div className="hero-copy">
        <div className="hero-kicker"><Waves size={16}/> SOLANA LAUNCH INFRASTRUCTURE</div>
        <h1>Launch markets.<br/><span>Reward holders.</span></h1>
        <p>Start on a transparent virtual curve. Route trading fees into optional tokenized stock rewards. Graduate liquidity to Orca at {config.graduationSol} SOL.</p>
        <div className="hero-actions">
          <Link className="primary" to="/create">Create market <ArrowRight size={17}/></Link>
          <a className="secondary-button" href="#markets">View markets</a>
        </div>
        <div className="fact-row">
          <div><small>Platform fee</small><strong>{(config.fees.platformBps / 100).toFixed(2)}%</strong></div>
          <div><small>Optional reward fee</small><strong>{(config.fees.rewardsBps / 100).toFixed(2)}%</strong></div>
          <div><small>Liquidity destination</small><strong>Orca</strong></div>
        </div>
      </div>
      <LiquidityFlow />
    </section>

    <section className="market-workspace" id="markets">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">MARKET DISCOVERY</span>
          <h2>{sampleMode ? "Preview markets" : "Active markets"}</h2>
          <p>{sampleMode ? "Examples are provided to demonstrate the product layout. No values below represent live trading." : "Newest markets returned by the AQUA index."}</p>
        </div>
        <div className={`data-badge ${state}`}>
          {state === "live" ? <CircleCheck/> : state === "loading" ? <Clock3/> : <Database/>}
          <span><b>{state === "live" ? "LIVE DATA" : state === "loading" ? "LOADING" : "SAMPLE DATA"}</b><small>{state === "live" && updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : state === "offline" ? "Backend unavailable" : "Devnet has no launches"}</small></span>
        </div>
      </header>

      <div className="market-controls">
        <div className="tabs" aria-label="Market status">{[["all", "All"], ["curve", "On curve"], ["orca", "Orca"]].map(([value, label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
        <div className="filters"><select aria-label="Filter by reward type" value={stock} onChange={(event) => setStock(event.target.value)}><option value="all">All reward types</option><option value="stock">Stock rewards</option><option value="sol">SOL only</option></select><label><Search size={16}/><input aria-label="Search markets" placeholder="Search name, ticker or mint" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>
      </div>

      {state === "loading" ? <div className="market-skeletons">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid">{filtered.map((launch, index) => <TokenCard key={launch.id} launch={launch} sample={sampleMode} featured={index === 0}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state"><Search/><h3>No matching markets</h3><p>Clear the filters or search for another token.</p></div>}
    </section>

    <section className="mechanism-band">
      <div className="mechanism-heading"><span className="eyebrow">THE AQUA ROUTE</span><h2>One trade. Clear destinations.</h2><p>Every fee has a defined path that can be verified against the program and reward epochs.</p><Link to="/how-it-works">Inspect the full mechanism <ArrowRight size={16}/></Link></div>
      <div className="route-list">
        <article><span>01</span><div><b>Trade on the curve</b><p>Price follows the published virtual reserve model.</p></div><strong>MARKET</strong></article>
        <article><span>02</span><div><b>Separate the fees</b><p>Platform revenue and stock rewards use distinct routes.</p></div><strong>1% + 1%</strong></article>
        <article><span>03</span><div><b>Graduate liquidity</b><p>The market becomes eligible for its Orca pool at {config.graduationSol} SOL.</p></div><strong>ORCA</strong></article>
      </div>
    </section>

    <section className="assurance-strip">
      <div><ShieldCheck/><span><b>Wallet controlled</b><small>You approve every signature.</small></span></div>
      <div><Database/><span><b>Verifiable routes</b><small>Program and epoch data stay visible.</small></span></div>
      <div><CircleCheck/><span><b>Honest states</b><small>Preview and live data are never mixed.</small></span></div>
      <Link className="primary" to="/create">Launch on AQUA <ArrowRight size={17}/></Link>
    </section>
  </main>;
}
