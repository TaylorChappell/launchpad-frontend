import { RippleRewards } from "../components/RippleRewards";
import { WalletIdentity } from "../components/WalletIdentity";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Coins, Gift, Layers3, RefreshCw, Wallet } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { TokenMark } from "../components/TokenCard";
import { CreatorFeeClaim } from "../components/CreatorFeeClaim";
import { activeCreatorLock, creatorLockPercentLabel } from "../creator-lock";
import { WalletRewards } from "../components/WalletRewards";
import { HoldingUpdates } from "../components/HoldingUpdates";
import { displayTokenAmount } from "../trade-quote";
import type { Launch, WalletRewardsResponse } from "../types";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD"});
type Holdings=Awaited<ReturnType<typeof api.holdings>>["holdings"];
type History=Awaited<ReturnType<typeof api.claimHistory>>;
export function Portfolio(){
  const wallet=useWallet(),{config}=useRuntime();
  return <PortfolioContent key={config.network+":"+wallet.address} address={wallet.address}/>;
}
function PortfolioContent({address}:{address:string|null}){
  const wallet=useWallet(),{config}=useRuntime(),[params,setParams]=useSearchParams();
  const tabs=["Holdings","Rewards","Ripple","Activity","Created"] as const;
  const tab=tabs.find(t=>t.toLowerCase()===params.get("tab"))??"Holdings";
  const [holdings,setHoldings]=useState<Holdings|null>(null),[rewards,setRewards]=useState<WalletRewardsResponse|null>(null);
  const [history,setHistory]=useState<History|null>(null),[created,setCreated]=useState<Launch[]|null>(null);
  const [errors,setErrors]=useState<Record<string,string>>({}),[revision,setRevision]=useState(0);
  const [more,setMore]=useState(false),[offset,setOffset]=useState(0),[loadingMore,setLoadingMore]=useState(false);
  useEffect(()=>{
    if(!address)return;
    let active=true,pending=false;
    const load=async()=>{
      if(pending)return;pending=true;
      const results=await Promise.allSettled([api.holdings(address),api.rewards(address),api.claimHistory(address)] as const);
      if(active){
        const [h,r,c]=results;const next:Record<string,string>={};
        if(h.status==="fulfilled")setHoldings(h.value.holdings);else next.holdings="Holdings could not refresh.";
        if(r.status==="fulfilled")setRewards(r.value);else next.rewards="Rewards could not refresh.";
        if(c.status==="fulfilled")setHistory(c.value);else next.activity="Claim history could not refresh.";
        setErrors(old=>({...old,holdings:"",rewards:"",activity:"",...next}));
      }pending=false;
    };
    void load();const refresh=()=>{if(document.visibilityState==="visible")void load();};
    const timer=window.setInterval(refresh,20_000);window.addEventListener("focus",refresh);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[address,revision]);
  useEffect(()=>{
    if(!address||tab!=="Created")return;let active=true;
    api.launches({creator:address,status:"live",limit:24,sort:"creator_claims"}).then(d=>{if(active){setCreated(d.launches.filter(l=>l.status==="live"));setMore(d.hasMore);setOffset(d.nextOffset);setErrors(e=>({...e,created:""}));}}).catch(()=>{if(active)setErrors(e=>({...e,created:"Your created markets could not load."}));});
    return()=>{active=false;};
  },[address,tab,revision]);
  const selectTab=(name:string)=>setParams(name==="Holdings"?{}:{tab:name.toLowerCase()});
  const value=holdings?.reduce((s,h)=>s+(h.valueUsd??0),0),unpriced=holdings?.filter(h=>h.valueUsd===null).length??0;
  const claimable=rewards?.markets.filter(m=>m.canClaim).reduce((s,m)=>s+m.netClaimableUsdCents/100,0);
  const pending=rewards?.markets.reduce((s,m)=>s+m.pendingUsdCents/100,0);
  const refresh=()=>setRevision(n=>n+1);
  if(!address)return <main className="page holder-workspace">
    <header className="workspace-heading"><div><h1>My holdings</h1><p>A home for the coins and communities you hold.</p></div></header>
    <section className="portfolio-connect"><div className="portfolio-connect-copy"><span className="workspace-icon"><Wallet size={25}/></span><h1>Your holdings.<br/>Your rewards.</h1><p>Follow your positions, collect your rewards and see what your communities are building.</p><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet <ArrowRight size={17}/></button><Link className="portfolio-connect-help" to="/claim-by-address">Can’t connect your wallet?</Link></div><div className="portfolio-connect-features">
      <div><Coins/><span><b>Every position, one view</b><p>Your token balances and current market values.</p></span></div>
      <div><Gift/><span><b>Rewards within reach</b><p>See what’s available and claim directly to your wallet.</p></span></div>
      <div><Layers3/><span><b>Your community activity</b><p>Claim receipts, governance and the coins you’ve created.</p></span></div>
    </div></section>
  </main>;
  return <main className="page holder-workspace">
    <header className="workspace-heading"><div><h1>My holdings</h1><p>Positions, rewards and the communities you’re part of.</p></div><div className="workspace-heading-actions"><span className="wallet-address"><Wallet size={14}/><WalletIdentity wallet={address}/></span><button className="workspace-refresh" aria-label="Refresh holdings" onClick={refresh}><RefreshCw size={16}/></button></div></header>
    {Object.values(errors).some(Boolean)&&<p className="danger-note" role="alert">{Object.values(errors).filter(Boolean).join(" ")} Previous values may be stale. <button className="text-button" onClick={refresh}>Try again</button></p>}
    <section className="portfolio-overview">
      <article className="portfolio-value"><span className="workspace-eyebrow">HOLDINGS VALUE</span><strong>{value===undefined?"—":usd.format(value)}</strong><span>{holdings===null?"Loading positions…":holdings.length+" positions"}{unpriced>0?" · "+unpriced+" awaiting price":""}</span><Link to="/">Explore markets <ArrowUpRight size={15}/></Link></article>
      <article className="portfolio-reward-summary"><img className="rewards-gift-art" src={import.meta.env.BASE_URL+"aqua-gift.webp"} alt=""/><small>Ready to claim</small><strong>{claimable===undefined?"—":usd.format(claimable)}</strong><div><span>Pending allocation <b>{pending===undefined?"—":usd.format(pending)}</b></span><button className="primary" onClick={()=>selectTab("Rewards")}>View rewards <ArrowRight size={16}/></button></div></article>
    </section>
    <nav className="workspace-tabs" aria-label="Portfolio sections">{tabs.map(t=><button key={t} aria-current={tab===t?"page":undefined} onClick={()=>selectTab(t)}>{t}{t==="Holdings"&&holdings&&<span>{holdings.length}</span>}{t==="Rewards"&&rewards?.markets.some(m=>m.canClaim)&&<i/>}</button>)}</nav>
    {tab==="Holdings"&&<section className="workspace-panel">
      <header><h2>Your positions</h2></header>
      {holdings===null?<div className="workspace-loading">{errors.holdings?"Positions unavailable":"Loading your positions…"}</div>:holdings.length?<div className="table-scroll"><table className="market-table position-table"><thead><tr><th>Token</th><th>Balance</th><th>Value</th><th>Rewards</th><th/></tr></thead><tbody>{holdings.map(h=>{
        const reward=rewards?.markets.find(m=>m.launchId===h.launch.id);
        return <tr key={h.launch.id}><td><Link className="market-identity" to={"/token/"+h.launch.id}><TokenMark launch={h.launch}/><span><b>{h.launch.name}</b><small>{h.launch.symbol}</small></span></Link></td><td>{displayTokenAmount(h.balanceRaw,h.launch.tokenDecimals)}</td><td><b>{h.valueUsd===null?"Price delayed":usd.format(h.valueUsd)}</b></td><td>{reward?.canClaim?<button className="reward-amount-link" onClick={()=>selectTab("Rewards")}>{usd.format(reward.netClaimableUsdCents/100)} claimable <ArrowUpRight size={12}/></button>:reward?usd.format(reward.accumulatingUsdCents/100):"—"}</td><td><Link className="row-open" aria-label={"Open "+h.launch.name} to={"/token/"+h.launch.id}><ArrowUpRight size={18}/></Link></td></tr>;
      })}</tbody></table></div>:<div className="workspace-empty"><Coins/><h3>Your first position starts here.</h3><p>Coins held in this wallet appear once they’re indexed.</p><Link className="primary" to="/">Explore markets <ArrowRight size={15}/></Link></div>}
    </section>}
    {tab==="Ripple"&&<RippleRewards key={address} address={address}/>}
    {tab==="Rewards"&&<section className="workspace-panel portfolio-rewards-panel"><header><h2>Your rewards</h2></header><WalletRewards data={rewards} launches={(holdings??[]).map(h=>h.launch)} onClaimed={refresh}/></section>}
    {tab==="Activity"&&<><section className="workspace-panel"><header><h2>Claim history</h2>{history?.hasMore&&<span>Latest 200 receipts</span>}</header>
      {history?.lifetime.length?<div className="lifetime-rewards">{history.lifetime.map(t=><div key={t.stock_mint}><small>Total {t.symbol} claimed</small><strong>{displayTokenAmount(t.amount_raw,t.decimals)} <span>{t.symbol}</span></strong></div>)}</div>:null}
      {history===null?<div className="workspace-loading">{errors.activity?"History unavailable":"Loading claim receipts…"}</div>:history.claims.length?<div className="table-scroll"><table className="market-table"><thead><tr><th>Market</th><th>Claimed</th><th>Date</th><th>Receipt</th></tr></thead><tbody>{history.claims.map(c=><tr key={c.signature+c.launch_id}><td><Link to={"/token/"+c.launch_id}>{c.name}</Link></td><td>{displayTokenAmount(c.amount_raw,Number(c.stock_decimals))} {c.reward_symbol}</td><td>{new Date(Number(c.claimed_at)).toLocaleDateString()}</td><td><a href={"https://solscan.io/tx/"+c.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">View <ArrowUpRight size={13}/></a></td></tr>)}</tbody></table></div>:<div className="workspace-empty"><Gift/><h3>No claims yet.</h3><p>Your confirmed reward claims will appear here.</p></div>}
    </section>{config.marketGovernanceEnabled&&<HoldingUpdates wallet={address}/>}</>}
    {tab==="Created"&&<section className="workspace-panel portfolio-created-panel">
      <header><div><h2>Your coins</h2><p>Markets you launched and the fees they’ve earned.</p></div><Link to="/studio">Atlantis Studio <ArrowUpRight size={14}/></Link></header>
      <div className="creator-market-list">{created?.map(l=>{
        const lock=activeCreatorLock(l.creatorLock);
        return <article className="created-market-row" key={l.id}>
          <div className="created-market-info"><Link className="market-identity" to={"/token/"+l.id}><TokenMark launch={l}/><span><b>{l.name}</b><small>${l.symbol} · {lock?`${creatorLockPercentLabel(lock)} locked`:"No creator lock"}</small></span></Link>
            <div className="created-market-links"><Link to={"/manage/"+l.id}>Manage coin <ArrowUpRight size={13}/></Link><Link to={"/studio?token="+encodeURIComponent(l.mint)}>Build website <ArrowUpRight size={13}/></Link></div></div>
          {lock?<CreatorFeeClaim launch={l} onClaimed={refresh} compact/>:<div className="created-market-setup"><div><small>CREATOR FEES</small><span>Set up your lock to start earning</span></div><Link className="primary" to={"/manage/"+l.id+"?tab=fees"}>Set up creator fees <ArrowRight size={15}/></Link></div>}
        </article>;
      })}</div>
      {created===null?<div className="workspace-loading">{errors.created?"Markets unavailable":"Loading your coins…"}</div>:!created.length&&<div className="workspace-empty"><Layers3/><h3>Build your own community.</h3><p>Launch a coin, then create its website or experience in Atlantis Studio.</p><Link className="primary" to="/create">Launch a coin <ArrowRight size={15}/></Link></div>}
      {more&&<button className="soft-button creator-market-more" disabled={loadingMore} onClick={async()=>{setLoadingMore(true);try{const d=await api.launches({creator:address,status:"live",limit:24,sort:"creator_claims",offset});setCreated(c=>[...(c??[]),...d.launches.filter(l=>l.status==="live")]);setMore(d.hasMore);setOffset(d.nextOffset);}catch{setErrors(e=>({...e,created:"Could not load more coins."}));}finally{setLoadingMore(false);}}}>Load more</button>}
    </section>}
  </main>;
}
