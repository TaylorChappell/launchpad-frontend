import { AutoRewardsActivity } from "../components/AutoRewardsActivity";
import { AnalyticsChart } from "../components/AnalyticsChart";
import { RefreshButton } from "../components/RefreshButton";
import { ANALYTICS_REFRESH_MS } from "../analytics-cache";
import { analyticsSnapshots, analyticsPeriodLabel, loadAnalytics, preloadAnalytics, type AnalyticsRange } from "../analytics-data";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDownUp, ArrowUpRight, ChartNoAxesCombined, Coins, Gift, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useRuntime } from "../context";
import { SolAmount } from "../components/SolAmount";
import { displayTokenAmount } from "../trade-quote";
import { buybackAge } from "../time";
import type { AnalyticsResponse } from "../types";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD",maximumFractionDigits:2});
const compact=new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:2});
const compactUsd=new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2});
const sol=new Intl.NumberFormat("en",{maximumFractionDigits:4});
export function Analytics(){
  const {config}=useRuntime(),[data,setData]=useState<AnalyticsResponse|null>(()=>analyticsSnapshots.read("all")),[offline,setOffline]=useState(false);
  const [chosenMetric,setMetric]=useState<"rewards"|"buybacks"|null>(null),[visible,setVisible]=useState(8),[revision,setRevision]=useState(0);
  const [range,setRange]=useState<AnalyticsRange>("all");
  const [displayedRange,setDisplayedRange]=useState(range);
  const [refreshing,setRefreshing]=useState(false);
  const refreshRevision=useRef(revision);
  const periodLabel=analyticsPeriodLabel(displayedRange);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    let active=true;
    const force=refreshRevision.current!==revision;refreshRevision.current=revision;
    const cached=analyticsSnapshots.read(range);
    const show=(value:AnalyticsResponse)=>{setData(value);setDisplayedRange(range);setMetric(current=>current??(value.rewardHistory.length?"rewards":"buybacks"));setOffline(false);};
    if(cached)show(cached);
    setRefreshing(!cached||force);setOffline(false);
    const load=async(refresh=false)=>{
      try{const value=await loadAnalytics(range,refresh);if(active){show(value);void preloadAnalytics();}}
      catch{if(active)setOffline(true);}
      finally{if(active)setRefreshing(false);}
    };
    void load(force);
    const timer=window.setInterval(()=>{if(!document.hidden)void load(true);},ANALYTICS_REFRESH_MS);
    // Shared requests finish into the cache even if another period is selected.
    return()=>{active=false;window.clearInterval(timer);};
  },[revision,range]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(!document.hidden)setNow(Date.now());},30_000);return()=>window.clearInterval(timer);},[]);
  const metric=chosenMetric??(data?.rewardHistory.length?"rewards":"buybacks");
  function selectRange(next:AnalyticsRange){
    if(next===range)return;
    const cached=analyticsSnapshots.read(next);
    if(cached){setData(cached);setDisplayedRange(next);setOffline(false);}
    setRange(next);
  }
  return <main className="page holder-workspace analytics-workspace">
    <header className="workspace-heading"><div><h1>Analytics</h1></div><div className="analytics-controls"><div className="analytics-range" style={{"--range-index":["24h","7d","30d","all"].indexOf(range)} as CSSProperties} role="group" aria-label="Analytics period">{([["24h","24 hours"],["7d","7 days"],["30d","30 days"],["all","All time"]] as const).map(([value,label])=><button key={value} aria-pressed={range===value} onClick={()=>selectRange(value)}>{label}</button>)}</div><RefreshButton className="workspace-refresh" aria-label="Refresh analytics" disabled={refreshing} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></RefreshButton></div></header>
    {offline&&<p className="danger-note" role="alert">Analytics could not refresh. {data?"Showing the last received data.":""} <button className="text-button" onClick={()=>setRevision(n=>n+1)}>Try again</button></p>}
    {!data?<div className="workspace-loading">{offline?"Analytics unavailable":"Loading AQUA activity…"}</div>:<>
      <section className="network-metrics" aria-busy={refreshing}>
        <article className="network-metric-featured"><span><Gift size={19}/> Holder rewards</span><strong>{usd.format(data.totals.rewardsAccumulatedUsd)}</strong><small>{periodLabel}</small></article>
        <article><span><Coins size={18}/> AQUA buybacks</span><strong><SolAmount value={sol.format(data.totals.buybackSol)}/></strong><small>Verified purchases on-chain</small></article>
        <article><span><ArrowDownUp size={18}/> Trading volume</span><strong>{compactUsd.format((data.totals.volumeUsd??data.totals.volume24hUsd))}</strong><small>Across AQUA markets</small></article>
        <article><span><ChartNoAxesCombined size={18}/> Coins launched</span><strong>{data.totals.liveMarkets.toLocaleString()}</strong><small>{displayedRange==="all"?"On AQUA":periodLabel}</small></article>
        <article><span><Coins size={18}/> AQUA DEX funded</span><strong>{data.totals.dexFundedMarkets?.toLocaleString() ?? "—"}</strong><small>Coins with profiles paid through AQUA</small></article>
      </section>
      <div className="analytics-focus-grid">
        <AnalyticsChart data={data} metric={metric} range={displayedRange} onMetricChange={setMetric}/>
        <section className="workspace-panel recent-buybacks"><header><div><small className="workspace-eyebrow">ON-CHAIN ACTIVITY</small><h2>Latest buybacks</h2></div><Coins size={21}/></header>
          {data.recentBuybacks.length?<div className="buyback-receipts">{data.recentBuybacks.slice(0,5).map(b=><article key={b.signature??b.createdAt}><span className="buyback-receipt-icon"><ArrowDownUp size={17}/></span><div><b>{compact.format(b.amountTokens)} AQUA</b><small><time title={new Date(b.createdAt).toLocaleString()}>{buybackAge(b.createdAt,now)}</time> · <SolAmount value={sol.format(b.amountSol)}/></small></div>{b.signature&&<a aria-label={"View buyback transaction "+b.signature} href={"https://solscan.io/tx/"+b.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer"><ArrowUpRight size={17}/></a>}</article>)}</div>:<div className="workspace-empty"><Coins/><h3>No buybacks in this period.</h3><p>Completed AQUA purchases appear here.</p></div>}
        </section>
      </div>
      <section className="workspace-panel"><header><div><h2>Market activity</h2><span>Leading markets in this period</span></div><Link to="/">Explore all <ArrowUpRight size={14}/></Link></header><div className="table-scroll"><table className="market-table analytics-market-table"><thead><tr><th>Market</th><th>Trading volume</th><th>Holder rewards</th><th>Buyback funding · SOL</th></tr></thead><tbody>{data.markets.slice(0,visible).map((m,i)=><tr key={m.id}><td><Link className="analytics-market-name" to={"/token/"+m.id}><span>{String(i+1).padStart(2,"0")}</span><div><b>{m.name}</b><small>{m.symbol}</small></div></Link></td><td className="market-cap-value">{compactUsd.format(m.volumeUsd??0)}</td><td>{usd.format(m.rewardsAccumulatedUsd)}</td><td><SolAmount value={sol.format(m.buybackSol)}/></td></tr>)}</tbody></table></div>{!data.markets.length&&<div className="workspace-empty"><h3>No live market activity yet.</h3></div>}{visible<data.markets.length&&<button className="workspace-load-more" onClick={()=>setVisible(n=>n+8)}>Show more markets</button>}</section>
      <AutoRewardsActivity range={displayedRange}/>
      <details className="workspace-disclosure"><summary>Claimed assets &amp; data details</summary><div>
        {data.claimedAssets.length?<div className="table-scroll"><table className="market-table"><thead><tr><th>Claimed asset</th><th>Amount</th><th>Receipts</th></tr></thead><tbody>{data.claimedAssets.map(a=><tr key={a.mint}><td>{a.symbol}</td><td>{displayTokenAmount(a.amountRaw,a.decimals)}</td><td>{a.receipts}</td></tr>)}</tbody></table></div>:<p>No claims recorded in this period.</p>}
        <p>Reward totals use their value when allocated. Buyback funding is assigned to buybacks; only verified purchases count as completed buybacks.</p>
        <p>Trading volume uses the latest pair reference prices.{Boolean(data.unpricedVolumeMarkets)&&` ${data.unpricedVolumeMarkets} markets could not be valued.`}</p><p>{data.stalePriceMarkets} market prices delayed. The market table includes up to {data.marketBreakdownLimit} markets; network totals include all markets. Charts show recorded activity, without filling missing days.</p>
      </div></details>
    </>}
  </main>;
}
