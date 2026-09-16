import { BarChart3, CircleHelp, Compass, Gift, Menu, Plus, Search, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";
import { AquaMark } from "./AquaMark";
import { SearchModal } from "./SearchModal";
import { OrcaMark } from "./OrcaMark";
import { WalletMenu } from "./WalletMenu";

const links = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/create", label: "Launch", icon: Plus },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/how-it-works", label: "How it works", icon: CircleHelp },
];
const bottomLinks = links.filter((link) => link.to !== "/how-it-works");

export function Layout({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const { config, error } = useRuntime();
  const [mobile, setMobile] = useState(false);
  const [opening, setOpening] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const isPreview = config.useTestnet || !config.transactionsEnabled;
  const xUrl = window.AQUA_CONFIG?.X_URL?.trim() || "https://x.com";

  useEffect(() => {
    const fallback = window.setTimeout(() => setOpening(false), 2300);
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
      <div className="opening-reveal-water" onAnimationEnd={(event) => {
        if (event.currentTarget === event.target && event.animationName === "opening-wave-down-slow") setOpening(false);
      }}>
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
          <WalletMenu/>
          <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle navigation" aria-expanded={mobile}>{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMobile(false)}>{link.label}</NavLink>)}</nav>}
    </header>
    {error && <div className="system-banner"><b>Backend unavailable</b><span>Live data could not be loaded. Actions remain disabled until the connection recovers.</span></div>}
    {children}
    <footer className="site-footer">
      <small>© {new Date().getFullYear()} AQUA. All rights reserved.</small>
      <nav aria-label="Footer navigation"><NavLink to="/how-it-works">How it works</NavLink><NavLink to="/terms">Terms of Service</NavLink><NavLink to="/privacy">Privacy Policy</NavLink>{wallet.address === config.adminWallet && <NavLink to="/admin">Admin</NavLink>}</nav>
      <div className="footer-socials">
        <a href={xUrl} target="_blank" rel="noreferrer" aria-label="AQUA on X" title="AQUA on X"><XBrandIcon/></a>
        <a href="https://www.orca.so/" target="_blank" rel="noreferrer" aria-label="Visit Orca" title="Orca"><OrcaMark/></a>
      </div>
    </footer>
    <nav className="bottom-nav" aria-label="Mobile navigation">{bottomLinks.map((link) => { const Icon = link.icon; return <NavLink key={link.to} to={link.to} end={link.to === "/"}><Icon size={18} />{link.label}</NavLink>; })}</nav>
    <WalletModal />
    <SearchModal open={searchOpen} onClose={closeSearch}/>
  </div>;
}

function XBrandIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h3.7l3.9 5.2 4.6-5.2h1.7l-5.5 6.4 5.9 8.6h-3.7l-4.3-5.8-5.1 5.8H4.5l6-7L5 4.5Zm3 1.4 8.3 12.2h1.1L9.1 5.9H8Z"/></svg>;
}
