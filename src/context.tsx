import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SolanaClient } from "@metamask/connect-solana";
import { toast } from "sonner";
import { api } from "./api";
import type { RuntimeConfig } from "./types";

type PhantomProvider = { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect: () => Promise<void>; signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }> };
type SolanaAccount = { address: string };
type StandardConnect = { connect: () => Promise<{ accounts?: readonly SolanaAccount[] }> };
type SolanaSignMessage = { signMessage: (input: { account: SolanaAccount; message: Uint8Array }) => Promise<readonly { signature: Uint8Array }[]> };
type MetaAdapter = { client: SolanaClient; wallet: ReturnType<SolanaClient["getWallet"]>; account: SolanaAccount };
type Adapter = { kind: "phantom"; provider: PhantomProvider } | { kind: "metamask"; value: MetaAdapter };

const fallback: RuntimeConfig = { useTestnet: true, network: "devnet", publicRpcUrl: "https://api.devnet.solana.com", programId: null, transactionsEnabled: false, fees: { platformBps: 100, rewardsBps: 100 }, graduationSol: 85 };
const RuntimeContext = createContext<{ config: RuntimeConfig; loading: boolean; error: string | null }>({ config: fallback, loading: true, error: null });

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.config().then(setConfig).catch((reason) => setError(reason instanceof Error ? reason.message : "Backend unavailable")).finally(() => setLoading(false)); }, []);
  return <RuntimeContext.Provider value={{ config, loading, error }}>{children}</RuntimeContext.Provider>;
}
export const useRuntime = () => useContext(RuntimeContext);

type WalletValue = { address: string | null; kind: "phantom" | "metamask" | null; connecting: string | null; modalOpen: boolean; setModalOpen: (open: boolean) => void; phantomInstalled: boolean; connect: (kind: "phantom" | "metamask") => Promise<void>; disconnect: () => Promise<void>; signMessage: (message: string) => Promise<{ message: string; signature: string }> };
const WalletContext = createContext<WalletValue | null>(null);
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export function WalletProvider({ children }: { children: ReactNode }) {
  const { config } = useRuntime();
  const [address, setAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<"phantom" | "metamask" | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const adapter = useRef<Adapter | null>(null);
  const phantomInstalled = typeof window !== "undefined" && Boolean((window as Window & { phantom?: { solana?: PhantomProvider } }).phantom?.solana?.isPhantom);

  const connect = useCallback(async (next: "phantom" | "metamask") => {
    setConnecting(next);
    try {
      if (next === "phantom") {
        const provider = (window as Window & { phantom?: { solana?: PhantomProvider } }).phantom?.solana;
        if (!provider?.isPhantom) { window.open("https://phantom.com/download", "_blank", "noopener,noreferrer"); throw new Error("Phantom is not installed."); }
        const result = await provider.connect();
        adapter.current = { kind: "phantom", provider };
        setAddress(result.publicKey.toString());
      } else {
        const { createSolanaClient } = await import("@metamask/connect-solana");
        const client = await createSolanaClient({ dapp: { name: "AQUA", url: window.location.origin, iconUrl: `${window.location.origin}${import.meta.env.BASE_URL}aqua-logo.png` }, api: { supportedNetworks: config.network === "devnet" ? { devnet: config.publicRpcUrl } : { mainnet: config.publicRpcUrl } }, analytics: { enabled: false, integrationType: "direct" } });
        const wallet = client.getWallet();
        const feature = wallet.features["standard:connect"] as StandardConnect | undefined;
        if (!feature) throw new Error("MetaMask does not expose a Solana account.");
        const result = await feature.connect();
        const account = result.accounts?.[0] ?? wallet.accounts[0];
        if (!account) throw new Error("No Solana account was returned.");
        adapter.current = { kind: "metamask", value: { client, wallet, account } };
        setAddress(account.address);
      }
      setKind(next); setModalOpen(false); toast.success(`${next === "phantom" ? "Phantom" : "MetaMask"} connected`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Wallet connection failed."); }
    finally { setConnecting(null); }
  }, [config.network, config.publicRpcUrl]);

  const disconnect = useCallback(async () => { if (adapter.current?.kind === "phantom") await adapter.current.provider.disconnect(); if (adapter.current?.kind === "metamask") await adapter.current.value.client.disconnect(); adapter.current = null; setAddress(null); setKind(null); }, []);
  const signMessage = useCallback(async (message: string) => { if (!adapter.current || !address) throw new Error("Connect your wallet first."); const encoded = new TextEncoder().encode(message); if (adapter.current.kind === "phantom") { const result = await adapter.current.provider.signMessage(encoded, "utf8"); return { message, signature: base64(result.signature) }; } const feature = adapter.current.value.wallet.features["solana:signMessage"] as SolanaSignMessage | undefined; if (!feature) throw new Error("MetaMask does not support Solana message signing."); const [result] = await feature.signMessage({ account: adapter.current.value.account, message: encoded }); return { message, signature: base64(result.signature) }; }, [address]);
  const value = useMemo(() => ({ address, kind, connecting, modalOpen, setModalOpen, phantomInstalled, connect, disconnect, signMessage }), [address, kind, connecting, modalOpen, phantomInstalled, connect, disconnect, signMessage]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export function useWallet() { const value = useContext(WalletContext); if (!value) throw new Error("WalletProvider missing"); return value; }
