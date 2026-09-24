import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUpRight,Check,Clock3,Loader2,RefreshCw,Search,Trophy,Waves,X,Zap} from 'lucide-react';
import {api,API_URL} from '../api';
import {useCommunityBoost} from '../useCommunityBoost';
import type {GovernanceMarket,Launch} from '../types';
import './community-boost.css';

const compact=new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2});
function amount(raw:string,decimals:number){return compact.format(Number(BigInt(raw||'0'))/10**decimals);}
function countdown(end:number,now:number){const s=Math.max(0,end-now);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');}
function fromLaunch(l:Launch):GovernanceMarket{return {launchId:l.id,mint:l.mint!,name:l.name,symbol:l.symbol,imageId:null,rewardMode:l.rewardMode??'holder_rewards'};}
function CoinArt({coin,url}:{coin:GovernanceMarket;url?:string}){
 const [failed,setFailed]=useState(false);const src=url||(coin.imageId?`${API_URL}/api/images/${encodeURIComponent(coin.imageId)}`:'');
 useEffect(()=>setFailed(false),[src]);
 return <span className="cb-coin-art" aria-hidden="true">{src&&!failed?<img src={src} alt="" onError={()=>setFailed(true)}/>:coin.symbol.slice(0,2)}</span>;
}

export function CommunityBoost(){
 const {data,error,busy,notice,now,vote,refresh,wallet}=useCommunityBoost();
 const [query,setQuery]=useState(''),[results,setResults]=useState<Launch[]>([]),[searching,setSearching]=useState(true),[searchError,setSearchError]=useState(''),[retry,setRetry]=useState(0),[visible,setVisible]=useState(10);
 const input=useRef<HTMLInputElement>(null);
 const enabled=data?.enabled?data:null;
 const selected=enabled?.wallet?.vote;
 const open=Boolean(enabled?.votingOpen&&now>=enabled.round.startsAt&&now<enabled.round.endsAt);
 const governanceMint=enabled?.governanceMint;
 useEffect(()=>{
  const abort=new AbortController();let active=true;setSearching(true);setSearchError('');setResults([]);
  const timer=setTimeout(async()=>{
   try{const response=query.trim()?await api.search(query.trim(),abort.signal):await api.launches({limit:8},abort.signal);if(active)setResults(response.launches.filter(l=>l.status==='live'&&l.mint&&l.mint!==governanceMint));}
   catch(e){if(active&&!abort.signal.aborted)setSearchError(e instanceof Error?e.message:'Could not find coins.');}
   finally{if(active)setSearching(false);}
  },query.trim()?250:0);
  return()=>{active=false;abort.abort();clearTimeout(timer);};
 },[query,governanceMint,retry]);
 const leaders=enabled?.leaders??[],lead=leaders[0];
 const leadingWeight=BigInt(lead?.votingPowerRaw||'0');
 const disabled=Boolean(busy||error||!open||(wallet.address&&!enabled?.wallet?.eligible));
 function voteButton(coin:GovernanceMarket){const chosen=selected?.mint===coin.mint;return <button className={`cb-vote ${chosen?'is-chosen':''}`} aria-label={chosen?`Voted for ${coin.symbol}`:`Vote for ${coin.symbol}`} disabled={disabled||chosen} onClick={()=>void vote(coin)}>{busy===coin.mint?<><Loader2 className="spin"/> Signing…</>:chosen?<><Check/> Voted</>:<>Vote <ArrowUpRight/></>}</button>;}
 function choose(){input.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});input.current?.focus({preventScroll:true});}
 return <main className="cb-page">
  <section className="cb-hero">
   <div className="cb-water" aria-hidden="true"><i/><i/><i/></div>
   <div className="cb-hero-copy"><span className="cb-eyebrow"><Zap/> POWERED BY AQUA HOLDERS</span><h1>Community<br/><em>Boost.</em></h1><p>Your community. The next wave.<br/>Back a coin to receive {enabled?enabled.bonusBps/100:10}% of AQUA platform fees for 24 hours.</p><button className="cb-jump" onClick={choose}>Choose your coin <ArrowDown/></button></div>
   <div className="cb-hero-display"><div className="cb-orbit" aria-hidden="true"><span/><span/><div><Zap/></div></div><div className="cb-countdown"><span><Clock3/>{open?'THIS ROUND CLOSES IN':enabled?.votingOpen?'NEXT ROUND UPDATING':'DAILY COMMUNITY VOTE'}</span><strong aria-label="Round countdown">{enabled?countdown(open?enabled.round.endsAt:enabled.round.startsAt,now):'— : — : —'}</strong><small>A new winner at 00:00 UTC</small></div></div>
  </section>
  {error&&<div className="cb-alert" role="alert"><span><b>Leaderboard connection interrupted.</b> {data?'Showing the last update. Voting is paused until refreshed.':error}</span><button onClick={refresh} disabled={Boolean(busy)}><RefreshCw/> Retry</button></div>}
  {data&&!data.enabled&&<section className="cb-unavailable"><h2>Voting is currently unavailable</h2><p>{data.reason}</p><button onClick={refresh}>Check again</button></section>}
  <div className="cb-content">
   <section className="cb-rankings" aria-labelledby="cb-ranking-title">
    <header className="cb-section-header"><div><span className="cb-eyebrow">THE RACE FOR TOMORROW</span><h2 id="cb-ranking-title">Live leaderboard</h2></div><button className="cb-refresh" aria-label="Refresh leaderboard" disabled={Boolean(busy)} onClick={refresh}><RefreshCw/></button></header>
    <p className="cb-ranking-note">Ranked by time-weighted AQUA votes. Every holder can back one coin.</p>
    <div className="cb-table-labels" aria-hidden="true"><span>RANK / COIN</span><span>AQUA WEIGHT</span><span>YOUR VOTE</span></div>
    {!data&&!error?<div className="cb-loading" role="status"><Loader2 className="spin"/> Loading the race…</div>:leaders.length?<ol className="cb-leaders">{leaders.slice(0,visible).map((coin,index)=>{
     const share=leadingWeight>0n?Number(BigInt(coin.votingPowerRaw)*10000n/leadingWeight)/100:0;
     return <li className={`cb-leader ${index===0?'is-leading':''} ${selected?.mint===coin.mint?'is-selected':''}`} key={coin.mint} style={{'--entry':`${Math.min(index,8)*45}ms`} as CSSProperties}>
      <span className="cb-rank">{coin.rank===1?<Trophy aria-label="First place"/>:String(coin.rank).padStart(2,'0')}</span>
      <Link to={`/token/${encodeURIComponent(coin.launchId)}`} className="cb-identity"><CoinArt coin={coin}/><span><b>{coin.name}</b><small>${coin.symbol}{index===0&&<em>Leading</em>}</small></span></Link>
      <div className="cb-weight"><b>{amount(coin.votingPowerRaw,enabled!.decimals)}</b><small>{coin.voters.toLocaleString()} {coin.voters===1?'holder':'holders'}</small><span className="cb-weight-track" aria-hidden="true"><i style={{width:`${share}%`}}/></span></div>
      {voteButton(coin)}
     </li>;
    })}</ol>:<div className="cb-empty"><Waves/><h3>{enabled?'Make the first wave.':'The race will appear here.'}</h3><p>{enabled?'No eligible votes yet. Choose a coin below to get things moving.':'Rankings appear when community voting is available.'}</p></div>}
    {leaders.length>visible&&<button className="cb-more" onClick={()=>setVisible(n=>n+10)}>Show more coins <ArrowDown/></button>}
    {!!leaders.length&&<p className="cb-rank-foot">Top {leaders.length} ranked coins · Refreshes every 15 seconds</p>}
   </section>
   <aside className="cb-side">
    <section className="cb-your-vote"><span className="cb-eyebrow">YOUR VOICE</span><h2>{selected?'You’re backing':'Pick your next winner.'}</h2>
     {selected?<><Link className="cb-your-coin" to={`/token/${encodeURIComponent(selected.launchId)}`}><CoinArt coin={selected}/><span><b>{selected.name}</b><small>${selected.symbol}</small></span><Check/></Link><p>Your vote stays with this coin for this round. You can change it before voting closes.</p><div className="cb-vote-actions"><button onClick={choose}>Change coin <ArrowDown/></button><button disabled={Boolean(busy||error||!open)} onClick={()=>void vote(null)} aria-label="Remove your vote">{busy==='remove'?<Loader2 className="spin"/>:<X/>} Remove</button></div></>:<><p>{wallet.address?enabled?.wallet?.eligible?'You’re eligible. Choose a coin from the leaderboard or search below.':`Hold at least ${enabled?enabled.minimumHoldingBps/100:0.1}% of AQUA to vote. Voting weight reflects your balance and time held.`:'Connect your wallet to check your voting power and back a community.'}</p>{wallet.address?<div className="cb-wallet-weight"><strong>{enabled?.wallet?amount(enabled.wallet.votingPowerRaw,enabled.decimals):'—'}</strong><span>Your effective AQUA weight</span></div>:<button className="cb-connect" onClick={()=>wallet.setModalOpen(true)}>Connect wallet <ArrowUpRight/></button>}</>}
     {wallet.address&&selected&&enabled?.wallet&&!enabled.wallet.eligible&&<p className="cb-eligibility">Your holding is below the voting requirement. This vote has no eligible weight.</p>}
     <div className={`cb-notice ${notice.includes('is confirmed')?'confirmed':''}`} role="status" aria-live="polite">{notice}</div>
    </section>
    {enabled?.activeBonus&&now<enabled.activeBonus.endsAt&&<section className="cb-today"><span className="cb-eyebrow"><Zap/> BOOSTED TODAY</span><Link to={`/token/${encodeURIComponent(enabled.activeBonus.launchId)}`}><CoinArt coin={enabled.activeBonus}/><span><b>{enabled.activeBonus.name}</b><small>${enabled.activeBonus.symbol}</small></span><ArrowUpRight/></Link><p>Receiving {enabled.bonusBps/100}% of AQUA platform fees.</p><small><Clock3/> {countdown(enabled.activeBonus.endsAt,now)} remaining</small></section>}
   </aside>
  </div>
  <section className="cb-picker" aria-labelledby="cb-picker-title">
   <div className="cb-picker-heading"><span className="cb-eyebrow">NOT ON THE BOARD YET?</span><h2 id="cb-picker-title">Start a wave for your coin.</h2><p>Find any live AQUA market by name, ticker or contract address.</p></div>
   <label className="cb-search"><Search/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a coin or paste its CA" aria-label="Find a coin to boost" maxLength={100}/>{query&&<button aria-label="Clear coin search" onClick={()=>{setQuery('');input.current?.focus();}}><X/></button>}</label>
   <div className="cb-search-results" aria-busy={searching}>
    {searching?<p className="cb-search-state" role="status"><Loader2 className="spin"/> Finding coins…</p>:searchError?<div className="cb-search-state" role="alert">{searchError}<button onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:results.length?results.map(l=><div key={l.id} className="cb-candidate"><Link className="cb-identity" to={`/token/${encodeURIComponent(l.id)}`}><CoinArt coin={fromLaunch(l)} url={l.imageUrl}/><span><b>{l.name}</b><small>${l.symbol}</small></span></Link>{voteButton(fromLaunch(l))}</div>):<p className="cb-search-state">{query?'No eligible coin found. Try its name, ticker or full contract address.':'No eligible live markets are available yet.'}</p>}
   </div>
  </section>
  <details className="cb-rules"><summary>How Community Boost works</summary><div><p>Eligible AQUA holders back one live coin per daily round. You can change or remove your vote. Signing a vote records your choice; it does not buy tokens or transfer funds.</p><p>Voting weight uses your average AQUA balance during the round, capped by your current balance. The highest eligible weight wins at 00:00 UTC and receives the configured share of platform fees for the following 24 hours. AQUA itself cannot be nominated.</p><p>This community vote is separate from a coin’s DEX Screener boost fund. DEX mini boosts now reserve 10% of incoming market rewards and close after an hour or ten quiet minutes.</p></div></details>
 </main>;
}
