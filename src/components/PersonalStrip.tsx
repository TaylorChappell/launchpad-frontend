import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useWallet } from "../context";
import { api } from "../api";
export function PersonalStrip(){
 const {address}=useWallet(),[claims,setClaims]=useState(0);
 useEffect(()=>{let active=true,pending=false;setClaims(0);if(!address)return;
 const load=async()=>{if(pending)return;pending=true;try{const r=await api.rewards(address);if(active)setClaims(r.markets.filter(m=>m.canClaim).reduce((sum,m)=>sum+m.claimableUsdCents,0));}catch{if(active)setClaims(0);}finally{pending=false;}};
 void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},30_000);return()=>{active=false;window.clearInterval(timer);};},[address]);
 if(!address||claims<=0)return null;
 return <aside className="personal-strip unclaimed-strip"><img src={import.meta.env.BASE_URL+"aqua-gift.webp"} alt=""/><div><span>Unclaimed rewards</span><strong>{new Intl.NumberFormat("en",{style:"currency",currency:"USD"}).format(claims/100)}</strong></div><Link to="/portfolio?tab=rewards">Claim here <ArrowRight size={14}/></Link></aside>;
}
