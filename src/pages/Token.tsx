import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Gift, Globe2, Loader2, LockKeyhole, ShieldAlert, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { Launch, StockOption, Trade } from "../types";
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
  const [loaded, setLoaded] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.launch(id), api.stocks().catch(() => ({ stocks: [] }))]).then(([launchData, stockData]) => {
      if (!active) return;
      setLaunch(launchData.launch);
      setTrades(launchData.trades);
      setStock(stockData.stocks.find((item) => item.mint === launchData.launch.stockMint) ?? null);
    }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [id]);

  const chart = useMemo(() => !launch ? [] : Array.from({ length: 38 }, (_, index) => ({ index, price: Math.max(.000001, launch.priceUsd || launch.initialPrice || .0001) * (.78 + index / 145) * (1 + Math.sin(index * .67) * .025) })), [launch]);

  if (!launch && loaded) return <main className="page empty-state"><h2>Market not found</h2><p>This market is not present in the AQUA index.</p><Link className="primary" to="/">Return to Explore</Link></main>;
  if (!launch) return <main className="page"><div className="page-loading">Loading market…</div></main>;

  const canTrade = launch.status === "live" && config.transactionsEnabled;
  const activeLaunch = launch;
  const stockDecimals = stock?.decimals ?? 6;
  const explorerUrl = `https://explorer.solana.com/address/${launch.whirlpoolAddress || launch.mint}${config.network === "devnet" ? "?cluster=devnet" : ""}`;

  async function trade() {
    if (!wallet.address) {
      wallet.setModalOpen(true);
      return;
    }
    if (!canTrade) return;
    setBusy(true);
    try {
      const amountRaw = decimalToRaw(amount, side === "buy" ? stockDecimals : activeLaunch.tokenDecimals);
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
      <div className="hero-metrics"><Metric label="Stock reward" value={launch.stockSymbol}/><Metric label="Distributed" value={`$${compact.format(launch.rewardDistributedUsd)}`}/><Metric label="Holders" value={compact.format(launch.holderCount)}/><Metric label="Market cap" value={`$${compact.format(launch.marketCapUsd)}`}/></div>
    </section>

    <div className="token-layout"><section className="token-main">
      <div className="chart-panel"><header><div><small>ORCA WHIRLPOOL PRICE</small><b>{money.format(launch.priceUsd || launch.initialPrice)}</b></div><span>{launch.status === "live" ? "INDEXED" : "OPENING"}</span></header><div className="chart"><ResponsiveContainer><AreaChart data={chart}><defs><linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#73edf2" stopOpacity=".25"/><stop offset="1" stopColor="#73edf2" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(137,214,223,.07)"/><YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#648087", fontSize: 10 }}/><Tooltip contentStyle={{ background: "#061820", border: "1px solid rgba(137,214,223,.18)", borderRadius: 8 }}/><Area type="monotone" dataKey="price" stroke="#73edf2" fill="url(#tokenFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></div>

      <div className="info-grid">
        <div className="info-panel reward"><Gift/><b>Earn {launch.stockSymbol}</b><div><Metric label="Distributed" value={`$${compact.format(launch.rewardDistributedUsd)}`}/><Metric label="Reward reserve" value={BigInt(launch.rewardVaultStockRaw || "0") > 0n ? `${formatRaw(launch.rewardVaultStockRaw, stockDecimals)} ${launch.stockSymbol}` : "Accumulating"}/></div><p>Reward weight combines eligible balance and holding time.</p></div>
        <div className="info-panel"><small>ORCA MARKET</small><h2>{launch.status === "live" ? "Live" : "Launching"}</h2><p>{launch.status === "live" ? "The stock-paired Whirlpool is open and its initial position is permanently locked." : "The creator is completing the signed launch transactions."}</p>{launch.liquidityLockedPermanently && <span className="pool-lock-status"><LockKeyhole/> Permanent liquidity lock</span>}</div>
      </div>

      <div className="activity"><header><div><b>Market activity</b><span>Indexed transactions</span></div><strong>{launch.txCount.toLocaleString()} total</strong></header><div className="activity-scroll"><table><thead><tr><th>Type</th><th>Wallet</th><th>{launch.stockSymbol}</th><th>Tokens</th></tr></thead><tbody>{trades.length ? trades.map((item) => <tr key={item.id}><td className={item.side}>{item.side.toUpperCase()}</td><td>{item.wallet}</td><td>{formatRaw(item.gross_quote_raw, stockDecimals)}</td><td>{formatRaw(item.token_amount_raw, launch.tokenDecimals)}</td></tr>) : <tr><td colSpan={4} className="no-activity">No indexed trades yet.</td></tr>}</tbody></table></div></div>
    </section>

    <aside className="trade-card">
      <div className="trade-tabs"><button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")}>Sell</button></div>
      <label>You pay</label><div className="trade-input"><input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>{side === "buy" ? launch.stockSymbol : launch.symbol}</b></div>
      <TradeRow label="Execution" value="Orca Whirlpool" strong/><TradeRow label="Transfer fee" value={`${(launch.transferFeeBps / 100).toFixed(2)}%`}/><TradeRow label="Holder reward" value={`${(config.fees.stockRewardsBps / 100).toFixed(2)}% to ${launch.stockSymbol}`} accent/><TradeRow label="Slippage" value="1.50%"/>
      <button className="primary full" disabled={!Number(amount) || busy || (!canTrade && Boolean(wallet.address))} onClick={() => void trade()}>{busy ? <><Loader2 className="spin"/>Confirming</> : !wallet.address ? "Connect wallet" : !canTrade ? "Trading unavailable" : side === "buy" ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}</button>
      {!canTrade && <div className="locked"><ShieldAlert/><span><b>{launch.status !== "live" ? "Market is launching" : "Transactions disabled"}</b>{launch.status !== "live" ? "Trading opens after every launch transaction confirms." : "The backend is not currently issuing transactions."}</span></div>}
      <div className="creator"><span>Creator</span><b>{launch.creatorWallet}</b><span>Developer buy</span><b>{BigInt(launch.devBuyStockRaw || "0") > 0n ? `${formatRaw(launch.devBuyStockRaw, stockDecimals)} ${launch.stockSymbol}` : "None"}</b><span>Holders</span><b><Users/> {compact.format(launch.holderCount)}</b></div>
    </aside></div>
  </main>;
}

function TradeRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return <div className={`trade-row ${strong ? "strong" : ""}`}><span>{label}</span><b className={accent ? "green" : ""}>{value}</b></div>;
}
