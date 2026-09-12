import { CircleHelp, Compass, Gift, Menu, Plus, Search, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";
import { AquaMark } from "./AquaMark";
import { SearchModal } from "./SearchModal";

const links = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/create", label: "Launch", icon: Plus },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/how-it-works", label: "How it works", icon: CircleHelp },
];

export function Layout({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const { config, error } = useRuntime();
  const [mobile, setMobile] = useState(false);
  const [opening, setOpening] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const short = wallet.address ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : "";
  const isPreview = config.useTestnet || !config.transactionsEnabled;
  const xUrl = window.AQUA_CONFIG?.X_URL?.trim() || "https://x.com";

  useEffect(() => {
    const fallback = window.setTimeout(() => setOpening(false), 2600);
    return () => window.clearTimeout(fallback);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const openWithShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (wallet.modalOpen || searchOpen || event.key !== "/" || target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", openWithShortcut);
    return () => window.removeEventListener("keydown", openWithShortcut);
  }, [searchOpen, wallet.modalOpen]);

  return <div className="app-shell">
    {opening && <div className="opening-reveal" aria-hidden="true">
      <div className="opening-reveal-water" onAnimationEnd={(event) => { if (event.currentTarget === event.target) setOpening(false); }}>
        <div className="opening-mark"><AquaMark /></div>
        <div className="opening-bubbles"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      </div>
    </div>}
    {isPreview && <div className="environment-bar"><span>{config.useTestnet ? "DEVNET PREVIEW" : "TRANSACTIONS PAUSED"}</span><p>{config.useTestnet ? "No live funds are used." : "The live program is not currently accepting transactions."}</p></div>}
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="AQUA home"><AquaMark /><b>AQUA</b></NavLink>
        <nav aria-label="Primary navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === "/"}>{link.label}</NavLink>)}</nav>
        <div className="header-actions">
          <button className="header-search" onClick={() => { setMobile(false); setSearchOpen(true); }} aria-label="Search AQUA markets"><Search size={17}/><span>Search coins, stocks...</span><kbd>/</kbd></button>
          {wallet.address ? <button className="wallet-button connected" onClick={() => void wallet.disconnect()}><span>{short}</span></button> : <button className="wallet-button" onClick={() => wallet.setModalOpen(true)}><span>Connect wallet</span></button>}
          <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle navigation" aria-expanded={mobile}>{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMobile(false)}>{link.label}</NavLink>)}</nav>}
    </header>
    {error && <div className="system-banner"><b>Backend unavailable</b><span>Live data could not be loaded. Actions remain disabled until the connection recovers.</span></div>}
    {children}
    <footer className="site-footer">
      <small>© {new Date().getFullYear()} AQUA. All rights reserved.</small>
      <nav aria-label="Legal navigation"><NavLink to="/terms">Terms of Service</NavLink><NavLink to="/privacy">Privacy Policy</NavLink></nav>
      <div className="footer-socials">
        <a href={xUrl} target="_blank" rel="noreferrer" aria-label="AQUA on X" title="AQUA on X"><XBrandIcon/></a>
        <a href="https://www.orca.so/" target="_blank" rel="noreferrer" aria-label="Visit Orca" title="Orca"><OrcaIcon/></a>
      </div>
    </footer>
    <nav className="bottom-nav" aria-label="Mobile navigation">{links.map((link) => { const Icon = link.icon; return <NavLink key={link.to} to={link.to} end={link.to === "/"}><Icon size={18} />{link.label}</NavLink>; })}</nav>
    <WalletModal />
    <SearchModal open={searchOpen} onClose={closeSearch}/>
  </div>;
}

function XBrandIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h3.7l3.9 5.2 4.6-5.2h1.7l-5.5 6.4 5.9 8.6h-3.7l-4.3-5.8-5.1 5.8H4.5l6-7L5 4.5Zm3 1.4 8.3 12.2h1.1L9.1 5.9H8Z"/></svg>;
}

function OrcaIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 14.3c1.7-4.8 5.2-7.8 10.1-7.8 2.7 0 4.7 1 5.9 2.7-2.3-.6-4 .1-5.2 2.1 2.2.1 3.8 1 4.8 2.7-2.8-.5-4.8.1-6.2 1.7-1.7 2-4 3-6.9 2.8 1.7-1 2.8-2.2 3.1-3.7-1.8.7-3.7.5-5.6-.5Zm7.4-3.6c.8.1 1.5.5 1.9 1.2-.9.3-1.7.2-2.4-.4.1-.3.3-.6.5-.8Z"/></svg>;
}
