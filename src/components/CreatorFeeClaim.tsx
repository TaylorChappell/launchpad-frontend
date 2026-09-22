import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { api } from "../api";
import { ensureAccountSession } from "../account-api";
import { useRuntime, useWallet } from "../context";
import { displayTokenAmount } from "../trade-quote";
import type { CreatorFeeSummary, Launch } from "../types";

export function CreatorFeeClaim({ launch, onClaimed }: { launch: Launch; onClaimed?: () => void }) {
  const wallet = useWallet(), { config } = useRuntime();
  return <CreatorClaim key={`${config.network}:${wallet.address}:${launch.id}`} launch={launch} onClaimed={onClaimed} />;
}
function CreatorClaim({ launch, onClaimed }: { launch: Launch; onClaimed?: () => void }) {
  const wallet = useWallet(), { config } = useRuntime();
  const [summary, setSummary] = useState<CreatorFeeSummary | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [readError, setReadError] = useState(false);
  const alive = useRef(true), running = useRef(false), polling = useRef(false);
  const requestKey = `aqua:creator-sol:${config.network}:${wallet.address}:${launch.id}`;
  const requestId = useRef<string | null>(null);
  const hadPending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function refresh() {
    if (!wallet.address || polling.current) return;
    polling.current = true;
    try {
      const result = await api.creatorFeeSummary(launch.id, wallet.address);
      if (!alive.current) return;
      setSummary(result); setReadError(false);
      if (hadPending.current && !result.pendingClaim) onClaimed?.();
      hadPending.current = Boolean(result.pendingClaim);
    } catch { if (alive.current) setReadError(true); }
    finally { polling.current = false; }
  }
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [launch.id, wallet.address]);
  async function claim() {
    if (running.current || !wallet.address) return;
    running.current = true; setBusy(true); setError("");
    try {
      const token = await ensureAccountSession(wallet.address, wallet.signMessage);
      if (!alive.current) return;
      if (!requestId.current) {
        try { requestId.current = localStorage.getItem(requestKey); } catch { /* In-memory retry still works. */ }
        requestId.current ??= crypto.randomUUID();
        try { localStorage.setItem(requestKey, requestId.current); } catch { /* Keep the request identifier in memory. */ }
      }
      await api.claimCreatorSol(launch.id, token, requestId.current);
      // Only clear after acknowledgement. A lost response reuses the same request.
      try { localStorage.removeItem(requestKey); } catch { /* A persisted retry returns the original claim. */ }
      requestId.current = null;
      if (alive.current) { hadPending.current = true; await refresh(); onClaimed?.(); }
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not request your SOL payout."); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  if (wallet.address !== launch.creatorWallet) return null;
  const pending = summary?.pendingClaim;
  const processing = Boolean(pending && (pending.mode === "manual" || pending.signature));
  const balance = summary ? BigInt(summary.availableLamports) + BigInt(summary.pendingLamports) : 0n;
  return <section className="creator-earnings" aria-label="Creator earnings">
    <div className="creator-earnings-main">
      <div className="creator-earnings-balance">
        <span className="creator-eyebrow">Available SOL</span>
        <h3>{summary ? displayTokenAmount(balance.toString(), 9) : "—"} <span>SOL</span></h3>
        <p>Balances over $50 are paid automatically.</p>
      </div>
      <div className="creator-earnings-action">
        <button className="primary" disabled={busy || processing || readError || !summary?.claimsEnabled || balance === 0n} onClick={() => void claim()}>
          {busy || processing ? <Loader2 size={17} className="spin" /> : <ArrowDownToLine size={17} />}
          {busy ? "Requesting…" : processing ? "Claiming…" : "Claim"}
        </button>
      </div>
    </div>
    {error && <p className="creator-earnings-error" role="alert">{error}</p>}
    {readError && <p className="creator-earnings-error" role="status">Balance unavailable. Retrying…</p>}
    {summary && !summary.claimsEnabled && <p className="creator-earnings-error" role="status">SOL payouts are temporarily unavailable.</p>}
  </section>;
}
