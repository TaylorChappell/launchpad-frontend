import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Globe2, Loader2, LockKeyhole, Settings2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
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
import { DexScreenerIcon } from "../components/DexScreenerIcon";
import { launchAge } from "../time";

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
  const amountRaw = BigInt(jackpot.currentPotRaw) * BigInt(prizeBps) / 10_000n;
  return `${formatRaw(amountRaw.toString(), jackpot.rewardDecimals)} ${jackpot.rewardSymbol}`;
}

function solscanTransactionUrl(signature: string, network: string) {
  return `https://solscan.io/tx/${signature}${network === "devnet" ? "?cluster=devnet" : ""}`;
}

export function Token() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const { config } = useRuntime();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [creatorLock, setCreatorLock] = useState<CreatorLock | null>(null);
  const [rewardModeState, setRewardModeState] = useState<RewardModeState | null>(null);
  const [stock, setStock] = useState<StockOption | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesHaveMore, setTradesHaveMore] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1_000));

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const [launchData, marketData] = await Promise.all([
        api.launch(id),
        api.marketData(id).catch(() => ({ snapshots: [] })),
      ]);
      if (!active) return;
      setLaunch(launchData.launch);
      setCreatorLock(launchData.creatorLock);
      setRewardModeState(launchData.rewardModeState);
      setTrades(launchData.trades);
      setTradesHaveMore(Boolean(launchData.tradesHasMore));
      setSnapshots(marketData.snapshots);
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

  const sortedTrades = useMemo(() => [...trades].sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0)), [trades]);

  if (!launch && loaded) return <main className="page empty-state"><h2>Market not found</h2><p>This market is not present in the AQUA index.</p><Link className="primary" to="/">Return to Explore</Link></main>;
  if (!launch) return <main className="page"><div className="page-loading">Loading market…</div></main>;

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
      const result = await api.trades(activeLaunch.id, trades.length, 10);
      setTrades((current) => [...current, ...result.trades]);
      setTradesHaveMore(result.hasMore);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load older activity.");
    } finally {
      setLoadingTrades(false);
    }
  }

  return <MarketGovernanceProvider key={launch.id} launch={launch}><main className="page token-page">
    <div className="token-market-toolbar"><Link className="back" to="/"><ArrowLeft/>Explore markets</Link><div className="token-market-actions"><GovernanceVote market={launch} compact/>{config.marketGovernanceEnabled && <MarketProposals/>}{wallet.address === launch.creatorWallet && <Link className="creator-manage-button" to={"/manage/" + launch.id}><Settings2/>Manage coin</Link>}</div></div>
    <section className="token-hero">
      <div className="token-identity"><TokenMark launch={launch} large/><div><div><h1>{launch.name}</h1><span>${launch.symbol}</span><em className={launch.status}>{launch.status === "live" ? "ORCA WHIRLPOOL" : "LAUNCHING"}</em><em className={`reward-mode-badge ${rewardMode}`}>{modeLabel}</em>{launch.dexPaid && <span className="market-dex-paid" title="DEX Screener profile paid"><DexScreenerIcon/><span>DEX paid</span></span>}{verifiedCreatorLock && creatorLockUrl && <div className="creator-lock-market"><i><LockKeyhole/></i><span><small>VERIFIED CREATOR LOCK</small><strong>{lockedPercentLabel} of supply</strong></span><a href={creatorLockUrl} target="_blank" rel="noreferrer">View lock <ExternalLink/></a></div>}</div><p>{launch.description}</p><footer><span className="market-launch-age">{launchAge(launch.launchedAt, launch.createdAt)}</span>{launch.xUrl && <a href={launch.xUrl} target="_blank" rel="noreferrer">X <ExternalLink/></a>}{launch.websiteUrl && <a href={launch.websiteUrl} target="_blank" rel="noreferrer"><Globe2/> Website</a>}<a href={explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink/></a>{launch.marketPolicyAddress && <a href={solscanAccountUrl(launch.marketPolicyAddress, config.network)} target="_blank" rel="noreferrer">Mode policy <ExternalLink/></a>}<button onClick={() => { void navigator.clipboard.writeText(launch.mint); toast.success("Mint copied"); }}><Copy/> {launch.mint.slice(0, 5)}…{launch.mint.slice(-4)}</button></footer></div></div>
      <div className="hero-metrics"><Metric label="Orca pair" value={`${launch.symbol} / ${launch.pairSymbol}`}/><Metric label={rewardMode === "buyback_burn" ? "Burn asset" : rewardMode === "jackpot" ? "Prize asset" : "Reward asset"} value={rewardMode === "buyback_burn" ? launch.symbol : rewardMode === "jackpot" ? "SOL" : launch.stockSymbol}/><Metric label="TVL" value={launch.aquaIndexed ? `$${compact.format(launch.tvlUsd)}` : "Indexing"}/><Metric label="Market cap" value={launch.aquaIndexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/></div>
    </section>

    <div className="token-layout"><section className="token-main">
      <div className="chart-panel market-cap-chart-panel"><header><div><small>MARKET CAP</small><b>{launch.aquaIndexed ? money.format(launch.marketCapUsd) : "Pending"}</b></div><span className={`index-badge ${launch.indexingStatus}`}>{launch.indexingStatus === "indexed" ? "INDEXED" : launch.indexingStatus === "orca_indexed" ? "ORCA INDEXED" : "PENDING INDEXING"}</span></header><div className="chart market-line-shell"><MarketCapLine snapshots={snapshots}/></div></div>

      <div className="info-grid single reward-mode-market-panel">
        {rewardMode === "holder_rewards" && <section className="market-reward-panel"><header><div><small>HOLDER REWARDS</small><h2>Earn {launch.stockSymbol}</h2></div><span className="reward-live-label">Accumulating</span></header><div className="reward-stat-row"><Metric label="Total accumulated" value={money.format(launch.rewardAccumulatedUsd)}/><Metric label="Available to all holders" value={money.format(launch.rewardRedeemableUsd)}/></div><footer>Rewards follow your balance and time held. Claim them together on the Rewards page.</footer></section>}
        {rewardMode === "buyback_burn" && <section className="market-reward-panel"><header><div><small>BUYBACK &amp; BURN</small><h2>Reducing the supply</h2></div><span className="reward-live-label">Market buybacks</span></header><div className="reward-stat-row"><Metric label="SOL spent on buybacks" value={`${compact.format(rewardModeState?.buybackBurn.totalSol ?? 0)} SOL`}/><Metric label={`${launch.symbol} permanently burned`} value={formatCompactRaw(rewardModeState?.buybackBurn.totalTokenRaw, launch.tokenDecimals)}/></div><footer>{rewardModeState?.buybackBurn.lastBurnAt ? "Last burn · " + new Date(rewardModeState.buybackBurn.lastBurnAt).toLocaleString() : "The reward share buys this coin through its pool and burns the purchased tokens."}</footer></section>}
        {rewardMode === "jackpot" && <section className="market-reward-panel market-jackpot">
          <header><div><small>HOURLY JACKPOT</small><h2>Five places. One draw.</h2></div><div className="jackpot-next-draw"><span>Next draw</span><strong>{formatCountdown(jackpotSeconds)}</strong></div></header>
          <div className="jackpot-podium" aria-label="Prize amounts for the next five winners">
            {[["1ST", 5_000], ["2ND", 2_000], ["3RD", 2_000], ["4TH", 500], ["5TH", 500]].map(([place, bps]) => {
              const amount = jackpotPrizeAmount(jackpot, Number(bps));
              return <div key={place} className={"podium-place place-" + String(place).toLowerCase()}><div><small>{place}</small><b title={amount}>{amount}</b></div><span className="podium-column"><em>{place}</em></span></div>;
            })}
          </div>
        </section>}
      </div>

      <CommunityProposalVotes/>

      <div className="activity"><header><div><b>Market activity</b><span>Newest transactions first</span></div><strong>{launch.txCount.toLocaleString()} total</strong></header><div className="activity-scroll"><table><thead><tr><th>Type</th><th>Wallet</th><th>Time</th><th>{launch.pairSymbol}</th><th>Tokens</th></tr></thead><tbody>{sortedTrades.length ? sortedTrades.map((item) => <tr key={item.id}><td className={item.side}>{item.side.toUpperCase()}</td><td><a href={solscanAccountUrl(item.wallet, config.network)} target="_blank" rel="noreferrer" title={item.wallet}>{item.wallet.slice(0,4)}…{item.wallet.slice(-4)}</a></td><td>{item.created_at ? new Date(Number(item.created_at) < 1e12 ? Number(item.created_at) * 1000 : Number(item.created_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td>{formatRaw(item.gross_quote_raw, pairDecimals)}</td><td title={formatRaw(item.token_amount_raw, launch.tokenDecimals)}>{compact.format(Number(item.token_amount_raw) / 10 ** launch.tokenDecimals)}</td></tr>) : <tr><td colSpan={5} className="no-activity">No indexed trades yet.</td></tr>}</tbody></table></div>{tradesHaveMore && <button className="activity-load-more" disabled={loadingTrades} onClick={() => void loadMoreTrades()}>{loadingTrades ? <><Loader2 className="spin"/>Loading</> : "Load more"}</button>}</div>
    </section>

    <aside className="token-side"><TradePanel key={launch.id} launch={launch} pairDecimals={launch.pairType === "sol" ? 9 : stock?.decimals ?? null}/><details className="market-facts"><summary>Market details</summary><dl><div><dt>Creator</dt><dd><a href={solscanAccountUrl(launch.creatorWallet, config.network)} target="_blank" rel="noreferrer">{launch.creatorWallet.slice(0, 5)}…{launch.creatorWallet.slice(-4)} <ExternalLink size={12}/></a></dd></div><div><dt>Developer buy</dt><dd>{launch.pairType === "sol" ? launch.devBuySol > 0 ? `${launch.devBuySol} SOL` : "None" : BigInt(launch.devBuyStockRaw || "0") > 0n ? `${formatRaw(launch.devBuyStockRaw, stockDecimals)} ${launch.pairSymbol}` : "None"}</dd></div><div><dt>Holders</dt><dd>{compact.format(launch.holderCount)}</dd></div><div><dt>Pool</dt><dd><a href={explorerUrl} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={12}/></a></dd></div></dl></details><DexFundingVote/>{rewardMode === "jackpot" && <><JackpotHistory jackpot={jackpot} network={config.network}/><JackpotLeaderboard jackpot={jackpot}/></>}</aside></div>
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
        <b>#{winner.place}</b><code>{winner.wallet.slice(0,4)}…{winner.wallet.slice(-4)}</code><strong>{formatRaw(winner.amountRaw, draw.rewardDecimals)} {draw.rewardSymbol}</strong>
        {winner.claimed && winner.claimedSignature ? <a className="jackpot-claim-status claimed" href={solscanTransactionUrl(winner.claimedSignature, network)} target="_blank" rel="noreferrer">Claimed <ExternalLink/></a> : <em className="jackpot-claim-status">Unclaimed</em>}
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
    <header><span>ALL-TIME WINNERS</span><b>Highest payouts</b></header>
    {winners.length ? <>
      <ol>{winners.slice(0, visible).map((winner, index) => <li key={winner.wallet}>
        <i>{index + 1}</i><div><code>{winner.wallet.slice(0,4)}…{winner.wallet.slice(-4)}</code><small>{winner.wins} win{winner.wins === 1 ? "" : "s"}</small></div>
        <strong>{formatRaw(winner.totalAmountRaw, jackpot!.rewardDecimals)} <small>{jackpot!.rewardSymbol}</small></strong>
        <em className={`jackpot-claim-status ${winner.unclaimedWins ? "" : "claimed"}`}>{winner.unclaimedWins ? `${winner.unclaimedWins} unclaimed` : "All claimed"}</em>
      </li>)}</ol>
      {visible < winners.length && <button className="jackpot-load-more" onClick={() => setVisible((count) => count + 5)}>Load more</button>}
    </> : <p>No completed jackpot rounds yet.</p>}
  </section>;
}
