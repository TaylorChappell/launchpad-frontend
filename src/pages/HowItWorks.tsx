import { ArrowRight, CheckCircle2, CircleDollarSign, Coins, ExternalLink, Gift, LockKeyhole, ShieldAlert, TimerReset, Users, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { useRuntime } from "../context";

export function HowItWorks() {
  const { config } = useRuntime();
  const explorerBase = "https://explorer.solana.com/address/";
  return <main className="page how-page">
    <header className="how-hero"><h1>Rewards favor conviction, not snapshots.</h1><p>AQUA pairs every coin with a tokenized stock. Trading funds holder rewards while balance and time shape each wallet’s share.</p></header>

    <section className="holder-flow" aria-label="AQUA holder reward flow">
      <FlowNode icon={<CircleDollarSign/>} label="Coin trades" detail="Orca market activity"/>
      <ArrowRight/>
      <FlowNode icon={<Gift/>} label="Stock reward fee" detail="Separate reward route" featured/>
      <ArrowRight/>
      <FlowNode icon={<Coins/>} label="Stock vault" detail="The paired asset"/>
      <ArrowRight/>
      <FlowNode icon={<Users/>} label="Holders earn" detail="Weighted by amount and time"/>
    </section>

    <section className="score-explanation">
      <div className="technical-intro"><h2>Every wallet builds a score.</h2><p>Eligible balance gains weight for every second it remains held. Selling reduces future weight from that balance.</p><div className="formula-large"><span>balance</span><b>×</b><span>time held</span><b>=</b><strong>AQUA Score</strong></div></div>
      <div className="score-example"><header><b>Example epoch</b><small>Illustrative only</small></header><ExampleRow name="Mara" holding="1,000 coins for 30 days" score="30,000" share="67.4%" width="100%"/><ExampleRow name="Jules" holding="1,000 coins for 7 days" score="7,000" share="15.7%" width="23%"/><ExampleRow name="Ari" holding="250 coins for 30 days" score="7,500" share="16.9%" width="25%"/><footer>Scores are normalized across every eligible wallet in the epoch.</footer></div>
    </section>

    <section className="principles-section">
      <header><h2>The creator launches it. The community earns from it.</h2></header>
      <div className="detail-grid">
        <article className="detail-panel"><Waves/><h3>Separate reward vault</h3><p>Holder stock rewards do not become creator or platform revenue.</p></article>
        <article className="detail-panel"><TimerReset/><h3>Time has weight</h3><p>Sustained holdings earn more weight than a last-second snapshot.</p></article>
        <article className="detail-panel"><CheckCircle2/><h3>Published proofs</h3><p>Each claim uses a verifiable allocation proof tied to its reward epoch.</p></article>
      </div>
    </section>

    <section className="redemption-note"><div><Coins/><span><b>Tokenized stock assets</b><p>Rewards use the same stock token selected as the coin’s permanent Orca pair.</p></span></div><div className="legal"><ShieldAlert/>These products can be restricted by country, provider, or market status. The launched coin is not itself a share of the paired company.</div></section>

    <section className="infrastructure-details">
      <div><h2>Markets launch directly on Orca.</h2><p>AQUA creates a Token-2022 coin, opens its stock-paired Whirlpool, supplies liquidity, then permanently locks the position.</p><div className={`program-status ${config.transactionsEnabled ? "ready" : "inactive"}`}><LockKeyhole/><span><b>{config.transactionsEnabled ? "Direct Whirlpool launch configured" : "Transactions are currently disabled"}</b><small>{config.whirlpools.programId || "Orca Whirlpools program"}</small></span>{config.whirlpools.programId && <a href={`${explorerBase}${config.whirlpools.programId}${config.useTestnet ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" aria-label="Open program in Solana Explorer"><ExternalLink/></a>}</div></div>
      <div className="rule-table"><Rule title="Total transfer fee" value={`${(config.fees.transferFeeBps / 100).toFixed(2)}%`} text="Fixed into the token at launch."/><Rule title="Stock reward route" value={`${(config.fees.stockRewardsBps / 100).toFixed(2)}%`} text="Funds holder purchases of the paired stock."/><Rule title="Reward weighting" value="Balance × time" text="Determines each wallet’s relative epoch share."/><Rule title="Liquidity" value="Permanent lock" text="The initial Orca position cannot be withdrawn by the creator."/></div>
    </section>

    <section className="final-cta"><div><h2>Launch for the people who stay.</h2><p>Choose the coin, the stock, and the opening market price.</p></div><Link className="primary" to="/create">Launch on AQUA <ArrowRight size={17}/></Link></section>
  </main>;
}

function FlowNode({ icon, label, detail, featured = false }: { icon: React.ReactNode; label: string; detail: string; featured?: boolean }) {
  return <div className={`flow-step ${featured ? "featured" : ""}`}><span>{icon}</span><b>{label}</b><small>{detail}</small></div>;
}
function Rule({ title, value, text }: { title: string; value: string; text: string }) {
  return <div><span>{title}</span><b>{value}</b><p>{text}</p></div>;
}
function ExampleRow({ name, holding, score, share, width }: { name: string; holding: string; score: string; share: string; width: string }) {
  return <div className="example-row"><span><b>{name}</b><small>{holding}</small></span><div><i style={{ width }}/></div><strong>{score}<small>score · {share}</small></strong></div>;
}
