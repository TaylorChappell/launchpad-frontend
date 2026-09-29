import { useEffect, useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { loadCandleHistory } from "../candle-history";
import { candlePrice, chartCandles, withLiveCandle, type CandleHistory, type ChartCandle, type ChartRange } from "../market-candles";
import { isPriceLive } from "../market-prices";
import type { Launch } from "../types";
import { CandleChart } from "./CandleChart";

export function MarketCapCandles({ launch }: { launch: Launch }) {
  const [range,setRange]=useState<ChartRange>("24h");
  const [metric,setMetric]=useState<"cap"|"price">("cap");
  const [loaded,setLoaded]=useState<{range:ChartRange;history:CandleHistory} | null>(null);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  const [reset,setReset]=useState(0);
  const [inspected,setInspected]=useState<ChartCandle | null>(null);
  useEffect(()=>{
    let active=true,pending=false;
    setError(false);
    const refresh=async()=>{
      if(pending)return;pending=true;
      try{const history=await loadCandleHistory(launch.id,range);if(active){setLoaded({range,history});setError(false);}}
      catch{if(active)setError(true);}
      finally{pending=false;}
    };
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[launch.id,range,retry]);
  const candles=useMemo(()=>{
    if(!loaded)return [];
    const live=isPriceLive(launch)?{sampledAt:launch.priceUpdatedAt!,priceUsd:launch.priceUsd,marketCapUsd:launch.marketCapUsd}:undefined;
    return chartCandles(withLiveCandle(loaded.history,live),metric);
  },[loaded,metric,launch.priceUpdatedAt,launch.priceStatus,launch.priceUsd,launch.marketCapUsd]);
  useEffect(()=>setInspected(null),[range,metric]);
  const current=inspected??candles.at(-1);
  const loading=loaded?.range!==range&&!error;
  const interval=loaded?.history.intervalSeconds??900;
  const intervalLabel=interval>=86400?`${interval/86400}d`:interval>=3600?`${interval/3600}h`:`${interval/60}m`;
  return <div className="market-cap-line interactive-market-chart candle-market" aria-busy={loading}>
    <div className="chart-controls"><div aria-label="Chart timeframe">{(["1h","24h","7d","all"] as const).map(value=><button key={value} aria-pressed={range===value} onClick={()=>setRange(value)}>{value==="all"?"All time":value.toUpperCase()}</button>)}</div>
      <div aria-label="Chart value"><button aria-pressed={metric==="cap"} onClick={()=>setMetric("cap")}>Market cap</button><button aria-pressed={metric==="price"} onClick={()=>setMetric("price")}>Price</button></div></div>
    <div className="candle-legend"><span>USD · {intervalLabel} candles</span><span className="candle-ohlc">{current&&(["open","high","low","close"] as const).map(field=><span key={field}>{field[0].toUpperCase()} <b>{candlePrice(current[field])}</b></span>)}</span>
      <button title="USD candles use indexed pool-price samples. They can miss price moves between samples; gaps have no indexed data." aria-label="About chart data"><Info size={14}/></button>
      <button title="Reset chart view" aria-label="Reset chart view" onClick={()=>setReset(n=>n+1)}><RotateCcw size={14}/></button></div>
    <div className="chart-canvas candle-stage">
      <CandleChart candles={candles} viewKey={`${launch.id}:${loaded?.range}:${metric}:${reset}`} onInspect={setInspected}/>
      {loading&&<div className="candle-overlay" role="status">Loading chart…</div>}
      {!loading&&!candles.length&&!error&&<div className="candle-overlay">Waiting for indexed price history.</div>}
      {error&&<div className={`candle-overlay ${candles.length?"candle-delayed":""}`} role="status">{candles.length?"Chart updates delayed.":"Couldn't load chart."}<button onClick={()=>{setError(false);setRetry(n=>n+1);}}>Retry</button></div>}
    </div>
  </div>;
}
