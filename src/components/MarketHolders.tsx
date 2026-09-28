import { isPriceLive } from "../market-prices";
import { usd, rawUsd, compactNumber } from "../money";
import { quoteAmounts } from "../trade-quote";
import { WalletIdentity } from "./WalletIdentity";
import { useEffect, useState } from "react";
import { ArrowUpRight, LockKeyhole, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useWallet } from "../context";
import { displayTokenAmount } from "../trade-quote";
import type { CreatorLock, Launch } from "../types";
const quantity=new Intl.NumberFormat("en",{maximumFractionDigits:6});
export function MarketHolders({launch,creatorLock}:{launch:Launch;creatorLock?:CreatorLock|null}){
  const [data,setData]=useState<Awaited<ReturnType<typeof api.holders>>|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  useEffect(()=>{let active=true;api.holders(launch.id).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError("Holders could not load.");});return()=>{active=false;};},[launch.id]);
  const lock=creatorLock??launch.creatorLock,activeLock=lock?.status==="active"?lock:null;
  const rows=(data?.holders??[]).filter(h=>!activeLock||![activeLock.lockPda,activeLock.vaultTokenAccount].includes(h.wallet)).map(h=>({wallet:h.wallet,balanceRaw:h.balance_raw,locked:false,creator:h.wallet===launch.creatorWallet}));
  if(activeLock)rows.push({wallet:activeLock.vaultTokenAccount,balanceRaw:activeLock.amountRaw,locked:true,creator:false});
  rows.sort((a,b)=>BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:BigInt(a.balanceRaw)<BigInt(b.balanceRaw)?1:a.wallet.localeCompare(b.wallet));
  return <div className="activity holder-activity"><header><div><b>Holders</b></div><strong>{launch.holderCount.toLocaleString()} wallet{launch.holderCount===1?"":"s"}</strong></header>
    {error&&<p className="danger-note" role="alert">{error}</p>}
    <div className="activity-scroll"><table><thead><tr><th>#</th><th>Wallet</th><th>Tokens</th><th>Supply held</th></tr></thead><tbody>{rows.map((h,i)=><tr key={h.wallet}><td>{i+1}</td><td><WalletIdentity wallet={h.wallet}/>{h.creator&&<span className="holder-label">Creator</span>}{h.locked&&<span className="holder-label" title={"Unlocks "+new Date(activeLock!.unlockAt*1000).toLocaleString()}><LockKeyhole size={11}/> Locked</span>}</td><td><abbr title={displayTokenAmount(h.balanceRaw,launch.tokenDecimals)}>{compactNumber(Number(h.balanceRaw)/10**launch.tokenDecimals)}</abbr></td><td>{BigInt(launch.totalSupplyRaw)>0n?(BigInt(h.balanceRaw)>0n&&Number(h.balanceRaw)/Number(launch.totalSupplyRaw)*100<0.0001?"<0.0001%":(Number(h.balanceRaw)/Number(launch.totalSupplyRaw)*100).toLocaleString("en",{maximumFractionDigits:4})+"%"):"—"}</td></tr>)}{!rows.length&&<tr><td colSpan={4} className="no-activity">{data?"No holders yet.":error?"Holders unavailable.":"Loading holders…"}</td></tr>}</tbody></table></div>
    {data?.hasMore&&<button className="activity-load-more" disabled={loading} onClick={async()=>{setLoading(true);try{const next=await api.holders(launch.id,data.holders.length);setData({...next,holders:[...data.holders,...next.holders]});setError("");}catch{setError("Could not load more holders.");}finally{setLoading(false);}}}>Load more holders</button>}
  </div>;
}
export function MarketPosition({launch,compact=false,pairDecimals=null}:{launch:Launch;compact?:boolean;pairDecimals?:number|null}){
  const wallet=useWallet(),[data,setData]=useState<Awaited<ReturnType<typeof api.position>>|null>(null),[error,setError]=useState("");
  useEffect(()=>{
    let active=true,pending=false;setData(null);setError("");if(!wallet.address)return;
    const address=wallet.address;const load=async()=>{if(pending)return;pending=true;try{const result=await api.position(address,launch.id);if(active){setData(result);setError("");}}catch{if(active)setError("Your position could not refresh.");}finally{pending=false;}};
    void load();const focus=()=>{if(document.visibilityState==="visible")void load();};const timer=window.setInterval(focus,15_000);window.addEventListener("focus",focus);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
  },[wallet.address,launch.id]);
  const pnl=data?.pnl;
  return <section className="dashboard-section market-position"><header>{!compact && <h2>Your position</h2>}<Link to="/portfolio">Portfolio <ArrowUpRight size={14}/></Link></header>
    {!wallet.address?<div className="wallet-inline"><Wallet size={24}/><div><h3>Your tokens. Your P&amp;L.</h3></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></div>:<>
      {error&&<p className="danger-note" role="alert">{error}</p>}
      {!data&&!error?<div className="workspace-loading">Loading your position…</div>:data&&<>
        <div className="position-overview"><div><small>Estimated position value</small><strong>{usd(data.valueUsd)}</strong><span>{displayTokenAmount(data.balanceRaw,launch.tokenDecimals)} {launch.symbol}</span></div>
        {(["unrealized","realized"] as const).map(kind=><div key={kind}><small>{kind==="unrealized"?"Unrealised P&L · before exit costs":"Realised P&L"}</small><strong className={pnl?.available&&pnl[kind]!=null?(pnl[kind]!>=0?"positive":"negative"):""}>{pnl?.available&&pnl[kind]!=null?(pnl[kind]!>0?"+":"")+quantity.format(pnl[kind]!)+" "+data.quoteSymbol:"—"}</strong></div>)}</div>
        <p className="position-explanation">{data.note}</p>
        {pnl&&!pnl.available&&<p className="position-explanation">{pnl.reason}</p>}
        {BigInt(data.balanceRaw)>0n&&<ExitEstimate launch={launch} balanceRaw={data.balanceRaw} decimals={pairDecimals}/>}
      </>}

    </>}
  </section>;
}


