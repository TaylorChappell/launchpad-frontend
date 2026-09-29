import type { CandleInterval, CandlePage } from "./market-candles";

// Keep only the latest page for a small set of recently viewed charts. These
// previews never replace the background request for authoritative candle data.
const previews=new Map<string,{history:CandlePage;savedAt:number}>();
const maxEntries=24,maxAgeMs=5*60_000;
const key=(id:string,interval:CandleInterval)=>JSON.stringify([id,interval]);

export function readCandlePreview(id:string,interval:CandleInterval,now=Date.now()):CandlePage|null {
  const idKey=key(id,interval),entry=previews.get(idKey);
  if(!entry)return null;
  if(now-entry.savedAt>=maxAgeMs){previews.delete(idKey);return null;}
  previews.delete(idKey);previews.set(idKey,entry);
  return entry.history;
}

export function rememberCandlePreview(id:string,interval:CandleInterval,history:CandlePage,now=Date.now()) {
  const idKey=key(id,interval);
  previews.delete(idKey);previews.set(idKey,{history,savedAt:now});
  while(previews.size>maxEntries)previews.delete(previews.keys().next().value!);
}
