import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database, Gift, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenCard } from "../components/TokenCard";
import { PageBubbles } from "../components/PageBubbles";

type DataState = "loading" | "live" | "empty" | "offline";

export function Markets() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<DataState>("loading");

  useEffect(() => {
    api.launches().then((data) => {
      setLaunches(data.launches);
      setState(data.launches.length ? "live" : "empty");
    }).catch(() => setState("offline"));
  }, []);

  const filtered = useMemo(() => [...launches]
    .sort((a, b) => Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0)), [launches]);

  return <main className="explore-page">
    <PageBubbles count={14}/>
    <section className="explore-intro">
      <span className="explore-intro-icon"><Gift/></span>
      <div><h1>Coins that reward the people who hold.</h1><p>Every AQUA market is paired with a tokenized stock. Hold a coin, build time-weighted rewards, then claim the stock it is paired with.</p></div>
      <Link to="/create">Launch a coin <ArrowRight size={16}/></Link>
      <Waves className="explore-intro-wave" aria-hidden="true"/>
    </section>

    <section className="market-workspace" id="markets">
      <header className="workspace-heading">
        <div>
          <h2>Explore markets</h2>
          <p>Popular AQUA launches, ranked by 24 hour volume.</p>
        </div>
        <span className="market-count">{state === "loading" ? "Loading" : `${filtered.length} market${filtered.length === 1 ? "" : "s"}`}</span>
      </header>

      {state === "loading" ? <div className="market-skeletons markets-list-top">{[0,1,2].map(i => <div key={i}/>)}</div> : <div className="token-grid markets-list-top">{filtered.map((launch, index) => <TokenCard key={launch.id} launch={launch} featured={index === 0}/>)}</div>}
      {state !== "loading" && !filtered.length && <div className="empty-state markets-list-top"><Database/><h3>{state === "offline" ? "Markets unavailable" : "Fresh markets are on the way"}</h3><p>{state === "offline" ? "AQUA could not reach the market index. Try again shortly." : "New launches appear here after their market data starts indexing."}</p></div>}
    </section>

  </main>;
}
