import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, LogOut, Plus, Settings2, ShieldCheck, WalletCards } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { Launch } from "../types";
import { TokenMark } from "./TokenCard";

export function WalletMenu() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const location = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coins, setCoins] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(false);
  const address = wallet.address;
  const short = address ? address.slice(0, 4) + "…" + address.slice(-4) : "";

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!address) { setCoins([]); return; }
    let active = true;
    setLoading(true);
    api.launches().then(({ launches }) => {
      if (!active) return;
      setCoins(launches.filter((launch) => launch.creatorWallet === address).sort((a,b) => b.createdAt - a.createdAt));
    }).catch(() => { if (active) setCoins([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [address]);

  if (!address) return <button className="wallet-button" onClick={() => wallet.setModalOpen(true)}><span>Connect wallet</span></button>;

  return <div className="wallet-menu" ref={root}>
    <button className="wallet-button connected wallet-menu-trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}><span>{short}</span><ChevronDown size={14}/></button>
    {open && <div className="wallet-dropdown" role="menu">
      <header><div><small>Connected wallet</small><b>{short}</b></div><button aria-label="Copy wallet address" onClick={() => { void navigator.clipboard.writeText(address); toast.success("Wallet copied"); }}><Copy size={14}/></button></header>
      <section>
        <div className="wallet-dropdown-title"><span><WalletCards size={14}/>Your coins</span><b>{coins.length}</b></div>
        <div className="wallet-coins">
          {loading ? <small className="wallet-coins-empty">Loading your launches…</small> : coins.length ? coins.slice(0, 6).map((coin) => <Link key={coin.id} to={"/manage/" + coin.id} role="menuitem"><TokenMark launch={coin}/><span><b>{"$" + coin.symbol}</b><small>{coin.pairSymbol} market · {coin.status === "live" ? "Live" : "Launching"}</small></span><Settings2 size={14}/></Link>) : <small className="wallet-coins-empty">Coins launched by this wallet will appear here.</small>}
        </div>
      </section>
      <Link className="wallet-launch-link" to="/create" role="menuitem"><Plus size={15}/>Launch a coin</Link>
      {address === config.adminWallet && <Link className="wallet-launch-link wallet-admin-link" to="/admin" role="menuitem"><ShieldCheck size={15}/>Admin diagnostics</Link>}
      <button className="wallet-disconnect" role="menuitem" onClick={() => void wallet.disconnect()}><LogOut size={15}/>Disconnect</button>
    </div>}
  </div>;
}
