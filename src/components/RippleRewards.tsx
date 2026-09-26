import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Radio, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useWallet } from "../context";
import { connectX, useWalletX, useXFeature } from "../x-identity";
import { XLogo } from "./XConnect";
import { WalletRewards } from "./WalletRewards";
import { displayTokenAmount } from "../trade-quote";
import type { RippleSummary } from "../types";
import "../ripple.css";

const count = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export function RippleRewards({ address }: { address: string }) {
  const wallet = useWallet();
  const { profile } = useWalletX(address);
  const xFeature = useXFeature();
  const [data, setData] = useState<RippleSummary | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(5);
  const [revision, setRevision] = useState(0);
  const current = useRef(wallet.address); current.current = wallet.address;
  useEffect(() => () => { current.current = null; }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try { const next = await api.rippleActivity(address, controller.signal); if (!controller.signal.aborted) { setData(next); setError(""); } }
      catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load Ripple activity."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => { void load(); }, 30_000); }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [address, revision]);
  async function link() {
    if (wallet.address !== address || busy) return;
    setBusy(true); setActionError("");
    try { await connectX(address, wallet.signMessage, () => current.current === address); }
    catch (e) { if (current.current === address) setActionError(e instanceof Error ? e.message : "Could not connect X."); }
    finally { setBusy(false); }
  }
  const status = error ? "Connection interrupted" : !data ? "Loading activity" : ({ tracking: "Discovering posts", catching_up: "Catching up", paused: "Discovery paused", unavailable: "Awaiting activation" }[data.status]);
  return <section className="ripple-panel" aria-label="Ripple Rewards">
    <header className="ripple-heading"><span className="ripple-mark"><Waves size={25}/></span><div><small>RIPPLE REWARDS</small><h2>Your posts. Your rewards.</h2></div></header>
    <p className="ripple-intro">Share an AQUA coin on X and earn SOL for each qualifying post or reply. We discover your posts automatically and measure their engagement. No submissions.</p>
    <div className="ripple-split"><div><strong>15<small>%</small></strong><b>From every reward mode</b><span>Of newly settled trading rewards</span></div><div><strong>10<small>%</small></strong><b>From Community Boost</b><span>Of the winning coin’s boost funding</span></div></div>
    <div className="ripple-status" role="status"><Radio size={15}/><span>{status}{data?.checkedAt && !error && <small>Last checked {new Date(data.checkedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>}</span></div>
    {(error || data?.reason || data?.status === "paused") && <p className="ripple-notice">{error || data?.reason || "Some coin scans are delayed."} New Ripple allocations wait for complete data; existing rewards remain claimable.</p>}
    <div className="ripple-connect"><div><b>{profile ? `Connected as @${profile.username}` : "Connect once. Post naturally."}</b><p>{profile ? "Include the coin’s contract address or AQUA market link. Replies under KOL posts count using their own engagement." : "Connect X before posting. This publicly links your X identity to your wallet so your rewards reach the right address."}</p></div>
      {!profile && <button className="primary" disabled={busy || !xFeature.enabled} onClick={() => void link()}>{busy ? <Loader2 size={16} className="spin"/> : <XLogo/>}Connect X</button>}
    </div>
    {actionError && <p role="alert" className="ripple-notice">{actionError}</p>}
    <div className="ripple-claims"><h3>Claim your Ripple rewards</h3><WalletRewards kind="ripple" onClaimed={() => setRevision(value => value + 1)}/></div>
    <div className="ripple-activity"><h3>Your discovered posts <small>Each tweet has its own reward allocation</small></h3>{!data?.posts.length ? <p className="ripple-empty">{!data ? "Loading your activity…" : "No matching posts yet. Share a coin’s contract address or market link to get started."}</p> : data.posts.slice(0,visible).map(post => <article key={`${post.launchId}:${post.id}`}><div className="ripple-post-identity"><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">{post.isReply ? "Reply on X" : "Post on X"}<ExternalLink size={13}/></a><Link to={`/token/${post.launchId}`}>${post.symbol}</Link><small>{new Date(post.createdAt).toLocaleDateString()} · {count.format(post.metrics.like_count??0)} likes · {count.format(post.metrics.impression_count??0)} views</small></div><div><b>{BigInt(post.amountLamports)>0n ? `${displayTokenAmount(post.amountLamports,9)} SOL` : post.status === "measuring" ? "Measuring · 24h" : `${count.format(post.score)} points`}</b><small>{post.reason ?? ({claimed:"Claimed",claimable:"Ready to claim",allocated:"Funding your reward",ready:"Awaiting daily settlement",measuring:"Engagement is growing",excluded:"Not eligible"}[post.status])}</small></div></article>)}</div>
    {data && visible < data.posts.length && <button className="soft-button ripple-more" onClick={() => setVisible(value => value+10)}>Show more posts</button>}
    <details className="ripple-rules"><summary>How Ripple Rewards work</summary><p>Each coin has its own Ripple pool, funded by 15% of new trading rewards after existing operating and campaign allocations, plus 10% of its Community Boost. The remainder continues to its existing reward mode or boost destinations. Direct creator top-ups and rewards already allocated are unchanged.</p><p>Connect X before posting. We measure matching original posts and replies after 24 hours, then distribute the available pool in daily rounds. Higher engagement earns a larger share. Every qualifying tweet receives an allocation; repeated content and pure reposts are excluded. A ticker alone is not enough to identify a coin.</p><p>Each distinct qualifying tweet starts with 10 points. Likes count 1, replies 2, reposts 3 and quotes 4 toward an engagement bonus. Scores grow with the square root of engagement, with a capped view bonus. Views alone do not increase the base score. Scores use X-reported metrics and cannot prove genuine engagement. If X is delayed, we use the first successful measurement after 24 hours.</p><p>No qualifying posts? The pool carries forward. Rewards from each day are combined by coin for claiming, with the usual minimum after transaction costs. Holding the coin is not required to earn Ripple rewards.</p></details>
  </section>;
}
