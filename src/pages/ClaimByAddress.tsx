import { useEffect, useState, type FormEvent } from "react";
import { PublicKey } from "@solana/web3.js";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, Search, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type AddressClaimChallenge, type AddressClaimMarket } from "../api";
import type { WalletRewardsResponse } from "../types";
import "../address-claims.css";

const formatSol = (lamports: string) => (Number(lamports) / 1_000_000_000).toLocaleString("en", { maximumFractionDigits: 6 });
const formatUsd = (cents: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(cents/100);
const storageKey = (wallet: string) => `aqua:address-claim:${wallet}`;

export function ClaimByAddress() {
  const [input,setInput]=useState(""),[address,setAddress]=useState(""),[markets,setMarkets]=useState<AddressClaimMarket[]|null>(null);
  const [rewards,setRewards]=useState<WalletRewardsResponse|null>(null),[claimsEnabled,setClaimsEnabled]=useState(false),[rewardClaimsEnabled,setRewardClaimsEnabled]=useState(false);
  const [challenge,setChallenge]=useState<AddressClaimChallenge|null>(null),[verified,setVerified]=useState(false);
  const [signature,setSignature]=useState(""),[payout,setPayout]=useState<{status:string;signature:string|null}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[now,setNow]=useState(Date.now());
  useEffect(()=>{if(!challenge || verified) return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[challenge?.id,verified]);

  async function lookup(event: FormEvent) {
    event.preventDefault(); setError(""); setMarkets(null); setRewards(null); setChallenge(null); setPayout(null); setVerified(false);
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
          if(previous.wallet===wallet && previous.expiresAt>Date.now()-24*60*60_000) setChallenge(previous);
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
          if(result.signature) setSignature(result.signature);
          if(result.payout) setPayout(result.payout);
          if(result.claimed && challenge.kind !== "creator") setRewards(await api.rewards(challenge.wallet).catch(()=>null));
        }
      } catch(e) { if(active) setError(e instanceof Error?e.message:"Verification status unavailable."); }
      finally { pending=false; }
    };
    void poll();
    const timer=window.setInterval(()=>void poll(),6_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[challenge?.id,challenge?.token]);

  async function start(launchId:string,kind:"creator"|"cumulative"|"legacy"="creator",epochId?:string) {
    setError("");setBusy(true);setPayout(null);setVerified(false);setSignature("");
    try {
      const result=await api.addressClaimStart(address,launchId,kind,epochId);
      setChallenge(result);
      try { localStorage.setItem(storageKey(address),JSON.stringify(result)); } catch { /* Keep this request open. */ }
    } catch(e) { setError(e instanceof Error?e.message:"Could not start verification."); }
    finally { setBusy(false); }
  }
  async function verify() {
    if(!challenge) return;
    setBusy(true);setError("");
    try { const result=await api.addressClaimVerify(challenge.id,challenge.token,signature.trim());setVerified(result.verified); }
    catch(e) { setError(e instanceof Error?e.message:"This transaction could not be verified."); }
    finally { setBusy(false); }
  }
  async function claim() {
    if(!challenge || !verified) return;
    setBusy(true);setError("");
    try {
      const result=await api.addressClaimPayout(challenge.id,challenge.token);
      setPayout(result);
      const updated=await api.addressClaimLookup(address);
      setMarkets(updated.markets);
    } catch(e) { setError(e instanceof Error?e.message:"Could not request the payout."); }
    finally { setBusy(false); }
  }
  const holderTotal=rewards?.markets.reduce((sum,market)=>sum+market.grossRedeemableUsdCents,0)??0;
  const selected=markets?.find(m=>m.launchId===challenge?.launchId);
  const rewardSelected=challenge?.kind==="cumulative" || challenge?.kind==="legacy";
  const expired=Boolean(challenge && !verified && now>=challenge.expiresAt);

  return <main className="page address-claim-page">
    <Link className="back" to="/portfolio"><ArrowLeft size={16}/> My holdings</Link>
    <header className="address-claim-header"><span className="workspace-icon"><Wallet size={24}/></span><h1>Can’t connect your wallet?</h1><p>Look up a Solana address to see its holder rewards and creator fees. Verify control with a 0.001 SOL transfer to request a payout to that same address.</p></header>
    <form className="address-claim-lookup" onSubmit={e=>void lookup(e)}>
      <label htmlFor="claim-wallet">Solana wallet address</label><div><input id="claim-wallet" value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter your wallet address" autoComplete="off" spellCheck={false}/><button className="primary" disabled={busy || !input.trim()}>{busy?<Loader2 className="spin" size={16}/>:<Search size={16}/>} Find fees</button></div>
    </form>
    {error&&<p className="address-claim-error" role="alert">{error}</p>}
    {markets&&<section className="address-claim-results"><h2>Fees and rewards for {address.slice(0,5)}…{address.slice(-5)}</h2>
      {markets.length?markets.map(m=><article className="address-claim-market" key={m.launchId}><div><Link to={`/token/${m.launchId}`}>{m.name} <span>${m.symbol}</span></Link><p>Creator fees available</p><strong>{formatSol(m.availableLamports)} SOL</strong>{BigInt(m.pendingLamports)>0n&&<small>{formatSol(m.pendingLamports)} SOL payout processing</small>}{BigInt(m.availableLamports)>0n&&BigInt(m.availableLamports)<=1_000_000n&&<small>Verification would cost at least as much as this payout.</small>}</div><button className="primary" disabled={!claimsEnabled || busy || BigInt(m.availableLamports)<=1_000_000n} onClick={()=>void start(m.launchId)}>Claim <ArrowRight size={15}/></button></article>):<p className="address-claim-empty">No creator SOL fees are available for this address.</p>}
      {!claimsEnabled&&markets.length>0&&<p className="address-claim-note">Address verification is temporarily unavailable. Do not send SOL until a verification request appears here.</p>}
      {holderTotal>0&&<div className="address-claim-holder"><b>Holder rewards: {formatUsd(holderTotal)}</b><p>Each claim sends rewards to this wallet. Claimable amounts must exceed the minimum after network costs.</p></div>}
      {rewards?.markets.filter(m=>m.grossRedeemableUsdCents>0).map(m=>m.claimMode==="cumulative"
        ? <article className="address-claim-market" key={`reward-${m.launchId}`}><div><Link to={`/token/${m.launchId}`}>Holder rewards · {markets.find(x=>x.launchId===m.launchId)?.name??m.launchId.slice(0,8)}</Link><p>Available at the current checkpoint</p><strong>{formatUsd(m.grossRedeemableUsdCents)}</strong>{!m.canClaim&&<small>Accumulating until the minimum claim amount is reached.</small>}</div><button className="primary" disabled={!rewardClaimsEnabled||!m.canClaim||busy} onClick={()=>void start(m.launchId,"cumulative")}>Claim rewards <ArrowRight size={15}/></button></article>
        : m.claimableEpochIds.map(epochId=>{const epoch=rewards.rewards.find(r=>r.epochId===epochId);const eligible=m.canClaim&&Boolean(epoch&&epoch.amountUsdCents>m.minimumClaimUsdCents+m.estimatedClaimFeeUsdCents);return <article className="address-claim-market" key={epochId}><div><Link to={`/token/${m.launchId}`}>Holder rewards · {markets.find(x=>x.launchId===m.launchId)?.name??m.launchId.slice(0,8)}</Link><p>Reward epoch {epochId.slice(0,8)}</p><strong>{formatUsd(epoch?.amountUsdCents??0)}</strong>{!eligible&&<small>This individual reward is below the claim minimum after costs.</small>}</div><button className="primary" disabled={!rewardClaimsEnabled||!eligible||busy} onClick={()=>void start(m.launchId,"legacy",epochId)}>Claim rewards <ArrowRight size={15}/></button></article>;}))}
      {!rewardClaimsEnabled&&holderTotal>0&&<p className="address-claim-note">Wallet verified reward payouts are awaiting the AQUA reward program upgrade. Do not send SOL for rewards until a verification request is available.</p>}
    </section>}
    {challenge&&<section className="address-claim-proof">
      <h2>{verified?"Wallet verified":"Verify your wallet"}</h2>
      <p>{verified?"This transfer has been recorded and cannot be reused for another verification.":"Send exactly 0.001 SOL from the address above to the AQUA address below. Only send after starting this request. We check for a finalized transfer automatically."}</p>
      {!expired&&<div className="address-claim-payment"><span>Send from</span><code>{challenge.wallet}</code><span>Send exactly</span><strong>0.001 SOL</strong><span>Send to</span><div className="address-claim-destination"><code>{challenge.depositAddress}</code><button aria-label="Copy deposit address" onClick={()=>void navigator.clipboard.writeText(challenge.depositAddress)}><Copy size={15}/></button></div></div>}
      <p className="address-claim-note">This 0.001 SOL verification payment is not returned. AQUA sends {rewardSelected?"rewards":"creator fees"} only to the wallet that sent it. Each verification request applies to one claim. Never enter a seed phrase or private key.</p>
      {expired?<div className="address-claim-expired"><p>This request expired. Do not send SOL to the old address for this request.</p><button className="primary" disabled={busy} onClick={()=>void start(challenge.launchId,challenge.kind,challenge.epochId??undefined)}>Start a new request</button></div>:!verified&&<><p className="address-claim-wait"><Loader2 className="spin" size={15}/> Waiting for a finalized transfer. Request expires {new Date(challenge.expiresAt).toLocaleTimeString()}.</p><div className="address-claim-signature"><label htmlFor="claim-tx">Have a transaction signature? Check it directly</label><div><input id="claim-tx" value={signature} onChange={e=>setSignature(e.target.value)} placeholder="Transaction signature"/><button className="soft-button" disabled={busy||signature.trim().length<64} onClick={()=>void verify()}>Check transfer</button></div></div></>}
      {verified&&(!payout||payout.status==="ready")&&<button className="primary" disabled={busy} onClick={()=>void claim()}>{busy?<Loader2 size={16} className="spin"/>:<CheckCircle2 size={16}/>} Claim {rewardSelected?"holder rewards":selected?.name??"creator fees"} to this wallet</button>}
      {payout&&payout.status!=="ready"&&<p className="address-claim-success"><CheckCircle2 size={16}/> Payout {payout.status==="claimed"?"confirmed":"processing"} for {address.slice(0,5)}…{address.slice(-5)}. {payout.signature?<a href={`https://solscan.io/tx/${payout.signature}`} target="_blank" rel="noreferrer">View transaction</a>:"It will appear on-chain when processed."}</p>}
    </section>}
  </main>;
}
