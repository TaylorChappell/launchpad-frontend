import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownToLine, ExternalLink, Loader2, X } from "lucide-react";
import { API_URL, ApiError } from "../api";
import { ensureAccountSession } from "../account-api";
import { creatorApi, savedCreatorSession, type RewardDeposit } from "../creator-api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import { useDialog } from "./useDialog";
import type { Launch } from "../types";

type PendingDeposit = { id: string; amountLamports: string; signedTransactionBase64: string };
function sol(raw: string) { return (Number(raw) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 }); }
function statusLabel(deposit: RewardDeposit) {
  if (deposit.status === "credited") return deposit.rewardMode === "jackpot" ? "Added to jackpot funding" : deposit.rewardMode === "buyback_burn" ? "Sent to buyback & burn" : "Added to holder rewards";
  return { prepared: "Awaiting wallet approval", queued: "Confirming deposit", received: deposit.targetSymbol === "SOL" ? "Preparing rewards" : `Converting to ${deposit.targetSymbol}`, failed: "Transaction failed", expired: "Approval expired" }[deposit.status];
}
export function CreatorRewardDeposit({ launch }: { launch: Launch }) {
  const wallet = useWallet(), { config } = useRuntime();
  const key = `aqua:reward-deposit:${API_URL}:${config.network}:${launch.id}:${wallet.address}`;
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(""), [stage, setStage] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [deposits, setDeposits] = useState<RewardDeposit[]>([]);
  const [token, setToken] = useState(() => savedCreatorSession(wallet.address));
  const [pending, setPending] = useState<PendingDeposit | null>(() => { try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; } });
  const [historyError, setHistoryError] = useState("");
  const working = useRef(false), currentWallet = useRef(wallet.address);
  currentWallet.current = wallet.address;
  const dialog = useDialog<HTMLDivElement>(open, () => setOpen(false));
  const mode = launch.rewardMode ?? "holder_rewards";
  const description = mode === "jackpot" ? "Your SOL is added to the next jackpot round that accepts funding."
    : mode === "buyback_burn" ? `Your SOL buys ${launch.symbol} through its market and burns the purchased tokens.`
    : launch.pairType === "sol" ? "Your SOL goes into this coin’s time-weighted holder rewards."
    : `Your SOL converts to ${launch.stockSymbol} and goes into this coin’s time-weighted holder rewards.`;
  async function refresh(session: string) {
    try { const result = await creatorApi.deposits(launch.id, session); setDeposits(result.deposits); setHistoryError(""); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setToken(""); setHistoryError(e instanceof Error ? e.message : "Deposit history could not refresh."); }
  }
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const poll = () => { if (alive && document.visibilityState === "visible") void refresh(token); };
    poll(); const timer = window.setInterval(poll, 10000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [token, launch.id]);
  async function session() {
    const address = wallet.address;
    if (!address || address !== launch.creatorWallet) throw new Error("Connect the creator wallet first.");
    const value = await ensureAccountSession(address, wallet.signMessage);
    if (currentWallet.current !== address) throw new Error("Wallet changed. Review the deposit again.");
    setToken(value); return value;
  }
  async function submit() {
    if (working.current) return;
    working.current = true; setError(""); setNotice("");
    try {
      const raw = pending?.amountLamports ?? decimalToRaw(amount, 9);
      if (BigInt(raw) < 1_000_000n) throw new Error("Minimum deposit is 0.001 SOL.");
      setStage("Connecting wallet…");
      const auth = await session(), address = wallet.address;
      let signed = pending;
      if (!signed) {
        setStage("Preparing deposit…");
        const id = crypto.randomUUID();
        const prepared = await creatorApi.prepareDeposit(launch.id, auth, { id, amountLamports: raw });
        if (currentWallet.current !== address) throw new Error("Wallet changed. Review the deposit again.");
        setStage("Approve in your wallet…");
        const approval = await wallet.signTransaction(prepared.envelope);
        signed = { id, amountLamports: raw, signedTransactionBase64: approval.signedTransactionBase64 };
        // Keep the exact signed transaction if the handoff acknowledgement is lost.
        localStorage.setItem(key, JSON.stringify(signed)); setPending(signed);
      }
      if (currentWallet.current !== address) throw new Error("Switch back to the creator wallet to resume this deposit.");
      setStage("Sending to AQUA…");
      const result = await creatorApi.submitDeposit(launch.id, auth, signed.id, signed.signedTransactionBase64);
      localStorage.removeItem(key); setPending(null); setAmount("");
      setDeposits(previous => [result.deposit, ...previous.filter(item => item.id !== result.deposit.id)]);
      setNotice(["failed", "expired"].includes(result.deposit.status) ? "This approval did not complete. You can prepare a new deposit." : "Deposit accepted. AQUA will finish processing it automatically.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit the deposit."); }
    finally { working.current = false; setStage(""); }
  }
  return <section className="creator-reward-deposit">
    <header><div><h2>Support your holders</h2><p>{description}</p></div><button className="primary" onClick={() => setOpen(true)}><ArrowDownToLine size={16}/>{pending ? "Resume deposit" : "Deposit SOL"}</button></header>
    {deposits.filter(item => item.status !== "prepared").length > 0 && <div className="creator-deposit-history">{deposits.filter(item => item.status !== "prepared").slice(0, 5).map(item => <article key={item.id}><div><strong>{sol(item.amountLamports)} SOL</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><span className={`deposit-status ${item.status}`}>{statusLabel(item)}{item.retrying && <small>Processing will retry automatically</small>}</span>{item.signature && <a href={`https://solscan.io/tx/${item.signature}${config.network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" aria-label="View deposit transaction"><ExternalLink size={16}/></a>}</article>)}</div>}
    {historyError && <p className="creator-inline-error" role="alert">{historyError}</p>}
    {!token && <button className="creator-text-button" onClick={() => { void session().then(refresh).catch(e => setHistoryError(String(e.message))); }}>Sign in to view deposit history</button>}
    {open && createPortal(<div className="creator-dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><div ref={dialog} className="creator-deposit-dialog" role="dialog" aria-modal="true" aria-labelledby="deposit-title">
      <header><h2 id="deposit-title">Deposit SOL</h2><button className="icon-button" aria-label="Close deposit" onClick={() => setOpen(false)}><X/></button></header>
      <p>{description}</p>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}><label htmlFor="creator-deposit-amount">Amount</label><div className="manage-input"><input id="creator-deposit-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={pending ? sol(pending.amountLamports) : amount} disabled={Boolean(stage || pending)} onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>SOL</b></div>
      <p className="creator-deposit-note">Minimum 0.001 SOL. This funds your coin’s rewards and cannot be withdrawn. Network and swap costs apply. {mode === "holder_rewards" && launch.pairType !== "sol" ? `The final ${launch.stockSymbol} amount depends on the conversion price.` : ""}</p>
      {pending && <p className="creator-deposit-note">Your approval is saved. Resume sends the same transaction, so it won’t create a second deposit.</p>}
      {error && <p className="creator-inline-error" role="alert">{error}</p>}{notice && <p className="creator-deposit-success" role="status">{notice}</p>}
      <button className="primary full" disabled={Boolean(stage) || (!pending && !amount)}>{stage && <Loader2 className="spin"/>}{stage || (pending ? "Resume deposit" : "Review deposit in wallet")}</button></form>
    </div></div>, document.body)}
  </section>;
}
