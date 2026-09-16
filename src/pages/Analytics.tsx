import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PageBubbles } from "../components/PageBubbles";
import type { AnalyticsResponse } from "../types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const preciseUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const sol = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

const tokens = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function timeAgo(value: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.analytics();
      setData(next);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await refresh();
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return <main className="page analytics-page">
    <PageBubbles count={12}/>
    <header className="analytics-heading">
      <div>
        <span>PROTOCOL ANALYTICS</span>
        <h1>AQUA in numbers.</h1>
        <p>A simple view of completed AQUA buybacks, holder rewards and live markets.</p>
      </div>
      <div className={`analytics-live ${offline ? "offline" : ""}`}><i/>{offline ? "Update delayed" : data ? `Updated ${timeAgo(data.generatedAt)}` : "Loading live data"}</div>
    </header>

    {!data ? <div className="analytics-skeletons"><i/><i/><i/><i/></div> : <>
      <section className="analytics-metrics">
        <article><small>AQUA BUYBACKS</small><strong>{sol.format(data.totals.buybackSol)} SOL</strong><span>Spent buying AQUA on-chain</span></article>
        <article><small>REWARDS ACCUMULATED</small><strong>{preciseUsd.format(data.totals.rewardsAccumulatedUsd)}</strong><span>Lifetime holder reward value</span></article>
        <article><small>REWARDS REDEEMABLE</small><strong>{preciseUsd.format(data.totals.rewardsRedeemableUsd)}</strong><span>Currently available to holders</span></article>
        <article><small>LIVE MARKETS</small><strong>{data.totals.liveMarkets.toLocaleString()}</strong><span>{compactUsd.format(data.totals.totalMarketCapUsd)} combined market cap</span></article>
      </section>

      <section className="analytics-panel">
        <header><div><h2>Market breakdown</h2><p>Buyback funding and holder rewards across every live AQUA market.</p></div><b>{compactUsd.format(data.totals.volume24hUsd)} <small>24H VOLUME</small></b></header>
        <div className="analytics-table-wrap">
          <table>
            <thead><tr><th>Market</th><th>Market cap</th><th>Buybacks</th><th>Rewards accumulated</th><th>Redeemable</th></tr></thead>
            <tbody>{data.markets.length ? data.markets.map((market) => <tr key={market.id}>
              <td><b>{market.name}</b><span>${market.symbol}</span></td>
              <td>{usd.format(market.marketCapUsd)}</td>
              <td>{sol.format(market.buybackSol)} SOL</td>
              <td>{preciseUsd.format(market.rewardsAccumulatedUsd)}</td>
              <td>{preciseUsd.format(market.rewardsRedeemableUsd)}</td>
            </tr>) : <tr><td colSpan={5} className="analytics-empty">No live market data yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className="analytics-panel analytics-buybacks">
        <header><div><h2>Latest buybacks</h2><p>Verified AQUA purchases made by the protocol buyback wallet.</p></div></header>
        {data.recentBuybacks.length ? <div className="buyback-list">{data.recentBuybacks.map((buyback) => <article key={`${buyback.launchId}-${buyback.signature ?? buyback.createdAt}`}>
          <div><b>${buyback.symbol}</b><span>{tokens.format(buyback.amountTokens)} AQUA bought</span></div>
          <strong>{sol.format(buyback.amountSol)} SOL</strong>
          <time>{timeAgo(buyback.createdAt)}</time>
        </article>)}</div> : <div className="analytics-empty">Verified on-chain buybacks will appear here.</div>}
      </section>
    </>}
  </main>;
}
