import { useEffect,useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { Github,ArrowUpRight,Wallet } from 'lucide-react';
import { useWallet } from '../context';
import { API_URL,api } from '../api';
import { ensureAccountSession,accountRequest } from '../account-api';
import { connectX,useXFeature } from '../x-identity';
import { redirectRequest,recipientLabel,type RedirectRecipient,type RedirectSummary } from '../fee-redirect-api';
import { RedirectMarketPanel } from '../components/RedirectMarketPanel';
import { WalletRewards } from '../components/WalletRewards';
import type { Launch } from '../types';
import '../fee-redirect.css';
const pendingKey=`aqua:redirect-github:${API_URL}`;
type Market={id:string;name:string;symbol:string;recipient:RedirectRecipient};
export function FeeRedirect(){
  const wallet=useWallet(),x=useXFeature(),[params,setParams]=useSearchParams();
  const address=wallet.address,live=useRef(address);live.current=address;
  const [launch,setLaunch]=useState<Launch|null>(null),[summary,setSummary]=useState<RedirectSummary|null>(null),[markets,setMarkets]=useState<Market[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[revision,setRevision]=useState(0);
  const [enabled,setEnabled]=useState<{enabled:boolean;providers:{wallet:boolean;x:boolean;github:boolean}}|null>(null);
  const [activationChecked,setActivationChecked]=useState(false),finishedCallback=useRef('');
  const id=params.get('market'),callback=params.get('github');
  useEffect(()=>{let active=true;redirectRequest<{enabled:boolean;providers:{wallet:boolean;x:boolean;github:boolean}}>('/config').then(r=>{if(active)setEnabled(r);}).catch(()=>{if(active)setError('Fee Redirect is unavailable. Try again.');});return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;setLaunch(null);setSummary(null);setActivationChecked(false);if(id)Promise.all([api.launch(id),redirectRequest<{redirect:RedirectSummary|null}>(`/markets/${encodeURIComponent(id)}`)]).then(([l,r])=>{if(active){setLaunch(l.launch);setSummary(r.redirect);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,revision]);
  useEffect(()=>{setMarkets([]);},[address]);
  async function token(){if(!address)throw Error('Connect your recipient wallet first.');return ensureAccountSession(address,wallet.signMessage,()=>live.current===address);}
  async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function loadMine(){const auth=await token();const r=await redirectRequest<{markets:Market[]}>('/mine',auth);if(live.current===address){setMarkets(r.markets);setStatus(r.markets.length?'Your redirected markets are below.':'No redirected markets found for this wallet or its connected accounts.');}}
  async function github(){const auth=await token();const r=await accountRequest<{url:string;state:string}>('/integrations/github/connect',auth,{purpose:'redirect'});if(live.current!==address)return;sessionStorage.setItem(pendingKey,JSON.stringify({state:r.state,wallet:address,market:id}));window.location.assign(r.url);}
  useEffect(()=>{
    if(callback!=='callback'||!address||finishedCallback.current===params.get('state'))return;
    let pending:{state:string;wallet:string;market:string|null}|null=null;
    try{pending=JSON.parse(sessionStorage.getItem(pendingKey)??'null');}catch{/* Invalid state is rejected below. */}
    if(!pending||pending.wallet!==address||pending.state!==params.get('state')){setError('Connect the wallet that started GitHub verification in this browser.');return;}
    finishedCallback.current=pending.state;
    void action(async()=>{const auth=await token();await accountRequest('/integrations/github/complete',auth,{state:pending!.state,code:params.get('code')});sessionStorage.removeItem(pendingKey);setParams(pending!.market?{market:pending!.market}:{},{replace:true});setStatus('GitHub verified. Choose a market and activate your payout wallet.');await loadMine();setRevision(n=>n+1);});
  },[callback,address,params]);
  async function activate(){if(!summary||!activationChecked)return;const auth=await token();await redirectRequest('/activate',auth,{kind:summary.recipient.kind,subject:summary.recipient.subject});setStatus('Payout wallet activated. Reserved rewards will become claimable after settlement.');setRevision(n=>n+1);}
  return <main className="page redirect-page"><header className="redirect-page-heading"><small>AQUA REWARDS</small><h1>Fee Redirect</h1><p>Support a person or project while rewarding everyone who holds.</p></header>
    <section className="workspace-panel redirect-account"><div className="redirect-split"><div><strong>50%</strong><span>Chosen recipient</span></div><div><strong>50%</strong><span>Token holders</span></div></div><p>The remaining reward pool is split equally after operating costs, Ripple and community funding. Recipients earn the market’s pair asset without needing to hold the coin.</p>
      <p>Wallet recipients connect the exact address. X and GitHub recipients verify their account and activate a payout wallet. Reserved rewards wait for them; holder rewards continue.</p>
      {!address?<button className="primary" onClick={()=>wallet.setModalOpen(true)}><Wallet size={17}/> Connect recipient wallet</button>:<div className="redirect-actions"><button className="primary" disabled={busy} onClick={()=>void action(loadMine)}>Find my rewards</button>{x.enabled&&enabled?.providers.x&&<button className="secondary-button" disabled={busy} onClick={()=>void action(()=>connectX(address,wallet.signMessage,()=>live.current===address,window.location.hash))}>Connect X</button>}{enabled?.providers.github&&<button className="secondary-button" disabled={busy} onClick={()=>void action(github)}><Github size={17}/> Verify GitHub</button>}</div>}
      {callback==='cancelled'&&<p role="status">GitHub verification was cancelled. You can try again.</p>}{busy&&<p role="status">Working…</p>}{error&&<p role="alert" className="redirect-error">{error}</p>}{status&&<p role="status">{status}</p>}
    </section>
    {markets.length>0&&<section className="redirect-market-list" aria-label="Your redirected markets">{markets.map(m=><Link key={m.id} to={`/fee-redirect?market=${encodeURIComponent(m.id)}`}><span><strong>{m.name}</strong><small>${m.symbol} · {recipientLabel(m.recipient)}</small></span><ArrowUpRight size={20}/></Link>)}</section>}
    {launch&&summary&&<><div className="redirect-selected-title"><h2>{launch.name}</h2><Link to={`/token/${encodeURIComponent(launch.id)}?tab=rewards`}>View market ↗</Link></div><RedirectMarketPanel key={`${launch.id}:${revision}`} launch={launch}/>
      {address&&!summary.recipient.wallet&&<section className="workspace-panel redirect-activation"><h2>Activate recipient rewards</h2><p>Verify {recipientLabel(summary.recipient)} using the matching account above. This wallet will receive this account’s redirected rewards across AQUA.</p><label><input type="checkbox" checked={activationChecked} onChange={e=>setActivationChecked(e.target.checked)}/><span>Use <strong>{address.slice(0,6)}…{address.slice(-5)}</strong> as the fixed payout wallet. This cannot be changed after activation.</span></label><button className="primary" disabled={busy||!activationChecked} onClick={()=>void action(activate)}>Activate payout wallet</button></section>}
      {address&&summary.recipient.wallet===address&&<section className="redirect-claims"><h2>Your claimable rewards</h2><p>Recipient rewards and any holder rewards use the same claim. Balances appear after settlement and must meet AQUA’s normal minimum claim amount.</p><WalletRewards launch={launch}/></section>}
    </>}
    <p className="redirect-create-link">Creating a coin? <Link to="/create">Choose Fee Redirect at launch ↗</Link></p>
  </main>;
}
