import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Eye, Heart, MessageCircle, Repeat2 } from "lucide-react";
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
      finally { if (!controller.signal.aborted) timer = setTimeout(() => { void load(); }, document.hidden ? 30_000 : 5_000); }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [address, revision]);
  return <>
    {data?.signedIn === false && <div className="ripple-sign-in"><span>Sign in to AQUA to earn new Ripple rewards.</span><button className="soft-button" disabled={signing} onClick={() => void signIn()}>{signing ? <Loader2 size={14} className="spin"/> : null}Sign in</button></div>}
    {signInError && <p className="danger-note ripple-session-error" role="alert">{signInError}</p>}
    <WalletRewards kind="ripple" onClaimed={() => setRevision(value => value + 1)}/>
    <div className="ripple-posts"><header><h3>Your posts</h3><span>{data?.service?.settlementMinutes===15 ? "15-minute rewards" : "Hourly rewards"}</span></header><p className="ripple-eligibility">Earn rewards from coins you hold in your linked wallet.</p>
      {data && <div className="ripple-live-status" aria-label="Ripple tracking status">
        <span className={`ripple-status-badge ${data.service?.mode??"polling"}`}><i aria-hidden="true"/>{!data.enabled ? "Tracking unavailable" : data.service?.mode==="live" ? "Live detection" : data.service?.mode==="paused" ? "Tracking paused" : data.service?.mode==="idle" ? "Ready to track" : "Scheduled detection"}</span>
        <span>Last checked <b>{data.checkedAt ? new Date(data.checkedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "Waiting for first check"}</b></span>
        {data.enabled && data.nextPayoutAt && <span>Next round <b>{checkTime(data.nextPayoutAt)}</b></span>}
      </div>}
      {data && (!data.enabled || data.service?.message || data.status==="paused" || data.status==="catching_up") && <p className="ripple-tracking-notice" role="status">{!data.enabled ? data.reason : data.service?.message || data.scanError || "Checking for your latest posts. Earned rewards remain available."}</p>}
      {error && <p className="danger-note" role="alert">{error} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
      {!data ? !error && <p className="ripple-empty">Loading your posts…</p> : !data.posts.length ? <p className="ripple-empty">No posts detected yet. Use the coin’s $ticker or contract address on X. Qualifying posts appear here even before they earn rewards.</p> : data.posts.slice(0, visible).map(post => <article key={`${post.launchId}:${post.id}`}>
        <div className="ripple-post-top"><div className="ripple-post-identity"><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">{post.isReply ? "Reply on X" : "Post on X"}<ExternalLink size={13}/></a><small><Link to={`/token/${post.launchId}`}>${post.symbol}</Link> · {new Date(post.createdAt).toLocaleDateString()}</small></div>
          <div className="ripple-post-amount"><b>{displayTokenAmount(post.amountLamports, 9)} SOL</b><small>Total earned</small></div>
        </div>
        {post.text && <p className="ripple-post-text">{post.text}</p>}
        <div className="ripple-post-metrics" aria-label="Post engagement">
          <span title="Views"><Eye size={14}/>{engagementCount(post.metrics.impression_count)}<span className="sr-only"> views</span></span>
          <span title="Likes"><Heart size={14}/>{engagementCount(post.metrics.like_count)}<span className="sr-only"> likes</span></span>
          <span title="Replies"><MessageCircle size={14}/>{engagementCount(post.metrics.reply_count)}<span className="sr-only"> replies</span></span>
          <span title="Reposts and quotes"><Repeat2 size={14}/>{engagementCount((post.metrics.retweet_count ?? 0) + (post.metrics.quote_count ?? 0))}<span className="sr-only"> reposts and quotes</span></span>
        </div>
        <footer className="ripple-post-progress"><span>{post.reason ?? (post.trackingStatus === "completed" ? "Checks complete" : post.nextCheckAt ? `Next check ${checkTime(post.nextCheckAt)}` : post.status === "ready" ? "Awaiting reward round" : "Tracking engagement")}{post.lastCheckedAt && <small>Last checked {new Date(post.lastCheckedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>}</span>
          {post.totalChecks !== undefined && <small>Check {post.checksCompleted ?? 0} of {post.totalChecks}</small>}
        </footer>
      </article>)}
      {data && visible < data.posts.length && <button className="soft-button ripple-more" onClick={() => setVisible(value => value + 10)}>Show more posts</button>}
    </div>
  </>;
}

const engagementCount = (value?: number) => value == null ? "—" : new Intl.NumberFormat(undefined, { notation:"compact", maximumFractionDigits:1 }).format(value);
function checkTime(timestamp: number) {
  if (timestamp <= Date.now()) return "soon";
  return new Date(timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
