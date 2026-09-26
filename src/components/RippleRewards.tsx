import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { signInAccount } from "../account-api";
import { useWallet } from "../context";
import { connectX, useWalletX, useXFeature } from "../x-identity";
import { XLogo } from "./XConnect";
import { WalletRewards } from "./WalletRewards";
import { displayTokenAmount } from "../trade-quote";
import type { RippleSummary } from "../types";
import "../ripple.css";

export function RippleRewards({ address }: { address: string }) {
  const wallet = useWallet();
  const { profile, loaded } = useWalletX(address);
  const xFeature = useXFeature();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef<string | null>(wallet.address); current.current = wallet.address;
  useEffect(() => () => { current.current = null; }, []);
  async function link() {
    if (wallet.address !== address || busy) return;
    setBusy(true); setError("");
    try { await connectX(address, wallet.signMessage, () => current.current === address); }
    catch (e) { if (current.current === address) setError(e instanceof Error ? e.message : "Could not connect X."); }
    finally { if (current.current === address) setBusy(false); }
  }
  return <section className="workspace-panel portfolio-rewards-panel ripple-panel" aria-label="Ripple Rewards">
    <header><h2>Ripple Rewards</h2>{profile && <a href={`https://x.com/${encodeURIComponent(profile.username)}`} target="_blank" rel="noreferrer">@{profile.username}<ExternalLink size={13}/></a>}</header>
    {!xFeature.loaded || (xFeature.enabled && !loaded) ? <div className="workspace-loading">Loading X connection…</div> : !profile ? <div className="workspace-empty ripple-connect-empty">
      <XLogo/><h3>Connect X to your wallet</h3><p>Link your X account to see and claim your Ripple rewards.</p>
      <button className="primary" disabled={busy || !xFeature.enabled} onClick={() => void link()}>{busy ? <Loader2 size={16} className="spin"/> : <XLogo/>}Connect X</button>
      {xFeature.loaded && !xFeature.enabled && <small>X connection is currently unavailable.</small>}
      {error && <p role="alert" className="danger-note">{error}</p>}
    </div> : <RippleBalances key={address} address={address}/>}
  </section>;
}

function RippleBalances({ address }: { address: string }) {
  const wallet = useWallet();
  const current = useRef<string | null>(wallet.address); current.current = wallet.address;
  useEffect(() => () => { current.current = null; }, []);
  const [signing, setSigning] = useState(false);
  const [signInError, setSignInError] = useState("");
  async function signIn() {
    if (signing || current.current !== address) return;
    setSigning(true); setSignInError("");
    try { await signInAccount(address, wallet.signMessage, () => current.current === address); if (current.current === address) setRevision(value => value + 1); }
    catch (e) { if (current.current === address) setSignInError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { if (current.current === address) setSigning(false); }
  }
  const [data, setData] = useState<RippleSummary | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(5);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await api.rippleActivity(address, controller.signal);
        if (!Array.isArray(next.posts)) throw new Error("Post history is unavailable.");
        if (!controller.signal.aborted) { setData(next); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Post history could not load."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => { void load(); }, 30_000); }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [address, revision]);
  return <>
    {data?.signedIn === false && <div className="ripple-sign-in"><span>Sign in to AQUA to earn new Ripple rewards.</span><button className="soft-button" disabled={signing} onClick={() => void signIn()}>{signing ? <Loader2 size={14} className="spin"/> : null}Sign in</button></div>}
    {signInError && <p className="danger-note ripple-session-error" role="alert">{signInError}</p>}
    <WalletRewards kind="ripple" onClaimed={() => setRevision(value => value + 1)}/>
    <div className="ripple-posts"><h3>Post rewards</h3><p className="ripple-eligibility">Earn rewards from coins you hold in your linked wallet.</p>
      {error && <p className="danger-note" role="alert">{error} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
      {!data ? !error && <p className="ripple-empty">Loading post rewards…</p> : !data.posts.length ? <p className="ripple-empty">No rewarded posts yet.</p> : data.posts.slice(0, visible).map(post => <article key={`${post.launchId}:${post.id}`}>
        <div className="ripple-post-identity"><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">{post.isReply ? "Reply on X" : "Post on X"}<ExternalLink size={13}/></a><small><Link to={`/token/${post.launchId}`}>${post.symbol}</Link> · {new Date(post.createdAt).toLocaleDateString()}</small></div>
        <div className="ripple-post-amount"><b>{BigInt(post.amountLamports) > 0n ? `${displayTokenAmount(post.amountLamports, 9)} SOL` : "—"}</b><small>{post.reason ?? ({claimed:"Claimed",claimable:"Ready to claim",allocated:"Processing",ready:"Pending",measuring:"Measuring · 24h",excluded:"Not eligible"}[post.status])}</small></div>
      </article>)}
      {data && visible < data.posts.length && <button className="soft-button ripple-more" onClick={() => setVisible(value => value + 10)}>Show more posts</button>}
    </div>
  </>;
}
