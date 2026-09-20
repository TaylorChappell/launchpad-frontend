import { useEffect, useState } from "react";
import { API_URL } from "./api";
type Promotion={active:boolean;startsAt:number|null;endsAt:number|null;serverNow:number;allowanceUsd?:number};
export function usePromotion(){
  const [promotion,setPromotion]=useState<Promotion|null>(null),[offset,setOffset]=useState(0),[now,setNow]=useState(Date.now()),[error,setError]=useState("");
  useEffect(()=>{
    let active=true,pending=false;
    const load=async()=>{if(pending)return;pending=true;try{const r=await fetch(API_URL+"/studio/promotion",{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error("Promotion status unavailable");const p=await r.json() as Promotion;if(active){setPromotion(p);setOffset(p.serverNow-Date.now());setError("");}}catch{if(active)setError("Promotion status unavailable");}finally{pending=false;}};
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},60_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const remaining=promotion?.endsAt?Math.max(0,promotion.endsAt-(now+offset)):0;
  return {promotion,active:Boolean(promotion?.active&&remaining>0),remaining,error};
}
