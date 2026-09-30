import type { AdminRipplePostDetails } from "./types";
export const rippleStatusLabels:Record<string,string>={all:"All statuses",tracking:"Tracking",awaiting_funding:"Awaiting funding",awaiting_budget:"Awaiting funded budget",awaiting_settlement:"Awaiting settlement",claimable:"Claimable",claimed:"Claimed",expired:"Catch-up expired",excluded:"Excluded",audit:"Review historical $0",completed:"Tracking ended",allocated:"Allocated",no_engagement:"No new engagement",no_reward_growth:"No increase in reward target",policy_changed:"Old policy ended"};
export const rippleTime=(value?:number|null)=>value?new Date(value).toLocaleString():"—";
export const rippleSol=(raw?:string|null)=>raw==null?"—":`${(Number(raw)/1e9).toLocaleString(undefined,{maximumFractionDigits:9})} SOL`;
export function rippleCheckLabel(check:AdminRipplePostDetails['checks'][number],now=Date.now()) {
  if(check.auditCandidate)return "Historical $0 · review";
  if(check.reason)return "Excluded";
  if(check.targetUsdCents!=null&&check.paidMicroUsd!=null&&BigInt(check.paidMicroUsd)>0n&&BigInt(check.paidMicroUsd)<BigInt(check.targetUsdCents)*10000n&&!check.processedAt)return "Partially funded";
  if(check.claimedSignature)return "Claimed";
  if(BigInt(check.amountLamports)>0n)return check.epochStatus==='claimable'?"Claimable":"Awaiting settlement";
  if(check.outcome)return rippleStatusLabels[check.outcome]??check.outcome;
  if(check.effectiveScore===0)return check.targetUsdCents!=null?"No increase in reward target":"No new engagement";
  if(check.expiresAt<=now)return "Catch-up expired";
  return rippleStatusLabels[check.pendingReason??'awaiting_settlement']??"Awaiting settlement";
}
