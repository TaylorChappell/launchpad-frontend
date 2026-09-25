import { getWallets } from "@wallet-standard/app";

// Jupiter registers through Wallet Standard, including its in-app browser.
export function getJupiterWallet() {
  return getWallets().get().find(wallet =>
    ["Jupiter", "Jupiter Wallet"].includes(wallet.name) &&
    wallet.chains.some(chain => chain.startsWith("solana:")) &&
    "standard:connect" in wallet.features && "solana:signMessage" in wallet.features,
  );
}
export function onJupiterWalletsChanged(listener: () => void) {
  const registry = getWallets();
  const offRegister = registry.on("register", listener);
  const offUnregister = registry.on("unregister", listener);
  return () => { offRegister(); offUnregister(); };
}
