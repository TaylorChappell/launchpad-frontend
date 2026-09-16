import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { PageBubbles } from "../components/PageBubbles";
import { AquaMark } from "../components/AquaMark";
import { OrcaMark } from "../components/OrcaMark";
import { RewardModeIcon } from "../components/RewardModeIcon";

type DataState = "loading" | "live" | "empty" | "offline";
type ModeFilter = "all" | Launch["rewardMode"];
const PAGE_SIZE = 12;
const modeFilters: Array<{ value: ModeFilter; label: string }> = [
  { value: "all", label: "All modes" },
  { value: "holder_rewards", label: "Holder rewards" },
  { value: "buyback_burn", label: "Buyback & burn" },
  { value: "jackpot", label: "Jackpot" },
];

export function Markets() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<DataState>("loading");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const data = await api.launches();
      if (!active) return;
      const liveLaunches = data.launches.filter((launch) => launch.status === "live");
      setLaunches(liveLaunches);
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

  const filtered = useMemo(() => launches
    .filter((launch) => modeFilter === "all" || launch.rewardMode === modeFilter)
    .slice()
    .sort((a, b) => Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)), [launches, modeFilter]);
  const visible = filtered.slice(0, visibleCount);

  useEffect(() => setVisibleCount(PAGE_SIZE), [modeFilter]);

  return <main className="explore-page">
    <PageBubbles count={18}/>
    <section className="explore-intro">
      <span className="explore-aqua-logo"><AquaMark/><i/><i/></span>
      <div className="explore-intro-copy"><h1>Coins that reward the people who hold.</h1><p><strong>AQUA is a token launchpad built directly on <a href="https://www.orca.so/" target="_blank" rel="noreferrer">Orca</a>.</strong> Markets trade against SOL or an xStock, while every coin keeps one permanent tokenized-stock reward asset.</p></div>
      <div className="explore-intro-actions">
        <Link to="/how-it-works"><span>How it works</span><ArrowRight size={16}/></Link>
        <a href="https://www.orca.so/" target="_blank" rel="noreferrer"><OrcaMark/><span>Visit Orca</span></a>
      </div>
    </section>

    <section className="market-workspace" id="markets">
      <header className="workspace-heading">
        <div>
          <h2>Explore markets</h2>
          <p>Popular AQUA launches, ranked by 24 hour volume.</p>
        </div>
      </header>

      <div className="market-mode-filters" aria-label="Filter markets by reward mode">
        {modeFilters.map((filter) => <button key={filter.value} className={`${filter.value} ${modeFilter === filter.value ? "active" : ""}`} onClick={() => setModeFilter(filter.value)}>{filter.value !== "all" && <RewardModeIcon mode={filter.value}/>}<span>{filter.label}</span><small>{filter.value === "all" ? launches.length : launches.filter((launch) => launch.rewardMode === filter.value).length}</small></button>)}
      </div>

      {state === "loading" ? <div className="market-skeletons markets-list-top">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid markets-list-top">{visible.map((launch, index) => <TokenCard key={launch.id} launch={launch} featured={index === 0}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state markets-list-top"><Database/><h3>{state === "offline" ? "Markets unavailable" : "Fresh markets are on the way"}</h3><p>{state === "offline" ? "AQUA could not reach the market index. Try again shortly." : "New launches appear here after their market data starts indexing."}</p></div>}
      {visible.length < filtered.length && <button className="markets-load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Load more markets <span>{visible.length} of {filtered.length}</span></button>}
    </section>

  </main>;
}
