import { ShowcaseBanner } from "../components/StagingShowcase";
import { newerComment, readCommentCursor, type CommentCursor } from "../market-activity";
import { WalletIdentity } from "../components/WalletIdentity";
import { Community } from "../components/Community";
import { MarketInformationTabs } from "../components/MarketProposals";
import { WalletRewards } from "../components/WalletRewards";
import {marketShareUrl} from "../share-market";
import { MarketHolders,MarketPosition } from "../components/MarketHolders";
import { mergeTrades, tradeTime } from "../trade-history";
import { formatJackpotAmount } from "../jackpot-format";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Globe2, Loader2, LockKeyhole, Settings2 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { TradePanel } from "../components/TradePanel";
import type { CreatorLock, Launch, MarketSnapshot, RewardModeState, StockOption, Trade } from "../types";
import { Metric, TokenMark } from "../components/TokenCard";
import { MarketCapLine } from "../components/MarketCapCandles";
import { activeCreatorLock, creatorLockPercentLabel, solscanAccountUrl } from "../creator-lock";
import { GovernanceVote } from "../components/GovernanceVote";
import { MarketProposals, MarketGovernanceProvider, CommunityProposalVotes, DexFundingVote } from "../components/MarketProposals";
import { MarketDexStatusBadge } from "../components/MarketProposals";
import { launchAge } from "../time";
import { useMarketPrices } from "../useMarketPrices";
import { mergeMarketPrice, withLatestMarketPoint } from "../market-prices";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

function formatRaw(raw: string | undefined, decimals: number) {
  const value = String(raw ?? "0").replace(/^0+/, "") || "0";
  if (!decimals) return value;
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, 5);
  return fraction ? `${whole}.${fraction}` : whole;
}

function formatCompactRaw(raw: string | undefined, decimals: number) {
  const whole = BigInt(raw || "0") / 10n ** BigInt(decimals);
  const units: Array<[bigint, string]> = [[1_000_000_000_000n, "T"], [1_000_000_000n, "B"], [1_000_000n, "M"], [1_000n, "K"]];
  for (const [unit, suffix] of units) if (whole >= unit) return `${(whole + unit / 2n) / unit}${suffix}`;
  return whole.toString();
}

