import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, CircleCheck, Clock3, Coins, Gift, Loader2, ShieldAlert, Sparkles, TimerReset, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useWallet } from "../context";
import type { Launch, WalletReward } from "../types";

function formatRaw(raw: string, decimals: number) {
  const value = raw.replace(/^0+/, "") || "0";
  if (!decimals) return value;
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, 6);
  return fraction ? `${whole}.${fraction}` : whole;
}
const rewardDate = (value: number) => new Date(value < 1_000_000_000_000 ? value * 1000 : value).toLocaleDateString();

export function Rewards() {
  const wallet = useWallet();
  const [rewards, setRewards] = useState<WalletReward[]>([]);
  const [markets, setMarkets] = useState<Launch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [claiming, setClaiming] = useState("");

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

  const totals = useMemo(() => ({
    claimable: rewards.filter((item) => item.status === "claimable" && !item.claimedSignature).length,
    claimed: rewards.filter((item) => Boolean(item.claimedSignature)).length,
    assets: new Set(rewards.map((item) => item.stockMint)).size,
  }), [rewards]);

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

  return <main className="page rewards-page">
    <header className="rewards-heading"><div><h1>Your holding time has value.</h1><p>Track the tokenized stocks earned by your AQUA positions and claim published rewards.</p></div><div className={`data-badge ${state}`}><Clock3/><span><b>{state === "ready" ? "REWARD INDEX" : state === "loading" ? "LOADING" : "UNAVAILABLE"}</b><small>{state === "ready" ? "Connected to reward proofs" : state === "offline" ? "Backend connection failed" : "Fetching reward records"}</small></span></div></header>

    <section className="reward-overview">
      <Stat label="Claimable" value={totals.claimable.toString()} detail="Published allocations"/>
      <Stat label="Claimed" value={totals.claimed.toString()} detail="Completed claims"/>
      <Stat label="Stock assets" value={totals.assets.toString()} detail="In this wallet"/>
      <Stat label="Reward markets" value={markets.length.toString()} detail="Live and launching"/>
    </section>

    {!wallet.address ? <section className="wallet-card"><div className="wallet-card-icon"><WalletCards/></div><div><h2>Connect to see your rewards</h2><p>AQUA will look up your published allocation proofs. Connecting does not claim anything.</p></div><button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button></section> : <section className="wallet-card connected"><div className="wallet-card-icon"><CircleCheck/></div><div><h2>{totals.claimable ? `${totals.claimable} reward${totals.claimable === 1 ? "" : "s"} ready` : "Wallet connected"}</h2><p>{wallet.address.slice(0, 7)}…{wallet.address.slice(-7)} · {rewards.length ? "Your reward history is shown below." : "No published allocations yet."}</p></div></section>}

    <section className="aqua-score-card">
      <div><span className="score-icon"><Sparkles/></span><h2>AQUA Score</h2><p>Your eligible balance builds weight for every second it is held.</p></div>
      <div className="score-equation"><span><b>Eligible balance</b><small>How much you hold</small></span><strong>×</strong><span><b>Holding time</b><small>How long you hold</small></span><strong>=</strong><span className="score-result"><b>Reward weight</b><small>Your share of the epoch</small></span></div>
    </section>

    <div className="reward-layout">
      <section className="reward-ledger">
        <header><div><h2>Your reward ledger</h2><p>Published stock allocations and proof status.</p></div><span>{rewards.length} records</span></header>
        {state === "loading" ? <div className="ledger-loading"><i/><i/><i/></div> : rewards.length ? <div className="ledger-table">
          <div className="ledger-row ledger-head"><span>Asset</span><span>Status</span><span>Amount</span><span>Period</span><span>Action</span></div>
          {rewards.map((reward) => {
            const claimed = Boolean(reward.claimedSignature);
            const canClaim = reward.status === "claimable" && !claimed;
            return <div className="ledger-row" key={reward.epochId}>
              <span><b>{reward.stockSymbol}</b><small>{reward.launchId}</small></span>
              <span><em className={claimed ? "completed" : reward.status.toLowerCase()}>{claimed ? "Claimed" : reward.status}</em></span>
              <span><b>{formatRaw(reward.amountRaw, reward.stockDecimals)} {reward.stockSymbol}</b><small>Token-2022 stock</small></span>
              <span><b>{rewardDate(reward.endsAt)}</b><small>{rewardDate(reward.startsAt)}</small></span>
              <span>{claimed ? <Check size={15}/> : <button className="ledger-claim" disabled={!canClaim || claiming === reward.epochId} onClick={() => void claim(reward)}>{claiming === reward.epochId ? <Loader2 className="spin"/> : "Claim"}</button>}</span>
            </div>;
          })}
        </div> : <div className="ledger-empty"><Coins/><h3>No published rewards yet</h3><p>Your allocations will appear here after a market completes its next reward epoch.</p></div>}
      </section>

      <aside className="reward-explainer"><Gift/><h2>Trade to portfolio</h2><ol><li><i><Coins/></i><span><b>Trade</b>Activity funds stock rewards.</span></li><li><i><Gift/></i><span><b>Purchase</b>The reserve buys the paired stock.</span></li><li><i><TimerReset/></i><span><b>Measure</b>Balance and time set each share.</span></li><li><i><CircleCheck/></i><span><b>Claim</b>Published proofs unlock rewards.</span></li></ol><div className="legal"><ShieldAlert/>Tokenized stocks can be restricted by jurisdiction or provider rules.</div><Link to="/how-it-works">How rewards work <ArrowUpRight size={14}/></Link></aside>
    </div>
  </main>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div><small>{label}</small><b>{value}</b><span>{detail}</span></div>;
}
