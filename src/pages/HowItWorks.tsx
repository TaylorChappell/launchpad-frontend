import { ArrowRight, CheckCircle2, CircleDollarSign, ExternalLink, GitBranch, Landmark, LockKeyhole, ShieldAlert, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { useRuntime } from "../context";

export function HowItWorks() {
  const { config } = useRuntime();
  const explorerBase = config.network === "devnet" ? "https://explorer.solana.com/address/" : "https://explorer.solana.com/address/";
  return <main className="page how-page">
    <header className="how-hero"><span className="eyebrow">SYSTEM MECHANISM</span><h1>Know where every unit goes.</h1><p>AQUA separates pricing, platform revenue, reward reserves and liquidity migration into explicit stages.</p></header>

    <section className="system-map" aria-label="AQUA transaction flow">
      <div className="map-grid">
        <MapNode icon={<CircleDollarSign/>} label="Wallet trade" detail="User approved"/>
        <span className="map-arrow"><ArrowRight/></span>
        <MapNode icon={<GitBranch/>} label="Virtual curve" detail="Published reserve model" featured/>
        <span className="map-arrow"><ArrowRight/></span>
        <div className="map-split"><MapNode icon={<Landmark/>} label="Platform route" detail={`${(config.fees.platformBps/100).toFixed(2)}% each curve trade`}/><MapNode icon={<Waves/>} label="Reward reserve" detail={`${(config.fees.rewardsBps/100).toFixed(2)}% when enabled`}/></div>
      </div>
      <div className="graduation-route"><span>Market reserve reaches {config.graduationSol} SOL</span><i/><b>Eligible for Orca liquidity migration</b></div>
    </section>

    <section className="technical-layout">
      <div className="technical-intro"><span className="eyebrow">EXACT RULES</span><h2>What the interface can verify</h2><p>These values come from the active backend configuration. Contract-level behavior must match the deployed program before live transactions are enabled.</p><div className={`program-status ${config.transactionsEnabled?"ready":"inactive"}`}><LockKeyhole/><span><b>{config.transactionsEnabled?"Program configured":"No live program configured"}</b><small>{config.programId ? config.programId : `${config.network} transactions are disabled`}</small></span>{config.programId&&<a href={`${explorerBase}${config.programId}${config.network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" aria-label="Open program in Solana Explorer"><ExternalLink/></a>}</div></div>
      <div className="rule-table">
        <Rule title="Pricing" value="Virtual reserve curve" text="Buy and sell quotes use the curve reserves returned for the market."/>
        <Rule title="Platform fee" value={`${(config.fees.platformBps/100).toFixed(2)}%`} text="Applied to virtual curve trades and routed separately from rewards."/>
        <Rule title="Reward fee" value={`${(config.fees.rewardsBps/100).toFixed(2)}% optional`} text="Only applies when the launch selects a verified stock reward asset."/>
        <Rule title="Graduation" value={`${config.graduationSol} SOL`} text="The market becomes eligible for Orca migration at the configured reserve target."/>
      </div>
    </section>

    <section className="details-section">
      <header><span className="eyebrow">OPERATIONAL DETAILS</span><h2>Questions serious traders should ask</h2></header>
      <div className="detail-grid">
        <article className="detail-panel"><h3>Before graduation</h3><ul><li><CheckCircle2/>The market trades against virtual SOL reserves.</li><li><CheckCircle2/>Quotes include the applicable fee routes.</li><li><CheckCircle2/>Progress is measured against the configured reserve target.</li></ul></article>
        <article className="detail-panel"><h3>Stock rewards</h3><ul><li><CheckCircle2/>Only verified Solana xStock mints may be selected.</li><li><CheckCircle2/>Reward epochs record the asset, amount, wallet count and snapshot slot.</li><li><CheckCircle2/>A failed registry check disables stock launches instead of guessing.</li></ul></article>
        <article className="detail-panel warning"><h3>Deployment requirements</h3><ul><li><ShieldAlert/>Live behavior depends on the deployed and audited Solana program.</li><li><ShieldAlert/>LP ownership, authority controls and migration transactions must be verified onchain.</li><li><ShieldAlert/>AQUA disables transaction submission when a program is not configured.</li></ul></article>
      </div>
    </section>

    <section className="mode-comparison"><div><span className="eyebrow">LAUNCH OPTIONS</span><h2>Choose one fee route.</h2></div><div className="mode-card"><span>SOL MARKET</span><b>1.00%</b><p>Platform fee only. Graduates toward token and SOL liquidity.</p></div><div className="mode-card featured"><span>STOCK REWARDS</span><b>2.00%</b><p>1% platform fee plus a separate 1% stock reward reserve.</p></div></section>

    <section className="final-cta"><div><span className="eyebrow">CREATE MARKET</span><h2>Review the terms before you sign.</h2><p>The launch flow shows the active network, fee routes and transaction availability.</p></div><Link className="primary" to="/create">Configure a launch <ArrowRight size={17}/></Link></section>
  </main>;
}

function MapNode({icon,label,detail,featured=false}:{icon:React.ReactNode;label:string;detail:string;featured?:boolean}) { return <div className={`map-node ${featured?"featured":""}`}><span>{icon}</span><b>{label}</b><small>{detail}</small></div>; }
function Rule({title,value,text}:{title:string;value:string;text:string}) { return <div><span>{title}</span><b>{value}</b><p>{text}</p></div>; }
