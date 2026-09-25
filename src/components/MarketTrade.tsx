import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { useRuntime, useWallet } from "../context";
import type { Launch } from "../types";
import { TokenMark } from "./TokenCard";
import { TradePanel } from "./TradePanel";
import { useDialog } from "./useDialog";

type Side = "buy" | "sell";

export function MarketTrade({ launch, pairDecimals }: { launch: Launch; pairDecimals: number | null }) {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 1100px)").matches);
  const [side, setSide] = useState<Side | null>(null);
  const [busy, setBusy] = useState(false);
  const panelKey = [launch.id, wallet.address, config.network].join(":");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    // Keep the form mounted if a wallet approval is in flight during a resize.
    const update = () => { if (!busy) setMobile(media.matches); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [busy]);

  if (!mobile && side === null) return <TradePanel key={panelKey} launch={launch} pairDecimals={pairDecimals} onBusyChange={setBusy}/>;
  return <>
    <div className="market-trade-actions" role="group" aria-label="Trade this coin">
      <button className="market-buy-button" aria-haspopup="dialog" onClick={() => setSide("buy")}><ArrowDownLeft size={20}/>Buy</button>
      <button className="market-sell-button" aria-haspopup="dialog" onClick={() => setSide("sell")}><ArrowUpRight size={20}/>Sell</button>
    </div>
    {side && <MobileTradeSheet launch={launch} busy={busy} onClose={() => { if (!busy) setSide(null); }}>
      <TradePanel key={panelKey} launch={launch} pairDecimals={pairDecimals} initialSide={side} onBusyChange={setBusy}/>
    </MobileTradeSheet>}
  </>;
}

function MobileTradeSheet({ launch, busy, onClose, children }: { launch: Launch; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  const wallet = useWallet();
  const dialog = useDialog(true, onClose);
  return createPortal(<div className="mobile-trade-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mobile-trade-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-trade-title" aria-hidden={wallet.modalOpen || undefined} inert={wallet.modalOpen || undefined} ref={dialog}>
      <div className="mobile-trade-handle" aria-hidden="true"/>
      <header><TokenMark launch={launch}/><div><h2 id="mobile-trade-title">Trade {launch.symbol}</h2><p>{launch.name}</p></div><button className="mobile-trade-close" aria-label="Close trade" disabled={busy} onClick={onClose}><X size={20}/></button></header>
      <div className="mobile-trade-content">{children}</div>
    </section>
  </div>, document.body);
}
