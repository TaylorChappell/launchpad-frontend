import { TradeInfo } from "./TradeInfo";
import { rawUsd, usd } from "../money";
import { isPriceLive } from "../market-prices";
import { useAssetBalance } from "../useAssetBalance";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { Launch } from "../types";
import { displayTokenAmount, quoteAmounts } from "../trade-quote";

function previousTrade(key:string):{signature:string;status:string}|null{try{const value=JSON.parse(localStorage.getItem(key)??"null");return value&&/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(value.signature)&&typeof value.status==="string"&&Date.now()-value.at<86_400_000?value:null;}catch{return null;}}
type Quote = ReturnType<typeof quoteAmounts> & { key: string; route: string; assetKey: string; receivedAt: number; impact: number | null };

export function TradePanel({ launch, pairDecimals, initialSide = "buy", onBusyChange }: { launch: Launch; pairDecimals: number | null; initialSide?: "buy" | "sell"; onBusyChange?: (busy: boolean) => void }) {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [currency, setCurrency] = useState<"SOL" | "PAIR">("SOL");
  const [amount, setAmount] = useState("");
  const [slippageInput, setSlippageInput] = useState("15");
  const slippage = Math.round(Number(slippageInput) * 100);
  const validSlippage = /^\d+(?:\.\d{0,2})?$/.test(slippageInput) && slippage >= 0 && slippage <= 5_000;
  const [acceptedRisk,setAcceptedRisk] = useState(false);
  const highSlippage = slippage > 1500;
  useEffect(()=>setAcceptedRisk(false),[slippageInput,launch.id,side,amount]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const tradeStorageKey=["aqua:last-trade",config.network,wallet.address,launch.id].join(":");
  const [status, setStatus] = useState(()=>previousTrade(tradeStorageKey)?.status??"");
  const [signature, setSignature] = useState(()=>previousTrade(tradeStorageKey)?.signature??"");
  useEffect(()=>{if(!signature)return;try{localStorage.setItem(tradeStorageKey,JSON.stringify({signature,status,at:Date.now()}));}catch{/* Explorer reference remains visible if storage is blocked. */}},[signature,status,tradeStorageKey]);
  const [clock, setClock] = useState(Date.now());
  const executing = useRef(false);
  const routed = side === "buy" && launch.pairType !== "sol" && config.solBuyRouting?.enabled && currency === "SOL";
  const inputSymbol = side === "sell" ? launch.symbol : routed ? "SOL" : launch.pairSymbol;
  const outputSymbol = side === "buy" ? launch.symbol : "SOL";
  const inputDecimals = side === "sell" ? launch.tokenDecimals : routed ? 9 : pairDecimals;
  const outputDecimals = side === "buy" ? launch.tokenDecimals : 9;
  const buyCurrency = routed ? "SOL" : "PAIR";
  const balance = useAssetBalance(side === "sell" ? launch.mint : inputSymbol === "SOL" ? null : launch.pairMint, refresh, !launch.showcase);
  const canTrade = !launch.showcase && launch.status === "live" && config.transactionsEnabled;
  let raw = "";
  try { if (inputDecimals !== null && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(amount)) raw = decimalToRaw(amount, inputDecimals); } catch { /* Invalid precision must not produce a quote. */ }
  const valid = validSlippage && /^\d+$/.test(raw) && BigInt(raw) > 0n && outputDecimals !== null;
  const insufficient = balance !== null && /^\d+$/.test(raw) && BigInt(raw)>BigInt(balance);
  const assetKey = [launch.id, side, buyCurrency].join(":");
  const key = [launch.id, side, buyCurrency, raw, slippage].join(":");
  const current = quote?.key === key && clock - quote.receivedAt < 25_000 ? quote : null;
  const displayed = current;
  const outputPrice = isPriceLive(launch, clock) ? side === "buy" ? launch.priceUsd : launch.pairType === "sol" ? launch.pairPriceUsd : null : null;
  const receiveUsd = displayed ? rawUsd(displayed.estimated, outputDecimals, outputPrice) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setQuoteError(""); setPending(valid && canTrade);
    if (!valid || !canTrade || busy) { setPending(false); return; }
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      setPending(true);
      try {
        const result = await api.tradeQuote(launch.id, { side, buyCurrency, sellCurrency: "SOL", amountRaw: raw, slippageBps: slippage }, controller.signal);
        if(side === "sell" && launch.pairType !== "sol" && result.outputMint !== "So11111111111111111111111111111111111111112") throw new Error("A SOL sell route is unavailable. Please try again shortly.");
        const amounts = quoteAmounts(result.quote);
        if (!controller.signal.aborted) { setQuote({ ...amounts, impact: (typeof result.quote.priceImpactPct === "string" || typeof result.quote.priceImpactPct === "number") && Number.isFinite(Number(result.quote.priceImpactPct)) ? Number(result.quote.priceImpactPct)*100 : null, route: result.route, assetKey, key, receivedAt: Date.now() }); setClock(Date.now()); setQuoteError(""); }
      } catch (error) {
        if (!controller.signal.aborted) { setQuoteError(error instanceof Error ? error.message : "Quote unavailable. Please retry."); }
      } finally { loading = false; if (!controller.signal.aborted) setPending(false); }
    };
    const delay = window.setTimeout(() => void load(), 350);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15_000);
    return () => { controller.abort(); window.clearTimeout(delay); window.clearInterval(interval); };
  }, [key, valid, canTrade, busy, refresh, launch.id, side, buyCurrency, raw, slippage, assetKey]);

  async function execute() {
    if(launch.showcase)return;
    if (!wallet.address) { wallet.setModalOpen(true); return; }
    if (insufficient || (highSlippage && !acceptedRisk) || !current || quoteError || !valid || !canTrade || executing.current || Date.now() - current.receivedAt >= 25_000) return;
    executing.current = true; setBusy(true); setSignature(""); setStatus("Preparing your transaction…");
    let conversionConfirmed = false;
    try {
      const transaction = await api.tradeTransaction(launch.id, { trader: wallet.address, side, buyCurrency, sellCurrency: "SOL", amountRaw: raw, slippageBps: slippage });
      if(side === "sell" && launch.pairType !== "sol" && (transaction.outputMint !== "So11111111111111111111111111111111111111112" || transaction.followUp)) throw new Error("A SOL sell transaction is unavailable. Please refresh the quote.");
      if (transaction.route !== current.route) throw new Error("The route changed. Wait for the updated quote and review it before continuing.");
      if (!transaction.followUp) {
        const minimum = transaction.quote ? quoteAmounts(transaction.quote).minimum : transaction.minimumOutputRaw;
        if (!minimum || BigInt(minimum) < BigInt(current.minimum)) throw new Error("The quote changed. Wait for the updated quote and review it before continuing.");
      }
      setStatus(transaction.followUp ? `Approve SOL → ${launch.pairSymbol} in your wallet (1 of 2).` : "Approve the trade in your wallet.");
      let confirmed = await wallet.sendTransaction(transaction, value=>{setSignature(value);setStatus("Transaction submitted. Check its on-chain status before submitting another trade.");});
      if (transaction.followUp) {
        conversionConfirmed = true;
        setStatus(`Conversion confirmed. Preparing the ${launch.symbol} purchase (2 of 2)…`);
        const buy = await api.tradeTransaction(launch.id, { trader: wallet.address, side: "buy", buyCurrency: "PAIR", amountRaw: transaction.followUp.amountRaw, slippageBps: slippage });
        if (!buy.quote || BigInt(quoteAmounts(buy.quote).minimum) < BigInt(current.minimum)) throw new Error("The market moved below the reviewed minimum.");
        setStatus(`Approve the ${launch.symbol} purchase in your wallet (2 of 2).`);
        confirmed = await wallet.sendTransaction(buy, value=>{setSignature(value);setStatus("Purchase submitted. Check its on-chain status before submitting another trade.");});
      }
      setSignature(confirmed); setStatus("Trade confirmed."); setAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The trade could not complete.";
      if (conversionConfirmed) { setCurrency("PAIR"); setAmount(""); }
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
      {side === "sell" && balance !== null && <div className="trade-presets">{[25,50,75,100].map(percent=><button key={percent} onClick={()=>setAmount(displayTokenAmount((BigInt(balance)*BigInt(percent)/100n).toString(),launch.tokenDecimals).replaceAll(",",""))}>{percent===100?"Max":percent+"%"}</button>)}</div>}
      {wallet.address && <div className="trade-detail-row"><span>Available</span><strong>{balance !== null && inputDecimals !== null ? displayTokenAmount(balance,inputDecimals) : "Balance unavailable"} {inputSymbol}</strong></div>}
      <div className="trade-receive"><span>Estimated received <TradeInfo><dl><div><dt>Minimum received</dt><dd>{displayed && outputDecimals !== null ? displayTokenAmount(displayed.minimum,outputDecimals)+" "+outputSymbol : "-"}</dd></div>{displayed?.impact != null&&<div><dt>Price impact</dt><dd>{displayed.impact.toFixed(2)}%</dd></div>}<div><dt>Rewards fee</dt><dd>{((launch.rewardFeeBps??Math.max(100,(launch.transferFeeBps??200)-100))/100).toFixed(2)}%</dd></div><div><dt>Platform fee</dt><dd>1%</dd></div><div><dt>Orca fee</dt><dd>{launch.orcaFeeRate==null?"Included in quote":(launch.orcaFeeRate/10000).toFixed(2)+"%"}</dd></div></dl><span>Swap fees are included in the quote. Network fees and account rent are additional.</span><span>Slippage is the price movement you allow, not an extra fee.</span>{current?.route==="jupiter_then_orca"&&<span>This buy needs two wallet approvals.</span>}{displayed?.impact!=null&&displayed.impact>=5&&<strong className="danger-note">High price impact. Consider a smaller amount.</strong>}</TradeInfo></span><strong>{displayed && outputDecimals !== null ? displayTokenAmount(displayed.estimated, outputDecimals) : "-"}</strong><b>{outputSymbol}</b>{receiveUsd !== null && <small>≈ {usd(receiveUsd)}</small>}</div>
      <label className="slippage-control">Slippage<span className="custom-slippage"><input aria-label="Slippage percentage" inputMode="decimal" value={slippageInput} onChange={(event) => { const value = event.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(value)) setSlippageInput(value); }}/><span>%</span></span></label>
    </fieldset>
    {highSlippage && <label className="trade-ack danger-note"><input type="checkbox" checked={acceptedRisk} onChange={e=>setAcceptedRisk(e.target.checked)}/>Allow up to {slippageInput}% price movement.</label>}
    {insufficient && <p role="alert" className="danger-note">Insufficient {inputSymbol}. Reduce the amount or add funds to your wallet.</p>}
    {(!validSlippage || quoteError || (amount && !valid)) && <div className="quote-status" aria-live="polite"><span className={quoteError ? "quote-error" : ""}>{!validSlippage ? "Enter a slippage percentage from 0 to 50%." : quoteError || (pending ? "Getting quote…" : amount && !valid ? "Enter a valid amount within the asset’s decimal precision." : "Enter an amount to get a quote.")}</span></div>}
    <button className="primary full" disabled={Boolean(launch.showcase) || busy || (Boolean(wallet.address) && (!canTrade || !current || Boolean(quoteError) || pending || insufficient || (highSlippage && !acceptedRisk)))} onClick={() => void execute()}>{busy ? <><Loader2 className="spin"/>Waiting for confirmation</> : launch.showcase ? "Preview only" : !wallet.address ? "Connect wallet" : !canTrade ? "Trading unavailable" : pending ? "Getting quote…" : !current ? "Enter amount" : `${side === "buy" ? "Buy" : "Sell"} ${launch.symbol}`}</button>
    {wallet.address && valid && !current && !pending && !quoteError && <p className="trade-route-note">Quote expired. <button className="text-button" onClick={()=>setRefresh(n=>n+1)}>Get a fresh quote</button></p>}
    {!canTrade && <p className="trade-route-note">{launch.showcase ? "Sample market. Trading is disabled." : launch.status !== "live" ? "Trading opens after launch confirmation." : "Transactions are currently unavailable."}</p>}
    {status && <p className="trade-result" role="status">{status}{signature && <a href={`https://solscan.io/tx/${signature}${config.network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12}/></a>}</p>}
  </section>;
}
