import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context";
import { api } from "../api";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD"});
export function PersonalStrip(){
  const {address}=useWallet();
  const [data,setData]=useState<{value:number;partial:boolean;claims:number}|null>(null);
  useEffect(()=>{
    let active=true,pending=false;setData(null);if(!address)return;
    const load=async()=>{if(pending)return;pending=true;try{const [positions,rewards]=await Promise.all([api.holdings(address),api.rewards(address)]);if(active)setData({value:positions.holdings.reduce((s,x)=>s+(x.valueUsd??0),0),partial:positions.holdings.some(x=>x.valueUsd===null),claims:rewards.markets.filter(m=>m.canClaim).reduce((s,m)=>s+m.netClaimableUsdCents/100,0)});}catch{if(active)setData(null);}finally{pending=false;}};
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},30_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[address]);
  if(!address)return null;
  return <aside className="personal-strip"><Link to="/portfolio">My holdings →</Link><span>Indexed value <b>{data?usd.format(data.value)+(data.partial?" + unpriced holdings":""):"Unavailable"}</b></span><Link to="/rewards">Claimable after costs <b>{data?usd.format(data.claims):"Unavailable"}</b></Link></aside>;
}
