import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { AdminDiagnostics } from "../types";

const SESSION_KEY = "aqua-admin-session-v1";
const sol = (value: unknown) => `${(Number(String(value ?? 0)) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`;
const raw = (value: unknown) => BigInt(String(value ?? 0)).toLocaleString();
const when = (value: unknown) => value ? new Date(Number(value)).toLocaleString() : "Never";
const short = (value: unknown) => { const text = String(value ?? ""); return text.length > 15 ? `${text.slice(0, 6)}…${text.slice(-6)}` : text || "—"; };
const explorer = (kind: "account" | "tx", value: unknown) => `https://solscan.io/${kind}/${String(value)}`;

function Flag({ label, enabled }: { label: string; enabled: boolean }) {
  return <div className={`admin-flag ${enabled ? "on" : "off"}`}>{enabled ? <CheckCircle2/> : <AlertTriangle/>}<span>{label}</span><b>{enabled ? "Enabled" : "Disabled"}</b></div>;
}

export function Admin() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY));
  const [data, setData] = useState<AdminDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authorizedWallet = Boolean(wallet.address && wallet.address === config.adminWallet);

  const load = useCallback(async (session: string) => {
    setBusy(true); setError(null);
    try { setData(await api.adminDiagnostics(session)); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : "Diagnostics could not be loaded.";
      setError(message); setData(null);
      if (/authorization|expired|verification/i.test(message)) { sessionStorage.removeItem(SESSION_KEY); setToken(null); }
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { if (authorizedWallet && token) void load(token); else setData(null); }, [authorizedWallet, load, token]);
  useEffect(() => { if (!authorizedWallet) { sessionStorage.removeItem(SESSION_KEY); setToken(null); } }, [authorizedWallet, wallet.address]);

  const verify = async () => {
    if (!wallet.address || !authorizedWallet) return;
    setBusy(true); setError(null);
    try {
      const challenge = await api.adminChallenge(wallet.address);
      const signed = await wallet.signMessage(challenge.message);
      const session = await api.adminSession({ wallet: wallet.address, challenge: challenge.challenge, ...signed });
      sessionStorage.setItem(SESSION_KEY, session.token); setToken(session.token);
      toast.success("Admin wallet verified");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Admin verification failed."); }
    finally { setBusy(false); }
  };

  const diagnosticsByLaunch = useMemo(() => new Map((data?.diagnostics ?? []).map((item) => [String(item.launch_id), item])), [data]);
  const runtimeByLaunch = useMemo(() => new Map((data?.runtime.markets ?? []).map((item) => [String(item.launchId), item])), [data]);

  if (!wallet.address) return <main className="page admin-page"><section className="admin-access"><ShieldCheck/><span>Wallet-protected operations</span><h1>AQUA control room</h1><p>Connect the authorized operations wallet to inspect fee conversion, reward funding, holder epochs, and keeper health.</p><button className="primary" onClick={() => wallet.setModalOpen(true)}><WalletCards/>Connect admin wallet</button></section></main>;
  if (!authorizedWallet) return <main className="page admin-page"><section className="admin-access denied"><AlertTriangle/><span>Access restricted</span><h1>This wallet is not authorized</h1><p>Diagnostics are available only to the configured AQUA admin wallet. No operational data was requested from the backend.</p><code>{wallet.address}</code></section></main>;
  if (!token || !data) return <main className="page admin-page"><section className="admin-access"><ShieldCheck/><span>Authorized wallet detected</span><h1>Verify to open diagnostics</h1><p>Sign a short-lived, read-only message. This is not a transaction and cannot move funds.</p><button className="primary" disabled={busy} onClick={() => void verify()}>{busy ? <Loader2 className="spin"/> : <ShieldCheck/>}{busy ? "Waiting for signature" : "Verify admin wallet"}</button>{error && <div className="admin-error"><AlertTriangle/>{error}</div>}</section></main>;

  return <main className="page admin-page">
    <header className="admin-hero"><div><span><ShieldCheck/>Private operations view</span><h1>AQUA control room</h1><p>Live chain custody, SOL conversion routes, settlement history, and reward-epoch health in one place.</p></div><button onClick={() => void load(token)} disabled={busy}><RefreshCw className={busy ? "spin" : ""}/>Refresh</button></header>
    {error && <div className="admin-error"><AlertTriangle/>{error}</div>}
    <section className="admin-flags"><Flag label="Fee keeper" enabled={data.flags.feeKeeperEnabled}/><Flag label="SOL conversion" enabled={data.flags.solFeeConversionEnabled}/><Flag label="Holder rewards" enabled={data.flags.rewardDistributionEnabled}/></section>
    <section className="admin-stat-grid">
      <article><small>Live launches</small><b>{data.counts.live_launches ?? 0}</b><span>{data.counts.launches ?? 0} total records</span></article>
      <article><small>Active conversions</small><b>{data.counts.active_conversions ?? 0}</b><span>{data.counts.conversion_errors ?? 0} logged errors</span></article>
      <article><small>Claimable epochs</small><b>{data.counts.claimable_epochs ?? 0}</b><span>{data.counts.unclaimed_entitlements ?? 0} unclaimed wallets</span></article>
      <article><small>Next conversion</small><b>${(data.flags.conversionMinimumUsdCents / 100).toFixed(2)}</b><span>{data.flags.conversionSlippageBps / 100}% max slippage</span></article>
    </section>
    <section className="admin-panel"><header><div><h2>Custody and destinations</h2><p>Public keys read directly from the deployed AQUA configuration.</p></div><time>Updated {when(data.generatedAt)}</time></header>{data.runtime.available ? <div className="admin-custody"><div><small>Keeper</small><a href={explorer("account", data.runtime.operator)} target="_blank" rel="noreferrer">{short(data.runtime.operator)}<ExternalLink/></a><b>{sol(data.runtime.balances?.nativeLamports)} native</b></div><div><small>Reserved holder rewards</small><b>{sol(data.runtime.balances?.reservedRewardLamports)}</b><span>{sol(data.runtime.balances?.wrappedSolLamports)} currently wrapped</span></div><div><small>Treasury</small><a href={explorer("account", data.runtime.destinations?.treasury)} target="_blank" rel="noreferrer">{short(data.runtime.destinations?.treasury)}<ExternalLink/></a></div><div><small>Buyback wallet</small><a href={explorer("account", data.runtime.destinations?.buybackBuyer)} target="_blank" rel="noreferrer">{short(data.runtime.destinations?.buybackBuyer)}<ExternalLink/></a></div></div> : <div className="admin-empty">{data.runtime.reason}</div>}</section>
    <section className="admin-panel"><header><div><h2>Market pipeline</h2><p>The latest keeper stage and live on-chain fee balances for every launch.</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Market</th><th>Keeper state</th><th>Withheld</th><th>Fee vault</th><th>Accrued split</th><th>Last attempt</th></tr></thead><tbody>{data.launches.map((launch) => { const id=String(launch.id); const diagnostic=diagnosticsByLaunch.get(id); const live=runtimeByLaunch.get(id); const accrued=(live?.accrued ?? {}) as Record<string,unknown>; return <tr key={id}><td><b>${String(launch.symbol)}</b><a href={explorer("account", launch.mint)} target="_blank" rel="noreferrer">{short(launch.mint)}<ExternalLink/></a></td><td><span className={`admin-status ${String(diagnostic?.status ?? "unknown")}`}>{String(diagnostic?.status ?? "unknown")}</span><small>{String(diagnostic?.stage ?? "No keeper pass")}</small><em>{String(diagnostic?.message ?? "")}</em></td><td>{raw(live?.withheldRaw)}<small>{String(live?.withheldSourceCount ?? 0)} sources</small></td><td>{raw(live?.feeVaultRaw)}</td><td><small>Rewards {raw(accrued.rewardRaw ?? launch.reward_fees_accrued_raw)}</small><small>Buyback {raw(accrued.buybackRaw ?? launch.buyback_fees_accrued_raw)}</small><small>Treasury {raw(accrued.treasuryRaw ?? launch.treasury_fees_accrued_raw)}</small><small>Creator {raw(accrued.creatorRaw ?? launch.creator_fees_accrued_raw)}</small></td><td>{when(diagnostic?.last_attempt_at)}</td></tr>; })}</tbody></table></div></section>
    <section className="admin-panel"><header><div><h2>SOL conversions</h2><p>Launch-pool first routing means a new token does not need to be indexed by Jupiter.</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Status</th><th>Launch</th><th>Route</th><th>Launch tokens</th><th>SOL output</th><th>Transactions / error</th></tr></thead><tbody>{data.conversions.length ? data.conversions.map((item) => <tr key={String(item.id)}><td><span className={`admin-status ${String(item.status)}`}>{String(item.status)}</span></td><td>{String(item.launch_id)}</td><td>{String(item.route ?? "legacy Jupiter")}</td><td>{raw(item.total_launch_raw)}</td><td>{item.sol_output_lamports ? sol(item.sol_output_lamports) : "—"}</td><td>{item.swap_signature ? <a href={explorer("tx", item.swap_signature)} target="_blank" rel="noreferrer">{short(item.swap_signature)}<ExternalLink/></a> : <em>{String(item.last_error ?? "Waiting")}</em>}</td></tr>) : <tr><td colSpan={6} className="admin-empty">No SOL conversion attempts yet.</td></tr>}</tbody></table></div></section>
    <section className="admin-panel"><header><div><h2>Holder reward epochs</h2><p>Rewards use amount-held × time-held snapshots, accumulate across epochs, and remain claimable until the holder claims.</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Epoch</th><th>Market</th><th>Reward</th><th>Eligible holders</th><th>Status</th><th>Funding</th></tr></thead><tbody>{data.rewardEpochs.length ? data.rewardEpochs.map((item) => <tr key={String(item.id)}><td>{short(item.id)}<small>{when(item.ends_at)}</small></td><td>{String(item.launch_id)}</td><td>{raw(item.total_stock_raw)} {String(item.stock_symbol)}</td><td>{String(item.eligible_holders)}</td><td><span className={`admin-status ${String(item.status)}`}>{String(item.status)}</span></td><td>{item.funding_signature ? <a href={explorer("tx", item.funding_signature)} target="_blank" rel="noreferrer">{short(item.funding_signature)}<ExternalLink/></a> : "Waiting"}</td></tr>) : <tr><td colSpan={6} className="admin-empty">No holder epochs have been created yet.</td></tr>}</tbody></table></div></section>
  </main>;
}
