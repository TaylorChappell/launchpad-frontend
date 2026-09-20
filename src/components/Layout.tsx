import { ArrowRight, BarChart3, CircleHelp, Compass, ExternalLink, Gamepad2, Gift, Globe2, Image as ImageIcon, Menu, PanelsTopLeft, Plus, Search, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";
import { AquaMark } from "./AquaMark";
import { SearchModal } from "./SearchModal";
import { OrcaMark } from "./OrcaMark";
import { Notifications } from "./Notifications";
import { WalletMenu } from "./WalletMenu";

const links = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/create", label: "Launch", icon: Plus },
  { to: "/studio", label: "Studio", icon: PanelsTopLeft },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/how-it-works", label: "How it works", icon: CircleHelp },
];
const bottomLinks = links.filter((link) => link.to !== "/how-it-works");
const COMMUNITY_UPDATE_KEY = "aqua:update:atlantis-launch-v1";
const COMMUNITY_POST_URL = "https://x.com/Aqua_Launchpad/status/2100283826693922893";

export function Layout({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const currentPath = useLocation().pathname;
  const trading = currentPath.startsWith("/token/") || currentPath.startsWith("/studio");
  const updatePage = currentPath.startsWith("/updates/");
  const { config, error } = useRuntime();
  const [mobile, setMobile] = useState(false);
  const [opening, setOpening] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCommunityUpdate, setShowCommunityUpdate] = useState(false);
  const isPreview = config.useTestnet || !config.transactionsEnabled;
  const xUrl = window.AQUA_CONFIG?.X_URL?.trim() || "https://x.com/Aqua_Launchpad";

  useEffect(() => {
    const fallback = window.setTimeout(() => setOpening(false), 2300);
    return () => window.clearTimeout(fallback);
  }, []);

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
          {wallet.address && <Notifications key={wallet.address} wallet={wallet.address}/>}
          <WalletMenu/>
          <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle navigation" aria-expanded={mobile}>{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMobile(false)}>{link.label}</NavLink>)}</nav>}
    </header>
    {!trading && !updatePage && <a className="community-reward-banner" href={COMMUNITY_POST_URL} target="_blank" rel="noreferrer">
      <CampaignBannerArt/>
      <span className="community-reward-banner-copy"><small>LAUNCH ON AQUA COMMUNITY PROGRAM</small><strong><em>$2,500</em> IN LAUNCH REWARDS</strong><span>Community and builder milestones are now live.</span></span>
      <span className="community-reward-prizes"><b>$1,250</b><i/> <b>$750</b><i/> <b>$500</b></span>
      <span className="community-reward-link">VIEW PROGRAM <ExternalLink/></span>
    </a>}
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
    {showCommunityUpdate && <div className="community-update-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowCommunityUpdate(false); }}>
      <section className="community-update-flash atlantis-launch-update" role="dialog" aria-modal="true" aria-labelledby="community-update-title" aria-describedby="community-update-description">
        <button className="community-update-close" aria-label="Close update" onClick={() => setShowCommunityUpdate(false)}><X/></button>
        <AtlantisLaunchArt/>
        <div className="community-update-copy"><small>NOW LIVE · 24 HOURS FREE</small><h2 id="community-update-title">Introducing Atlantis Studio.</h2><p id="community-update-description">Aqua&apos;s all-in-one creation toolbox lets you build the experience around your token without leaving the launchpad.</p></div>
        <div className="community-update-features">
          <article><i><Globe2/></i><span><b>Websites and apps</b><small>Build a complete home for your token, from a landing page to a richer community app.</small></span></article>
          <article><i><Gamepad2/></i><span><b>Mini-games and generators</b><small>Create interactive ideas, meme generators and experiences your community can share.</small></span></article>
          <article><i><ImageIcon/></i><span><b>Artwork, code and assets together</b><small>Develop the identity and the experience in one Aqua workspace, then export your work.</small></span></article>
        </div>
        <p className="community-update-eligibility"><b>Launch your token. Build the experience around it. Grow your community.</b> Atlantis Studio is free for the first 24 hours of launch.</p>
        <footer><NavLink to="/updates/atlantis-free" onClick={() => setShowCommunityUpdate(false)}>READ THE UPDATE <ArrowRight/></NavLink><NavLink to="/studio" onClick={() => setShowCommunityUpdate(false)}>OPEN ATLANTIS STUDIO <ArrowRight/></NavLink></footer>
      </section>
    </div>}
    <nav className="bottom-nav" aria-label="Mobile navigation">{bottomLinks.map((link) => { const Icon = link.icon; return <NavLink key={link.to} to={link.to} end={link.to === "/"}><Icon size={18} />{link.label}</NavLink>; })}</nav>
    <WalletModal />
    <SearchModal open={searchOpen} onClose={closeSearch}/>
  </div>;
}

function CampaignBannerArt() {
  return <svg className="campaign-banner-art" viewBox="0 0 104 64" aria-hidden="true"><defs><linearGradient id="campaign-water" x1="14" y1="5" x2="64" y2="59"><stop stopColor="#9fe7ff"/><stop offset=".52" stopColor="#2bacef"/><stop offset="1" stopColor="#0870c9"/></linearGradient><linearGradient id="campaign-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe7a0"/><stop offset="1" stopColor="#d99b16"/></linearGradient></defs><path d="M37 5C29 17 19 28 19 40a18 18 0 1 0 36 0C55 28 45 17 37 5Z" fill="url(#campaign-water)"/><path d="M29 28c2-5 5-9 8-13" fill="none" stroke="#fff" strokeOpacity=".62" strokeWidth="3" strokeLinecap="round"/><path d="M69 15h22v8c0 8-4 13-11 14v7h7v5H68v-5h7v-7c-7-1-11-6-11-14v-8h5Zm0 6v2c0 4 2 7 6 8V21h-6Zm17 0h-6v10c4-1 6-4 6-8v-2Z" fill="url(#campaign-gold)"/><circle cx="92" cy="48" r="7" fill="#ffe7a0"/><path d="m90 48 2 2 4-5" fill="none" stroke="#9b6710" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function AtlantisLaunchArt() {
  return <div className="atlantis-launch-art" aria-hidden="true">
    <div className="atlantis-launch-orbit"><i/><i/><i/></div>
    <span className="atlantis-launch-mark"><AquaMark/></span>
    <div><small>ATLANTIS</small><b>STUDIO</b></div>
    <div className="atlantis-launch-tools"><Globe2/><Gamepad2/><ImageIcon/><PanelsTopLeft/></div>
  </div>;
}

function XBrandIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h3.7l3.9 5.2 4.6-5.2h1.7l-5.5 6.4 5.9 8.6h-3.7l-4.3-5.8-5.1 5.8H4.5l6-7L5 4.5Zm3 1.4 8.3 12.2h1.1L9.1 5.9H8Z"/></svg>;
}
