import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { api } from "../api";
import type { AdminRipplePostDetails } from "../types";
import { rippleDollars } from "../ripple-display";
import { rippleCheckLabel, rippleSol, rippleTime } from "../ripple-admin";
import { useDialog } from "./useDialog";

const metrics=(values:Record<string,number>)=>`${values.like_count??0} likes · ${values.reply_count??0} replies · ${values.retweet_count??0} reposts · ${values.quote_count??0} quotes · ${values.impression_count??0} views`;
export function AdminRippleDetails({token,launchId,postId,onClose}:{token:string;launchId:string;postId:string;onClose:()=>void}){
  const ref=useDialog<HTMLElement>(true,onClose),[data,setData]=useState<AdminRipplePostDetails|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{const controller=new AbortController();setError("");
    void api.adminRipplePost(token,launchId,postId,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Could not load checks.");});
    return()=>controller.abort();
  },[token,launchId,postId,revision]);
  return createPortal(<div className="wallet-overlay ops-ripple-overlay" onMouseDown={onClose}><section ref={ref} className="ops-ripple-detail" role="dialog" aria-modal="true" aria-labelledby="ripple-detail-title" onMouseDown={e=>e.stopPropagation()}>
    <header><div><h2 id="ripple-detail-title">Post reward history</h2><a href={`https://x.com/i/status/${postId}`} target="_blank" rel="noreferrer">View on X <ExternalLink size={12}/></a></div><button type="button" aria-label="Close post history" onClick={onClose}><X size={20}/></button></header>
    <div className="ops-ripple-detail-body">
      {error&&<p role="alert" className="ops-error">{error} <button onClick={()=>setRevision(n=>n+1)}>Retry</button></p>}
      {!data&&!error&&<p>Loading checks…</p>}
      {data&&<>
        <div className="ops-ripple-detail-summary"><span>Tracking<b>{data.excludedReason??(data.nextCheckAt?'Active':data.trackingEndReason??'Ended')}</b></span><span>Settlement window<b>{data.catchupHours} hours per check</b></span><span>Scoring<b>Version {data.scoringVersion}</b></span></div>
        <p className="ops-ripple-explain">Each check scores new engagement only. Other posts from the same wallet receive diminishing weight within a round. Recorded points are not a guaranteed dollar amount.</p>
        {!!data.checks.some(c=>c.auditCandidate)&&<p className="ops-ripple-audit">Historical $0 checks need review. They have not been reopened or paid again.</p>}
        {!data.checks.length&&<p className="ops-empty">No engagement checks were recorded for this post.</p>}
        <ol className="ops-ripple-checks">{data.checks.map(check=><li key={check.number}>
          <div className="ops-ripple-check-heading"><b>Check {check.number} <small>{rippleTime(check.measuredAt)}</small></b><span className="ops-status">{rippleCheckLabel(check)}</span><strong>{check.amountLamports==='0'?"$0.00":rippleDollars(check.earnedUsdCents,check.amountLamports)}</strong></div>
          <dl><div><dt>New engagement</dt><dd>{metrics(check.delta)}</dd></div><div><dt>Total observed</dt><dd>{metrics(check.metrics)}</dd></div><div><dt>Eligible points</dt><dd>{check.effectiveScore.toLocaleString()}</dd></div><div><dt>Catch-up deadline</dt><dd>{rippleTime(check.expiresAt)}</dd></div><div><dt>Processed</dt><dd>{rippleTime(check.processedAt)}</dd></div><div><dt>Allocated</dt><dd>{rippleSol(check.amountLamports)}</dd></div></dl>
          {check.reason&&<p>{check.reason}</p>}
          {check.epochId&&<details><summary>Allocation record</summary><dl><div><dt>Epoch</dt><dd>{check.epochId}</dd></div><div><dt>Round ended</dt><dd>{rippleTime(check.roundEndsAt)}</dd></div><div><dt>State</dt><dd>{check.epochStatus??'Unknown'}</dd></div></dl></details>}
          {check.claimedSignature&&<a href={`https://solscan.io/tx/${encodeURIComponent(check.claimedSignature)}`} target="_blank" rel="noreferrer">View claim transaction <ExternalLink size={12}/></a>}
        </li>)}</ol>
      </>}
    </div>
  </section></div>,document.body);
}
