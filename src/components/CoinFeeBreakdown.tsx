const percent = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
export function CoinFeeBreakdown({ rewardFeeBps, orcaFeeRate }: { rewardFeeBps: number; orcaFeeRate?: number | null }) {
  const aquaBps = 100 + rewardFeeBps;
  const orcaBps = orcaFeeRate == null ? null : orcaFeeRate / 100;
  return <div className="coin-fee-breakdown">
    <dl>
      <div><dt>Reward fee</dt><dd>{percent(rewardFeeBps)}</dd></div>
      <div><dt>AQUA platform fee</dt><dd>1%</dd></div>
      <div className="coin-fee-subtotal"><dt>Token fee</dt><dd>{percent(aquaBps)}</dd></div>
      <div><dt>Orca pool fee</dt><dd>{orcaBps === null ? "Set by the pool" : percent(orcaBps)}</dd></div>
      {orcaBps !== null && <div className="coin-fee-total"><dt>Combined fee rates</dt><dd>{percent(aquaBps + orcaBps)}</dd></div>}
    </dl>
    <p>Token and pool fees are charged separately. Your trade quote shows the final amount, including any pair-token or routing fees.</p>
  </div>;
}
