import { useId, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
export function TradeInfo({children}:{children:ReactNode}){
 const [hover,setHover]=useState(false),[pinned,setPinned]=useState(false),id=useId(),open=hover||pinned;
 const close=()=>{setHover(false);setPinned(false);};
 return <span className="trade-info" onPointerEnter={event=>{if(event.pointerType==="mouse")setHover(true);}} onPointerLeave={()=>setHover(false)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))close();}} onKeyDown={event=>{if(event.key==="Escape"&&open){event.stopPropagation();close();}}}>
  <button type="button" aria-label="Trade details" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setPinned(value=>!value)}><CircleHelp size={16}/></button>
  {open&&<span className="trade-info-panel" role="note" id={id}>{children}</span>}
 </span>;
}
