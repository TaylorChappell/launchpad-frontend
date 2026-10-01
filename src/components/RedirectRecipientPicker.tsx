import { useRef, useState } from 'react';
import { Check, Github, Wallet } from 'lucide-react';
import { useWallet } from '../context';
import { ensureAccountSession } from '../account-api';
import { redirectRequest, recipientLabel, type RedirectRecipient, type RedirectKind } from '../fee-redirect-api';
import '../fee-redirect.css';

export function RedirectRecipientPicker({value,onChange,providers}:{value?:RedirectRecipient|null;onChange:(value:RedirectRecipient|null)=>void;providers?:Partial<Record<RedirectKind,boolean>>}){
  const wallet=useWallet(),currentWallet=useRef(wallet.address);currentWallet.current=wallet.address;
  const [kind,setKind]=useState<RedirectKind>(value?.kind??'wallet'),[input,setInput]=useState(value?.kind==='wallet'?value.subject:value?.label??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const revision=useRef(0);
  function change(next:string){revision.current++;setInput(next);setError('');onChange(null);}
  async function check(){
    if(!wallet.address){wallet.setModalOpen(true);return;}
    const address=wallet.address,version=revision.current;setBusy(true);setError('');
    try{
      const token=await ensureAccountSession(address,wallet.signMessage,()=>currentWallet.current===address);
      const result=await redirectRequest<{recipient:RedirectRecipient}>('/resolve',token,{kind,value:input});
      if(version===revision.current&&currentWallet.current===address)onChange(result.recipient);
    }catch(e){if(version===revision.current)setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="redirect-picker" aria-label="Redirect recipient">
    <h3>Who receives the other half?</h3>
    <div className="redirect-kind" role="group" aria-label="Recipient type">{(['wallet','x','github'] as const).map(type=><button type="button" key={type} aria-pressed={kind===type} disabled={busy||providers?.[type]===false} onClick={()=>{setKind(type);change('');}}>{type==='wallet'?<Wallet size={16}/>:type==='github'?<Github size={16}/>:<span aria-hidden="true">𝕏</span>}{type==='wallet'?'Wallet':type==='x'?'X account':'GitHub'}</button>)}</div>
    <label htmlFor="redirect-recipient">{kind==='wallet'?'Solana wallet address':kind==='x'?'X handle or profile URL':'GitHub username or profile URL'}</label>
    <div className="redirect-input-row"><input id="redirect-recipient" value={input} spellCheck={false} autoComplete="off" placeholder={kind==='wallet'?'Recipient’s Solana address':kind==='x'?'@username':'github.com/username'} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void check();}}}/><button type="button" className="secondary" disabled={busy||!input.trim()} onClick={()=>void check()}>{busy?'Checking…':wallet.address?'Check recipient':'Connect wallet'}</button></div>
    {error&&<p role="alert" className="redirect-error">{error}</p>}
    {value&&<div className="redirect-checked" role="status"><Check size={18}/><span><strong>{recipientLabel(value)}</strong><small>{value.kind==='wallet'?'Wallet address checked':'Account found · ownership required to claim'}</small></span>{value.profileUrl&&<a href={value.profileUrl} target="_blank" rel="noreferrer">View profile ↗</a>}</div>}
    <div className="redirect-split"><div><strong>50%</strong><span>To {value?recipientLabel(value):'your recipient'}</span></div><div><strong>50%</strong><span>To holders</span></div></div>
    <p>The remaining reward pool is split equally after operating costs, Ripple and community funding. The recipient and split are fixed at launch.</p>
    <p>{kind==='wallet'?'The recipient connects this wallet to claim. They do not need to hold the coin.':'Rewards wait for the account owner to sign in and activate a payout wallet. Holders keep earning while the recipient is unclaimed.'}</p>
  </section>;
}
