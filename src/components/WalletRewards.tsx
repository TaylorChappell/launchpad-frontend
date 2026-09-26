import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Gift, Loader2 } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { Launch, WalletRewardMarket, WalletRewardsResponse } from "../types";
import { TokenMark } from "./TokenCard";
import { displayTokenAmount } from "../trade-quote";
import { RewardClaimShare, type SharedRewardClaim } from "./RewardClaimShare";

const usd=(cents:number)=>new Intl.NumberFormat("en",{style:"currency",currency:"USD"}).format(cents/100);
type PendingClaim={wallet:string;launchId:string;name:string;signature:string;sequence?:string;epochId?:string;amountUsd:number;lastValidBlockHeight?:number;submittedAt?:number};
function savedClaim(key:string):PendingClaim|null{
  try { const value=JSON.parse(localStorage.getItem(key)??"null");return value&&typeof value.wallet==="string"&&typeof value.launchId==="string"&&typeof value.signature==="string"&&(typeof value.sequence==="string"||typeof value.epochId==="string")?value:null; }catch{return null;}
}
export function WalletRewards({launch,data,launches=[],onClaimed,kind="normal",compact=false}:{compact?:boolean;kind?:"normal"|"ripple";launch?:Launch;data?:WalletRewardsResponse|null;launches?:Launch[];onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime();
  if(launch?.showcase)return <div className="wallet-rewards"><div className="reward-claim-list"><article className="reward-claim-row ready"><div className="reward-claim-coin"><TokenMark launch={launch}/><div><b>{launch.name}</b><small>Sample allocation</small></div></div><div className="reward-row-amount"><strong>$12.50</strong><small>Preview only</small></div><button className="primary" disabled>Claim</button></article></div></div>;
  // Remount on wallet/network change: pending receipts always belong to their signer.
  return <RewardContent key={config.network+":"+wallet.address+":"+(launch?.id??"all")+":"+kind} kind={kind} compact={compact} launch={launch} data={data} launches={launches} onClaimed={onClaimed}/>;
}
function RewardContent({launch,data,launches,onClaimed,kind,compact}:{compact:boolean;kind:"normal"|"ripple";launch?:Launch;data?:WalletRewardsResponse|null;launches:Launch[];onClaimed?:()=>void}){
  const wallet=useWallet(),{config}=useRuntime(),address=wallet.address;
  const storageKey=["aqua:pending-reward",config.network,address].join(":")+(kind==="ripple"?":ripple":"");
  const [loaded,setLoaded]=useState<WalletRewardsResponse|null>(null),[known,setKnown]=useState<Launch[]>([]);
  const [error,setError]=useState(""),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [pending,setPending]=useState<PendingClaim|null>(()=>savedClaim(storageKey));
  const [success,setSuccess]=useState<{signature:string;amount:string}|null>(null);
  const [share,setShare]=useState<SharedRewardClaim|null>(null);
  const [shareOpen,setShareOpen]=useState(false);
  const running=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const rewardData=data===undefined?loaded:data;
  useEffect(()=>{
    if(!address||data!==undefined)return;
    let active=true,inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{const result=await (kind==="ripple"?api.rippleRewards(address):api.rewards(address));if(active){setLoaded(result);setError("");}}catch{if(active)setError("Rewards could not load. Try again.");}finally{inFlight=false;}};
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},20_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[address,data,revision,kind]);
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
    return {name:receipt.name,signature:receipt.signature,amount};
  }
  async function submittedState(receipt:PendingClaim){
    const {Connection}=await import("@solana/web3.js");
    const connection=new Connection(config.publicRpcUrl,"confirmed");
    const chainStatus=(await connection.getSignatureStatuses([receipt.signature],{searchTransactionHistory:true})).value[0];
    if(chainStatus?.err)return "failed" as const;
    if(chainStatus?.confirmationStatus==="confirmed"||chainStatus?.confirmationStatus==="finalized")return "confirmed" as const;
    if(chainStatus)return "pending" as const;
    if(receipt.lastValidBlockHeight!==undefined){
      const blockHeight=await connection.getBlockHeight("confirmed");
      if(blockHeight>receipt.lastValidBlockHeight)return "expired" as const;
    }
    // Receipts written before block-height tracking was added have no expiry data.
    // If the signature is still absent from full RPC history, it was never landed.
    if(receipt.lastValidBlockHeight===undefined&&(!receipt.submittedAt||Date.now()-receipt.submittedAt>120_000))return "expired" as const;
    return "pending" as const;
  }
  function clearFailedClaim(state:"failed"|"expired"){
    remember(null);setStatus("");setRevision(n=>n+1);onClaimed?.();
    setError(state==="failed"?"The claim transaction failed on-chain. Nothing was claimed, so you can try again.":"The claim transaction expired before it landed. Nothing was claimed, so you can try again.");
  }
  async function retry(){
    if(!pending||running.current)return;running.current=true;setBusy(true);setError("");setStatus("Checking confirmation…");
    try{const receipt=await confirm(pending);if(alive.current){setShare({wallet:address!,network:config.network,receipts:[receipt]});setShareOpen(true);}}
    catch{
      try{
        const state=await submittedState(pending);
        if(state==="failed"||state==="expired")clearFailedClaim(state);
        else if(alive.current){setError(state==="confirmed"?"The claim is confirmed on-chain, but AQUA has not recorded it yet. Retry confirmation.":"Confirmation is still pending. Check the transaction or retry confirmation.");setStatus("");}
      }catch{if(alive.current){setError("The transaction status could not be checked. Your pending claim has been kept safely; try again.");setStatus("");}}
    }
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
        submitted={wallet:address,launchId:market.launchId,name:allLaunches.find(l=>l.id===market.launchId)?.name??"Reward",signature,amountUsd:market.claimableUsdCents,lastValidBlockHeight:envelope.lastValidBlockHeight,submittedAt:Date.now(),...("sequence" in envelope?{sequence:String(envelope.sequence)}:{epochId})};
        remember(submitted);if(alive.current)setStatus("Confirming your reward…");
      };
      const signature=await wallet.sendTransaction(envelope,onSubmitted);
      if(!submitted)onSubmitted(signature);
      return await confirm(submitted!);
    }catch(e){
      if(submitted){
        try{
          const state=await submittedState(submitted);
          if(state==="failed"||state==="expired")clearFailedClaim(state);
          else if(alive.current){setStatus("");setError("Claim submitted. Confirmation is pending; you can safely retry confirmation.");}
        }catch{if(alive.current){setStatus("");setError("Claim submitted. Its status could not be checked, so the receipt was kept safely.");}}
      }else if(alive.current){setStatus("");setError(e instanceof Error?e.message:"Could not prepare the claim.");}
      throw e;
    }
  }
  async function claimBatch(selected:WalletRewardMarket[]){
    if(!address||running.current||pending||savedClaim(storageKey))return;
    const eligible=selected.filter(m=>m.canClaim&&(m.claimMode==="cumulative"||m.claimableEpochIds.length===1));
    if(!eligible.length)return;
    running.current=true;setBusy(true);setError("");setSuccess(null);setShare(null);setShareOpen(false);
    let completed=0;
    const receipts:SharedRewardClaim["receipts"]=[];
    try{
      for(const market of eligible){
        if(!alive.current)break;
        const receipt=await executeClaim(market);receipts.push(receipt);completed++;
      }
      if(alive.current&&eligible.length>1)setStatus(`${completed} rewards claimed.`);
    }catch{/* executeClaim keeps the submitted receipt and stops the queue. */}
    finally{running.current=false;if(alive.current){setBusy(false);if(receipts.length){setShare({wallet:address,network:config.network,receipts});setShareOpen(true);}}}
  }
  const claimable=markets.filter(m=>m.canClaim&&(m.claimMode==="cumulative"||m.claimableEpochIds.length===1));
  if(launch&&(!address||(rewardData&&!markets.length&&!pending&&!success&&!error)))return null;
  if(!address)return <section className="wallet-inline"><Gift size={24}/><div><h3>Your rewards are here.</h3><p>Connect your wallet to see your allocation and claim it.</p></div><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></section>;
  return <div className="wallet-rewards">
    {share&&shareOpen&&<RewardClaimShare claim={share} onClose={()=>setShareOpen(false)}/>}
    {!launch&&<div className={compact?"ripple-claim-actions":"claim-all-bar"}>{compact?<h3>Your posts</h3>:<span>{claimable.length} coin{claimable.length===1?"":"s"} ready to claim{claimable.length>1&&<small>Approve each coin in your wallet.</small>}</span>}<button className="primary" disabled={busy||Boolean(pending)||!claimable.length} onClick={()=>void claimBatch(claimable)}>{busy?<><Loader2 size={15} className="spin"/> Claiming…</>:compact?"Claim":"Claim all"}</button></div>}
    {success&&<div className="claim-notice success" role="status"><Check size={20}/><div><b>{success.amount} claimed</b><a href={"https://solscan.io/tx/"+success.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">View receipt <ArrowUpRight size={13}/></a></div>{share&&<button className="soft-button" onClick={()=>setShareOpen(true)}>Share</button>}</div>}
    {pending&&<div className="claim-notice"><Loader2 size={20} className={busy?"spin":""}/><div><b>{pending.name} · claim submitted</b><a href={"https://solscan.io/tx/"+pending.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={13}/></a></div><button className="soft-button" disabled={busy} onClick={()=>void retry()}>Check confirmation</button></div>}
    {status&&<p className="claim-status" role="status">{busy&&<Loader2 className="spin" size={16}/>}{status}</p>}
    {error&&<p className="danger-note" role="alert">{error} {!pending&&!busy&&<button className="text-button" onClick={()=>{setRevision(n=>n+1);onClaimed?.();}}>Try again</button>}</p>}
    {!compact&&(!rewardData&&!error?<div className="workspace-loading">Loading your rewards…</div>:markets.length?<div className="reward-claim-list">{markets.map(m=>{
      const coin=allLaunches.find(l=>l.id===m.launchId);
      const eligible=m.canClaim&&(m.claimMode==="cumulative"||m.claimableEpochIds.length===1);
      return <article className={"reward-claim-row"+(eligible?" ready":"")} key={m.launchId+":"+(m.claimableEpochIds[0]??m.claimSequence??"pending")}>
        <div className="reward-claim-coin">{coin?<TokenMark launch={coin}/>:<Gift size={24}/>}<div>{coin&&!launch?<Link to={"/token/"+coin.id}>{coin.name}</Link>:<b>{coin?.name??"AQUA reward"}</b>}<small>{kind==="ripple"?"Ripple · SOL · ":""}{eligible?"Ready to claim":m.pendingUsdCents>0?"Awaiting settlement":m.canClaim?"Preparing claim":"Below claim minimum"}</small></div></div>
        <div className="reward-row-amount"><strong>{usd(eligible?m.claimableUsdCents:m.grossRedeemableUsdCents+m.pendingUsdCents)}</strong><small>{eligible?`${usd(m.netClaimableUsdCents)} after estimated costs`:m.claimMode!=="cumulative"&&m.claimableEpochIds.length>1?"Preparing a combined claim":`Claim minimum ${usd(m.minimumClaimUsdCents)} net`}</small></div>
        <button className="primary" disabled={busy||Boolean(pending)||!eligible} onClick={()=>void claimBatch([m])}>{busy&&status?<Loader2 size={15} className="spin"/>:null}{eligible?"Claim":"Pending"}</button>
      </article>;
    })}</div>:rewardData&&<div className="workspace-empty"><Gift/><h3>{launch?.rewardMode==="buyback_burn"?"This market buys back and burns tokens.":"No rewards to claim yet."}</h3><p>{launch?.rewardMode==="buyback_burn"?"Buybacks reduce supply; this mode does not pay a wallet reward.":kind==="ripple"?"Rewards from your qualifying X posts will appear here after settlement.":"Your allocations will appear here once they’re indexed."}</p>{!launch&&<Link className="primary" to="/">Explore markets <ArrowRight size={15}/></Link>}</div>)}
  </div>;
}
