import { ArrowRight, ExternalLink, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { WalletMetamask, WalletPhantom } from "@web3icons/react";
import { useDialog } from "./useDialog";
import { useWallet } from "../context";
import { useLocation } from "react-router-dom";
import "./wallet-picker.css";

export function WalletModal() {
  const wallet = useWallet();
  const studio = useLocation().pathname === "/studio";
  const dialogRef = useDialog(wallet.modalOpen, () => wallet.setModalOpen(false));
  if (!wallet.modalOpen) return null;
  return <div className={`wallet-overlay wallet-connect-overlay `} role="presentation" onMouseDown={() => wallet.setModalOpen(false)}>
    <section ref={dialogRef} className="wallet-modal aqua-wallet-picker" role="dialog" aria-modal="true" aria-labelledby="wallet-title" aria-describedby="wallet-description" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => wallet.setModalOpen(false)} aria-label="Close wallet dialog"><X size={17}/></button>
      <h2 id="wallet-title">Connect your wallet</h2>
      <p className="wallet-copy" id="wallet-description">{studio ? "Your wallet is the key to your studio. Choose one to get started." : "Choose a Solana wallet to continue to AQUA."}</p>
      <div className="wallet-list">
        <WalletRow kind="phantom" name="Phantom" status={wallet.phantomInstalled ? "Detected" : "Install required"} action={wallet.phantomInstalled ? "Connect" : "Get"} icon={<span className="wallet-logo"><WalletPhantom variant="background" size={30}/></span>}/>
        <WalletRow kind="metamask" name="MetaMask" status="Solana account" icon={<span className="wallet-logo"><WalletMetamask variant="background" size={30}/></span>}/>
      </div>
      {!wallet.phantomInstalled && <p className="wallet-note">Need Phantom? <a href="https://phantom.com/download" target="_blank" rel="noreferrer">Install Phantom <ExternalLink size={11}/></a></p>}
      <div className="wallet-picker-note"><LockKeyhole size={14}/><span>{studio ? "A valid login opens your Studio immediately." : "You approve every transaction in your wallet."}</span></div>
    </section>
  </div>;
}

function WalletRow({ kind, name, status, icon, action="Connect" }: { kind: "phantom" | "metamask"; name: string; status: string; icon: React.ReactNode; action?: string }) {
  const wallet = useWallet();
  return <button className="wallet-row" disabled={Boolean(wallet.connecting)} onClick={() => void wallet.connect(kind)}>
    {icon}<span className="wallet-name"><strong>{name}</strong><small>{status}</small></span><span className="wallet-connect">{wallet.connecting === kind ? <><LoaderCircle size={15} className="wallet-picker-spin"/>Connecting</> : <>{action}<ArrowRight size={15}/></>}</span>
  </button>;
}
