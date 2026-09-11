import { CircleHelp, Compass, Gift, Menu, Plus, Waves, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";

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
  const short = wallet.address ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : "";

  return <div className="app-shell">
    <header className="header-wrap">
      <div className="header">
        <NavLink to="/" className="brand"><span><Waves size={19} /></span><b>Equity Launch</b></NavLink>
        <nav>{links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === "/"}>{link.label}</NavLink>)}</nav>
        <div className="header-actions">
          <span className={`network-pill ${config.useTestnet ? "testnet" : "mainnet"}`}><i />{config.useTestnet ? "DEVNET" : "MAINNET"}</span>
          {wallet.address ? <button className="wallet-button connected" onClick={() => void wallet.disconnect()}>{short}</button> : <button className="wallet-button" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>}
          <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle navigation">{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile && <nav className="mobile-nav">{links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMobile(false)}>{link.label}</NavLink>)}</nav>}
    </header>
    {error && <div className="api-error">Backend connection issue: {error}. Preview markets are still available.</div>}
    {children}
    <footer className="site-footer"><div><NavLink to="/" className="brand"><span><Waves size={18} /></span><b>Equity Launch</b></NavLink><p>Community markets with transparent curves, Orca liquidity and optional tokenized stock rewards.</p></div><nav>{links.map((link) => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</nav><small>Built on Solana. Tokenized stocks may be restricted in your jurisdiction.</small></footer>
    <nav className="bottom-nav">{links.map((link) => { const Icon = link.icon; return <NavLink key={link.to} to={link.to} end={link.to === "/"}><Icon size={18} />{link.label}</NavLink>; })}</nav>
    <WalletModal />
  </div>;
}

