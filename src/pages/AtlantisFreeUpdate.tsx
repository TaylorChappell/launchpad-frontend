import { ArrowRight, Clock3, Gamepad2, Globe2, Image as ImageIcon, PanelsTopLeft, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
      <span className="atlantis-update-kicker"><Sparkles size={15}/> ATLANTIS STUDIO · NOW LIVE</span>
      <h1>Launch the token.<br/>Build the world around it.</h1>
      <p>Atlantis Studio is Aqua&apos;s all-in-one creation toolbox for creators launching on Aqua. Build the experiences that turn a token into a community without leaving the launchpad.</p>
      <div className="atlantis-update-features">
        <Feature icon={<Globe2/>} title="Websites" copy="Create and refine a complete token website in the same workspace as your launch."/>
        <Feature icon={<Gamepad2/>} title="Apps & mini-games" copy="Turn a community idea into an interactive experience people can actually use."/>
        <Feature icon={<ImageIcon/>} title="Memes & generators" copy="Build shareable artwork, meme concepts and generators around your token identity."/>
        <Feature icon={<PanelsTopLeft/>} title="One Aqua workspace" copy="Keep the concept, assets, code and website together from first idea to export."/>
      </div>
      <div className="atlantis-update-free"><b>Launch event</b><span>Atlantis Studio is free to use for 24 hours.</span></div>
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
      <strong className="atlantis-update-signoff">Launch on Aqua. Build on Orca.</strong>
    </section>
  </main>;
}

function Feature({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <article><i>{icon}</i><span><b>{title}</b><small>{copy}</small></span></article>;
}

function Time({ value, label }: { value: number; label: string }) {
  return <div><strong>{pad(value)}</strong><small>{label}</small></div>;
}
