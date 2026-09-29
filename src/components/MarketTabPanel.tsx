import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function RetainedMarketPanel({active,children}:{active:boolean;children:ReactNode}){
  const [visited,setVisited]=useState(active);
  useEffect(()=>{if(active)setVisited(true);},[active]);
  return <div hidden={!active}>{(active||visited)&&children}</div>;
}

/** Animate the measured panel, including async content, without removing its space. */
export function MarketTabPanel({section,children}:{section:string;children:ReactNode}){
  const shell=useRef<HTMLElement>(null),content=useRef<HTMLDivElement>(null);
  const previous=useRef(section);
  useLayoutEffect(()=>{
    const outer=shell.current,inner=content.current;if(!outer||!inner)return;
    const size=()=>{const height=inner.getBoundingClientRect().height;if(Math.abs(parseFloat(outer.style.height||"0")-height)>.5)outer.style.height=`${height}px`;};
    size();const observer=new ResizeObserver(size);observer.observe(inner);
    return()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{
    if(previous.current===section)return;previous.current=section;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const animation=content.current?.animate([{opacity:.45},{opacity:1}],{duration:220,easing:'ease-out'});
    return()=>animation?.cancel();
  },[section]);
  return <section ref={shell} id="market-information" className="market-information smooth-market-panel" role="tabpanel" aria-labelledby={"market-tab-"+section.toLowerCase()} tabIndex={0}>
    <div className="market-panel-content" ref={content}>{children}</div>
  </section>;
}
