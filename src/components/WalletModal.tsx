import { ExternalLink, X } from "lucide-react";
import { WalletMetamask, WalletPhantom } from "@web3icons/react";
import { useWallet } from "../context";

export function WalletModal() {
  const wallet = useWallet();
  if (!wallet.modalOpen) return null;
  return <div className="wallet-overlay wallet-connect-overlay" role="presentation" onMouseDown={() => wallet.setModalOpen(false)}>
    <div className="wallet-transition-wave" aria-hidden="true"/>
    <div className="wallet-transition-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => wallet.setModalOpen(false)} aria-label="Close wallet dialog"><X size={17}/></button>
      <h2 id="wallet-title">Connect to AQUA</h2>
      <p className="wallet-copy">Choose a wallet to explore rewards, check eligibility, or sign a transaction. AQUA cannot move funds without your approval.</p>
      <div className="wallet-list">
        <WalletRow kind="phantom" name="Phantom" status={wallet.phantomInstalled ? "Detected" : "Install required"} action={wallet.phantomInstalled ? "Connect" : "Get"} icon={<span className="wallet-logo"><WalletPhantom variant="background" size={30}/></span>}/>
        <WalletRow kind="metamask" name="MetaMask" status="Solana account" icon={<span className="wallet-logo"><WalletMetamask variant="background" size={30}/></span>}/>
      </div>
      <p className="wallet-note">MetaMask connects through its Solana account support. {!wallet.phantomInstalled && <>Need Phantom? <a href="https://phantom.com/download" target="_blank" rel="noreferrer">Install Phantom <ExternalLink size={11}/></a></>}</p>
    </section>
  </div>;
}

function WalletRow({ kind, name, status, icon, action="Connect" }: { kind: "phantom" | "metamask"; name: string; status: string; icon: React.ReactNode; action?: string }) {
  const wallet = useWallet();
  return <button className="wallet-row" disabled={Boolean(wallet.connecting)} onClick={() => void wallet.connect(kind)}>
    {icon}<span className="wallet-name"><strong>{name}</strong><small>{status}</small></span><span className="wallet-connect">{wallet.connecting === kind ? "Connecting…" : action}</span>
  </button>;
}
