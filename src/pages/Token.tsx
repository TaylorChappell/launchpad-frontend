import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Globe2, Loader2, LockKeyhole, Settings2, ShieldAlert, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { CreatorLock, Launch, MarketSnapshot, StockOption, Trade } from "../types";
import { AssetMark, Metric, TokenMark } from "../components/TokenCard";
import { MarketCapLine } from "../components/MarketCapCandles";

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

export function Token() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const { config } = useRuntime();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [creatorLock, setCreatorLock] = useState<CreatorLock | null>(null);
  const [stock, setStock] = useState<StockOption | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesHaveMore, setTradesHaveMore] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [buyCurrency, setBuyCurrency] = useState<"SOL" | "PAIR">("SOL");
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.launch(id), api.stocks().catch(() => ({ stocks: [] })), api.marketData(id).catch(() => ({ snapshots: [] }))]).then(([launchData, stockData, marketData]) => {
      if (!active) return;
      setLaunch(launchData.launch);
      setCreatorLock(launchData.creatorLock);
      setTrades(launchData.trades);
      setTradesHaveMore(Boolean(launchData.tradesHasMore));
      setSnapshots(marketData.snapshots);
      setStock(stockData.stocks.find((item) => item.mint === launchData.launch.stockMint) ?? null);
    }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [id]);

  const sortedTrades = useMemo(() => [...trades].sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0)), [trades]);

  if (!launch && loaded) return <main className="page empty-state"><h2>Market not found</h2><p>This market is not present in the AQUA index.</p><Link className="primary" to="/">Return to Explore</Link></main>;
  if (!launch) return <main className="page"><div className="page-loading">Loading market…</div></main>;

  const canTrade = launch.status === "live" && config.transactionsEnabled;
  const activeLaunch = launch;
  const stockDecimals = stock?.decimals ?? 6;
  const pairDecimals = launch.pairType === "sol" ? 9 : stockDecimals;
  const solRoutingAvailable = launch.pairType === "sol" || Boolean(config.solBuyRouting?.enabled);
  const routedSolBuy = side === "buy" && launch.pairType !== "sol" && solRoutingAvailable && buyCurrency === "SOL";
  const buyInputDecimals = routedSolBuy ? 9 : pairDecimals;
  const buyInputSymbol = routedSolBuy ? "SOL" : launch.pairSymbol;
  const explorerUrl = `https://explorer.solana.com/address/${launch.whirlpoolAddress || launch.mint}${config.network === "devnet" ? "?cluster=devnet" : ""}`;
  const lockedPercent = creatorLock?.status === "active" && BigInt(creatorLock.totalSupplyRaw || "0") > 0n
    ? Number(BigInt(creatorLock.amountRaw) * 1_000_000n / BigInt(creatorLock.totalSupplyRaw)) / 10_000
    : 0;
  const lockedPercentLabel = lockedPercent === 0 ? "0%" : `${lockedPercent.toFixed(lockedPercent < 0.01 ? 4 : 2)}%`;

  async function trade() {
    if (!wallet.address) {
      wallet.setModalOpen(true);
      return;
    }
    if (!canTrade) return;
    setBusy(true);
    try {
      const amountRaw = decimalToRaw(amount, side === "buy" ? buyInputDecimals : activeLaunch.tokenDecimals);
      if (BigInt(amountRaw) <= 0n) throw new Error("Enter an amount greater than zero.");
      const transaction = await api.tradeTransaction(activeLaunch.id, { trader: wallet.address, side, buyCurrency: routedSolBuy ? "SOL" : "PAIR", amountRaw, slippageBps: 150 });
      let signature = await wallet.sendTransaction(transaction);
      if (transaction.followUp) {
        try {
          const buy = await api.tradeTransaction(activeLaunch.id, { trader: wallet.address, side: "buy", buyCurrency: "PAIR", amountRaw: transaction.followUp.amountRaw, slippageBps: 150 });
          signature = await wallet.sendTransaction(buy);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "The Orca purchase was not completed.";
          throw new Error(`SOL was converted to ${activeLaunch.pairSymbol}, but the final buy did not complete. Your ${activeLaunch.pairSymbol} remains in your wallet. ${detail}`);
        }
      }
      toast.success(`Trade confirmed · ${signature.slice(0, 7)}…${signature.slice(-6)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  }

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

  return <main className="page token-page">
    <Link className="back" to="/"><ArrowLeft/>Explore markets</Link>
    <section className="token-hero">
      <div className="token-identity"><TokenMark launch={launch} large/><div><div><h1>{launch.name}</h1><span>${launch.symbol}</span><em className={launch.status}>{launch.status === "live" ? "ORCA WHIRLPOOL" : "LAUNCHING"}</em><span className="creator-lock-market"><LockKeyhole/>{lockedPercentLabel} creator locked</span></div><p>{launch.description}</p><footer>{launch.xUrl && <a href={launch.xUrl} target="_blank" rel="noreferrer">X <ExternalLink/></a>}{launch.websiteUrl && <a href={launch.websiteUrl} target="_blank" rel="noreferrer"><Globe2/> Website</a>}<a href={explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink/></a><button onClick={() => { void navigator.clipboard.writeText(launch.mint); toast.success("Mint copied"); }}><Copy/> {launch.mint.slice(0, 5)}…{launch.mint.slice(-4)}</button></footer></div></div>
      <div className="hero-metrics"><Metric label="Orca pair" value={`${launch.symbol} / ${launch.pairSymbol}`}/><Metric label="Stock reward" value={launch.stockSymbol}/><Metric label="TVL" value={launch.aquaIndexed ? `$${compact.format(launch.tvlUsd)}` : "Indexing"}/><Metric label="Market cap" value={launch.aquaIndexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/></div>
    </section>

    <div className="token-layout"><section className="token-main">
      <div className="chart-panel market-cap-chart-panel"><header><div><small>MARKET CAP</small><b>{launch.aquaIndexed ? money.format(launch.marketCapUsd) : "Pending"}</b></div><span>{launch.indexingStatus === "indexed" ? "INDEXED" : launch.indexingStatus === "orca_indexed" ? "ORCA INDEXED" : "PENDING INDEXING"}</span></header><div className="chart market-line-shell"><MarketCapLine snapshots={snapshots}/></div></div>

      <div className="info-grid single">
        <div className="info-panel reward"><AssetMark launch={launch} reward/><b>Earn {launch.stockSymbol}</b><div><Metric label="Total accumulated" value={money.format(launch.rewardAccumulatedUsd)}/><Metric label="Redeemable by holders" value={money.format(launch.rewardRedeemableUsd)}/></div><p>Shown in dollars. Allocations use eligible balance and time held; claimed rewards reduce the redeemable total.</p></div>
      </div>

      {wallet.address === launch.creatorWallet && <Link className="creator-manage-button" to={"/manage/" + launch.id}><Settings2/>Manage coin</Link>}

      <div className="activity"><header><div><b>Market activity</b><span>Newest transactions first</span></div><strong>{launch.txCount.toLocaleString()} total</strong></header><div className="activity-scroll"><table><thead><tr><th>Type</th><th>Wallet</th><th>{launch.pairSymbol}</th><th>Tokens</th></tr></thead><tbody>{sortedTrades.length ? sortedTrades.map((item) => <tr key={item.id}><td className={item.side}>{item.side.toUpperCase()}</td><td>{item.wallet}</td><td>{formatRaw(item.gross_quote_raw, pairDecimals)}</td><td>{formatRaw(item.token_amount_raw, launch.tokenDecimals)}</td></tr>) : <tr><td colSpan={4} className="no-activity">No indexed trades yet.</td></tr>}</tbody></table></div>{tradesHaveMore && <button className="activity-load-more" disabled={loadingTrades} onClick={() => void loadMoreTrades()}>{loadingTrades ? <><Loader2 className="spin"/>Loading</> : "Load more"}</button>}</div>
    </section>

    <aside className="trade-card">
      <div className="trade-tabs"><button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")}>Sell</button></div>
      {side === "buy" && launch.pairType !== "sol" && <div className="trade-pay-route"><span>Pay with</span><div><button className={buyCurrency === "SOL" ? "active" : ""} disabled={!solRoutingAvailable} onClick={() => setBuyCurrency("SOL")}>SOL</button><button className={buyCurrency === "PAIR" ? "active" : ""} onClick={() => setBuyCurrency("PAIR")}>{launch.pairSymbol}</button></div></div>}
      <label>You pay</label><div className="trade-input"><input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>{side === "buy" ? buyInputSymbol : launch.symbol}</b></div>
      <TradeRow label="Execution" value={routedSolBuy ? "Jupiter → Orca Whirlpool" : "Orca Whirlpool"} strong/><TradeRow label="Transfer fee" value={`${(launch.transferFeeBps / 100).toFixed(2)}%`}/><TradeRow label="Holder reward" value={`${(config.fees.stockRewardsBps / 100).toFixed(2)}% to ${launch.stockSymbol}`} accent/><TradeRow label="Slippage" value="1.50%"/>
      <button className="primary full" disabled={!Number(amount) || busy || (!canTrade && Boolean(wallet.address))} onClick={() => void trade()}>{busy ? <><Loader2 className="spin"/>Confirming</> : !wallet.address ? "Connect wallet" : !canTrade ? "Trading unavailable" : side === "buy" ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}</button>
      {!canTrade && <div className="locked"><ShieldAlert/><span><b>{launch.status !== "live" ? "Market is launching" : "Transactions disabled"}</b>{launch.status !== "live" ? "Trading opens after every launch transaction confirms." : "The backend is not currently issuing transactions."}</span></div>}
      <div className="creator"><span>Creator</span><b>{launch.creatorWallet}</b><span>Developer buy</span><b>{launch.pairType === "sol" ? launch.devBuySol > 0 ? `${launch.devBuySol} SOL` : "None" : BigInt(launch.devBuyStockRaw || "0") > 0n ? `${formatRaw(launch.devBuyStockRaw, stockDecimals)} ${launch.stockSymbol}` : "None"}</b><span>Holders</span><b><Users/> {compact.format(launch.holderCount)}</b></div>
    </aside></div>
  </main>;
}

function TradeRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return <div className={`trade-row ${strong ? "strong" : ""}`}><span>{label}</span><b className={accent ? "green" : ""}>{value}</b></div>;
}
