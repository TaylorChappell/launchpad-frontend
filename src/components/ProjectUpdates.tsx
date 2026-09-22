import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { creatorApi, type ProjectUpdate } from "../creator-api";
import { ensureAccountSession } from "../account-api";
import { useRuntime, useWallet } from "../context";
import { solscanAccountUrl } from "../creator-lock";
import { TokenMark } from "./TokenCard";
import type { Launch } from "../types";

export function ProjectUpdates({ launch, compose = false }: { launch: Launch; compose?: boolean }) {
  return <ProjectUpdateList key={launch.id} launch={launch} compose={compose}/>;
}
function ProjectUpdateList({ launch, compose }: { launch: Launch; compose: boolean }) {
  const wallet = useWallet(), { config } = useRuntime();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]), [more, setMore] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [body, setBody] = useState(""), [posting, setPosting] = useState(false);
  const request = useRef<{ id: string; body: string } | null>(null), address = useRef(wallet.address), busy = useRef(false);
  address.current = wallet.address;
  async function load(append = false) {
    setLoading(true); setError("");
    try { const result = await creatorApi.updates(launch.id, append ? updates.length : 0); setUpdates(previous => append ? [...new Map([...previous, ...result.updates].map(item => [item.id, item])).values()] : result.updates); setMore(result.hasMore); }
    catch (e) { setError(e instanceof Error ? e.message : "Updates could not load."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [launch.id]);
  async function publish() {
    const author = wallet.address;
    if (!author || author !== launch.creatorWallet || !body.trim() || busy.current) return;
    busy.current = true; setPosting(true); setError("");
    const draft = body.trim();
    if (request.current?.body !== draft) request.current = { id: crypto.randomUUID(), body: draft };
    try {
      const token = await ensureAccountSession(author, wallet.signMessage);
      if (address.current !== author) throw new Error("Wallet changed. Review your update again.");
      const { update } = await creatorApi.publish(launch.id, token, request.current!);
      setUpdates(previous => [update, ...previous.filter(item => item.id !== update.id)]); setBody(""); request.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish this update."); }
    finally { busy.current = false; setPosting(false); }
  }
  return <section className="creator-updates">
    <header><div><h2>Project updates</h2><p>News from the people building {launch.name}.</p></div></header>
    {compose && wallet.address === launch.creatorWallet && <form className="creator-update-composer" onSubmit={event => { event.preventDefault(); void publish(); }}>
      <label htmlFor="project-update-body">What’s happening with your project?</label>
      <textarea id="project-update-body" value={body} maxLength={1000} rows={5} disabled={posting} placeholder="Share a release, progress, or what you’re working on next…" onChange={event => setBody(event.target.value)}/>
      <footer><small>{body.length}/1,000 · Public on your coin’s market page</small><button className="primary" disabled={posting || !body.trim()}>{posting && <Loader2 className="spin"/>}{posting ? "Publishing…" : "Publish update"}</button></footer>
    </form>}
    {error && <p className="creator-inline-error" role="alert">{error} {!posting && <button onClick={() => void load()}>Reload updates</button>}</p>}
    {!updates.length && !loading && !error && <p className="creator-empty">{compose ? "Your first update will appear here and on the market page." : "The creator hasn’t posted an update yet."}</p>}
    <div className="project-update-feed">{updates.map(update => <article key={update.id}>
      <TokenMark launch={launch}/><div><header><strong>{launch.name}</strong><span>{update.authorWallet === launch.creatorWallet ? "Creator" : "Previous creator"}</span><time dateTime={new Date(update.createdAt).toISOString()} title={new Date(update.createdAt).toLocaleString()}>{new Date(update.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></header>
      <p>{update.body}</p><a href={solscanAccountUrl(update.authorWallet, config.network)} target="_blank" rel="noreferrer">{update.authorWallet.slice(0, 5)}…{update.authorWallet.slice(-4)} <ExternalLink size={12}/></a></div>
    </article>)}</div>
    {loading && <p className="creator-empty" role="status">Loading updates…</p>}
    {more && <button className="soft-button" disabled={loading} onClick={() => void load(true)}>Older updates</button>}
  </section>;
}
