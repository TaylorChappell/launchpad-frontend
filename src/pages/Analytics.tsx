import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { ArrowDownUp, ArrowUpRight, ChartNoAxesCombined, Coins, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { useRuntime } from "../context";
import { api } from "../api";
import { displayTokenAmount } from "../trade-quote";
import type { AnalyticsResponse } from "../types";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD",maximumFractionDigits:2});
const compact=new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:2});
const compactUsd=new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2});
const sol=new Intl.NumberFormat("en",{maximumFractionDigits:4});
export function Analytics(){
  const {config}=useRuntime(),[data,setData]=useState<AnalyticsResponse|null>(null),[offline,setOffline]=useState(false);
  const [metric,setMetric]=useState<"rewards"|"buybacks">("rewards"),[visible,setVisible]=useState(8),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true,pending=false;const load=async()=>{if(pending)return;pending=true;try{const value=await api.analytics();if(active){setData(value);setOffline(false);}}catch{if(active)setOffline(true);}finally{pending=false;}};
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},15_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[revision]);
  const series=metric==="rewards"?data?.rewardHistory.map(p=>({time:p.time,value:p.allocatedUsd})):data?.buybackHistory.map(p=>({time:p.time,value:p.sol}));
  const chartData=(series??[]).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.value)).sort((a,b)=>a.time-b.time);
  const chartTotal=chartData.reduce((sum,p)=>sum+p.value,0);
  return <main className="page holder-workspace analytics-workspace">
    <header className="workspace-heading"><div><small className="workspace-eyebrow">THE AQUA NETWORK</small><h1>Activity that gives back.</h1><p>Markets, holder rewards and buybacks. All in one view.</p></div><span className={"workspace-live"+(offline?" delayed":"")}><i/>{offline?"Updates delayed":data?"Updated "+new Date(data.generatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"Loading…"}</span></header>
    {offline&&<p className="danger-note" role="alert">Analytics could not refresh. {data?"Showing the last received data.":""} <button className="text-button" onClick={()=>setRevision(n=>n+1)}>Try again</button></p>}
    {!data?<div className="workspace-loading">{offline?"Analytics unavailable":"Loading AQUA activity…"}</div>:<>
      <section className="network-metrics">
        <article className="network-metric-featured"><span><Gift size={19}/> Holder rewards allocated</span><strong>{usd.format(data.totals.rewardsAccumulatedUsd)}</strong><small>{usd.format(data.totals.rewardsRedeemableUsd)} funded &amp; unclaimed</small></article>
        <article><span><Coins size={18}/> AQUA buybacks</span><strong>{sol.format(data.totals.buybackSol)} <em>SOL</em></strong><small>Verified purchases on-chain</small></article>
        <article><span><ArrowDownUp size={18}/> 24h trading volume</span><strong>{compactUsd.format(data.totals.volume24hUsd)}</strong><small>Across AQUA markets</small></article>
        <article><span><ChartNoAxesCombined size={18}/> Live markets</span><strong>{data.totals.liveMarkets.toLocaleString()}</strong><small>{compactUsd.format(data.totals.totalMarketCapUsd)} combined market cap</small></article>
      </section>
      <div className="analytics-focus-grid">
        <section className="workspace-panel allocation-chart"><header><div><small className="workspace-eyebrow">LAST 30 DAYS</small><h2>{metric==="rewards"?"Rewards allocated":"AQUA bought back"}</h2></div><div className="workspace-switch"><button aria-pressed={metric==="rewards"} onClick={()=>setMetric("rewards")}>Rewards</button><button aria-pressed={metric==="buybacks"} onClick={()=>setMetric("buybacks")}>Buybacks</button></div></header>
          <div className="allocation-chart-total">{metric==="rewards"?usd.format(chartTotal):sol.format(chartTotal)+" SOL"}<span>{metric==="rewards"?"value at allocation":"spent on-chain"}</span></div>
          {chartData.length?<div className="allocation-chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:20,left:0,bottom:0}} accessibilityLayer><CartesianGrid vertical={false} stroke="#d9e9f1"/><XAxis dataKey="time" tickFormatter={n=>new Date(n).toLocaleDateString([], {month:"short",day:"numeric"})} tickLine={false} axisLine={false} minTickGap={35} tick={{fill:"#688797",fontSize:11}}/><YAxis tickLine={false} axisLine={false} tickFormatter={n=>metric==="rewards"?compactUsd.format(n):compact.format(n)} width={55} tick={{fill:"#688797",fontSize:11}}/><Tooltip labelFormatter={n=>new Date(Number(n)).toLocaleDateString()} formatter={v=>[metric==="rewards"?usd.format(Number(v)):sol.format(Number(v))+" SOL",metric==="rewards"?"Allocated":"Spent"]} contentStyle={{borderRadius:10,border:"1px solid #b9d9e9",fontSize:12}}/><Bar dataKey="value" fill="#238ccc" radius={[4,4,0,0]} maxBarSize={30} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>:<div className="workspace-empty chart-empty"><ChartNoAxesCombined/><h3>No {metric==="rewards"?"allocations":"buybacks"} recorded in this period.</h3><p>Confirmed activity will appear here.</p></div>}
        </section>
        <section className="workspace-panel recent-buybacks"><header><div><small className="workspace-eyebrow">ON-CHAIN ACTIVITY</small><h2>Latest buybacks</h2></div><Coins size={21}/></header>
          {data.recentBuybacks.length?<div className="buyback-receipts">{data.recentBuybacks.slice(0,5).map(b=><article key={b.signature??b.createdAt}><span className="buyback-receipt-icon"><ArrowDownUp size={17}/></span><div><b>{compact.format(b.amountTokens)} AQUA</b><small>{new Date(b.createdAt).toLocaleDateString([], {month:"short",day:"numeric"})} · {sol.format(b.amountSol)} SOL</small></div>{b.signature&&<a aria-label={"View buyback transaction "+b.signature} href={"https://solscan.io/tx/"+b.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer"><ArrowUpRight size={17}/></a>}</article>)}</div>:<div className="workspace-empty"><Coins/><h3>No verified buybacks yet.</h3><p>Completed AQUA purchases appear here.</p></div>}
        </section>
      </div>
      <section className="workspace-panel"><header><div><h2>Market activity</h2><span>Leading markets by market cap</span></div><Link to="/">Explore all <ArrowUpRight size={14}/></Link></header><div className="table-scroll"><table className="market-table analytics-market-table"><thead><tr><th>Market</th><th>Market cap</th><th>Rewards allocated</th><th>Funded &amp; unclaimed</th><th>Buyback funding</th></tr></thead><tbody>{data.markets.slice(0,visible).map((m,i)=><tr key={m.id}><td><Link className="analytics-market-name" to={"/token/"+m.id}><span>{String(i+1).padStart(2,"0")}</span><div><b>{m.name}</b><small>{m.symbol}</small></div></Link></td><td className="market-cap-value">{compactUsd.format(m.marketCapUsd)}</td><td>{usd.format(m.rewardsAccumulatedUsd)}</td><td>{usd.format(m.rewardsRedeemableUsd)}</td><td>{sol.format(m.buybackSol)} SOL</td></tr>)}</tbody></table></div>{!data.markets.length&&<div className="workspace-empty"><h3>No live market activity yet.</h3></div>}{visible<data.markets.length&&<button className="workspace-load-more" onClick={()=>setVisible(n=>n+8)}>Show more markets</button>}</section>
      <details className="workspace-disclosure"><summary>Claimed assets &amp; data details</summary><div>
        {data.claimedAssets.length?<div className="table-scroll"><table className="market-table"><thead><tr><th>Claimed asset</th><th>Amount</th><th>Receipts</th></tr></thead><tbody>{data.claimedAssets.map(a=><tr key={a.mint}><td>{a.symbol}</td><td>{displayTokenAmount(a.amountRaw,a.decimals)}</td><td>{a.receipts}</td></tr>)}</tbody></table></div>:<p>No confirmed claim receipts indexed yet.</p>}
        <p>Allocated rewards are valued when allocated. Funded &amp; unclaimed amounts are before each wallet’s eligibility and claim costs. Buyback funding is assigned to buybacks; only verified purchases count as completed buybacks.</p>
        <p>{data.stalePriceMarkets} market prices delayed. The market table includes up to {data.marketBreakdownLimit} markets; network totals include all markets. Charts show recorded activity, without filling missing days.</p>
      </div></details>
    </>}
  </main>;
}
