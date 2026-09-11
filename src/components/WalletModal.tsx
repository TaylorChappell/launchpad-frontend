import { X } from "lucide-react";
import { WalletMetamask, WalletPhantom } from "@web3icons/react";
import { useWallet } from "../context";

export function WalletModal() {
  const wallet = useWallet();
  if (!wallet.modalOpen) return null;
  return <div className="wallet-overlay" role="presentation" onMouseDown={() => wallet.setModalOpen(false)}>
    <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => wallet.setModalOpen(false)} aria-label="Close"><X size={17} /></button>
      <h2 id="wallet-title">Connect a wallet</h2>
      <p className="wallet-copy">Choose a wallet that supports Solana. Every launch and trade still requires your approval.</p>
      <div className="wallet-list">
        <WalletRow kind="phantom" name="Phantom" installed={wallet.phantomInstalled} icon={<span className="wallet-logo phantom"><WalletPhantom variant="background" size={29} /></span>} />
        <WalletRow kind="metamask" name="MetaMask" installed icon={<span className="wallet-logo metamask"><WalletMetamask variant="background" size={29} /></span>} />
      </div>
      {!wallet.phantomInstalled && <div className="not-installed"><span>Not installed</span><a href="https://phantom.com/download" target="_blank" rel="noreferrer"><WalletPhantom variant="branded" size={18} /> Phantom <b>Get ↗</b></a></div>}
    </section>
  </div>;
}

function WalletRow({ kind, name, installed, icon }: { kind: "phantom" | "metamask"; name: string; installed: boolean; icon: React.ReactNode }) {
  const wallet = useWallet();
  return <button className="wallet-row" disabled={Boolean(wallet.connecting)} onClick={() => void wallet.connect(kind)}>
    {icon}<span className="wallet-name"><strong>{name}</strong><small>{installed ? "Detected" : "Not installed"}</small></span><span className="wallet-connect">{wallet.connecting === kind ? "Connecting…" : "Connect"}</span>
  </button>;
}
