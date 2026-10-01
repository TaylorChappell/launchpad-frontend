import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Github, Link2, Loader2, Plus } from 'lucide-react';
import { useRuntime, useWallet } from '../context';
import { connectX, useWalletX, useXFeature } from '../x-identity';
import { accountRequest, savedAccountSession } from '../account-api';
import { connectGithubIdentity } from '../github-identity';
import { useLocation } from 'react-router-dom';
import { AnimatedPanel } from './AnimatedPanel';
import './account-connections.css';

export function XLogo(){return <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.7-8.8L1.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/></svg>;}

export function XConnect(){
  const wallet=useWallet(),x=useXFeature(),{config}=useRuntime();
  const returning=useLocation().pathname==='/connect-x';
  return !returning&&wallet.address&&(x.enabled||config.rewardModes?.feeRedirect?.providers?.github)?<AccountConnectionsButton key={wallet.address} compact/>:null;
}

type GithubIdentity={enabled:boolean;connected:boolean;accounts:Array<{id:string;login:string}>};
export function AccountConnectionsButton({compact=false}:{compact?:boolean}){
  const wallet=useWallet();
  const [open,setOpen]=useState(false);
  useEffect(()=>setOpen(false),[wallet.address]);
  return <>
    <button type="button" className={compact?'x-connect-bubble account-connect-trigger':'secondary-button'} aria-label="Connect accounts" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Link2 size={compact?18:16}/>{compact?<Plus className="x-connect-plus" size={11}/>: 'Connect accounts'}</button>
    <AccountConnectionsPanel key={wallet.address??'guest'} open={open} onClose={()=>setOpen(false)}/>
  </>;
}

function AccountConnectionsPanel({open,onClose}:{open:boolean;onClose:()=>void}){
  const wallet=useWallet(),x=useXFeature(),{config}=useRuntime(),{profile}=useWalletX(wallet.address);
  const [github,setGithub]=useState<GithubIdentity|null>(null),[busy,setBusy]=useState<'x'|'github'|null>(null),[error,setError]=useState('');
  const current=useRef(wallet.address);current.current=wallet.address;
  useEffect(()=>()=>{current.current=null;},[]);
  useEffect(()=>{
    if(!open)return;
    setError('');let active=true;
    const token=savedAccountSession(wallet.address);
    if(token)void accountRequest<GithubIdentity>('/integrations/github/identity',token).then(value=>{if(active)setGithub(value);}).catch(()=>{/* Provider buttons can retry authentication without blocking the panel. */});
    return()=>{active=false;};
  },[open,wallet.address]);
  async function connect(provider:'x'|'github'){
    if(busy)return;
    const address=wallet.address;
    if(!address){wallet.setModalOpen(true);return;}
    setBusy(provider);setError('');
    try{
      if(provider==='x')await connectX(address,wallet.signMessage,()=>current.current===address);
      else await connectGithubIdentity(address,wallet.signMessage,()=>current.current===address);
    }catch(e){if(current.current===address)setError(e instanceof Error?e.message:'Could not connect this account. Try again.');}
    finally{if(current.current===address)setBusy(null);}
  }
  const githubEnabled=github?.enabled??config.rewardModes?.feeRedirect?.providers?.github??false;
  const githubConnected=Boolean(github?.connected);
  return <AnimatedPanel open={open} onClose={onClose} title="Connect accounts" description="Link X or GitHub to your wallet. You can connect both." className="account-connections-panel">
    <div className="account-connection-options">
      <button type="button" className="account-provider" aria-label={profile?`X / Twitter @${profile.username} Connected`:"X / Twitter Connect X"} disabled={!!busy||!x.enabled||!!profile} onClick={()=>void connect('x')}>
        <span className="account-provider-icon"><XLogo/></span><span className="account-provider-copy"><strong>X / Twitter</strong><small>{profile?`@${profile.username} · Connected`:'Show your identity and access Ripple and redirected rewards.'}</small></span><span className="account-provider-action">{busy==='x'?<Loader2 className="spin" size={18}/>:profile?<Check size={19}/>:<ArrowUpRight size={19}/>}<span>{profile?'Connected':x.enabled?'Connect X':'Unavailable'}</span></span>
      </button>
      <button type="button" className="account-provider" aria-label={githubConnected?`GitHub ${github!.accounts.map(a=>a.login).join(", ")} Connected`:"GitHub Connect GitHub"} disabled={!!busy||!githubEnabled||githubConnected} onClick={()=>void connect('github')}>
        <span className="account-provider-icon"><Github size={24}/></span><span className="account-provider-copy"><strong>GitHub</strong><small>{githubConnected?`${github!.accounts.map(a=>a.login).join(', ')} · Connected`:'Verify your account to receive redirected rewards.'}</small></span><span className="account-provider-action">{busy==='github'?<Loader2 className="spin" size={18}/>:githubConnected?<Check size={19}/>:<ArrowUpRight size={19}/>}<span>{githubConnected?'Connected':githubEnabled?'Connect GitHub':'Unavailable'}</span></span>
      </button>
    </div>
    <p className="account-connections-note">Connections belong to this wallet. This GitHub connection requests profile access only.</p>
    {error&&<p className="redirect-error" role="alert">{error}</p>}
  </AnimatedPanel>;
}
