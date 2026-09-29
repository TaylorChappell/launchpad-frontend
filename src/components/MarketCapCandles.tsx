import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { loadCandlePage } from "../candle-history";
import { candlePrice, candleIntervals, usdTradeCandles, mergeCandleHistory, type CandlePage, type ChartCandle, type CandleInterval } from "../market-candles";
import type { Launch } from "../types";
import { CandleChart } from "./CandleChart";

export function MarketCapCandles({ launch }: { launch: Launch }) {
  const [interval,setInterval]=useState<CandleInterval>("5m");
  const [metric,setMetric]=useState<"cap"|"price">("cap");
  const [loaded,setLoaded]=useState<{interval:CandleInterval;history:CandlePage} | null>(null);
  const [error,setError]=useState("");
  const [olderError,setOlderError]=useState(false),[loadingOlder,setLoadingOlder]=useState(false);
  const [retry,setRetry]=useState(0),[reset,setReset]=useState(0);
  const [inspected,setInspected]=useState<ChartCandle | null>(null);
  const generation=useRef(0),olderPending=useRef<symbol|null>(null),retryOlderAt=useRef(0);
  useEffect(()=>{
    let active=true,pending=false;
    generation.current++;olderPending.current=null;retryOlderAt.current=0;setLoadingOlder(false);setOlderError(false);setError("");
    const refresh=async()=>{
      if(pending)return;pending=true;
      try{
        const history=await loadCandlePage(launch.id,interval);
        if(active){setLoaded(previous=>previous?.interval===interval && !(history.nextBefore!==null && history.nextBefore>(previous.history.candles.at(-1)?.time??0))
          ? {interval,history:{...history,...mergeCandleHistory(previous.history,history),nextBefore:previous.history.nextBefore}}
          : {interval,history});setError("");}
      }catch(e){if(active)setError(e instanceof Error?e.message:"Couldn't load chart.");}
      finally{pending=false;}
    };
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15_000);
    return()=>{active=false;generation.current++;window.clearInterval(timer);};
  },[launch.id,interval,retry]);
  const loadOlder=useCallback(async()=>{
    if(olderPending.current||Date.now()<retryOlderAt.current||loaded?.interval!==interval||loaded.history.nextBefore===null)return;
    const current=generation.current,token=Symbol();olderPending.current=token;setLoadingOlder(true);setOlderError(false);
    try{
      const page=await loadCandlePage(launch.id,interval,loaded.history.nextBefore);
      if(current===generation.current)setLoaded(previous=>previous?.interval===interval
        ? {interval,history:{...page,...mergeCandleHistory(previous.history,page),nextBefore:page.nextBefore}} : previous);
    }catch{if(current===generation.current){retryOlderAt.current=Date.now()+3000;setOlderError(true);}}
    finally{if(olderPending.current===token){olderPending.current=null;setLoadingOlder(false);}}
  },[loaded,interval,launch.id]);
  const candles=useMemo(()=>loaded?usdTradeCandles(loaded.history,metric,launch.pairPriceUsd):[],[loaded,metric,launch.pairPriceUsd]);
  const missingUsd=!!loaded&&loaded.history.currency!=="USD"&&!(Number.isFinite(launch.pairPriceUsd)&&Number(launch.pairPriceUsd)>0);
  const currency="USD";
  useEffect(()=>setInspected(null),[interval,metric,launch.pairPriceUsd]);
  const current=inspected??candles.at(-1);
  const loading=loaded?.interval!==interval&&!error;
  return <div className="market-cap-line interactive-market-chart candle-market" aria-busy={loading}>
    <div className="chart-controls"><div aria-label="Candle timeframe">{(Object.keys(candleIntervals) as CandleInterval[]).map(value=><button key={value} aria-pressed={interval===value} onClick={()=>setInterval(value)}>{value}</button>)}</div>
      <div aria-label="Chart value"><button aria-pressed={metric==="cap"} onClick={()=>setMetric("cap")}>Market cap</button><button aria-pressed={metric==="price"} onClick={()=>setMetric("price")}>Price</button></div></div>
    <div className="candle-legend"><span>{currency} · {loaded?.interval??interval} candles</span><span className="candle-ohlc">{current&&(["open","high","low","close"] as const).map(field=><span key={field}>{field[0].toUpperCase()} <b>{candlePrice(current[field],currency)}</b></span>)}</span>
      <button title="Candles represent indexed trades only. Dollar values use the latest available pair/USD rate, so historical USD values are estimates. Exchange-rate changes do not create candles. Pan left to load earlier trades automatically." aria-label="About chart data"><Info size={14}/></button>
      <button title="Reset chart view" aria-label="Reset chart view" onClick={()=>setReset(n=>n+1)}><RotateCcw size={14}/></button></div>
    <div className="chart-canvas candle-stage">
      <CandleChart candles={candles} currency={currency} viewKey={`${launch.id}:${loaded?.interval}:${metric}:${reset}`} onInspect={setInspected} onReachStart={loadOlder}/>
      {loading&&<div className={`candle-overlay ${candles.length?"candle-refreshing":""}`} role="status">Loading candles…</div>}
      {!loading&&!candles.length&&!error&&<div className="candle-overlay">{missingUsd&&loaded?.history.candles.length?"USD reference price is temporarily unavailable.":"No indexed trades yet."}</div>}
      {error&&<div className={`candle-overlay ${candles.length?"candle-delayed":""}`} role="status"><span>{error.includes("latest chart API")?"This timeframe needs the latest chart API.":candles.length?"Chart updates delayed.":"Couldn't load chart."}</span><button onClick={()=>{setError("");setRetry(n=>n+1);}}>Retry</button></div>}
      {!loading&&(loadingOlder||olderError)&&<span className="candle-history-status" role="status">{loadingOlder?"Loading earlier trades…":"Earlier trades unavailable. Pan left to retry."}</span>}
    </div>
  </div>;
}
