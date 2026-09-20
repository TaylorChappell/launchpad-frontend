import {AreaChart,Area,XAxis,YAxis,Tooltip,ResponsiveContainer} from "recharts";
import {displayTokenAmount} from "../trade-quote";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRuntime } from "../context";
import { api } from "../api";
import { PageBubbles } from "../components/PageBubbles";
import type { AnalyticsResponse } from "../types";

const MARKET_PAGE_SIZE = 8;
const BUYBACK_PAGE_SIZE = 6;

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
  const {config}=useRuntime();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [visibleMarkets, setVisibleMarkets] = useState(MARKET_PAGE_SIZE);
  const [visibleBuybacks, setVisibleBuybacks] = useState(BUYBACK_PAGE_SIZE);

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
        <h1>AQUA in numbers.</h1>
        <p>A simple view of completed AQUA buybacks, holder rewards and live markets.</p>
      </div>
      <div className={`analytics-live ${offline ? "offline" : ""}`}><i/>{offline ? "Update delayed" : data ? `Fetched ${timeAgo(data.generatedAt)} · index may lag` : "Loading live data"}</div>
    </header>

    <details className="dashboard-section"><summary>What these metrics mean</summary><p>Accumulated is indexed reward allocation value, not cash paid to users. Redeemable is currently funded claim allocation, before each wallet’s eligibility and costs. Buyback spend is verified SOL paid on-chain; buyback funding is money assigned to the process. Market values depend on the last indexed price, not this page’s fetch time.</p></details>
    {!data ? <div className="analytics-skeletons"><i/><i/><i/><i/></div> : <>
      <section className="analytics-metrics">
        <article><small>AQUA BUYBACKS</small><strong>{sol.format(data.totals.buybackSol)} SOL</strong><span>Spent buying AQUA on-chain</span></article>
        <article><small>REWARDS ACCUMULATED</small><strong>{preciseUsd.format(data.totals.rewardsAccumulatedUsd)}</strong><span>Allocated value, not proof of payment</span></article>
        <article><small>REWARDS REDEEMABLE</small><strong>{preciseUsd.format(data.totals.rewardsRedeemableUsd)}</strong><span>Funded, unclaimed allocations before claim minimums and fees</span></article>
        <article><small>LIVE MARKETS</small><strong>{data.totals.liveMarkets.toLocaleString()}</strong><span>{compactUsd.format(data.totals.totalMarketCapUsd)} combined market cap</span></article>
      </section>

      <section className="analytics-panel">
        <header><div><h2>Claimed rewards</h2><p>Indexed, confirmed claim entitlements by reward asset. These are separate from pending allocations.</p></div></header>
        <div className="table-scroll"><table className="market-table"><thead><tr><th>Asset</th><th>Claimed amount</th><th>Receipts</th><th>Latest claim</th></tr></thead><tbody>{data.claimedAssets.map(asset=><tr key={asset.mint}><td>{asset.symbol}</td><td>{displayTokenAmount(asset.amountRaw,asset.decimals)}</td><td>{asset.receipts}</td><td>{new Date(asset.lastClaimedAt).toLocaleString()}</td></tr>)}</tbody></table></div>
        <p>{preciseUsd.format(data.totals.rewardsClaimedAllocationUsd)} at the original allocation valuation, not the USD value at payment or today's price.</p>
      </section>
      <section className="analytics-panel"><header><div><h2>Last 30 days</h2><p>Recorded activity only. Gaps mean no indexed observations; they are not interpolated daily earnings.</p></div></header>
        <h3>Rewards allocated · USD at allocation</h3><div style={{height:220}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.rewardHistory}><XAxis dataKey="time" tickFormatter={n=>new Date(n).toLocaleDateString()}/><YAxis/><Tooltip labelFormatter={n=>new Date(Number(n)).toLocaleDateString()}/><Area dataKey="allocatedUsd" stroke="#087abb" fill="#cae8f8" type="stepAfter"/></AreaChart></ResponsiveContainer></div>
        <h3>AQUA buybacks · SOL spent</h3><div style={{height:220}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.buybackHistory}><XAxis dataKey="time" tickFormatter={n=>new Date(n).toLocaleDateString()}/><YAxis/><Tooltip labelFormatter={n=>new Date(Number(n)).toLocaleDateString()}/><Area dataKey="sol" stroke="#087abb" fill="#cae8f8" type="stepAfter"/></AreaChart></ResponsiveContainer></div>
        <p className="status-inline">{data.stalePriceMarkets} market prices are delayed. Oldest market index observation: {data.oldestIndexedAt?new Date(data.oldestIndexedAt).toLocaleString():"unavailable"}.</p>
      </section>
      <section className="analytics-panel">
        <header><div><h2>Market breakdown</h2><p>Top {data.marketBreakdownLimit} markets by market cap. Totals above include every market.</p></div><b>{compactUsd.format(data.totals.volume24hUsd)} <small>24H VOLUME</small></b></header>
        <div className="analytics-table-wrap">
          <table>
            <thead><tr><th>Market</th><th>Market cap</th><th>Buybacks</th><th>Rewards accumulated</th><th>Redeemable</th></tr></thead>
            <tbody>{data.markets.length ? data.markets.slice(0, visibleMarkets).map((market) => <tr key={market.id}>
              <td><Link to={"/token/"+market.id}><b>{market.name}</b></Link><span>${market.symbol}</span></td>
              <td>{usd.format(market.marketCapUsd)}</td>
              <td>{sol.format(market.buybackSol)} SOL</td>
              <td>{preciseUsd.format(market.rewardsAccumulatedUsd)}</td>
              <td>{preciseUsd.format(market.rewardsRedeemableUsd)}</td>
            </tr>) : <tr><td colSpan={5} className="analytics-empty">No live market data yet.</td></tr>}</tbody>
          </table>
        </div>
        {visibleMarkets < data.markets.length && <button className="activity-load-more analytics-load-more" onClick={() => setVisibleMarkets((current) => current + MARKET_PAGE_SIZE)}>Load more markets</button>}
      </section>

      <section className="analytics-panel analytics-buybacks">
        <header><div><h2>Latest buybacks</h2><p>Verified AQUA purchases made by the protocol buyback wallet.</p></div></header>
        {data.recentBuybacks.length ? <div className="buyback-list">{data.recentBuybacks.slice(0, visibleBuybacks).map((buyback) => <article key={`${buyback.launchId}-${buyback.signature ?? buyback.createdAt}`}>
          <div><b>${buyback.symbol}</b><span>{tokens.format(buyback.amountTokens)} AQUA bought</span></div>
          <strong>{sol.format(buyback.amountSol)} SOL</strong>
          <time>{timeAgo(buyback.createdAt)}</time>{buyback.signature&&<a href={"https://solscan.io/tx/"+buyback.signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">Transaction ↗</a>}
        </article>)}</div> : <div className="analytics-empty">Verified on-chain buybacks will appear here.</div>}
        {visibleBuybacks < data.recentBuybacks.length && <button className="activity-load-more analytics-load-more" onClick={() => setVisibleBuybacks((current) => current + BUYBACK_PAGE_SIZE)}>Load more buybacks</button>}
      </section>
    </>}
  </main>;
}
