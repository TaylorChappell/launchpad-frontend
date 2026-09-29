import { API_URL } from './api';
import { createAnalyticsCache } from './analytics-cache';
export type AutoRewardStatus={wallet:string;enabled:boolean;enabledAt:number|null;nextPayoutAt:number;running:boolean};
export type AutoRewardRound={scheduled_at:number;status:string;paid_wallets:number;payouts:number;paid_usd_cents:string;completed_at:number|null};
export type AutoRewardPayout={id:string;wallet:string;launch_id:string;name:string;status:string;amount_raw:string|null;received_raw:string|null;stock_symbol:string|null;stock_decimals:number|null;usd_cents:number|null;signature:string|null;paid_at:number|null;reason?:string;attempts?:number};
export type AutoRewardActivity={running:boolean;nextPayoutAt:number;rounds:AutoRewardRound[];selectedRound:number|null;payouts:AutoRewardPayout[];hasMore:boolean};
const activitySnapshots=createAnalyticsCache<AutoRewardActivity>(`aqua:analytics-payouts:v1:${API_URL}`,(value):value is AutoRewardActivity=>{
 const data=value as AutoRewardActivity|null;
 return Boolean(data&&typeof data.running==='boolean'&&Array.isArray(data.rounds)&&Array.isArray(data.payouts)&&typeof data.hasMore==='boolean');
});
const activityKey=(round:number|null,offset:number,range:string)=>`${range}:${round??'latest'}:${offset}`;
async function request<T>(path:string,token='',body?:unknown):Promise<T>{
 const response=await fetch(API_URL+'/api'+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error??'Auto rewards could not be updated.');return data;
}
export const autoRewardsApi={
 config:()=>request<{siteKey:string;walletlessEnabled:boolean;running:boolean}>('/auto-rewards/config'),
 status:(wallet:string)=>request<AutoRewardStatus>('/auto-rewards/wallets/'+encodeURIComponent(wallet)),
 set:(token:string,enabled:boolean)=>request<AutoRewardStatus>('/auto-rewards/settings',token,{enabled}),
 walletless:(wallet:string,captcha:string)=>request<AutoRewardStatus>('/auto-rewards/walletless','',{wallet,captcha}),
 peekActivity:(round:number|null,offset:number,range='all')=>activitySnapshots.read(activityKey(round,offset,range)),
 activity:(round:number|null,offset:number,token='',range='all',refresh=false)=>{
  const read=()=>request<AutoRewardActivity>((token?'/admin':'')+'/auto-rewards/activity?'+new URLSearchParams({offset:String(offset),range,...(round===null?{}:{round:String(round)})}),token);
  // Admin diagnostics must never enter the public session cache.
  return token?read():activitySnapshots.load(activityKey(round,offset,range),read,refresh);
 },
 wallets:(token:string,wallet='',offset=0)=>request<{wallets:Array<{wallet:string;enabled:boolean;enabled_at:number;source:string}>;hasMore:boolean}>('/admin/auto-rewards/wallets?'+new URLSearchParams({offset:String(offset),...(wallet?{wallet}:{})}),token),
 adminSet:(token:string,wallet:string,enabled:boolean)=>request<AutoRewardStatus>('/admin/auto-rewards/wallets',token,{wallet,enabled}),
};
