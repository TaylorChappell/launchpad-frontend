import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Gift, Globe2, Loader2, LockKeyhole, ShieldAlert, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { CreatorLock, Launch, MarketSnapshot, StockOption, Trade } from "../types";
import { Metric, TokenMark } from "../components/TokenCard";

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
  const [stock, setStock] = useState<StockOption | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [creatorLock, setCreatorLock] = useState<CreatorLock | null>(null);
  const [lockAmount, setLockAmount] = useState("");
  const [lockDays, setLockDays] = useState("365");
  const [creatorBusy, setCreatorBusy] = useState<"lock" | "release" | "claim" | null>(null);
  const [feeQuoteBps, setFeeQuoteBps] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([api.launch(id), api.stocks().catch(() => ({ stocks: [] })), api.marketData(id).catch(() => ({ snapshots: [] }))]).then(([launchData, stockData, marketData]) => {
      if (!active) return;
      setLaunch(launchData.launch);
      setTrades(launchData.trades);
      setSnapshots(marketData.snapshots);
      setCreatorLock(launchData.creatorLock);
      setStock(stockData.stocks.find((item) => item.mint === launchData.launch.stockMint) ?? null);
    }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [id]);

  const chart = useMemo(() => snapshots.map((item) => ({ time: item.sampledAt, price: item.priceUsd })), [snapshots]);


  useEffect(() => {
    if (!launch || wallet.address !== launch.creatorWallet || !lockAmount || !Number(lockDays)) {
      setFeeQuoteBps(0);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const amountRaw = decimalToRaw(lockAmount, launch.tokenDecimals);
        const durationSeconds = Math.round(Number(lockDays) * 86_400);
        if (BigInt(amountRaw) <= 0n) return setFeeQuoteBps(0);
        api.creatorFeeQuote(amountRaw, launch.totalSupplyRaw, durationSeconds)
          .then((quote) => setFeeQuoteBps(quote.feeShareBps))
          .catch(() => setFeeQuoteBps(0));
      } catch {
        setFeeQuoteBps(0);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [launch, wallet.address, lockAmount, lockDays]);

  if (!launch && loaded) return <main className="page empty-state"><h2>Market not found</h2><p>This market is not present in the AQUA index.</p><Link className="primary" to="/">Return to Explore</Link></main>;
  if (!launch) return <main className="page"><div className="page-loading">Loading market…</div></main>;

  const canTrade = launch.status === "live" && config.transactionsEnabled;
  const activeLaunch = launch;
  const stockDecimals = stock?.decimals ?? 6;
  const pairDecimals = launch.pairType === "sol" ? 9 : stockDecimals;
  const explorerUrl = `https://explorer.solana.com/address/${launch.whirlpoolAddress || launch.mint}${config.network === "devnet" ? "?cluster=devnet" : ""}`;

  async function refreshCreatorState() {
    const refreshed = await api.launch(id);
    setLaunch(refreshed.launch);
    setCreatorLock(refreshed.creatorLock);
  }

  async function creatorAction(action: "lock" | "release" | "claim") {
    if (!wallet.address || wallet.address !== launch.creatorWallet) return;
    setCreatorBusy(action);
    try {
      const envelope = action === "lock"
        ? await api.creatorLockTransaction(
            launch.id,
            wallet.address,
            decimalToRaw(lockAmount, launch.tokenDecimals),
            Math.round(Number(lockDays) * 86_400),
          )
        : action === "release"
          ? await api.creatorLockReleaseTransaction(launch.id, wallet.address)
          : await api.creatorFeesClaimTransaction(launch.id, wallet.address);
      const signature = await wallet.sendTransaction(envelope);
      toast.success(`${action === "lock" ? "Creator tokens locked" : action === "release" ? "Creator tokens released" : "Creator fees claimed"} · ${signature.slice(0, 7)}…${signature.slice(-6)}`);
      await refreshCreatorState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Creator ${action} failed.`);
    } finally {
      setCreatorBusy(null);
    }
  }

  async function trade() {
    if (!wallet.address) {
      wallet.setModalOpen(true);
      return;
    }
    if (!canTrade) return;
    setBusy(true);
    try {
      const amountRaw = decimalToRaw(amount, side === "buy" ? pairDecimals : activeLaunch.tokenDecimals);
      if (BigInt(amountRaw) <= 0n) throw new Error("Enter an amount greater than zero.");
      const transaction = await api.tradeTransaction(activeLaunch.id, { trader: wallet.address, side, amountRaw, slippageBps: 150 });
      const signature = await wallet.sendTransaction(transaction);
      toast.success(`Trade confirmed · ${signature.slice(0, 7)}…${signature.slice(-6)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="page token-page">
    <Link className="back" to="/"><ArrowLeft/>Explore markets</Link>
    <section className="token-hero">
      <div className="token-identity"><TokenMark launch={launch} large/><div><div><h1>{launch.name}</h1><span>${launch.symbol}</span><em className={launch.status}>{launch.status === "live" ? "ORCA WHIRLPOOL" : "LAUNCHING"}</em></div><p>{launch.description}</p><footer>{launch.xUrl && <a href={launch.xUrl} target="_blank" rel="noreferrer">X <ExternalLink/></a>}{launch.websiteUrl && <a href={launch.websiteUrl} target="_blank" rel="noreferrer"><Globe2/> Website</a>}<a href={explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink/></a><button onClick={() => { void navigator.clipboard.writeText(launch.mint); toast.success("Mint copied"); }}><Copy/> {launch.mint.slice(0, 5)}…{launch.mint.slice(-4)}</button></footer></div></div>
      <div className="hero-metrics"><Metric label="Orca pair" value={`${launch.symbol} / ${launch.pairSymbol}`}/><Metric label="Stock reward" value={launch.stockSymbol}/><Metric label="TVL" value={launch.aquaIndexed ? `$${compact.format(launch.tvlUsd)}` : "Indexing"}/><Metric label="Market cap" value={launch.aquaIndexed ? `$${compact.format(launch.marketCapUsd)}` : "Indexing"}/></div>
    </section>

    <div className="token-layout"><section className="token-main">
      <div className="chart-panel"><header><div><small>ORCA WHIRLPOOL PRICE</small><b>{launch.aquaIndexed ? money.format(launch.priceUsd) : "Pending"}</b></div><span>{launch.indexingStatus === "indexed" ? "INDEXED" : launch.indexingStatus === "orca_indexed" ? "ORCA INDEXED" : "PENDING INDEXING"}</span></header><div className="chart">{chart.length ? <ResponsiveContainer><AreaChart data={chart}><defs><linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#73edf2" stopOpacity=".25"/><stop offset="1" stopColor="#73edf2" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(137,214,223,.07)"/><YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#648087", fontSize: 10 }}/><Tooltip contentStyle={{ background: "#061820", border: "1px solid rgba(137,214,223,.18)", borderRadius: 8 }}/><Area type="monotone" dataKey="price" stroke="#73edf2" fill="url(#tokenFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <div className="page-loading">Market data will appear after the first index pass.</div>}</div></div>

      <div className="info-grid">
        <div className="info-panel reward"><Gift/><b>Earn {launch.stockSymbol}</b><div><Metric label="Distributed" value={`${compact.format(launch.rewardDistributedUsd)}`}/><Metric label="Reward reserve" value={BigInt(launch.rewardVaultStockRaw || "0") > 0n ? `${formatRaw(launch.rewardVaultStockRaw, stockDecimals)} ${launch.stockSymbol}` : "Accumulating"}/></div><p>Reward weight combines eligible balance and holding time.</p></div>
        <div className="info-panel"><small>ORCA MARKET · {launch.symbol} / {launch.pairSymbol}</small><h2>{launch.status === "live" ? "Live" : "Launching"}</h2><p>{launch.status === "live" ? launch.indexingStatus === "pending_indexing" ? "The Whirlpool is live. AQUA, Orca, and external market indexes are still discovering it." : `The ${launch.pairSymbol}-paired Whirlpool is open and its initial position is permanently locked.` : "The creator is completing the signed launch transactions."}</p>{launch.liquidityLockedPermanently && <span className="pool-lock-status"><LockKeyhole/> Permanent liquidity lock</span>}</div>
      </div>


      {wallet.address === launch.creatorWallet && <section className="creator-fee-panel">
        <header><div><small>CREATOR ALIGNMENT</small><h2>Lock purchased tokens to earn fees</h2></div><span>Up to {(config.creatorLocks.maximumFeeShareBps / 100).toFixed(0)}% of the platform stream</span></header>
        <p>The full original supply remains permanently in Orca liquidity. Only {launch.symbol} held in your creator wallet after launch can be locked; more supply and more time increase your active creator share.</p>
        {creatorLock?.status === "active" ? <div className="creator-lock-active">
          <div><Metric label="Tokens locked" value={formatRaw(creatorLock.amountRaw, launch.tokenDecimals)}/><Metric label="Creator share" value={`${(creatorLock.feeShareBps / 100).toFixed(2)}%`}/><Metric label="Unlocks" value={new Date(creatorLock.unlockAt * 1_000).toLocaleDateString()}/></div>
          <button className="secondary-button" disabled={creatorBusy !== null || Math.floor(Date.now() / 1_000) < creatorLock.unlockAt} onClick={() => void creatorAction("release")}>{creatorBusy === "release" && <Loader2 className="spin"/>}Release matured lock</button>
        </div> : <div className="creator-lock-form">
          <label><span>Amount to lock</span><div className="trade-input"><input value={lockAmount} inputMode="decimal" placeholder="0" onChange={(event) => setLockAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>{launch.symbol}</b></div></label>
          <label><span>Lock duration</span><div className="trade-input"><input value={lockDays} inputMode="numeric" min="1" max="365" onChange={(event) => setLockDays(event.target.value.replace(/[^0-9]/g, ""))}/><b>days</b></div></label>
          <div className="creator-lock-quote"><span>Estimated active creator share</span><strong>{(feeQuoteBps / 100).toFixed(2)}%</strong><small>of the 1% platform fee stream</small></div>
          <button className="primary" disabled={creatorBusy !== null || !Number(lockAmount) || Number(lockDays) < 1 || Number(lockDays) > 365} onClick={() => void creatorAction("lock")}>{creatorBusy === "lock" && <Loader2 className="spin"/>}Lock creator tokens</button>
        </div>}
        <footer><span><b>Unpaid creator fees</b><small>{formatRaw(launch.creatorFeesAccruedRaw, launch.tokenDecimals)} {launch.symbol}</small></span><button className="secondary-button" disabled={creatorBusy !== null || BigInt(launch.creatorFeesAccruedRaw || "0") === 0n} onClick={() => void creatorAction("claim")}>{creatorBusy === "claim" && <Loader2 className="spin"/>}Claim now</button></footer>
      </section>}

      <div className="activity"><header><div><b>Market activity</b><span>Indexed transactions</span></div><strong>{launch.txCount.toLocaleString()} total</strong></header><div className="activity-scroll"><table><thead><tr><th>Type</th><th>Wallet</th><th>{launch.pairSymbol}</th><th>Tokens</th></tr></thead><tbody>{trades.length ? trades.map((item) => <tr key={item.id}><td className={item.side}>{item.side.toUpperCase()}</td><td>{item.wallet}</td><td>{formatRaw(item.gross_quote_raw, pairDecimals)}</td><td>{formatRaw(item.token_amount_raw, launch.tokenDecimals)}</td></tr>) : <tr><td colSpan={4} className="no-activity">No indexed trades yet.</td></tr>}</tbody></table></div></div>
    </section>

    <aside className="trade-card">
      <div className="trade-tabs"><button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")}>Sell</button></div>
      <label>You pay</label><div className="trade-input"><input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>{side === "buy" ? launch.pairSymbol : launch.symbol}</b></div>
      <TradeRow label="Execution" value="Orca Whirlpool" strong/><TradeRow label="Transfer fee" value={`${(launch.transferFeeBps / 100).toFixed(2)}%`}/><TradeRow label="Holder reward" value={`${(config.fees.stockRewardsBps / 100).toFixed(2)}% to ${launch.stockSymbol}`} accent/><TradeRow label="Slippage" value="1.50%"/>
      <button className="primary full" disabled={!Number(amount) || busy || (!canTrade && Boolean(wallet.address))} onClick={() => void trade()}>{busy ? <><Loader2 className="spin"/>Confirming</> : !wallet.address ? "Connect wallet" : !canTrade ? "Trading unavailable" : side === "buy" ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}</button>
      {!canTrade && <div className="locked"><ShieldAlert/><span><b>{launch.status !== "live" ? "Market is launching" : "Transactions disabled"}</b>{launch.status !== "live" ? "Trading opens after every launch transaction confirms." : "The backend is not currently issuing transactions."}</span></div>}
      <div className="creator"><span>Creator</span><b>{launch.creatorWallet}</b><span>Developer buy</span><b>{launch.pairType === "sol" ? launch.devBuySol > 0 ? `${launch.devBuySol} SOL` : "None" : BigInt(launch.devBuyStockRaw || "0") > 0n ? `${formatRaw(launch.devBuyStockRaw, stockDecimals)} ${launch.stockSymbol}` : "None"}</b><span>Holders</span><b><Users/> {compact.format(launch.holderCount)}</b></div>
    </aside></div>
  </main>;
}

function TradeRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return <div className={`trade-row ${strong ? "strong" : ""}`}><span>{label}</span><b className={accent ? "green" : ""}>{value}</b></div>;
}
