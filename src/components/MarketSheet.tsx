import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useWallet } from "../context";
import type { Launch } from "../types";
import { TokenMark } from "./TokenCard";
import { useDialog } from "./useDialog";

export function MarketSheet({ launch, title, closeLabel, busy = false, covered = false, onClose, children }: {
  launch: Launch; title: string; closeLabel: string; busy?: boolean; covered?: boolean;
  onClose: () => void; children: ReactNode;
}) {
  const wallet = useWallet();
  const titleId = useId();
  const close = () => { if (!busy) onClose(); };
  const dialog = useDialog(true, close);
  const hidden = covered || wallet.modalOpen;
  return createPortal(<div className="mobile-trade-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section className="mobile-trade-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={hidden || undefined} inert={hidden || undefined} ref={dialog}>
      <div className="mobile-trade-handle" aria-hidden="true"/>
      <header><TokenMark launch={launch}/><div><h2 id={titleId}>{title}</h2><p>{launch.name} · ${launch.symbol}</p></div><button className="mobile-trade-close" aria-label={closeLabel} disabled={busy} onClick={close}><X size={20}/></button></header>
      <div className="mobile-trade-content">{children}</div>
    </section>
  </div>, document.body);
}
