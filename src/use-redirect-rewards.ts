import { useEffect, useRef, useState } from 'react';
import { useWallet } from './context';
import { ensureAccountSession, savedAccountSession } from './account-api';
import { redirectRequest, type RedirectRecipient } from './fee-redirect-api';
export type RedirectRewardMarket={id:string;name:string;symbol:string;imageUrl?:string|null;recipient:RedirectRecipient};
export function useRedirectRewards(enabled:boolean){
  const wallet=useWallet(),address=wallet.address,live=useRef(address);live.current=address;
  const [markets,setMarkets]=useState<RedirectRewardMarket[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(Boolean(savedAccountSession(address))),[loading,setLoading]=useState(enabled&&Boolean(savedAccountSession(address)));
  useEffect(()=>{
    let active=true,inFlight=false;setMarkets([]);setError('');setBusy(false);setLoading(false);
    if(!enabled||!address)return;
    async function load(){
      const token=savedAccountSession(address);setSignedIn(Boolean(token));
      if(!token){setMarkets([]);return;}if(inFlight)return;inFlight=true;setLoading(true);
      try{const r=await redirectRequest<{markets:RedirectRewardMarket[]}>('/mine',token);if(active){setMarkets(r.markets);setError('');}}
      catch{if(active)setError('Redirected rewards couldn’t refresh.');}
      finally{inFlight=false;if(active)setLoading(false);}
    }
    void load();const refresh=()=>{if(!document.hidden)void load();};
    const timer=window.setInterval(refresh,20000);window.addEventListener('aqua:account-session',refresh);window.addEventListener('focus',refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('aqua:account-session',refresh);window.removeEventListener('focus',refresh);};
  },[address,enabled]);
  async function find(){
    if(!enabled||!address||busy)return;setBusy(true);setError('');
    try{const token=await ensureAccountSession(address,wallet.signMessage,()=>live.current===address);if(live.current!==address)return;const r=await redirectRequest<{markets:RedirectRewardMarket[]}>('/mine',token);if(live.current===address){setMarkets(r.markets);setSignedIn(true);}}
    catch(e){if(live.current===address)setError((e as Error).message);}
    finally{if(live.current===address)setBusy(false);}
  }
  return {markets,loading,busy,error,signedIn,find};
}
