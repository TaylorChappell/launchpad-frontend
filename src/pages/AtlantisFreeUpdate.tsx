import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageBubbles } from "../components/PageBubbles";
import { loadStudioConfig, type StudioConfig } from "../studio-api";
import "./atlantis-free-update.css";

const pad = (value: number) => String(value).padStart(2, "0");

export function AtlantisFreeUpdate() {
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    void loadStudioConfig().then(value => {
      setServerOffset((value.promotion?.serverNow ?? Date.now()) - Date.now());
      setConfig(value);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load the promotion clock."));
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    const promotion = config?.promotion;
    if (!promotion?.endsAt) return null;
    const remaining = Math.max(0, promotion.endsAt - (tick + serverOffset));
    const totalSeconds = Math.floor(remaining / 1000);
    return {
      remaining,
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }, [config, serverOffset, tick]);

  const active = Boolean(config?.promotion?.active && countdown?.remaining);
  return <main className="atlantis-update">
    <PageBubbles count={12}/>
    <section className="atlantis-update-card">
      <div className="atlantis-update-water" aria-hidden="true"><i/><i/><i/></div>
      <span className="atlantis-update-kicker"><Sparkles size={15}/> LIMITED STUDIO EVENT</span>
      <h1>Atlantis Studio is free for 24 hours.</h1>
      <p>Build your memecoin concept, artwork and website with Atlantis. Open Studio, connect your wallet and start creating.</p>
      {active && countdown ? <>
        <div className="atlantis-update-countdown" aria-label={`${countdown.hours} hours, ${countdown.minutes} minutes and ${countdown.seconds} seconds remaining`}>
          <Time value={countdown.hours} label="Hours"/>
          <span>:</span>
          <Time value={countdown.minutes} label="Minutes"/>
          <span>:</span>
          <Time value={countdown.seconds} label="Seconds"/>
        </div>
        <small className="atlantis-update-live"><i/> Live countdown from the AQUA server</small>
      </> : config ? <div className="atlantis-update-ended"><Clock3/> This free period has ended.</div> : <div className="atlantis-update-loading"><Clock3/> {error || "Loading the live countdown…"}</div>}
      <Link className="atlantis-update-button" to="/studio">Open Atlantis Studio <ArrowRight size={18}/></Link>
    </section>
  </main>;
}

function Time({ value, label }: { value: number; label: string }) {
  return <div><strong>{pad(value)}</strong><small>{label}</small></div>;
}
