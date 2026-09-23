import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Reply, X } from "lucide-react";
import { savedAccountSession } from "../account-api";
import { commentsApi } from "../market-comments-api";
import { mergeComments, type MarketComment, type CommentReference } from "../market-comments";
import { useWallet } from "../context";
import type { Launch } from "../types";
import { buybackAge } from "../time";
import { WalletIdentity } from "./WalletIdentity";
import { CommentAvatar } from "./CommentAvatar";
import "./market-comments.css";

export function MarketComments({ launch, onRead }: { launch: Launch; onRead?: (comment: MarketComment) => void }) {
  const wallet = useWallet();
  return <CommentList key={launch.id + ":" + (wallet.address ?? "visitor")} launch={launch} onRead={onRead}/>;
}

function CommentList({ launch, onRead }: { launch: Launch; onRead?: (comment: MarketComment) => void }) {
  const wallet = useWallet();
  const [session, setSession] = useState(() => savedAccountSession(wallet.address));
  const [comments, setComments] = useState<MarketComment[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [body, setBody] = useState(""), [posting, setPosting] = useState(false), [postError, setPostError] = useState("");
  const [reply, setReply] = useState<CommentReference | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null), previousAddress = useRef(wallet.address);
  const alive = useRef(false), reading = useRef<AbortController | null>(null), postingRef = useRef(false);
  const address = useRef(wallet.address), draft = useRef<{ id: string; body: string; wallet: string; replyTo: string | null } | null>(null);
  address.current = wallet.address;

  async function load(before: string | null = null) {
    if (reading.current) return;
    const controller = new AbortController(); reading.current = controller;
    setLoading(true); setLoadError("");
    try {
      const result = await commentsApi.list(launch.id, before, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setComments(current => before ? mergeComments(current, result.comments) : result.comments);
      setCursor(result.nextCursor); setLoaded(true);
      if (!before && result.comments[0] && document.visibilityState === "visible") onRead?.(result.comments[0]);
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
  useEffect(() => {
    if (previousAddress.current && previousAddress.current !== wallet.address) { setBody(""); setReply(null); }
    previousAddress.current = wallet.address; setPostError(""); draft.current = null;
  }, [wallet.address]);
  useEffect(() => {
    const field = textarea.current;
    if (field) { field.style.height = "auto"; field.style.height = Math.min(field.scrollHeight, 180) + "px"; }
  }, [body, session, wallet.address]);
  function startReply(comment: MarketComment) {
    setReply({ id: comment.id, authorWallet: comment.authorWallet, body: comment.body.slice(0, 200) });
    if (!savedAccountSession(wallet.address)) { wallet.setModalOpen(true); return; }
    textarea.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    textarea.current?.focus({ preventScroll: true });
  }
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
    if (!author || !text || text.length > 1000 || postingRef.current || reading.current || launch.status !== "live") return;
    const replyTo = reply?.id ?? null;
    if (draft.current?.body !== text || draft.current.wallet !== author || draft.current.replyTo !== replyTo)
      draft.current = { id: crypto.randomUUID(), body: text, wallet: author, replyTo };
    const submission = { id: draft.current.id, body: text, replyTo };
    postingRef.current = true; setPosting(true); setPostError("");
    try {
      const token = savedAccountSession(author);
      if (!token) { setSession(null); return; }
      if (!alive.current || address.current !== author) return;
      const { comment } = await commentsApi.publish(launch.id, author, token, submission);
      if (!alive.current) return;
      setComments(current => mergeComments(current, [comment]));
      void load();
      if (address.current === author) { setBody(""); setReply(null); draft.current = null; }
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
    <header className="market-comments-heading"><h2 id="market-comments-heading">Comments</h2><div><span>Newest first</span><button className="comment-refresh" aria-label="Refresh comments" title="Refresh comments" disabled={loading || posting} onClick={() => void load()}><RefreshCw size={14} className={loading ? "spin" : ""}/></button></div></header>
    {launch.status !== "live" ? <p className="market-comments-empty">Comments open once this coin launches.</p> : wallet.address && session ?
      <form className="market-comment-composer" onSubmit={event => { event.preventDefault(); void publish(); }}>
        <CommentAvatar wallet={wallet.address}/><div className="comment-compose-content">
        {reply && <div className="comment-reply-draft"><span>Replying to <WalletIdentity wallet={reply.authorWallet} avatar={false} explorer={false}/></span><button type="button" disabled={posting} onClick={() => setReply(null)} aria-label="Cancel reply"><X size={13}/></button></div>}
        <label className="sr-only" htmlFor="market-comment-body">Your comment</label>
        <textarea ref={textarea} id="market-comment-body" value={body} maxLength={1000} rows={1} disabled={posting}
          placeholder={reply ? "Write a reply…" : "Add a comment…"} onChange={event => setBody(event.target.value)}
          onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void publish(); } }}/>
        <footer><span>{body.length > 0 ? `${body.length.toLocaleString()}/1,000` : ""}</span><button className="primary" type="submit" disabled={posting || loading || !body.trim()}>
          {posting && <Loader2 size={15} className="spin"/>}{posting ? "Posting…" : "Post comment"}
        </button></footer>
        {postError && <p className="market-comments-error" role="alert">{postError}</p>}
        </div>
      </form> : <div className="market-comments-connect"><p>{wallet.address ? "Reconnect your wallet to join the conversation." : "Connect your wallet to join the conversation."}</p><button className="soft-button" onClick={() => wallet.setModalOpen(true)}>{wallet.address ? "Reconnect wallet" : "Connect wallet"}</button></div>}
    <div className="market-comment-feed">{comments.map(comment => <article className="market-comment" key={comment.id}>
      <CommentAvatar wallet={comment.authorWallet}/><div className="market-comment-content">
      <header><WalletIdentity wallet={comment.authorWallet} avatar={false} explorer={false}/>{comment.authorWallet === launch.creatorWallet && <span className="market-comment-creator">dev</span>}
        <time dateTime={new Date(comment.createdAt).toISOString()} title={new Date(comment.createdAt).toLocaleString()}>{buybackAge(comment.createdAt)}</time>
      </header>{comment.reply && <blockquote className="comment-reference"><span>Replying to <WalletIdentity wallet={comment.reply.authorWallet} avatar={false} explorer={false}/></span><p>{comment.reply.body}</p></blockquote>}
      <CommentBody body={comment.body}/><button className="comment-reply-action" disabled={posting} onClick={() => startReply(comment)}><Reply size={13}/>Reply</button>
      </div>
    </article>)}</div>
    {loaded && !comments.length && !loading && <p className="market-comments-empty">No comments yet. Start the conversation.</p>}
    {loadError && <p className="market-comments-error" role="alert">{loadError}</p>}
    {loading && <p className="market-comments-loading" role="status"><Loader2 size={16} className="spin"/>Loading comments…</p>}
    {(cursor || loadError) && <button className="activity-load-more" disabled={loading} onClick={() => void load(cursor)}>{cursor ? "Load more" : "Retry"}</button>}
  </section>;
}

function CommentBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = body.length > 360 || body.split("\n").length > 6;
  const preview = body.slice(0, 360).split("\n").slice(0, 6).join("\n").trimEnd();
  return <><p className="comment-text">{long && !expanded ? preview + "…" : body}</p>{long && <button className="comment-expand" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? "Show less" : "Read more"}</button>}</>;
}
