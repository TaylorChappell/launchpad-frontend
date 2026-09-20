import { useEffect, useState } from "react";
import { ArrowUpRight, LockKeyhole, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { displayTokenAmount } from "../trade-quote";
import type { CreatorLock, Launch } from "../types";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD"});
const quantity=new Intl.NumberFormat("en",{maximumFractionDigits:6});
const short=(address:string)=>address.slice(0,5)+"…"+address.slice(-4);
export function MarketHolders({launch,creatorLock}:{launch:Launch;creatorLock?:CreatorLock|null}){
  const {config}=useRuntime(),[data,setData]=useState<Awaited<ReturnType<typeof api.holders>>|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  useEffect(()=>{let active=true;api.holders(launch.id).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError("Holder index unavailable.");});return()=>{active=false;};},[launch.id]);
  const lock=creatorLock??launch.creatorLock,activeLock=lock?.status==="active"?lock:null;
  const account=(wallet:string)=>"https://solscan.io/account/"+wallet+(config.network==="devnet"?"?cluster=devnet":"");
  const percent=(amount:string,total:string)=>Number(total)>0?(Number(amount)/Number(total)*100).toFixed(2)+"%":"—";
  return <section className="dashboard-section market-holders">
    <header><h2>Holders</h2><span className="workspace-badge">{launch.holderCount.toLocaleString()} indexed</span></header>
    {activeLock&&<div className="locked-custody"><LockKeyhole size={22}/><div><b>Creator locked wallet · {percent(activeLock.amountRaw,activeLock.totalSupplyRaw)} of supply</b><small>{displayTokenAmount(activeLock.amountRaw,launch.tokenDecimals)} {launch.symbol} · {Date.now()<activeLock.unlockAt*1000?"Unlocks ":"Unlock available since "}{new Date(activeLock.unlockAt*1000).toLocaleDateString()}</small></div><a href={account(activeLock.vaultTokenAccount)} target="_blank" rel="noreferrer">{short(activeLock.vaultTokenAccount)} <ArrowUpRight size={13}/></a></div>}
    {launch.liquidityLockedPermanently&&launch.lockConfig&&<div className="locked-custody"><LockKeyhole size={22}/><div><b>LP position permanently locked</b><small>Pool liquidity custody · separate from creator tokens</small></div><a href={account(launch.lockConfig)} target="_blank" rel="noreferrer">View lock <ArrowUpRight size={13}/></a></div>}
    {error&&<p className="danger-note" role="alert">{error}</p>}
    {!data&&!error?<div className="workspace-loading">Loading holders…</div>:data&&<>
      <div className="holder-stats"><span>Top 10 indexed share<b>{percent(data.summary.top_ten,data.summary.total)}</b></span><span>Creator indexed share<b>{percent(data.summary.creator,data.summary.total)}</b></span></div>
      <div className="table-scroll"><table className="market-table"><thead><tr><th>Wallet</th><th>Balance</th><th>Indexed share</th></tr></thead><tbody>{data.holders.map(h=><tr key={h.wallet}><td><a href={account(h.wallet)} target="_blank" rel="noreferrer">{short(h.wallet)} <ArrowUpRight size={11}/></a>{h.wallet===h.creator_wallet&&<span className="workspace-badge">Creator</span>}{activeLock&&(h.wallet===activeLock.lockPda||h.wallet===activeLock.vaultTokenAccount)&&<span className="workspace-badge"><LockKeyhole size={10}/> Locked</span>}</td><td>{displayTokenAmount(h.balance_raw,launch.tokenDecimals)}</td><td>{percent(h.balance_raw,h.indexed_total_raw)}</td></tr>)}</tbody></table></div>
      {!data.holders.length&&<p>No holder balances indexed yet.</p>}
      {data.hasMore&&<button className="soft-button" disabled={loading} onClick={async()=>{setLoading(true);try{const next=await api.holders(launch.id,data.holders.length);setData({...next,holders:[...data.holders,...next.holders]});setError("");}catch{setError("Could not load more holders.");}finally{setLoading(false);}}}>Load more holders</button>}
      <p className="status-inline">Wallet percentages use indexed balances. Locked supply above uses total token supply.</p>
    </>}
  </section>;
}
export function MarketPosition({launch}:{launch:Launch}){
  const wallet=useWallet(),[data,setData]=useState<Awaited<ReturnType<typeof api.position>>|null>(null),[error,setError]=useState("");
  useEffect(()=>{
    let active=true,pending=false;setData(null);setError("");if(!wallet.address)return;
    const address=wallet.address;const load=async()=>{if(pending)return;pending=true;try{const result=await api.position(address,launch.id);if(active){setData(result);setError("");}}catch{if(active)setError("Your position could not refresh.");}finally{pending=false;}};
    void load();const focus=()=>{if(document.visibilityState==="visible")void load();};const timer=window.setInterval(focus,15_000);window.addEventListener("focus",focus);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
  },[wallet.address,launch.id]);
  const pnl=data?.pnl,sign=(value:number)=>value>0?"+":"",tone=(value:number)=>value>=0?"positive":"negative";
  const pair=(value:number)=>sign(value)+quantity.format(value)+" "+data?.quoteSymbol;
  return <section className="dashboard-section market-position"><header><h2>Your position</h2><Link to="/portfolio">My holdings <ArrowUpRight size={14}/></Link></header>
    {!wallet.address?<div className="wallet-inline"><Wallet size={24}/><div><h3>See your side of the market.</h3><p>Your balance, value and profit or loss.</p></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></div>:<>
      {error&&<p className="danger-note" role="alert">{error} {data&&"Previous values may be stale."}</p>}
      {!data&&!error?<div className="workspace-loading">Loading your position…</div>:data&&<>
        <div className="position-overview"><div><small>Current value</small><strong>{data.valueUsd===null?"Price delayed":usd.format(data.valueUsd)}</strong><span>{displayTokenAmount(data.balanceRaw,launch.tokenDecimals)} {launch.symbol}</span></div>
          <div><small>Position P&amp;L · {data.quoteSymbol}</small><strong className={pnl?.available&&pnl.total!==null?tone(pnl.total):""}>{pnl?.available&&pnl.total!==null?pair(pnl.total):"—"}</strong><span>{pnl?.available&&pnl.returnPercent!==null?sign(pnl.returnPercent)+pnl.returnPercent.toFixed(2)+"% on total spent":pnl?.available?"Waiting for a current price":"Cost history incomplete"}</span></div></div>
        {pnl?.available?<div className="position-pnl"><div><small>Remaining cost</small><b>{quantity.format(pnl.costBasis)} {data.quoteSymbol}</b></div><div><small>Realized P&amp;L</small><b className={tone(pnl.realized)}>{pair(pnl.realized)}</b></div><div><small>Unrealized P&amp;L</small><b className={pnl.unrealized===null?"":tone(pnl.unrealized)}>{pnl.unrealized===null?"Price delayed":pair(pnl.unrealized)}</b></div></div>:pnl&&<p className="status-inline">{pnl.reason}</p>}
        <details className="workspace-disclosure"><summary>Position details</summary><div><p>{data.note} P&amp;L is measured in {data.quoteSymbol}; no historical USD price is assumed.</p>{data.balanceUpdatedAt&&<p>Balance indexed {new Date(data.balanceUpdatedAt).toLocaleString()}.</p>}{pnl?.available&&<p>Spent {quantity.format(pnl.bought)} {data.quoteSymbol} · received from sales {quantity.format(pnl.sold)} {data.quoteSymbol}.</p>}</div></details>
      </>}
    </>}
  </section>;
}
