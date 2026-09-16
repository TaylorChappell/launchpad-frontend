import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Droplets, Loader2, Trophy, Vote } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useWallet } from "../context";
import type { GovernanceResponse, Launch } from "../types";

function tokenAmount(raw: string, decimals: number) {
  const scale = 10n ** BigInt(decimals);
  const value = BigInt(raw || "0");
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 2);
  const numeric = Number(whole) + Number(fraction ? `0.${fraction}` : 0);
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(numeric);
}

function timeLeft(endsAt: number, now: number) {
  const seconds = Math.max(0, endsAt - now);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds % 86_400 / 3_600);
  const minutes = Math.floor(seconds % 3_600 / 60);
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}

export function GovernanceVote({ market, compact = false }: { market?: Launch; compact?: boolean }) {
  const wallet = useWallet();
  const [data, setData] = useState<GovernanceResponse | null>(null);
  const [targetMint, setTargetMint] = useState(market?.mint ?? "");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));

  useEffect(() => setTargetMint(market?.mint ?? ""), [market?.mint]);

  useEffect(() => {
    let active = true;
    const refresh = () => api.governance(wallet.address).then((result) => { if (active) setData(result); }).catch(() => undefined);
    void refresh();
    const poll = window.setInterval(refresh, 10_000);
    const clock = window.setInterval(() => setNow(Math.floor(Date.now() / 1_000)), 30_000);
    return () => { active = false; window.clearInterval(poll); window.clearInterval(clock); };
  }, [wallet.address]);

  const isAqua = Boolean(market && data?.enabled && market.mint === data.governanceMint);
  const selected = data?.enabled ? data.wallet?.vote : null;
  const alreadySelected = Boolean(market && selected?.mint === market.mint);
  const targetLabel = useMemo(() => market ? `${market.name} ($${market.symbol})` : "this market", [market]);

  async function castVote() {
    if (!wallet.address) return wallet.setModalOpen(true);
    if (!targetMint.trim()) return toast.error("Enter an AQUA market contract address.");
    setBusy(true);
    try {
      const challenge = await api.governanceVoteChallenge(wallet.address, targetMint.trim());
      const signed = await wallet.signMessage(challenge.message);
      const next = await api.governanceVote({ wallet: wallet.address, targetMint: targetMint.trim(), challenge: challenge.challenge, ...signed });
      setData(next);
      toast.success(`Your vote for ${challenge.market.name} is live.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The vote could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <section data-governance="weekly-market-vote" className={`governance-vote ${compact ? "compact" : "full"}`}><div className="governance-loading"><Loader2 className="spin"/> Loading weekly vote…</div></section>;
  if (!data.enabled) return compact ? null : <section data-governance="weekly-market-vote" className="governance-vote full unavailable"><Vote/><div><b>Weekly AQUA vote</b><p>{data.reason}</p></div></section>;

  return <section data-governance="weekly-market-vote" className={`governance-vote ${compact ? "compact" : "full"}`}>
    <header>
      <span className="governance-mark"><Droplets/></span>
      <div><small>WEEKLY AQUA COMMUNITY VOTE</small><h2>{compact ? "Vote for this market" : "Choose the next featured market"}</h2></div>
      <span className="governance-time"><Clock3/> {timeLeft(data.round.endsAt, now)} left</span>
    </header>

    {!compact && <p className="governance-explainer">The winning market receives 10% of AQUA treasury platform-fee income for 24 hours. Power is the lower of your current AQUA balance and your weekly average, so late buys build gradually and selling reduces power immediately.</p>}

    {!compact && <div className="governance-leaders">
      {[0, 1, 2].map((position) => {
        const leader = data.leaders[position];
        return <article key={leader?.launchId ?? position} className={position === 0 ? "first" : ""}>
          <i>{position === 0 ? <Trophy/> : position + 1}</i>
          {leader ? <><div><b>{leader.name}</b><small>${leader.symbol} · {leader.voters} {leader.voters === 1 ? "voter" : "voters"}</small></div><strong>{tokenAmount(leader.votingPowerRaw, data.decimals)} AQUA</strong></> : <><div><b>Open position</b><small>No eligible votes yet</small></div><strong>—</strong></>}
        </article>;
      })}
    </div>}

    <div className="governance-wallet-row">
      <div>
        <small>{wallet.address ? "YOUR LIVE VOTING POWER" : "AQUA HOLDER ACCESS"}</small>
        <strong>{wallet.address && data.wallet ? `${tokenAmount(data.wallet.votingPowerRaw, data.decimals)} AQUA` : "Connect to vote"}</strong>
        {data.wallet?.vote && <span><Check/> Voting for {data.wallet.vote.name}</span>}
      </div>
      {wallet.address && data.wallet && !data.wallet.eligible && <p>Hold at least 0.1% of AQUA to vote. Your balance is checked continuously.</p>}
    </div>

    {isAqua ? <div className="governance-aqua-exclusion">The main AQUA coin cannot be voted for.</div> : <div className="governance-action">
      {!compact && <label><span>Market contract address</span><input value={targetMint} onChange={(event) => setTargetMint(event.target.value)} placeholder="Enter a coin CA"/></label>}
      <button className="primary" onClick={() => void castVote()} disabled={busy || Boolean(wallet.address && data.wallet && !data.wallet.eligible) || alreadySelected}>
        {busy ? <Loader2 className="spin"/> : alreadySelected ? <><Check/> Vote active</> : <><Vote/> {wallet.address ? `Vote for ${market ? targetLabel : "market"}` : "Connect to vote"}</>}
      </button>
    </div>}

    {data.activeBonus && <footer><Trophy/> <span><b>{data.activeBonus.name}</b> is receiving the current 24-hour community allocation.</span></footer>}
  </section>;
}
