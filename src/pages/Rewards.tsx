import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CircleCheck, Clock3, Coins, Gift, ShieldAlert, Sparkles, TimerReset, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useWallet } from "../context";
import type { Launch, RewardEpoch } from "../types";

const money = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits:3 });

export function Rewards() {
  const wallet = useWallet();
  const [epochs,setEpochs] = useState<RewardEpoch[]>([]);
  const [markets,setMarkets] = useState<Launch[]>([]);
  const [state,setState] = useState<"loading"|"ready"|"offline">("loading");

  useEffect(() => {
    Promise.all([api.rewards(), api.launches()]).then(([rewardData, launchData]) => {
      setEpochs(rewardData.epochs); setMarkets(launchData.launches.filter(item => item.stockSymbol)); setState("ready");
    }).catch(() => setState("offline"));
  }, []);

  const totals = useMemo(() => ({
    distributed: epochs.filter(e => ["distributed","completed","claimable"].includes(e.status.toLowerCase())).reduce((sum,e) => sum + Number(e.totalUsd || 0), 0),
    pending: epochs.filter(e => !["distributed","completed"].includes(e.status.toLowerCase())).reduce((sum,e) => sum + Number(e.totalUsd || 0), 0),
    wallets: epochs.reduce((sum,e) => sum + Number(e.eligibleHolders || 0), 0),
  }), [epochs]);

  return <main className="page rewards-page">
    <header className="rewards-heading"><div><h1>Your holding time has value.</h1><p>Track the tokenized stocks purchased for holders, follow each distribution epoch, and connect your wallet for a personal reward view.</p></div><div className={`data-badge ${state}`}><Clock3/><span><b>{state === "ready" ? "REWARD INDEX" : state === "loading" ? "LOADING" : "UNAVAILABLE"}</b><small>{state === "ready" ? "Epoch data connected" : state === "offline" ? "Backend connection failed" : "Fetching reward records"}</small></span></div></header>

    <section className="reward-overview">
      <Stat label="Distributed" value={money.format(totals.distributed)} detail="Published reward epochs"/>
      <Stat label="Preparing" value={money.format(totals.pending)} detail="Accumulating or claimable"/>
      <Stat label="Eligible records" value={totals.wallets.toLocaleString()} detail="Across indexed epochs"/>
      <Stat label="Reward markets" value={markets.length.toString()} detail="Tokenized stock routes"/>
    </section>

    {!wallet.address ? <section className="wallet-card"><div className="wallet-card-icon"><WalletCards/></div><div><span className="eyebrow">YOUR REWARD VIEW</span><h2>See what your time has earned</h2><p>Connecting lets AQUA look up wallet-specific eligibility. It never authorizes a claim or trade.</p></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></section> : <section className="wallet-card connected"><div className="wallet-card-icon"><CircleCheck/></div><div><span className="eyebrow">WALLET CONNECTED</span><h2>Allocation proofs are not published yet</h2><p>{wallet.address.slice(0,7)}…{wallet.address.slice(-7)} is connected. Personal AQUA Score and claims will appear when the API exposes allocation proofs.</p></div><button className="secondary-button" disabled>Claims unavailable</button></section>}

    <section className="aqua-score-card">
      <div><span className="score-icon"><Sparkles/></span><h2>AQUA Score</h2><p>Your share of an epoch is designed around both eligible balance and holding duration. That gives long-term holders more influence than a last-second wallet snapshot.</p></div>
      <div className="score-equation"><span><b>Eligible balance</b><small>How much you hold</small></span><strong>×</strong><span><b>Holding time</b><small>How long you hold</small></span><strong>=</strong><span className="score-result"><b>Reward weight</b><small>Your share of the epoch</small></span></div>
    </section>

    <div className="reward-layout">
      <section className="reward-ledger">
        <header><div><h2>Transparent reward ledger</h2><p>Every indexed row identifies the stock asset, amount, eligible records and snapshot.</p></div><span>{epochs.length} epochs</span></header>
        {state === "loading" ? <div className="ledger-loading"><i/><i/><i/></div> : epochs.length ? <div className="ledger-table"><div className="ledger-row ledger-head"><span>Asset</span><span>Status</span><span>Amount</span><span>Wallets</span><span>Snapshot slot</span></div>{epochs.map(epoch => <div className="ledger-row" key={epoch.id}><span><b>{epoch.stockSymbol}</b><small>{epoch.launchId}</small></span><span><em className={epoch.status.toLowerCase()}>{epoch.status}</em></span><span><b>{number.format(epoch.totalStockAmount)} {epoch.stockSymbol}</b><small>{money.format(epoch.totalUsd)}</small></span><span>{epoch.eligibleHolders.toLocaleString()}</span><span><code>{epoch.snapshotSlot || "Pending"}</code></span></div>)}</div> : <div className="ledger-empty"><Coins/><h3>The first reward epoch is still ahead</h3><p>The ledger will populate after a stock-enabled market collects enough value for an economical purchase and distribution.</p></div>}
      </section>

      <aside className="reward-explainer"><Gift/><span className="eyebrow">VALUE ROUTE</span><h2>Trade to portfolio</h2><ol><li><i><Coins/></i><span><b>Trade</b>Activity creates the holder reward fee.</span></li><li><i><Gift/></i><span><b>Purchase</b>The reserve buys the verified stock token in batches.</span></li><li><i><TimerReset/></i><span><b>Measure</b>Balance and time determine reward weight.</span></li><li><i><CircleCheck/></i><span><b>Distribute</b>Eligible wallets receive a published allocation.</span></li></ol><div className="legal"><ShieldAlert/>Tokenized stocks can be halted or restricted. Availability and redemption depend on jurisdiction and provider rules.</div><Link to="/how-it-works">Understand the reward model <ArrowUpRight size={14}/></Link></aside>
    </div>
  </main>;
}

function Stat({label,value,detail}:{label:string;value:string;detail:string}) { return <div><small>{label}</small><b>{value}</b><span>{detail}</span></div>; }
