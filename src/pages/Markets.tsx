import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { PageBubbles } from "../components/PageBubbles";
import { AquaMark } from "../components/AquaMark";
import { OrcaMark } from "../components/OrcaMark";

type DataState = "loading" | "live" | "empty" | "offline";

export function Markets() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<DataState>("loading");

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

  const filtered = useMemo(() => [...launches]
    .sort((a, b) => Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)), [launches]);

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

      {state === "loading" ? <div className="market-skeletons markets-list-top">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid markets-list-top">{filtered.map((launch, index) => <TokenCard key={launch.id} launch={launch} featured={index === 0}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state markets-list-top"><Database/><h3>{state === "offline" ? "Markets unavailable" : "Fresh markets are on the way"}</h3><p>{state === "offline" ? "AQUA could not reach the market index. Try again shortly." : "New launches appear here after their market data starts indexing."}</p></div>}
    </section>

  </main>;
}
