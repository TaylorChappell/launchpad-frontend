import { RedirectClaimLink } from './RedirectClaimLink';
import { RedirectClaimedBadge } from './RedirectClaimedBadge';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, LockKeyhole } from 'lucide-react';
import { redirectRequest,recipientLabel,type RedirectSummary } from '../fee-redirect-api';
import type { Launch } from '../types';
import '../fee-redirect.css';
const amount=(raw:string,decimals:number)=>new Intl.NumberFormat('en',{maximumFractionDigits:6}).format(Number(raw)/10**decimals);
export function RedirectMarketPanel({launch,active=true}:{launch:Launch;active?:boolean}){
  const [data,setData]=useState<RedirectSummary|null>(null),[error,setError]=useState('');
  useEffect(()=>{if(!active)return;let live=true;const load=()=>redirectRequest<{redirect:RedirectSummary|null}>(`/markets/${encodeURIComponent(launch.id)}`).then(r=>{if(live){setData(r.redirect);setError('');}}).catch(()=>{if(live)setError('Recipient balances could not load.');});void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},20000);return()=>{live=false;clearInterval(timer);};},[launch.id,active]);
  const recipient=data?.recipient??launch.redirectRecipient;
  return <section className="workspace-panel redirect-market"><header><div><small>FEE REDIRECT</small><h2>Shared rewards. One recipient.</h2><RedirectClaimedBadge launch={{rewardMode:launch.rewardMode,redirectClaimed:data?.claimed??launch.redirectClaimed}}/></div><LockKeyhole size={18} aria-label="Recipient fixed at launch"/></header>
    <div className="redirect-split"><div><strong>50%</strong><span>{recipient?recipientLabel(recipient):'Recipient'}</span>{recipient?.profileUrl&&<a href={recipient.profileUrl} target="_blank" rel="noreferrer">View account <ArrowUpRight size={13}/></a>}</div><div><strong>50%</strong><span>Holder rewards in {launch.stockSymbol}</span><small>Balance × time held</small></div></div>
    <RedirectClaimLink id={launch.id}/>
    <p>{data?data.recipient.wallet?'Recipient wallet activated. Both shares use AQUA’s reward claims.':'The recipient has not activated a payout wallet. Their share is reserved while holders keep earning.':'Loading recipient status…'}</p>
    {data?.totals.map(t=><dl className="redirect-totals" key={t.mint}><div><dt>Recipient allocated</dt><dd>{amount(t.allocatedRaw,t.decimals)} {t.symbol}</dd></div><div><dt>Recipient claimable</dt><dd>{amount(t.claimableRaw,t.decimals)} {t.symbol}</dd></div><div><dt>Recipient paid</dt><dd>{amount(t.claimedRaw,t.decimals)} {t.symbol}</dd></div></dl>)}
    {data?.pending.some(p=>p.amountRaw!=='0')&&<p>More recipient rewards are reserved for the next settlement.</p>}
    {error&&<p role="status">{error}</p>}
    <footer><span>The net pool is split after operating costs, Ripple and community funding.</span><Link className="secondary-button" to={`/claim-redirect/${encodeURIComponent(launch.id)}`}>Recipient rewards <ArrowUpRight size={16}/></Link></footer>
  </section>;
}
