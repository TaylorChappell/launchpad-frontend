import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Clock3, Loader2, Search, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useWallet } from "../context";
import type { GovernanceMarket, GovernanceResponse, Launch } from "../types";
import { TokenMark } from "./TokenCard";

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

function modeLabel(mode: GovernanceMarket["rewardMode"]) {
  if (mode === "buyback_burn") return "Buyback & burn";
  if (mode === "jackpot") return "Jackpot";
  return "Holder rewards";
}

function AquaVoteArt({ small = false }: { small?: boolean }) {
  return <svg className={small ? "aqua-vote-art small" : "aqua-vote-art"} viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id={small ? "vote-water-small" : "vote-water"} x1="8" y1="4" x2="52" y2="58" gradientUnits="userSpaceOnUse"><stop stopColor="#8edbff"/><stop offset=".55" stopColor="#249feb"/><stop offset="1" stopColor="#0967bf"/></linearGradient></defs>
    <path d="M32 4C24 16 14 27 14 39a18 18 0 1 0 36 0C50 27 40 16 32 4Z" fill={`url(#${small ? "vote-water-small" : "vote-water"})`}/>
    <path d="M24 39.5 29.5 45 41 32.5" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 28c2-5 5-9 9-14" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}

function MarketMark({ market, launch }: { market: GovernanceMarket; launch?: Launch }) {
  if (launch) return <TokenMark launch={launch}/>;
  return <span className="governance-market-fallback" aria-hidden="true"><span>{market.symbol.slice(0, 2)}</span><i/><i/></span>;
}

export function GovernanceVote({ market, compact = false }: { market?: Launch; compact?: boolean }) {
  const wallet = useWallet();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<GovernanceResponse | null>(null);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyMint, setBusyMint] = useState("");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));

  useEffect(() => {
    let active = true;
    const refresh = () => api.governance(wallet.address).then((result) => { if (active) setData(result); }).catch(() => undefined);
    void refresh();
    const poll = window.setInterval(refresh, 10_000);
    const clock = window.setInterval(() => setNow(Math.floor(Date.now() / 1_000)), 15_000);
    return () => { active = false; window.clearInterval(poll); window.clearInterval(clock); };
  }, [wallet.address]);

  useEffect(() => {
    if (!selectorOpen && !leaderboardOpen) return;
    let active = true;
    if (!launches.length) void api.launches().then((result) => { if (active) setLaunches(result.launches); }).catch(() => undefined);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelectorOpen(false); setLeaderboardOpen(false); } };
    window.addEventListener("keydown", close);
    const focus = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => { active = false; window.removeEventListener("keydown", close); window.clearTimeout(focus); };
  }, [selectorOpen, leaderboardOpen, launches.length]);

  const selected = data?.enabled ? data.wallet?.vote : null;
  const isAqua = Boolean(market && data?.enabled && market.mint === data.governanceMint);
  const alreadySelected = Boolean(market && selected?.mint === market.mint);
  const launchByMint = useMemo(() => new Map(launches.map((launch) => [launch.mint, launch])), [launches]);
  const candidates = useMemo(() => {
    if (!data?.enabled) return [];
    const term = query.trim().toLowerCase();
    return launches
      .filter((launch) => launch.status === "live" && launch.mint !== data.governanceMint)
      .filter((launch) => !term || [launch.name, launch.symbol, launch.stockSymbol, launch.mint]
        .some((value) => String(value ?? "").toLowerCase().includes(term)))
      .sort((a, b) => Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0))
      .slice(0, 9);
  }, [data, launches, query]);

  async function castVote(target: Launch | { mint: string; name: string }) {
    if (!wallet.address) {
      setSelectorOpen(false);
      return wallet.setModalOpen(true);
    }
    if (data?.enabled && data.wallet && !data.wallet.eligible) return toast.error("Hold at least 0.1% of AQUA to vote.");
    setBusyMint(target.mint);
    try {
      const challenge = await api.governanceVoteChallenge(wallet.address, target.mint);
      const signed = await wallet.signMessage(challenge.message);
      const next = await api.governanceVote({ wallet: wallet.address, targetMint: target.mint, challenge: challenge.challenge, ...signed });
      setData(next);
      setSelectorOpen(false);
      setQuery("");
      toast.success(`${challenge.market.name} is now your boosted market.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The vote could not be recorded.");
    } finally {
      setBusyMint("");
    }
  }

  if (!data) return compact ? null : <section data-governance="weekly-market-vote" className="governance-hub loading"><Loader2 className="spin"/> Loading weekly market vote…</section>;
  if (!data.enabled || isAqua) return null;

  const ineligible = Boolean(wallet.address && data.wallet && !data.wallet.eligible);
  const marketButtonLabel = ineligible ? "HOLD 0.1% AQUA" : alreadySelected ? "BOOSTED" : selected ? "CHANGE BOOST" : "BOOST";

  if (compact && market) return <section data-governance="weekly-market-vote" className="market-boost-strip">
    <div className="market-boost-copy"><AquaVoteArt small/><span><small>FRIDAY AQUA BOOST</small><b>Back this market</b></span><em><Clock3/> {timeLeft(data.round.endsAt, now)}</em></div>
    <button className={alreadySelected ? "active" : ""} disabled={Boolean(busyMint) || alreadySelected || ineligible} onClick={() => void castVote(market)}>
      {busyMint ? <Loader2 className="spin"/> : alreadySelected ? <Check/> : null}{marketButtonLabel}
    </button>
  </section>;

  return <>
    <section data-governance="weekly-market-vote" className={`governance-hub ${selected ? "has-vote" : ""}`}>
      <div className="governance-compact-callout">
        <AquaVoteArt/>
        <div className="governance-compact-copy"><small>FRIDAY AQUA BOOST</small><h2>VOTE FOR THE NEXT BOOSTED MARKET</h2><p>Voting closes Friday. The winner receives 10% of AQUA platform fees for 24 hours.</p></div>
        <span className="governance-compact-time"><Clock3/> {timeLeft(data.round.endsAt, now)}</span>
        {selected && <span className="governance-current-vote"><Check/> ${selected.symbol}</span>}
        <button className="governance-open-vote" onClick={() => setSelectorOpen(true)}>{selected ? "CHANGE" : "VOTE"}<ChevronRight/></button>
      </div>

      {selected && <div className="governance-top-preview">
        <span className="governance-top-label">LEADING MARKETS</span>
        <div className="governance-top-three">
          {data.leaders.slice(0, 3).map((leader) => <div key={leader.launchId} className={leader.mint === selected.mint ? "your-pick" : ""}><b>#{leader.rank}</b><MarketMark market={leader} launch={launchByMint.get(leader.mint)}/><span><strong>{leader.name}</strong><small>${leader.symbol} · {leader.voters} {leader.voters === 1 ? "voter" : "voters"}</small></span></div>)}
          {!data.leaders.length && <p>No eligible votes are ranked yet.</p>}
        </div>
        <button className="governance-view-more" onClick={() => setLeaderboardOpen(true)}>VIEW MORE <ChevronRight/></button>
      </div>}

      {data.activeBonus && <div className="governance-active-boost"><Trophy/><span><b>${data.activeBonus.symbol}</b> is receiving this week’s 24-hour boost.</span></div>}
    </section>

    {selectorOpen && createPortal(<div className="governance-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectorOpen(false); }}>
      <section className="governance-dialog vote-picker" role="dialog" aria-modal="true" aria-labelledby="vote-picker-title">
        <button className="governance-dialog-close" onClick={() => setSelectorOpen(false)} aria-label="Close"><X/></button>
        <header><AquaVoteArt/><div><small>FRIDAY AQUA BOOST</small><h2 id="vote-picker-title">Choose a market</h2><p>Search by coin, ticker, reward stock, or contract address.</p></div></header>
        <label className="governance-search"><Search/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets or paste a CA"/></label>
        {ineligible && <div className="governance-eligibility-note">This wallet needs at least 0.1% of AQUA to vote.</div>}
        <div className="governance-suggestions-title"><b>{query.trim() ? "SEARCH RESULTS" : "SUGGESTED MARKETS"}</b><span>{candidates.length} shown</span></div>
        <div className="governance-candidates">
          {candidates.map((candidate) => {
            const current = selected?.mint === candidate.mint;
            return <button key={candidate.id} disabled={Boolean(busyMint) || current || ineligible} onClick={() => void castVote(candidate)}><TokenMark launch={candidate}/><span><b>{candidate.name}</b><small>${candidate.symbol} · {modeLabel(candidate.rewardMode ?? "holder_rewards")}</small></span><em>{current ? <><Check/> YOUR PICK</> : busyMint === candidate.mint ? <Loader2 className="spin"/> : "SELECT"}</em></button>;
          })}
          {!launches.length && <div className="governance-candidates-empty"><Loader2 className="spin"/> Loading AQUA markets…</div>}
          {Boolean(launches.length) && !candidates.length && <div className="governance-candidates-empty"><Search/> No matching AQUA market.</div>}
        </div>
      </section>
    </div>, document.body)}

    {leaderboardOpen && createPortal(<div className="governance-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLeaderboardOpen(false); }}>
      <section className="governance-dialog leaderboard" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
        <button className="governance-dialog-close" onClick={() => setLeaderboardOpen(false)} aria-label="Close"><X/></button>
        <header><span className="leaderboard-trophy"><Trophy/></span><div><small>LIVE FRIDAY RANKING</small><h2 id="leaderboard-title">Boost leaderboard</h2><p>Rankings update as eligible AQUA holders change their vote.</p></div></header>
        <div className="governance-leaderboard-head"><span>MARKET</span><span>VOTERS</span><span>AQUA WEIGHT</span></div>
        <div className="governance-leaderboard-list">
          {data.leaders.map((leader) => <div key={leader.launchId} className={`${leader.rank === 1 ? "winner" : ""} ${selected?.mint === leader.mint ? "your-pick" : ""}`}><b className="governance-rank">{leader.rank}</b><MarketMark market={leader} launch={launchByMint.get(leader.mint)}/><span><strong>{leader.name}</strong><small>${leader.symbol} · {modeLabel(leader.rewardMode)}</small></span><em>{leader.voters}</em><b className="governance-leader-score">{tokenAmount(leader.votingPowerRaw, data.decimals)}</b></div>)}
          {!data.leaders.length && <div className="governance-empty-leaderboard"><Trophy/><b>No ranked markets yet</b><span>Cast the first eligible vote for this round.</span></div>}
        </div>
        <footer><Clock3/> Round closes in {timeLeft(data.round.endsAt, now)}.</footer>
      </section>
    </div>, document.body)}
  </>;
}
