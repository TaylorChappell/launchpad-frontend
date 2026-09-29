import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureAccountSession } from '../account-api';
import { useWallet } from '../context';
import { autoRewardsApi,type AutoRewardStatus } from '../auto-rewards-api';
import '../auto-rewards.css';
export function AutoRewardsToggle({address}:{address:string}){
 const wallet=useWallet(),[status,setStatus]=useState<AutoRewardStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const current=useRef(wallet.address);current.current=wallet.address;
 useEffect(()=>{let active=true;autoRewardsApi.status(address).then(s=>{if(active)setStatus(s);}).catch(()=>{if(active)setError('Auto rewards are unavailable.');});return()=>{active=false;};},[address]);
 async function toggle(){if(!status||busy)return;setBusy(true);setError('');try{
  const token=await ensureAccountSession(address,wallet.signMessage,()=>current.current===address);
  const next=await autoRewardsApi.set(token,!status.enabled);if(current.current===address)setStatus(next);
 }catch(e){if(current.current===address)setError(e instanceof Error?e.message:'Could not update auto rewards.');}finally{if(current.current===address)setBusy(false);}}
 return <div className="auto-rewards-setting"><div><strong>Auto rewards</strong><small>New rewards every 3 hours · hold over $5 per coin</small>{status?.enabled&&<small>{status.running?'Next round '+new Date(status.nextPayoutAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Enabled · payouts awaiting activation'}</small>}</div>
  <button className="auto-rewards-switch" role="switch" aria-label="Auto rewards" aria-checked={status?.enabled??false} disabled={!status||busy} onClick={()=>void toggle()}><span/></button>
  <p>Existing rewards stay manual. <Link to="/auto-rewards">Use a wallet address</Link></p>{error&&<p className="danger-note" role="alert">{error}</p>}
 </div>;
}
