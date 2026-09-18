import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Database, SlidersHorizontal, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { GovernanceResponse, Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { PageBubbles } from "../components/PageBubbles";
import { AquaMark } from "../components/AquaMark";
import { OrcaMark } from "../components/OrcaMark";

type DataState = "loading" | "live" | "empty" | "offline";
type SortMode = "popular" | "recent" | "market_cap" | "upcoming";
const PAGE_SIZE = 12;
const AQUA_MINT = "AQVcP67EpMyu4cBZZjqMu91cVsWy1aX98JmcZm1FyY9";
const modeFilters: Array<{ value: Launch["rewardMode"]; label: string }> = [
  { value: "holder_rewards", label: "Holder rewards" },
  { value: "buyback_burn", label: "Buyback & burn" },
  { value: "jackpot", label: "Jackpot" },
];
const sortLabels: Record<SortMode, string> = { popular: "Popular", recent: "Most recent", market_cap: "Highest market cap", upcoming: "Up and coming" };

export function Markets() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [governance, setGovernance] = useState<Extract<GovernanceResponse, { enabled: true }> | null>(null);
  const [state, setState] = useState<DataState>("loading");
  const [modeFiltersActive, setModeFiltersActive] = useState<Set<Launch["rewardMode"]>>(new Set());
  const [pairFilters, setPairFilters] = useState<Set<Launch["pairType"]>>(new Set());
  const [dexOnly, setDexOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const filterRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const [data, vote] = await Promise.all([
        api.launches(),
        api.governance().catch(() => null),
      ]);
      if (!active) return;
      const liveLaunches = data.launches.filter((launch) => launch.status === "live");
      setLaunches(liveLaunches);
      setGovernance(vote?.enabled ? vote : null);
      setState(liveLaunches.length ? "live" : "empty");
    };

    void refresh().catch(() => { if (active) setState("offline"); });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    }, 5_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!filterRoot.current?.contains(event.target as Node)) setFiltersOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);

  const boostedMint = governance?.activeBonus?.mint ?? null;
  const filtered = useMemo(() => {
    const priority = (launch: Launch) => launch.mint === (governance?.governanceMint ?? AQUA_MINT) ? 0 : launch.mint === boostedMint ? 1 : 2;
    const pinned = (launch: Launch) => priority(launch) < 2;
    const compare = (a: Launch, b: Launch) => {
      if (sortMode === "recent") return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      if (sortMode === "market_cap") return Number(b.marketCapUsd || 0) - Number(a.marketCapUsd || 0);
      if (sortMode === "upcoming") {
        const score = (launch: Launch) => Number(launch.volume24hUsd || 0) / Math.max(Number(launch.marketCapUsd || 0), 1) + Math.max(Number(launch.change24h || 0), 0) / 100;
        return score(b) - score(a) || Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0);
      }
      return Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0);
    };
    return launches
      .filter((launch) => pinned(launch) || (!modeFiltersActive.size || modeFiltersActive.has(launch.rewardMode)))
      .filter((launch) => pinned(launch) || (!pairFilters.size || pairFilters.has(launch.pairType)))
      .filter((launch) => pinned(launch) || !dexOnly || launch.dexPaid)
      .slice()
      .sort((a, b) => priority(a) - priority(b) || compare(a, b));
  }, [boostedMint, dexOnly, governance?.governanceMint, launches, modeFiltersActive, pairFilters, sortMode]);
  const visible = filtered.slice(0, visibleCount);
  const activeFilterCount = modeFiltersActive.size + pairFilters.size + Number(dexOnly);
  const toggle = <T,>(set: Set<T>, value: T, update: (next: Set<T>) => void) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); update(next); };

  useEffect(() => setVisibleCount(PAGE_SIZE), [modeFiltersActive, pairFilters, dexOnly, sortMode]);

  return <main className="explore-page">
    <PageBubbles count={18}/>
    <section className="explore-intro">
      <span className="explore-aqua-logo"><AquaMark/><i/><i/></span>
      <div className="explore-intro-copy"><h1>Coins that reward the people who hold.</h1><p><strong>AQUA is a token launchpad built directly on <a href="https://www.orca.so/" target="_blank" rel="noreferrer">Orca</a>.</strong> Launch against SOL, ORCA or a supported xStock. Each coin has one permanent reward mode: holder rewards, buyback and burn, or jackpot.</p></div>
      <div className="explore-intro-actions">
        <Link to="/how-it-works"><span>How it works</span><ArrowRight size={16}/></Link>
        <a href="https://www.orca.so/" target="_blank" rel="noreferrer"><OrcaMark/><span>Visit Orca</span></a>
      </div>
    </section>

    <section className="market-workspace" id="markets">
      <header className="workspace-heading">
        <div>
          <h2>Explore markets</h2>
          <p>{sortLabels[sortMode]} AQUA launches. AQUA and the active boosted market stay pinned first.</p>
        </div>
        <div className="market-filter-menu" ref={filterRoot}>
          <button className={`market-filter-trigger ${activeFilterCount ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="market-filter-panel"><SlidersHorizontal/><span>Filters</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}<ChevronDown/></button>
          {filtersOpen && <section className="market-filter-panel" id="market-filter-panel">
            <header><div><small>MARKET VIEW</small><h3>Filter and sort</h3></div><button aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X/></button></header>
            <fieldset><legend>Reward modes <small>Select any combination</small></legend>{modeFilters.map((filter) => <button key={filter.value} className={modeFiltersActive.has(filter.value) ? "selected" : ""} onClick={() => toggle(modeFiltersActive, filter.value, setModeFiltersActive)}><span>{filter.label}</span><i>{modeFiltersActive.has(filter.value) && <Check/>}</i></button>)}</fieldset>
            <fieldset><legend>Pairs</legend><div className="filter-pair-row"><button className={pairFilters.has("sol") ? "selected" : ""} onClick={() => toggle(pairFilters, "sol", setPairFilters)}><span>SOL pairs</span><i>{pairFilters.has("sol") && <Check/>}</i></button><button className={pairFilters.has("stock") ? "selected" : ""} onClick={() => toggle(pairFilters, "stock", setPairFilters)}><span>Stock pairs</span><i>{pairFilters.has("stock") && <Check/>}</i></button></div><button className={dexOnly ? "selected" : ""} onClick={() => setDexOnly((value) => !value)}><span>DEX profile paid</span><i>{dexOnly && <Check/>}</i></button></fieldset>
            <fieldset><legend>Order by</legend><div className="filter-sort-grid">{(Object.keys(sortLabels) as SortMode[]).map((sort) => <button key={sort} className={sortMode === sort ? "selected" : ""} onClick={() => setSortMode(sort)}><span>{sortLabels[sort]}</span><i>{sortMode === sort && <Check/>}</i></button>)}</div></fieldset>
            <footer><button disabled={!activeFilterCount && sortMode === "popular"} onClick={() => { setModeFiltersActive(new Set()); setPairFilters(new Set()); setDexOnly(false); setSortMode("popular"); }}>Reset</button><span>{filtered.length} markets</span></footer>
          </section>}
        </div>
      </header>

      {state === "loading" ? <div className="market-skeletons markets-list-top">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid markets-list-top">{visible.map((launch) => <TokenCard key={launch.id} launch={launch} featured={launch.mint === (governance?.governanceMint ?? AQUA_MINT)} boosted={launch.mint === boostedMint}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state markets-list-top"><Database/><h3>{state === "offline" ? "Markets unavailable" : "Fresh markets are on the way"}</h3><p>{state === "offline" ? "AQUA could not reach the market index. Try again shortly." : "New launches appear here after their market data starts indexing."}</p></div>}
      {visible.length < filtered.length && <button className="markets-load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Load more markets <span>{visible.length} of {filtered.length}</span></button>}
    </section>

  </main>;
}
