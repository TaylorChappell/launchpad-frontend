const percent = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
export function CoinFeeBreakdown({ rewardFeeBps, orcaFeeRate }: { rewardFeeBps: number; orcaFeeRate?: number | null }) {
  const orcaBps = orcaFeeRate == null ? null : orcaFeeRate / 100;
  return <div className="coin-fee-breakdown">
    <dl>
      <div><dt>Rewards fee</dt><dd>{percent(rewardFeeBps)}</dd></div>
      <div><dt>Platform fee</dt><dd>1%</dd></div>
      <div><dt>Orca fee</dt><dd>{orcaBps === null ? "Set by the pool" : percent(orcaBps)}</dd></div>
    </dl>
  </div>;
}
