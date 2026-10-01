import { RefreshButton } from "./RefreshButton";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "../api";
import type { AdminRippleResponse, AdminRippleSort } from "../types";
import { rippleDollars } from "../ripple-display";
import { WalletIdentity } from "./WalletIdentity";
import { Select } from "./Select";
import { AdminRippleDetails } from "./AdminRippleDetails";
import { AdminRippleFunding } from "./AdminRippleFunding";
import { rippleStatusLabels } from "../ripple-admin";

const count = (value?:number) => value == null ? "—" : new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(value);
export function AdminRipple({token,search,refreshKey}:{token:string;search:string;refreshKey:number}) {
  const [sort,setSort]=useState<AdminRippleSort>("highest");
  // Search changes remount the report, resetting pagination and stale rows together.
  return <RippleReport key={`${token}:${search}`} token={token} search={search} refreshKey={refreshKey} sort={sort} setSort={setSort}/>;
}
type SortProps = {sort:AdminRippleSort;setSort:(value:AdminRippleSort)=>void};
function RippleReport({token,search,refreshKey,sort,setSort}:{token:string;search:string;refreshKey:number}&SortProps) {
  const [status,setStatus]=useState("all");
  return <FilteredReport key={`${status}:${sort}`} token={token} search={search} refreshKey={refreshKey} status={status} setStatus={setStatus} sort={sort} setSort={setSort}/>;
}
function FilteredReport({token,search,refreshKey,status,setStatus,sort,setSort}:{token:string;search:string;refreshKey:number;status:string;setStatus:(value:string)=>void}&SortProps) {
  const [data,setData]=useState<AdminRippleResponse|null>(null),[offset,setOffset]=useState(0);
  const [selected,setSelected]=useState<{launchId:string;postId:string}|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function load(){
      setBusy(true);
      try{const next=await api.adminRipple(token,search,offset,controller.signal,status,sort);if(!controller.signal.aborted){setData(next);setError("");}}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Ripple records could not load.");}
      finally{if(!controller.signal.aborted){setBusy(false);timer=setTimeout(()=>void load(),30_000);}}
    }
    const start=setTimeout(()=>void load(),search?250:0);
    return()=>{controller.abort();clearTimeout(start);clearTimeout(timer);};
  },[token,search,offset,revision,refreshKey,status,sort]);
  const service=data?.service,budget=service?.budget,usage=budget?.requestCounts??{};
  return <div className="ops-ripple">
    <div className="ops-metrics ops-ripple-totals">
      <article className="ops-metric"><span>Tracked posts</span><strong>{data?.totalPosts.toLocaleString()??"—"}</strong><small>{search?"Matching your search":"Across all AQUA coins"}</small></article>
      <article className="ops-metric"><span>Total earned</span><strong>{rippleDollars(data?.earnedUsdCents)}</strong><small>USD value at allocation</small></article>
      <article className="ops-metric"><span>Claimed</span><strong>{rippleDollars(data?.claimedUsdCents)}</strong><small>Confirmed reward claims</small></article>
    </div>
    <div className="ops-ripple-controls"><label>Status<Select aria-label="Ripple status" value={status} onChange={e=>setStatus(e.target.value)}>{['all','tracking','awaiting_funding','awaiting_settlement','claimable','claimed','expired','excluded','audit'].map(value=><option key={value} value={value}>{rippleStatusLabels[value]}</option>)}</Select></label><label>Sort<Select aria-label="Sort Ripple posts" value={sort} onChange={e=>setSort(e.target.value as AdminRippleSort)}><option value="highest">Highest earnings</option><option value="recent">Recent</option></Select></label><span>{data?.pendingChecks??0} pending checks</span><button onClick={()=>setStatus('audit')}>{data?.auditChecks??0} historical $0 checks to review</button></div>
    {data?.overview&&<AdminRippleFunding data={data.overview}/>}
    {service&&<section className="ops-panel ops-ripple-health" aria-label="Ripple detection health">
      <header><h2>Detection</h2><span className={`ops-status is-${service.mode==='live'?'tracking':service.mode==='paused'?'excluded':'completed'}`}>{service.mode==='live'?'Live':service.mode==='polling'?'Scheduled':service.mode==='paused'?'Paused':service.mode==='idle'?'Idle':'Unavailable'}</span></header>
      {service.message&&<p>{service.message}</p>}
      {budget&&<><div className="ops-ripple-usage"><span>X requests today <b>{budget.requests.toLocaleString()}{budget.requestLimit>0?` / ${budget.requestLimit.toLocaleString()}`:""}</b></span><span>Distinct posts read today <b>{budget.postReads.toLocaleString()}{budget.postReadLimit>0?` / ${budget.postReadLimit.toLocaleString()}`:""}</b></span></div>
        <p>Search {usage.search??0} · Engagement {usage.lookup??0} · Stream {(usage.stream_rules??0)+(usage.stream_connect??0)}{budget.requests>Object.values(usage).reduce((sum,n)=>sum+n,0)?' · Earlier requests not categorized':''}</p>
        <small>{budget.requestLimit>0||budget.postReadLimit>0?"Usage resets":"No AQUA daily cap · Usage resets"} {new Date(budget.resetsAt).toLocaleString()}</small></>}
      {!!service.providerBackoffs?.length&&<ul>{service.providerBackoffs.map(item=><li key={item.scope}>{item.message} Retry {new Date(item.retryAt).toLocaleTimeString()}.</li>)}</ul>}
    </section>}
    <section className="ops-panel" aria-label="Ripple posts">
      <header className="ops-ripple-heading"><div><h2>All Ripple posts</h2><p>{sort==="recent"?"Newest posts first":"Highest earnings first"} · refreshes automatically</p></div><RefreshButton disabled={busy} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15} className={busy?"spin":""}/>Refresh posts</RefreshButton></header>
      {error&&<div className="ops-error" role="alert">{error} <button onClick={()=>setRevision(n=>n+1)}>Try again</button></div>}
      {!!data?.unpricedPosts&&<p className="ops-ripple-note">{data.unpricedPosts} post(s) have incomplete historical dollar values and are excluded from dollar totals.</p>}
      {!data? <div className="ops-empty">{error?"Posts unavailable.":"Loading Ripple posts…"}</div> : <>
        <div className="ops-table-scroll" role="region" aria-label="Ripple post records" tabIndex={0}><table className="ops-ripple-table"><thead><tr><th>Post</th><th>Coin / wallet</th><th>Engagement</th><th>Earned</th><th>Claimed</th><th>Status</th></tr></thead><tbody>
          {data.posts.map(post=><tr key={`${post.launchId}:${post.id}`}>
            <td><a href={`https://x.com/i/status/${post.id}`} target="_blank" rel="noreferrer">{post.username?`@${post.username}`:"View post"}<ExternalLink size={12}/></a><p>{post.text||"Post text unavailable"}</p><small>{new Date(post.createdAt).toLocaleString()}</small></td>
            <td><Link to={`/token/${post.launchId}`}><b>${post.symbol}</b></Link><small>{post.wallet?<WalletIdentity wallet={post.wallet}/>:"No linked wallet"}</small></td>
            <td>{count(post.metrics.impression_count)} views<small>{count(post.metrics.like_count)} likes · {count(post.metrics.reply_count)} replies</small><small>{count((post.metrics.retweet_count??0)+(post.metrics.quote_count??0))} reposts / quotes</small></td>
            <td><b>{rippleDollars(post.earnedUsdCents,post.amountLamports)}</b></td><td>{rippleDollars(post.claimedUsdCents,post.amountLamports)}</td>
            <td><span className={`ops-status is-${post.rewardStatus??post.status}`}>{rippleStatusLabels[post.rewardStatus??post.status]??"Tracking ended"}</span>{post.reason&&<small>{post.reason}</small>}{post.checksCompleted!=null&&<small>{post.checksCompleted} / {post.totalChecks} checks · {post.status==='tracking'?'tracking':'tracking ended'}</small>}{!!post.auditChecks&&<small>{post.auditChecks} historical $0 checks</small>}<button className="ops-ripple-inspect" onClick={()=>setSelected({launchId:post.launchId,postId:post.id})} aria-label={`Inspect post ${post.id}`}>Inspect</button></td>
          </tr>)}
        </tbody></table>{!data.posts.length&&<div className="ops-empty">No Ripple posts match your search.</div>}</div>
        <footer className="ops-pager"><span>{data.posts.length?`${data.offset+1}–${data.offset+data.posts.length} of ${data.totalPosts}`:"0 results"}</span><div><button aria-label="Previous Ripple posts" disabled={busy||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-25))}><ChevronLeft size={16}/></button><button aria-label="Next Ripple posts" disabled={busy||!data.hasMore} onClick={()=>setOffset(n=>n+25)}><ChevronRight size={16}/></button></div></footer>
      </>}
    </section>
    {selected&&<AdminRippleDetails key={`${selected.launchId}:${selected.postId}`} token={token} {...selected} onClose={()=>setSelected(null)}/>}
  </div>;
}
