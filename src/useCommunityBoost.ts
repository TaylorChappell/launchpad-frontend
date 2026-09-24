import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
import {useWallet} from './context';
import type {GovernanceMarket,GovernanceResponse} from './types';

export function useCommunityBoost(){
 const wallet=useWallet();
 const [snapshot,setSnapshot]=useState<{address:string|null;data:GovernanceResponse}|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState('');
 const [refreshKey,setRefreshKey]=useState(0),[now,setNow]=useState(()=>Math.floor(Date.now()/1000));
 const epoch=useRef(0),request=useRef(0),locked=useRef(false),address=useRef(wallet.address);
 address.current=wallet.address;
 useEffect(()=>{
  const generation=++epoch.current,abort=new AbortController();let active=true,pending=false;
  setError('');setNotice('');
  const refresh=async()=>{
   if(pending||locked.current||document.visibilityState==='hidden')return;
   pending=true;const ticket=++request.current;
   try{const data=await api.governance(wallet.address,abort.signal);if(active&&ticket===request.current)setSnapshot({address:wallet.address,data});if(active&&ticket===request.current)setError('');}
   catch(e){if(active&&ticket===request.current)setError(e instanceof Error?e.message:'Could not refresh the leaderboard.');}
   finally{pending=false;}
  };
  void refresh();const poll=setInterval(()=>void refresh(),15000),clock=setInterval(()=>setNow(Math.floor(Date.now()/1000)),1000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);
  return()=>{active=false;abort.abort();if(epoch.current===generation)epoch.current++;clearInterval(poll);clearInterval(clock);document.removeEventListener('visibilitychange',visible);};
 },[wallet.address,refreshKey]);
 const data=snapshot?.address===wallet.address?snapshot.data:null;
 const refresh=useCallback(()=>setRefreshKey(key=>key+1),[]);
 async function vote(target:GovernanceMarket|null){
  if(!wallet.address){wallet.setModalOpen(true);return;}
  if(locked.current||!data?.enabled||error)return;
  if(!data.votingOpen||now<data.round.startsAt||now>=data.round.endsAt){setNotice('This round has closed. Refresh to see the next vote.');return;}
  if(target&&!data.wallet?.eligible){setNotice(`Hold at least ${data.minimumHoldingBps/100}% of AQUA to vote.`);return;}
  const voter=wallet.address,generation=epoch.current;
  const current=()=>epoch.current===generation&&address.current===voter;
  locked.current=true;++request.current;setBusy(target?.mint??'remove');setNotice('');
  try{
   const challenge=target?await api.governanceVoteChallenge(voter,target.mint):await api.governanceUnboostChallenge(voter);
   if(!current())return;
   const signed=await wallet.signMessage(challenge.message);
   if(!current())return;
   const next=target?await api.governanceVote({wallet:voter,targetMint:target.mint,challenge:challenge.challenge,...signed}):await api.governanceUnboost({wallet:voter,challenge:challenge.challenge,...signed});
   if(current()){++request.current;setSnapshot({address:voter,data:next});setError('');setNotice(target?`Your vote for $${target.symbol} is confirmed.`:'Your vote has been removed.');}
  }catch(e){if(current())setNotice(e instanceof Error?e.message:'Your vote could not be recorded. Try again.');}
  finally{locked.current=false;setBusy('');}
 }
 return {data,error,busy,notice,now,vote,refresh,wallet};
}
