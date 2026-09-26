import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "../api";
import type { AdminRippleResponse } from "../types";
import { rippleDollars } from "../ripple-display";
import { WalletIdentity } from "./WalletIdentity";

const count = (value?:number) => value == null ? "—" : new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(value);
export function AdminRipple({token,search,refreshKey}:{token:string;search:string;refreshKey:number}) {
  // Search changes remount the report, resetting pagination and stale rows together.
  return <RippleReport key={`${token}:${search}`} token={token} search={search} refreshKey={refreshKey}/>;
}
function RippleReport({token,search,refreshKey}:{token:string;search:string;refreshKey:number}) {
  const [data,setData]=useState<AdminRippleResponse|null>(null),[offset,setOffset]=useState(0);
  const [busy,setBusy]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function load(){
      setBusy(true);
      try{const next=await api.adminRipple(token,search,offset,controller.signal);if(!controller.signal.aborted){setData(next);setError("");}}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Ripple records could not load.");}
      finally{if(!controller.signal.aborted){setBusy(false);timer=setTimeout(()=>void load(),30_000);}}
    }
    const start=setTimeout(()=>void load(),search?250:0);
    return()=>{controller.abort();clearTimeout(start);clearTimeout(timer);};
  },[token,search,offset,revision,refreshKey]);
  return <div className="ops-ripple">
    <div className="ops-metrics ops-ripple-totals">
      <article className="ops-metric"><span>Tracked posts</span><strong>{data?.totalPosts.toLocaleString()??"—"}</strong><small>{search?"Matching your search":"Across all AQUA coins"}</small></article>
      <article className="ops-metric"><span>Total earned</span><strong>{rippleDollars(data?.earnedUsdCents)}</strong><small>USD value at allocation</small></article>
      <article className="ops-metric"><span>Claimed</span><strong>{rippleDollars(data?.claimedUsdCents)}</strong><small>Confirmed reward claims</small></article>
    </div>
    <section className="ops-panel" aria-label="Ripple posts">
      <header className="ops-ripple-heading"><div><h2>All Ripple posts</h2><p>Highest earnings first · refreshes automatically</p></div><button disabled={busy} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15} className={busy?"spin":""}/>Refresh posts</button></header>
      {error&&<div className="ops-error" role="alert">{error} <button onClick={()=>setRevision(n=>n+1)}>Try again</button></div>}
      {!!data?.unpricedPosts&&<p className="ops-ripple-note">{data.unpricedPosts} post(s) have incomplete historical dollar values and are excluded from dollar totals.</p>}
      {!data? <div className="ops-empty">{error?"Posts unavailable.":"Loading Ripple posts…"}</div> : <>
        <div className="ops-table-scroll" role="region" aria-label="Ripple post records" tabIndex={0}><table className="ops-ripple-table"><thead><tr><th>Post</th><th>Coin / wallet</th><th>Engagement</th><th>Earned</th><th>Claimed</th><th>Status</th></tr></thead><tbody>
          {data.posts.map(post=><tr key={`${post.launchId}:${post.id}`}>
            <td><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">{post.username?`@${post.username}`:"View post"}<ExternalLink size={12}/></a><p>{post.text||"Post text unavailable"}</p><small>{new Date(post.createdAt).toLocaleString()}</small></td>
            <td><Link to={`/token/${post.launchId}`}><b>${post.symbol}</b></Link><small>{post.wallet?<WalletIdentity wallet={post.wallet}/>:"No linked wallet"}</small></td>
            <td>{count(post.metrics.impression_count)} views<small>{count(post.metrics.like_count)} likes · {count(post.metrics.reply_count)} replies</small><small>{count((post.metrics.retweet_count??0)+(post.metrics.quote_count??0))} reposts / quotes</small></td>
            <td><b>{rippleDollars(post.earnedUsdCents,post.amountLamports)}</b></td><td>{rippleDollars(post.claimedUsdCents,post.amountLamports)}</td>
            <td><span className={`ops-status is-${post.status}`}>{post.status==="tracking"?"Tracking":post.status==="excluded"?"Excluded":"Complete"}</span>{post.reason&&<small>{post.reason}</small>}</td>
          </tr>)}
        </tbody></table>{!data.posts.length&&<div className="ops-empty">No Ripple posts match your search.</div>}</div>
        <footer className="ops-pager"><span>{data.posts.length?`${data.offset+1}–${data.offset+data.posts.length} of ${data.totalPosts}`:"0 results"}</span><div><button aria-label="Previous Ripple posts" disabled={busy||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-25))}><ChevronLeft size={16}/></button><button aria-label="Next Ripple posts" disabled={busy||!data.hasMore} onClick={()=>setOffset(n=>n+25)}><ChevronRight size={16}/></button></div></footer>
      </>}
    </section>
  </div>;
}
