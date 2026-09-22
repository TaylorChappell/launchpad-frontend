import { captureXReturn, xReturnPath } from "../x-link-state";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useWallet } from "../context";
import { ensureAccountSession } from "../account-api";
import { setWalletX, xPendingKey, xRequest, type XProfile } from "../x-identity";
import { WalletIdentity } from "../components/WalletIdentity";
import { XLogo } from "../components/XConnect";
export function ConnectX() {
  const wallet = useWallet(), [params] = useSearchParams(), navigate = useNavigate();
  const [pending] = useState(() => { try { return captureXReturn(sessionStorage,xPendingKey,params); } catch { return null; } });
  const [busy,setBusy]=useState(false),[error,setError]=useState(pending?.error ?? ""),[done,setDone]=useState(false);
  const current=useRef(wallet.address); current.current=wallet.address;
  useEffect(() => { navigate("/connect-x", { replace:true }); }, [navigate]);
  async function finish() {
    if (!pending?.receipt || wallet.address !== pending.wallet || busy) return;
    setBusy(true); setError("");
    try { const token=await ensureAccountSession(pending.wallet,wallet.signMessage); if (current.current !== pending.wallet) throw new Error("Wallet changed. Switch back to finish connecting X."); const result=await xRequest<{profile:XProfile}>("/complete",token,{state:pending.state,receipt:pending.receipt}); setWalletX(pending.wallet,result.profile); sessionStorage.removeItem(xPendingKey);setDone(true); }
    catch(e){setError(e instanceof Error?e.message:"Could not finish connecting X.");} finally{setBusy(false);}
  }
  return <main className="page x-callback"><section><XLogo/><h1>{done?"X account connected":"Finish connecting X"}</h1>{done&&pending?<><WalletIdentity wallet={pending.wallet}/><p>Your X profile now appears with this wallet across AQUA.</p><Link className="primary" to={xReturnPath(pending.returnTo)}>Back to AQUA</Link></>:!pending?<><p>This sign-in was started in another browser or has expired. Start again using the X button beside your wallet.</p><Link className="primary" to="/">Back to AQUA</Link></>:<><p>Link your verified X profile to <WalletIdentity wallet={pending.wallet} link={false}/> so holders can recognise you.</p>{pending.receipt&&(wallet.address===pending.wallet?<button className="primary" disabled={busy} onClick={()=>void finish()}>{busy&&<Loader2 className="spin" size={16}/>}Link X to this wallet</button>:<><p>Connect the wallet that started this sign-in.</p><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></>)}{error&&<p className="creator-inline-error" role="alert">{error}</p>}<Link className="soft-button" to="/">Back to AQUA</Link></>}</section></main>;
}
