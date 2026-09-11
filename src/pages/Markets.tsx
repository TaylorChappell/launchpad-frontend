import { useEffect, useMemo, useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import { api } from "../api";
import { DEMO } from "../fixtures";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";

export function Markets() {
  const [launches,setLaunches]=useState<Launch[]>(DEMO); const [query,setQuery]=useState(""); const [tab,setTab]=useState("all"); const [stock,setStock]=useState("all");
  useEffect(()=>{api.launches().then((data)=>{if(data.launches.length)setLaunches(data.launches)}).catch(()=>undefined)},[]);
  const filtered=useMemo(()=>launches.filter((item)=>(tab==="all"||item.status===tab)&&(stock==="all"||(stock==="stock"?Boolean(item.stockSymbol):!item.stockSymbol))&&[item.name,item.symbol,item.mint,item.stockSymbol].some((value)=>String(value??"").toLowerCase().includes(query.toLowerCase()))),[launches,query,tab,stock]);
  return <main className="page markets"><section className="market-top"><div><span className="eyebrow">SOLANA LAUNCH MARKETS</span><h1>Trade the curve. Own the upside.</h1><p>Tokens launch against virtual SOL and graduate into Orca liquidity. Reward-enabled markets route an extra 1% into tokenized stocks for holders.</p></div><div className="market-summary"><Metric label="24h volume" value="$1.42M"/><Metric label="Live markets" value={String(launches.length)}/><Metric label="Paid to holders" value="$601K"/></div></section><div className="ticker"><div><TrendingUp size={14}/><strong>NVDAx</strong><span>$176.42</span><em>+2.8%</em></div><div><strong>AAPLx</strong><span>$229.18</span><em>+1.1%</em></div><div><strong>TSLAx</strong><span>$421.07</span><em className="negative">-0.7%</em></div><div><strong>SPYx</strong><span>$687.33</span><em>+0.5%</em></div></div><section className="market-controls"><div className="tabs">{[["all","All"],["curve","Bonding"],["orca","Orca"]].map(([value,label])=><button className={tab===value?"active":""} onClick={()=>setTab(value)} key={value}>{label}</button>)}</div><div className="filters"><select value={stock} onChange={(e)=>setStock(e.target.value)}><option value="all">All pairs</option><option value="stock">Stock rewards</option><option value="sol">SOL only</option></select><label><Search size={15}/><input placeholder="Search token or mint" value={query} onChange={(e)=>setQuery(e.target.value)}/></label></div></section><div className="token-grid">{filtered.map((launch)=><TokenCard key={launch.id} launch={launch}/>)}</div>{!filtered.length&&<div className="empty">No markets match those filters.</div>}</main>;
}
function Metric({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