function formatCountdown(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const remainder = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function jackpotPrizeAmount(jackpot: RewardModeState["jackpot"] | undefined, prizeBps: number) {
  if (!jackpot) return "Loading…";
  const pot = BigInt(jackpot.currentPotRaw);
  const remainder = pot - [5000n, 2000n, 2000n, 500n, 500n].reduce((sum, bps) => sum + pot * bps / 10000n, 0n);
  const amountRaw = pot * BigInt(prizeBps) / 10_000n + (prizeBps === 5000 ? remainder : 0n);
  return `${formatJackpotAmount(amountRaw.toString(), jackpot.rewardDecimals)} ${jackpot.rewardSymbol}`;
}

function solscanTransactionUrl(signature: string, network: string) {
  return `https://solscan.io/tx/${signature}${network === "devnet" ? "?cluster=devnet" : ""}`;
}

export function Token() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const { config } = useRuntime();
  const [storedLaunch, setLaunch] = useState<Launch | null>(null);
  const prices = useMarketPrices();
  const launch = storedLaunch ? mergeMarketPrice(storedLaunch,prices.get(id)) : null;
  const [creatorLock, setCreatorLock] = useState<CreatorLock | null>(null);
  const [rewardModeState, setRewardModeState] = useState<RewardModeState | null>(null);
  const [stock, setStock] = useState<StockOption | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [incomingTrades,setIncomingTrades]=useState<Trade[]>([]);
  const [tradesHaveMore, setTradesHaveMore] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [range, setRange] = useState("24h");
  const [params,setParams] = useSearchParams();
  const preferredSection=()=>{
    const names=['Transactions','Community','Holders','Rewards','Project','Governance'];
    const explicit=params.get('tab')==='comments'?'community':params.get('tab');
    let saved='';try{saved=localStorage.getItem('aqua:market-tab')??'';}catch{}
    return names.find(name=>name.toLowerCase()===explicit)??names.find(name=>name===saved)??'Transactions';
  };
  const [section,setSection]=useState(preferredSection);
  const selectSection=(next:string)=>{try{localStorage.setItem('aqua:market-tab',next);}catch{}setSection(next);setParams(previous=>{const query=new URLSearchParams(previous);query.set('tab',next.toLowerCase());query.delete('feed');return query;},{replace:true});};
  const jumpTo = (area: string) => requestAnimationFrame(() => document.getElementById(area)?.scrollIntoView({ block: "start", behavior: "instant" }));
  const openInformation = (next: string) => { selectSection(next); if (window.matchMedia("(max-width: 1100px)").matches || next === "Community") jumpTo("market-information"); };
  // Deep links and remembered tabs retain their navigation context.
  useEffect(() => { if (loaded && section !== "Transactions" && (window.matchMedia("(max-width: 1100px)").matches || section === "Community")) jumpTo("market-information"); }, [id, loaded, section]);
  const [positionOpen,setPositionOpen]=useState(false);
  const readKey = "aqua:comments:seen:" + (wallet.address ?? "visitor") + ":" + id;
  const [seen,setSeen]=useState<{key:string;cursor:CommentCursor|null}>(()=>({key:readKey,cursor:readCommentCursor(readKey)}));
  useEffect(()=>{const next=preferredSection();setSection(next);try{localStorage.setItem('aqua:market-tab',next);}catch{}setPositionOpen(false);},[id,params]);
  useEffect(()=>{
    const sync=()=>setSeen({key:readKey,cursor:readCommentCursor(readKey)}); sync();
    window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync);
  },[readKey]);
  const markCommentsRead=useCallback((cursor:CommentCursor)=>{
    setSeen(previous=>{
      const old=previous.key===readKey?previous.cursor:readCommentCursor(readKey);
      const latest=newerComment(cursor,old)?cursor:old;
      try{if(latest)localStorage.setItem(readKey,JSON.stringify(latest));}catch{/* Reading still works when browser storage is disabled. */}
      return {key:readKey,cursor:latest};
    });
  },[readKey]);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1_000));

  useEffect(() => {
    let active = true, loading = false, first = true;
    setLaunch(null); setTrades([]); setIncomingTrades([]); setLoaded(false); setLoadError("");
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
      const launchData = await api.launch(id);
      if (!active) return;
      setLaunch(launchData.launch);
      setCreatorLock(launchData.creatorLock);
      setRewardModeState(launchData.rewardModeState);
      if(first)setTrades(launchData.trades);else setIncomingTrades(current=>mergeTrades(current,launchData.trades));
      if (first) setTradesHaveMore(Boolean(launchData.tradesHasMore));
      first = false; setLoadError("");
      } catch(error) { if(active) setLoadError(error instanceof Error ? error.message : "Market unavailable"); }
      finally { loading = false; }
    };

    void refresh().catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    }, 5_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id]);

  useEffect(()=>{
    let active=true,pending=false; setSnapshots([]);
    const refresh=async()=>{if(pending)return;pending=true;try{const data=await api.marketData(id,range);if(active)setSnapshots(data.snapshots);}catch{/* Preserve the last valid chart. */}finally{pending=false;}};
    void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},15_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[id,range]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1_000)), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!launch?.stockMint) return;
    let active = true;
    void api.stocks().then((stockData) => {
      if (active) setStock(stockData.stocks.find((item) => item.mint === launch.stockMint) ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [launch?.stockMint]);

  const sortedTrades = useMemo(() => [...trades].sort((a, b) => tradeTime(b) - tradeTime(a)), [trades]);

  if (!loadError && !launch && loaded) return <main className="page empty-state"><h2>Market not found</h2><p>This market is not present in the AQUA index.</p><Link className="primary" to="/">Return to Explore</Link></main>;
  if (loadError && !launch) return <main className="page"><section className="empty-state"><h1>Market unavailable</h1><p>{loadError}</p><button onClick={() => window.location.reload()}>Retry</button></section></main>;
  if (!launch) return <main className="page"><div className="page-loading">Loading market…</div></main>;
  if (launch.status !== "live") return <main className="page empty-state"><h2>Market not available</h2><p>This coin does not have a live market yet.</p><Link className="primary" to="/">Return to Explore</Link></main>;

  const activeLaunch = launch;
  const stockDecimals = stock?.decimals ?? 6;
  const pairDecimals = launch.pairType === "sol" ? 9 : stockDecimals;
  const explorerUrl = `https://explorer.solana.com/address/${launch.whirlpoolAddress || launch.mint}${config.network === "devnet" ? "?cluster=devnet" : ""}`;
  const verifiedCreatorLock = activeCreatorLock(creatorLock);
  const lockedPercentLabel = creatorLockPercentLabel(verifiedCreatorLock);
  const creatorLockUrl = verifiedCreatorLock ? solscanAccountUrl(verifiedCreatorLock.vaultTokenAccount, config.network) : null;
  const rewardMode = launch.rewardMode ?? "holder_rewards";
  const modeLabel = rewardMode === "buyback_burn" ? "BUYBACK & BURN" : rewardMode === "jackpot" ? "HOURLY JACKPOT" : "HOLDER REWARDS";
  const jackpot = rewardModeState?.jackpot;
  const jackpotSeconds = Math.max(0, (jackpot?.nextDrawAt ?? nowSeconds + (config.rewardModes?.jackpot.drawSeconds ?? 3_600)) - nowSeconds);

  async function loadMoreTrades() {
    if (loadingTrades || !tradesHaveMore) return;
    setLoadingTrades(true);
    try {
      const result = await api.trades(activeLaunch.id, trades.length, 10,sortedTrades.at(-1));
      setTrades((current) => mergeTrades(current, result.trades));
      setTradesHaveMore(result.hasMore);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load older activity.");
    } finally {
      setLoadingTrades(false);
    }
  }

  return <MarketGovernanceProvider key={launch.id} launch={launch}><main className="page token-page">
    {launch.showcase&&<ShowcaseBanner launch={launch}/>}
    <div className="token-market-toolbar"><Link className="back" to="/"><ArrowLeft/>Explore markets</Link><div className="token-market-actions">{!launch.showcase&&<GovernanceVote market={launch} compact/>}{config.marketGovernanceEnabled && <MarketProposals/>}{!launch.showcase && wallet.address === launch.creatorWallet && <Link className="creator-manage-button" to={"/manage/" + launch.id}><Settings2/>Manage coin</Link>}</div></div>
    <section className="token-hero">
      <div className="token-identity"><TokenMark launch={launch} large/><div><div><h1>{launch.name}</h1><span>${launch.symbol}</span><em className={launch.status}>{launch.status === "live" ? "ORCA WHIRLPOOL" : "LAUNCHING"}</em><em className={`reward-mode-badge ${rewardMode}`}>{modeLabel}</em><MarketDexStatusBadge/>{launch.showcase&&verifiedCreatorLock&&<span className="showcase-lock"><LockKeyhole/><b>{lockedPercentLabel}</b> locked · Preview</span>}{!launch.showcase && verifiedCreatorLock && creatorLockUrl && <a className="market-lock-control" href={creatorLockUrl} target="_blank" rel="noreferrer" title="View the verified creator lock on Solscan" aria-label={`View creator lock: ${lockedPercentLabel} of supply locked (opens Solscan)`}><span className="market-lock-amount"><LockKeyhole aria-hidden="true"/><strong>{lockedPercentLabel}</strong> locked</span><span className="market-lock-view">View lock <ExternalLink aria-hidden="true"/></span></a>}</div><p>{launch.description}</p><footer><button onClick={()=>{void navigator.clipboard.writeText(marketShareUrl(launch.id)).then(()=>toast.success("Share link copied"),()=>toast.error("Clipboard unavailable"));}}>Share market ↗</button><span className="market-launch-age">{launchAge(launch.launchedAt, launch.createdAt)}</span>{launch.xUrl && <a href={launch.xUrl} target="_blank" rel="noreferrer">X <ExternalLink/></a>}{launch.websiteUrl && <a href={launch.websiteUrl} target="_blank" rel="noreferrer"><Globe2/> Website</a>}{!launch.showcase&&<a href={explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink/></a>}{launch.marketPolicyAddress && <a href={solscanAccountUrl(launch.marketPolicyAddress, config.network)} target="_blank" rel="noreferrer">Mode policy <ExternalLink/></a>}{!launch.showcase&&<button onClick={() => { void navigator.clipboard.writeText(launch.mint); toast.success("Mint copied"); }}><Copy/> {launch.mint.slice(0, 5)}…{launch.mint.slice(-4)}</button>}</footer></div></div>
      <div className="hero-metrics"><Metric label="Orca pair" value={`${launch.symbol} / ${launch.pairSymbol}`}/><Metric label={rewardMode === "buyback_burn" ? "Burn asset" : rewardMode === "jackpot" ? "Prize asset" : "Reward asset"} value={rewardMode === "buyback_burn" ? launch.symbol : rewardMode === "jackpot" ? "SOL" : launch.stockSymbol}/><Metric label="TVL" value={launch.aquaIndexed ? `$${compact.format(launch.tvlUsd)}` : "Indexing"}/><Metric label="Market cap" value={launch.aquaIndexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/></div>
    </section>

    <nav className="market-mobile-shortcuts" aria-label="Market shortcuts">
      <button onClick={() => jumpTo("market-chart")} aria-label="View market chart">Chart</button>
      <button onClick={() => jumpTo("market-trade")} aria-label="Open trading panel">Trade</button>
      <button onClick={() => openInformation("Community")} aria-label="Open community">Community</button>
      <button onClick={() => openInformation("Rewards")} aria-label="View market rewards">Rewards</button>
    </nav>
    <div className="token-layout"><section className="token-main">
      <div id="market-chart" className="chart-panel market-cap-chart-panel"><header><div><small>MARKET CAP</small><b>{launch.aquaIndexed ? money.format(launch.marketCapUsd) : "Pending"}</b></div></header><div className="chart market-line-shell"><MarketCapLine snapshots={withLatestMarketPoint(snapshots,launch)} range={range} onRangeChange={setRange}/></div></div>

      <section id="market-information" className="market-information" aria-label="Market information panel">
      <MarketInformationTabs section={section} onChange={openInformation} newComments={newerComment(launch.latestComment,seen.key===readKey?seen.cursor:null)} latestProjectUpdateAt={launch.latestProjectUpdateAt}/>
      {section==="Holders"&&<MarketHolders key={launch.id} launch={launch} creatorLock={creatorLock}/>}
      {section==="Community"&&<Community launch={launch} onRead={markCommentsRead}/>}
      {section==="Project"&&<div className="market-project"><section className="dashboard-section"><h2>Project information</h2><p>{launch.description}</p><p>Opening LP lock: {launch.liquidityLockedPermanently?"Permanently locked":"Not verified"}{launch.lockConfig&&<> · <a href={solscanAccountUrl(launch.lockConfig,config.network)} target="_blank" rel="noreferrer">Verify LP lock ↗</a></>}</p><p>Creator token lock: {creatorLock?.status==="active"?"Active until "+new Date(creatorLock.unlockAt*1000).toLocaleString():"No active verified creator lock"}.</p><p>DEX profile payment is not an endorsement or security assessment.</p>{!launch.showcase&&<a href={solscanAccountUrl(launch.mint,config.network)} target="_blank" rel="noreferrer">Inspect mint and authority state ↗</a>}</section></div>}
      {section==="Rewards"&&<>{rewardMode==="holder_rewards"&&<><WalletRewards launch={launch}/><section className="workspace-panel market-reward-activity"><header><h2>Market reward activity</h2></header><div className="info-grid single reward-mode-market-panel">
        {rewardMode === "holder_rewards" && <section className="market-reward-panel"><header><div><small>HOLDER REWARDS</small><h2>Earn {launch.stockSymbol}</h2></div><span className="reward-live-label">Accumulating</span></header><div className="reward-stat-row"><Metric label="Total accumulated" value={money.format(launch.rewardAccumulatedUsd)}/><Metric label="Available to all holders" value={money.format(launch.rewardRedeemableUsd)}/></div><footer>Rewards follow your balance and time held.</footer></section>}
      </div></section></>}
      <div className="info-grid single reward-mode-market-panel">
        {rewardMode === "buyback_burn" && <section className="market-reward-panel"><header><div><small>BUYBACK &amp; BURN</small><h2>Reducing the supply</h2></div><span className="reward-live-label">Market buybacks</span></header><div className="reward-stat-row"><Metric label="SOL spent on buybacks" value={`${compact.format(rewardModeState?.buybackBurn.totalSol ?? 0)} SOL`}/><Metric label={`${launch.symbol} permanently burned`} value={formatCompactRaw(rewardModeState?.buybackBurn.totalTokenRaw, launch.tokenDecimals)}/></div><footer>{rewardModeState?.buybackBurn.lastBurnAt ? "Last burn · " + new Date(rewardModeState.buybackBurn.lastBurnAt).toLocaleString() : "The reward share buys this coin through its pool and burns the purchased tokens."}</footer></section>}
        {rewardMode === "jackpot" && <section className="market-reward-panel market-jackpot">
          <header><div><small>HOURLY JACKPOT</small><h2>Current payouts</h2></div><div className="jackpot-next-draw"><span>{jackpot?.status === "rolling_over" ? "Next attempt" : "Next draw"}</span><strong>{!jackpot ? "Loading…" : jackpot.status === "blocked" ? "Delayed" : jackpot.status === "drawing" ? "Drawing…" : jackpot.status === "publishing" ? "Funding prizes…" : jackpotSeconds === 0 ? "Awaiting draw" : formatCountdown(jackpotSeconds)}</strong></div></header>
          {jackpot?.status === "rolling_over" && <p className="jackpot-state-note">{jackpot.reason === "eligible_holders" ? `Waiting for five eligible holders${jackpot.eligibleWallets !== null ? ` (${jackpot.eligibleWallets} currently eligible)` : ""}. Prizes carry forward.` : "Waiting for the minimum funding. Prizes carry forward."}</p>}
          {jackpot?.status === "blocked" && <p className="jackpot-state-note">Settlement is delayed. Prizes remain pending until funding is confirmed.</p>}
          <div className="jackpot-podium" aria-label="Prize amounts for the next five winners">
            {[["1ST", 5_000], ["2ND", 2_000], ["3RD", 2_000], ["4TH", 500], ["5TH", 500]].map(([place, bps]) => {
              const amount = jackpotPrizeAmount(jackpot, Number(bps));
              return <div key={place} className={"podium-place place-" + String(place).toLowerCase()}><div><small>{place}</small><b title={amount}>{amount}</b><small className="payout-pending">Awaiting draw</small></div><span className="podium-column"><em>{place}</em></span></div>;
            })}
          </div>
        </section>}
      </div>

      {rewardMode==="jackpot"&&<><WalletRewards launch={launch}/><JackpotHistory jackpot={jackpot} network={config.network}/></>}</>}
      {section==="Governance"&&<><CommunityProposalVotes/><DexFundingVote/></>}

      {section==="Transactions"&&<div className="activity"><header><div><b>Market activity</b><span>Newest transactions first</span>{incomingTrades.some(t=>!trades.some(old=>old.id===t.id))&&<button className="soft-button" onClick={()=>{setTrades(current=>mergeTrades(current,incomingTrades));setIncomingTrades([]);}}>Show new transactions</button>}</div><strong>{launch.txCount.toLocaleString()} total</strong></header><div className="activity-scroll"><table><thead><tr><th>Type</th><th>Wallet</th><th>Time</th><th>{launch.pairSymbol}</th><th>Tokens</th></tr></thead><tbody>{sortedTrades.length ? sortedTrades.map((item) => <tr key={item.id}><td className={item.side}>{item.side.toUpperCase()}</td><td><WalletIdentity wallet={item.wallet}/></td><td>{item.signature ? <a href={solscanTransactionUrl(item.signature, config.network)} target="_blank" rel="noreferrer">{new Date(tradeTime(item)).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} ↗</a> : "—"}</td><td>{formatRaw(item.gross_quote_raw, pairDecimals)}</td><td title={formatRaw(item.token_amount_raw, launch.tokenDecimals)}>{compact.format(Number(item.token_amount_raw) / 10 ** launch.tokenDecimals)}</td></tr>) : <tr><td colSpan={5} className="no-activity">No indexed trades yet.</td></tr>}</tbody></table></div>{tradesHaveMore && <button className="activity-load-more" disabled={loadingTrades} onClick={() => void loadMoreTrades()}>{loadingTrades ? <><Loader2 className="spin"/>Loading</> : "Load more"}</button>}</div>}
      </section>
    </section>

    <aside id="market-trade" className="token-side"><TradePanel key={[launch.id,wallet.address,config.network].join(":")} launch={launch} pairDecimals={launch.pairType === "sol" ? 9 : stock?.decimals ?? null}/>{!launch.showcase&&<details className="market-position-dropdown" open={positionOpen} onToggle={event=>setPositionOpen(event.currentTarget.open)}><summary>Your position</summary>{positionOpen && <MarketPosition key={launch.id + ":" + wallet.address} launch={launch} compact/>}</details>}<details className="market-facts"><summary>Market details</summary><dl><div><dt>Creator</dt><dd><WalletIdentity wallet={launch.creatorWallet}/></dd></div><div><dt>Developer buy</dt><dd>{launch.pairType === "sol" ? launch.devBuySol > 0 ? `${launch.devBuySol} SOL` : "None" : BigInt(launch.devBuyStockRaw || "0") > 0n ? `${formatRaw(launch.devBuyStockRaw, stockDecimals)} ${launch.pairSymbol}` : "None"}</dd></div><div><dt>Holders</dt><dd>{compact.format(launch.holderCount)}</dd></div><div><dt>Pool</dt><dd>{launch.showcase?"Preview pool":<a href={explorerUrl} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={12}/></a>}</dd></div></dl></details><DexFundingVote/>{rewardMode === "jackpot" && <JackpotLeaderboard jackpot={jackpot}/>}</aside></div>
  </main></MarketGovernanceProvider>;
}

function JackpotHistory({ jackpot, network }: { jackpot: RewardModeState["jackpot"] | undefined; network: string }) {
  const [visible, setVisible] = useState(1);
  return <section className="jackpot-recent-winners">
    <header><small>LATEST DRAWS</small><h3>Previous winners</h3></header>
    {!jackpot?.previousDraws.length && <p>No completed draws yet.</p>}
    {jackpot?.previousDraws.slice(0, visible).map((draw) => <article key={draw.id}>
      <header><small>{new Date(draw.endsAt * 1_000).toLocaleString()}</small></header>
      <div className="jackpot-winners">{draw.winners.map((winner) => <span key={`${draw.id}:${winner.wallet}`}>
        <b>#{winner.place}</b><WalletIdentity wallet={winner.wallet}/><strong>{formatJackpotAmount(winner.amountRaw, draw.rewardDecimals)} {draw.rewardSymbol}</strong>
        {winner.claimed ? winner.claimedSignature ? <a className="jackpot-claim-status claimed" href={solscanTransactionUrl(winner.claimedSignature, network)} target="_blank" rel="noreferrer">Claimed <ExternalLink/></a> : <em className="jackpot-claim-status claimed">Claimed</em> : <em className="jackpot-claim-status">Unclaimed</em>}
      </span>)}</div>
    </article>)}
    {jackpot && visible < jackpot.previousDraws.length && <button className="jackpot-load-more" onClick={() => setVisible((count) => count + 1)}>Earlier draws</button>}
  </section>;
}

function JackpotLeaderboard({ jackpot }: { jackpot: RewardModeState["jackpot"] | undefined }) {
  const [visible, setVisible] = useState(5);
  const winners = useMemo(() => [...(jackpot?.allTimeWinners ?? [])].sort((a, b) => {
    const amountA = BigInt(a.totalAmountRaw);
    const amountB = BigInt(b.totalAmountRaw);
    return amountA === amountB ? b.wins - a.wins : amountA > amountB ? -1 : 1;
  }), [jackpot?.allTimeWinners]);
  return <section className="jackpot-leaderboard">
    <header><span>ALL-TIME</span><b>Top payout recipients</b></header>
    {winners.length ? <>
      <ol>{winners.slice(0, visible).map((winner, index) => <li key={winner.wallet}>
        <i>{index + 1}</i><div><WalletIdentity wallet={winner.wallet}/><small>{winner.wins} win{winner.wins === 1 ? "" : "s"}</small></div>
        <strong>{formatJackpotAmount(winner.totalAmountRaw, jackpot!.rewardDecimals)} <small>{jackpot!.rewardSymbol}</small></strong>
        <em className={`jackpot-claim-status ${winner.unclaimedWins ? "" : "claimed"}`}>{winner.unclaimedWins ? `${winner.unclaimedWins} unclaimed` : "All claimed"}</em>
      </li>)}</ol>
      {visible < winners.length && <button className="jackpot-load-more" onClick={() => setVisible((count) => count + 5)}>Load more</button>}
    </> : <p>No completed jackpot rounds yet.</p>}
  </section>;
}
