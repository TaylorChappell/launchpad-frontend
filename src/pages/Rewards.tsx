import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Coins, Gift, Loader2, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { PageBubbles } from "../components/PageBubbles";
import { TokenMark } from "../components/TokenCard";
import { useRuntime, useWallet } from "../context";
import type { Launch, WalletReward } from "../types";

function formatRaw(raw: string, decimals: number) {
  const value = raw.replace(/^0+/, "") || "0";
  if (!decimals) return value;
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, 6);
  return fraction ? `${whole}.${fraction}` : whole;
}

function timestampMs(value: number) {
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function countdown(until: number, now: number) {
  const remaining = Math.max(0, timestampMs(until) - now);
  if (!remaining) return "Finalizing";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function Rewards() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [rewards, setRewards] = useState<WalletReward[]>([]);
  const [markets, setMarkets] = useState<Launch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [claiming, setClaiming] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setState("loading");
    const personal = wallet.address ? api.rewards(wallet.address) : Promise.resolve({ rewards: [] as WalletReward[] });
    Promise.all([personal, api.launches()]).then(([rewardData, launchData]) => {
      if (!active) return;
      setRewards(rewardData.rewards);
      setMarkets(launchData.launches);
      setState("ready");
    }).catch(() => { if (active) setState("offline"); });
    return () => { active = false; };
  }, [wallet.address]);

  const marketById = useMemo(() => new Map(markets.map((market) => [market.id, market])), [markets]);
  const sortedRewards = useMemo(() => [...rewards].sort((a, b) => {
    const rank = (item: WalletReward) => item.claimedSignature ? 2 : item.status === "claimable" ? 0 : 1;
    return rank(a) - rank(b) || b.endsAt - a.endsAt;
  }), [rewards]);
  const readyCount = rewards.filter((reward) => reward.status === "claimable" && !reward.claimedSignature).length;

  async function claim(reward: WalletReward) {
    if (!wallet.address) return wallet.setModalOpen(true);
    setClaiming(reward.epochId);
    try {
      const transaction = await api.rewardClaim(reward.epochId, wallet.address);
      await wallet.sendTransaction(transaction);
      toast.success(`${reward.stockSymbol} reward claimed`);
      const next = await api.rewards(wallet.address);
      setRewards(next.rewards);
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
      <span>{config.rewardDistribution.enabled ? "Automatic reward epochs are online" : "Automatic reward epochs are paused"}</span>
      <small>{config.rewardDistribution.enabled ? `Allocations settle about every ${Math.round(config.rewardDistribution.epochSeconds / 3_600)} hours once the minimum value is reached.` : "Existing funded epochs remain claimable; new allocations wait until the keeper rollout is enabled."}</small>
    </div>}

    {!wallet.address ? <section className="rewards-connect-card">
      <span><WalletCards/></span>
      <div><h2>Connect your wallet</h2><p>See the stock rewards attached to the AQUA coins you hold.</p></div>
      <button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>
    </section> : <>
      <section className="rewards-summary-line">
        <div><small>Ready to claim</small><strong>{readyCount}</strong></div>
        <span>{sortedRewards.length} reward period{sortedRewards.length === 1 ? "" : "s"}</span>
      </section>

      {state === "loading" ? <div className="reward-card-skeletons"><i/><i/><i/></div> : state === "offline" ? <section className="rewards-empty"><RefreshCw/><h2>Rewards are temporarily unavailable</h2><p>Reconnect in a moment to refresh your balances.</p></section> : sortedRewards.length ? <section className="holder-reward-list">
        {sortedRewards.map((reward) => {
          const market = marketById.get(reward.launchId);
          const claimed = Boolean(reward.claimedSignature);
          const canClaim = reward.status === "claimable" && !claimed;
          const pending = !claimed && !canClaim;
          return <article className={`holder-reward-card ${canClaim ? "claimable" : pending ? "accruing" : "claimed"}`} key={reward.epochId}>
            <div className="reward-market-identity">
              {market ? <TokenMark launch={market}/> : <span className="reward-market-fallback"><Coins/></span>}
              <div><b>{market?.name ?? reward.launchId}</b><small>{market ? `$${market.symbol}` : "AQUA market"} · earns {reward.stockSymbol}</small></div>
            </div>
            <div className="reward-amount">
              <small>{pending ? "Accumulated so far" : claimed ? "Claimed reward" : "Available now"}</small>
              <strong>{pending ? "≈ " : ""}{formatRaw(reward.amountRaw, reward.stockDecimals)} <span>{reward.stockSymbol}</span></strong>
            </div>
            <div className="reward-timing">
              {canClaim ? <><span className="reward-ready-dot"/><small>Ready to claim</small></> : claimed ? <><Check/><small>Claimed</small></> : <><Clock3/><span><small>Next claim in</small><b>{countdown(reward.endsAt, now)}</b></span></>}
            </div>
            <div className="reward-action">
              {canClaim ? <button onClick={() => void claim(reward)} disabled={claiming === reward.epochId}>{claiming === reward.epochId ? <Loader2 className="spin"/> : <>Claim {reward.stockSymbol}</>}</button> : <span>{claimed ? "Complete" : "Accruing"}</span>}
            </div>
            {pending && <div className="reward-water-progress"><i style={{ width: `${Math.max(8, Math.min(92, ((now - timestampMs(reward.startsAt)) / Math.max(1, timestampMs(reward.endsAt) - timestampMs(reward.startsAt))) * 100))}%` }}/><span/><span/></div>}
          </article>;
        })}
      </section> : <section className="rewards-empty"><Gift/><h2>No rewards detected yet</h2><p>Rewards from eligible AQUA holdings will appear here as they begin accumulating.</p></section>}
    </>}
  </main>;
}
