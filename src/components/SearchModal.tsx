import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Launch } from "../types";
import { TokenMark } from "./TokenCard";

const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setState("loading");
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') ?? []);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setState("loading");
    const timer = window.setTimeout(() => {
      api.search(query,controller.signal).then(data => {if(!controller.signal.aborted){setLaunches(data.launches);setState("ready");}}).catch(()=>{if(!controller.signal.aborted)setState("offline");});
    },200);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[open,query]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return launches
      .filter((launch) => launch.status === "live")
      .filter((launch) => !term || [launch.name, launch.symbol, launch.stockSymbol, launch.stockName, launch.mint, launch.creatorWallet]
        .some((value) => String(value ?? "").toLowerCase().includes(term)))
      .sort((a, b) => Number(b.volume24hUsd || 0) - Number(a.volume24hUsd || 0))
      .slice(0, 7);
  }, [launches, query]);

  function selectMarket(launch: Launch) {
    onClose();
    navigate(`/token/${launch.id}`);
  }

  if (!open) return null;
  return <div className="aqua-search-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title">
      <button className="modal-close" onClick={onClose} aria-label="Close search"><X size={17}/></button>
      <header className="search-modal-heading"><h2 id="search-title">Search AQUA</h2><p>Find a market by coin, asset or wallet.</p></header>
      <label className="search-modal-input">
        <Search size={18}/>
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Coin, ticker, stock, or wallet" aria-label="Search AQUA markets"/>
        <kbd>/</kbd>
      </label>
      <div className="search-results-heading"><b>{query.trim() ? "Search results" : "Popular markets"}</b>{state === "ready" && <span>{results.length} shown</span>}</div>
      <div className="search-results" aria-live="polite">
        {state === "loading" && [0, 1, 2, 3, 4].map((item) => <div className="search-result-skeleton" key={item}><i/><span/><b/></div>)}
        {state === "offline" && <div className="search-modal-empty"><Search/><b>Search is unavailable</b><span>AQUA could not reach the market index.</span></div>}
        {state === "ready" && results.map((launch) => <button className="search-result" key={launch.id} onClick={() => selectMarket(launch)}>
          <TokenMark launch={launch}/>
          <span className="search-result-main">
            <span className="search-result-name"><b>{launch.name}</b><small>${launch.symbol}</small></span>
            <span className="search-result-tags"><em>{launch.symbol} / {launch.pairSymbol}</em><em className="reward-tag">{launch.rewardMode === "buyback_burn" ? "Buyback & burn" : launch.rewardMode === "jackpot" ? "SOL jackpot" : `${launch.stockSymbol} rewards`}</em></span>
          </span>
          <span className="search-result-value"><b>{launch.aquaIndexed ? compactMoney.format(launch.marketCapUsd) : "Indexing"}</b><small>market cap</small></span>
        </button>)}
        {state === "ready" && !results.length && <div className="search-modal-empty"><Search/><b>No matching markets</b><span>Try a coin name, ticker, stock, mint, or wallet.</span></div>}
      </div>
    </section>
  </div>;
}
