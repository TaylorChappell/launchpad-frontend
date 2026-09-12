import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SolanaClient } from "@metamask/connect-solana";
import { toast } from "sonner";
import { api } from "./api";
import type { RuntimeConfig, TransactionEnvelope } from "./types";

type PhantomProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction: (transaction: unknown, options?: { preflightCommitment?: string; maxRetries?: number }) => Promise<{ signature: string } | string>;
};
type SolanaAccount = { address: string };
type StandardConnect = { connect: () => Promise<{ accounts?: readonly SolanaAccount[] }> };
type SolanaSignMessage = { signMessage: (input: { account: SolanaAccount; message: Uint8Array }) => Promise<readonly { signature: Uint8Array }[]> };
type SolanaSignAndSend = { signAndSendTransaction: (input: { account: SolanaAccount; transaction: Uint8Array; chain: string; options?: { preflightCommitment?: string; maxRetries?: number } }) => Promise<readonly { signature: Uint8Array }[]> };
type SolanaSignTransaction = { signTransaction: (input: { account: SolanaAccount; transaction: Uint8Array; chain: string }) => Promise<readonly { signedTransaction: Uint8Array }[]> };
type WalletStandard = { accounts: readonly SolanaAccount[]; features: Record<string, unknown> };
type MetaAdapter = { client: SolanaClient; wallet: WalletStandard; account: SolanaAccount };
type Adapter = { kind: "phantom"; provider: PhantomProvider } | { kind: "metamask"; value: MetaAdapter };

const fallback: RuntimeConfig = {
  brand: "AQUA",
  useTestnet: true,
  network: "devnet",
  publicRpcUrl: "https://api.devnet.solana.com",
  aquaProgramId: null,
  programId: null,
  transactionsEnabled: false,
  whirlpools: { programId: "", config: "", tickSpacing: 64, pair: "tokenized stock", liquidityLock: "permanent" },
  fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100, universal: true },
  creatorLocks: { minimumSeconds: 86_400, maximumSeconds: 31_536_000, maximumFeeShareBps: 10_000 },
  sniperDefense: { supported: false, reason: "Unavailable" },
};
const RuntimeContext = createContext<{ config: RuntimeConfig; loading: boolean; error: string | null }>({ config: fallback, loading: true, error: null });

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.config().then(setConfig).catch((reason) => setError(reason instanceof Error ? reason.message : "Backend unavailable")).finally(() => setLoading(false));
  }, []);
  return <RuntimeContext.Provider value={{ config, loading, error }}>{children}</RuntimeContext.Provider>;
}
export const useRuntime = () => useContext(RuntimeContext);

