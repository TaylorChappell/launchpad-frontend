import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useWallet } from "../context";
import { connectX, useWalletX, useXFeature } from "../x-identity";
export function XLogo() { return <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.7-8.8L1.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/></svg>; }
export function XConnect() {
  const wallet = useWallet(), { enabled } = useXFeature();
  const { profile, loaded } = useWalletX(wallet.address);
  return enabled && wallet.address && loaded && !profile ? <ConnectedX key={wallet.address} address={wallet.address}/> : null;
}
function ConnectedX({ address }: { address: string }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const current = useRef(wallet.address), root = useRef<HTMLDivElement>(null); current.current = wallet.address;
  const promptKey = `aqua:x-prompt:${address}`;
  useEffect(() => () => { current.current=null; }, []);
  useEffect(() => { try { if (sessionStorage.getItem(promptKey)) return; sessionStorage.setItem(promptKey,"1"); } catch { /* Still allow this prompt. */ } setOpen(true); }, [promptKey]);
  useEffect(() => { if (!open) return; const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); }; const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown",close); document.addEventListener("keydown",escape); return () => { document.removeEventListener("pointerdown",close); document.removeEventListener("keydown",escape); }; }, [open]);
  async function act() {
    if (busy) return; setBusy(true); setError("");
    try {
      await connectX(address,wallet.signMessage,() => current.current === address);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect X."); }
    finally { setBusy(false); }
  }
  return <div className="x-connect" ref={root}><button className="x-connect-bubble" onClick={() => setOpen(!open)} aria-label="Connect X account" aria-expanded={open}><XLogo/><Plus className="x-connect-plus" size={11}/></button>{open && <section className="x-connect-popover" aria-label="X connection"><button className="x-connect-close" aria-label="Close X connection" onClick={() => setOpen(false)}><X size={15}/></button><h3>Put a name to your wallet</h3><p>Show your photo and @handle on trades, holdings and your coins. This publicly links your X account to this wallet.</p><button className="primary" disabled={busy} onClick={() => void act()}>{busy ? <Loader2 size={15} className="spin"/> : <XLogo/>}Connect X</button>{error && <p className="creator-inline-error" role="alert">{error}</p>}</section>}</div>;
}
