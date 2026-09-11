import { BarChart3, Gift, Menu, Plus, Search, WalletCards, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useRuntime, useWallet } from "../context";
import { WalletModal } from "./WalletModal";

const links = [{ to:"/", label:"Markets", icon:BarChart3 },{ to:"/create",label:"Launch",icon:Plus },{ to:"/portfolio",label:"Portfolio",icon:WalletCards },{ to:"/rewards",label:"Rewards",icon:Gift }];
export function Layout({ children }: { children: ReactNode }) {
  const wallet = useWallet(); const { config, error } = useRuntime(); const [mobile, setMobile] = useState(false);
  const short = wallet.address ? `${wallet.address.slice(0,4)}…${wallet.address.slice(-4)}` : "";
  return <div className="app-shell">
    <header className="header"><NavLink to="/" className="brand"><span>EL</span><b>Equity Launch</b></NavLink><nav>{links.map((link)=><NavLink key={link.to} to={link.to} end={link.to==="/"}>{link.label}</NavLink>)}</nav><div className="header-search"><Search size={15}/>Search token or mint</div><span className={`network-pill ${config.useTestnet?"testnet":"mainnet"}`}>{config.useTestnet?"DEVNET":"MAINNET"}</span>{wallet.address?<button className="wallet-button connected" onClick={() => void wallet.disconnect()}>{short}</button>:<button className="wallet-button" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>}<button className="mobile-menu" onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button></header>
    {error && <div className="api-error">Backend offline: {error}. Showing preview data.</div>}
    {mobile && <nav className="mobile-nav">{links.map((link)=><NavLink key={link.to} to={link.to} onClick={()=>setMobile(false)}>{link.label}</NavLink>)}</nav>}
    {children}
    <nav className="bottom-nav">{links.map((link)=>{const Icon=link.icon;return <NavLink key={link.to} to={link.to} end={link.to==="/"}><Icon size={18}/>{link.label}</NavLink>})}</nav>
    <WalletModal />
  </div>;
}
