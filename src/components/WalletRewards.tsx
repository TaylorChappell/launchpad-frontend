import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Gift, Loader2 } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { Launch, WalletRewardMarket, WalletRewardsResponse } from "../types";
import { TokenMark } from "./TokenCard";
import { displayTokenAmount } from "../trade-quote";

const usd=(cents:number)=>new Intl.NumberFormat("en",{style:"currency",currency:"USD"}).format(cents/100);
type PendingClaim={wallet:string;launchId:string;name:string;signature:string;sequence?:string;epochId?:string;amountUsd:number};
function savedClaim(key:string):PendingClaim|null{
  try { const value=JSON.parse(localStorage.getItem(key)??"null");return value&&typeof value.wallet==="string"&&typeof value.launchId==="string"&&typeof value.signature==="string"&&(typeof value.sequence==="string"||typeof value.epochId==="string")?value:null; }catch{return null;}
}
export function WalletRewards({launch,data,launches=[],onClaimed}:{launch?:Launch;data?:WalletRewardsResponse|null;launches?:Launch[];onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime();
  // Remount on wallet/network change: pending receipts always belong to their signer.
  return <RewardContent key={config.network+":"+wallet.address+":"+(launch?.id??"all")} launch={launch} data={data} launches={launches} onClaimed={onClaimed}/>;
}
function RewardContent({launch,data,launches,onClaimed}:{launch?:Launch;data?:WalletRewardsResponse|null;launches:Launch[];onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime(),address=wallet.address;
  const storageKey=["aqua:pending-reward",config.network,address].join(":");
  const [loaded,setLoaded]=useState<WalletRewardsResponse|null>(null),[known,setKnown]=useState<Launch[]>([]);
  const [error,setError]=useState(""),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [pending,setPending]=useState<PendingClaim|null>(()=>savedClaim(storageKey));
  const [success,setSuccess]=useState<{signature:string;amount:string}|null>(null);
  const running=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const rewardData=data===undefined?loaded:data;
  useEffect(()=>{
    if(!address||data!==undefined)return;
    let active=true,inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{const result=await api.rewards(address);if(active){setLoaded(result);setError("");}}catch{if(active)setError("Rewards could not load. Try again.");}finally{inFlight=false;}};
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},20_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[address,data,revision]);
  const missingIds=(rewardData?.markets??[]).filter(m=>!launches.some(l=>l.id===m.launchId)&&launch?.id!==m.launchId).map(m=>m.launchId).sort().join(",");
  useEffect(()=>{let active=true;if(missingIds)api.launches({ids:missingIds,limit:100}).then(r=>{if(active)setKnown(r.launches);}).catch(()=>{});return()=>{active=false;};},[missingIds]);
  const allLaunches=[...launches,...known,...(launch?[launch]:[])];
  const markets=(rewardData?.markets??[]).filter(m=>(!launch||m.launchId===launch.id)&&(m.grossRedeemableUsdCents>0||m.accumulatingUsdCents>0||m.pendingUsdCents>0)).sort((a,b)=>Number(b.canClaim)-Number(a.canClaim)||b.accumulatingUsdCents-a.accumulatingUsdCents);
  function remember(value:PendingClaim|null){try{if(value)localStorage.setItem(storageKey,JSON.stringify(value));else localStorage.removeItem(storageKey);}catch{/* Receipt remains visible if browser storage is unavailable. */}if(alive.current)setPending(value);}
  async function confirm(receipt:PendingClaim){
    if(receipt.wallet!==address)throw Error("Connect the wallet that submitted this claim.");
    let amount=usd(receipt.amountUsd);
    if(receipt.sequence){
      const result=await api.confirmCumulativeRewardClaim(receipt.launchId,receipt.wallet,receipt.signature,receipt.sequence);
      amount=displayTokenAmount(result.amountRaw,result.stockDecimals)+" "+result.stockSymbol;
    }else await api.confirmRewardClaim(receipt.epochId!,receipt.wallet,receipt.signature);
    remember(null);
    if(alive.current){
      setSuccess({signature:receipt.signature,amount});
      setStatus("");setRevision(n=>n+1);onClaimed?.();
    }
  }
  async function retry(){
    if(!pending||running.current)return;running.current=true;setBusy(true);setError("");setStatus("Checking confirmation…");
    try{await confirm(pending);}catch{if(alive.current){setError("Confirmation is still pending. Check the transaction or retry confirmation.");setStatus("");}}
    finally{running.current=false;if(alive.current)setBusy(false);}
  }
  async function executeClaim(market:WalletRewardMarket){
    if(!address||!alive.current)throw Error("Wallet changed. Remaining claims were stopped.");
    setStatus("Preparing your claim…");
    let submitted:PendingClaim|null=null;
    try{
      const cumulative=market.claimMode==="cumulative",epochId=market.claimableEpochIds[0];
      const envelope=cumulative?await api.cumulativeRewardClaim(market.launchId,address):await api.rewardClaim(epochId,address);
      if(!alive.current)throw Error("Wallet changed. Remaining claims were stopped.");
      setStatus("Approve the claim in your wallet");
      const onSubmitted=(signature:string)=>{
        submitted={wallet:address,launchId:market.launchId,name:allLaunches.find(l=>l.id===market.launchId)?.name??"Reward",signature,amountUsd:market.claimableUsdCents,...("sequence" in envelope?{sequence:String(envelope.sequence)}:{epochId})};
        remember(submitted);if(alive.current)setStatus("Confirming your reward…");
      };
      const signature=await wallet.sendTransaction(envelope,onSubmitted);
      if(!submitted)onSubmitted(signature);
      await confirm(submitted!);
    }catch(e){
      if(alive.current){setStatus("");setError(submitted?"Claim submitted. Confirmation is pending; you can safely retry confirmation.":e instanceof Error?e.message:"Could not prepare the claim.");}
      throw e;
    }
  }
  async function claimBatch(selected:WalletRewardMarket[]){
    if(!address||running.current||pending||savedClaim(storageKey))return;
    const eligible=selected.filter(m=>m.canClaim&&(m.claimMode==="cumulative"||m.claimableEpochIds.length===1));
    if(!eligible.length)return;
    running.current=true;setBusy(true);setError("");setSuccess(null);
    let completed=0;
    try{
      for(const market of eligible){
        if(!alive.current)break;
        await executeClaim(market);completed++;
      }
      if(alive.current&&eligible.length>1)setStatus(`${completed} rewards claimed.`);
    }catch{/* executeClaim keeps the submitted receipt and stops the queue. */}
    finally{running.current=false;if(alive.current)setBusy(false);}
  }
  const claimable=markets.filter(m=>m.canClaim&&(m.claimMode==="cumulative"||m.claimableEpochIds.length===1));
  if(launch&&(!address||(rewardData&&!markets.length&&!pending&&!success&&!error)))return null;
  if(!address)return <section className="wallet-inline"><Gift size={24}/><div><h3>Your rewards are here.</h3><p>Connect your wallet to see your allocation and claim it.</p></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></section>;
  return <div className="wallet-rewards">
    {!launch&&<div className="claim-all-bar"><span>{claimable.length} coin{claimable.length===1?"":"s"} ready to claim{claimable.length>1&&<small>Approve each coin in your wallet.</small>}</span><button className="primary" disabled={busy||Boolean(pending)||!claimable.length} onClick={()=>void claimBatch(claimable)}>{busy?<><Loader2 size={15} className="spin"/> Claiming…</>:"Claim all"}</button></div>}
    {success&&<div className="claim-notice success" role="status"><Check size={20}/><div><b>{success.amount} claimed</b><a href={"https://solscan.io/tx/"+success.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">View receipt <ArrowUpRight size={13}/></a></div></div>}
    {pending&&<div className="claim-notice"><Loader2 size={20} className={busy?"spin":""}/><div><b>{pending.name} · claim submitted</b><a href={"https://solscan.io/tx/"+pending.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={13}/></a></div><button className="soft-button" disabled={busy} onClick={()=>void retry()}>Check confirmation</button></div>}
    {status&&<p className="claim-status" role="status">{busy&&<Loader2 className="spin" size={16}/>}{status}</p>}
    {error&&<p className="danger-note" role="alert">{error} {!pending&&!busy&&<button className="text-button" onClick={()=>{setRevision(n=>n+1);onClaimed?.();}}>Try again</button>}</p>}
    {!rewardData&&!error?<div className="workspace-loading">Loading your rewards…</div>:markets.length?<div className="reward-claim-list">{markets.map(m=>{
      const coin=allLaunches.find(l=>l.id===m.launchId),unsettled=Math.max(0,m.accumulatingUsdCents-m.grossRedeemableUsdCents);
      const eligible=m.canClaim&&(m.claimMode==="cumulative"||m.claimableEpochIds.length===1);
      return <article className={"reward-claim-row"+(eligible?" ready":"")} key={m.launchId}>
        <div className="reward-claim-coin">{coin?<TokenMark launch={coin}/>:<Gift size={24}/>}<div>{coin&&!launch?<Link to={"/token/"+coin.id}>{coin.name}</Link>:<b>{coin?.name??"AQUA reward"}</b>}<small>{eligible?"Ready to claim":unsettled>0?"Awaiting settlement":"Accumulating"}</small></div></div>
        <div className="reward-claim-amount"><strong>{usd(eligible?m.claimableUsdCents:m.grossRedeemableUsdCents+m.pendingUsdCents)}</strong><small>{eligible?`${usd(m.netClaimableUsdCents)} after estimated costs`:m.claimMode!=="cumulative"&&m.claimableEpochIds.length>1?"Preparing a combined claim":`Claim minimum ${usd(m.minimumClaimUsdCents)} net`}</small></div>
        <button className="primary" disabled={busy||Boolean(pending)||!eligible} onClick={()=>void claimBatch([m])}>{busy&&status?<Loader2 size={15} className="spin"/>:null}{eligible?"Claim":"Pending"}</button>
      </article>;
    })}</div>:rewardData&&<div className="workspace-empty"><Gift/><h3>{launch?.rewardMode==="buyback_burn"?"This market buys back and burns tokens.":"No rewards to claim yet."}</h3><p>{launch?.rewardMode==="buyback_burn"?"Buybacks reduce supply; this mode does not pay a wallet reward.":"Your allocations will appear here once they’re indexed."}</p>{!launch&&<Link className="primary" to="/">Explore markets <ArrowRight size={15}/></Link>}</div>}
  </div>;
}
