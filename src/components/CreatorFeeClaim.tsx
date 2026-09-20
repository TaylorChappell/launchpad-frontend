import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { displayTokenAmount } from "../trade-quote";
import type { Launch } from "../types";
export function CreatorFeeClaim({launch,onClaimed}:{launch:Launch;onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime();
  return <CreatorClaim key={config.network+":"+wallet.address+":"+launch.id} launch={launch} onClaimed={onClaimed}/>;
}
function CreatorClaim({launch,onClaimed}:{launch:Launch;onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime(),key=`aqua:creator-claim:${config.network}:${wallet.address}:${launch.id}`;
  const [signature,setSignature]=useState(()=>{try{return localStorage.getItem(key)??"";}catch{return "";}}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[paid,setPaid]=useState("");
  const claimedBefore=useRef(BigInt(launch.creatorFeesPaidRaw||"0"));
  const running=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(paid&&BigInt(launch.creatorFeesPaidRaw||"0")>=claimedBefore.current+BigInt(paid)){claimedBefore.current=BigInt(launch.creatorFeesPaidRaw||"0");setPaid("");}},[paid,launch.creatorFeesPaidRaw]);
  const accrued=BigInt(launch.creatorFeesAccruedRaw||"0");
  if(wallet.address!==launch.creatorWallet||(!signature&&accrued===0n&&!(launch.creatorLock?.feeShareBps)))return null;
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
  return <div className="creator-fee-claim"><small>Fees claimed: {displayTokenAmount(((BigInt(launch.creatorFeesPaidRaw||"0")>claimedBefore.current+BigInt(paid||"0")?BigInt(launch.creatorFeesPaidRaw||"0"):claimedBefore.current+BigInt(paid||"0"))).toString(),launch.tokenDecimals)} {launch.symbol}</small><button className="soft-button" disabled={busy||(!signature&&(accrued===0n||Boolean(paid)))} onClick={()=>void claim()}>{busy?"Confirming…":signature?"Check confirmation":paid?"Fees claimed":"Claim fees"}</button>{signature&&<a href={`https://solscan.io/tx/${signature}${config.network==="devnet"?"?cluster=devnet":""}`} target="_blank" rel="noreferrer">Receipt ↗</a>}{error&&<p className="danger-note" role="alert">{error}</p>}</div>;
}
