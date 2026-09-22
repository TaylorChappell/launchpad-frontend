import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Loader2 } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { displayTokenAmount } from "../trade-quote";
import type { CreatorFeeSummary, Launch } from "../types";
export function CreatorFeeClaim({launch,onClaimed}:{launch:Launch;onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime();
  return <CreatorClaim key={config.network+":"+wallet.address+":"+launch.id} launch={launch} onClaimed={onClaimed}/>;
}
function CreatorClaim({launch,onClaimed}:{launch:Launch;onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime(),key=`aqua:creator-claim:${config.network}:${wallet.address}:${launch.id}`;
  const [signature,setSignature]=useState(()=>{try{return localStorage.getItem(key)??"";}catch{return "";}}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[paid,setPaid]=useState("");
  const [summary,setSummary]=useState<CreatorFeeSummary|null>(null),[summaryError,setSummaryError]=useState(false);
  const claimedBefore=useRef(BigInt(launch.creatorFeesPaidRaw||"0"));
  const running=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let active=true,fetching=false;
    const refresh=async()=>{if(fetching)return;fetching=true;try{const result=await api.creatorFeeSummary(launch.id);if(active){setSummary(result);setSummaryError(false);}}catch{if(active)setSummaryError(true);}finally{fetching=false;}};
    void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},30000);
    return()=>{active=false;window.clearInterval(timer);};
  },[launch.id,launch.creatorFeesAccruedRaw,launch.creatorFeesPaidRaw,paid]);
  useEffect(()=>{if(paid&&BigInt(launch.creatorFeesPaidRaw||"0")>=claimedBefore.current+BigInt(paid)){claimedBefore.current=BigInt(launch.creatorFeesPaidRaw||"0");setPaid("");}},[paid,launch.creatorFeesPaidRaw]);
  const accrued=BigInt(summary?.availableRaw??launch.creatorFeesAccruedRaw??"0");
  if(wallet.address!==launch.creatorWallet)return null;
  const remember=(value:string)=>{try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);}catch{/* Keep visible receipt. */}if(alive.current)setSignature(value);};
  async function claim(){
    if(running.current||!wallet.address)return;running.current=true;setBusy(true);setError("");let submitted=signature;
    try{
      if(!submitted){
        const envelope=await api.creatorFeesClaimTransaction(launch.id,wallet.address);
        if(!alive.current)return;
        submitted=await wallet.sendTransaction(envelope,sig=>{submitted=sig;remember(sig);});remember(submitted);
      }
      const result=await api.confirmCreatorFees(launch.id,wallet.address,submitted);
      remember("");if(alive.current){setPaid(result.amountRaw);onClaimed?.();}
    }catch(e){if(alive.current)setError(submitted?"Submitted. Check confirmation before trying another claim.":e instanceof Error?e.message:"Could not claim creator fees.");}
    finally{running.current=false;if(alive.current)setBusy(false);}
  }
  const available=paid?0n:accrued;
  const txUrl=(sig:string)=>`https://solscan.io/tx/${sig}${config.network==="devnet"?"?cluster=devnet":""}`;
  return <section className="creator-earnings" aria-label="Creator earnings">
    <div className="creator-earnings-main">
      <div className="creator-earnings-balance"><span className="creator-eyebrow">Available to claim</span><h3>{displayTokenAmount(available.toString(),launch.tokenDecimals)} <span>{launch.symbol}</span></h3><p>Claim directly in {launch.symbol}. Token transfer fees apply.</p></div>
      <div className="creator-earnings-action"><button className="primary" disabled={busy||(!signature&&(accrued===0n||Boolean(paid)))} onClick={()=>void claim()}>{busy?<Loader2 size={17} className="spin"/>:<ArrowDownToLine size={17}/>} {busy?"Confirming…":signature?"Check confirmation":paid?"Fees claimed":`Claim ${launch.symbol}`}</button><small>{signature?"Your claim has been submitted.":available>0n?"Sent to your connected wallet":"New earnings will appear here."}</small>{signature&&<a href={txUrl(signature)} target="_blank" rel="noreferrer">View submitted claim <ArrowUpRight size={13}/></a>}</div>
    </div>
    {error&&<p className="creator-earnings-error" role="alert">{error}</p>}
    <div className="creator-earnings-paid"><div><span>Received in SOL</span><strong>{summary?displayTokenAmount(summary.solPaidLamports,9):"—"} <small>SOL</small></strong><p>Automatic payouts</p></div><div><span>Received in {launch.symbol}</span><strong>{summary?displayTokenAmount(summary.tokenPaidRaw,launch.tokenDecimals):"—"} <small>{launch.symbol}</small></strong><p>Token payouts after transfer fees</p></div></div>
    <p className="creator-earnings-note">The keeper can also convert fees and pay you automatically in SOL. Fees already sent for conversion are no longer available for a token claim.</p>
    {summaryError&&<p className="creator-earnings-error" role="status">Payout history is temporarily unavailable. It will retry automatically.</p>}
    {summary&&summary.recent.length>0&&<div className="creator-payouts"><h4>Recent payouts to your wallet</h4>{summary.recent.map(item=><a key={item.asset+item.signature} href={txUrl(item.signature)} target="_blank" rel="noreferrer"><div><strong>{item.asset==="SOL"?"SOL payout":"Token payout"}</strong><time dateTime={new Date(item.paidAt).toISOString()}>{new Date(item.paidAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</time></div><b>+{displayTokenAmount(item.amountRaw,item.asset==="SOL"?9:launch.tokenDecimals)} <span>{item.asset==="SOL"?"SOL":launch.symbol}</span></b><ArrowUpRight size={15}/></a>)}</div>}
  </section>;
}
