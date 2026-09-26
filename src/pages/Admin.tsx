import { AdminRipple } from "../components/AdminRipple";
import { AdminCommunityReports } from "../components/AdminCommunityReports";
import { DexProfileFields } from "../components/MarketProposals";
import { WalletIdentity } from "../components/WalletIdentity";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { DexScreenerIcon } from "../components/DexScreenerIcon";
import type { DexProfile, AdminDiagnostics, MarketProposal } from "../types";
import "./admin.css";

const SESSION_KEY = "aqua-admin-session-v1";
const sections = ["overview", "studio", "community", "dex", "logs", "rewards", "ripple", "custody"] as const;
type Section = typeof sections[number];
type Row = Record<string, unknown>;
type Action = "withdraw" | "paid" | "complete" | "uphold" | "reject" | "access";
const labels: Record<Section, string> = { ripple:"Ripple rewards", community: "Community reports", overview: "Overview", studio: "Atlantis Studio", dex: "DEX & proposals", logs: "Logs & pipeline", rewards: "Reward epochs", custody: "Custody & settings" };
const actionLabels: Record<Action, string> = { withdraw: "Withdraw reserved SOL", paid: "Record DEX payment", complete: "Complete profile update", uphold: "Uphold challenges", reject: "Reject challenges", access: "Confirm AQUA profile access" };
const sol = (value: unknown) => `${(Number(value ?? 0) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL`;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const studioCredits = (value: unknown) => (Number(value ?? 0) / 1_000_000).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const raw = (value: unknown) => { try { return BigInt(String(value ?? 0)).toLocaleString(); } catch { return "—"; } };
const when = (value: unknown) => value ? new Date(Number(value)).toLocaleString() : "—";
const short = (value: unknown) => { const text = String(value ?? ""); return text.length > 18 ? `${text.slice(0, 7)}…${text.slice(-6)}` : text || "—"; };
const titleCase = (value: unknown) => String(value ?? "unknown").replaceAll("_", " ");
const typeLabel = (p: MarketProposal) => p.isAutomatic ? p.type === "dex_boost" ? "Auto mini boost" : "Auto DEX fund" : p.type === "dex_boost" ? "DEX boost" : p.type === "cto" ? "Community takeover" : p.type === "dex_update" ? "Update DEX" : "Fund DEX";
const active = (p: MarketProposal) => !["completed", "rejected", "cancelled"].includes(p.status);
const needsAction = (p: MarketProposal) => Boolean(p.openChallenges) || (p.type === "dex_boost" && p.status === "approved" ? false : (!p.spendingPaused && ["ready", "withdrawing", "withdrawn", "approved"].includes(p.status)));
const matches = (value: unknown, search: string) => JSON.stringify(value).toLowerCase().includes(search.trim().toLowerCase());

