import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp, CandlestickData } from "lightweight-charts";
import { candlePrice, type ChartCandle } from "../market-candles";

export function CandleChart({ candles, viewKey, currency="USD", mini = false, onInspect, onReachStart }: {
  candles: ChartCandle[]; viewKey: string; currency?:string; mini?: boolean; onInspect?: (candle: ChartCandle | null) => void; onReachStart?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const inspect = useRef(onInspect); inspect.current = onInspect;
  const reachStart = useRef(onReachStart); reachStart.current=onReachStart;
  const userPanned=useRef(false);
  const previous = useRef<ChartCandle[]>([]);
  const fitted = useRef<string | null>(null);
  const [ready,setReady] = useState(false);
  const [failed,setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let instance: IChartApi | undefined;
    void import("lightweight-charts").then(({createChart,CandlestickSeries,ColorType,CrosshairMode}) => {
      if (disposed || !container.current) return;
      instance = createChart(container.current, {
        autoSize:true,
        layout:{background:{type:ColorType.Solid,color:mini?"transparent":"#ffffff"},textColor:"#527083",fontFamily:"Manrope, sans-serif",fontSize:11,attributionLogo:!mini},
        grid:{vertLines:{visible:false},horzLines:{visible:!mini,color:"#e9f1f6"}},
        rightPriceScale:{visible:!mini,borderVisible:false,minimumWidth:68,scaleMargins:{top:.14,bottom:.12}},
        leftPriceScale:{visible:false},
        timeScale:{visible:!mini,borderVisible:false,timeVisible:true,secondsVisible:false,rightOffset:mini?1:3,barSpacing:mini?5:8,minBarSpacing:2},
        crosshair:{mode:mini?CrosshairMode.Hidden:CrosshairMode.Normal,vertLine:{color:"#81a5b9",labelBackgroundColor:"#174c66"},horzLine:{color:"#81a5b9",labelBackgroundColor:"#174c66"}},
        handleScroll:mini?false:{mouseWheel:false,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
        handleScale:mini?false:{axisPressedMouseMove:true,axisDoubleClickReset:true,mouseWheel:true,pinch:true},
      });
      chart.current = instance;
      series.current = instance.addSeries(CandlestickSeries,{
        upColor:"#168fa8",downColor:"#df6679",wickUpColor:"#168fa8",wickDownColor:"#df6679",borderVisible:false,
        priceLineVisible:!mini,lastValueVisible:!mini,
      });
      if (!mini) instance.subscribeCrosshairMove(event => {
        const value = series.current && event.seriesData.get(series.current);
        inspect.current?.(value && "open" in value ? value as ChartCandle : null);
      });
      if(!mini) instance.timeScale().subscribeVisibleLogicalRangeChange(range=>{
        if(userPanned.current&&range&&range.from<10&&previous.current.length)reachStart.current?.();
      });
      previous.current=[]; fitted.current=null; setReady(true);
    }).catch(()=>{if(!disposed)setFailed(true);});
    return () => { disposed=true; instance?.remove(); chart.current=null; series.current=null; };
  },[mini]);
  useEffect(()=>{
    if (!ready || !series.current || !chart.current) return;
    const data = (mini?candles.slice(-32):candles) as CandlestickData<UTCTimestamp>[];
    const smallest = data.reduce((lowest,p)=>Math.min(lowest,p.low),Infinity);
    if (smallest>0 && Number.isFinite(smallest)) series.current.applyOptions({priceFormat:{type:"custom",formatter:(value:number)=>candlePrice(value,currency).replace(` ${currency}`,""),minMove:Math.pow(10,Math.max(-15,Math.floor(Math.log10(smallest))-4))}});
    const old=previous.current;
    const visible=chart.current.timeScale().getVisibleLogicalRange();
    const sameView=fitted.current===viewKey;
    const samePrefix=sameView && old.length>0 && data.length>=old.length && old.slice(0,-1).every((p,i)=>{
      const n=data[i];return n.time===p.time&&n.open===p.open&&n.high===p.high&&n.low===p.low&&n.close===p.close;
    }) && data[old.length-1]?.time===old.at(-1)?.time;
    if(samePrefix) for(const bar of data.slice(old.length-1)) series.current.update(bar);
    else series.current.setData(data);
    if (!sameView && data.length) {
      userPanned.current=false;
      if(mini)chart.current.timeScale().fitContent();
      else chart.current.timeScale().setVisibleLogicalRange({from:Math.max(-.5,data.length-100),to:data.length+3});
      fitted.current=viewKey;
    } else if(visible&&old.length&&data.length&&data[0].time<old[0].time) {
      const added=data.findIndex(p=>p.time===old[0].time);
      if(added>0)chart.current.timeScale().setVisibleLogicalRange({from:visible.from+added,to:visible.to+added});
    }
    previous.current=data;
  },[candles,viewKey,mini,ready,currency]);
  return <div className={`tradingview-canvas ${mini?"is-mini":""}`} ref={container} role="img"
    aria-label={mini?"24-hour price history":`${currency} trade candlestick chart`} data-bars={candles.length}
    onPointerDown={()=>{userPanned.current=true;}} onWheel={()=>{userPanned.current=true;}}>
    {failed && !mini && <span className="candle-overlay">Chart unavailable. Please refresh.</span>}
  </div>;
}
