import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialog } from './useDialog';
import './animated-panel.css';

export function AnimatedPanel({open,onClose,title,description,children,className=''}:{open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;className?:string}) {
  const [mounted,setMounted]=useState(open);
  useEffect(()=>{
    if(open){setMounted(true);return;}
    const timer=setTimeout(()=>setMounted(false),220);
    return()=>clearTimeout(timer);
  },[open]);
  const dialog=useDialog(mounted,onClose);
  if(!mounted)return null;
  return createPortal(<div className={`aqua-panel-overlay ${open?'is-open':'is-closing'}`} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialog} className={`aqua-panel ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="aqua-panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="aqua-panel-close" aria-label={`Close ${title}`} onClick={onClose}><X size={20}/></button></header>
      {children}
    </section>
  </div>,document.body);
}
