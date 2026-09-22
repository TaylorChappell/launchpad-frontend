import { WalletIdentity } from "../components/WalletIdentity";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, ExternalLink, LockKeyhole, MessageSquare, PanelsTopLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useWallet } from "../context";
import { TokenMark } from "../components/TokenCard";
import { CreatorFeeLock } from "../components/CreatorFeeLock";
import { CreatorFeeClaim } from "../components/CreatorFeeClaim";
import { CreatorRewardDeposit } from "../components/CreatorRewardDeposit";
import { ProjectUpdates } from "../components/ProjectUpdates";
import type { Launch } from "../types";

const money = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en");
const sections = [
  { key: "overview", name: "Overview", icon: PanelsTopLeft },
  { key: "fees", name: "Creator fees", icon: LockKeyhole },
  { key: "updates", name: "Project updates", icon: MessageSquare },
];
export function CreatorManage() {
  const { id = "" } = useParams(), wallet = useWallet();
  const [params, setParams] = useSearchParams();
  const selected = sections.some(item => item.key === params.get("tab")) ? params.get("tab")! : "overview";
  const [launch, setLaunch] = useState<Launch | null>(null), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLaunch(null); setError("");
    api.launch(id).then(result => { if (alive) setLaunch({ ...result.launch, creatorLock: result.creatorLock ?? undefined }); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : "Could not load this coin."); });
    return () => { alive = false; };
  }, [id, revision]);
  const refresh = () => setRevision(value => value + 1);
  if (error) return <main className="page manage-page"><div className="manage-gate"><h1>Dashboard unavailable</h1><p role="alert">{error}</p><button className="primary" onClick={refresh}>Try again</button></div></main>;
  if (!launch) return <main className="page"><div className="page-loading">Opening creator dashboard…</div></main>;
  if (wallet.address !== launch.creatorWallet) return <main className="page manage-page"><Link className="back" to={"/token/" + id}><ArrowLeft/>Back to market</Link><section className="manage-gate"><h1>{wallet.address ? "Switch to the creator wallet" : "Connect your creator wallet"}</h1><p>Manage this coin with <WalletIdentity wallet={launch.creatorWallet}/>.</p><button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button></section></main>;
  return <main className="page manage-page creator-dashboard">
    <div className="creator-dashboard-top"><Link className="back" to="/portfolio?tab=created"><ArrowLeft/>Your coins</Link><Link className="creator-market-link" to={"/token/" + id}>View market <ExternalLink size={14}/></Link></div>
    <header className="creator-dashboard-heading"><TokenMark launch={launch} large/><div><small>CREATOR DASHBOARD</small><h1>{launch.name} <span>${launch.symbol}</span></h1></div></header>
    <div className="creator-dashboard-layout">
      <nav className="creator-dashboard-nav" aria-label="Creator dashboard">{sections.map(item => <button key={item.key} aria-current={selected === item.key ? "page" : undefined} onClick={() => setParams({ tab: item.key })}><item.icon size={17}/>{item.name}</button>)}<Link to={"/studio?token=" + encodeURIComponent(launch.mint)}>Open Atlantis Studio <ArrowUpRight size={15}/></Link></nav>
      <div className="creator-dashboard-content" key={id + ":" + wallet.address}>
        {selected === "overview" && <>
          <section className="creator-dashboard-intro"><h2>Your market at a glance</h2><p>Support your holders, keep them informed, and manage your creator fees.</p></section>
          <section className="creator-dashboard-stats" aria-label="Market overview"><article><small>Holders</small><strong>{number.format(launch.holderCount)}</strong></article><article><small>24h trading volume</small><strong>{money.format(launch.volume24hUsd)}</strong></article><article><small>Rewards accumulated</small><strong>{money.format(launch.rewardAccumulatedUsd)}</strong></article></section>
          <CreatorRewardDeposit launch={launch}/>
          <div className="creator-dashboard-actions"><button onClick={() => setParams({ tab: "updates" })}><MessageSquare/><span><strong>Keep holders updated</strong><small>Share what you’re building and what’s next.</small></span><ArrowUpRight/></button><button onClick={() => setParams({ tab: "fees" })}><LockKeyhole/><span><strong>Manage creator fees</strong><small>{launch.creatorLock?.status === "active" ? "Your creator lock is active." : "Set up a token lock to earn creator fees."}</small></span><ArrowUpRight/></button></div>
        </>}
        {selected === "fees" && <><section className="creator-dashboard-intro"><h2>Creator fees</h2><p>Track your earnings and manage the supply you’ve committed.</p></section><CreatorFeeClaim launch={launch} onClaimed={refresh}/><CreatorFeeLock launch={launch} onChanged={refresh}/></>}
        {selected === "updates" && <ProjectUpdates launch={launch} compose/>}
      </div>
    </div>
  </main>;
}