function Status({ value }: { value: unknown }) { return <span className={`ops-status is-${String(value)}`}>{titleCase(value)}</span>; }
function ChainLink({ value, tx = false }: { value: unknown; tx?: boolean }) {
  const { config } = useRuntime();
  if (!value) return <span>—</span>;
  return <a className="ops-chain" href={`https://solscan.io/${tx ? "tx" : "account"}/${String(value)}${config.useTestnet ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" title={String(value)}>{tx ? short(value) : <WalletIdentity wallet={String(value)} link={false}/>}<ExternalLink size={12}/></a>;
}
function Empty({ children }: { children: ReactNode }) { return <div className="ops-empty">{children}</div>; }
function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="ops-panel"><header><h2>{title}</h2>{description && <p>{description}</p>}</header>{children}</section>;
}
function Pager({ page, total, size, setPage }: { page: number; total: number; size: number; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <footer className="ops-pager"><span>{total ? `${page * size + 1}–${Math.min(total, (page + 1) * size)} of ${total}` : "0 results"}</span><div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16}/></button><span>Page {page + 1} / {pages}</span><button aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={16}/></button></div></footer>;
}
function DataTable({ rows, columns, render, empty }: { rows: Row[]; columns: string[]; render: (row: Row) => ReactNode; empty: string }) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 15) - 1));
  return <><div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Scrollable records"><table><thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{rows.slice(current * 15, current * 15 + 15).map((row, index) => <tr key={String(row.id ?? row.signature ?? row.launch_id ?? index)}>{render(row)}</tr>)}</tbody></table>{!rows.length && <Empty>{empty}</Empty>}</div><Pager page={current} total={rows.length} size={15} setPage={setPage}/></>;
}

export function Admin() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [params, setParams] = useSearchParams();
  const section = sections.includes(params.get("section") as Section) ? params.get("section") as Section : "overview";
  const search = params.get("search") ?? "";
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY));
  const [data, setData] = useState<AdminDiagnostics | null>(null);
  const [volumeRange, setVolumeRange] = useState<"1h" | "24h" | "max">("24h");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ proposal: MarketProposal; action: Action } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("active");
  const [logSource, setLogSource] = useState("keeper");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const authorizedWallet = Boolean(wallet.address && wallet.address === config.adminWallet);
  const requestId = useRef(0);
  const load = useCallback(async (session: string, includeRuntime = false) => {
    const id = ++requestId.current;
    setBusy(true); setError(null);
    try { const next = await api.adminDiagnostics(session, includeRuntime); if (id === requestId.current) setData(next); }
    catch (reason) {
      if (id !== requestId.current) return;
      const message = reason instanceof Error ? reason.message : "Diagnostics could not be loaded.";
      setError(message);
      if (/authorization|expired|verification/i.test(message)) { sessionStorage.removeItem(SESSION_KEY); setToken(null); setData(null); }
    } finally { if (id === requestId.current) setBusy(false); }
  }, []);
  useEffect(() => {
    if (authorizedWallet && token) void load(token); else setData(null);
    return () => { requestId.current++; };
  }, [authorizedWallet, load, token]);
  useEffect(() => { if (!authorizedWallet) { sessionStorage.removeItem(SESSION_KEY); setToken(null); setPending(null); } }, [authorizedWallet]);
  useEffect(() => { setPage(0); }, [search, filter]);
  const navigate = (next: Section, query = "") => { setParams({ section: next, ...(query ? { search: query } : {}) }); };
  const verify = async () => {
    if (!wallet.address || !authorizedWallet) return;
    setBusy(true); setError(null);
    try {
      const challenge = await api.adminChallenge(wallet.address);
      const signed = await wallet.signMessage(challenge.message);
      const session = await api.adminSession({ wallet: wallet.address, challenge: challenge.challenge, ...signed });
      sessionStorage.setItem(SESSION_KEY, session.token); setToken(session.token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Admin verification failed."); }
    finally { setBusy(false); }
  };
  const proposals = useMemo(() => (data?.proposals ?? []).filter(p => matches(p, search) && (filter === "all" || (filter === "active" ? active(p) : filter === "attention" ? needsAction(p) : p.status === filter))).sort((a,b) => Number(needsAction(b)) - Number(needsAction(a)) || b.createdAt - a.createdAt), [data, search, filter]);
  const chosen = proposals.find(p => p.id === selected) ?? proposals[0];
  const action = async (reference: string, managed: boolean) => {
    if (!token || !pending || !authorizedWallet) return;
    setActionBusy(true);
    const { proposal: p, action: kind } = pending;
    try {
      if (kind === "withdraw") await api.adminWithdrawProposal(token, p.id);
      else if (kind === "paid") await api.adminMarkProposalPaid(token, p.id, reference, managed);
      else if (kind === "complete") await api.adminCompleteProposal(token, p.id, reference);
      else if (kind === "access") await api.adminDexAccess(token, p.launchId, true, reference);
      else await api.adminResolveProposalChallenge(token, p.id, kind === "uphold");
      toast.success(kind === "withdraw" ? "Reserved SOL withdrawn" : "Admin action recorded");
      setPending(null); await load(token);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Admin action failed."); }
    finally { setActionBusy(false); }
  };

  if (!wallet.address || !authorizedWallet || !token || !data) return <main className="page ops-page"><section className="ops-access"><span className="ops-eyebrow">AQUA / OPERATIONS</span><h1>{!wallet.address ? "Your control room." : !authorizedWallet ? "Access restricted" : token ? "Loading operations" : "Verify your admin wallet"}</h1><p>{!wallet.address ? "Connect the authorized wallet to manage DEX funding and inspect market operations." : !authorizedWallet ? "This wallet is not authorized to access operational data." : token ? "Fetching the latest market and keeper records." : "Sign a verification message. This is not a transaction and cannot move funds."}</p>{!wallet.address ? <button className="ops-primary" onClick={() => wallet.setModalOpen(true)}>Connect admin wallet</button> : authorizedWallet && <button className="ops-primary" disabled={busy} onClick={() => token ? void load(token) : void verify()}>{busy && <Loader2 size={16} className="spin"/>}{busy ? "Please wait…" : token ? "Retry loading" : "Verify wallet"}</button>}{error && <div className="ops-error" role="alert">{error}</div>}</section></main>;

  const attention = config.marketGovernanceEnabled ? data.proposals.filter(needsAction) : [];
  const studio = data.studio ?? { creditsSpentMicroUsd: "0", uniqueUsers: 0, coinsBuilt: 0, coins: [] };
  const blocked = data.diagnostics.filter(d => ["blocked", "failed"].includes(String(d.status)));
  const marketName = (id: unknown) => data.launches.find(l => l.id === id)?.symbol ?? id;
  const keeperRows = data.diagnostics.map(row => ({ ...row, onChain: data.runtime.markets?.find(m => m.launchId === row.launch_id), recordedAccruals: data.launches.filter(l => l.id === row.launch_id).map(l => ({ rewardRaw: l.reward_fees_accrued_raw, buybackRaw: l.buyback_fees_accrued_raw, treasuryRaw: l.treasury_fees_accrued_raw, creatorRaw: l.creator_fees_accrued_raw }))[0] }));
  const logs = (logSource === "keeper" ? keeperRows : logSource === "conversions" ? data.conversions : logSource === "settlements" ? data.settlements : data.rewardPurchases).filter(row => matches([row, marketName(row.launch_id)], search) && (!errorsOnly || Boolean(row.last_error) || ["blocked", "failed"].includes(String(row.status))));
  const proposalPage = Math.min(page, Math.max(0, Math.ceil(proposals.length / 8) - 1));
  return <main className="page ops-page">
    <header className="ops-hero"><div><span className="ops-eyebrow">AQUA / OPERATIONS</span><h1>Control room</h1><p>Market operations, with a clear next step.</p></div><div className="ops-refresh"><span><i/>{config.useTestnet ? "Devnet" : "Mainnet"}<small>Snapshot · {when(data.generatedAt)}</small></span><button onClick={() => void load(token)} disabled={busy}><RefreshCw size={16} className={busy ? "spin" : ""}/>{busy ? "Refreshing…" : "Refresh"}</button></div></header>
    {error && <div className="ops-error" role="alert">{error} Your previous snapshot is still shown.</div>}
    <div className="ops-workspace"><aside className="ops-sidebar"><nav aria-label="Admin sections">{sections.filter(s => s !== "dex" || config.marketGovernanceEnabled).map(s => <button key={s} aria-current={section === s ? "page" : undefined} onClick={() => navigate(s)}>{labels[s]}{s === "dex" && attention.length > 0 && <b>{attention.length}</b>}{s === "logs" && blocked.length > 0 && <b className="warning">{blocked.length}</b>}</button>)}</nav><div className="ops-sidebar-note"><ShieldCheck size={16}/><span>Wallet verified<small><WalletIdentity wallet={wallet.address} link={false}/></small></span></div></aside>
    <div className="ops-content">
      {section !== "overview" && section !== "custody" && <div className="ops-section-title"><h2>{labels[section]}</h2><label className="ops-search"><Search size={17}/><input aria-label="Search admin records" value={search} maxLength={section==="ripple"?200:undefined} placeholder={section==="ripple"?"Search tweet, account, wallet or coin…":"Search market, mint, ID or error…"} onChange={e => setParams({ section, ...(e.target.value ? { search: e.target.value } : {}) }, { replace: true })}/>{search && <button aria-label="Clear search" onClick={() => setParams({ section }, { replace: true })}><X size={15}/></button>}</label></div>}
      {section === "overview" && <>
        <div className="ops-metrics"><Metric label="Needs your attention" value={attention.length + blocked.length} note="Proposals and blocked markets" onClick={() => navigate(attention.length ? "dex" : "logs")}/><Metric label="Live markets" value={data.counts.live_launches ?? 0} note="Graduated launches" onClick={() => navigate("logs")}/><Metric label="DEX reserved" value={data.dexReservedLamports !== undefined ? sol(data.dexReservedLamports) : data.runtime.available ? sol(data.runtime.balances?.reservedDexLamports) : "Unavailable"} note="Held for approved funding" onClick={() => navigate(config.marketGovernanceEnabled ? "dex" : "custody")}/><Metric label="Claimable epochs" value={data.counts.claimable_epochs ?? 0} note={`${data.counts.unclaimed_entitlements ?? 0} unclaimed entitlements`} onClick={() => navigate("rewards")}/></div>
        <div className="ops-metrics ops-financial-metrics">
          <article className="ops-metric ops-volume" aria-label="Trading volume"><div className="ops-volume-heading"><span>Trading volume</span><div className="ops-range" role="group" aria-label="Volume time range">{([['1h','1hr'],['24h','24hr'],['max','Max']] as const).map(([value,label])=><button key={value} aria-pressed={volumeRange===value} onClick={()=>setVolumeRange(value)}>{label}</button>)}</div></div><strong aria-live="polite">{data.marketMetrics?usd.format(data.marketMetrics.volumeUsd[volumeRange]):'Unavailable'}</strong><small>{volumeRange==='max'?'All indexed history':'Indexed trades'} · valued at latest pair prices{Boolean(data.marketMetrics?.unpricedVolumeMarkets)&&` · ${data.marketMetrics!.unpricedVolumeMarkets} unpriced market(s) excluded`}</small></article>
          <Metric label="Funded & unclaimed" value={data.marketMetrics?usd.format(data.marketMetrics.unclaimedUsd):'Unavailable'} note="Holder rewards before eligibility checks and claim costs" onClick={()=>navigate('rewards')}/>
        </div>
        <Panel title="Action queue" description="Pending decisions and blocked operations come first."><div className="ops-queue">{attention.slice(0, 6).map(p => <button key={p.id} onClick={() => { setSelected(p.id); setFilter("attention"); navigate("dex"); }}><div><b>${p.marketSymbol} <span>{typeLabel(p)}</span></b><small>{p.openChallenges ? `${p.openChallenges} open challenge(s)` : nextStep(p)}</small></div><Status value={p.status}/><ArrowUpRight size={17}/></button>)}{blocked.slice(0, 4).map(d => <button key={String(d.launch_id)} onClick={() => { setLogSource("keeper"); navigate("logs", String(d.launch_id)); }}><div><b>${String(marketName(d.launch_id))} <span>Keeper blocked</span></b><small>{titleCase(d.stage)}</small></div><Status value={d.status}/><ArrowUpRight size={17}/></button>)}{!attention.length && !blocked.length && <Empty>No pending admin actions in this snapshot.</Empty>}</div></Panel>
        <Panel title="Service status"><div className="ops-service-grid">{[["Fee keeper", data.flags.feeKeeperEnabled], ["SOL conversion", data.flags.solFeeConversionEnabled], ["Holder rewards", data.flags.rewardDistributionEnabled], ["Market governance", config.marketGovernanceEnabled]].map(([label, enabled]) => <div key={String(label)}><span>{label}</span><Status value={enabled ? "enabled" : "disabled"}/></div>)}</div></Panel>
        <AlertSettings alerts={data.alerts}/>
      </>}
      {section === "dex" && (!config.marketGovernanceEnabled ? <Empty>Market governance is disabled in this environment.</Empty> : <>
        <div className="ops-toolbar"><div className="ops-filters" aria-label="Filter proposals">{[["active", "Active"], ["attention", "Needs action"], ["funding", "Funding"], ["all", "All records"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><span>{proposals.length} matches · up to 200 records, active first</span></div>
        <div className="ops-dex-layout"><section className="ops-proposal-list" aria-label="Proposals">{proposals.slice(proposalPage * 8, proposalPage * 8 + 8).map(p => <button className={chosen?.id === p.id ? "selected" : ""} key={p.id} onClick={() => setSelected(p.id)} aria-pressed={chosen?.id === p.id}><div><b>${p.marketSymbol}</b><Status value={p.status}/></div><span>{p.type !== "cto" && <DexScreenerIcon/>}{typeLabel(p)}</span>{p.targetUsd > 0 && p.type !== "cto" && <><div className="ops-funding-numbers"><strong>${p.fundedUsd.toFixed(2)}</strong><small>of ${p.targetUsd.toFixed(0)}</small></div><progress aria-label="Funding progress" value={Math.min(p.fundedUsd, p.targetUsd)} max={p.targetUsd}/></>}<small>{p.openChallenges ? `${p.openChallenges} challenge(s) to review` : nextStep(p)}</small></button>)}{!proposals.length && <Empty>No proposals match this view.</Empty>}<Pager page={proposalPage} total={proposals.length} size={8} setPage={next => { setPage(next); setSelected(proposals[next * 8]?.id ?? null); }}/></section>
        {chosen && <ProposalDetail key={chosen.id} proposal={chosen} onAction={kind => setPending({ proposal: chosen, action: kind })} onSaveDetails={async details => { await api.adminAutomaticDexDetails(token, chosen.id, details); await load(token); }}/>}
        </div></>)}
      {section === "ripple" && <AdminRipple token={token} search={search} refreshKey={data.generatedAt}/>}
      {section === "community" && <AdminCommunityReports token={token} search={search}/>}
      {section === "logs" && <>
        <div className="ops-toolbar"><label>Source <select aria-label="Log source" value={logSource} onChange={e => setLogSource(e.target.value)}><option value="keeper">Keeper / market pipeline</option><option value="conversions">SOL conversions</option><option value="settlements">Fee settlements</option><option value="purchases">Reward purchases</option></select></label><label className="ops-check"><input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)}/>Errors only</label></div>
        <Panel title={logSource === "keeper" ? "Latest keeper state" : titleCase(logSource)} description={logSource === "keeper" ? "Latest pass per market, not a full Railway log stream. Expand a row for the complete error and recorded details. Latest 100 markets." : "Latest 200 stored records. Search and pagination apply to this snapshot."}>
          <DataTable key={`${logSource}:${search}:${errorsOnly}`} rows={logs} columns={["Market", "Status / stage", "Updated", "Details & transactions"]} empty="No records match your filters." render={row => <><td><Link to={`/token/${String(row.launch_id)}`}>${String(marketName(row.launch_id))}</Link><small className="ops-mono">{String(row.launch_id)}</small></td><td><Status value={row.status ?? row.kind ?? "recorded"}/><small>{titleCase(row.stage ?? row.route ?? row.kind ?? "")}</small></td><td className="ops-nowrap">{when(row.updated_at ?? row.last_attempt_at ?? row.created_at)}</td><td><LogDetails row={row}/></td></>}/>
        </Panel>
      </>}
      {section === "rewards" && <Panel title="Funded & unclaimed" description="Funded holder rewards valued at allocation, before wallet eligibility checks and claim costs. All claimable epochs are included.">
        {data.marketMetrics?<><div className="ops-unclaimed-total">{usd.format(data.marketMetrics.unclaimedUsd)}<small>Across all markets</small></div><DataTable key={search} rows={data.marketMetrics.unclaimedMarkets.filter(row=>matches(row,search))} columns={['Market','Unclaimed value','Entitlements']} empty="No funded, unclaimed rewards match this view." render={row=><><td><Link to={`/token/${String(row.id)}`}><b>${String(row.symbol)}</b></Link><small>{String(row.name)}</small></td><td>{usd.format(Number(row.unclaimedUsd))}</td><td>{String(row.entitlements)}</td></>}/></>:<Empty>Unclaimed totals are unavailable in this snapshot.</Empty>}
      </Panel>}
      {section === "rewards" && <Panel title="Holder reward epochs" description="Latest 200 epochs. Raw reward amounts use the token's smallest unit; they are not SOL values."><DataTable key={search} rows={data.rewardEpochs.filter(row => matches([row, marketName(row.launch_id)], search))} columns={["Market / epoch", "Amount (raw)", "Holders", "Status", "Funding"]} empty="No reward epochs match your search." render={row => <><td><b>${String(marketName(row.launch_id))}</b><small>{short(row.id)} · {when(row.ends_at)}</small></td><td>{raw(row.total_stock_raw)}<small>{String(row.stock_symbol)}</small></td><td>{String(row.eligible_holders)}</td><td><Status value={row.status}/></td><td><ChainLink value={row.funding_signature} tx/></td></>}/></Panel>}
      {section === "studio" && <>
        <div className="ops-metrics"><Metric label="Credits spent" value={studioCredits(studio.creditsSpentMicroUsd)} note="USD credits charged by completed Studio jobs" onClick={() => navigate("studio")}/><Metric label="Studio users" value={studio.uniqueUsers} note="Unique wallets that have run Studio jobs" onClick={() => navigate("studio")}/><Metric label="Coins built" value={studio.coinsBuilt} note="AQUA launches attributed to Studio projects" onClick={() => navigate("studio")}/></div>
        <Panel title="Coins built with Atlantis" description="Launches imported directly from an Atlantis Studio project.">
          <DataTable key={search} rows={studio.coins.filter(row => matches(row, search)) as Row[]} columns={["Coin", "Studio project", "Creator", "Status", "Created"]} empty="No Studio-built coins match this view." render={row => <><td><Link to={`/token/${String(row.id)}`}><b>${String(row.symbol)}</b></Link><small>{String(row.name)}</small></td><td><b>{String(row.project_name)}</b><small className="ops-mono">{short(row.project_id)}</small></td><td><ChainLink value={row.creator_wallet}/></td><td><Status value={row.status}/></td><td className="ops-nowrap">{when(row.created_at)}</td></>}/>
        </Panel>
      </>}
      {section === "custody" && <>
        <div className="ops-toolbar"><span>Live chain scans are optional. Other admin views use stored records.</span><button disabled={busy} onClick={() => void load(token, true)}><RefreshCw size={15} className={busy ? "spin" : ""}/>{busy ? "Loading…" : "Scan live balances"}</button></div>
        <Panel title="Wallets & reserves" description="Public destinations and balances read from the deployed program.">{data.runtime.available ? <div className="ops-custody">{[["Fee keeper", data.runtime.operator, sol(data.runtime.balances?.nativeLamports)], ["Reward operator", data.runtime.rewardOperator, sol(data.runtime.balances?.rewardNativeLamports)], ["Treasury", data.runtime.destinations?.treasury, ""], ["Buyback wallet", data.runtime.destinations?.buybackBuyer, ""]].map(([label, address, balance]) => <article key={label}><small>{label}</small><ChainLink value={address}/><b>{balance}</b></article>)}<article><small>Reward reserves</small><b>{sol(data.runtime.balances?.reservedRewardLamports)}</b><span>{sol(data.runtime.balances?.wrappedSolLamports)} wrapped</span></article><article><small>DEX reserves</small><b>{sol(data.runtime.balances?.reservedDexLamports)}</b><span>Allocated, not spendable rewards</span></article></div> : <Empty>{data.runtime.reason ?? "Chain diagnostics unavailable."}</Empty>}</Panel>
        <Panel title="Keeper configuration"><dl className="ops-definition"><div><dt>Conversion minimum</dt><dd>${(data.flags.conversionMinimumUsdCents / 100).toFixed(2)}</dd></div><div><dt>Conversion slippage</dt><dd>{data.flags.conversionSlippageBps / 100}%</dd></div><div><dt>Keeper interval</dt><dd>{data.flags.keeperIntervalMs / 1000}s</dd></div><div><dt>Reward epoch</dt><dd>{data.flags.rewardEpochSeconds / 60} minutes</dd></div></dl></Panel><AlertSettings alerts={data.alerts}/>
      </>}
    </div></div>
    {pending && <ActionDialog key={`${pending.proposal.id}:${pending.action}`} pending={pending} busy={actionBusy} onClose={() => setPending(null)} onSubmit={action}/>}
  </main>;
}

function Metric({ label, value, note, onClick }: { label: string; value: ReactNode; note: string; onClick: () => void }) { return <button className="ops-metric" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small></button>; }
function nextStep(p: MarketProposal) {
  if (p.type === "dex_boost") return p.status === "voting" ? "Holders are choosing the funding rate" : p.status === "approved" ? "Waiting for DEX funding or challenges to finish" : p.status === "funding" ? "Collecting rewards until the funding timer ends" : p.status === "ready" ? `Withdraw the reserve for the ${p.boostPack}x pack` : p.status === "withdrawing" ? "Resume the existing withdrawal" : p.status === "withdrawn" ? `Purchase ${p.boostPack}x and record the order reference` : p.outcome === "below_minimum" ? "Below $99; funds returned to holders" : p.status === "completed" ? "Purchase recorded" : "No purchase required";
  if (p.isAutomatic && p.type === "dex_payment" && p.status === "ready" && !p.payload.detailsSubmittedAt) return "Prepare the profile details, then withdraw";
  if (p.spendingPaused) return "Spending paused during the profile vote";
  if (p.status === "ready") return "Review approved details, then withdraw";
  if (p.status === "withdrawing") return "Review or resume the existing withdrawal";
  if (p.status === "withdrawn") return "Submit to DEX, then record payment";
  if (p.status === "approved") return p.type === "cto" ? "Verify on-chain handover" : "Apply approved details, then complete";
  if (p.status === "funding") return "Accumulating fees toward the target";
  if (p.status === "voting") return "Waiting for the holder vote";
  return "No action needed";
}
function ProposalDetail({ proposal: p, onAction, onSaveDetails }: { proposal: MarketProposal; onAction: (action: Action) => void; onSaveDetails: (details: DexProfile) => Promise<void> }) {
  const yes = BigInt(p.submittedVotes?.yesPowerRaw || "0"), total = yes + BigInt(p.submittedVotes?.noPowerRaw || "0");
  const challengeActive = Boolean(p.openChallenges) || Boolean(p.challengeEndsAt && p.challengeEndsAt * 1000 > Date.now());
  return <section className="ops-detail"><header><span className="ops-eyebrow">{typeLabel(p)}</span><h2>${p.marketSymbol} <Status value={p.status}/></h2><Link to={`/token/${p.launchId}`}>Open market <ArrowUpRight size={14}/></Link></header><div className="ops-next-step"><small>Next step</small><b>{p.openChallenges ? "Review the open challenges before proceeding" : nextStep(p)}</b></div><dl className="ops-definition"><div><dt>Reserved SOL</dt><dd>{sol(p.reservedLamports ?? p.fundedLamports)}</dd></div><div><dt>Submitted ballots</dt><dd>{p.submittedVotes ? <>{p.type === "dex_boost" ? "5% / 10% / 20% / No poll" : total ? `${Number(yes * 100n / total)}% yes` : "No votes"} · {p.submittedVotes.voters} voters<small>Power recorded at submission; live eligibility is checked on the market.</small></> : "View live totals on the market"}</dd></div><div><dt>Vote ends</dt><dd>{when(p.endsAt * 1000)}</dd></div>{p.challengeEndsAt && <div><dt>Challenge window ends</dt><dd>{when(p.challengeEndsAt * 1000)}</dd></div>}<div><dt>Mint</dt><dd><ChainLink value={p.mint}/></dd></div><div><dt>Proposal ID</dt><dd className="ops-mono">{p.id}</dd></div>{p.withdrawalSignature && <div><dt>Withdrawal proof</dt><dd><ChainLink value={p.withdrawalSignature} tx/></dd></div>}</dl>{p.type === "dex_boost" && <div className="ops-next-step"><small>Boost campaign</small><b>{p.fundingPercent ? `${p.fundingPercent}% of future rewards · milestones add 20 minutes` : "5% / 10% / 20% / No poll"}</b>{p.fundingEndsAt && <p>Funding ends {when(p.fundingEndsAt * 1000)}</p>}{p.boostPack && <p>{p.boostPack}x · {p.boostHours} hours · ${p.targetUsd.toFixed(0)}</p>}<p>Returned to holders: {sol(p.returnedLamports)}</p>{p.outcome === "below_minimum" && <p>Below minimum. No purchase required.</p>}</div>}<SubmittedProposalDetails proposal={p}/>{p.isAutomatic && p.type === "dex_payment" && ["funding", "ready"].includes(p.status) && !p.payload.detailsApprovedProposalId && <TeamProfileForm proposal={p} save={onSaveDetails}/>}
    {Boolean(p.openChallenges) && <div className="ops-challenges"><h3>Open challenges</h3>{p.challenges?.map(c => <article key={c.id}><ChainLink value={c.wallet}/><p>{c.reason}</p><small>{when(c.createdAt)}</small></article>)}{!p.challenges?.length && <p>Challenge details require the updated backend. Review evidence before resolving.</p>}</div>}
    <div className="ops-actions">{["ready", "withdrawing"].includes(p.status) && <button className="ops-primary" disabled={p.spendingPaused || challengeActive} title={challengeActive ? "Withdrawal is blocked while challenges are open or their window is active." : undefined} onClick={() => onAction("withdraw")}>{p.status === "withdrawing" ? "Resume withdrawal" : "Withdraw reserved SOL"}</button>}{p.status === "withdrawn" && <button className="ops-primary" onClick={() => onAction("paid")}>{p.type === "dex_boost" ? "Record boost purchase" : "Record DEX payment"}</button>}{p.status === "approved" && p.type === "dex_update" && <button className="ops-primary" disabled={Boolean(p.openChallenges) || p.spendingPaused} onClick={() => onAction("complete")}>Complete profile update</button>}{Boolean(p.openChallenges) && <><button className="ops-danger" disabled={!p.challenges?.length} onClick={() => onAction("uphold")}>Uphold challenges</button><button disabled={!p.challenges?.length} onClick={() => onAction("reject")}>Reject challenges</button></>}{p.type !== "cto" && <><a className="ops-button" href="https://marketplace.dexscreener.com/" target="_blank" rel="noreferrer"><DexScreenerIcon/>DEX marketplace <ExternalLink size={13}/></a>{p.type !== "dex_boost" && <button onClick={() => onAction("access")}>Confirm AQUA profile access</button>}</>}</div></section>;
}
function TeamProfileForm({ proposal, save }: { proposal: MarketProposal; save: (details: DexProfile) => Promise<void> }) {
  const [profile, setProfile] = useState<DexProfile>({ description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "", ...(proposal.payload.dexDetails as Partial<DexProfile> ?? {}) });
  const [busy, setBusy] = useState(false);
  return <details className="ops-submitted"><summary>Prepare profile details</summary><p>Use the coin’s existing identity and verified links. Holder-approved updates take precedence.</p><form onSubmit={async event => { event.preventDefault(); setBusy(true); try { await save(profile); toast.success("Profile details saved"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save details"); } finally { setBusy(false); } }}><DexProfileFields profile={profile} update={(key,value) => setProfile(previous => ({ ...previous,[key]:value }))}/><button className="ops-primary" disabled={busy || proposal.spendingPaused}>{busy ? "Saving…" : "Save team profile"}</button></form></details>;
}

function SubmittedProposalDetails({ proposal }: { proposal: MarketProposal }) {
  const profile = proposal.payload.dexDetails;
  const values = { ...proposal.payload, ...(profile && typeof profile === "object" ? profile : {}) };
  const names: Record<string, string> = { reason: "Reason", description: "Profile description", bannerUrl: "Banner", websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram", communityLead: "Proposed lead", communityTakeoverWallet: "Community takeover wallet", developerWallet: "Community takeover wallet", plan: "Transition plan", evidenceUrl: "Public evidence" };
  const fields = Object.entries(values).filter(([key, value]) => names[key] && typeof value === "string" && value);
  return <details className="ops-submitted" open><summary>Submitted information</summary><dl>{fields.map(([key, value]) => <div key={key}><dt>{names[key]}</dt><dd>{/^https?:\/\//i.test(String(value)) ? <a href={String(value)} target="_blank" rel="noreferrer">{String(value)}<ExternalLink size={12}/></a> : ["communityTakeoverWallet", "developerWallet"].includes(key) ? <WalletIdentity wallet={String(value)}/> : String(value)}</dd></div>)}</dl>{proposal.type === "dex_payment" && !proposal.payload.detailsSubmittedAt && <p>Waiting for a holder-approved profile.</p>}</details>;
}
function LogDetails({ row }: { row: Row }) {
  const [copied, setCopied] = useState(false);
  const message = String(row.last_error ?? row.message ?? "Recorded successfully");
  return <details className="ops-log-details"><summary>{message}</summary><p>{message}</p><div className="ops-proof-links">{["signature", "withdraw_signature", "swap_signature", "pool_swap_signature", "payout_signature", "purchase_signature", "funding_signature"].filter(key => row[key]).map(key => <div key={key}><small>{titleCase(key)}</small><ChainLink value={row[key]} tx/></div>)}</div><pre>{JSON.stringify(row, null, 2)}</pre><button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(row, null, 2)); setCopied(true); } catch { toast.error("Could not copy this record"); } }}>{copied ? <Check size={14}/> : <Copy size={14}/>}{copied ? "Copied" : "Copy record"}</button></details>;
}
function AlertSettings({ alerts }: { alerts?: AdminDiagnostics["alerts"] }) {
  return <Panel title="Discord alerts" description="Important funding milestones, DEX actions, challenges, and blocked keepers."><div className="ops-alert-settings"><Status value={!alerts?.configured ? "disabled" : alerts.valid ? "enabled" : "invalid"}/><p>{!alerts?.configured ? <>Set <code>ADMIN_DISCORD_WEBHOOK_URL</code> on the backend Railway service to enable notifications.</> : !alerts.valid ? "The configured webhook URL is invalid. The API remains available; fix the backend variable to enable alerts." : <>Webhook configured. Last delivered: {when(alerts.lastDeliveredAt)}.{alerts.failedDeliveries > 0 && ` ${alerts.failedDeliveries} undelivered alert(s) have recorded errors; active events are retried.`}</>}</p></div></Panel>;
}
function ActionDialog({ pending: { proposal, action }, busy, onClose, onSubmit }: { pending: { proposal: MarketProposal; action: Action }; busy: boolean; onClose: () => void; onSubmit: (reference: string, managed: boolean) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reference, setReference] = useState("");
  const [managed, setManaged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const requiresReference = ["paid", "complete", "access"].includes(action);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="ops-dialog" aria-labelledby="admin-action-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><form onSubmit={e => { e.preventDefault(); if (confirmed && (!requiresReference || reference.trim())) void onSubmit(reference.trim(), managed); }}><header><span className="ops-eyebrow">${proposal.marketSymbol} / ADMIN ACTION</span><button type="button" aria-label="Close confirmation" disabled={busy} onClick={onClose}><X size={18}/></button></header><h2 id="admin-action-title">{actionLabels[action]}</h2><p>{action === "withdraw" ? `This moves ${sol(proposal.reservedLamports ?? proposal.fundedLamports)} of reserved funding to the configured AQUA admin wallet. It does not pay DEX Screener automatically.` : action === "uphold" ? "This upholds all open challenges on this proposal and returns reserved funding to rewards. Review each challenge first." : action === "reject" ? "This rejects all open challenges on this proposal. Review each challenge first." : action === "access" ? "Confirm only after verifying AQUA can edit this profile through its own marketplace account." : proposal.type === "dex_boost" ? `Record completion only after the ${proposal.boostPack}x boost pack has been purchased for this token.` : "Record completion only after the exact holder-approved details are live on DEX Screener."}</p>{requiresReference && <label className="ops-field">Order or verification reference<input autoFocus required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} placeholder="Order ID or verification reference"/></label>}{action === "paid" && proposal.type !== "dex_boost" && <label className="ops-check"><input type="checkbox" checked={managed} onChange={e => setManaged(e.target.checked)}/>I verified AQUA can edit this profile through its own account.</label>}<label className="ops-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I reviewed the approved details and confirm this action.</label><footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={action === "uphold" ? "ops-danger" : "ops-primary"} disabled={busy || !confirmed || (requiresReference && !reference.trim())}>{busy && <Loader2 size={16} className="spin"/>}{busy ? "Processing…" : "Confirm action"}</button></footer></form></dialog>;
}
