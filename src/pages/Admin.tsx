import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Gavel, Loader2, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { DexScreenerIcon } from "../components/DexScreenerIcon";
import type { AdminDiagnostics, MarketProposal } from "../types";

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
  const [proposalBusy, setProposalBusy] = useState<string | null>(null);
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

  const proposalAction = async (id: string, action: "withdraw" | "paid" | "complete" | "uphold" | "reject" | "access") => {
    if (!token) return;
    if (action === "withdraw" && !window.confirm("Withdraw this proposal's reserved SOL to the configured AQUA admin wallet?")) return;
    setProposalBusy(`${id}:${action}`);
    try {
      if (action === "withdraw") {
        const result = await api.adminWithdrawProposal(token, id);
        toast.success(`DEX fund withdrawn · ${result.signature.slice(0, 8)}…`);
      } else if (action === "paid") {
        const reference = window.prompt("External DEX order reference. Confirm only after the approved profile is live.");
        if (!reference?.trim()) return;
        const managed = window.confirm("Can AQUA currently edit this DEX profile through its own marketplace account?");
        await api.adminMarkProposalPaid(token, id, reference, managed);
        toast.success("DEX payment marked complete");
      } else if (action === "complete") {
        const reference = window.prompt("External DEX update reference. Confirm only after the approved details are live.");
        if (!reference?.trim()) return;
        await api.adminCompleteProposal(token, id, reference);
        toast.success("Proposal marked completed");
      } else if (action === "access") {
        const reference = window.prompt("Profile access / order reference after verifying AQUA can edit this profile:");
        if (!reference?.trim()) return;
        const proposal = data?.proposals.find(item => item.id === id);
        if (!proposal) return;
        await api.adminDexAccess(token, proposal.launchId, true, reference);
        toast.success("AQUA profile access recorded");
      } else {
        await api.adminResolveProposalChallenge(token, id, action === "uphold");
        toast.success(action === "uphold" ? "Challenge upheld; reserved funds returned to rewards" : "Challenge rejected");
      }
      await load(token);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Proposal action failed."); }
    finally { setProposalBusy(null); }
  };

  if (!wallet.address) return <main className="page admin-page"><section className="admin-access"><ShieldCheck/><span>Wallet-protected operations</span><h1>AQUA control room</h1><p>Connect the authorized operations wallet to inspect fee conversion, reward funding, holder epochs, and keeper health.</p><button className="primary" onClick={() => wallet.setModalOpen(true)}><WalletCards/>Connect admin wallet</button></section></main>;
  if (!authorizedWallet) return <main className="page admin-page"><section className="admin-access denied"><AlertTriangle/><span>Access restricted</span><h1>This wallet is not authorized</h1><p>Diagnostics are available only to the configured AQUA admin wallet. No operational data was requested from the backend.</p><code>{wallet.address}</code></section></main>;
  if (!token || !data) return <main className="page admin-page"><section className="admin-access"><ShieldCheck/><span>Authorized wallet detected</span><h1>Verify to open diagnostics</h1><p>Sign a short-lived, read-only message. This is not a transaction and cannot move funds.</p><button className="primary" disabled={busy} onClick={() => void verify()}>{busy ? <Loader2 className="spin"/> : <ShieldCheck/>}{busy ? "Waiting for signature" : "Verify admin wallet"}</button>{error && <div className="admin-error"><AlertTriangle/>{error}</div>}</section></main>;

  return <main className={`page admin-page ${config.marketGovernanceEnabled ? "" : "market-governance-disabled"}`}>
    <header className="admin-hero"><div><span><ShieldCheck/>Private operations view</span><h1>AQUA control room</h1><p>Live chain custody, SOL conversion routes, settlement history, and reward-epoch health in one place.</p></div><button onClick={() => void load(token)} disabled={busy}><RefreshCw className={busy ? "spin" : ""}/>Refresh</button></header>
    {error && <div className="admin-error"><AlertTriangle/>{error}</div>}
    <section className="admin-flags"><Flag label="Fee keeper" enabled={data.flags.feeKeeperEnabled}/><Flag label="SOL conversion" enabled={data.flags.solFeeConversionEnabled}/><Flag label="Holder rewards" enabled={data.flags.rewardDistributionEnabled}/></section>
    <section className="admin-stat-grid">
      <article><small>Live launches</small><b>{data.counts.live_launches ?? 0}</b><span>{data.counts.launches ?? 0} total records</span></article>
      <article><small>Active conversions</small><b>{data.counts.active_conversions ?? 0}</b><span>{data.counts.conversion_errors ?? 0} logged errors</span></article>
      <article><small>Claimable epochs</small><b>{data.counts.claimable_epochs ?? 0}</b><span>{data.counts.unclaimed_entitlements ?? 0} unclaimed wallets</span></article>
      <article><small>Next conversion</small><b>${(data.flags.conversionMinimumUsdCents / 100).toFixed(2)}</b><span>{data.flags.conversionSlippageBps / 100}% max slippage</span></article>
    </section>
    <section className="admin-panel"><header><div><h2>Custody and destinations</h2><p>Public keys read directly from the deployed AQUA configuration and fee-role PDA.</p></div><time>Updated {when(data.generatedAt)}</time></header>{data.runtime.available ? <div className="admin-custody"><div><small>Fee keeper</small><a href={explorer("account", data.runtime.operator)} target="_blank" rel="noreferrer">{short(data.runtime.operator)}<ExternalLink/></a><b>{sol(data.runtime.balances?.nativeLamports)} native</b><span>Harvests, converts and divides fees</span></div><div><small>Reward wallet</small><a href={explorer("account", data.runtime.rewardOperator)} target="_blank" rel="noreferrer">{short(data.runtime.rewardOperator)}<ExternalLink/></a><b>{sol(data.runtime.balances?.rewardNativeLamports)} native</b><span>{sol(data.runtime.balances?.reservedRewardLamports)} allocated · {sol(data.runtime.balances?.wrappedSolLamports)} wrapped</span></div><div><small>Treasury</small><a href={explorer("account", data.runtime.destinations?.treasury)} target="_blank" rel="noreferrer">{short(data.runtime.destinations?.treasury)}<ExternalLink/></a></div><div><small>Buyback wallet</small><a href={explorer("account", data.runtime.destinations?.buybackBuyer)} target="_blank" rel="noreferrer">{short(data.runtime.destinations?.buybackBuyer)}<ExternalLink/></a></div></div> : <div className="admin-empty">{data.runtime.reason}</div>}</section>
    <section className="admin-panel admin-proposals"><header><div><h2><Gavel/> Market proposals</h2><p>Review votes and challenges, withdraw a fully funded DEX reserve, then record the external action.</p></div><b>{data.proposals.filter((item) => ["voting", "funding", "approved", "ready", "withdrawn"].includes(item.status)).length} active</b></header><div className="admin-table-wrap"><table><thead><tr><th>Market / type</th><th>Status</th><th>Vote</th><th>DEX fund</th><th>Challenges</th><th>Admin action</th></tr></thead><tbody>{data.proposals.length ? data.proposals.map((proposal) => { const yes=BigInt(proposal.yesPowerRaw || "0"); const no=BigInt(proposal.noPowerRaw || "0"); const total=yes+no; const yesPct=total ? Number(yes*100n/total) : 0; return <tr key={proposal.id}><td><b>${proposal.marketSymbol}</b><small className="admin-proposal-type">{proposal.type !== "cto" && <DexScreenerIcon/>}{proposal.type.replaceAll("_", " ")}</small><SubmittedProposalDetails proposal={proposal}/>{proposal.type !== "cto" && <><a href="https://marketplace.dexscreener.com/" target="_blank" rel="noreferrer">Open DEX marketplace <ExternalLink/></a><button disabled={Boolean(proposalBusy)} onClick={() => void proposalAction(proposal.id, "access")}>Confirm profile access</button></>}<a href={explorer("account", proposal.mint)} target="_blank" rel="noreferrer">{short(proposal.mint)}<ExternalLink/></a></td><td><span className={`admin-status ${proposal.status}`}>{proposal.status}</span><small>{proposal.spendingPaused ? "Profile vote · spending paused" : proposal.outcome ?? "Voting"}</small></td><td><b>{yesPct}% yes</b><small>{proposal.eligibleVoters} eligible voters</small></td><td>{(proposal.type === "dex_payment" || proposal.payload.dexService === "community_takeover") ? <><b>${proposal.fundedUsd.toFixed(2)} / ${proposal.targetUsd.toFixed(0)}</b><small>{sol(proposal.fundedLamports)}</small>{proposal.withdrawalSignature && <a href={explorer("tx", proposal.withdrawalSignature)} target="_blank" rel="noreferrer">Proof <ExternalLink/></a>}</> : "—"}</td><td>{proposal.openChallenges ?? 0}</td><td><div className="admin-proposal-actions">{["ready", "withdrawing"].includes(proposal.status) && <button title={proposal.spendingPaused ? "Spending paused during the profile replacement vote" : undefined} disabled={Boolean(proposalBusy) || proposal.spendingPaused} onClick={() => void proposalAction(proposal.id, "withdraw")}>{proposalBusy === `${proposal.id}:withdraw` ? <Loader2 className="spin"/> : null}{proposal.status === "withdrawing" ? "Resume withdrawal" : "Withdraw"}</button>}{proposal.status === "withdrawn" && <button disabled={Boolean(proposalBusy)} onClick={() => void proposalAction(proposal.id, "paid")}>Mark paid</button>}{proposal.status === "approved" && proposal.type === "dex_update" && <button disabled={Boolean(proposalBusy)} onClick={() => void proposalAction(proposal.id, "complete")}>Mark complete</button>}{proposal.status === "approved" && proposal.type === "cto" && <small>On-chain handover required</small>}{Boolean(proposal.openChallenges) && <><button className="danger" disabled={Boolean(proposalBusy)} onClick={() => void proposalAction(proposal.id, "uphold")}>Uphold</button><button disabled={Boolean(proposalBusy)} onClick={() => void proposalAction(proposal.id, "reject")}>Reject</button></>}</div></td></tr>; }) : <tr><td colSpan={6} className="admin-empty">No market proposals yet.</td></tr>}</tbody></table></div></section>
    <section className="admin-panel"><header><div><h2>Market pipeline</h2><p>The latest keeper stage and live on-chain fee balances for every launch.</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Market</th><th>Keeper state</th><th>Withheld</th><th>Fee vault</th><th>Accrued split</th><th>Last attempt</th></tr></thead><tbody>{data.launches.map((launch) => { const id=String(launch.id); const diagnostic=diagnosticsByLaunch.get(id); const live=runtimeByLaunch.get(id); const accrued=(live?.accrued ?? {}) as Record<string,unknown>; return <tr key={id}><td><b>${String(launch.symbol)}</b><a href={explorer("account", launch.mint)} target="_blank" rel="noreferrer">{short(launch.mint)}<ExternalLink/></a></td><td><span className={`admin-status ${String(diagnostic?.status ?? "unknown")}`}>{String(diagnostic?.status ?? "unknown")}</span><small>{String(diagnostic?.stage ?? "No keeper pass")}</small><em>{String(diagnostic?.message ?? "")}</em></td><td>{raw(live?.withheldRaw)}<small>{String(live?.withheldSourceCount ?? 0)} sources</small></td><td>{raw(live?.feeVaultRaw)}</td><td><small>Rewards {raw(accrued.rewardRaw ?? launch.reward_fees_accrued_raw)}</small><small>Buyback {raw(accrued.buybackRaw ?? launch.buyback_fees_accrued_raw)}</small><small>Treasury {raw(accrued.treasuryRaw ?? launch.treasury_fees_accrued_raw)}</small><small>Creator {raw(accrued.creatorRaw ?? launch.creator_fees_accrued_raw)}</small></td><td>{when(diagnostic?.last_attempt_at)}</td></tr>; })}</tbody></table></div></section>
    <section className="admin-panel"><header><div><h2>SOL conversions</h2><p>Launch-pool first routing means a new token does not need to be indexed by Jupiter.</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Status</th><th>Launch</th><th>Route</th><th>Launch tokens</th><th>SOL output</th><th>Transactions / error</th></tr></thead><tbody>{data.conversions.length ? data.conversions.map((item) => <tr key={String(item.id)}><td><span className={`admin-status ${String(item.status)}`}>{String(item.status)}</span></td><td>{String(item.launch_id)}</td><td>{String(item.route ?? "legacy Jupiter")}</td><td>{raw(item.total_launch_raw)}</td><td>{item.sol_output_lamports ? sol(item.sol_output_lamports) : "—"}</td><td>{item.swap_signature ? <a href={explorer("tx", item.swap_signature)} target="_blank" rel="noreferrer">{short(item.swap_signature)}<ExternalLink/></a> : <em>{String(item.last_error ?? "Waiting")}</em>}</td></tr>) : <tr><td colSpan={6} className="admin-empty">No SOL conversion attempts yet.</td></tr>}</tbody></table></div></section>
    <section className="admin-panel"><header><div><h2>Holder reward epochs</h2><p>Rewards use amount-held × time-held snapshots, accumulate across epochs, and remain claimable until the holder claims.</p></div></header><div className="admin-table-wrap"><table><thead><tr><th>Epoch</th><th>Market</th><th>Reward</th><th>Eligible holders</th><th>Status</th><th>Funding</th></tr></thead><tbody>{data.rewardEpochs.length ? data.rewardEpochs.map((item) => <tr key={String(item.id)}><td>{short(item.id)}<small>{when(item.ends_at)}</small></td><td>{String(item.launch_id)}</td><td>{raw(item.total_stock_raw)} {String(item.stock_symbol)}</td><td>{String(item.eligible_holders)}</td><td><span className={`admin-status ${String(item.status)}`}>{String(item.status)}</span></td><td>{item.funding_signature ? <a href={explorer("tx", item.funding_signature)} target="_blank" rel="noreferrer">{short(item.funding_signature)}<ExternalLink/></a> : "Waiting"}</td></tr>) : <tr><td colSpan={6} className="admin-empty">No holder epochs have been created yet.</td></tr>}</tbody></table></div></section>
  </main>;
}

function SubmittedProposalDetails({ proposal }: { proposal: MarketProposal }) {
  const profile = proposal.payload.dexDetails;
  const values = { ...proposal.payload, ...(profile && typeof profile === "object" ? profile : {}) };
  const labels: Record<string, string> = { reason: "Reason", description: "Profile description", bannerUrl: "Banner", websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram", communityLead: "Proposed lead", communityTakeoverWallet: "Community takeover wallet", developerWallet: "Community takeover wallet", plan: "Transition plan", evidenceUrl: "Public evidence" };
  const fields = Object.entries(values).filter(([key, value]) => labels[key] && typeof value === "string" && value);
  return <details className="admin-submitted-details"><summary>Submitted details</summary><dl>{fields.map(([key, value]) => <div key={key}><dt>{labels[key]}</dt><dd>{/^https?:\/\//i.test(String(value)) ? <a href={String(value)} target="_blank" rel="noreferrer">{String(value)}<ExternalLink/></a> : String(value)}</dd></div>)}</dl>{proposal.type === "dex_payment" && !proposal.payload.detailsSubmittedAt && <p>Waiting for a holder-approved profile.</p>}</details>;
}
