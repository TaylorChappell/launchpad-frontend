import { Select } from "./Select";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Eye, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { Link } from "react-router-dom";
import { signInAccount } from "../account-api";
import { useWallet } from "../context";
import { connectX, useWalletX, useXFeature } from "../x-identity";
import { XLogo } from "./XConnect";
import { WalletRewards } from "./WalletRewards";
import { rippleDollars } from "../ripple-display";
import type { RippleSummary } from "../types";
import "../ripple.css";

type RippleProps = { address: string; data: RippleSummary | null; error: string; onRefresh: () => void };

export function RippleRewards({ address, data, error: activityError, onRefresh }: RippleProps) {
  const wallet = useWallet();
  const { profile, loaded } = useWalletX(address);
  const xFeature = useXFeature();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef<string | null>(wallet.address); current.current = wallet.address;
  useEffect(() => {
    // StrictMode replays effect setup: restore the active wallet after cleanup.
    current.current = wallet.address;
    return () => { current.current = null; };
  }, [wallet.address]);
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
      <XLogo/><h3>Connect X to your wallet</h3><p>Link your X account to see and claim your Ripple rewards. Read-only access lets AQUA verify engagement on your posts.</p>
      <button className="primary" disabled={busy || !xFeature.enabled} onClick={() => void link()}>{busy ? <Loader2 size={16} className="spin"/> : <XLogo/>}Connect X</button>
      {xFeature.loaded && !xFeature.enabled && <small>X connection is currently unavailable.</small>}
      {error && <p role="alert" className="danger-note">{error}</p>}
    </div> : <>
      {profile.rippleLikesAuthorized===false&&<div className="ripple-sign-in" role="status"><span>Reconnect X once to let likes count toward your Ripple rewards. AQUA requests read-only access.</span><button className="soft-button" disabled={busy||wallet.address!==address} onClick={()=>void link()}>{busy?<Loader2 size={14} className="spin"/>:null}Reconnect X</button></div>}
      {error&&<p role="alert" className="danger-note">{error}</p>}
      <RippleBalances key={address} address={address} data={data} error={activityError} onRefresh={onRefresh}/>
    </>}
  </section>;
}

