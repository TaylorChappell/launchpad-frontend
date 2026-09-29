import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import { SolAmount } from "./SolAmount";
import { useReducedMotion } from "../useReducedMotion";
import { analyticsPeriodLabel, type AnalyticsRange } from "../analytics-data";
import type { AnalyticsResponse } from "../types";
const usd=new Intl.NumberFormat("en",{style:"currency",currency:"USD",maximumFractionDigits:2});
const compact=new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:2});
const compactUsd=new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2});
const sol=new Intl.NumberFormat("en",{maximumFractionDigits:4});
type Metric="rewards"|"buybacks";
type Point={time:number;value:number};
const prepared=new WeakMap<AnalyticsResponse,Record<Metric,Point[]>>();
function seriesFor(data:AnalyticsResponse){
  let series=prepared.get(data);
  if(!series){
    const ordered=(points:Point[])=>points.filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.value)).sort((a,b)=>a.time-b.time);
    series={rewards:ordered(data.rewardHistory.map(p=>({time:p.time,value:p.allocatedUsd}))),buybacks:ordered(data.buybackHistory.map(p=>({time:p.time,value:p.sol})))};
    prepared.set(data,series);
  }
  return series;
}
// Timestamp ticks, payout polling and table expansion do not redraw the chart.
export const AnalyticsChart=memo(function AnalyticsChart({data,metric,range:displayedRange,onMetricChange:setMetric}:{data:AnalyticsResponse;metric:Metric;range:AnalyticsRange;onMetricChange:(metric:Metric)=>void}){
  const reducedMotion=useReducedMotion(),periodLabel=analyticsPeriodLabel(displayedRange);
  const chartData=seriesFor(data)[metric];
  const chartTotal=useMemo(()=>chartData.reduce((sum,p)=>sum+p.value,0),[chartData]);
  return (<section className="workspace-panel allocation-chart"><header><div><small className="workspace-eyebrow">{periodLabel.toUpperCase()}</small><h2>{metric==="rewards"?"Holder rewards":"AQUA bought back"}</h2></div><div className="workspace-switch"><button aria-pressed={metric==="rewards"} onClick={()=>setMetric("rewards")}>Rewards</button><button aria-pressed={metric==="buybacks"} onClick={()=>setMetric("buybacks")}>Buybacks</button></div></header>
          <div className="allocation-chart-total">{metric==="rewards"?usd.format(chartTotal):<SolAmount value={sol.format(chartTotal)}/>}<span>{metric==="rewards"?"value at allocation":"spent on-chain"}</span></div>
          <div className="allocation-chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:20,left:0,bottom:0}} accessibilityLayer><CartesianGrid vertical={false} stroke="#d9e9f1"/><XAxis dataKey="time" tickFormatter={n=>displayedRange==="24h"?new Date(n).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):new Date(n).toLocaleDateString([], {month:"short",day:"numeric"})} tickLine={false} axisLine={false} minTickGap={35} tick={{fill:"#688797",fontSize:11}}/><YAxis tickLine={false} axisLine={false} tickFormatter={n=>metric==="rewards"?compactUsd.format(n):compact.format(n)} width={55} tick={{fill:"#688797",fontSize:11}}/><Tooltip labelFormatter={n=>new Date(Number(n)).toLocaleString([],displayedRange==="24h"?{hour:"2-digit",minute:"2-digit"}:{month:"short",day:"numeric"})} formatter={v=>[metric==="rewards"?usd.format(Number(v)):<SolAmount value={sol.format(Number(v))}/>,metric==="rewards"?"Rewards":"Spent"]} contentStyle={{borderRadius:10,border:"1px solid #b9d9e9",fontSize:12}}/><Bar dataKey="value" fill="#238ccc" radius={[4,4,0,0]} maxBarSize={30} isAnimationActive={!reducedMotion} animationDuration={180} animationEasing="ease-in-out"/></BarChart></ResponsiveContainer>{!chartData.length&&<div className="workspace-empty chart-empty"><ChartNoAxesCombined/><h3>No {metric==="rewards"?"rewards":"buybacks"} recorded in this period.</h3><p>Confirmed activity will appear here.</p></div>}</div>
        </section>);
});
