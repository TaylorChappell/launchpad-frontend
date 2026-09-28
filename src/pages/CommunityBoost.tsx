import {useEffect,useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUpRight,Check,Clock3,Loader2,RefreshCw,Trophy,Waves,Zap} from 'lucide-react';
import {api,API_URL} from '../api';
import {useCommunityBoost} from '../useCommunityBoost';
import {toast} from 'sonner';
import type {GovernanceMarket,Launch} from '../types';
import './community-boost.css';

const compact=new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2});
function amount(raw:string,decimals:number){return compact.format(Number(BigInt(raw||'0'))/10**decimals);}
function countdown(end:number,now:number){const s=Math.max(0,end-now);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');}
function CoinArt({coin,url}:{coin:GovernanceMarket;url?:string}){
 const [failed,setFailed]=useState(false);const src=url||(coin.imageId?`${API_URL}/api/images/${encodeURIComponent(coin.imageId)}`:'');
 useEffect(()=>setFailed(false),[src]);
 return <span className="cb-coin-art" aria-hidden="true">{src&&!failed?<img src={src} alt="" onError={()=>setFailed(true)}/>:coin.symbol.slice(0,2)}</span>;
}

export function CommunityBoost(){
 const {data,error,busy,notice,now,vote,refresh,wallet}=useCommunityBoost();
 const [visible,setVisible]=useState(10);
 const [query,setQuery]=useState(""),[results,setResults]=useState<Launch[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState("");
 useEffect(()=>{const controller=new AbortController();setResults([]);setSearchError("");if(!query.trim()){setSearching(false);return;}setSearching(true);const timer=setTimeout(()=>{api.search(query,controller.signal).then(result=>{if(!controller.signal.aborted)setResults(result.launches.filter(coin=>coin.status==="live"&&(!data?.enabled||coin.mint!==data.governanceMint)));}).catch(()=>{if(!controller.signal.aborted)setSearchError("Search unavailable. Try again or open a market to vote.");}).finally(()=>{if(!controller.signal.aborted)setSearching(false);});},250);return()=>{controller.abort();clearTimeout(timer);};},[query,data?.enabled?data.governanceMint:null]);
 const enabled=data?.enabled?data:null;
 const selected=enabled?.wallet?.vote;
 const open=Boolean(enabled?.votingOpen&&now>=enabled.round.startsAt&&now<enabled.round.endsAt);
 const activeBonus=enabled?.activeBonus&&now<enabled.activeBonus.endsAt?enabled.activeBonus:null;
 const currentFunding=activeBonus?enabled?.funding?.activeRound:null;
 const sol=(lamports:string)=>{const cents=(BigInt(lamports)+5_000_000n)/10_000_000n;return `${(cents/100n).toLocaleString()}.${(cents%100n).toString().padStart(2,'0')}`;};
 useEffect(()=>{if(notice&&!notice.includes('is confirmed')&&notice!=='Your vote has been removed.')toast.error(notice);},[notice]);
 const leaders=enabled?.leaders??[],lead=leaders[0];
 const leadingWeight=BigInt(lead?.votingPowerRaw||'0');
 const disabled=Boolean(busy||error||!open||(wallet.address&&!enabled?.wallet?.eligible));
 function voteButton(coin:GovernanceMarket){const chosen=selected?.mint===coin.mint;return <button className={`cb-vote ${chosen?'is-chosen':''}`} aria-label={chosen?`Remove vote for ${coin.symbol}`:`Vote for ${coin.symbol}`} aria-pressed={chosen} title={wallet.address&&!enabled?.wallet?.eligible?`Hold at least ${enabled?enabled.minimumHoldingBps/100:0.1}% of AQUA to vote.`:undefined} disabled={chosen?Boolean(busy||error||!open):disabled} onClick={()=>void vote(chosen?null:coin)}>{busy===coin.mint||(chosen&&busy==='remove')?<Loader2 className="spin"/>:chosen?<><Check/> Voted</>:<>Vote <ArrowUpRight/></>}</button>;}
 return <main className="cb-page">
  <section className="cb-hero">
   <div className="cb-water" aria-hidden="true"><i/><i/><i/></div>
   <div className="cb-hero-copy"><h1>Community<br/><em>Boost.</em></h1><p>Your community. The next wave.<br/>Back a coin to receive {enabled?enabled.bonusBps/100:10}% of AQUA treasury fees for 24 hours.</p></div>
   <div className="cb-hero-display"><div className="cb-orbit" aria-hidden="true"><div><Zap/></div></div><div className="cb-countdown"><strong aria-label="Round countdown">{enabled?countdown(open?enabled.round.endsAt:enabled.round.startsAt,now):'— : — : —'}</strong><small>A new winner at 00:00 UTC{enabled&&<> · {new Date(enabled.round.endsAt*1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} your time</>}</small></div></div>
  </section>
  {error&&<div className="cb-alert" role="alert"><span><b>Leaderboard connection interrupted.</b> {data?'Showing the last update. Voting is paused until refreshed.':error}</span><button onClick={refresh} disabled={Boolean(busy)}><RefreshCw/> Retry</button></div>}
  {data&&!data.enabled&&<section className="cb-unavailable"><h2>Voting is currently unavailable</h2><p>{data.reason}</p><button onClick={refresh}>Check again</button></section>}
  <div className={`cb-content ${activeBonus?'':'cb-content-wide'}`}>
   <section className="cb-rankings" aria-labelledby="cb-ranking-title">
    <header className="cb-section-header"><div><h2 id="cb-ranking-title">Live leaderboard</h2></div><button className="cb-refresh" aria-label="Refresh leaderboard" disabled={Boolean(busy)} onClick={refresh}><RefreshCw/></button></header>
    <p className="cb-ranking-note">Ranked by time-weighted AQUA holdings. Eligible AQUA holders back one coin.</p>
    {enabled&&<div className="cb-eligibility"><b>{!wallet.address?"Connect your wallet to vote":enabled.wallet?.eligible?"You are eligible to vote":"AQUA holdings required"}</b><span>Minimum {amount((BigInt(enabled.totalSupplyRaw)*BigInt(enabled.minimumHoldingBps)/10000n).toString(),enabled.decimals)} AQUA ({enabled.minimumHoldingBps/100}% of supply). Votes are weighted by holdings.</span>{selected&&<span>Your vote: <Link to={`/token/${selected.launchId}`}>${selected.symbol}</Link></span>}</div>}
    <label className="cb-search">Find a coin to boost<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, ticker or contract address"/></label>
    {query.trim()&&<div className="cb-search-results" aria-live="polite">{searching?<p>Searching…</p>:searchError?<p role="alert">{searchError}</p>:!results.length?<p>No matching eligible coins.</p>:results.slice(0,8).map(coin=><article key={coin.id}><Link to={`/token/${coin.id}`}>{coin.name} <small>${coin.symbol} · {coin.pairSymbol} pair</small></Link>{voteButton({launchId:coin.id,mint:coin.mint,name:coin.name,symbol:coin.symbol,imageId:null,rewardMode:coin.rewardMode})}</article>)}</div>}
    <div className="cb-table-labels" aria-hidden="true"><span>RANK / COIN</span><span>AQUA WEIGHT</span><span>YOUR VOTE</span></div>
    {!data&&!error?<div className="cb-loading" role="status"><Loader2 className="spin"/> Loading the race…</div>:leaders.length?<ol className="cb-leaders">{leaders.slice(0,visible).map((coin,index)=>{
     const share=leadingWeight>0n?Number(BigInt(coin.votingPowerRaw)*10000n/leadingWeight)/100:0;
     return <li className={`cb-leader ${index===0?'is-leading':''} ${selected?.mint===coin.mint?'is-selected':''}`} key={coin.mint} style={{'--entry':`${Math.min(index,8)*45}ms`} as CSSProperties}>
      <span className="cb-rank">{coin.rank===1?<Trophy aria-label="First place"/>:String(coin.rank).padStart(2,'0')}</span>
      <Link to={`/token/${encodeURIComponent(coin.launchId)}`} className="cb-identity"><CoinArt coin={coin}/><span><b>{coin.name}</b><small>${coin.symbol}{index===0&&<em>Leading</em>}</small></span></Link>
      <div className="cb-weight"><b>{amount(coin.votingPowerRaw,enabled!.decimals)}</b><small>{coin.voters.toLocaleString()} {coin.voters===1?'holder':'holders'}</small><span className="cb-weight-track" aria-hidden="true"><i style={{width:`${share}%`}}/></span></div>
      {voteButton(coin)}
     </li>;
    })}</ol>:<div className="cb-empty"><Waves/><h3>{enabled?'Make the first wave.':'The race will appear here.'}</h3><p>{enabled?'No eligible votes yet. Vote from a coin’s market page to get it onto the leaderboard.':'Rankings appear when community voting is available.'}</p></div>}
    {leaders.length>visible&&<button className="cb-more" onClick={()=>setVisible(n=>n+10)}>Show more coins <ArrowDown/></button>}
   </section>
   <aside className="cb-side">
    {enabled?.activeBonus&&now<enabled.activeBonus.endsAt&&<section className="cb-today"><span className="cb-eyebrow"><Zap/> BOOSTED TODAY</span><Link to={`/token/${encodeURIComponent(enabled.activeBonus.launchId)}`}><CoinArt coin={enabled.activeBonus}/><span><b>{enabled.activeBonus.name}</b><small>${enabled.activeBonus.symbol}</small></span><ArrowUpRight/></Link><p>Receiving {enabled.bonusBps/100}% of AQUA treasury fees.</p><div className="cb-today-rewards"><span>Holder rewards</span><strong>{currentFunding?<>{sol(currentFunding.rewardLamports)} <small>SOL</small></>:'Unavailable'}</strong>{currentFunding&&BigInt(currentFunding.rippleLamports??"0")>0n&&<span className="cb-today-dex">{sol(currentFunding.rippleLamports!)} SOL to Ripple Rewards</span>}{currentFunding&&BigInt(currentFunding.fundLamports)>0n&&<span className="cb-today-dex">{sol(currentFunding.fundLamports)} SOL to DEX funding</span>}</div><small><Clock3/> {countdown(enabled.activeBonus.endsAt,now)} remaining</small></section>}
   </aside>
  </div>
  <details className="cb-rules"><summary>How Community Boost works</summary><div><p>Eligible AQUA holders back one live coin per daily round. You can change or remove your vote. Signing a vote records your choice; it does not buy tokens or transfer funds.</p><p>Voting weight uses your average AQUA balance during the round, capped by your current balance. The highest eligible weight wins at 00:00 UTC and receives the configured share of treasury fees for the following 24 hours. AQUA itself cannot be nominated.</p><p>After the 10% Ripple share, half of the remaining Community Boost allocation goes to an eligible DEX profile or boost fund while it is collecting; otherwise that funding share also goes to holder rewards. A profile fund stops collecting once its target is reached. DEX mini boosts keep reserving 10% of incoming market rewards while open. They start at 90 minutes, plus 20 minutes per funding milestone, and close after 30 minutes without a qualifying market trade.</p></div></details>
 </main>;
}
