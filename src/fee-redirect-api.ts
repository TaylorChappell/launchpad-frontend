import { API_URL } from './api';
export type RedirectKind = 'wallet'|'x'|'github';
export type RedirectRecipient = {kind:RedirectKind;subject:string;label:string;avatarUrl:string|null;profileUrl:string|null;wallet?:string|null};
export type RedirectSummary = {recipient:RedirectRecipient;recipientBps:number;holderBps:number;pending:Array<{mint:string;amountRaw:string}>;totals:Array<{mint:string;symbol:string;decimals:number;allocatedRaw:string;claimedRaw:string;claimableRaw:string}>};
export async function redirectRequest<T>(path:string,token='',body?:unknown):Promise<T>{
  const response=await fetch(`${API_URL}/api/fee-redirect${path}`,{method:body===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(20000),
    headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error??'Fee Redirect could not load. Try again.');
  return data;
}
export const recipientLabel=(r:RedirectRecipient)=>r.kind==='wallet'?r.subject.slice(0,6)+'…'+r.subject.slice(-5):r.label;
