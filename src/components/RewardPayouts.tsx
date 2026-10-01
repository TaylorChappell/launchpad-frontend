import { useEffect,useRef,useState,type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw,Search,X } from 'lucide-react';
import { rewardPayoutsApi,rewardPayoutKey,type PayoutSort,type RewardPayoutActivity } from '../reward-payouts-api';
import { ANALYTICS_REFRESH_MS } from '../analytics-cache';
import { useRuntime } from '../context';
import { displayTokenAmount } from '../trade-quote';
import { WalletIdentity } from './WalletIdentity';
import { Select } from './Select';
import { RefreshButton } from './RefreshButton';
import '../reward-payouts.css';
const usd=new Intl.NumberFormat('en',{style:'currency',currency:'USD'});
const labels:Record<string,string>={holder_rewards:'Holder rewards',ripple:'Ripple',jackpot:'Jackpot',rewards:'Rewards'};
const periods:Record<string,string>={all:'All time','24h':'Last 24 hours','7d':'Last 7 days','30d':'Last 30 days'};
export function RewardPayouts({range='all'}:{range?:string}) {
 const {config}=useRuntime();
 const [wallet,setWallet]=useState(''),[draft,setDraft]=useState(''),[sort,setSort]=useState<PayoutSort>('recent');
 const [page,setPage]=useState({range,offset:0}),[revision,setRevision]=useState(0),[inputError,setInputError]=useState('');
 const offset=page.range===range?page.offset:0,key=rewardPayoutKey(range,wallet,sort,offset);
 const [result,setResult]=useState<{key:string;data:RewardPayoutActivity}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const data=result?.key===key?result.data:rewardPayoutsApi.peek(range,wallet,sort,offset);
 const refreshRevision=useRef(revision);
 useEffect(()=>{
  let active=true,pending=false;
  const force=refreshRevision.current!==revision;refreshRevision.current=revision;setError('');
  const load=async(refresh=false)=>{
   if(pending)return;pending=true;if(active)setLoading(true);
   try{const next=await rewardPayoutsApi.activity(range,wallet,sort,offset,refresh);if(active){setResult({key,data:next});setError('');}}
   catch{if(active)setError('Reward payouts could not refresh. Try again.');}
   finally{pending=false;if(active)setLoading(false);}
  };
  void load(force);const timer=setInterval(()=>{if(!document.hidden)void load(true);},ANALYTICS_REFRESH_MS);
  return()=>{active=false;clearInterval(timer);};
 },[key,range,wallet,sort,offset,revision]);
 function search(event:FormEvent){
  event.preventDefault();const address=draft.trim();
  if(address&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)){setInputError('Enter a complete Solana wallet address.');return;}
  setInputError('');setWallet(address);setPage({range,offset:0});
 }
 return <section className="workspace-panel reward-payouts" aria-label="Reward payouts">
  <header><div><h2>Reward payouts</h2><span>Completed payments · {periods[range]??'All time'}</span></div><RefreshButton className="workspace-refresh" aria-label="Refresh reward payouts" disabled={loading} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></RefreshButton></header>
  <div className="reward-payout-controls">
   <form onSubmit={search} role="search" aria-label="Search reward payouts"><div className="reward-wallet-input"><Search size={16}/><input aria-label="Search payout wallet" placeholder="Search wallet address" value={draft} onChange={e=>{setDraft(e.target.value);setInputError('');}} autoComplete="off" spellCheck={false} aria-invalid={Boolean(inputError)} aria-describedby={inputError?'payout-wallet-error':undefined}/>{(draft||wallet)&&<button type="button" aria-label="Clear wallet search" onClick={()=>{setDraft('');setWallet('');setPage({range,offset:0});setInputError('');}}><X size={15}/></button>}</div><button className="soft-button" type="submit">Search</button></form>
   <Select aria-label="Sort reward payouts" value={sort} onChange={e=>{setSort(e.target.value as PayoutSort);setPage({range,offset:0});}}><option value="recent">Most recent</option><option value="highest">Highest payouts</option></Select>
  </div>
  {inputError&&<p className="danger-note" id="payout-wallet-error" role="alert">{inputError}</p>}
  {error&&<p className="danger-note" role="alert">{error}</p>}
  <div aria-busy={loading}>
   {data?.payouts.length?<div className="table-scroll"><table className="market-table"><thead><tr><th>Wallet</th><th>Coin</th><th>Payout</th><th>Type</th><th>Paid</th><th>Receipt</th></tr></thead><tbody>{data.payouts.map(p=><tr key={p.id}>
    <td><WalletIdentity wallet={p.wallet}/></td><td><Link to={'/token/'+p.launchId}>{p.name}</Link></td>
    <td><b>{p.usdCents===null?'-':usd.format(Number(p.usdCents)/100)}</b><small className="reward-payout-asset">{p.amountRaw===null?'Amount unavailable':displayTokenAmount(p.amountRaw,p.rewardDecimals)+' '+p.rewardSymbol}</small></td>
    <td>{p.method==='automatic'?'Automatic':labels[p.kind]??'Rewards'}</td><td><time dateTime={new Date(p.paidAt).toISOString()} title={new Date(p.paidAt).toLocaleString()}>{new Date(p.paidAt).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></td>
    <td><a href={'https://solscan.io/tx/'+p.signature+(config.network==='devnet'?'?cluster=devnet':'')} target="_blank" rel="noreferrer">View</a></td>
   </tr>)}</tbody></table></div>:<div className="workspace-empty" role="status">{data?(wallet?'No completed payouts for this wallet in this period.':'No completed payouts in this period.'):error?'Payout activity unavailable.':'Loading reward payouts…'}</div>}
  </div>
  {data&&(data.payouts.length>0||offset>0)&&<div className="reward-payout-pages"><button className="soft-button" disabled={!offset||loading} onClick={()=>setPage({range,offset:Math.max(0,offset-50)})}>Previous</button><span>Page {offset/50+1}</span><button className="soft-button" disabled={!data.hasMore||loading} onClick={()=>setPage({range,offset:offset+50})}>Next</button></div>}
  <p className="reward-payout-note">Automatic payments, manual reward claims, Ripple and jackpot rewards. USD values are estimates based on recorded reward values.</p>
 </section>;
}
