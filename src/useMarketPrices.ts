import { useEffect,useState } from "react";
import { api } from "./api";
import type { MarketPrice } from "./market-prices";

export function useMarketPrices() {
  const [prices,setPrices]=useState<Map<string,MarketPrice>>(new Map());
  useEffect(()=>{
    let active=true,inFlight=false;
    let controller:AbortController|undefined;
    const refresh=async()=>{
      if(inFlight || document.visibilityState!=="visible") return;
      inFlight=true;controller=new AbortController();
      const timeout=window.setTimeout(()=>controller?.abort(),8000);
      try {
        const data=await api.marketPrices(controller.signal);
        if(active) setPrices(new Map(data.prices.map(price=>[price.id,price])));
      } catch {
        if(active) setPrices(previous=>new Map([...previous].map(([id,price])=>[id,{...price,priceStatus:"delayed"}])));
      } finally {window.clearTimeout(timeout);inFlight=false;}
    };
    const visible=()=>void refresh();
    void refresh();
    const timer=window.setInterval(visible,5000);
    document.addEventListener("visibilitychange",visible);
    return()=>{active=false;controller?.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[]);
  return prices;
}
