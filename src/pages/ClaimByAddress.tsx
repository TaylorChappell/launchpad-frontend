import { useEffect, useState, type FormEvent } from "react";
import { PublicKey } from "@solana/web3.js";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, Search, Wallet, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api, type AddressClaimChallenge, type AddressClaimMarket } from "../api";
import type { WalletRewardMarket, WalletRewardsResponse } from "../types";
import "../address-claims.css";

const formatSol = (lamports: string) => (Number(lamports) / 1_000_000_000).toLocaleString("en", { maximumFractionDigits: 6 });
const formatUsd = (cents: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(cents/100);
const storageKey = (wallet: string) => `aqua:address-claim:${wallet}`;

export function ClaimByAddress() {
  const [input,setInput]=useState(""),[address,setAddress]=useState(""),[markets,setMarkets]=useState<AddressClaimMarket[]|null>(null);
  const [rewards,setRewards]=useState<WalletRewardsResponse|null>(null),[claimsEnabled,setClaimsEnabled]=useState(false),[rewardClaimsEnabled,setRewardClaimsEnabled]=useState(false);
  const [challenge,setChallenge]=useState<AddressClaimChallenge|null>(null),[verified,setVerified]=useState(false);
  const [payout,setPayout]=useState<{status:string;signature:string|null}|null>(null),[claimed,setClaimed]=useState(false),[popupOpen,setPopupOpen]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[now,setNow]=useState(Date.now());
  useEffect(()=>{if(!challenge || verified) return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[challenge?.id,verified]);

  async function lookup(event: FormEvent) {
    event.preventDefault(); setError(""); setMarkets(null); setRewards(null); setChallenge(null); setPayout(null); setClaimed(false); setPopupOpen(false); setVerified(false);
    let wallet: string;
    try { wallet = new PublicKey(input.trim()).toBase58(); if(wallet!==input.trim()) throw new Error(); }
    catch { setError("Enter a valid Solana wallet address."); return; }
    setBusy(true);
    try {
      const [result,holderRewards]=await Promise.all([api.addressClaimLookup(wallet),api.rewards(wallet).catch(()=>null)]);
      setAddress(wallet); setMarkets(result.markets); setClaimsEnabled(result.claimsEnabled); setRewardClaimsEnabled(result.rewardClaimsEnabled); setRewards(holderRewards);
      try {
        const saved=localStorage.getItem(storageKey(wallet));
        if(saved) {
          const previous=JSON.parse(saved) as AddressClaimChallenge;
          if(previous.wallet===wallet && previous.expiresAt>Date.now()-24*60*60_000) { setChallenge(previous); setPopupOpen(true); }
          else localStorage.removeItem(storageKey(wallet));
        }
      } catch { /* The claim still works without local storage. */ }
    } catch(e) { setError(e instanceof Error?e.message:"Could not load this wallet."); }
    finally { setBusy(false); }
  }

  useEffect(()=>{
    if(!challenge) return;
    let active=true, pending=false;
    const poll=async()=>{
      if(pending || document.visibilityState==="hidden") return;
      pending=true;
      try {
        const result=await api.addressClaimStatus(challenge.id,challenge.token);
        if(active) {
          setVerified(result.verified);
          if(!result.verified) setError("");
          if(result.payout) setPayout(result.payout);
          if(result.claimed) setClaimed(true);
          if(result.claimed && challenge.kind !== "creator") setRewards(await api.rewards(challenge.wallet).catch(()=>null));
        }
      } catch(e) { if(active) setError(e instanceof Error?e.message:"Verification status unavailable."); }
      finally { pending=false; }
    };
    void poll();
    const timer=window.setInterval(()=>void poll(),6_000);
    const onVisible=()=>{if(document.visibilityState==="visible") void poll();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[challenge?.id,challenge?.token]);

  useEffect(()=>{
    if(!popupOpen) return;
    const onEscape=(event:KeyboardEvent)=>{if(event.key==="Escape") setPopupOpen(false);};
    document.addEventListener("keydown",onEscape);
    return()=>document.removeEventListener("keydown",onEscape);
  },[popupOpen]);

  async function start(launchId:string,kind:"creator"|"cumulative"|"legacy"="creator",epochId?:string) {
    if(challenge && challenge.launchId===launchId && challenge.kind===kind && challenge.epochId===(epochId??null) && challenge.expiresAt>Date.now() && !claimed) { setPopupOpen(true); return; }
    setError("");setBusy(true);setPayout(null);setClaimed(false);setVerified(false);
    try {
      const result=await api.addressClaimStart(address,launchId,kind,epochId);
      setChallenge(result);
      setPopupOpen(true);
      try { localStorage.setItem(storageKey(address),JSON.stringify(result)); } catch { /* Keep this request open. */ }
    } catch(e) { setError(e instanceof Error?e.message:"Could not start verification."); }
    finally { setBusy(false); }
  }
  async function claim() {
    if(!challenge || !verified) return;
    setBusy(true);setError("");
    try {
      const result=await api.addressClaimPayout(challenge.id,challenge.token);
      setPayout(result);
      if(result.status==="claimed") setClaimed(true);
      const updated=await api.addressClaimLookup(address);
      setMarkets(updated.markets);
    } catch(e) { setError(e instanceof Error?e.message:"Could not request the payout."); }
    finally { setBusy(false); }
  }
  const holderTotal=rewards?.markets.reduce((sum,market)=>sum+market.grossRedeemableUsdCents,0)??0;
  const selected=markets?.find(m=>m.launchId===challenge?.launchId);
  const rewardSelected=challenge?.kind==="cumulative" || challenge?.kind==="legacy";
  const rewardTicker=(market:WalletRewardMarket)=>{
    const ticker=market.symbol??markets?.find(item=>item.launchId===market.launchId)?.symbol;
    return ticker?`$${ticker}`:"Coin";
  };
  const expired=Boolean(challenge && !verified && now>=challenge.expiresAt);

  return <main className="page address-claim-page">
    <Link className="back" to="/portfolio"><ArrowLeft size={16}/> My holdings</Link>
    <header className="address-claim-header"><span className="workspace-icon"><Wallet size={24}/></span><h1>Claim with your address</h1><p>Enter your Solana wallet to find rewards and fees.</p></header>
    <form className="address-claim-lookup" onSubmit={e=>void lookup(e)}>
      <label htmlFor="claim-wallet">Solana wallet address</label><div><input id="claim-wallet" value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter your wallet address" autoComplete="off" spellCheck={false}/><button className="primary" disabled={busy || !input.trim()}>{busy?<Loader2 className="spin" size={16}/>:<Search size={16}/>} Find fees</button></div>
    </form>
    {error&&!popupOpen&&<p className="address-claim-error" role="alert">{error}</p>}
    {markets&&<section className="address-claim-results"><h2>Fees and rewards for {address.slice(0,5)}…{address.slice(-5)}</h2>
      {challenge&&<button className="soft-button address-claim-resume" onClick={()=>setPopupOpen(true)}>Continue {challenge.kind==="creator"?"fee":"reward"} claim <ArrowRight size={15}/></button>}
      {markets.length?markets.map(m=><article className="address-claim-market" key={m.launchId}><div><Link to={`/token/${m.launchId}`}>{m.name} <span>${m.symbol}</span></Link><p>Creator fees</p><strong>{formatSol(m.availableLamports)} SOL</strong>{BigInt(m.pendingLamports)>0n&&<small>{formatSol(m.pendingLamports)} SOL processing</small>}{BigInt(m.availableLamports)>0n&&BigInt(m.availableLamports)<=1_000_000n&&<small>Below verification cost.</small>}</div><button className="primary" disabled={!claimsEnabled || busy || BigInt(m.availableLamports)<=1_000_000n} onClick={()=>void start(m.launchId)}>Claim <ArrowRight size={15}/></button></article>):<p className="address-claim-empty">No creator fees available.</p>}
      {!claimsEnabled&&markets.length>0&&<p className="address-claim-note">Creator claims are currently unavailable.</p>}
      {holderTotal>0&&<div className="address-claim-holder"><b>Holder rewards: {formatUsd(holderTotal)}</b></div>}
      {rewards?.markets.filter(m=>m.grossRedeemableUsdCents>0).map(m=>m.claimMode==="cumulative"
        ? <article className="address-claim-market" key={`reward-${m.launchId}`}><div><Link to={`/token/${m.launchId}`}>Holder rewards · {rewardTicker(m)}</Link><p>Available at the current checkpoint</p><strong>{formatUsd(m.grossRedeemableUsdCents)}</strong>{!m.canClaim&&<small>Accumulating until the minimum claim amount is reached.</small>}</div><button className="primary" disabled={!rewardClaimsEnabled||!m.canClaim||busy} onClick={()=>void start(m.launchId,"cumulative")}>Claim rewards <ArrowRight size={15}/></button></article>
        : m.claimableEpochIds.map(epochId=>{const epoch=rewards.rewards.find(r=>r.epochId===epochId);const eligible=m.canClaim&&Boolean(epoch&&epoch.amountUsdCents>m.minimumClaimUsdCents+m.estimatedClaimFeeUsdCents);return <article className="address-claim-market" key={epochId}><div><Link to={`/token/${m.launchId}`}>Holder rewards · {rewardTicker(m)}</Link><p>Reward epoch {epochId.slice(0,8)}</p><strong>{formatUsd(epoch?.amountUsdCents??0)}</strong>{!eligible&&<small>This individual reward is below the claim minimum after costs.</small>}</div><button className="primary" disabled={!rewardClaimsEnabled||!eligible||busy} onClick={()=>void start(m.launchId,"legacy",epochId)}>Claim rewards <ArrowRight size={15}/></button></article>;}))}
      {!rewardClaimsEnabled&&holderTotal>0&&<p className="address-claim-note">Reward claims are currently unavailable.</p>}
    </section>}
    {challenge&&popupOpen&&createPortal(<div className="address-claim-overlay" onMouseDown={e=>{if(e.target===e.currentTarget) setPopupOpen(false)}}>
      <section className="address-claim-proof" role="dialog" aria-modal="true" aria-labelledby="address-claim-title">
        <button className="address-claim-close" aria-label="Close claim popup" onClick={()=>setPopupOpen(false)}><X size={19}/></button>
        <h2 id="address-claim-title">{claimed?"Claim submitted":verified?"Wallet verified":expired?"Request expired":"Verify your wallet"}</h2>
        {!verified&&!expired&&!claimed&&<>
          <div className="address-claim-payment"><span>From</span><code>{challenge.wallet}</code><span>Amount</span><strong>0.001 SOL</strong><span>To</span><div className="address-claim-destination"><code>{challenge.depositAddress}</code><button aria-label="Copy deposit address" onClick={()=>void navigator.clipboard.writeText(challenge.depositAddress)}><Copy size={15}/></button></div></div>
          <p className="address-claim-note">Verification payment is not returned. Claim goes to the sending wallet.</p>
          <p className="address-claim-wait" role="status"><Loader2 className="spin" size={16}/> Detecting your transfer automatically · Expires {new Date(challenge.expiresAt).toLocaleTimeString()}</p>
        </>}
        {expired&&<><p>Start again before sending SOL.</p><button className="primary" disabled={busy} onClick={()=>void start(challenge.launchId,challenge.kind,challenge.epochId??undefined)}>New request</button></>}
        {verified&&!claimed&&(!payout||payout.status==="ready")&&<><p>Ready to send {rewardSelected?"rewards":`${selected?.symbol??"creator"} fees`} to your wallet.</p><button className="primary" disabled={busy} onClick={()=>void claim()}>{busy?<Loader2 size={16} className="spin"/>:<CheckCircle2 size={16}/>} Claim now</button></>}
        {(claimed||payout&&payout.status!=="ready")&&<p className="address-claim-success"><CheckCircle2 size={16}/> {payout?.status==="claimed"?"Payout confirmed":"Payout processing"}{payout?.signature&&<> · <a href={`https://solscan.io/tx/${payout.signature}`} target="_blank" rel="noreferrer">View transaction</a></>}</p>}
        {error&&<p className="address-claim-error" role="alert">{error}</p>}
      </section>
    </div>,document.body)}
  </main>;
}
