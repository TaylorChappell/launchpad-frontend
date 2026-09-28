import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useRuntime } from "../context";
import { keeperHealth, keeperAmount, keeperSteps, keeperUsd, type AdminFeeKeeperResponse, type KeeperConversion, type KeeperMarket, type KeeperRange } from "../fee-keeper-display";
import "./admin-fee-keeper.css";

const date = (value: number | null | undefined) => value ? new Date(value).toLocaleString() : "—";
const label = (value: string | null | undefined) => value ? value.replaceAll("_", " ") : "Not checked";
const percent = (value: number | null | undefined) => value == null ? "—" : `${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 3 })}%`;
const sol = (value: string | null | undefined) => value == null ? "—" : `${keeperAmount(value)} SOL`;
function Status({ value }: { value: string | null }) { return <span className={`ops-status is-${value ?? "unknown"}`}>{label(value)}</span>; }

export function AdminFeeKeeper({ token, search, refreshKey }: { token: string; search: string; refreshKey: number }) {
  const [range, setRange] = useState<KeeperRange>("24h");
  return <KeeperReport key={`${token}:${search}:${range}`} token={token} search={search} refreshKey={refreshKey} range={range} setRange={setRange}/>;
}

function KeeperReport({ token, search, refreshKey, range, setRange }: {
  token: string; search: string; refreshKey: number; range: KeeperRange; setRange: (range: KeeperRange) => void;
}) {
  const [data, setData] = useState<AdminFeeKeeperResponse | null>(null);
  const [offset, setOffset] = useState(0), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [queueFilter,setQueueFilter]=useState("all");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>, running = false;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 15_000); };
    async function load() {
      if (running || controller.signal.aborted) return;
      if (document.hidden) { schedule(); return; }
      running = true; setBusy(true);
      try {
        const next = await api.adminFeeKeeper(token, { range, search, offset }, controller.signal);
        if (!controller.signal.aborted) { setData(next); setError(""); }
      } catch (reason) {
        if (!controller.signal.aborted) {
          const message = reason instanceof Error ? reason.message : "Fee keeper records could not load.";
          setError(message);
          if (/authorization|expired|verification/i.test(message)) setData(null);
        }
      } finally { running = false; if (!controller.signal.aborted) { setBusy(false); schedule(); } }
    }
    const visibility = () => { if (!document.hidden) void load(); };
    timer = setTimeout(() => void load(), search ? 250 : 0);
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [token, search, range, offset, refreshKey, revision]);

  const health=data?keeperHealth(data):null;
  const queue=data?.queue.filter(m=>queueFilter==="all"|| (queueFilter==="attention"?m.status==="blocked"||Boolean(m.conversionError):!m.conversionId&&m.status!=="blocked"&&!m.conversionError))??[];
  return <div className="ops-keeper">
    <div className="ops-toolbar">
      <div className="ops-filters" role="group" aria-label="Fee keeper history range">{([['1h', '1 hour'], ['24h', '24 hours'], ['7d', '7 days'], ['max', 'All time']] as const).map(([value, text]) =>
        <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{text}</button>)}</div>
      <button disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} className={busy ? "spin" : ""}/>{busy ? "Updating…" : "Refresh keeper"}</button>
    </div>
    {error && <div className="ops-error" role="alert">{error}{data && " Showing the last successful snapshot."}<button onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
    {!data ? <div className="ops-empty">{error ? "Fee keeper data unavailable." : "Loading fee keeper activity…"}</div> : <>
      <section className="ops-keeper-health" aria-label="Fee keeper status">
        <div><Activity size={21}/><span><b>Recorded activity · {health?.label}</b><small>Last keeper update · {date(data.summary.lastAttemptAt)}</small></span></div>
        <span className={`ops-status is-${data.settings.slicingEnabled ? "enabled" : "disabled"}`}>{data.settings.slicingEnabled ? "Paced sales enabled" : "Paced sales disabled"}</span>
        <p className={`ops-health-reason is-${health?.tone}`}>{health?.message}<span>Last recorded SOL conversion · {date(data.summary.lastSaleAt)}</span></p>
        <small>Snapshot {date(data.generatedAt)} · refreshes every 15s while visible · keeper setting in this API: {data.settings.enabled ? "enabled" : "disabled"}</small>
      </section>
      <div className="ops-metrics">
        <article className="ops-metric"><span>Conversions in progress</span><strong>{data.summary.active}</strong><small>{data.summary.blocked} markets need attention · current queue</small></article>
        <article className="ops-metric"><span>SOL converted</span><strong>{sol(data.summary.sales.solLamports)}</strong><small>{data.summary.sales.count} completed swaps · selected period</small></article>
        <article className="ops-metric"><span>Largest conversion</span><strong>{sol(data.summary.sales.largestLamports)}</strong><small>Average {sol(data.summary.sales.averageLamports)}</small></article>
        <article className="ops-metric"><span>Recorded network fees</span><strong>{sol(data.summary.transactions.feeLamports)}</strong><small>{data.summary.transactions.confirmed} confirmed harvest / conversion transactions{data.summary.transactions.missingFeeCount > 0 && ` · ${data.summary.transactions.missingFeeCount} fees unavailable`}</small></article>
      </div>
      {data.summary.throughput && <div className="ops-metrics" aria-label="Fee keeper throughput">
        <article className="ops-metric"><span>Fees waiting to sell</span><strong>{keeperUsd(data.summary.throughput.backlogUsd)}</strong><small>Recorded vault fees + unsold withdrawals</small></article>
        <article className="ops-metric"><span>Fees collected / hour</span><strong>{keeperUsd(data.summary.throughput.incomingHourUsd)}</strong><small>Net trading fees harvested in the last hour</small></article>
        <article className="ops-metric"><span>Fees processed / hour</span><strong>{keeperUsd(data.summary.throughput.convertedHourUsd)}</strong><small>Fee tokens sold in confirmed pool swaps</small></article>
        <article className="ops-metric"><span>Catch-up markets</span><strong>{data.summary.throughput.catchupMarkets}</strong><small>{data.settings.catchupEnabled ? `Up to ${percent(data.settings.buyParticipationBps)} of verified buying` : "Catch-up disabled"}</small></article>
      </div>}
      <section className="ops-panel" aria-label="Conversion controls"><div className="ops-keeper-controls">
        <div><span>SOL conversion</span><b>{data.settings.conversionEnabled ? "Enabled" : "Disabled"}</b></div>
        <div><span>Impact limit</span><b>{percent(data.settings.maxImpactBps)}</b></div>
        <div><span>Preferred slice</span><b>{keeperUsd(data.settings.preferredSliceUsd)}</b></div>
        <div><span>Minimum conversion</span><b>{keeperUsd(data.settings.minimumUsd)}</b></div>
        <div><span>Batch target</span><b>{data.settings.clearHours} hours</b></div>
        <div><span>Keeper interval</span><b>{data.settings.intervalMs / 1000}s</b></div>
        {data.settings.conversionIntervalMs != null && <div><span>Settlement checks</span><b>{data.settings.conversionIntervalMs / 1000}s</b></div>}
        <div><span>Catch-up</span><b>{data.settings.catchupEnabled ? "Automatic" : "Disabled"}</b></div>
      </div><p className="ops-keeper-note">Impact limits can delay the batch target. Existing conversions retain their saved policy. Settings reflect this API; a separate keeper service must use matching settings. Network fees exclude account rent and trading fees.</p></section>
      <section className="ops-panel" aria-label="Fee keeper queue"><header><h2>What the keeper is doing</h2><p>Current state per coin. Recorded vault balances and dollar estimates can lag the chain; a planned sale is not a confirmed sale.</p></header>
        <div className="ops-filters" role="group" aria-label="Filter loaded queue">{[["all","All"],["attention","Needs attention"],["waiting","Waiting"]].map(([value,label])=><button key={value} aria-pressed={queueFilter===value} onClick={()=>setQueueFilter(value)}>{label}</button>)}</div>
        <div className="ops-table-scroll" role="region" aria-label="Fee keeper market queue" tabIndex={0}><table className="ops-keeper-queue"><thead><tr><th>Coin / last check</th><th>Recorded vault fees</th><th>Active sale</th><th>Stage / reason</th><th>Pacing</th><th>Backlog / hourly flow</th></tr></thead>
          <tbody>{queue.map(market => <QueueRow key={market.launchId} market={market} now={data.generatedAt} slicing={data.settings.slicingEnabled}/>)}</tbody></table>
          {!queue.length && <div className="ops-empty">No loaded markets match this filter.</div>}
        </div>
        <p className="ops-keeper-note">Showing {queue.length} of {data.queue.length} loaded markets ({data.summary.markets} total), with problems and active sales first. Dollar balances and hourly rates use the last indexed token price. Clear times assume the last hour’s fee inflow and selling rate continue.{Boolean(data.summary.throughput?.unknownPrices) && ` Prices unavailable for ${data.summary.throughput!.unknownPrices} markets.`}</p>
      </section>
      <section className="ops-panel" aria-label="Fee keeper conversion history"><header><h2>Conversion history</h2><p>Latest activity in the selected period. Open a conversion to inspect each transaction, its size and confirmed network fee.</p></header>
        {data.summary.sales.estimatedTimeCount > 0 && <p className="ops-keeper-note">{data.summary.sales.estimatedTimeCount} older sale(s) use their last stored update time because a swap confirmation timestamp is unavailable.</p>}
        <div className="ops-keeper-history">{data.history.map(conversion => <ConversionCard key={conversion.id} conversion={conversion}/>)}</div>
        {!data.history.length && <div className="ops-empty">No conversions in this period.</div>}
        <footer className="ops-pager"><span>{data.history.length ? `${data.offset + 1}–${data.offset + data.history.length} of ${data.total}` : "0 conversions"}</span><div>
          <button aria-label="Previous conversions" disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}><ChevronLeft size={16}/></button>
          <button aria-label="Next conversions" disabled={busy || !data.hasMore} onClick={() => setOffset(value => value + 25)}><ChevronRight size={16}/></button>
        </div></footer>
      </section>
    </>}
  </div>;
}

