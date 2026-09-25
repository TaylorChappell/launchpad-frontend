import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useRuntime, useWallet } from "../context";
import type { Launch } from "../types";
import { TradePanel } from "./TradePanel";
import { MarketSheet } from "./MarketSheet";

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
    {side && <MarketSheet launch={launch} title={`Trade ${launch.symbol}`} closeLabel="Close trade" busy={busy} onClose={() => { if (!busy) setSide(null); }}>
      <TradePanel key={panelKey} launch={launch} pairDecimals={pairDecimals} initialSide={side} onBusyChange={setBusy}/>
    </MarketSheet>}
  </>;
}
