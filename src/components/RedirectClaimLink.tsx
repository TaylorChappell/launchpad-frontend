import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { redirectClaimUrl } from '../fee-redirect-api';

export function RedirectClaimLink({id}:{id:string}) {
  const [copied,setCopied]=useState(false),[fallback,setFallback]=useState(false);
  const url=redirectClaimUrl(id);
  async function copy(){
    try{await navigator.clipboard.writeText(url);setCopied(true);setFallback(false);}
    catch{setFallback(true);}
  }
  return <div className="redirect-share-link"><button className="secondary-button" onClick={()=>void copy()}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Claim link copied':'Copy claim link'}</button>
    {fallback&&<label>Copy this link<input aria-label="Recipient claim link" readOnly value={url} onFocus={e=>e.currentTarget.select()}/></label>}
  </div>;
}
