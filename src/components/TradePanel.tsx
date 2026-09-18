import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { Launch } from "../types";
import { displayTokenAmount, quoteAmounts } from "../trade-quote";

type Quote = ReturnType<typeof quoteAmounts> & { key: string; route: string; receivedAt: number };

export function TradePanel({ launch, pairDecimals }: { launch: Launch; pairDecimals: number | null }) {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [currency, setCurrency] = useState<"SOL" | "PAIR">("SOL");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(150);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [signature, setSignature] = useState("");
  const [clock, setClock] = useState(Date.now());
  const executing = useRef(false);
  const routed = side === "buy" && launch.pairType !== "sol" && config.solBuyRouting?.enabled && currency === "SOL";
  const inputSymbol = side === "sell" ? launch.symbol : routed ? "SOL" : launch.pairSymbol;
  const outputSymbol = side === "buy" ? launch.symbol : launch.pairSymbol;
  const inputDecimals = side === "sell" ? launch.tokenDecimals : routed ? 9 : pairDecimals;
  const outputDecimals = side === "buy" ? launch.tokenDecimals : pairDecimals;
  const buyCurrency = routed ? "SOL" : "PAIR";
  const canTrade = launch.status === "live" && config.transactionsEnabled;
  let raw = "";
  try { if (inputDecimals !== null && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(amount)) raw = decimalToRaw(amount, inputDecimals); } catch { /* Invalid precision must not produce a quote. */ }
  const valid = /^\d+$/.test(raw) && BigInt(raw) > 0n && outputDecimals !== null;
  const key = [launch.id, side, buyCurrency, raw, slippage].join(":");
  const current = quote?.key === key && clock - quote.receivedAt < 25_000 ? quote : null;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setQuote(null); setQuoteError(""); setPending(valid && canTrade);
    if (!valid || !canTrade || busy) { setPending(false); return; }
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      setPending(true);
      try {
        const result = await api.tradeQuote(launch.id, { side, buyCurrency, amountRaw: raw, slippageBps: slippage }, controller.signal);
        const amounts = quoteAmounts(result.quote);
        if (!controller.signal.aborted) { setQuote({ ...amounts, route: result.route, key, receivedAt: Date.now() }); setClock(Date.now()); setQuoteError(""); }
      } catch (error) {
        if (!controller.signal.aborted) { setQuote(null); setQuoteError(error instanceof Error ? error.message : "Quote unavailable. Please retry."); }
      } finally { loading = false; if (!controller.signal.aborted) setPending(false); }
    };
    const delay = window.setTimeout(() => void load(), 350);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15_000);
    return () => { controller.abort(); window.clearTimeout(delay); window.clearInterval(interval); };
  }, [key, valid, canTrade, busy, refresh, launch.id, side, buyCurrency, raw, slippage]);

  async function execute() {
    if (!wallet.address) { wallet.setModalOpen(true); return; }
    if (!current || !valid || !canTrade || executing.current || Date.now() - current.receivedAt >= 25_000) return;
    executing.current = true; setBusy(true); setSignature(""); setStatus("Preparing your transaction…");
    let conversionConfirmed = false;
    try {
      const transaction = await api.tradeTransaction(launch.id, { trader: wallet.address, side, buyCurrency, amountRaw: raw, slippageBps: slippage });
      if (transaction.route !== current.route) throw new Error("The route changed. Refresh the quote and review it before continuing.");
      if (!transaction.followUp) {
        const minimum = transaction.quote ? quoteAmounts(transaction.quote).minimum : transaction.minimumOutputRaw;
        if (!minimum || BigInt(minimum) < BigInt(current.minimum)) throw new Error("The quote changed. Refresh and review the new minimum received.");
      }
      setStatus(transaction.followUp ? `Approve SOL → ${launch.pairSymbol} in your wallet (1 of 2).` : "Approve the trade in your wallet.");
      let confirmed = await wallet.sendTransaction(transaction);
      if (transaction.followUp) {
        conversionConfirmed = true;
        setStatus(`Conversion confirmed. Preparing the ${launch.symbol} purchase (2 of 2)…`);
        const buy = await api.tradeTransaction(launch.id, { trader: wallet.address, side: "buy", buyCurrency: "PAIR", amountRaw: transaction.followUp.amountRaw, slippageBps: slippage });
        if (!buy.quote || BigInt(quoteAmounts(buy.quote).minimum) < BigInt(current.minimum)) throw new Error("The market moved below the reviewed minimum.");
        setStatus(`Approve the ${launch.symbol} purchase in your wallet (2 of 2).`);
        confirmed = await wallet.sendTransaction(buy);
      }
      setSignature(confirmed); setStatus("Trade confirmed."); setAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The trade could not complete.";
      setStatus(conversionConfirmed ? `SOL conversion confirmed, but the purchase did not complete. Your ${launch.pairSymbol} remains in your wallet; select ${launch.pairSymbol} to buy with it. ${message}` : message);
    } finally { executing.current = false; setBusy(false); setRefresh((value) => value + 1); }
  }

  return <section className="trade-card execution-panel" aria-label="Trade this market">
    <header><h2>Trade {launch.symbol}</h2><span>Orca market</span></header>
    <fieldset disabled={busy}>
      <div className="trade-tabs" aria-label="Trade direction">{(["buy", "sell"] as const).map((value) => <button key={value} aria-pressed={side === value} className={side === value ? "active" : ""} onClick={() => { setSide(value); setAmount(""); setStatus(""); }}>{value === "buy" ? "Buy" : "Sell"}</button>)}</div>
      {side === "buy" && launch.pairType !== "sol" && <div className="trade-pay-route"><span>Pay with</span><div><button disabled={!config.solBuyRouting?.enabled} aria-pressed={Boolean(routed)} onClick={() => { setCurrency("SOL"); setAmount(""); }}>SOL</button><button aria-pressed={!routed} onClick={() => { setCurrency("PAIR"); setAmount(""); }}>{launch.pairSymbol}</button></div></div>}
      <label htmlFor="trade-amount">You pay</label><div className="trade-input"><input id="trade-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => { const value = event.target.value.replace(",", "."); if (/^\d*\.?\d*$/.test(value)) setAmount(value); }}/><b>{inputSymbol}</b></div>
      {inputSymbol === "SOL" && side === "buy" && <div className="trade-presets">{["0.1", "0.5", "1"].map((value) => <button key={value} onClick={() => setAmount(value)}>{value} SOL</button>)}</div>}
      <div className="trade-receive"><span>Estimated received</span><strong>{current && outputDecimals !== null ? displayTokenAmount(current.estimated, outputDecimals) : "—"}</strong><b>{outputSymbol}</b></div>
      <div className="execution-detail"><span>Minimum received</span><b>{current && outputDecimals !== null ? `${displayTokenAmount(current.minimum, outputDecimals)} ${outputSymbol}` : "—"}</b></div>
      <label className="slippage-control">Slippage<select value={slippage} onChange={(event) => setSlippage(Number(event.target.value))}><option value={50}>0.5%</option><option value={100}>1%</option><option value={150}>1.5%</option><option value={300}>3%</option></select></label>
    </fieldset>
    <div className="quote-status" aria-live="polite">{pending ? <span><Loader2 className="spin"/>Updating quote…</span> : quoteError ? <span className="quote-error">{quoteError}</span> : current ? <span>Quote updated {Math.max(0, Math.floor((clock - current.receivedAt) / 1000))}s ago</span> : <span>{amount && !valid ? "Enter a valid amount within the asset’s decimal precision." : valid ? "Refresh for a current quote." : "Enter an amount to get a live quote."}</span>}<button aria-label="Refresh trade quote" disabled={!valid || busy || pending} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={14}/></button></div>
    {current?.route === "jupiter_then_orca" && <p className="trade-route-note">Two wallet approvals: SOL converts to {launch.pairSymbol}, then buys {launch.symbol}. The estimate uses the minimum conversion output.</p>}
    <button className="primary full" disabled={busy || (Boolean(wallet.address) && (!canTrade || !current || pending))} onClick={() => void execute()}>{busy ? <><Loader2 className="spin"/>Waiting for confirmation</> : !wallet.address ? "Connect wallet" : !canTrade ? "Trading unavailable" : !current ? "Quote required" : `${side === "buy" ? "Buy" : "Sell"} ${launch.symbol}`}</button>
    {!canTrade && <p className="trade-route-note">{launch.status !== "live" ? "Trading opens after launch confirmation." : "Transactions are currently unavailable."}</p>}
    {status && <p className="trade-result" role="status">{status}{signature && <a href={`https://solscan.io/tx/${signature}${config.network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12}/></a>}</p>}
    <details className="execution-breakdown"><summary>Fees &amp; execution</summary><dl><div><dt>Route</dt><dd>{current ? current.route === "orca" ? "Orca Whirlpool" : current.route === "jupiter" ? "Jupiter" : `Jupiter → ${launch.pairSymbol} → Orca` : "Quoted before approval"}</dd></div><div><dt>Token transfer fee</dt><dd>{(launch.transferFeeBps / 100).toFixed(2)}%</dd></div></dl><p>Swap quotes account for applicable token transfer fees. Solana transaction fees and account rent are additional and shown in your wallet. Quotes can change before approval.</p></details>
  </section>;
}
