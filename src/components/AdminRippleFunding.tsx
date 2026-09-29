import { Link } from "react-router-dom";
import type { AdminRippleOverview } from "../types";
import { rippleSol, rippleTime } from "../ripple-admin";

export function AdminRippleFunding({data}:{data:AdminRippleOverview}){
  return <details className="ops-panel ops-ripple-funding"><summary>Funding & settlement <span>{data.totalMarkets} coins · {rippleSol(data.availableLamports)} unallocated</span></summary>
    <p>Recorded engagement can wait up to {data.catchupHours} hours for funding. Historical $0 audit flags require review and do not trigger repayments.</p>
    <div className="ops-table-scroll" role="region" aria-label="Ripple funding by coin" tabIndex={0}><table><thead><tr><th>Coin</th><th>Available</th><th>Queue</th><th>Detection</th><th>Payout worker</th></tr></thead><tbody>{data.markets.map(m=><tr key={m.launchId}>
      <td><Link to={`/token/${m.launchId}`}>${m.symbol}</Link></td><td>{rippleSol(m.availableLamports)}<small>Funding received {rippleTime(m.lastFundedAt)}</small></td>
      <td>{m.pendingChecks} checks · {m.unpublishedEpochs} unpublished epochs<small>Oldest {rippleTime(m.oldestPendingAt)}</small>{m.auditChecks>0&&<small>{m.auditChecks} historical $0 checks</small>}</td>
      <td>{m.scanError??(m.scanPending?'Catching up':'Last checked '+rippleTime(m.checkedAt))}<small>Covered through {rippleTime(m.coveredUntil)}</small></td>
      <td>{m.payoutMessage??(m.payoutStatus==='settled'?'Last pass succeeded':m.payoutStatus??'No attempt recorded')}<small>Attempt {rippleTime(m.payoutAttemptedAt)}</small><small>Successful pass {rippleTime(m.payoutSuccessAt)}</small></td>
    </tr>)}</tbody></table>{!data.markets.length&&<p className="ops-empty">No matching Ripple funding records.</p>}</div>
    {data.totalMarkets>data.markets.length&&<p>Showing the {data.markets.length} coins with the largest check queues. Search for a specific coin.</p>}
    <h3>Recent settlement rounds</h3>
    <div className="ops-table-scroll" role="region" aria-label="Ripple settlement rounds" tabIndex={0}><table><thead><tr><th>Round</th><th>Available / release limit</th><th>Score / budget</th><th>Allocated / carryover</th><th>Checks / payout</th></tr></thead><tbody>{data.rounds.map(r=><tr key={`${r.launchId}:${r.endsAt}`}>
      <td>${r.symbol}<small>{rippleTime(r.endsAt)}</small></td>
      {r.diagnostics?<><td>{rippleSol(r.diagnostics.availableLamports)}<small>Limit {rippleSol(r.diagnostics.releaseLimitLamports)}</small></td><td>{r.diagnostics.weightedScore} points<small>Budget {rippleSol(r.diagnostics.budgetLamports)}</small></td><td>{rippleSol(r.diagnostics.allocatedLamports)}<small>Carried {rippleSol(r.diagnostics.carryoverLamports)}</small></td><td>{r.diagnostics.rewardedPosts} paid posts · {r.diagnostics.deferredChecks} deferred<small>{r.diagnostics.expiredChecks} expired · {r.epochStatus??'No allocation'}</small></td></>:<td colSpan={4}>Detailed diagnostics were not recorded for this historical round.</td>}
    </tr>)}</tbody></table>{!data.rounds.length&&<p className="ops-empty">No settlement rounds recorded.</p>}</div>
  </details>;
}
