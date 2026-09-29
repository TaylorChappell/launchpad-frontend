import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { Check,RefreshCw } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { autoRewardsApi,type AutoRewardStatus } from '../auto-rewards-api';
import { Turnstile } from '../components/Turnstile';
import '../auto-rewards.css';
export function AutoRewards(){
 const [config,setConfig]=useState<Awaited<ReturnType<typeof autoRewardsApi.config>>|null>(null),[wallet,setWallet]=useState(''),[captcha,setCaptcha]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<AutoRewardStatus|null>(null);
 useEffect(()=>{let active=true;autoRewardsApi.config().then(c=>{if(active)setConfig(c);}).catch(()=>{if(active)setError('Auto rewards could not load. Please refresh.');});return()=>{active=false;};},[]);
 async function enable(e:React.FormEvent){e.preventDefault();if(!captcha||busy)return;setError('');try{if(!PublicKey.isOnCurve(new PublicKey(wallet.trim())))throw Error();}catch{setError('Enter a valid Solana wallet address.');return;}
  setBusy(true);try{setResult(await autoRewardsApi.walletless(wallet.trim(),captcha));}catch(e){setError(e instanceof Error?e.message:'Could not enable auto rewards.');}finally{setBusy(false);setCaptcha('');setRevision(n=>n+1);}}
 return <main className="page holder-workspace auto-rewards-page"><section className="workspace-panel auto-rewards-card"><span className="workspace-icon"><RefreshCw size={26}/></span><h1>Auto rewards</h1><p>New rewards, straight to your wallet every 3 hours.</p>
  {result?<div className="auto-rewards-success" role="status"><Check size={24}/><h2>Auto rewards enabled</h2><code>{result.wallet}</code><p>{result.running?'Next round: '+new Date(result.nextPayoutAt).toLocaleString():'Your setting is saved. Payouts are awaiting activation.'}</p><Link className="primary" to="/analytics">View payout rounds</Link></div>:<form onSubmit={enable}>
   <label htmlFor="auto-wallet">Solana wallet address</label><input id="auto-wallet" autoComplete="off" spellCheck={false} value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="Enter your wallet address" disabled={busy}/>
   {config?.walletlessEnabled?<Turnstile key={revision} siteKey={config.siteKey} onToken={setCaptcha}/>:<p>{config?'Walletless activation is not available yet.':'Loading verification…'}</p>}
   <button className="primary" type="submit" disabled={busy||!captcha||!wallet.trim()}>{busy?'Enabling…':'Enable auto rewards'}</button>
  </form>}{error&&<p className="danger-note" role="alert">{error}</p>}
  <div className="auto-rewards-notes"><p>Hold over $5 of a coin to receive its new holder rewards. Existing rewards stay available to claim manually.</p><p>One wallet per network each day, resetting at midnight UK time. Payments go only to the address entered.</p><Link to="/portfolio">Manage auto rewards in your holdings</Link></div>
 </section></main>;
}
