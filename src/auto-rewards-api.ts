import { API_URL } from './api';
export type AutoRewardStatus={wallet:string;enabled:boolean;enabledAt:number|null;nextPayoutAt:number;running:boolean};
export type AutoRewardRound={scheduled_at:number;status:string;paid_wallets:number;payouts:number;paid_usd_cents:string;completed_at:number|null};
export type AutoRewardPayout={id:string;wallet:string;launch_id:string;name:string;status:string;amount_raw:string|null;received_raw:string|null;stock_symbol:string|null;stock_decimals:number|null;usd_cents:number|null;signature:string|null;paid_at:number|null;reason?:string;attempts?:number};
export type AutoRewardActivity={running:boolean;nextPayoutAt:number;rounds:AutoRewardRound[];selectedRound:number|null;payouts:AutoRewardPayout[];hasMore:boolean};
async function request<T>(path:string,token='',body?:unknown):Promise<T>{
 const response=await fetch(API_URL+'/api'+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error??'Auto rewards could not be updated.');return data;
}
export const autoRewardsApi={
 config:()=>request<{siteKey:string;walletlessEnabled:boolean;running:boolean}>('/auto-rewards/config'),
 status:(wallet:string)=>request<AutoRewardStatus>('/auto-rewards/wallets/'+encodeURIComponent(wallet)),
 set:(token:string,enabled:boolean)=>request<AutoRewardStatus>('/auto-rewards/settings',token,{enabled}),
 walletless:(wallet:string,captcha:string)=>request<AutoRewardStatus>('/auto-rewards/walletless','',{wallet,captcha}),
 activity:(round:number|null,offset:number,token='',range='all')=>request<AutoRewardActivity>((token?'/admin':'')+'/auto-rewards/activity?'+new URLSearchParams({offset:String(offset),range,...(round===null?{}:{round:String(round)})}),token),
 wallets:(token:string,wallet='',offset=0)=>request<{wallets:Array<{wallet:string;enabled:boolean;enabled_at:number;source:string}>;hasMore:boolean}>('/admin/auto-rewards/wallets?'+new URLSearchParams({offset:String(offset),...(wallet?{wallet}:{})}),token),
 adminSet:(token:string,wallet:string,enabled:boolean)=>request<AutoRewardStatus>('/admin/auto-rewards/wallets',token,{wallet,enabled}),
};
