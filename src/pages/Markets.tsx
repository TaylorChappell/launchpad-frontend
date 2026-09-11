import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleCheck, Clock3, Database, Droplets, Search, ShieldCheck, TimerReset, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../fixtures";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { HolderRewardFlow } from "../components/HolderRewardFlow";

type DataState = "loading" | "live" | "empty" | "offline";

export function Markets() {
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
  const filtered = useMemo(() => source.filter((item) =>
    (tab === "all" || item.status === tab) &&
    (stock === "all" || (stock === "stock" ? Boolean(item.stockSymbol) : !item.stockSymbol)) &&
    [item.name, item.symbol, item.mint, item.stockSymbol].some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase()))
  ), [source, query, tab, stock]);

  return <main className="explore-page">
    <section className="product-hero">
      <div className="hero-copy">
        <div className="hero-kicker"><Droplets size={17}/> BUILT FOR THE PEOPLE WHO HOLD</div>
        <h1>Launch a coin.<br/><span>Build a portfolio.</span></h1>
        <p>AQUA turns trading activity into tokenized stock rewards for holders. Distribution is based on how much each wallet holds and how long it stays committed.</p>
        <div className="hero-actions">
          <Link className="primary" to="/create">Launch a holder-first coin <ArrowRight size={17}/></Link>
          <a className="secondary-button" href="#markets">Explore reward markets</a>
        </div>
        <div className="fact-row">
          <div><small>Into stock rewards</small><strong>1% of each trade</strong></div>
          <div><small>Reward weighting</small><strong>Amount × time</strong></div>
          <div><small>Stock asset utility</small><strong>Redeem where eligible</strong></div>
          <div><small>Creator reward cut</small><strong>None</strong></div>
        </div>
      </div>
      <HolderRewardFlow />
    </section>

    <section className="holder-standard">
      <div><span>THE AQUA STANDARD</span><h2>Coins designed around holder value.</h2></div>
      <p>Creators start the market. Holders receive the reward stream. Every eligible epoch shows which asset was purchased, how much entered the vault, and how distribution was calculated.</p>
    </section>

    <section className="market-workspace" id="markets">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">REWARD MARKETS</span>
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
      <div className="score-copy"><span className="eyebrow">AQUA SCORE</span><h2>Holding longer should matter.</h2><p>A momentary snapshot can reward wallets that arrive seconds before distribution. AQUA’s model is designed to combine eligible balance and holding time for a fairer share.</p><Link to="/how-it-works">See the reward model <ArrowRight size={16}/></Link></div>
      <div className="score-demo">
        <div className="score-formula"><span>eligible balance</span><b>×</b><span>holding time</span><b>=</b><strong>AQUA Score</strong></div>
        <div className="score-bars"><ScoreBar name="Mara" detail="1,000 coins · 30 days" width="100%"/><ScoreBar name="Jules" detail="1,000 coins · 7 days" width="23%"/><ScoreBar name="Ari" detail="250 coins · 30 days" width="25%"/></div>
        <small>Illustrative example. Final rules depend on the deployed reward program.</small>
      </div>
    </section>

    <section className="assurance-strip">
      <div><TimerReset/><span><b>Time-weighted</b><small>Conviction is part of the calculation.</small></span></div>
      <div><ShieldCheck/><span><b>Transparent vaults</b><small>Reward assets and epochs stay visible.</small></span></div>
      <div><Users/><span><b>Holder owned</b><small>The reward stream is not a creator cut.</small></span></div>
      <Link className="primary" to="/create">Launch on AQUA <ArrowRight size={17}/></Link>
    </section>
  </main>;
}

function ScoreBar({name,detail,width}:{name:string;detail:string;width:string}) { return <div><span><b>{name}</b><small>{detail}</small></span><i><em style={{width}}/></i></div>; }
