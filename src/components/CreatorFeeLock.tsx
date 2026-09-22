import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import { displayTokenAmount } from "../trade-quote";
import type { CreatorLock, Launch } from "../types";
import { creatorLockPercentLabel, solscanAccountUrl } from "../creator-lock";
import { creatorLockSubmissionFailed } from "../creator-lock-receipt";

type Receipt = { signature: string; action: "lock" | "release"; lastValidBlockHeight: number };
type Quote = Awaited<ReturnType<typeof api.creatorFeeQuote>>;
const rawInput = (raw: string, decimals: number) => displayTokenAmount(raw, decimals).replaceAll(",", "");
const dateLabel = (seconds: number) => new Date(seconds*1000).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function CreatorFeeLock({ launch, onChanged }: { launch: Launch; onChanged?: () => void }) {
  const wallet = useWallet(), { config } = useRuntime();
  return <LockManager key={`${config.network}:${wallet.address}:${launch.id}`} launch={launch} onChanged={onChanged}/>;
}
function LockManager({ launch, onChanged }: { launch: Launch; onChanged?: () => void }) {
  const wallet = useWallet(), { config } = useRuntime();
  const [lock, setLock] = useState<CreatorLock|null>(launch.creatorLock??null);
  const [editing, setEditing] = useState(false), [amount,setAmount] = useState("");
  const [availableRaw,setAvailableRaw] = useState<string|null>(null), [balanceError,setBalanceError] = useState("");
  const [balanceRevision,setBalanceRevision] = useState(0), [quote,setQuote] = useState<Quote|null>(null), [quoteError,setQuoteError] = useState("");
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const [now,setNow] = useState(()=>Math.floor(Date.now()/1000));
  const maximumDays = Math.max(1,Math.floor(config.creatorLocks.maximumSeconds/86400));
  const minimumDays = Math.max(1,Math.ceil(config.creatorLocks.minimumSeconds/86400));
  const [days,setDays] = useState(String(maximumDays));
  const receiptKey = `aqua:creator-lock:${config.network}:${wallet.address}:${launch.id}`;
  const [receipt,setReceipt] = useState<Receipt|null>(()=>{try{const saved=JSON.parse(localStorage.getItem(receiptKey)??"null");return saved&&typeof saved.signature==="string"&&["lock","release"].includes(saved.action)&&Number.isSafeInteger(saved.lastValidBlockHeight)?saved:null;}catch{return null;}});
  const running=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{setLock(launch.creatorLock??null);},[launch.creatorLock]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Math.floor(Date.now()/1000)),1000);return()=>window.clearInterval(timer);},[]);
  const active = lock?.status==="active";
  const ownedLock = !active || lock.creatorWallet===wallet.address;
  const mature = Boolean(active && now>=lock.unlockAt);
  const minimumRenewalDays = active ? Math.max(minimumDays,Math.ceil((lock.unlockAt-now)/86400)) : minimumDays;
  const enteredDays=Number(days), effectiveDays=Math.min(maximumDays,Math.max(minimumRenewalDays,Number.isFinite(enteredDays)?Math.round(enteredDays):minimumRenewalDays));
  const amountRaw=useMemo(()=>{try{return decimalToRaw(amount||"0",launch.tokenDecimals);}catch{return "0";}},[amount,launch.tokenDecimals]);
  const exceedsAvailable=availableRaw!==null&&BigInt(amountRaw)>BigInt(availableRaw);
  const isOwner=wallet.address===launch.creatorWallet;
  const formVisible=!active||editing;
  const canAdd=!active||Boolean(config.creatorLocks.additionsEnabled&&ownedLock);
  const totalLockedRaw=quote?.totalLockedRaw??(BigInt(active?lock.amountRaw:"0")+BigInt(quote?.estimatedLockedRaw??"0")).toString();
  const supplyPercent=Number(launch.totalSupplyRaw)>0?Number(totalLockedRaw)/Number(launch.totalSupplyRaw)*100:0;
  const targetPercent=(config.creatorLocks.targetSupplyBps??500)/100;
  const activeShare=active&&!mature&&ownedLock?lock.feeShareBps:0;
  const tradeShare=config.fees.platformBps/100*activeShare/10000;
  const estimatedShare=config.fees.platformBps/100*(quote?.feeShareBps??0)/10000;
  const progress=active?Math.min(100,Math.max(0,(now-lock.lockedAt)/Math.max(1,lock.unlockAt-lock.lockedAt)*100)):0;
  const remaining=active?Math.max(0,lock.unlockAt-now):0;
  const timeLeft=remaining>=86400?`${Math.ceil(remaining/86400)} days remaining`:remaining>=3600?`${Math.ceil(remaining/3600)} hours remaining`:`${Math.ceil(remaining/60)} minutes remaining`;

  useEffect(()=>{
    let current=true;
    if(!isOwner||!formVisible)return;
    setAvailableRaw(null);setBalanceError("");
    api.creatorLockBalance(launch.id,launch.creatorWallet).then(balance=>{if(current)setAvailableRaw(balance.availableRaw);}).catch(e=>{if(current)setBalanceError(e instanceof Error?e.message:"Could not read your balance.");});
    return()=>{current=false;};
  },[launch.id,launch.creatorWallet,isOwner,formVisible,balanceRevision]);
  useEffect(()=>{
    let current=true;setQuote(null);setQuoteError("");
    if(!isOwner||!formVisible||!canAdd||BigInt(amountRaw)<=0n||exceedsAvailable)return;
    const timer=window.setTimeout(()=>{api.creatorFeeQuote(amountRaw,launch.totalSupplyRaw,effectiveDays*86400,launch.id).then(result=>{if(current)setQuote(result);}).catch(e=>{if(current)setQuoteError(e instanceof Error?e.message:"Could not calculate this lock.");});},250);
    return()=>{current=false;window.clearTimeout(timer);};
  },[amountRaw,effectiveDays,exceedsAvailable,isOwner,formVisible,canAdd,launch.id,launch.totalSupplyRaw,lock?.amountRaw,lock?.unlockAt]);
  function remember(value:Receipt|null){try{if(value)localStorage.setItem(receiptKey,JSON.stringify(value));else localStorage.removeItem(receiptKey);}catch{/* Keep the receipt in memory. */}if(alive.current)setReceipt(value);}
  async function act(action:"lock"|"release"){
    if(running.current||!isOwner||!wallet.address)return;
    if(!receipt&&action==="lock"&&(!canAdd||!quote||availableRaw===null||exceedsAvailable||BigInt(amountRaw)<=0n))return;
    running.current=true;setBusy(true);setError("");let submitted=receipt;
    try{
      if(!submitted){
        const envelope=action==="lock"?await api.creatorLockTransaction(launch.id,wallet.address,amountRaw,effectiveDays*86400):await api.creatorLockReleaseTransaction(launch.id,wallet.address);
        if(!alive.current)return;
        await wallet.sendTransaction(envelope,signature=>{submitted={signature,action,lastValidBlockHeight:envelope.lastValidBlockHeight};remember(submitted);});
      }
      if(!submitted)return;
      const result=await api.confirmCreatorLock(launch.id,wallet.address,submitted.signature);
      remember(null);
      if(alive.current){setLock(result.creatorLock);setEditing(false);setAmount("");setBalanceRevision(n=>n+1);toast.success(submitted.action==="release"?"Creator tokens released.":"Your token lock has been updated.");onChanged?.();}
    }catch(e){
      // Never submit another addition while its previous transaction may land.
      let terminal=false;
      if(submitted){try{
        const {Connection}=await import("@solana/web3.js");const rpc=new Connection(config.publicRpcUrl,"confirmed");
        terminal=await creatorLockSubmissionFailed(rpc,submitted.signature,submitted.lastValidBlockHeight);
        if(terminal)remember(null);
      }catch{/* Preserve ambiguous receipts. */}}
      if(alive.current)setError(terminal?"This transaction failed or expired. You can try again.":submitted?"Transaction submitted. Check confirmation before making another change.":e instanceof Error?e.message:"Could not update your lock.");
    }finally{running.current=false;if(alive.current)setBusy(false);}
  }
  if(!isOwner)return null;
  return <div className="creator-lock-manager">
    {receipt&&<div className="creator-lock-receipt" role="status"><div><strong>Lock update submitted</strong><a href={`https://solscan.io/tx/${receipt.signature}${config.network==="devnet"?"?cluster=devnet":""}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13}/></a></div><button className="soft-button" disabled={busy} onClick={()=>void act(receipt.action)}>{busy?<Loader2 size={15} className="spin"/>:null}Check confirmation</button></div>}
    {error&&<p className="creator-earnings-error" role="alert">{error}</p>}
    {active&&<section className="creator-lock-card">
      <header><div><span className="creator-eyebrow">Your commitment</span><h3>Locked supply</h3></div><span className={`creator-lock-status ${mature?"mature":""}`}>{mature?"Ready to release":"Lock active"}</span></header>
      <div className="creator-lock-metrics"><div><strong>{creatorLockPercentLabel(lock)}</strong><span>of the token supply</span><small>{displayTokenAmount(lock.amountRaw,launch.tokenDecimals)} {launch.symbol}</small></div><div><strong>{tradeShare.toFixed(3)}%</strong><span>per eligible transfer</span><small>{(activeShare/100).toFixed(2)}% of the platform fee</small></div></div>
      <div className="creator-lock-timeline"><div><strong>{mature?"Your tokens can now be released":timeLeft}</strong><span>Unlocks {dateLabel(lock.unlockAt)}</span></div><progress value={progress} max={100} aria-label="Lock duration elapsed"/><small>{mature?"This lock has stopped earning new fees. Accumulated fees remain claimable.":"Your fee share stays active until this lock expires."}</small></div>
      {!ownedLock&&<p className="creator-earnings-note">This lock belongs to the previous creator. Only that wallet can release its tokens.</p>}
      <footer><a href={solscanAccountUrl(lock.vaultTokenAccount,config.network)} target="_blank" rel="noreferrer">View lock <ExternalLink size={14}/></a><div><button className="soft-button" disabled={busy||Boolean(receipt)||!mature||!ownedLock} onClick={()=>void act("release")}>Release tokens</button><button className="primary" disabled={busy||Boolean(receipt)||!canAdd} onClick={()=>setEditing(value=>!value)}><Plus size={16}/>{editing?"Close editor":"Lock more supply"}</button></div></footer>
      {!config.creatorLocks.additionsEnabled&&ownedLock&&<p className="creator-earnings-note">Adding to an active lock is not available yet.</p>}
    </section>}
    {formVisible&&<div className="manage-grid creator-lock-editor">
      <section className="manage-builder">
        <header><h2>{active?"Add to your lock":"Set up a token lock"}</h2><p>{active?"Add tokens from your wallet and choose a new duration for the combined balance.":"Commit supply to earn a share of the platform fee."}</p></header>
        <label><span>{active?"Additional tokens":"Tokens to lock"}</span><div className={`manage-input ${exceedsAvailable?"invalid":""}`}><input aria-label={active?"Additional tokens to lock":"Tokens to lock"} value={amount} inputMode="decimal" placeholder="0" disabled={busy||Boolean(receipt)} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))}/><b>{launch.symbol}</b></div><small className={`creator-lock-balance ${exceedsAvailable?"cap-warning":""}`}><span>{balanceError|| (availableRaw===null?"Reading wallet balance…":`${displayTokenAmount(availableRaw,launch.tokenDecimals)} ${launch.symbol} available`)}</span>{balanceError?<button onClick={()=>setBalanceRevision(n=>n+1)}>Retry</button>:availableRaw!==null&&BigInt(availableRaw)>0n&&<button disabled={busy||Boolean(receipt)} onClick={()=>setAmount(rawInput(availableRaw,launch.tokenDecimals))}>Max</button>}</small>{exceedsAvailable&&<small className="cap-warning">Enter an amount within your wallet balance.</small>}</label>
        <label><span>{active?"Renew combined lock for":"Lock duration"}</span><div className="manage-input"><input aria-label="Lock duration in days" value={days} inputMode="numeric" disabled={busy||Boolean(receipt)} onChange={e=>setDays(e.target.value.replace(/[^0-9]/g,""))}/><b>days</b></div><small>{enteredDays!==effectiveDays?`Using ${effectiveDays} days. `:""}{minimumRenewalDays}–{maximumDays} days{active?" · Cannot shorten your current lock":""}</small></label>
        <div className="duration-presets">{[minimumRenewalDays,30,90,180,maximumDays].filter((value,index,array)=>value>=minimumRenewalDays&&value<=maximumDays&&array.indexOf(value)===index).map(value=><button key={value} disabled={busy||Boolean(receipt)} className={effectiveDays===value?"active":""} onClick={()=>setDays(String(value))}>{value===maximumDays?`Max · ${value}d`:`${value} days`}</button>)}</div>
        {active&&<p className="creator-lock-renewal">Your existing {displayTokenAmount(lock.amountRaw,launch.tokenDecimals)} {launch.symbol} and the new tokens will share the new unlock date. The full balance stays locked until then.</p>}
      </section>
      <aside className="manage-quote">
        <h2>{active?"Your updated fee share":"Your creator fee"}</h2><strong>{quote?`${estimatedShare.toFixed(3)}%`:"—"}</strong><p>of each eligible transfer during your lock</p>
        <dl><div><dt>{active?"Combined supply":"Locked supply"}</dt><dd>{quote?`${supplyPercent.toFixed(supplyPercent<.01?4:2)}%`:"—"}</dd></div><div><dt>Total tokens locked</dt><dd>{quote?`${displayTokenAmount(totalLockedRaw,launch.tokenDecimals)} ${launch.symbol}`:"—"}</dd></div><div><dt>Transfer fee on deposit</dt><dd>{quote?.estimatedTransferFeeRaw?`${displayTokenAmount(quote.estimatedTransferFeeRaw,launch.tokenDecimals)} ${launch.symbol}`:"—"}</dd></div><div><dt>New unlock date</dt><dd>{quote?.unlockAt?dateLabel(quote.unlockAt):"—"}</dd></div></dl>
        <p>{targetPercent}% of supply for {maximumDays} days reaches the maximum share.</p>
        {quoteError&&<p className="creator-earnings-error" role="alert">{quoteError}</p>}
        <button className="primary full" disabled={busy||Boolean(receipt)||availableRaw===null||BigInt(amountRaw)<=0n||exceedsAvailable||!quote||!canAdd} onClick={()=>void act("lock")}>{busy&&<Loader2 size={16} className="spin"/>}Review lock in wallet</button>
      </aside>
    </div>}
  </div>;
}
