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
        <p className="ops-ripple-explain">{data.scoringVersion>=4?"Views set a dollar target. Verified engagement and followers add limited bonuses. Each check earns only target growth; unpaid amounts wait for funding. The small-post boost is shared across the author's posts, with no cap on normal earnings.":"Historical checks used engagement scores and pool sharing. Existing allocations are preserved."}</p>
        {data.rewardPolicy&&<><dl className="ops-ripple-detail-summary"><div><dt>Highest eligible target</dt><dd>{rippleDollars(String(data.rewardPolicy.targetCents),'1')}</dd></div><div><dt>Verified outside accounts</dt><dd>{data.rewardPolicy.verified.uniqueAccounts}</dd></div><div><dt>Author followers</dt><dd>{data.rewardPolicy.followerCount?.toLocaleString()??'Unavailable'}</dd></div><div><dt>Engagement bonus</dt><dd>{data.rewardPolicy.engagementBps/100}%</dd></div><div><dt>Follower bonus</dt><dd>{data.rewardPolicy.followerBps/100}%</dd></div></dl>
          {data.rewardPolicy.reason&&<p>{data.rewardPolicy.reason}</p>}
          {data.rewardPolicy.flags.map(flag=><p className="ops-ripple-audit" key={flag}>{flag}. Engagement bonus withheld.</p>)}
          {(data.rewardPolicy.evidenceLimited||data.rewardPolicy.evidenceUnavailable.length>0)&&<p>Only returned, verified identities count. {data.rewardPolicy.evidenceLimited?'X returned a limited sample. ':''}{data.rewardPolicy.evidenceUnavailable.length>0?`Unavailable: ${data.rewardPolicy.evidenceUnavailable.join(', ')}.`:''}</p>}
        </>}
        {!!data.checks.some(c=>c.auditCandidate)&&<p className="ops-ripple-audit">Historical $0 checks need review. They have not been reopened or paid again.</p>}
        {!data.checks.length&&<p className="ops-empty">No engagement checks were recorded for this post.</p>}
        <ol className="ops-ripple-checks">{data.checks.map(check=><li key={check.number}>
          <div className="ops-ripple-check-heading"><b>Check {check.number} <small>{rippleTime(check.measuredAt)}</small></b><span className="ops-status">{rippleCheckLabel(check)}</span><strong>{check.amountLamports==='0'?"$0.00":rippleDollars(check.earnedUsdCents,check.amountLamports)}</strong></div>
          <dl><div><dt>New engagement</dt><dd>{metrics(check.delta)}</dd></div><div><dt>Total observed</dt><dd>{metrics(check.metrics)}</dd></div><div><dt>{check.targetUsdCents!=null?"New target value":"Eligible points"}</dt><dd>{check.targetUsdCents!=null?rippleDollars(String(check.targetUsdCents),'1'):check.effectiveScore.toLocaleString()}</dd></div><div><dt>Catch-up deadline</dt><dd>{rippleTime(check.expiresAt)}</dd></div><div><dt>Processed</dt><dd>{rippleTime(check.processedAt)}</dd></div><div><dt>Allocated</dt><dd>{rippleSol(check.amountLamports)}</dd></div></dl>
          {check.reason&&<p>{check.reason}</p>}
          {!!check.allocations?.length&&<details><summary>Allocation records ({check.allocations.length})</summary>{check.allocations.map(allocation=><dl key={allocation.epochId}><div><dt>Round</dt><dd>{rippleTime(allocation.roundEndsAt)}</dd></div><div><dt>Amount</dt><dd>{rippleDollars(allocation.earnedUsdCents,allocation.amountLamports)} · {rippleSol(allocation.amountLamports)}</dd></div><div><dt>State</dt><dd>{allocation.claimedSignature?'Claimed':allocation.epochStatus==='claimable'?'Claimable':'Awaiting settlement'}</dd></div>{allocation.claimedSignature&&<div><dt>Claim</dt><dd><a href={`https://solscan.io/tx/${encodeURIComponent(allocation.claimedSignature)}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12}/></a></dd></div>}</dl>)}</details>}
          {!check.allocations?.length&&check.epochId&&<details><summary>Allocation record</summary><dl><div><dt>Epoch</dt><dd>{check.epochId}</dd></div><div><dt>Round ended</dt><dd>{rippleTime(check.roundEndsAt)}</dd></div><div><dt>State</dt><dd>{check.epochStatus??'Unknown'}</dd></div></dl></details>}
          {!check.allocations?.length&&check.claimedSignature&&<a href={`https://solscan.io/tx/${encodeURIComponent(check.claimedSignature)}`} target="_blank" rel="noreferrer">View claim transaction <ExternalLink size={12}/></a>}
        </li>)}</ol>
      </>}
    </div>
  </section></div>,document.body);
}
