import {useEffect,useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUpRight,Check,Clock3,Loader2,RefreshCw,Trophy,Waves,Zap} from 'lucide-react';
import {API_URL} from '../api';
import {useCommunityBoost} from '../useCommunityBoost';
import {toast} from 'sonner';
import type {GovernanceMarket} from '../types';
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
 const enabled=data?.enabled?data:null;
 const selected=enabled?.wallet?.vote;
 const open=Boolean(enabled?.votingOpen&&now>=enabled.round.startsAt&&now<enabled.round.endsAt);
 const activeBonus=enabled?.activeBonus&&now<enabled.activeBonus.endsAt?enabled.activeBonus:null;
 useEffect(()=>{if(notice&&!notice.includes('is confirmed')&&notice!=='Your vote has been removed.')toast.error(notice);},[notice]);
 const leaders=enabled?.leaders??[],lead=leaders[0];
 const leadingWeight=BigInt(lead?.votingPowerRaw||'0');
 const disabled=Boolean(busy||error||!open||(wallet.address&&!enabled?.wallet?.eligible));
 function voteButton(coin:GovernanceMarket){const chosen=selected?.mint===coin.mint;return <button className={`cb-vote ${chosen?'is-chosen':''}`} aria-label={chosen?`Remove vote for ${coin.symbol}`:`Vote for ${coin.symbol}`} aria-pressed={chosen} title={wallet.address&&!enabled?.wallet?.eligible?`Hold at least ${enabled?enabled.minimumHoldingBps/100:0.1}% of AQUA to vote.`:undefined} disabled={chosen?Boolean(busy||error||!open):disabled} onClick={()=>void vote(chosen?null:coin)}>{busy===coin.mint||(chosen&&busy==='remove')?<Loader2 className="spin"/>:chosen?<><Check/> Voted</>:<>Vote <ArrowUpRight/></>}</button>;}
 return <main className="cb-page">
  <section className="cb-hero">
   <div className="cb-water" aria-hidden="true"><i/><i/><i/></div>
   <div className="cb-hero-copy"><h1>Community<br/><em>Boost.</em></h1><p>Your community. The next wave.<br/>Back a coin to receive {enabled?enabled.bonusBps/100:10}% of AQUA platform fees for 24 hours.</p></div>
   <div className="cb-hero-display"><div className="cb-orbit" aria-hidden="true"><div><Zap/></div></div><div className="cb-countdown"><strong aria-label="Round countdown">{enabled?countdown(open?enabled.round.endsAt:enabled.round.startsAt,now):'— : — : —'}</strong><small>A new winner at 00:00 UTC</small></div></div>
  </section>
  {error&&<div className="cb-alert" role="alert"><span><b>Leaderboard connection interrupted.</b> {data?'Showing the last update. Voting is paused until refreshed.':error}</span><button onClick={refresh} disabled={Boolean(busy)}><RefreshCw/> Retry</button></div>}
  {data&&!data.enabled&&<section className="cb-unavailable"><h2>Voting is currently unavailable</h2><p>{data.reason}</p><button onClick={refresh}>Check again</button></section>}
  <div className={`cb-content ${activeBonus?'':'cb-content-wide'}`}>
   <section className="cb-rankings" aria-labelledby="cb-ranking-title">
    <header className="cb-section-header"><div><h2 id="cb-ranking-title">Live leaderboard</h2></div><button className="cb-refresh" aria-label="Refresh leaderboard" disabled={Boolean(busy)} onClick={refresh}><RefreshCw/></button></header>
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
    })}</ol>:<div className="cb-empty"><Waves/><h3>{enabled?'Make the first wave.':'The race will appear here.'}</h3><p>{enabled?'No eligible votes yet. Vote from a coin’s market page to get it onto the leaderboard.':'Rankings appear when community voting is available.'}</p></div>}
    {leaders.length>visible&&<button className="cb-more" onClick={()=>setVisible(n=>n+10)}>Show more coins <ArrowDown/></button>}
   </section>
   <aside className="cb-side">
    {enabled?.activeBonus&&now<enabled.activeBonus.endsAt&&<section className="cb-today"><span className="cb-eyebrow"><Zap/> BOOSTED TODAY</span><Link to={`/token/${encodeURIComponent(enabled.activeBonus.launchId)}`}><CoinArt coin={enabled.activeBonus}/><span><b>{enabled.activeBonus.name}</b><small>${enabled.activeBonus.symbol}</small></span><ArrowUpRight/></Link><p>Receiving {enabled.bonusBps/100}% of AQUA platform fees.</p><small><Clock3/> {countdown(enabled.activeBonus.endsAt,now)} remaining</small></section>}
   </aside>
  </div>
  <details className="cb-rules"><summary>How Community Boost works</summary><div><p>Eligible AQUA holders back one live coin per daily round. You can change or remove your vote. Signing a vote records your choice; it does not buy tokens or transfer funds.</p><p>Voting weight uses your average AQUA balance during the round, capped by your current balance. The highest eligible weight wins at 00:00 UTC and receives the configured share of platform fees for the following 24 hours. AQUA itself cannot be nominated.</p><p>This community vote is separate from a coin’s DEX Screener boost fund. DEX mini boosts now reserve 10% of incoming market rewards and close after an hour or ten quiet minutes.</p></div></details>
 </main>;
}
