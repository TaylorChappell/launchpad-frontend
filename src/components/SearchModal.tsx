import { ArrowUpRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenMark } from "./TokenCard";
import { useDialog } from "./useDialog";
const money=new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1});
export function SearchModal({open,onClose}:{open:boolean;onClose:()=>void}){
  const navigate=useNavigate(),input=useRef<HTMLInputElement>(null),dialog=useDialog(open,onClose);
  const [query,setQuery]=useState(""),[results,setResults]=useState<Launch[]>([]),[state,setState]=useState<"loading"|"ready"|"offline">("loading"),[active,setActive]=useState(0);
  useEffect(()=>{if(open){setQuery("");setActive(0);setResults([]);input.current?.focus();}},[open]);
  useEffect(()=>{
    if(!open)return;const controller=new AbortController();setState("loading");setActive(0);
    const timer=window.setTimeout(()=>{api.search(query,controller.signal).then(d=>{if(!controller.signal.aborted){setResults(d.launches.filter(l=>l.status==="live").slice(0,8));setState("ready");}}).catch(()=>{if(!controller.signal.aborted)setState("offline");});},query?200:0);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[open,query]);
  function select(launch:Launch){onClose();navigate("/token/"+launch.id);}
  if(!open)return null;
  return <div className="aqua-search-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialog} className="market-search-palette" role="dialog" aria-modal="true" aria-label="Search AQUA">
      <div className="palette-input"><Search size={20}/><input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={state==="ready"&&results.length>0} aria-controls="market-search-results" aria-activedescendant={state==="ready"&&results[active]?"market-result-"+results[active].id:undefined} aria-label="Search AQUA markets" placeholder="Search a coin, ticker or address…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{
        if(state!=="ready"||!results.length)return;
        if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();const next=(active+(e.key==="ArrowDown"?1:-1)+results.length)%results.length;setActive(next);document.getElementById("market-result-"+results[next].id)?.scrollIntoView({block:"nearest"});}
        if(e.key==="Enter"){e.preventDefault();if(results[active])select(results[active]);}
      }}/><button onClick={onClose} aria-label="Close search"><X size={17}/></button></div>
      <div className="palette-label"><span>{query.trim()?"SEARCH RESULTS":"POPULAR MARKETS"}</span><span>MARKET CAP</span></div>
      <div id="market-search-results" className="palette-results" role="listbox" aria-label="Markets" aria-busy={state==="loading"}>
        {state==="loading"&&<div className="workspace-loading" role="status">Searching markets…</div>}
        {state==="offline"&&<div className="workspace-empty"><Search/><h3>Search is temporarily unavailable.</h3><p>Try again in a moment.</p></div>}
        {state==="ready"&&results.map((l,i)=><button id={"market-result-"+l.id} role="option" aria-selected={i===active} className="palette-result" key={l.id} onMouseEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onClick={()=>select(l)}><TokenMark launch={l}/><span className="palette-identity"><b>{l.name}</b><small>{l.symbol} <i/> {l.rewardMode==="buyback_burn"?"Buyback & burn":l.rewardMode==="jackpot"?"Jackpot":l.stockSymbol+" rewards"}</small></span><span className="palette-value"><b>{l.aquaIndexed?money.format(l.marketCapUsd):"Indexing"}</b><small>{l.pairSymbol} pair</small></span><ArrowUpRight size={15}/></button>)}
        {state==="ready"&&!results.length&&<div className="workspace-empty"><Search/><h3>No markets found.</h3><p>Try another name, ticker or token address.</p></div>}
      </div><footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>↵</kbd> Open</span><span><kbd>esc</kbd> Close</span></footer>
    </section>
  </div>;
}
