import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Droplets, Search, ShieldCheck, Sparkles, TrendingUp, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DEMO } from "../fixtures";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";

const flow = [
  { n: "01", title: "Launch on the curve", text: "Create a token with optional developer buy and social links. Trading starts immediately on a virtual SOL curve." },
  { n: "02", title: "Build the reserve", text: "Every trade moves the curve. Stock-enabled markets direct an extra 1% into their holder reward reserve." },
  { n: "03", title: "Reward holders", text: "Accumulated SOL is converted into the selected tokenized stock and prepared for transparent holder distributions." },
  { n: "04", title: "Graduate to Orca", text: "At 85 SOL, the market graduates into permanent Orca liquidity with its full trading history intact." },
];

export function Markets() {
  const [launches, setLaunches] = useState<Launch[]>(DEMO);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [stock, setStock] = useState("all");
  useEffect(() => { api.launches().then((data) => { if (data.launches.length) setLaunches(data.launches); }).catch(() => undefined); }, []);
  const filtered = useMemo(() => launches.filter((item) => (tab === "all" || item.status === tab) && (stock === "all" || (stock === "stock" ? Boolean(item.stockSymbol) : !item.stockSymbol)) && [item.name, item.symbol, item.mint, item.stockSymbol].some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase()))), [launches, query, tab, stock]);

  return <main className="explore-page">
    <section className="ocean-hero">
      <div className="hero-current hero-current-one" />
      <div className="hero-current hero-current-two" />
      <div className="hero-copy">
        <div className="hero-kicker"><span><Waves size={15} /></span> Solana markets with real-world rewards</div>
        <h1>Launch a token.<br /><em>Reward conviction.</em></h1>
        <p>Community tokens begin on a virtual curve, graduate into Orca liquidity, and can turn trading activity into tokenized stock rewards for holders.</p>
        <div className="hero-actions">
          <Link className="primary hero-primary" to="/create">Launch a token <ArrowRight size={17} /></Link>
          <a className="secondary-button" href="#popular">Explore markets</a>
        </div>
        <div className="hero-trust">
          <span><ShieldCheck size={15} /> Wallet approved</span>
          <span><BadgeCheck size={15} /> Transparent fees</span>
          <span><Droplets size={15} /> Orca liquidity</span>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="art-glow" />
        <img src={`${import.meta.env.BASE_URL}hero-liquidity.png`} alt="" />
        <div className="float-card float-card-top"><small>HOLDER REWARDS</small><strong>1% into xStocks</strong><span>Automatic reserve</span></div>
        <div className="float-card float-card-bottom"><i /><div><small>GRADUATION</small><strong>Orca liquidity</strong></div></div>
      </div>
      <div className="hero-stats">
        <Metric label="Volume flowing" value="$1.42M" detail="24 hour volume" />
        <Metric label="Active markets" value={String(launches.length)} detail="Curve and Orca" />
        <Metric label="Holder rewards" value="$601K" detail="Distributed onchain" />
        <Metric label="Graduation" value="85 SOL" detail="Into Orca liquidity" />
      </div>
    </section>

    <section className="explore-shell" id="popular">
      <div className="section-heading">
        <div><span className="eyebrow">LIVE MARKETS</span><h2>Popular launches</h2><p>Track the communities building momentum across the curve and Orca.</p></div>
        <Link to="/create">Create your market <ArrowRight size={15} /></Link>
      </div>
      <div className="ticker">
        <div><TrendingUp size={14} /><strong>NVDAx</strong><span>$176.42</span><em>+2.8%</em></div>
        <div><strong>AAPLx</strong><span>$229.18</span><em>+1.1%</em></div>
        <div><strong>TSLAx</strong><span>$421.07</span><em className="negative">-0.7%</em></div>
        <div><strong>SPYx</strong><span>$687.33</span><em>+0.5%</em></div>
      </div>
      <section className="market-controls">
        <div className="tabs">{[["all", "All markets"], ["curve", "On the curve"], ["orca", "Orca live"]].map(([value, label]) => <button className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
        <div className="filters"><select aria-label="Filter by reward type" value={stock} onChange={(event) => setStock(event.target.value)}><option value="all">All pairs</option><option value="stock">Stock rewards</option><option value="sol">SOL only</option></select><label><Search size={15} /><input aria-label="Search markets" placeholder="Search token or mint" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      </section>
      <div className="token-grid">{filtered.map((launch) => <TokenCard key={launch.id} launch={launch} />)}</div>
      {!filtered.length && <div className="empty">No markets match those filters.</div>}
    </section>

    <section className="flow-section">
      <div className="section-heading centered"><div><span className="eyebrow">FROM IDEA TO LIQUIDITY</span><h2>A launch that moves with the market</h2><p>Every stage is visible, from the first curve trade to the final liquidity position.</p></div></div>
      <div className="flow-grid">{flow.map((step) => <article key={step.n}><span>{step.n}</span><div className="flow-icon">{step.n === "01" ? <Sparkles /> : step.n === "02" ? <TrendingUp /> : step.n === "03" ? <Droplets /> : <Waves />}</div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      <Link className="text-link" to="/how-it-works">See the complete process <ArrowRight size={16} /></Link>
    </section>

    <section className="rewards-feature">
      <div className="reward-visual" aria-hidden="true"><div className="reward-rings"><i /><i /><i /></div><div className="reward-core">NVDA<span>xStock</span></div><div className="reward-drop drop-one" /><div className="reward-drop drop-two" /></div>
      <div className="reward-copy"><span className="eyebrow">STOCK REWARDS</span><h2>Trading activity becomes holder value.</h2><p>Stock-enabled launches collect an additional 1% reward fee. The reserve purchases the selected tokenized stock and prepares it for holder distribution.</p><ul><li><BadgeCheck /> Every reserve purchase is visible onchain</li><li><BadgeCheck /> Rewards accumulate before economical distribution</li><li><BadgeCheck /> Standard SOL launches remain available</li></ul><Link className="secondary-button" to="/rewards">View holder rewards <ArrowRight size={16} /></Link></div>
    </section>

    <section className="launch-cta"><div><span className="eyebrow">READY TO LAUNCH</span><h2>Bring your market to the surface.</h2><p>Set the token, choose its reward structure and begin the curve in one clear flow.</p></div><Link className="primary hero-primary" to="/create">Launch your token <ArrowRight size={17} /></Link></section>
  </main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>; }

