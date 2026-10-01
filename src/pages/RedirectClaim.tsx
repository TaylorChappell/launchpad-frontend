import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Gift, Github, Loader2, Monitor, Smartphone, Wallet } from 'lucide-react';
import { api } from '../api';
import { accountRequest, ensureAccountSession, savedAccountSession } from '../account-api';
import { useWallet } from '../context';
import { connectGithubIdentity } from '../github-identity';
import { connectX, useWalletX } from '../x-identity';
import { recipientLabel, redirectClaimUrl, redirectRequest, type RedirectSummary } from '../fee-redirect-api';
import { TokenMark } from '../components/TokenCard';
import { WalletRewards } from '../components/WalletRewards';
import { XLogo } from '../components/XConnect';
import type { Launch } from '../types';
import '../redirect-claim.css';

type Device='desktop'|'mobile';
type GithubStatus={accounts:Array<{id:string;login:string}>};
export function RedirectClaim(){
  const {id=''}=useParams();
  return <ClaimFlow key={id} id={id}/>;
}
function ClaimFlow({id}:{id:string}){
  const wallet=useWallet(),address=wallet.address,[params,setParams]=useSearchParams();
  const live=useRef(address);live.current=address;
  const [launch,setLaunch]=useState<Launch|null>(null),[summary,setSummary]=useState<RedirectSummary|null>(null);
  const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0);
  const [help,setHelp]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(false);
  const [github,setGithub]=useState<{wallet:string;accounts:GithubStatus['accounts']}|null>(null);
  const [claimed,setClaimed]=useState(false);
  const x=useWalletX(address);
  const device:Device|null=params.get('device')==='mobile'?'mobile':params.get('device')==='desktop'?'desktop':null;
  const recipient=summary?.recipient;
  const mine=Boolean(address&&recipient?.wallet===address);
  const wrongWallet=Boolean(address&&recipient?.wallet&&recipient.wallet!==address);
  const matched=Boolean(address&&recipient&&(recipient.kind==='x'?x.profile?.id===recipient.subject:recipient.kind==='github'?github?.wallet===address&&github.accounts.some(a=>a.id===recipient.subject):recipient.subject===address));
  // Public data alone never activates a payout wallet. The server verifies the
  // exact immutable account ID again when the signed wallet activates it.
  useEffect(()=>{
    let active=true,inFlight=false;let coin=launch;
    async function load(){
      if(inFlight)return;inFlight=true;
      try{const [l,r]=await Promise.all([coin?Promise.resolve({launch:coin}):api.launch(id),redirectRequest<{redirect:RedirectSummary|null}>(`/markets/${encodeURIComponent(id)}`)]);
        if(active){coin=l.launch;setLaunch(l.launch);setSummary(r.redirect);setLoadError('');setLoaded(true);}
      }catch(e){if(active){setLoadError((e as Error).message);setLoaded(true);}}
      finally{inFlight=false;}
    }
    void load();const timer=window.setInterval(()=>{if(!document.hidden)void load();},20000);
    return()=>{active=false;clearInterval(timer);};
  },[id,revision]);
  useEffect(()=>{setError('');setChecked(false);setBusy(false);setClaimed(false);},[address]);
  useEffect(()=>{
    let active=true;
    const token=savedAccountSession(address);
    if(address&&token&&recipient?.kind==='github')accountRequest<GithubStatus>('/integrations/github/identity',token).then(r=>{if(active)setGithub({wallet:address,accounts:r.accounts});}).catch(()=>{/* The connect button can renew an expired sign-in. */});
    return()=>{active=false;};
  },[address,recipient?.kind,revision]);
  async function action(fn:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');
    try{await fn();}catch(e){if(live.current===address)setError((e as Error).message);}
    finally{if(live.current===address)setBusy(false);}
  }
  async function session(){
    if(!address)throw Error('Connect your wallet first.');
    const token=await ensureAccountSession(address,wallet.signMessage,()=>live.current===address);
    if(live.current!==address)throw Error('Wallet changed. Please try again.');
    return token;
  }
  async function connectAccount(){
    if(!address||!recipient)return;
    const token=await session();
    if(recipient.kind==='github'){
      const status=await accountRequest<GithubStatus>('/integrations/github/identity',token);
      if(live.current!==address)return;
      setGithub({wallet:address,accounts:status.accounts});
      if(status.accounts.some(a=>a.id===recipient.subject))return;
      await connectGithubIdentity(address,wallet.signMessage,()=>live.current===address);
    }else if(recipient.kind==='x')await connectX(address,wallet.signMessage,()=>live.current===address);
  }
  async function activate(){
    if(!recipient||!checked||!matched)return;
    const token=await session();
    const r=await redirectRequest<{recipient:RedirectSummary['recipient']}>('/activate',token,{kind:recipient.kind,subject:recipient.subject});
    if(live.current!==address)return;
    setSummary(current=>current?{...current,recipient:r.recipient}:current);setRevision(n=>n+1);
  }
  function choose(next:Device){setParams({device:next},{replace:true});setHelp(false);}
  const stage=mine?3:address?2:device?1:0;
  const openUrl=redirectClaimUrl(id)+'?device=mobile';
  const phantomUrl=`https://phantom.app/ul/browse/${encodeURIComponent(openUrl)}?ref=${encodeURIComponent(window.location.origin)}`;
  const label=recipient?recipientLabel(recipient):'';
  const provider=recipient?.kind==='github'?'GitHub':'X';
  return <main className="recipient-claim-page">
    <div className="recipient-claim-water" aria-hidden="true"/>
    <section className="recipient-claim-card" aria-label="Claim redirected rewards">
      {!loaded?<div className="recipient-claim-loading" role="status"><Loader2 className="spin"/><h1>Finding your rewards…</h1></div>:!launch||!summary?<div className="recipient-claim-step"><Gift className="recipient-step-icon"/><h1>{loadError?'This link couldn’t load':'No redirected rewards here'}</h1><p>{loadError||'This coin uses a different reward mode.'}</p>{loadError&&<button className="primary" onClick={()=>setRevision(n=>n+1)}>Try again</button>}<Link className="recipient-text-link" to="/portfolio?tab=rewards">Go to my rewards</Link></div>:<>
        <header className="recipient-coin"><TokenMark launch={launch}/><div><strong>{launch.name}</strong><span>${launch.symbol} · Recipient rewards</span></div><span className="recipient-share">50%<small>of net rewards</small></span></header>
        <ol className="recipient-progress" aria-label="Claim steps">{['Device','Wallet','Account','Claim'].map((s,i)=><li key={s} className={i<stage?'done':i===stage?'current':''} aria-current={i===stage?'step':undefined}><span>{i<stage?<Check size={13}/>:i+1}</span>{s}</li>)}</ol>
        <div className="recipient-claim-step" key={`${stage}:${help}:${wrongWallet}`}>
          {stage===0&&<><span className="recipient-icon-orb"><Gift size={34}/></span><small className="recipient-eyebrow">A little thank-you, on repeat</small><h1>Rewards for {label}.</h1><p>Let’s get you connected. What are you using?</p><div className="recipient-device-options"><button onClick={()=>choose('desktop')}><Monitor/><strong>Desktop</strong><span>Computer or laptop</span></button><button onClick={()=>choose('mobile')}><Smartphone/><strong>Mobile</strong><span>Phone or tablet</span></button></div></>}
          {stage===1&&!help&&<><span className="recipient-icon-orb"><Wallet size={32}/></span><h1>Your wallet. Your rewards.</h1><p>Connect a Solana wallet to receive your rewards.</p>{device==='mobile'&&!wallet.phantomInstalled?<><a className="primary recipient-primary" href={phantomUrl}>Open in Phantom</a><button className="recipient-text-link" onClick={()=>wallet.setModalOpen(true)}>Use another wallet</button></>:<button className="primary recipient-primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button>}<button className="recipient-text-link" onClick={()=>setHelp(true)}>I don’t have a wallet</button><button className="recipient-back" onClick={()=>setParams({},{replace:true})}>Change device</button></>}
          {stage===1&&help&&<><span className="recipient-icon-orb"><Wallet size={32}/></span><h1>Meet your new wallet.</h1><p>Phantom is a free app for your rewards.</p><ol className="recipient-wallet-guide"><li><span>1</span><div><strong>Get Phantom</strong><a href="https://phantom.com/download" target="_blank" rel="noreferrer">Install {device==='mobile'?'the mobile app':'the browser extension'}</a></div></li><li><span>2</span><div><strong>Create your wallet</strong><small>Choose Google or Apple in Phantom and finish setup.</small></div></li><li><span>3</span><div><strong>Come back here</strong><small>{device==='mobile'?'Tap below to open this page in Phantom.':'Connect Phantom, then approve the sign-in.'}</small></div></li></ol><p className="recipient-safety-note">Keep any recovery phrase private. AQUA never asks for it.</p>{device==='mobile'?<a className="primary recipient-primary" href={phantomUrl}>Open in Phantom</a>:<button className="primary recipient-primary" onClick={()=>wallet.setModalOpen(true)}>I’m ready · Connect wallet</button>}<button className="recipient-back" onClick={()=>setHelp(false)}>Back</button></>}
          {stage===2&&wrongWallet&&<><Wallet className="recipient-step-icon"/><h1>Switch to the payout wallet.</h1><p>These rewards belong to the wallet below.</p><code className="recipient-address">{recipient!.wallet}</code><button className="primary recipient-primary" onClick={()=>void action(()=>wallet.disconnect())} disabled={busy}>Switch wallet</button></>}
          {stage===2&&!wrongWallet&&<><span className="recipient-icon-orb">{recipient!.kind==='github'?<Github size={32}/>:recipient!.kind==='x'?<XLogo/>:<Wallet size={32}/>}</span><h1>{matched?'That’s you.':'One quick connection.'}</h1><p>{matched?`${label} is connected.`:`Connect ${label} on ${provider} to unlock these rewards.`}</p><div className="recipient-account-target">{recipient!.avatarUrl&&<img src={recipient!.avatarUrl} alt=""/>}<div><strong>{label}</strong><small>{recipient!.kind==='wallet'?'Solana wallet':provider+' account'}</small></div>{matched&&<Check size={20}/>}</div>{!matched?<><button className="primary recipient-primary" disabled={busy} onClick={()=>void action(connectAccount)}>{busy?<><Loader2 className="spin" size={16}/> Connecting…</>:`Connect ${provider}`}</button>{recipient!.kind==='x'&&x.profile&&<p className="recipient-small">You’re connected as @{x.profile.username}. Sign in as {label} instead.</p>}{recipient!.kind==='github'&&github?.wallet===address&&github.accounts.length>0&&<p className="recipient-small">Choose {label} when GitHub opens.</p>}</>:<><label className="recipient-activation-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/><span>Always send {label}’s AQUA rewards to this wallet. This is permanent.</span></label><button className="primary recipient-primary" disabled={busy||!checked} onClick={()=>void action(activate)}>{busy?<><Loader2 className="spin" size={16}/> Activating…</>:'Use this payout wallet'}</button></>}</>}
          {stage===3&&<><span className={`recipient-icon-orb ${claimed?'recipient-celebrate':''}`}>{claimed?<Check size={36}/>:<Gift size={34}/>}</span><h1>{claimed?'Nice. Rewards received.':'Your rewards are here.'}</h1><p>{claimed?'Your next rewards will appear here and in your Rewards tab.':'Tap Claim, then approve the prompt in your wallet.'}</p><WalletRewards launch={launch} guided onConfirmed={()=>{setClaimed(true);setRevision(n=>n+1);}}/>{summary.pending.some(p=>p.amountRaw!=='0')&&<p className="recipient-small">More rewards are settling. We’ll refresh this page automatically.</p>}<Link className="recipient-text-link" to="/portfolio?tab=rewards">View all my rewards</Link></>}
          {error&&<p className="recipient-error" role="alert">{error}</p>}
          {loadError&&<p className="recipient-error" role="status">Rewards couldn’t refresh. <button onClick={()=>setRevision(n=>n+1)}>Retry</button></p>}
        </div>
        <footer className="recipient-claim-footer">{address?<span><Check size={13}/> {address.slice(0,6)}…{address.slice(-5)} <button onClick={()=>void action(()=>wallet.disconnect())} disabled={busy}>Change</button></span>:<span>No tokens to buy. Just connect.</span>}<Link to={`/token/${encodeURIComponent(id)}?tab=rewards`}>View coin</Link></footer>
      </>}
    </section>
  </main>;
}
