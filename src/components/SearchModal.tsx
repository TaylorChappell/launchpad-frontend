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
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timeout = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setQuery("");
    setState("loading");
    api.launches()
      .then((data) => {
        if (!active) return;
        setLaunches(data.launches);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("offline");
      });
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 720);
    return () => {
      active = false;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mounted, onClose]);

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

  if (!mounted) return null;
  return <div className={`wallet-overlay wallet-connect-overlay aqua-search-overlay ${closing ? "closing" : ""}`} role="presentation" onMouseDown={onClose}>
    <div className="wallet-transition-wave" aria-hidden="true"/>
    <div className="wallet-transition-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <section className="wallet-modal search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close search"><X size={17}/></button>
      <header className="search-modal-heading"><h2 id="search-title">Search AQUA</h2><p>Find a coin or its tokenized stock reward.</p></header>
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
            <span className="search-result-tags"><em>{launch.symbol} / {launch.pairSymbol}</em>{launch.stockSymbol && <em className="reward-tag">{launch.stockSymbol} rewards</em>}</span>
          </span>
          <span className="search-result-value"><b>{launch.aquaIndexed ? compactMoney.format(launch.marketCapUsd) : "Indexing"}</b><small>market cap</small></span>
        </button>)}
        {state === "ready" && !results.length && <div className="search-modal-empty"><Search/><b>No matching markets</b><span>Try a coin name, ticker, stock, mint, or wallet.</span></div>}
      </div>
    </section>
  </div>;
}
