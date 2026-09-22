import { WalletIdentity } from "./WalletIdentity";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, LogOut, Plus, Settings2, ShieldCheck, WalletCards } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { Launch } from "../types";
import { TokenMark } from "./TokenCard";

const COINS_PER_PAGE = 5;

export function WalletMenu() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const location = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coins, setCoins] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleCoins, setVisibleCoins] = useState(COINS_PER_PAGE);
  const address = wallet.address;
  const remainingCoins = Math.max(0, coins.length - visibleCoins);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => setVisibleCoins(COINS_PER_PAGE), [address, open]);
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
    api.launches({creator: address, status:"all", limit:100}).then(({ launches }) => {
      if (!active) return;
      setCoins(launches.filter((launch) => launch.creatorWallet === address).sort((a,b) => b.createdAt - a.createdAt));
    }).catch(() => { if (active) setCoins([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [address]);

  if (!address) return <button className="wallet-button" onClick={() => wallet.setModalOpen(true)}><span>Connect wallet</span></button>;

  return <div className="wallet-menu" ref={root}>
    <button className="wallet-button connected wallet-menu-trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}><span><WalletIdentity wallet={address} link={false}/></span><ChevronDown size={14}/></button>
    {open && <div className="wallet-dropdown" role="menu">
      <header><div className="wallet-identity"><span className="wallet-connected-mark"><WalletCards size={16}/></span><div><small>Connected wallet</small><b><WalletIdentity wallet={address} link={false}/></b></div></div><button aria-label="Copy wallet address" title="Copy wallet address" onClick={() => { void navigator.clipboard.writeText(address); toast.success("Wallet copied"); }}><Copy size={14}/></button></header>
      <Link className="wallet-launch-link" to="/portfolio">My holdings &amp; creator dashboard</Link><section>
        <div className="wallet-dropdown-title"><span><WalletCards size={14}/>Your coins</span><b>{coins.length}</b></div>
        <div className="wallet-coins">
          {loading ? <small className="wallet-coins-empty">Loading your launches…</small> : coins.length ? coins.slice(0, visibleCoins).map((coin) => <Link key={coin.id} to={"/manage/" + coin.id} role="menuitem"><TokenMark launch={coin}/><span><b>{"$" + coin.symbol}</b><small>{coin.pairSymbol} market · {coin.status === "live" ? "Live" : "Launching"}</small></span><Settings2 size={14}/></Link>) : <small className="wallet-coins-empty">Coins launched by this wallet will appear here.</small>}
        </div>
        {!loading && remainingCoins > 0 && <button className="wallet-coins-load-more" type="button" role="menuitem" onClick={() => setVisibleCoins((count) => Math.min(count + COINS_PER_PAGE, coins.length))}><span>Load more</span><small>{remainingCoins} remaining</small><ChevronDown size={14}/></button>}
      </section>
      <Link className="wallet-launch-link" to="/create" role="menuitem"><Plus size={15}/>Launch a coin</Link>
      {address === config.adminWallet && <Link className="wallet-launch-link wallet-admin-link" to="/admin" role="menuitem"><ShieldCheck size={15}/>Admin diagnostics</Link>}
      <button className="wallet-disconnect" role="menuitem" onClick={() => void wallet.disconnect()}><LogOut size={15}/>Sign out</button>
    </div>}
  </div>;
}

