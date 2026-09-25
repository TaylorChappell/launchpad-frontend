import { XConnect } from "./XConnect";
import { Compass, Menu, PanelsTopLeft, Plus, Search, X, WalletCards, ChevronDown } from "lucide-react";
import { StudioAnnouncement } from "./StudioAnnouncement";
import { NavLink, useLocation } from "react-router-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";
import { AquaMark } from "./AquaMark";
import { SearchModal } from "./SearchModal";
import { OrcaMark } from "./OrcaMark";
import { Notifications } from "./Notifications";
import { WalletMenu } from "./WalletMenu";
import { createPortal } from "react-dom";
import { useDialog } from "./useDialog";

const links = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/create", label: "Launch", icon: Plus },
  { to: "/studio", label: "Atlantis Studio", icon: PanelsTopLeft },
  { to: "/portfolio", label: "My holdings", icon: WalletCards },
];
const bottomLinks = links.map(link => ({ ...link, label: link.to === "/studio" ? "Studio" : link.to === "/portfolio" ? "Portfolio" : link.label }));
const moreLinks = [
  { to: "/boost", label: "Community Boost" },
  { to: "/promotions", label: "Promotions" },
  { to: "/analytics", label: "Analytics" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/developers", label: "Developers" },
];
const COMMUNITY_UPDATE_KEY = "aqua:update:holder-workspace-v2";

export function Layout({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const currentPath = useLocation().pathname;
  const trading = currentPath.startsWith("/token/") || currentPath.startsWith("/studio");
  const { config, error, loading } = useRuntime();
  const [mobile, setMobile] = useState(false);
  const header = useRef<HTMLElement>(null);
  const moreMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { document.documentElement.dataset.theme = "light"; }, []);
  useEffect(() => { if (moreMenu.current) moreMenu.current.open = false; setMobile(false); }, [currentPath]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPath]);
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      root.style.setProperty("--aqua-header-height", `${header.current?.getBoundingClientRect().height ?? 64}px`);
      root.style.setProperty("--aqua-viewport-height", `${window.visualViewport?.height ?? window.innerHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    if (header.current) observer.observe(header.current);
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener("resize", measure); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const close = () => { if (desktop.matches) setMobile(false); };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (moreMenu.current && !moreMenu.current.contains(event.target as Node)) moreMenu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && moreMenu.current?.open) { moreMenu.current.open = false; moreMenu.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCommunityUpdate, setShowCommunityUpdate] = useState(false);
  const isPreview = !loading && (config.useTestnet || !config.transactionsEnabled);
  const xUrl = window.AQUA_CONFIG?.X_URL?.trim() || "https://x.com/Aqua_Launchpad";


  useEffect(() => {
    try {
      if (window.localStorage.getItem(COMMUNITY_UPDATE_KEY)) return;
      window.localStorage.setItem(COMMUNITY_UPDATE_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable in strict privacy modes. The in-memory state still prevents repeats this session.
    }
    setShowCommunityUpdate(true);
  }, []);

  useEffect(() => {
    if (!showCommunityUpdate) return;
    const closeUpdate = (event: KeyboardEvent) => { if (event.key === "Escape") setShowCommunityUpdate(false); };
    window.addEventListener("keydown", closeUpdate);
    return () => window.removeEventListener("keydown", closeUpdate);
  }, [showCommunityUpdate]);

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

  return <div className={`app-shell ${trading ? "trading-shell" : ""} ${currentPath.startsWith("/studio")?"studio-shell":""}`}>
    {isPreview && <div className="environment-bar"><span>{config.useTestnet ? "DEVNET PREVIEW" : "TRANSACTIONS PAUSED"}</span><p>{config.useTestnet ? "No live funds are used." : "The live program is not currently accepting transactions."}</p></div>}
    <header className="site-header" ref={header}>
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="AQUA home"><AquaMark /><b>AQUA</b></NavLink>
        <nav aria-label="Primary navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === "/"}>{link.label}</NavLink>)}<details className="site-more" ref={moreMenu}><summary>More <ChevronDown size={13}/></summary><div className="site-more-panel">{moreLinks.map(link => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</div></details></nav>
        <div className="header-actions">
          <button className="header-search" onClick={() => { setMobile(false); setSearchOpen(true); }} aria-label="Search AQUA markets"><Search size={17}/><span>Search coins, stocks...</span><kbd>/</kbd></button>
          {wallet.address && <Notifications key={wallet.address} wallet={wallet.address}/>}
          <WalletMenu/><XConnect/>
          <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle navigation" aria-expanded={mobile} aria-controls="mobile-navigation">{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
    {error && <div className="system-banner"><b>Backend unavailable</b><span>Live data could not be loaded. Actions remain disabled until the connection recovers.</span></div>}
    {children}
    <footer className="site-footer">
      <small>© {new Date().getFullYear()} AQUA. All rights reserved.</small>
      <nav aria-label="Footer navigation"><NavLink to="/how-it-works">How it works</NavLink><NavLink to="/developers">API</NavLink><NavLink to="/terms">Terms of Service</NavLink><NavLink to="/privacy">Privacy Policy</NavLink>{wallet.address === config.adminWallet && <NavLink to="/admin">Admin</NavLink>}</nav>
      <div className="footer-socials">
        <a href={xUrl} target="_blank" rel="noreferrer" aria-label="AQUA on X" title="AQUA on X"><XBrandIcon/></a>
        <a href="https://www.orca.so/" target="_blank" rel="noreferrer" aria-label="Visit Orca" title="Orca"><OrcaMark/></a>
      </div>
    </footer>
    {showCommunityUpdate && <StudioAnnouncement onClose={()=>setShowCommunityUpdate(false)}/>}
    <nav className="bottom-nav" aria-label="Mobile navigation">{bottomLinks.map((link) => { const Icon = link.icon; return <NavLink key={link.to} to={link.to} end={link.to === "/"}><Icon size={20} /><span>{link.label}</span></NavLink>; })}<button aria-label="More navigation" aria-expanded={mobile} aria-controls="mobile-navigation" onClick={()=>setMobile(true)} className={moreLinks.some(link=>link.to===currentPath)?"active":""}><Menu size={20}/><span>More</span></button></nav>
    {mobile && <MobileNavigation onClose={()=>setMobile(false)} onSearch={()=>{setMobile(false);setSearchOpen(true);}}/>}
    <WalletModal />
    <SearchModal open={searchOpen} onClose={closeSearch}/>
  </div>;
}

function MobileNavigation({onClose,onSearch}:{onClose:()=>void;onSearch:()=>void}) {
  const dialog=useDialog(true,onClose);
  return createPortal(<div className="mobile-navigation-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section id="mobile-navigation" className="mobile-navigation-sheet" role="dialog" aria-modal="true" aria-label="Navigate AQUA" ref={dialog}>
      <header><div><small>AQUA</small><h2>Where to next?</h2></div><button onClick={onClose} aria-label="Close navigation"><X size={22}/></button></header>
      <button className="mobile-navigation-search" onClick={onSearch}><Search size={19}/>Search coins, tickers or addresses</button>
      <nav aria-label="All pages">{[...links,...moreLinks].map(link=><NavLink key={link.to} to={link.to} end={link.to==="/"} onClick={onClose}>{link.label}</NavLink>)}</nav>
      <footer><NavLink to="/claim-by-address" onClick={onClose}>Claim by address</NavLink><NavLink to="/how-it-works" onClick={onClose}>Help &amp; how it works</NavLink></footer>
    </section>
  </div>,document.body);
}

function XBrandIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h3.7l3.9 5.2 4.6-5.2h1.7l-5.5 6.4 5.9 8.6h-3.7l-4.3-5.8-5.1 5.8H4.5l6-7L5 4.5Zm3 1.4 8.3 12.2h1.1L9.1 5.9H8Z"/></svg>;
}
