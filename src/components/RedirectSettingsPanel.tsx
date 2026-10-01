import { useEffect, useState } from 'react';
import { AnimatedPanel } from './AnimatedPanel';
import { RedirectRecipientPicker } from './RedirectRecipientPicker';
import type { RedirectKind, RedirectRecipient } from '../fee-redirect-api';

export function RedirectSettingsPanel({open,value,providers,onClose,onSave}:{open:boolean;value?:RedirectRecipient|null;providers?:Partial<Record<RedirectKind,boolean>>;onClose:()=>void;onSave:(value:RedirectRecipient)=>void}) {
  const [draft,setDraft]=useState<RedirectRecipient|null>(value??null);
  const [version,setVersion]=useState(0);
  useEffect(()=>{if(open){setDraft(value??null);setVersion(n=>n+1);}},[open]);
  return <AnimatedPanel open={open} onClose={onClose} title="Configure Fee Redirect" description="Choose who shares the rewards with your holders." className="redirect-settings-panel">
    <RedirectRecipientPicker key={version} value={draft} onChange={setDraft} providers={providers}/>
    <div className="aqua-panel-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={!draft} onClick={()=>{if(draft)onSave(draft);}}>Use Fee Redirect</button></div>
  </AnimatedPanel>;
}
