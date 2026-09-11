import { ArrowRight, Droplets, LineChart, LockKeyhole, ShieldCheck, Waves } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  { icon: LineChart, number: "01", title: "Start on a virtual curve", text: "A new token begins trading against virtual SOL reserves. Price moves predictably as tokens are bought and sold." },
  { icon: Droplets, number: "02", title: "Fees follow clear routes", text: "Every curve trade includes a 1% platform fee. Stock-enabled launches add a separate 1% holder reward fee." },
  { icon: ShieldCheck, number: "03", title: "The stock reserve grows", text: "Reward fees accumulate in a visible vault and are converted into the market's selected tokenized stock." },
  { icon: Waves, number: "04", title: "Liquidity graduates", text: "When the curve reaches 85 SOL, liquidity moves into an Orca pool and the market enters its next stage." },
];

export function HowItWorks() {
  return <main className="page how-page">
    <section className="how-hero"><span className="eyebrow">HOW IT WORKS</span><h1>One clear current from launch to liquidity.</h1><p>Equity Launch gives creators a transparent curve, optional tokenized stock rewards and a defined path into Orca.</p></section>
    <section className="how-steps">{steps.map(({ icon: Icon, number, title, text }) => <article key={number}><header><span>{number}</span><Icon /></header><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section className="fee-panel"><div><span className="eyebrow">FEE STRUCTURE</span><h2>Simple enough to verify.</h2><p>Stock rewards are kept separate from platform revenue so every amount can be tracked from collection to distribution.</p><div className="fee-note"><LockKeyhole /> Your wallet approves every launch and trade.</div></div><div className="fee-table"><div><span>Platform fee</span><strong>1.00%</strong><small>On every virtual curve trade</small></div><div><span>Stock reward fee</span><strong>1.00%</strong><small>Only on stock-enabled launches</small></div><div><span>Graduation target</span><strong>85 SOL</strong><small>Before Orca liquidity</small></div></div></section>
    <section className="mode-section"><div className="section-heading"><div><span className="eyebrow">TWO LAUNCH MODES</span><h2>Choose the structure that fits.</h2></div></div><div className="mode-grid"><article><span>STANDARD</span><h3>SOL market</h3><p>A direct token launch with a 1% platform fee and no stock reward reserve.</p><strong>Token / SOL</strong></article><article className="featured"><span>STOCK REWARDS</span><h3>Reward-enabled market</h3><p>An additional 1% is reserved to purchase the selected tokenized stock for holders.</p><strong>Token / xStock rewards</strong></article></div></section>
    <section className="launch-cta"><div><span className="eyebrow">CREATE A MARKET</span><h2>Set your launch in motion.</h2><p>Choose the name, pair, socials and optional developer buy before signing with your wallet.</p></div><Link className="primary hero-primary" to="/create">Start a launch <ArrowRight size={17} /></Link></section>
  </main>;
}

