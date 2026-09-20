import { useEffect, useState } from "react";
import { ArrowUpRight, LockKeyhole, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { displayTokenAmount } from "../trade-quote";
import type { CreatorLock, Launch } from "../types";
const quantity=new Intl.NumberFormat("en",{maximumFractionDigits:6});
const short=(address:string)=>address.slice(0,5)+"…"+address.slice(-4);
export function MarketHolders({launch,creatorLock}:{launch:Launch;creatorLock?:CreatorLock|null}){
  const {config}=useRuntime(),[data,setData]=useState<Awaited<ReturnType<typeof api.holders>>|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  useEffect(()=>{let active=true;api.holders(launch.id).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError("Holders could not load.");});return()=>{active=false;};},[launch.id]);
  const lock=creatorLock??launch.creatorLock,activeLock=lock?.status==="active"?lock:null;
  const rows=(data?.holders??[]).filter(h=>!activeLock||![activeLock.lockPda,activeLock.vaultTokenAccount].includes(h.wallet)).map(h=>({wallet:h.wallet,balanceRaw:h.balance_raw,locked:false,creator:h.wallet===launch.creatorWallet}));
  if(activeLock)rows.push({wallet:activeLock.vaultTokenAccount,balanceRaw:activeLock.amountRaw,locked:true,creator:false});
  rows.sort((a,b)=>BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:BigInt(a.balanceRaw)<BigInt(b.balanceRaw)?1:a.wallet.localeCompare(b.wallet));
  return <div className="activity holder-activity"><header><div><b>Holders</b></div><strong>{launch.holderCount.toLocaleString()} wallet{launch.holderCount===1?"":"s"}</strong></header>
    {error&&<p className="danger-note" role="alert">{error}</p>}
    <div className="activity-scroll"><table><thead><tr><th>#</th><th>Wallet</th><th>Tokens</th><th>Supply held</th></tr></thead><tbody>{rows.map((h,i)=><tr key={h.wallet}><td>{i+1}</td><td><a href={"https://solscan.io/account/"+h.wallet+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">{short(h.wallet)} <ArrowUpRight size={11}/></a>{h.creator&&<span className="holder-label">Creator</span>}{h.locked&&<span className="holder-label" title={"Unlocks "+new Date(activeLock!.unlockAt*1000).toLocaleString()}><LockKeyhole size={11}/> Locked</span>}</td><td>{displayTokenAmount(h.balanceRaw,launch.tokenDecimals)}</td><td>{BigInt(launch.totalSupplyRaw)>0n?(BigInt(h.balanceRaw)>0n&&Number(h.balanceRaw)/Number(launch.totalSupplyRaw)*100<0.0001?"<0.0001%":(Number(h.balanceRaw)/Number(launch.totalSupplyRaw)*100).toLocaleString("en",{maximumFractionDigits:4})+"%"):"—"}</td></tr>)}{!rows.length&&<tr><td colSpan={4} className="no-activity">{data?"No holders yet.":error?"Holders unavailable.":"Loading holders…"}</td></tr>}</tbody></table></div>
    {data?.hasMore&&<button className="activity-load-more" disabled={loading} onClick={async()=>{setLoading(true);try{const next=await api.holders(launch.id,data.holders.length);setData({...next,holders:[...data.holders,...next.holders]});setError("");}catch{setError("Could not load more holders.");}finally{setLoading(false);}}}>Load more holders</button>}
  </div>;
}
export function MarketPosition({launch}:{launch:Launch}){
  const wallet=useWallet(),[data,setData]=useState<Awaited<ReturnType<typeof api.position>>|null>(null),[error,setError]=useState("");
  useEffect(()=>{
    let active=true,pending=false;setData(null);setError("");if(!wallet.address)return;
    const address=wallet.address;const load=async()=>{if(pending)return;pending=true;try{const result=await api.position(address,launch.id);if(active){setData(result);setError("");}}catch{if(active)setError("Your position could not refresh.");}finally{pending=false;}};
    void load();const focus=()=>{if(document.visibilityState==="visible")void load();};const timer=window.setInterval(focus,15_000);window.addEventListener("focus",focus);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
  },[wallet.address,launch.id]);
  const pnl=data?.pnl;
  return <section className="dashboard-section market-position"><header><h2>Your position</h2><Link to="/portfolio">My holdings <ArrowUpRight size={14}/></Link></header>
    {!wallet.address?<div className="wallet-inline"><Wallet size={24}/><div><h3>Your tokens. Your P&amp;L.</h3></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></div>:<>
      {error&&<p className="danger-note" role="alert">{error}</p>}
      {!data&&!error?<div className="workspace-loading">Loading your position…</div>:data&&<div className="position-overview"><div><small>Position value</small><strong>{data.valueSol==null?"—":quantity.format(data.valueSol)+" SOL"}</strong><span>{displayTokenAmount(data.balanceRaw,launch.tokenDecimals)} {launch.symbol}</span></div>
        <div><small>Total P&amp;L · {data.quoteSymbol}</small><strong className={pnl?.available&&pnl.total!==null?(pnl.total>=0?"positive":"negative"):""} title={pnl&&!pnl.available?pnl.reason:undefined}>{pnl?.available&&pnl.total!==null?(pnl.total>0?"+":"")+quantity.format(pnl.total)+" "+data.quoteSymbol:"—"}</strong><span>{pnl?.available&&pnl.returnPercent!==null?(pnl.returnPercent>0?"+":"")+pnl.returnPercent.toFixed(2)+"%":pnl?.available?"Price delayed":"P&L unavailable"}</span></div></div>}
    </>}
  </section>;
}
