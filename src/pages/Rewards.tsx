import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Coins, ExternalLink, Gift, Loader2, RefreshCw, Share2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { PageBubbles } from "../components/PageBubbles";
import { AssetMark, TokenMark } from "../components/TokenCard";
import { useRuntime, useWallet } from "../context";
import type { Launch, WalletRewardMarket, WalletRewardsResponse } from "../types";
import { openXComposer, rewardClaimShareText } from "../share";
import { GovernanceVote } from "../components/GovernanceVote";

const EMPTY_REWARDS: WalletRewardsResponse = { rewards: [], holdings: [], markets: [] };

type ClaimExperience = {
  phase: "preparing" | "approval" | "confirming" | "success";
  launchId: string;
  name: string;
  amountUsd: string;
  signature?: string;
  amountRaw?: string;
  stockSymbol?: string;
  stockDecimals?: number;
};

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents > 0 && cents < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function tokenAmount(raw?: string, decimals = 0, symbol = "reward") {
  if (!raw) return symbol;
  const value = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6);
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""} ${symbol}`;
}

function solscanTransactionUrl(signature: string, network: "devnet" | "mainnet-beta") {
  return `https://solscan.io/tx/${signature}${network === "devnet" ? "?cluster=devnet" : ""}`;
}

export function Rewards() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [portfolio, setPortfolio] = useState<WalletRewardsResponse>(EMPTY_REWARDS);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [updatedAt,setUpdatedAt] = useState<number|null>(null);
  const [refreshKey,setRefreshKey] = useState(0);
  const [claiming, setClaiming] = useState("");
  const [claimExperience, setClaimExperience] = useState<ClaimExperience | null>(null);

  async function refresh(address: string) {
    const rewardData=await api.rewards(address);
    const ids=[...new Set([...rewardData.holdings.map(x=>x.launchId),...rewardData.markets.map(x=>x.launchId)])];
    const launchData=await api.launches({ids:ids.join(","),limit:100});
    setPortfolio(rewardData);
    setLaunches(launchData.launches);
  }

  useEffect(() => {
    let active = true;
    setState("loading");
    let pending=false;
    const load=async()=>{
      if(pending)return;pending=true;
      try {
        const rewardData=wallet.address ? await api.rewards(wallet.address) : EMPTY_REWARDS;
        const ids=[...new Set([...rewardData.holdings.map(x=>x.launchId),...rewardData.markets.map(x=>x.launchId)])];
        const launchData=await api.launches(ids.length?{ids:ids.join(","),limit:100}:{limit:24});
        if(active){setPortfolio(rewardData);setLaunches(launchData.launches);setState("ready");setUpdatedAt(Date.now());}
      }catch{if(active)setState("offline");}finally{pending=false;}
    };
    void load();
    const focus=()=>{if(document.visibilityState==="visible")void load();};
    const timer=window.setInterval(focus,20_000);window.addEventListener("focus",focus);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};
  },[wallet.address,refreshKey]);

  const launchById = useMemo(() => new Map(launches.map((launch) => [launch.id, launch])), [launches]);
  const markets = useMemo(() => [...portfolio.markets].sort((a, b) => Number(b.canClaim) - Number(a.canClaim) || b.accumulatingUsdCents - a.accumulatingUsdCents), [portfolio.markets]);
  const epochMinutes = Math.max(1, Math.round((config.rewardDistribution?.epochSeconds ?? 1_200) / 60));

  async function claim(market: WalletRewardMarket, launch?: Launch) {
    if (!wallet.address) return wallet.setModalOpen(true);
    if (!market.canClaim) return;
    const cumulative = market.claimMode === "cumulative";
    if (!cumulative && market.claimableEpochIds.length !== 1) {
      toast.info("These rewards are being consolidated into one claim. They will be available after the rewards migration completes.");
      return;
    }
    const amountUsd = dollars(market.claimableUsdCents);
    const baseExperience: ClaimExperience = {
      phase: "preparing",
      launchId: market.launchId,
      name: launch?.name ?? "AQUA rewards",
      amountUsd,
      stockSymbol: launch?.stockSymbol,
    };
    setClaiming(market.launchId);
    setClaimExperience(baseExperience);
    try {
      if (cumulative) {
        const envelope = await api.cumulativeRewardClaim(market.launchId, wallet.address);
        setClaimExperience({ ...baseExperience, phase: "approval", amountRaw: envelope.amountRaw, stockSymbol: envelope.stockSymbol, stockDecimals: envelope.stockDecimals });
        const signature = await wallet.sendTransaction(envelope);
        setClaimExperience((current) => current ? { ...current, phase: "confirming", signature } : current);
        const confirmed = await api.confirmCumulativeRewardClaim(market.launchId, wallet.address, signature, envelope.sequence);
        setClaimExperience({ ...baseExperience, phase: "success", signature, amountRaw: confirmed.amountRaw, stockSymbol: confirmed.stockSymbol, stockDecimals: confirmed.stockDecimals });
      } else {
        const epochId = market.claimableEpochIds[0];
        const envelope = await api.rewardClaim(epochId, wallet.address);
        setClaimExperience({ ...baseExperience, phase: "approval" });
        const signature = await wallet.sendTransaction(envelope);
        setClaimExperience({ ...baseExperience, phase: "confirming", signature });
        await api.confirmRewardClaim(epochId, wallet.address, signature);
        setClaimExperience({ ...baseExperience, phase: "success", signature });
      }
      await refresh(wallet.address);
    } catch (error) {
      setClaimExperience(null);
      toast.error(error instanceof Error ? error.message : "Claim failed.");
      if (wallet.address) await refresh(wallet.address).catch(() => undefined);
    } finally {
      setClaiming("");
    }
  }

  if (claimExperience) {
    const success = claimExperience.phase === "success";
    const status = claimExperience.phase === "preparing"
      ? "Preparing your single claim"
      : claimExperience.phase === "approval"
        ? "Approve one transaction in your wallet"
        : claimExperience.phase === "confirming"
          ? "Confirming your reward on Solana"
          : "Rewards claimed";
    return <main className="page rewards-page rewards-vault-page reward-claim-experience">
      <PageBubbles count={14}/>
      <section className={`reward-claim-card ${success ? "complete" : "processing"}`}>
        <span className="reward-claim-icon">{success ? <CheckCircle2/> : <Loader2 className="spin"/>}</span>
        <small>{claimExperience.name}</small>
        <h1>{status}</h1>
        <strong className="reward-claim-amount">{claimExperience.amountUsd}</strong>
        {success ? <>
          <p>{tokenAmount(claimExperience.amountRaw, claimExperience.stockDecimals, claimExperience.stockSymbol)} arrived in your wallet.</p>
          <div className="reward-claim-actions">
            <button className="primary" onClick={() => openXComposer(rewardClaimShareText(claimExperience.amountUsd))}><Share2/>Post on X</button>
            {claimExperience.signature && <a href={solscanTransactionUrl(claimExperience.signature, config.network)} target="_blank" rel="noreferrer">View transaction <ExternalLink/></a>}
            <button className="reward-claim-back" onClick={() => setClaimExperience(null)}><ArrowLeft/>Back to rewards</button>
          </div>
        </> : <p>Keep this page open. Your wallet will only ask for one approval.</p>}
      </section>
    </main>;
  }

  return <main className="page rewards-page rewards-vault-page">
    <PageBubbles count={14}/>
    <header className="rewards-vault-heading">
      <div><h1>Your rewards.</h1><p className="status-inline">{updatedAt ? "Last refreshed "+new Date(updatedAt).toLocaleTimeString() : "Loading reward allocations"}</p></div><button className="soft-button" onClick={()=>setRefreshKey(v=>v+1)}><RefreshCw size={14}/> Refresh</button>
    </header>

    <GovernanceVote/>

    {!wallet.address ? <section className="rewards-connect-card">
      <span><WalletCards/></span>
      <div><h2>Connect your wallet</h2><p>See every AQUA coin you hold and the rewards accumulating for it.</p></div>
      <button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>
    </section> : <>
      {state === "loading" ? <div className="reward-card-skeletons rewards-list-spaced"><i/><i/><i/></div> : state === "offline" ? <section className="rewards-empty rewards-list-spaced"><RefreshCw/><h2>Rewards are temporarily unavailable</h2><p>Reconnect in a moment to refresh your balances.</p></section> : markets.length ? <section className="holder-reward-list rewards-list-spaced">
        {markets.map((market) => {
          const launch = launchById.get(market.launchId);
          const displayCents = market.canClaim ? market.claimableUsdCents : market.accumulatingUsdCents;
          return <article className={`holder-reward-card ${market.canClaim ? "claimable" : "accruing"}`} key={market.launchId}>
            <div className="reward-market-identity">
              {launch ? <TokenMark launch={launch}/> : <span className="reward-market-fallback"><Coins/></span>}
              <div><b>{launch?.name ?? market.launchId}</b><small>{launch ? `$${launch.symbol}` : "AQUA market"} · reward</small></div>
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
              {market.canClaim ? <button onClick={() => void claim(market, launch)} disabled={claiming === market.launchId || (market.claimMode !== "cumulative" && market.claimableEpochIds.length > 1)}>{claiming === market.launchId ? <Loader2 className="spin"/> : market.claimMode !== "cumulative" && market.claimableEpochIds.length > 1 ? <>Program upgrade pending</> : <>Claim {dollars(market.claimableUsdCents)}</>}</button> : <span>Allocation target: {epochMinutes} min, subject to settlement</span>}
              {market.canClaim && <small>{market.claimMode !== "cumulative" && market.claimableEpochIds.length > 1 ? "One-transaction claims require the Solana program upgrade" : `1 wallet approval · est. ${dollars(market.estimatedClaimFeeUsdCents)} costs`}</small>}
            </div>
            {!market.canClaim && <p className="trade-route-note">Allocated {dollars(market.accumulatingUsdCents)}. Claims require more than {dollars(market.minimumClaimUsdCents)} after estimated costs, with an on-chain claimable allocation.</p>}
            {!market.canClaim && <div className="reward-water-progress"><i style={{ width: `${Math.max(6, Math.min(94, market.minimumClaimUsdCents ? market.accumulatingUsdCents / market.minimumClaimUsdCents * 100 : 6))}%` }}/><span/><span/></div>}
          </article>;
        })}
      </section> : <section className="rewards-empty"><Gift/><h2>No eligible AQUA holdings detected</h2><p>A coin appears here once this wallet holds an indexed AQUA token.</p></section>}
    </>}
  </main>;
}
