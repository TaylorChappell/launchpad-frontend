import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronDown, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { DexScreenerIcon } from "./DexScreenerIcon";
import { api } from "../api";
import type { WalletNotification } from "../types";
import { formatJackpotAmount } from "../jackpot-format";
import "./notifications.css";

export function Notifications({ wallet }: { wallet: string }) {
  const storageKey = `aqua:notifications:read:${wallet}`;
  const [read, setRead] = useState<string[]>(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
  });
  const [items, setItems] = useState<WalletNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(5);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const unread = items.filter(item => !read.includes(item.id)).length;

  useEffect(() => {
    let active = true, pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try { const result = await api.notifications(wallet); if (active) { setItems(result.notifications); setError(false); } }
      catch { if (active) setError(true); }
      finally { pending = false; if (active) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [wallet]);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    setVisible(5);
    closeButton.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("pointerdown", outside); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", outside); window.removeEventListener("keydown", escape); };
  }, [open]);
  const markRead = (ids: string[]) => setRead(previous => {
    const next = [...new Set([...previous, ...ids])].slice(-1000);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the read state for this session. */ }
    return next;
  });

  return <div className="notification-menu" ref={root}>
    <button className={`notification-trigger ${unread ? "has-unread" : ""}`} ref={trigger} aria-label={`Notifications, ${unread} unread`} aria-expanded={open} aria-controls="wallet-notifications" onClick={() => setOpen(value => !value)}>
      <Bell size={19}/>{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section id="wallet-notifications" className="notification-panel" aria-label="Wallet notifications">
      <header><div><h2>Notifications</h2><small>{unread ? `${unread} unread` : "You're all caught up"}</small></div><button ref={closeButton} aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={17}/></button></header>
      {unread > 0 && <button className="notification-read-all" onClick={() => markRead(items.map(item => item.id))}><CheckCheck size={15}/>Mark all as read</button>}
      {error && <p className="notification-message" role="status">Notifications couldn't refresh. We'll retry shortly.</p>}
      <div className="notification-list">
        {loading ? <p className="notification-message">Loading notifications…</p> : !items.length && !error ? <div className="notification-empty"><Bell size={26}/><b>Nothing new yet</b><p>Your jackpot wins, takeover proposals and DEX requests will appear here.</p></div> : items.slice(0, visible).map(item => <article key={item.id} className={read.includes(item.id) ? "" : "unread"}>
          <div className="notification-item-heading"><span>{item.kind === "dex_details" && <DexScreenerIcon/>}{item.kind === "jackpot" ? "Jackpot" : item.kind === "cto" ? "Community takeover" : "DEX Screener"}</span><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>
          <h3>{item.title}</h3>
          {item.amountRaw != null && <strong className="notification-prize">{formatJackpotAmount(item.amountRaw, item.rewardDecimals ?? 9)} {item.rewardSymbol}<small>{item.claimed ? "Claimed" : "Unclaimed"}</small></strong>}
          <p>{item.message}</p>
          <div className="notification-item-actions"><Link to={item.kind === "jackpot" && !item.claimed ? "/rewards" : `/token/${item.launchId}`} onClick={() => { markRead([item.id]); setOpen(false); }}>{item.kind === "jackpot" && !item.claimed ? "View reward" : item.kind === "dex_details" ? "Submit details" : "View market"}</Link>{!read.includes(item.id) && <button onClick={() => markRead([item.id])}>Mark read</button>}</div>
        </article>)}
      </div>
      {visible < items.length && <button className="notification-load-more" onClick={() => setVisible(count => count + 5)}>Load more <ChevronDown size={14}/></button>}
    </section>}
  </div>;
}
