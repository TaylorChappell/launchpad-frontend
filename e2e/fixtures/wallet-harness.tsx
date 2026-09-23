import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { RuntimeProvider, WalletProvider, useWallet } from '../../src/context';
import { WalletModal } from '../../src/components/WalletModal';

function Harness() {
  const wallet = useWallet();
  // Expose the real context for exercising signing without moving real funds.
  (window as any).testWallet = wallet;
  return <><button onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>
    <output data-testid="address">{wallet.address ?? 'Disconnected'}</output>
    <button onClick={() => void wallet.disconnect()}>Sign out</button>
    <WalletModal/><Toaster/></>;
}

createRoot(document.getElementById('root')!).render(<HashRouter><RuntimeProvider><WalletProvider><Harness/></WalletProvider></RuntimeProvider></HashRouter>);
