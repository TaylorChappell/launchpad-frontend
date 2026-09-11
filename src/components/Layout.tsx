import { CircleHelp, Compass, Gift, Menu, Plus, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";
import { AquaMark } from "./AquaMark";

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
  const isPreview = config.useTestnet || !config.transactionsEnabled;

  return <div className="app-shell">
    {isPreview && <div className="environment-bar"><span>{config.useTestnet ? "DEVNET PREVIEW" : "TRANSACTIONS PAUSED"}</span><p>{config.useTestnet ? "No live funds. Market examples are clearly labeled." : "The live program is not currently accepting transactions."}</p></div>}
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="AQUA home"><AquaMark /><b>AQUA</b></NavLink>
        <nav aria-label="Primary navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === "/"}>{link.label}</NavLink>)}</nav>
        <div className="header-actions">
          {wallet.address ? <button className="wallet-button connected" onClick={() => void wallet.disconnect()}>{short}</button> : <button className="wallet-button" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>}
          <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle navigation" aria-expanded={mobile}>{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMobile(false)}>{link.label}</NavLink>)}</nav>}
    </header>
    {error && <div className="system-banner"><b>Backend unavailable</b><span>Live data could not be loaded. Actions remain disabled until the connection recovers.</span></div>}
    {children}
    <footer className="site-footer">
      <div><NavLink to="/" className="brand"><AquaMark compact /><b>AQUA</b></NavLink><p>The launchpad for coins that build tokenized stock rewards for their holders.</p></div>
      <nav aria-label="Footer navigation">{links.map((link) => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</nav>
      <small>Tokenized stocks are regulated products and may be restricted in your jurisdiction. Verify every transaction before signing.</small>
    </footer>
    <nav className="bottom-nav" aria-label="Mobile navigation">{links.map((link) => { const Icon = link.icon; return <NavLink key={link.to} to={link.to} end={link.to === "/"}><Icon size={18} />{link.label}</NavLink>; })}</nav>
    <WalletModal />
  </div>;
}
