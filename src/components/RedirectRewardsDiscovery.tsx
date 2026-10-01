import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Loader2 } from 'lucide-react';
import { useWallet } from '../context';
import { ensureAccountSession, savedAccountSession } from '../account-api';
import { recipientLabel, redirectRequest, type RedirectRecipient } from '../fee-redirect-api';
import '../fee-redirect.css';
type Market={id:string;name:string;symbol:string;recipient:RedirectRecipient};
export function RedirectRewardsDiscovery(){
  const wallet=useWallet(),address=wallet.address,live=useRef(address);live.current=address;
  const [markets,setMarkets]=useState<Market[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(Boolean(savedAccountSession(address)));
  useEffect(()=>{
    let active=true,inFlight=false;setMarkets([]);setError('');
    async function load(){
      const token=savedAccountSession(address);setSignedIn(Boolean(token));
      if(!token||inFlight)return;inFlight=true;
      try{const r=await redirectRequest<{markets:Market[]}>('/mine',token);if(active){setMarkets(r.markets);setError('');}}
      catch{if(active)setError('Redirected rewards couldn’t refresh.');}
      finally{inFlight=false;}
    }
    void load();const refresh=()=>{if(!document.hidden)void load();};
    const timer=window.setInterval(refresh,20000);window.addEventListener('aqua:account-session',refresh);window.addEventListener('focus',refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('aqua:account-session',refresh);window.removeEventListener('focus',refresh);};
  },[address]);
  async function find(){
    if(!address||busy)return;setBusy(true);setError('');
    try{const token=await ensureAccountSession(address,wallet.signMessage,()=>live.current===address);if(live.current!==address)return;const r=await redirectRequest<{markets:Market[]}>('/mine',token);if(live.current===address){setMarkets(r.markets);setSignedIn(true);}}
    catch(e){if(live.current===address)setError((e as Error).message);}
    finally{if(live.current===address)setBusy(false);}
  }
  if(!address||signedIn&&!markets.length&&!error)return null;
  return <section className="redirect-discovery" aria-label="Redirected rewards"><header><Gift size={18}/><div><h3>Redirected to you</h3><p>{signedIn?'Claim-ready rewards are included below.':'Find rewards for your connected X and GitHub accounts.'}</p></div></header>
    {markets.map(m=><Link className="redirect-discovery-row" key={m.id} to={`/claim-redirect/${encodeURIComponent(m.id)}`}><span><strong>{m.name}</strong><small>{recipientLabel(m.recipient)}</small></span><b>{m.recipient.wallet===address?'View rewards':'Set up & claim'}</b></Link>)}
    {(!signedIn||error)&&<button className="soft-button" disabled={busy} onClick={()=>void find()}>{busy?<Loader2 className="spin" size={15}/>:null}{error?'Retry':'Find my redirected rewards'}</button>}{error&&<p role="alert" className="redirect-error">{error}</p>}
  </section>;
}
