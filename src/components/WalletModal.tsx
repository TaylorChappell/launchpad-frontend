import { ArrowRight, ExternalLink, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { WalletMetamask, WalletPhantom, WalletSolflare } from "@web3icons/react";
import { useDialog } from "./useDialog";
import { useWallet, type WalletKind } from "../context";
import { useLocation } from "react-router-dom";
import { isMobileBrowser, phantomBrowseUrl } from "../phantom-mobile";
import { solflareBrowseUrl } from "../solflare";
import "./wallet-picker.css";

export function WalletModal() {
  const wallet = useWallet();
  const studio = useLocation().pathname === "/studio";
  const mobilePhantom = !wallet.phantomInstalled && isMobileBrowser();
  const mobileSolflare = !wallet.solflareInstalled && isMobileBrowser();
  const dialogRef = useDialog(wallet.modalOpen, () => wallet.setModalOpen(false));
  if (!wallet.modalOpen) return null;
  return <div className={`wallet-overlay wallet-connect-overlay `} role="presentation" onMouseDown={() => wallet.setModalOpen(false)}>
    <section ref={dialogRef} className="wallet-modal aqua-wallet-picker" role="dialog" aria-modal="true" aria-labelledby="wallet-title" aria-describedby="wallet-description" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => wallet.setModalOpen(false)} aria-label="Close wallet dialog"><X size={17}/></button>
      <h2 id="wallet-title">Connect your wallet</h2>
      <p className="wallet-copy" id="wallet-description">{studio ? "Your wallet is the key to your studio. Choose one to get started." : "Choose a Solana wallet to continue to AQUA."}</p>
      <div className="wallet-list">
        <WalletRow kind="phantom" name="Phantom" status={wallet.phantomInstalled ? "Detected" : mobilePhantom ? "Mobile app" : "Install required"} action={wallet.phantomInstalled ? "Connect" : mobilePhantom ? "Open" : "Get"} href={mobilePhantom ? phantomBrowseUrl(window.location.href) : undefined} icon={<span className="wallet-logo"><WalletPhantom variant="background" size={30}/></span>}/>
        <WalletRow kind="solflare" name="Solflare" status={wallet.solflareInstalled ? "Detected" : mobileSolflare ? "Mobile app" : "Install required"} action={wallet.solflareInstalled ? "Connect" : mobileSolflare ? "Open" : "Get"} href={mobileSolflare ? solflareBrowseUrl(window.location.href) : undefined} icon={<span className="wallet-logo"><WalletSolflare variant="background" size={30}/></span>}/>
        <WalletRow kind="metamask" name="MetaMask" status="Solana account" icon={<span className="wallet-logo"><WalletMetamask variant="background" size={30}/></span>}/>
      </div>
      {!wallet.phantomInstalled && <p className="wallet-note">Need Phantom? <a href="https://phantom.com/download" target="_blank" rel="noreferrer">Install Phantom <ExternalLink size={11}/></a></p>}
      <div className="wallet-picker-note"><LockKeyhole size={14}/><span>{studio ? "A valid login opens your Studio immediately." : "You approve every transaction in your wallet."}</span></div>
    </section>
  </div>;
}

function WalletRow({ kind, name, status, icon, action="Connect", href }: { kind: WalletKind; name: string; status: string; icon: React.ReactNode; action?: string; href?: string }) {
  const wallet = useWallet();
  const content = <>
    {icon}<span className="wallet-name"><strong>{name}</strong><small>{status}</small></span><span className="wallet-connect">{wallet.connecting === kind ? <><LoaderCircle size={15} className="wallet-picker-spin"/>Connecting</> : <>{action}<ArrowRight size={15}/></>}</span>
  </>;
  if (href) return <a className="wallet-row" href={href} aria-disabled={Boolean(wallet.connecting)} onClick={event => { if (wallet.connecting) event.preventDefault(); }}>{content}</a>;
  return <button className="wallet-row" disabled={Boolean(wallet.connecting)} onClick={() => void wallet.connect(kind)}>{content}</button>;
}