function ExitEstimate({launch,balanceRaw,decimals}:{launch:Launch;balanceRaw:string;decimals:number|null}){
  const [percent,setPercent]=useState(100),[estimate,setEstimate]=useState<{estimated:string;minimum:string;at:number}|null>(null),[error,setError]=useState(""),[pending,setPending]=useState(false),[clock,setClock]=useState(Date.now());
  useEffect(()=>{setEstimate(null);setError("");},[balanceRaw,percent]);
  useEffect(()=>{if(!estimate)return;const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[estimate]);
  const [request,setRequest]=useState(0);
  useEffect(()=>{
    if(!request||decimals===null)return;
    const controller=new AbortController();setPending(true);setError("");
    const amountRaw=(BigInt(balanceRaw)*BigInt(percent)/100n).toString();
    api.tradeQuote(launch.id,{side:"sell",buyCurrency:"PAIR",amountRaw,slippageBps:100},controller.signal).then(result=>{
      if(!controller.signal.aborted){setEstimate({...quoteAmounts(result.quote),at:Date.now()});setClock(Date.now());}
    }).catch(e=>{if(!controller.signal.aborted){setEstimate(null);setError(e instanceof Error?e.message:"Sell estimate unavailable.");}}).finally(()=>{if(!controller.signal.aborted)setPending(false);});
    return()=>controller.abort();
  },[request,balanceRaw,percent,launch.id,decimals]);
  const fresh=estimate&&clock-estimate.at<25000;
  return <details className="position-exit"><summary>Estimate sell proceeds</summary><div className="position-exit-controls"><label>Amount<select value={percent} onChange={e=>setPercent(Number(e.target.value))}>{[25,50,75,100].map(value=><option key={value} value={value}>{value}% of holdings</option>)}</select></label><button className="soft-button" disabled={pending||decimals===null} onClick={()=>setRequest(n=>n+1)}>{pending?"Getting quote…":"Get estimate"}</button></div>
    {fresh&&!pending&&decimals!==null&&<dl className="trade-quote-summary"><div><dt>Estimated received</dt><dd>{displayTokenAmount(estimate.estimated,decimals)} {launch.pairSymbol}</dd></div><div><dt>Approximate USD</dt><dd>{usd(rawUsd(estimate.estimated,decimals,isPriceLive(launch)?launch.pairPriceUsd:null))}</dd></div><div><dt>Minimum at 1% slippage</dt><dd>{displayTokenAmount(estimate.minimum,decimals)} {launch.pairSymbol}</dd></div></dl>}
    {decimals===null&&<p>Pair details are loading. Try again once the market has refreshed.</p>}
    {estimate&&!fresh&&<p>Quote expired. Get a new estimate before deciding.</p>}{error&&<p role="alert">{error}</p>}
    <p className="position-explanation">Quote only. Includes applicable swap and token fees; network costs are additional. This does not sell your tokens.</p>
  </details>;
}
