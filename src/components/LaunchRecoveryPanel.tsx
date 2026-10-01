import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, RefreshCw, X } from "lucide-react";
import { api } from "../api";
import { ensureAccountSession } from "../account-api";
import { useWallet } from "../context";
import type { LaunchRecovery } from "../types";

const sol = (raw: string) => (Number(raw) / 1e9).toLocaleString("en", { maximumFractionDigits: 6 });
const labels: Record<string, string> = { mint: "Coin created", pool: "Pool created", prepare: "Accounts prepared", funding: "Pair tokens received", liquidity: "Liquidity activated", lock: "Liquidity locked" };

export function LaunchRecoveryPanel({ launchId, creator, onResume, onNew, onDismiss, disabled = false }: {
  launchId: string; creator: string; onResume(): void; onNew(): void; onDismiss(): void; disabled?: boolean;
}) {
  const wallet = useWallet();
  const [state, setState] = useState<LaunchRecovery | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(current => current?.launchId === launchId ? current : null); setError("");
    api.launchRecovery(launchId, creator, controller.signal).then(result => {
      if (!Array.isArray(result.steps) || !result.budget) throw new Error("Launch recovery status is unavailable. Refresh to try again.");
      setState(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not check launch status.");
    });
    return () => controller.abort();
  }, [launchId, creator, version]);
  useEffect(() => {
    if (state?.recoveryState !== "pending") return;
    const timer = setTimeout(() => setVersion(value => value + 1), 4000);
    return () => clearTimeout(timer);
  }, [state]);
  async function recover() {
    if (!state || wallet.address !== creator || busy || disabled) return;
    setBusy(true); setError("");
    try {
      const token = await ensureAccountSession(creator, wallet.signMessage);
      if (state.recoveryState === "pending") await api.submitLaunchRecovery(launchId, token);
      else if (state.recoveryTransaction) {
        const signed = await wallet.signTransaction(state.recoveryTransaction);
        await api.submitLaunchRecovery(launchId, token, signed.signedTransactionBase64);
      } else await api.prepareLaunchRecovery(launchId, token);
      setVersion(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Recovery could not continue.");
      // Keep the signed receipt on the server even when a response was lost.
      try { setState(await api.launchRecovery(launchId, creator)); } catch { /* Keep the last verified state. */ }
    } finally { setBusy(false); }
  }
  const complete = state?.recoveryState === "complete";
  const recoveryPending = state?.recoveryState === "approval" || state?.recoveryState === "pending";
  const message = !state ? "Checking confirmed transactions and wallet funds…"
    : complete ? "Unused pair tokens were swapped back to SOL. This launch attempt is closed."
    : state.locked ? "Liquidity is permanently locked. Resume to finish syncing the coin. No second dev buy is needed."
    : state.devBuyConfirmed ? "Your dev buy completed. Resume to finish the permanent lock without buying again."
    : state.positionActive ? "Liquidity is already active. Resume to finish the permanent lock."
    : state.fundingConfirmed ? `Your funding was converted to ${state.pairSymbol}. Resume to use those tokens, or recover the unused amount when eligible.`
    : "Your dev buy has not confirmed. Resume keeps the completed setup steps.";
  return <section className="launch-recovery-panel" aria-label="Resume your launch">
    <button type="button" className="launch-recovery-dismiss" aria-label="Dismiss this launch reminder" title="Hide this launch reminder in this browser" onClick={onDismiss} disabled={busy}><X size={18}/></button>
    <header><span className="launch-recovery-icon">{complete || state?.locked ? <Check/> : <RefreshCw/>}</span>
      <div><h2>{complete ? "Funds recovered" : state ? `Continue $${state.symbol}` : "Check your launch"}</h2><p>{message}</p></div>
    </header>
    {state && <div className="launch-recovery-receipts">{state.steps.map(step => <span key={step.step} className={step.confirmed ? "confirmed" : ""}>
      {step.confirmed && <Check size={12}/>}
      {step.signature ? <a href={`https://solscan.io/tx/${encodeURIComponent(step.signature)}`} target="_blank" rel="noreferrer">{labels[step.step] ?? step.step}</a> : labels[step.step] ?? step.step}
    </span>)}</div>}
    {state && !complete && !state.budget.sufficient && !state.locked && <p className="launch-recovery-notice">
      Add {sol(state.budget.shortfallLamports)} SOL to resume. Setup needs a {sol(state.budget.reserveLamports)} SOL allowance; unused SOL stays in your wallet.
    </p>}
    {state?.unresolved && <p className="launch-recovery-notice">A submitted transaction is still being checked. Wait for its result before another approval.</p>}
    {state?.fundingConfirmed && !state.positionActive && !state.activationConfirmed && !state.approvalsExpired && !recoveryPending && <p className="launch-recovery-notice">Recovery becomes available after previous wallet approvals expire. You can still resume this launch.</p>}
    {state?.recoveryTransaction && <p className="launch-recovery-notice">
      Recover at least <b>{sol(state.recoveryTransaction.minimumOutputRaw)} SOL</b> before network fees. Approving ends this launch attempt. Setup fees are not refunded.
    </p>}
    {recoveryPending && <p className="launch-recovery-note">Resume is paused while the recovery approval is valid. If you cancel in your wallet, wait for it to expire, then refresh.</p>}
    {(state?.devBuyConfirmed || state?.positionActive) && !state.locked && <p className="launch-recovery-note">A completed buy cannot be automatically refunded. Liquidity withdrawal needs a separate review of the pool and other traders.</p>}
    {error && <p className="launch-recovery-notice" role="alert">{error}</p>}
    <div className="launch-recovery-actions">
      {complete ? <button type="button" onClick={onNew} disabled={disabled}>Start a new launch <ArrowRight size={15}/></button>
        : <button type="button" onClick={onResume} disabled={disabled || busy || recoveryPending || state?.unresolved}>Resume launch <ArrowRight size={15}/></button>}
      {(state?.canRecover || recoveryPending) && <button type="button" className="secondary" onClick={() => void recover()} disabled={disabled || busy}>
        {busy && <Loader2 size={14} className="spin"/>}{state?.recoveryState === "pending" ? "Retry recovery submission" : state?.recoveryTransaction ? "Approve recovery" : "Get recovery quote"}
      </button>}
      <button type="button" className="text" onClick={() => setVersion(value => value + 1)} disabled={busy}><RefreshCw size={14}/> Refresh status</button>
    </div>
    {state?.canRecover && <p className="launch-recovery-note">Recovery swaps unused {state.pairSymbol} in your wallet back to SOL. Fees and price changes can reduce the amount returned.</p>}
    {state?.recoverySignature && <a className="launch-recovery-link" href={`https://solscan.io/tx/${encodeURIComponent(state.recoverySignature)}`} target="_blank" rel="noreferrer">View recovery transaction ↗</a>}
  </section>;
}
