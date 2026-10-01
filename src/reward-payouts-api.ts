import { API_URL } from './api';
import { createAnalyticsCache } from './analytics-cache';
export type PayoutSort='recent'|'highest';
export type RewardPayout={id:string;wallet:string;launchId:string;name:string;symbol:string;rewardMint:string;rewardSymbol:string;rewardDecimals:number;amountRaw:string|null;usdCents:string|null;signature:string;paidAt:number;method:'manual'|'automatic';kind:string};
export type RewardPayoutActivity={range:string;wallet:string|null;sort:PayoutSort;offset:number;generatedAt:number;payouts:RewardPayout[];hasMore:boolean};
export const rewardPayoutKey=(range:string,wallet:string,sort:PayoutSort,offset:number)=>JSON.stringify([range,wallet,sort,offset]);
const snapshots=createAnalyticsCache<RewardPayoutActivity>(`aqua:reward-payouts:v1:${API_URL}`,(value,key):value is RewardPayoutActivity=>{
 const data=value as RewardPayoutActivity|null;
 return Boolean(data&&Array.isArray(data.payouts)&&typeof data.hasMore==='boolean'&&rewardPayoutKey(data.range,data.wallet??'',data.sort,data.offset)===key);
});
export const rewardPayoutsApi={
 peek:(range='all',wallet='',sort:PayoutSort='recent',offset=0)=>snapshots.read(rewardPayoutKey(range,wallet,sort,offset)),
 activity:(range='all',wallet='',sort:PayoutSort='recent',offset=0,refresh=false)=>snapshots.load(rewardPayoutKey(range,wallet,sort,offset),async()=>{
  const response=await fetch(API_URL+'/api/reward-payouts?'+new URLSearchParams({range,sort,offset:String(offset),...(wallet?{wallet}:{})}),{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Reward payouts could not load.');
  return await response.json() as RewardPayoutActivity;
 },refresh),
};
