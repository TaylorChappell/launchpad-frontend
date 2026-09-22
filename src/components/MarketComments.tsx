import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { savedAccountSession } from "../account-api";
import { commentsApi } from "../market-comments-api";
import { mergeComments, type MarketComment } from "../market-comments";
import { useWallet } from "../context";
import type { Launch } from "../types";
import { buybackAge } from "../time";
import { WalletIdentity } from "./WalletIdentity";
import "./market-comments.css";

export function MarketComments({ launch }: { launch: Launch }) {
  return <CommentList key={launch.id} launch={launch}/>;
}

function CommentList({ launch }: { launch: Launch }) {
  const wallet = useWallet();
  const [session, setSession] = useState(() => savedAccountSession(wallet.address));
  const [comments, setComments] = useState<MarketComment[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [body, setBody] = useState(""), [posting, setPosting] = useState(false), [postError, setPostError] = useState("");
  const alive = useRef(false), reading = useRef<AbortController | null>(null), postingRef = useRef(false);
  const address = useRef(wallet.address), draft = useRef<{ id: string; body: string; wallet: string } | null>(null);
  address.current = wallet.address;

  async function load(before: string | null = null) {
    if (reading.current) return;
    const controller = new AbortController(); reading.current = controller;
    setLoading(true); setLoadError("");
    try {
      const result = await commentsApi.list(launch.id, before, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setComments(current => mergeComments(current, result.comments));
      setCursor(result.nextCursor); setLoaded(true);
    } catch (error) {
      if (alive.current && !controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Comments could not load.");
    } finally {
      if (reading.current === controller) {
        reading.current = null;
        if (alive.current) setLoading(false);
      }
    }
  }

  useEffect(() => {
    alive.current = true; void load();
    return () => { alive.current = false; reading.current?.abort(); reading.current = null; };
  }, [launch.id]);
  useEffect(() => { setBody(""); setPostError(""); draft.current = null; }, [wallet.address]);
  useEffect(() => {
    const sync = () => setSession(savedAccountSession(wallet.address));
    sync();
    window.addEventListener("aqua:account-session", sync);
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 30000);
    return () => { window.removeEventListener("aqua:account-session", sync); window.removeEventListener("storage", sync); window.clearInterval(timer); };
  }, [wallet.address]);

  async function publish() {
    const author = wallet.address, text = body.trim();
    if (!author || !text || text.length > 1000 || postingRef.current || launch.status !== "live") return;
    if (draft.current?.body !== text || draft.current.wallet !== author)
      draft.current = { id: crypto.randomUUID(), body: text, wallet: author };
    const submission = { id: draft.current.id, body: text };
    postingRef.current = true; setPosting(true); setPostError("");
    try {
      const token = savedAccountSession(author);
      if (!token) { setSession(null); return; }
      if (!alive.current || address.current !== author) return;
      const { comment } = await commentsApi.publish(launch.id, author, token, submission);
      if (!alive.current) return;
      setComments(current => mergeComments(current, [comment]));
      if (address.current === author) { setBody(""); draft.current = null; }
    } catch (error) {
      if (alive.current && address.current === author) {
        setSession(savedAccountSession(author));
        setPostError(error instanceof Error ? error.message : "Could not post your comment. Try again.");
      }
    } finally {
      postingRef.current = false;
      if (alive.current) setPosting(false);
    }
  }

  return <section className="market-comments" aria-labelledby="market-comments-heading">
    <header className="market-comments-heading"><h2 id="market-comments-heading">Comments</h2><span>Newest first</span></header>
    {launch.status !== "live" ? <p className="market-comments-empty">Comments open once this coin launches.</p> : wallet.address && session ?
      <form className="market-comment-composer" onSubmit={event => { event.preventDefault(); void publish(); }}>
        <div className="market-comment-author"><WalletIdentity wallet={wallet.address} link={false}/></div>
        <label className="sr-only" htmlFor="market-comment-body">Your comment</label>
        <textarea id="market-comment-body" value={body} maxLength={1000} rows={3} disabled={posting}
          placeholder={`Join the conversation about ${launch.symbol}…`} onChange={event => setBody(event.target.value)}/>
        <footer><span>{body.length.toLocaleString()}/1,000</span><button className="primary" type="submit" disabled={posting || !body.trim()}>
          {posting && <Loader2 size={15} className="spin"/>}{posting ? "Posting…" : "Post comment"}
        </button></footer>
        {postError && <p className="market-comments-error" role="alert">{postError}</p>}
      </form> : <div className="market-comments-connect"><p>{wallet.address ? "Reconnect your wallet to join the conversation." : "Connect your wallet to join the conversation."}</p><button className="soft-button" onClick={() => wallet.setModalOpen(true)}>{wallet.address ? "Reconnect wallet" : "Connect wallet"}</button></div>}
    <div className="market-comment-feed">{comments.map(comment => <article className="market-comment" key={comment.id}>
      <header><WalletIdentity wallet={comment.authorWallet}/>{comment.authorWallet === launch.creatorWallet && <span className="market-comment-creator">Creator</span>}
        <time dateTime={new Date(comment.createdAt).toISOString()} title={new Date(comment.createdAt).toLocaleString()}>{buybackAge(comment.createdAt)}</time>
      </header><p>{comment.body}</p>
    </article>)}</div>
    {loaded && !comments.length && !loading && <p className="market-comments-empty">No comments yet. Start the conversation.</p>}
    {loadError && <p className="market-comments-error" role="alert">{loadError}</p>}
    {loading && <p className="market-comments-loading" role="status"><Loader2 size={16} className="spin"/>Loading comments…</p>}
    {(cursor || loadError) && <button className="activity-load-more" disabled={loading} onClick={() => void load(cursor)}>{cursor ? "Load more" : "Retry"}</button>}
  </section>;
}
