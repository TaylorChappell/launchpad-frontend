import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { autoRewardsApi,type AutoRewardActivity } from '../auto-rewards-api';
import { ANALYTICS_REFRESH_MS } from '../analytics-cache';
import { useRuntime } from '../context';
import { displayTokenAmount } from '../trade-quote';
import { WalletIdentity } from './WalletIdentity';
import { Select } from './Select';
import { RefreshButton } from './RefreshButton';
import '../auto-rewards.css';
const usd=new Intl.NumberFormat('en',{style:'currency',currency:'USD'});
export function AutoRewardsActivity({token='',range='all'}:{token?:string;range?:string}){
 const {config}=useRuntime(),[data,setData]=useState<AutoRewardActivity|null>(()=>token?null:autoRewardsApi.peekActivity(null,0,range)),[revision,setRevision]=useState(0),[error,setError]=useState('');
 const [selection,setSelection]=useState<{range:string;token:string;round:number|null;offset:number}>({range,token,round:null,offset:0});
 const matches=selection.range===range&&selection.token===token,round=matches?selection.round:null,offset=matches?selection.offset:0;
 const refreshRevision=useRef(revision);
 const previousQuery=useRef('');
 useEffect(()=>{
  let active=true,pending=false;
  const force=refreshRevision.current!==revision;refreshRevision.current=revision;
  const cached=token?null:autoRewardsApi.peekActivity(round,offset,range);
  const query=JSON.stringify([token,range,round,offset]);
  if(cached||previousQuery.current!==query)setData(cached);
  previousQuery.current=query;setError('');
  const load=async(refresh=false)=>{if(pending)return;pending=true;try{const next=await autoRewardsApi.activity(round,offset,token,range,refresh);if(!Array.isArray(next.rounds)||!Array.isArray(next.payouts))throw new Error('Invalid payout response');if(active){setData(next);setError('');}}catch{if(active)setError('Payout activity could not refresh.');}finally{pending=false;}};
  void load(force);const timer=setInterval(()=>{if(!document.hidden)void load();},token?30000:ANALYTICS_REFRESH_MS);
  return()=>{active=false;clearInterval(timer);};
 },[round,offset,revision,token,range]);
 const selected=data?.rounds.find(r=>Number(r.scheduled_at)===data.selectedRound);
 return <section className="workspace-panel auto-rewards-activity" aria-label="Auto rewards activity"><header><div><h2>Auto rewards</h2><span>{data?.running?'Next global round '+new Date(data.nextPayoutAt).toLocaleString():'Payouts awaiting activation'}</span></div><RefreshButton className="workspace-refresh" aria-label="Refresh auto rewards" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></RefreshButton></header>
  {error&&<p className="danger-note" role="alert">{error}</p>}
  {data?.rounds.length?<><div className="auto-rewards-round"><Select aria-label="Payout round" value={String(data.selectedRound)} onChange={e=>{setSelection({range,token,round:Number(e.target.value),offset:0});}}>{data.rounds.map(r=><option key={r.scheduled_at} value={r.scheduled_at}>{new Date(Number(r.scheduled_at)).toLocaleString()} · {r.status==='processing'?'Processing':'Complete'}</option>)}</Select><span><b>{usd.format(Number(selected?.paid_usd_cents??0)/100)}</b> paid · {selected?.paid_wallets??0} wallets</span></div>
   <div className="table-scroll"><table className="market-table"><thead><tr><th>Wallet</th><th>Coin</th><th>Rewards</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{data.payouts.map(p=><tr key={p.id}><td><WalletIdentity wallet={p.wallet}/></td><td><Link to={'/token/'+p.launch_id}>{p.name}</Link></td><td>{p.usd_cents===null?'—':<><b>{usd.format(Number(p.usd_cents)/100)}</b><small className="auto-rewards-asset">{displayTokenAmount(p.received_raw??p.amount_raw??'0',p.stock_decimals??0)} {p.stock_symbol}</small></>}</td><td>{({queued:'Queued',submitted:'Confirming',paid:'Paid',skipped:'Skipped'} as Record<string,string>)[p.status]??p.status}{token&&p.reason&&<small className="auto-rewards-asset">{p.reason}</small>}</td><td>{p.signature?<a href={'https://solscan.io/tx/'+p.signature+(config.network==='devnet'?'?cluster=devnet':'')} target="_blank" rel="noreferrer">View</a>:'—'}</td></tr>)}</tbody></table></div>
   <div className="auto-rewards-pages"><button className="soft-button" disabled={!offset} onClick={()=>setSelection({range,token,round,offset:Math.max(0,offset-50)})}>Previous</button><span>Page {offset/50+1}</span><button className="soft-button" disabled={!data.hasMore} onClick={()=>setSelection({range,token,round,offset:offset+50})}>Next</button></div>
  </>:<div className="workspace-empty">{data?'No auto reward rounds in this period.':'Loading payout activity…'}</div>}
  <p className="auto-rewards-footnote">USD values are estimates at reward allocation. Rounds start together; individual transfers confirm as they are processed.</p>
 </section>;
}
