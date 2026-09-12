import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CircleCheck, Clock3, Coins, Gift, ShieldAlert, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { Launch, RewardEpoch } from "../types";

const money = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits:3 });

export function Rewards() {
  const wallet = useWallet();
  const { config } = useRuntime();
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
    <header className="rewards-heading"><div><span className="eyebrow">STOCK REWARDS</span><h1>Follow every reward.</h1><p>Track reserve purchases, holder snapshots and distribution epochs without mixing reward funds with platform revenue.</p></div><div className={`data-badge ${state}`}><Clock3/><span><b>{state === "ready" ? "ONCHAIN INDEX" : state === "loading" ? "LOADING" : "UNAVAILABLE"}</b><small>{state === "ready" ? `${config.network} data` : state === "offline" ? "Backend connection failed" : "Fetching epochs"}</small></span></div></header>

    <section className="reward-overview">
      <Stat label="Distributed" value={money.format(totals.distributed)} detail="Published reward epochs"/>
      <Stat label="Pending distribution" value={money.format(totals.pending)} detail="Prepared or claimable epochs"/>
      <Stat label="Eligible records" value={totals.wallets.toLocaleString()} detail="Across indexed snapshots"/>
      <Stat label="Reward markets" value={markets.length.toString()} detail="Verified stock routes"/>
    </section>

    {!wallet.address ? <section className="wallet-card"><div className="wallet-card-icon"><WalletCards/></div><div><span className="eyebrow">YOUR WALLET</span><h2>Connect to check eligibility</h2><p>AQUA only shows wallet-specific balances after you connect. Connecting does not authorize a transaction.</p></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></section> : <section className="wallet-card connected"><div className="wallet-card-icon"><CircleCheck/></div><div><span className="eyebrow">CONNECTED WALLET</span><h2>Claim lookup is not published yet</h2><p>{wallet.address.slice(0,7)}…{wallet.address.slice(-7)} is connected, but the current API does not expose wallet allocation proofs.</p></div><button className="secondary-button" disabled>Claims unavailable</button></section>}

    <div className="reward-layout">
      <section className="reward-ledger">
        <header><div><h2>Distribution ledger</h2><p>Each row corresponds to a backend-indexed reward epoch.</p></div><span>{epochs.length} epochs</span></header>
        {state === "loading" ? <div className="ledger-loading"><i/><i/><i/></div> : epochs.length ? <div className="ledger-table"><div className="ledger-row ledger-head"><span>Asset</span><span>Status</span><span>Amount</span><span>Wallets</span><span>Snapshot slot</span></div>{epochs.map(epoch => <div className="ledger-row" key={epoch.id}><span><b>{epoch.stockSymbol}</b><small>{epoch.launchId}</small></span><span><em className={epoch.status.toLowerCase()}>{epoch.status}</em></span><span><b>{number.format(epoch.totalStockAmount)} {epoch.stockSymbol}</b><small>{money.format(epoch.totalUsd)}</small></span><span>{epoch.eligibleHolders.toLocaleString()}</span><span><code>{epoch.snapshotSlot || "Pending"}</code></span></div>)}</div> : <div className="ledger-empty"><Coins/><h3>No reward epochs yet</h3><p>The ledger will populate after a stock-enabled market collects enough value for an economical distribution.</p></div>}
      </section>

      <aside className="reward-explainer"><Gift/><span className="eyebrow">EPOCH ROUTE</span><h2>From fee to holder</h2><ol><li><i>1</i><span><b>Collect</b>The contract separates the 1% reward fee.</span></li><li><i>2</i><span><b>Purchase</b>A keeper acquires the verified xStock.</span></li><li><i>3</i><span><b>Snapshot</b>Balances are recorded in a Merkle epoch.</span></li><li><i>4</i><span><b>Claim</b>Eligible wallets claim from the published allocation.</span></li></ol><div className="legal"><ShieldAlert/>Tokenized stocks can be halted or restricted. Eligibility depends on jurisdiction and provider rules.</div><Link to="/how-it-works">Read the technical flow <ArrowUpRight size={14}/></Link></aside>
    </div>
  </main>;
}

function Stat({label,value,detail}:{label:string;value:string;detail:string}) { return <div><small>{label}</small><b>{value}</b><span>{detail}</span></div>; }