function QueueRow({ market: m, now, slicing }: { market: KeeperMarket; now: number; slicing: boolean }) {
  const quote = m.slicePolicy?.quote;
  const dollars = quote ? Number(quote.estimatedUsdCents) / 100 : m.plannedCurrentUsd;
  return <tr>
    <td><Link to={`/token/${m.launchId}`}><b>${m.symbol}</b></Link><small>{date(m.lastAttemptAt)}</small></td>
    <td><b>{keeperAmount(m.vaultRaw, m.decimals)} {m.symbol}</b><small>{m.vaultUsd == null ? "USD unavailable" : `≈ ${keeperUsd(m.vaultUsd)}`}</small><small>Indexed {date(m.indexedAt)}</small></td>
    <td>{m.conversionId ? <><b>{keeperAmount(m.plannedRaw, m.decimals)} {m.symbol}</b><small>{dollars == null ? "USD unavailable" : `≈ ${keeperUsd(dollars)} ${quote ? "at planning" : "at indexed price"}`}</small><Status value={m.conversionStatus}/><small>{quote ? `${percent(quote.impactBps)} quoted impact` : "Impact quote unavailable"}</small></> : <span>No active sale</span>}</td>
    <td><Status value={m.status}/><b className="ops-keeper-stage">{label(m.stage)}</b><p>{m.conversionError || m.message || "Awaiting a keeper pass."}</p></td>
    <td>{slicing || m.slicePolicy ? <><span>{m.nextSliceAt ? m.nextSliceAt > now ? `Next eligible: ${date(m.nextSliceAt)}` : "Eligible for the next keeper pass" : "No slice scheduled"}</span>
      {m.pacing?.status && <small>{label(m.pacing.status)}</small>}
      {m.pacing?.catchup && <><Status value={m.pacing.catchup.mode ?? "paced"}/><small>{({buying_active:"Recent buying supports sales",buy_budget_used:"Waiting for new buy budget",buying_quiet:"Buying quiet · normal pacing",trade_data_stale:"Awaiting verified trade data"} as Record<string,string>)[m.pacing.catchup.reason ?? ""] ?? label(m.pacing.catchup.reason)}</small>
        {m.pacing.catchup.buyBudgetRaw != null && <small>{keeperAmount(m.pacing.catchup.buyBudgetRaw,m.decimals)} {m.symbol} unused buy budget at last check</small>}</>}
      {m.batchRemainingRaw != null && <small>{keeperAmount(m.batchRemainingRaw, m.decimals)} {m.symbol} remains unscheduled in this batch</small>}
      {m.pacing?.estimatedClearAt && <small>Last clear estimate: {date(m.pacing.estimatedClearAt)}</small>}
      {m.pacing?.observedAt && <small>Quote observed {date(m.pacing.observedAt)}</small>}
    </> : <span>Pacing disabled</span>}</td>
    <td><b>{keeperUsd(m.backlogUsd)}</b><small>Collected {keeperUsd(m.incomingHourUsd)} /h</small><small>Processed {keeperUsd(m.convertedHourUsd)} /h</small>
      <small>{m.estimatedClearAt ? `Estimated clear: ${date(m.estimatedClearAt)}` : m.backlogRaw === "0" ? "Backlog clear" : "No clearing estimate at the current rate"}</small></td>
  </tr>;
}