type WalletValue = {
  address: string | null;
  kind: "phantom" | "metamask" | null;
  connecting: string | null;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  phantomInstalled: boolean;
  connect: (kind: "phantom" | "metamask") => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<{ message: string; signature: string }>;
  sendTransaction: (envelope: TransactionEnvelope) => Promise<string>;
};
const WalletContext = createContext<WalletValue | null>(null);
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

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
        if (!provider?.isPhantom) {
          window.open("https://phantom.com/download", "_blank", "noopener,noreferrer");
          throw new Error("Phantom is not installed.");
        }
        const result = await provider.connect();
        adapter.current = { kind: "phantom", provider };
        setAddress(result.publicKey.toString());
      } else {
        const { createSolanaClient } = await import("@metamask/connect-solana");
        const client = await createSolanaClient({
          dapp: { name: "AQUA", url: window.location.origin, iconUrl: `${window.location.origin}${import.meta.env.BASE_URL}aqua-logo.png` },
          api: { supportedNetworks: config.network === "devnet" ? { devnet: config.publicRpcUrl } : { mainnet: config.publicRpcUrl } },
          analytics: { enabled: false, integrationType: "direct" },
        });
        const wallet = client.getWallet() as unknown as WalletStandard;
        const feature = wallet.features["standard:connect"] as StandardConnect | undefined;
        if (!feature) throw new Error("MetaMask does not expose a Solana account.");
        const result = await feature.connect();
        const account = result.accounts?.[0] ?? wallet.accounts[0];
        if (!account) throw new Error("No Solana account was returned.");
        adapter.current = { kind: "metamask", value: { client, wallet, account } };
        setAddress(account.address);
      }
      setKind(next);
      setModalOpen(false);
      toast.success(`${next === "phantom" ? "Phantom" : "MetaMask"} connected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      setConnecting(null);
    }
  }, [config.network, config.publicRpcUrl]);

  const disconnect = useCallback(async () => {
    if (adapter.current?.kind === "phantom") await adapter.current.provider.disconnect();
    if (adapter.current?.kind === "metamask") await adapter.current.value.client.disconnect();
    adapter.current = null;
    setAddress(null);
    setKind(null);
  }, []);

  const signMessage = useCallback(async (message: string) => {
    if (!adapter.current || !address) throw new Error("Connect your wallet first.");
    const encoded = new TextEncoder().encode(message);
    if (adapter.current.kind === "phantom") {
      const result = await adapter.current.provider.signMessage(encoded, "utf8");
      return { message, signature: base64(result.signature) };
    }
    const feature = adapter.current.value.wallet.features["solana:signMessage"] as SolanaSignMessage | undefined;
    if (!feature) throw new Error("MetaMask does not support Solana message signing.");
    const [result] = await feature.signMessage({ account: adapter.current.value.account, message: encoded });
    if (!result) throw new Error("MetaMask did not return a message signature.");
    return { message, signature: base64(result.signature) };
  }, [address]);

  const sendTransaction = useCallback(async (envelope: TransactionEnvelope) => {
    if (!adapter.current || !address) throw new Error("Connect your wallet first.");
    const [{ Connection, Transaction, VersionedTransaction }, { default: bs58 }] = await Promise.all([import("@solana/web3.js"), import("bs58")]);
    const connection = new Connection(config.publicRpcUrl, "confirmed");
    const bytes = decodeBase64(envelope.transactionBase64);
    let transaction: unknown;
    let transactionBlockhash: string | undefined;
    if (envelope.transactionVersion === 0) {
      const parsed = VersionedTransaction.deserialize(bytes);
      transaction = parsed;
      transactionBlockhash = parsed.message.recentBlockhash;
    } else {
      const parsed = Transaction.from(bytes);
      transaction = parsed;
      transactionBlockhash = parsed.recentBlockhash;
    }
    const blockhash = envelope.recentBlockhash || transactionBlockhash;
    if (!blockhash) throw new Error("The transaction does not contain a recent blockhash.");
    let signature: string;

    if (adapter.current.kind === "phantom") {
      const result = await adapter.current.provider.signAndSendTransaction(transaction, { preflightCommitment: "confirmed", maxRetries: 3 });
      signature = typeof result === "string" ? result : result.signature;
    } else {
      const { wallet, account } = adapter.current.value;
      const chain = config.network === "devnet" ? "solana:devnet" : "solana:mainnet";
      const sendFeature = wallet.features["solana:signAndSendTransaction"] as SolanaSignAndSend | undefined;
      if (sendFeature) {
        const [result] = await sendFeature.signAndSendTransaction({ account, transaction: bytes, chain, options: { preflightCommitment: "confirmed", maxRetries: 3 } });
        if (!result) throw new Error("MetaMask did not return a transaction signature.");
        signature = bs58.encode(result.signature);
      } else {
        const signFeature = wallet.features["solana:signTransaction"] as SolanaSignTransaction | undefined;
        if (!signFeature) throw new Error("MetaMask does not support Solana transactions.");
        const [result] = await signFeature.signTransaction({ account, transaction: bytes, chain });
        if (!result) throw new Error("MetaMask did not return a signed transaction.");
        signature = await connection.sendRawTransaction(result.signedTransaction, { maxRetries: 3, preflightCommitment: "confirmed" });
      }
    }

    const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight: envelope.lastValidBlockHeight }, "confirmed");
    if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    return signature;
  }, [address, config.network, config.publicRpcUrl]);

  const value = useMemo(() => ({ address, kind, connecting, modalOpen, setModalOpen, phantomInstalled, connect, disconnect, signMessage, sendTransaction }), [address, kind, connecting, modalOpen, phantomInstalled, connect, disconnect, signMessage, sendTransaction]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("WalletProvider missing");
  return value;
}
