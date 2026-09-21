import { useEffect,useState } from "react";
import { api, API_URL } from "./api";
import type { MarketPrice } from "./market-prices";

export function useMarketPrices() {
  const [prices,setPrices]=useState<Map<string,MarketPrice>>(new Map());
  useEffect(()=>{
    let active=true,inFlight=false,lastEvent=0;
    let stream:EventSource|undefined;
    let controller:AbortController|undefined;
    const refresh=async()=>{
      if(inFlight || document.visibilityState!=="visible" || Date.now()-lastEvent<10_000) return;
      inFlight=true;controller=new AbortController();
      const timeout=window.setTimeout(()=>controller?.abort(),8000);
      try {
        const data=await api.marketPrices(controller.signal);
        if(active) setPrices(new Map(data.prices.map(price=>[price.id,price])));
      } catch {
        if(active) setPrices(previous=>new Map([...previous].map(([id,price])=>[id,{...price,priceStatus:"delayed"}])));
      } finally {window.clearTimeout(timeout);inFlight=false;}
    };
    const visible=()=>{
      if(document.visibilityState!=="visible"){stream?.close();stream=undefined;lastEvent=0;return;}
      if(!stream&&typeof EventSource!=="undefined"){
        stream=new EventSource(`${API_URL}/api/market-prices/stream`);
        stream.onmessage=event=>{try{
          const data=JSON.parse(event.data) as {prices:MarketPrice[]};
          if(active&&Array.isArray(data.prices)){setPrices(new Map(data.prices.map(price=>[price.id,price])));lastEvent=Date.now();}
        }catch{lastEvent=0;}};
        stream.onerror=()=>{lastEvent=0;void refresh();};
        stream.addEventListener("heartbeat",()=>{lastEvent=Date.now();});
        stream.addEventListener("unavailable",()=>{lastEvent=0;void refresh();});
      }
      void refresh();
    };
    visible();
    const timer=window.setInterval(()=>void refresh(),5000);
    document.addEventListener("visibilitychange",visible);
    return()=>{active=false;stream?.close();controller?.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[]);
  return prices;
}
