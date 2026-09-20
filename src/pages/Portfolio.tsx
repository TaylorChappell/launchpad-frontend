import {HoldingUpdates} from "../components/HoldingUpdates";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { TokenMark } from "../components/TokenCard";
import { displayTokenAmount } from "../trade-quote";
import type { Launch, WalletRewardsResponse } from "../types";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD"});
type Holdings=Awaited<ReturnType<typeof api.holdings>>["holdings"];
type Claims=Awaited<ReturnType<typeof api.claimHistory>>["claims"];
export function Portfolio(){
  const wallet=useWallet(),{config}=useRuntime();
  const [lifetime,setLifetime]=useState<Awaited<ReturnType<typeof api.claimHistory>>["lifetime"]>([]);
  const [creatorError,setCreatorError]=useState("");
  const [holdings,setHoldings]=useState<Holdings>([]),[rewards,setRewards]=useState<WalletRewardsResponse|null>(null),[claims,setClaims]=useState<Claims>([]),[created,setCreated]=useState<Launch[]>([]),[error,setError]=useState(""),[updated,setUpdated]=useState(0),[revision,setRevision]=useState(0),[more,setMore]=useState(false),[offset,setOffset]=useState(0);
  useEffect(()=>{
    let active=true,pending=false;setUpdated(0);setLifetime([]);setCreatorError("");setHoldings([]);setClaims([]);setCreated([]);setRewards(null);setError("");if(!wallet.address)return;
    const address=wallet.address;
    const load=async()=>{if(pending)return;pending=true;try{const [h,r,c]=await Promise.all([api.holdings(address),api.rewards(address),api.claimHistory(address)]);if(active){setHoldings(h.holdings);setRewards(r);setClaims(c.claims);setLifetime(c.lifetime);setUpdated(Date.now());setError("");}}catch(e){if(active)setError(e instanceof Error?e.message:"Holdings unavailable");}finally{pending=false;}};
    api.launches({creator:address,status:"all",limit:24,sort:"recent"}).then(data=>{if(active){setCreated(data.launches);setMore(data.hasMore);setOffset(data.nextOffset);}}).catch(()=>{if(active)setCreatorError("Creator markets could not load. Refresh to try again.");});
    void load();const focus=()=>{if(document.visibilityState==="visible")void load();};const timer=window.setInterval(focus,20_000);window.addEventListener("focus",focus);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
  },[wallet.address,revision]);
  const value=holdings.reduce((s,h)=>s+(h.valueUsd??0),0),unpriced=holdings.filter(h=>h.valueUsd===null).length;
  const claimable=rewards?.markets.filter(m=>m.canClaim).reduce((s,m)=>s+m.netClaimableUsdCents/100,0)??0;
  const pending=rewards?.markets.reduce((s,m)=>s+m.pendingUsdCents/100,0)??0;
  if(!wallet.address)return <main className="page"><section className="empty-state"><h1>Your holdings. Your rewards.</h1><p>Connect to see your AQUA positions, allocations, claim receipts and creator markets.</p><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></section></main>;
  return <main className="page"><header className="dashboard-heading"><div><h1>My holdings</h1><p>{updated?"Last refreshed "+new Date(updated).toLocaleTimeString()+". Indexed balances can lag the chain.":"Loading indexed wallet activity…"}</p></div><button className="soft-button" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={15}/> Refresh</button></header>
    {error&&<p className="danger-note" role="alert">{error}. Previously loaded values may be stale.</p>}
    <section className="portfolio-summary"><article><small>Priced holdings {unpriced>0&&"("+unpriced+" unpriced)"}</small><strong>{updated?usd.format(value):"—"}</strong></article><article><small>Claimable after estimated costs</small><strong>{updated?usd.format(claimable):"—"}</strong></article><article><small>Pending allocation</small><strong>{updated?usd.format(pending):"—"}</strong></article></section>
    <div className="action-links"><Link className="primary" to="/rewards">Review &amp; claim rewards</Link><Link className="soft-button" to="/create">Launch a coin</Link></div>
    <section className="dashboard-section"><h2>Positions</h2><p>Rewards weight eligible balances by holding time. Pool custody is excluded. Pending allocations are not yet claimable payments.</p><div className="table-scroll"><table className="market-table"><thead><tr><th>Market</th><th>Balance</th><th>Indexed value</th><th>Balance observed</th></tr></thead><tbody>{holdings.map(h=><tr key={h.launch.id}><td><Link className="market-identity" to={"/token/"+h.launch.id}><TokenMark launch={h.launch}/><span><b>{h.launch.name}</b><small>{h.launch.rewardMode.replaceAll("_"," ")}</small></span></Link></td><td>{displayTokenAmount(h.balanceRaw,h.launch.tokenDecimals)} {h.launch.symbol}</td><td>{h.valueUsd===null?"Price unavailable":usd.format(h.valueUsd)}</td><td>{new Date(h.balanceUpdatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>{updated&&!holdings.length&&<p>No indexed AQUA holdings for this wallet.</p>}</section>
    <HoldingUpdates wallet={wallet.address}/>
    <section className="dashboard-section"><h2>Creator locks in your holdings</h2>{holdings.filter(h=>h.launch.creatorLock).map(h=><p key={h.launch.id}><Link to={"/token/"+h.launch.id}>{h.launch.symbol}</Link>: {h.launch.creatorLock!.status==="released"?"Creator tokens released":"Creator token unlocks "+new Date(h.launch.creatorLock!.unlockAt*1000).toLocaleString()}. LP liquidity locking is separate.</p>)}{!holdings.some(h=>h.launch.creatorLock)&&<p>No indexed creator-token locks on your current holdings.</p>}</section>
    <section className="dashboard-section"><h2>Claim receipts &amp; lifetime totals</h2><p>Confirmed claim entitlements are grouped by transaction. Different assets are not added together. The table shows the latest 200 indexed receipts.</p><div className="personal-strip">{lifetime.map(t=><span key={t.stock_mint}>Lifetime: <strong>{displayTokenAmount(t.amount_raw,t.decimals)} {t.symbol}</strong></span>)}</div><div className="table-scroll"><table className="market-table"><thead><tr><th>Market</th><th>Claimed amount</th><th>Record</th><th>Receipt</th></tr></thead><tbody>{claims.map(c=><tr key={c.signature+c.launch_id}><td><Link to={"/token/"+c.launch_id}>{c.name}</Link></td><td>{displayTokenAmount(c.amount_raw,Number(c.stock_decimals))} {c.reward_symbol}</td><td>Confirmed claim</td><td><a href={"https://solscan.io/tx/"+c.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">{new Date(Number(c.claimed_at)).toLocaleDateString()} ↗</a></td></tr>)}</tbody></table></div>{updated&&!claims.length&&<p>No indexed claim receipts yet.</p>}</section>
    <section className="dashboard-section"><header><h2>Creator dashboard</h2><Link to="/studio">Open Atlantis Studio →</Link></header>{created.map(l=><article className="personal-strip" key={l.id}><Link className="market-identity" to={"/token/"+l.id}><TokenMark launch={l}/><span><b>{l.name}</b><small>{l.status==="live"?"Live market":"Launch in progress"}</small></span></Link><Link to={l.status==="live"?"/manage/"+l.id:"/create"}>{l.status==="live"?"Manage creator lock":"Resume launch"}</Link><Link to={"/studio?token="+encodeURIComponent(l.mint)}>Build website</Link></article>)}{creatorError&&<p role="alert">{creatorError}</p>}{!creatorError&&!created.length&&<p>Your launched coins will appear here.</p>}{more&&<button className="soft-button" onClick={async()=>{try{const data=await api.launches({creator:wallet.address!,status:"all",limit:24,sort:"recent",offset});setCreated(current=>[...current,...data.launches]);setMore(data.hasMore);setOffset(data.nextOffset);}catch{setError("Creator markets unavailable");}}}>Load more creator markets</button>}</section>
  </main>;
}
