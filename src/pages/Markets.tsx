import { useEffect, useRef, useState } from "react";
import { ArrowRight, Grid2X2, List, RefreshCw, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenCard, TokenMark } from "../components/TokenCard";
import { PersonalStrip } from "../components/PersonalStrip";
import { useMarketPrices } from "../useMarketPrices";
import { mergeMarketPrice, isPriceLive } from "../market-prices";
import { useWatchlist } from "../useWatchlist";
import { launchAge } from "../time";

const compact=new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2});
const modes=[["all","All reward modes"],["holder_rewards","Holder rewards"],["buyback_burn","Buyback & burn"],["jackpot","Jackpot"]];
const sorts=[["trending","Trending"],["recent","New"],["volume","Top volume"],["watchlist","Watchlist"]];
export function Markets(){
  const [params,setParams]=useSearchParams(),watch=useWatchlist(),prices=useMarketPrices();
  const sort=sorts.some(([value])=>value===params.get("sort"))?params.get("sort")!:"trending";
  const pair=["SOL","ORCA","STOCK"].includes(params.get("pair")??"")?params.get("pair")!:"all";
  const mode=modes.some(([value])=>value===params.get("mode"))?params.get("mode")!:"all";
  const view=params.get("view")==="cards"?"cards":"table", q=params.get("q")??"";
  const [launches,setLaunches]=useState<Launch[]>([]),[state,setState]=useState("loading"),[more,setMore]=useState(false),[offset,setOffset]=useState(0),[version,setVersion]=useState(0),[loadingMore,setLoadingMore]=useState(false);
  const [boosted,setBoosted]=useState<string|null>(null),[aqua,setAqua]=useState<string|null>(null);
  const watchKey=sort==="watchlist"?watch.ids.join(","):"";
  const query={sort:sort==="watchlist"?"volume":sort,pair,mode,q,limit:24,...(sort==="watchlist"?{ids:watchKey}:{})};
  const queryKey=JSON.stringify(query);
  const requestGeneration=useRef(0);
  function update(key:string,value:string){const next=new URLSearchParams(params);next.set(key,value);setParams(next,{replace:true});}
  useEffect(()=>{let active=true;api.governance().then(g=>{if(active&&g.enabled){setBoosted(g.activeBonus?.mint??null);setAqua(g.governanceMint);}}).catch(()=>{});return()=>{active=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();requestGeneration.current++;setLoadingMore(false);setState("loading");setLaunches([]);setMore(false);
    const timer=window.setTimeout(()=>{api.launches(JSON.parse(queryKey),controller.signal).then(data=>{if(!controller.signal.aborted){setLaunches(data.launches);setMore(data.hasMore);setOffset(data.nextOffset);setState("ready");}}).catch(()=>{if(!controller.signal.aborted)setState("offline");});},q?200:0);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[queryKey,version]);
  async function loadMore(){const generation=requestGeneration.current;setLoadingMore(true);try{const data=await api.launches({...query,offset});if(generation!==requestGeneration.current)return;setLaunches(current=>[...new Map([...current,...data.launches].map(x=>[x.id,x])).values()]);setMore(data.hasMore);setOffset(data.nextOffset);}catch{if(generation===requestGeneration.current)setState("offline");}finally{if(generation===requestGeneration.current)setLoadingMore(false);}}
  const shown=launches.map(l=>mergeMarketPrice(l,prices.get(l.id)));
  const star=(launch:Launch)=><button className="watch-button" aria-label={(watch.ids.includes(launch.id)?"Remove ":"Watch ")+launch.symbol} aria-pressed={watch.ids.includes(launch.id)} onClick={()=>watch.toggle(launch.id)}><Star size={17} fill={watch.ids.includes(launch.id)?"currentColor":"none"}/></button>;
  return <main className="explore-page">
    <section className="explore-intro"><div><h1>Find your next community.</h1><p>Direct Orca markets. Permanent liquidity locks. Rewards built around holders.</p></div><Link className="primary" to="/create">Launch a coin <ArrowRight size={16}/></Link></section>
    <PersonalStrip/>
    <section className="market-workspace" id="markets">
      <header className="workspace-heading"><div><h2>Explore markets</h2><p>Prices refresh automatically. Refresh the list to update rankings.</p></div><button className="soft-button" aria-label="Refresh market rankings" onClick={()=>setVersion(v=>v+1)}><RefreshCw size={16}/></button></header>
      <div className="market-toolbar"><div className="segmented" aria-label="Market sorting">{sorts.map(([value,label])=><button key={value} aria-pressed={sort===value} onClick={()=>update("sort",value)}>{label}</button>)}</div><input aria-label="Search all markets" placeholder="Search name, ticker or address" value={q} onChange={e=>update("q",e.target.value)}/></div>
      <div className="market-toolbar"><label>Pair<select value={pair} onChange={e=>update("pair",e.target.value)}><option value="all">All pairs</option><option>SOL</option><option>ORCA</option><option value="STOCK">xStocks</option></select></label><label>Rewards<select value={mode} onChange={e=>update("mode",e.target.value)}>{modes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="segmented market-view-switch"><button aria-label="Table view" aria-pressed={view==="table"} onClick={()=>update("view","table")}><List size={17}/></button><button aria-label="Card view" aria-pressed={view==="cards"} onClick={()=>update("view","cards")}><Grid2X2 size={17}/></button></div></div>
      {state==="loading"?<div className="market-skeletons">{[0,1,2].map(x=><div key={x}/>)}</div>:view==="cards"?<div className="token-grid">{shown.map(launch=><div className="watch-card" key={launch.id}>{star(launch)}<TokenCard launch={launch} featured={launch.mint===aqua} boosted={launch.mint===boosted}/></div>)}</div>:<div className="table-scroll"><table className="market-table"><thead><tr><th>Market / age</th><th>Market cap</th><th>24h change</th><th>24h volume</th><th>Liquidity</th><th>Holders</th><th>Reward mode</th><th><span className="sr-only">Watchlist</span></th></tr></thead><tbody>{shown.map(launch=><tr key={launch.id}><td><Link className="market-identity" to={"/token/"+launch.id}><TokenMark launch={launch}/><span><b>{launch.name}</b><small>{launch.symbol} · {launch.pairSymbol} · {launchAge(launch.launchedAt,launch.createdAt)}</small><span className="market-tags">{launch.mint===aqua&&<span className="market-tag">AQUA featured</span>}{launch.mint===boosted&&<span className="market-tag">Community boost</span>}{launch.dexPaid&&<span className="market-tag" title="Profile payment, not an endorsement">DEX profile paid</span>}</span></span></Link></td><td className="market-cap-value">{compact.format(launch.marketCapUsd)}{!isPriceLive(launch)&&<small className="status-inline">Price delayed</small>}</td><td>{Number(launch.change24h).toFixed(2)}%</td><td>{compact.format(launch.volume24hUsd)}</td><td>{compact.format(launch.tvlUsd)}</td><td>{launch.holderCount.toLocaleString()}</td><td>{modes.find(([value])=>value===launch.rewardMode)?.[1]}</td><td>{star(launch)}</td></tr>)}</tbody></table></div>}
      {state==="offline"&&<p role="alert">Market data could not refresh. <button className="soft-button" onClick={()=>setVersion(v=>v+1)}>Try again</button></p>}
      {state==="ready"&&!shown.length&&<div className="empty-state"><h3>{sort==="watchlist"?"Your watchlist is empty":"No matching markets"}</h3><p>{sort==="watchlist"?"Tap a star to save a market on this device.":"Try another name, reward mode or pair."}</p></div>}
      {more&&<button className="markets-load-more" disabled={loadingMore} onClick={()=>void loadMore()}>{loadingMore?"Loading…":"Load more markets"}</button>}
    </section>
  </main>;
}
