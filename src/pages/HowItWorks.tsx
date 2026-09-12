import { ArrowRight, CheckCircle2, CircleDollarSign, Coins, ExternalLink, Gift, LockKeyhole, ShieldAlert, TimerReset, Users, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { useRuntime } from "../context";

export function HowItWorks() {
  const { config } = useRuntime();
  const explorerBase = "https://explorer.solana.com/address/";
  return <main className="page how-page">
    <header className="how-hero"><h1>Rewards favor conviction, not snapshots.</h1><p>AQUA is built for coins that create ongoing value for the people who hold them. Trading can fund a transparent stock vault, while balance and time shape each holder’s share.</p></header>

    <section className="holder-flow" aria-label="AQUA holder reward flow">
      <FlowNode icon={<CircleDollarSign/>} label="Coin trades" detail="Community activity"/>
      <ArrowRight/>
      <FlowNode icon={<Gift/>} label="1% reward stream" detail="Separate from revenue" featured/>
      <ArrowRight/>
      <FlowNode icon={<Coins/>} label="Stock vault" detail="Verified tokenized asset"/>
      <ArrowRight/>
      <FlowNode icon={<Users/>} label="Eligible holders" detail="Weighted by amount and time"/>
    </section>

    <section className="score-explanation">
      <div className="technical-intro"><span className="eyebrow">THE REWARD MODEL</span><h2>Every wallet builds a score.</h2><p>Instead of using one balance snapshot alone, the reward model is designed to track eligible balance over time. The longer a wallet maintains a balance, the more weight it can build for the epoch.</p><div className="formula-large"><span>balance</span><b>×</b><span>time held</span><b>=</b><strong>AQUA Score</strong></div></div>
      <div className="score-example"><header><b>Example epoch</b><small>Illustrative only</small></header><ExampleRow name="Mara" holding="1,000 coins for 30 days" score="30,000" share="67.4%" width="100%"/><ExampleRow name="Jules" holding="1,000 coins for 7 days" score="7,000" share="15.7%" width="23%"/><ExampleRow name="Ari" holding="250 coins for 30 days" score="7,500" share="16.9%" width="25%"/><footer>Example percentages normalize these three wallet scores together.</footer></div>
    </section>

    <section className="principles-section">
      <header><span className="eyebrow">HOLDER-FIRST PRINCIPLES</span><h2>The creator launches it. The community earns from it.</h2></header>
      <div className="detail-grid">
        <article className="detail-panel"><Waves/><h3>Separate reward vault</h3><p>The stock reward fee follows its own route rather than becoming creator or platform revenue.</p></article>
        <article className="detail-panel"><TimerReset/><h3>Time has weight</h3><p>Holding duration is intended to reduce last-second farming and reward sustained participation.</p></article>
        <article className="detail-panel"><CheckCircle2/><h3>Visible proof</h3><p>Each published epoch records its asset, amount, eligible wallets, snapshot slot, and allocation root.</p></article>
      </div>
    </section>

    <section className="redemption-note"><div><Coins/><span><b>Real tokenized stock assets</b><p>Reward assets can represent instruments such as NVIDIA or Apple xStocks. Where the holder and provider are eligible, those assets may be transferred or redeemed through the provider’s process.</p></span></div><div className="legal"><ShieldAlert/>These products can be restricted by country, provider, or market status. A coin is not itself a share of the paired company.</div></section>

    <section className="infrastructure-details">
      <div><span className="eyebrow">UNDER THE SURFACE</span><h2>Markets launch through Orca.</h2><p>AQUA launches coins on Orca Wavebreak. Trading begins on its transparent bonding curve, then the market graduates into an Orca Whirlpool after reaching the configured bonding target.</p><div className={`program-status ${config.transactionsEnabled?"ready":"inactive"}`}><LockKeyhole/><span><b>{config.transactionsEnabled?"Wavebreak launch configured":"Transactions are currently disabled"}</b><small>{config.programId ? config.programId : "Orca Wavebreak integration is required for live actions"}</small></span>{config.programId&&<a href={`${explorerBase}${config.programId}${config.useTestnet ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" aria-label="Open program in Solana Explorer"><ExternalLink/></a>}</div></div>
      <div className="rule-table"><Rule title="Platform fee" value={`${(config.fees.platformBps/100).toFixed(2)}%`} text="Supports the launchpad and remains separate from holder rewards."/><Rule title="Stock reward stream" value={`${(config.fees.rewardsBps/100).toFixed(2)}%`} text="Applies when a verified tokenized stock reward is selected."/><Rule title="Reward weighting" value="Balance × time" text="Designed to determine each eligible wallet’s relative epoch share."/><Rule title="Wavebreak graduation" value={`${config.graduationSol} SOL`} text="The bonding target before liquidity graduates into an Orca Whirlpool."/></div>
    </section>

    <section className="final-cta"><div><h2>Launch for the people who stay.</h2><p>Choose a coin identity and the tokenized stock your holders can earn.</p></div><Link className="primary" to="/create">Create a holder-first coin <ArrowRight size={17}/></Link></section>
  </main>;
}

function FlowNode({icon,label,detail,featured=false}:{icon:React.ReactNode;label:string;detail:string;featured?:boolean}) { return <div className={`flow-step ${featured?"featured":""}`}><span>{icon}</span><b>{label}</b><small>{detail}</small></div>; }
function Rule({title,value,text}:{title:string;value:string;text:string}) { return <div><span>{title}</span><b>{value}</b><p>{text}</p></div>; }
function ExampleRow({name,holding,score,share,width}:{name:string;holding:string;score:string;share:string;width:string}) { return <div className="example-row"><span><b>{name}</b><small>{holding}</small></span><div><i style={{width}}/></div><strong>{score}<small>score · {share}</small></strong></div>; }
