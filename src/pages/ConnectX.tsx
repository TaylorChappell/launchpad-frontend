import { captureXReturn, xConnectionPath, xReturnPath, xReturnReceipt, type XPending } from "../x-link-state";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "../context";
import { ensureAccountSession } from "../account-api";
import { StudioApiError } from "../studio-api";
import { connectX, setWalletX, useWalletX, useXFeature, xPendingKey, xRequest, type XProfile } from "../x-identity";
import { WalletIdentity } from "../components/WalletIdentity";
import { XLogo } from "../components/XConnect";
export function ConnectX() {
  const { enabled, loaded } = useXFeature();
  const [params] = useSearchParams();
  if (!loaded) return <main className="page"><div className="page-loading">Loading…</div></main>;
  return enabled ? <FinishXConnection key={params.toString()}/> : <Navigate to="/" replace/>;
}
function FinishXConnection() {
  const wallet = useWallet(), [params] = useSearchParams(), navigate = useNavigate();
  const [callback] = useState(() => xReturnReceipt(params));
  const [pending,setPending] = useState<XPending|null>(() => { try { return captureXReturn(sessionStorage,xPendingKey,params); } catch { return null; } });
  const {profile}=useWalletX(pending?.wallet);
  const [busy,setBusy]=useState(false),[error,setError]=useState(pending?.error ?? params.get("error") ?? "");
  const [recovering,setRecovering]=useState(!pending && !!callback),[retry,setRetry]=useState(0),[expired,setExpired]=useState(false);
  const [restartRequired,setRestartRequired]=useState(!pending?.receipt);
  const recovery=useRef<{attempt:number;request:Promise<{wallet:string;username:string;expiresAt:number}>}|null>(null);
  const current=useRef<string|null>(wallet.address); current.current=wallet.address;
  useEffect(()=>{current.current=wallet.address;return()=>{current.current=null;};},[wallet.address]);
  useEffect(()=>{
    if(pending || !callback)return;
    let active=true;setRecovering(true);setError("");setExpired(false);
    const request=recovery.current?.attempt===retry?recovery.current.request:xRequest<{wallet:string;username:string;expiresAt:number}>("/return","",callback);
    recovery.current={attempt:retry,request};
    void request.then(result=>{
      if(!active)return;
      const restored={...callback,wallet:result.wallet,username:result.username,returnTo:"#/portfolio?tab=ripple"};
      try{sessionStorage.setItem(xPendingKey,JSON.stringify(restored));}catch{/* The verified receipt also survives in the URL fragment. */}
      setRecovering(false);setPending(restored);setRestartRequired(false);
    }).catch(e=>{
      if(active){setError(e instanceof Error?e.message:"Could not restore X sign-in. Try again.");setExpired(e instanceof StudioApiError&&e.status===409);}
    }).finally(()=>{if(active)setRecovering(false);});
    return()=>{active=false;};
  },[callback,pending,retry]);
  function connectWallet(){
    // Wallet apps may open a fresh browser with no shared storage. Keep the
    // short-lived callback receipt in the fragment until linking succeeds.
    if(pending?.receipt)navigate(xConnectionPath(pending),{replace:true});
    wallet.setModalOpen(true);
  }
  async function finish() {
    if (!pending?.receipt || current.current !== pending.wallet || busy || restartRequired) return;
    setBusy(true); setError("");
    try {
      const token=await ensureAccountSession(pending.wallet,wallet.signMessage,()=>current.current===pending.wallet);
      if(current.current!==pending.wallet)return;
      const result=await xRequest<{profile:XProfile}>("/complete",token,{state:pending.state,receipt:pending.receipt});
      if(current.current!==pending.wallet)return;
      setWalletX(pending.wallet,result.profile);
      try{sessionStorage.removeItem(xPendingKey);}catch{/* Linking succeeds even when browser storage is unavailable. */}
      navigate(xReturnPath(pending.returnTo),{replace:true});
    } catch(e) {
      if(current.current===pending.wallet){setError(e instanceof Error?e.message:"Could not finish connecting X.");if(e instanceof StudioApiError&&e.status===409)setRestartRequired(true);}
    } finally { setBusy(false); }
  }
  const autoFinished=useRef('');
  useEffect(()=>{
    if(!pending?.receipt||!pending.returnTo.startsWith('#/claim-redirect/')||wallet.address!==pending.wallet||restartRequired||autoFinished.current===pending.state)return;
    autoFinished.current=pending.state;
    void finish();
  },[pending,wallet.address,restartRequired]);
  async function restart(){
    if(!pending||current.current!==pending.wallet||busy)return;
    setBusy(true);setError("");
    try{await connectX(pending.wallet,wallet.signMessage,()=>current.current===pending.wallet,pending.returnTo);}
    catch(e){if(current.current===pending.wallet)setError(e instanceof Error?e.message:"Could not restart X sign-in.");}
    finally{setBusy(false);}
  }
  return <main className="page x-callback"><section><XLogo/><h1>{restartRequired&&pending?"Try connecting X again":profile?"Finish reconnecting X":"Finish connecting X"}</h1>
    {error&&<p className="creator-inline-error" role="alert">{error}</p>}
    {recovering?<p role="status"><Loader2 className="spin" size={16}/> Restoring X connection…</p>:!pending?<>
      <p>{callback&&!expired?"Your X sign-in could not be restored yet. Try again, or start a new sign-in from Ripple.":"Open Ripple and connect the X account you want to use."}</p>
      {callback&&!expired&&<button className="primary" onClick={()=>setRetry(n=>n+1)}>Retry connection check</button>}
      <Link className="soft-button" to="/portfolio?tab=ripple">Open Ripple</Link>
    </>:<>
      {profile?<p>This wallet is linked to <strong>@{profile.username}</strong>. Use that same X account to renew your Ripple permissions.</p>:<p>Link {pending.username?<strong>@{pending.username}</strong>:"your verified X profile"} to <WalletIdentity wallet={pending.wallet} link={false}/> so holders can recognise you.</p>}
      {wallet.address===pending.wallet?<>
        {restartRequired&&profile&&<p className="x-retry-help"><a href="https://x.com/" target="_blank" rel="noreferrer">Open X to switch accounts<ExternalLink size={13}/></a><span>Choose @{profile.username} on X, then return here and try again.</span></p>}
        <button className="primary" disabled={busy} onClick={()=>void (restartRequired?restart():finish())}>{busy&&<Loader2 className="spin" size={16}/>}{busy?restartRequired?"Opening X…":"Saving X connection…":restartRequired?"Try X sign-in again":profile?"Finish reconnecting X":"Link X to this wallet"}</button>
      </>:<><p>Connect the wallet that started this sign-in. {wallet.address&&"Your connected wallet is different."}</p><button className="primary" onClick={connectWallet}>Connect wallet</button></>}
      <Link className="soft-button" to={xReturnPath(pending.returnTo)}>Back to AQUA</Link>
    </>}
  </section></main>;
}
