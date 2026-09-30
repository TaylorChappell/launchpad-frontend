import { captureXReturn, xReturnPath } from "../x-link-state";
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
  if (!loaded) return <main className="page"><div className="page-loading">Loading…</div></main>;
  return enabled ? <FinishXConnection/> : <Navigate to="/" replace/>;
}
function FinishXConnection() {
  const wallet = useWallet(), [params] = useSearchParams(), navigate = useNavigate();
  const [pending] = useState(() => { try { return captureXReturn(sessionStorage,xPendingKey,params); } catch { return null; } });
  const {profile}=useWalletX(pending?.wallet);
  const [busy,setBusy]=useState(false),[error,setError]=useState(pending?.error ?? "");
  const [restartRequired,setRestartRequired]=useState(!pending?.receipt);
  const current=useRef<string|null>(wallet.address); current.current=wallet.address;
  useEffect(()=>{current.current=wallet.address;return()=>{current.current=null;};},[wallet.address]);
  useEffect(() => { navigate("/connect-x", { replace:true }); }, [navigate]);
  async function finish() {
    if (!pending?.receipt || current.current !== pending.wallet || busy || restartRequired) return;
    setBusy(true); setError("");
    try {
      const token=await ensureAccountSession(pending.wallet,wallet.signMessage,()=>current.current===pending.wallet);
      if(current.current!==pending.wallet)return;
      const result=await xRequest<{profile:XProfile}>("/complete",token,{state:pending.state,receipt:pending.receipt});
      if(current.current!==pending.wallet)return;
      setWalletX(pending.wallet,result.profile);sessionStorage.removeItem(xPendingKey);
      navigate(xReturnPath(pending.returnTo),{replace:true});
    } catch(e) {
      if(current.current===pending.wallet){setError(e instanceof Error?e.message:"Could not finish connecting X.");if(e instanceof StudioApiError&&e.status===409)setRestartRequired(true);}
    } finally { setBusy(false); }
  }
  async function restart(){
    if(!pending||current.current!==pending.wallet||busy)return;
    setBusy(true);setError("");
    try{await connectX(pending.wallet,wallet.signMessage,()=>current.current===pending.wallet,pending.returnTo);}
    catch(e){if(current.current===pending.wallet)setError(e instanceof Error?e.message:"Could not restart X sign-in.");}
    finally{setBusy(false);}
  }
  return <main className="page x-callback"><section><XLogo/><h1>{restartRequired&&pending?"Try connecting X again":profile?"Finish reconnecting X":"Finish connecting X"}</h1>
    {!pending?<><p>This sign-in was started in another browser or has expired. Open Ripple and reconnect the X account you want to use.</p><Link className="primary" to="/portfolio?tab=ripple">Open Ripple</Link></>:<>
      {profile?<p>This wallet is linked to <strong>@{profile.username}</strong>. Use that same X account to renew your Ripple permissions.</p>:<p>Link your verified X profile to <WalletIdentity wallet={pending.wallet} link={false}/> so holders can recognise you.</p>}
      {error&&<p className="creator-inline-error" role="alert">{error}</p>}
      {wallet.address===pending.wallet?<>
        {restartRequired&&profile&&<p className="x-retry-help"><a href="https://x.com/" target="_blank" rel="noreferrer">Open X to switch accounts<ExternalLink size={13}/></a><span>Choose @{profile.username} on X, then return here and try again.</span></p>}
        <button className="primary" disabled={busy} onClick={()=>void (restartRequired?restart():finish())}>{busy&&<Loader2 className="spin" size={16}/>}{busy?restartRequired?"Opening X…":"Saving X connection…":restartRequired?"Try X sign-in again":profile?"Finish reconnecting X":"Link X to this wallet"}</button>
      </>:<><p>Connect the wallet that started this sign-in.</p><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></>}
      <Link className="soft-button" to={xReturnPath(pending.returnTo)}>Back to AQUA</Link>
    </>}
  </section></main>;
}