function ConversionCard({ conversion: c }: { conversion: KeeperConversion }) {
  const { config } = useRuntime();
  const quote = c.slicePolicy?.quote, steps = keeperSteps(c);
  return <details className="ops-keeper-conversion">
    <summary><span className="ops-keeper-coin"><ArrowDownUp size={18}/><span><b>${c.symbol}</b><small>{date(c.updatedAt)}</small></span></span>
      <span><small>Tokens allocated</small><b title={`${c.grossRaw} raw`}>{keeperAmount(c.grossRaw, c.decimals)} {c.symbol}</b></span>
      <span><small>SOL received</small><b>{sol(c.solLamports)}</b></span>
      <span><small>{quote ? "Planned value / impact" : "Conversion policy"}</small><b>{quote ? `${keeperUsd(Number(quote.estimatedUsdCents) / 100)} / ${percent(quote.impactBps)}` : c.slicePolicy ? `Paced · ${percent(c.slicePolicy.maxImpactBps)} cap` : "Standard conversion"}</b></span>
      <span className="ops-keeper-toggle"><Status value={c.status}/><ChevronDown size={16}/></span>
    </summary>
    <div className="ops-keeper-conversion-body">
      <div className="ops-toolbar"><Link to={`/token/${c.launchId}`}>Open ${c.symbol} market <ExternalLink size={12}/></Link><span>{label(c.route)} · started {date(c.createdAt)}</span></div>
      {c.error && <p className="ops-error">{c.error}</p>}
      <p className="ops-keeper-note">Swap input: {c.inputRaw == null ? "not withdrawn yet" : `${keeperAmount((BigInt(c.inputRaw) - BigInt(c.inputLossRaw || "0")).toString(), c.decimals)} ${c.symbol}`} · {quote ? `Plan quoted ${date(quote.observedAt)}. The confirmed result can differ from the quote.` : "Historical quote unavailable."}</p>
      {c.soldAt && <p className="ops-keeper-note">{c.estimatedSaleTime ? "Last recorded sale update" : "Swap confirmed"}: {date(c.soldAt)}</p>}
      <div className="ops-table-scroll" role="region" aria-label={`Transactions for ${c.symbol} conversion`} tabIndex={0}><table><thead><tr><th>Step</th><th>Status</th><th>Size</th><th>Network fee</th><th>Transaction</th></tr></thead><tbody>{steps.map(step => <tr key={step.signature}>
        <td>{({ withdraw: "Withdraw fees", pool: "Pool sale", jupiter: "Convert pair to SOL", payout: "Distribute SOL", swap: "Swap" } as Record<string, string>)[step.step] ?? label(step.step)}<small>{date(step.updatedAt)}</small></td>
        <td><Status value={step.status}/></td><td>{step.bytes == null ? "Unavailable" : `${step.bytes.toLocaleString()} bytes`}</td><td>{sol(step.feeLamports)}</td>
        <td><a className="ops-chain" href={`https://solscan.io/tx/${step.signature}${config.useTestnet ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" title={step.signature}>{step.signature.slice(0, 7)}…{step.signature.slice(-6)}<ExternalLink size={12}/></a></td>
      </tr>)}</tbody></table>{!steps.length && <div className="ops-empty">No transaction has been recorded for this conversion yet.</div>}</div>
      <p className="ops-keeper-note">Prepared transactions may be waiting to send or confirm. Recorded entries are older signature references without full journal details.{c.stepCount > 50 && ` Showing the latest 50 of ${c.stepCount} journal entries.`}</p>
    </div>
  </details>;
}