function RippleBalances({ address, data, error, onRefresh }: RippleProps) {
  const wallet = useWallet();
  const current = useRef<string | null>(wallet.address); current.current = wallet.address;
  useEffect(() => {
    // StrictMode replays effect setup: restore the active wallet after cleanup.
    current.current = wallet.address;
    return () => { current.current = null; };
  }, [wallet.address]);
  const [signing, setSigning] = useState(false);
  const [signInError, setSignInError] = useState("");
  async function signIn() {
    if (signing || current.current !== address) return;
    setSigning(true); setSignInError("");
    try { await signInAccount(address, wallet.signMessage, () => current.current === address); if (current.current === address) onRefresh(); }
    catch (e) { if (current.current === address) setSignInError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { if (current.current === address) setSigning(false); }
  }
  const [visible, setVisible] = useState(5);
  const [order,setOrder]=useState<"earned"|"recent">("earned");
  const delayed = data?.service?.mode === "paused" || data?.service?.mode === "unavailable" || data?.status === "paused";
  const posts = [...(data?.posts ?? [])].sort((a, b) => {
    if(order==="recent")return b.createdAt-a.createdAt||b.id.localeCompare(a.id);
    const leftUsd = a.earnedUsdCents == null ? null : BigInt(a.earnedUsdCents);
    const rightUsd = b.earnedUsdCents == null ? null : BigInt(b.earnedUsdCents);
    if (leftUsd !== null && rightUsd === null) return -1;
    if (leftUsd === null && rightUsd !== null) return 1;
    if (leftUsd !== null && rightUsd !== null && leftUsd !== rightUsd) return leftUsd > rightUsd ? -1 : 1;
    const left = BigInt(a.amountLamports), right = BigInt(b.amountLamports);
    return left === right ? b.createdAt - a.createdAt || b.id.localeCompare(a.id) : left > right ? -1 : 1;
  });
  return <>
    {data?.signedIn === false && <div className="ripple-sign-in"><span>Sign in to AQUA to earn new Ripple rewards.</span><button className="soft-button" disabled={signing} onClick={() => void signIn()}>{signing ? <Loader2 size={14} className="spin"/> : null}Sign in</button></div>}
    {signInError && <p className="danger-note ripple-session-error" role="alert">{signInError}</p>}
    <WalletRewards kind="ripple" compact onClaimed={onRefresh}/>
    <div className="ripple-feed-tools"><details className="ripple-help"><summary>Missing a post?</summary><div>
      <p>Posts belong to the X account linked to this wallet. Keep your AQUA sign-in active and hold the coin before posting and when rewards are allocated.</p>
      <ul><li>Use the coin’s contract address, AQUA market link or explicit $ticker. Shared tickers need the address or market link.</li><li>{data?.rewardPolicyVersion===4?"Posts need at least 100 views and verified engagement from two other established accounts. Views determine the base reward; verified likes, replies and reposts count once per account, with a modest follower bonus.":"Views and new engagement affect rewards; a detected post is not a guaranteed payout."}</li>{data?.rewardPolicyVersion===4&&<li>The small-post boost is shared across your daily posts. Normal earnings have no daily or per-post cap and depend on available funding.</li>}<li>Previously counted engagement is not paid again. Unused rewards carry forward.</li></ul>
      <p>{data?.signedIn===false?"Your AQUA sign-in needs renewing using the button above.":data?.signedIn?"Your AQUA session is active.":"Sign-in status is unavailable. Refresh to check."}</p>
      {data?.reason&&<p>{data.reason}</p>}
      {data?.posts.filter(post=>post.reason||post.rewardPolicy?.reason).map(post=><p key={post.launchId+post.id}><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">${post.symbol} post</a>: {post.reason??post.rewardPolicy?.reason}</p>)}
      <button className="soft-button" onClick={onRefresh}>Refresh my posts</button>
    </div></details><label>Sort posts<Select aria-label="Sort posts" value={order} onChange={e=>{setOrder(e.target.value as "earned"|"recent");setVisible(5);}}><option value="earned">Highest earned</option><option value="recent">Most recent</option></Select></label></div>
    <div className="ripple-posts">
      {delayed && <p className="ripple-service-notice" role="status">Post detection is temporarily delayed. Your saved posts and rewards are still here.</p>}
      {error && <p className="danger-note" role="alert">{error} <button className="text-button" onClick={onRefresh}>Try again</button></p>}
      {!data ? !error && <p className="ripple-empty">Loading your posts…</p> : !data.posts.length ? <p className="ripple-empty">{delayed ? "Your detected posts will appear here." : "No posts yet. Hold a coin, stay signed in and include its $ticker or contract address on X."}</p> : posts.slice(0, visible).map(post => <article key={`${post.launchId}:${post.id}`}>
        <div className="ripple-post-top"><div className="ripple-post-identity"><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">{post.isReply ? "Reply on X" : "Post on X"}<ExternalLink size={13}/></a><small><Link to={`/token/${post.launchId}`}>${post.symbol}</Link> · {new Date(post.createdAt).toLocaleDateString()}</small></div>
          <div className="ripple-post-amount"><b>{rippleDollars(post.earnedUsdCents,post.amountLamports)}</b><small title="USD value when rewards were allocated">Total earned</small></div>
        </div>
        {post.text && <p className="ripple-post-text">{post.text}</p>}
        <div className="ripple-post-metrics" aria-label="Post engagement">
          <span title="Views"><Eye size={14}/>{engagementCount(post.metrics.impression_count)}<span className="sr-only"> views</span></span>
          <span title="Likes"><Heart size={14}/>{engagementCount(post.metrics.like_count)}<span className="sr-only"> likes</span></span>
          <span title="Replies"><MessageCircle size={14}/>{engagementCount(post.metrics.reply_count)}<span className="sr-only"> replies</span></span>
          <span title="Reposts and quotes"><Repeat2 size={14}/>{engagementCount((post.metrics.retweet_count ?? 0) + (post.metrics.quote_count ?? 0))}<span className="sr-only"> reposts and quotes</span></span>
        </div>
      </article>)}
      {data && visible < data.posts.length && <button className="soft-button ripple-more" onClick={() => setVisible(value => value + 10)}>Show more posts</button>}
    </div>
  </>;
}

const engagementCount = (value?: number) => value == null ? "—" : new Intl.NumberFormat(undefined, { notation:"compact", maximumFractionDigits:1 }).format(value);
