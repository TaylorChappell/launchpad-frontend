import { useEffect, useMemo, useState } from "react";
import { Coins, Gift, Loader2, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { PageBubbles } from "../components/PageBubbles";
import { AssetMark, TokenMark } from "../components/TokenCard";
import { useRuntime, useWallet } from "../context";
import type { Launch, WalletRewardMarket, WalletRewardsResponse } from "../types";

const EMPTY_REWARDS: WalletRewardsResponse = { rewards: [], holdings: [], markets: [] };

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents > 0 && cents < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function Rewards() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [portfolio, setPortfolio] = useState<WalletRewardsResponse>(EMPTY_REWARDS);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [claiming, setClaiming] = useState("");

  async function refresh(address: string) {
    const [rewardData, launchData] = await Promise.all([api.rewards(address), api.launches()]);
    setPortfolio(rewardData);
    setLaunches(launchData.launches);
  }

  useEffect(() => {
    let active = true;
    setState("loading");
    const personal = wallet.address ? api.rewards(wallet.address) : Promise.resolve(EMPTY_REWARDS);
    Promise.all([personal, api.launches()]).then(([rewardData, launchData]) => {
      if (!active) return;
      setPortfolio(rewardData);
      setLaunches(launchData.launches);
      setState("ready");
    }).catch(() => { if (active) setState("offline"); });
    return () => { active = false; };
  }, [wallet.address]);

  const launchById = useMemo(() => new Map(launches.map((launch) => [launch.id, launch])), [launches]);
  const markets = useMemo(() => [...portfolio.markets].sort((a, b) => Number(b.canClaim) - Number(a.canClaim) || b.accumulatingUsdCents - a.accumulatingUsdCents), [portfolio.markets]);
  const readyCount = markets.filter((market) => market.canClaim).length;
  const totalClaimable = markets.reduce((sum, market) => sum + market.claimableUsdCents, 0);
  const epochMinutes = Math.max(1, Math.round((config.rewardDistribution?.epochSeconds ?? 1_200) / 60));

  async function claim(market: WalletRewardMarket, launch?: Launch) {
    if (!wallet.address) return wallet.setModalOpen(true);
    if (!market.canClaim || !market.claimableEpochIds.length) return;
    setClaiming(market.launchId);
    try {
      const envelopes = await Promise.all(market.claimableEpochIds.map((epochId) => api.rewardClaim(epochId, wallet.address!)));
      for (let index = 0; index < envelopes.length; index += 1) {
        const signature = await wallet.sendTransaction(envelopes[index]);
        await api.confirmRewardClaim(market.claimableEpochIds[index], wallet.address, signature);
      }
      toast.success(`${launch?.stockSymbol ?? "Holder"} rewards claimed in ${envelopes.length} transaction${envelopes.length === 1 ? "" : "s"}`);
      await refresh(wallet.address);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed.");
    } finally {
      setClaiming("");
    }
  }

  return <main className="page rewards-page rewards-vault-page">
    <PageBubbles count={14}/>
    <header className="rewards-vault-heading">
      <div><span><Gift/>Holder rewards</span><h1>Your stock rewards.</h1></div>
      {wallet.address && <div className="rewards-wallet"><i/>{wallet.address.slice(0, 5)}…{wallet.address.slice(-5)}</div>}
    </header>

    {config.rewardDistribution && <div className={`reward-automation-status ${config.rewardDistribution.enabled ? "online" : "paused"}`}>
      <span>{config.rewardDistribution.enabled ? `${epochMinutes}-minute reward allocations are online` : "Automatic reward allocations are paused"}</span>
      <small>{config.rewardDistribution.enabled ? `Every collected amount can enter the next allocation. Claims unlock only when your combined reward is worth more than ${dollars(config.rewardDistribution.minimumClaimUsdCents)} after estimated Solana costs.` : "Existing funded rewards remain visible; new allocations wait until the keeper is enabled."}</small>
    </div>}

    {!wallet.address ? <section className="rewards-connect-card">
      <span><WalletCards/></span>
      <div><h2>Connect your wallet</h2><p>See every AQUA coin you hold and the stock rewards accumulating for it.</p></div>
      <button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>
    </section> : <>
      <section className="rewards-summary-line">
        <div><small>Ready across {readyCount} market{readyCount === 1 ? "" : "s"}</small><strong>{dollars(totalClaimable)}</strong></div>
        <span>{markets.length} AQUA coin{markets.length === 1 ? "" : "s"} held</span>
      </section>

      {state === "loading" ? <div className="reward-card-skeletons"><i/><i/><i/></div> : state === "offline" ? <section className="rewards-empty"><RefreshCw/><h2>Rewards are temporarily unavailable</h2><p>Reconnect in a moment to refresh your balances.</p></section> : markets.length ? <section className="holder-reward-list">
        {markets.map((market) => {
          const launch = launchById.get(market.launchId);
          const displayCents = market.canClaim ? market.claimableUsdCents : market.accumulatingUsdCents;
          return <article className={`holder-reward-card ${market.canClaim ? "claimable" : "accruing"}`} key={market.launchId}>
            <div className="reward-market-identity">
              {launch ? <TokenMark launch={launch}/> : <span className="reward-market-fallback"><Coins/></span>}
              <div><b>{launch?.name ?? market.launchId}</b><small>{launch ? `$${launch.symbol}` : "AQUA market"} · holder reward</small></div>
              {launch && <AssetMark launch={launch} reward/>}
            </div>
            <div className="reward-amount">
              <small>{market.canClaim ? "Redeemable now" : "Currently accumulating"}</small>
              <strong>{dollars(displayCents)}</strong>
            </div>
            <div className="reward-timing">
              {market.canClaim ? <><span className="reward-ready-dot"/><span><small>Estimated after costs</small><b>{dollars(market.netClaimableUsdCents)}</b></span></> : <span><small>Claim unlock</small><b>&gt; {dollars(market.minimumClaimUsdCents)} net</b></span>}
            </div>
            <div className="reward-action">
              {market.canClaim ? <button onClick={() => void claim(market, launch)} disabled={claiming === market.launchId}>{claiming === market.launchId ? <Loader2 className="spin"/> : <>Claim {dollars(market.claimableUsdCents)}</>}</button> : <span>Allocates every {epochMinutes} min</span>}
              {market.canClaim && <small>{market.claimableEpochIds.length} wallet approval{market.claimableEpochIds.length === 1 ? "" : "s"} · est. {dollars(market.estimatedClaimFeeUsdCents)} costs</small>}
            </div>
            {!market.canClaim && <div className="reward-water-progress"><i style={{ width: `${Math.max(6, Math.min(94, market.minimumClaimUsdCents ? market.accumulatingUsdCents / market.minimumClaimUsdCents * 100 : 6))}%` }}/><span/><span/></div>}
          </article>;
        })}
      </section> : <section className="rewards-empty"><Gift/><h2>No eligible AQUA holdings detected</h2><p>A coin appears here once this wallet holds an indexed AQUA token.</p></section>}
    </>}
  </main>;
}
