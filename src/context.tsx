import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SolanaClient } from "@metamask/connect-solana";
import { toast } from "sonner";
import { api, API_URL } from "./api";
import type { LaunchBatchEnvelope, RuntimeConfig, SignedTransactionEnvelope, TransactionEnvelope } from "./types";

type PhantomProvider = {
  isPhantom?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction: (transaction: unknown, options?: { preflightCommitment?: string; maxRetries?: number }) => Promise<{ signature: string } | string>;
  signAllTransactions?: (transactions: unknown[]) => Promise<Array<{ serialize: () => Uint8Array }>>;
};
type SolanaAccount = { address: string };
type StandardConnect = { connect: () => Promise<{ accounts?: readonly SolanaAccount[] }> };
type SolanaSignMessage = { signMessage: (input: { account: SolanaAccount; message: Uint8Array }) => Promise<readonly { signature: Uint8Array }[]> };
type SolanaSignAndSend = { signAndSendTransaction: (input: { account: SolanaAccount; transaction: Uint8Array; chain: string; options?: { preflightCommitment?: string; maxRetries?: number } }) => Promise<readonly { signature: Uint8Array }[]> };
type SolanaSignTransaction = { signTransaction: (...inputs: Array<{ account: SolanaAccount; transaction: Uint8Array; chain: string }>) => Promise<readonly { signedTransaction: Uint8Array }[]> };
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
  programInitialized: false,
  transactionsEnabled: false,
  marketGovernanceEnabled: false,
  transactionsDisabledReason: "AQUA launch transactions are not configured.",
  whirlpools: { programId: "", config: "", tickSpacing: 64, pair: "tokenized stock", liquidityLock: "permanent" },
  fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100, universal: true },
  creatorLocks: { minimumSeconds: 86_400, maximumSeconds: 31_536_000, maximumFeeShareBps: 2_500, targetSupplyBps: 500, initialLiquidityExcluded: true },
  sniperDefense: { supported: false, reason: "Unavailable" },
};
const RuntimeContext = createContext<{ config: RuntimeConfig; loading: boolean; error: string | null }>({ config: fallback, loading: true, error: null });

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true, pending = false;
    const load = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try { const next = await api.config(); if (active) { setConfig(next); setError(null); setLoading(false); } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Backend unavailable"); }
      finally { pending = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("online", load); window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("online", load); window.removeEventListener("focus", load); };
  }, []);
  return <RuntimeContext.Provider value={{ config:error?{...config,transactionsEnabled:false,transactionsDisabledReason:"Runtime configuration is unavailable. Wait for reconnection before creating or trading."}:config, loading, error }}>{children}</RuntimeContext.Provider>;
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
  sendTransaction: (envelope: TransactionEnvelope, onSubmitted?: (signature:string) => void) => Promise<string>;
  signTransaction: (envelope: TransactionEnvelope) => Promise<{ signedTransactionBase64: string }>;
  signTransactionBatch: (envelopes: LaunchBatchEnvelope[]) => Promise<SignedTransactionEnvelope[]>;
  submitSignedTransaction: (envelope: SignedTransactionEnvelope) => Promise<string>;
};
const WalletContext = createContext<WalletValue | null>(null);
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function friendlyWalletError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (/block height exceeded|blockhash not found|signature .* expired|transaction expired/i.test(raw)) {
    return "This transaction expired before approval. Build a fresh transaction and try again.";
  }
  if (/user rejected|rejected the request|declined|cancelled|canceled/i.test(raw)) {
    return "Transaction cancelled. Nothing was submitted.";
  }
  if (/insufficient funds|insufficient lamports/i.test(raw)) {
    return "This wallet does not have enough SOL to pay the transaction and account creation costs.";
  }
  if (/failed to simulate|simulation failed|invalidaccountdata|instructionerror/i.test(raw)) {
    return "This transaction failed its safety check and was not submitted. Build a fresh transaction before trying again.";
  }
  return "The wallet could not complete this transaction. Nothing was submitted.";
}

async function waitForConfirmation(connection: import("@solana/web3.js").Connection, signature: string, lastValidBlockHeight: number) {
  for (;;) {
    const [{ value }, blockHeight] = await Promise.all([
      connection.getSignatureStatuses([signature], { searchTransactionHistory: true }),
      connection.getBlockHeight("confirmed"),
    ]);
    const status = value[0];
    if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (blockHeight > lastValidBlockHeight) {
      const finalStatus = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
      if (finalStatus?.err) throw new Error(`Transaction failed: ${JSON.stringify(finalStatus.err)}`);
      if (finalStatus?.confirmationStatus === "confirmed" || finalStatus?.confirmationStatus === "finalized") return;
      throw new Error(`Signature ${signature} has expired: block height exceeded.`);
    }
    await wait(1_200);
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { config, loading: configLoading } = useRuntime();
  const [address, setAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<"phantom" | "metamask" | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const adapter = useRef<Adapter | null>(null);
  const connectionAttempt = useRef(0);
  const metaClient = useRef<Promise<SolanaClient> | null>(null);
  const remember = (value: "phantom" | "metamask" | null) => {
    try { if (value) localStorage.setItem("aqua:wallet", value); else localStorage.removeItem("aqua:wallet"); } catch { /* Private browsing may disable storage. */ }
  };
  const phantomInstalled = typeof window !== "undefined" && Boolean((window as Window & { phantom?: { solana?: PhantomProvider } }).phantom?.solana?.isPhantom);

  const connectWallet = useCallback(async (next: "phantom" | "metamask", silent = false) => {
    const attempt = ++connectionAttempt.current;
    setConnecting(next);
    try {
      if (next === "phantom") {
        const provider = (window as Window & { phantom?: { solana?: PhantomProvider } }).phantom?.solana;
        if (!provider?.isPhantom) {
          if (!silent) window.open("https://phantom.com/download", "_blank", "noopener,noreferrer");
          throw new Error("Phantom is not installed.");
        }
        const result = await provider.connect(silent ? { onlyIfTrusted: true } : undefined);
        if (attempt !== connectionAttempt.current) return;
        adapter.current = { kind: "phantom", provider };
        setAddress(result.publicKey.toString());
      } else {
        const { createSolanaClient } = await import("@metamask/connect-solana");
        const client = await (metaClient.current ??= createSolanaClient({
          dapp: { name: "AQUA", url: window.location.origin, iconUrl: `${window.location.origin}${import.meta.env.BASE_URL}aqua-logo.png` },
          api: { supportedNetworks: config.network === "devnet" ? { devnet: config.publicRpcUrl } : { mainnet: config.publicRpcUrl } },
          analytics: { enabled: false, integrationType: "direct" },
        }));
        const wallet = client.getWallet() as unknown as WalletStandard;
        const feature = wallet.features["standard:connect"] as StandardConnect | undefined;
        if (!feature) throw new Error("MetaMask does not expose a Solana account.");
        // The SDK restores an existing Solana session during initialization.
        // Never request a new session automatically when permission is absent.
        const result = silent ? { accounts: wallet.accounts } : await feature.connect();
        if (attempt !== connectionAttempt.current) return;
        const account = result.accounts?.[0] ?? wallet.accounts[0];
        if (!account) throw new Error("No Solana account was returned.");
        adapter.current = { kind: "metamask", value: { client, wallet, account } };
        setAddress(account.address);
      }
      remember(next);
      setKind(next);
      setModalOpen(false);
      if (!silent) toast.success(`${next === "phantom" ? "Phantom" : "MetaMask"} connected`);
    } catch (error) {
      // Allow a later manual attempt to recreate the SDK after an init failure.
      if (next === "metamask") metaClient.current = null;
      if (!silent && attempt === connectionAttempt.current) toast.error(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally {
      if (attempt === connectionAttempt.current) setConnecting(null);
    }
  }, [config.network, config.publicRpcUrl]);

  const connect = useCallback((next: "phantom" | "metamask") => connectWallet(next), [connectWallet]);

  useEffect(() => {
    if (configLoading || adapter.current) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem("aqua:wallet"); } catch { /* No persisted preference. */ }
    if (saved === "phantom" || saved === "metamask") void connectWallet(saved, true);
    return () => { connectionAttempt.current++; };
  }, [configLoading, connectWallet]);

  const disconnect = useCallback(async () => {
    const revoke:Promise<unknown>[]=[];
    const sessions = new Map<string,string>();
    for (const storage of [localStorage,sessionStorage]) {
      try {
        for (const key of Object.keys(storage)) if(key.startsWith("aqua:studio:")) {
          const session=JSON.parse(storage.getItem(key)??"null");
          storage.removeItem(key);
          if(session?.token) sessions.set(String(session.token),String(session.token));
        }
      } catch { /* Storage can be unavailable. */ }
    }
    for (const token of sessions.values()) revoke.push(fetch(`${API_URL}/account/sign-out`,{method:"POST",headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(3000)}).catch(()=>{}));
    ++connectionAttempt.current;
    const previous = adapter.current;
    adapter.current = null;
    remember(null);
    setAddress(null);
    setKind(null);
    setConnecting(null);
    setModalOpen(false);
    try {
      if (previous?.kind === "phantom") await previous.provider.disconnect();
      if (previous?.kind === "metamask") await previous.value.client.disconnect();
    } catch { /* AQUA remains signed out even if the extension is unavailable. */ }
    await Promise.allSettled(revoke);
  }, []);

  useEffect(() => {
    const current = adapter.current;
    if (!current) return;
    const clear = () => {
      if (adapter.current !== current) return;
      ++connectionAttempt.current;
      adapter.current = null; remember(null); setAddress(null); setKind(null);
    };
    if (current.kind === "phantom") {
      const changed = (key: { toString: () => string } | null) => {
        if (adapter.current !== current) return;
        if (key) setAddress(key.toString()); else clear();
      };
      current.provider.on?.("accountChanged", changed);
      current.provider.on?.("disconnect", clear);
      return () => {
        current.provider.removeListener?.("accountChanged", changed);
        current.provider.removeListener?.("disconnect", clear);
      };
    }
    const events = current.value.wallet.features["standard:events"] as { on: (event: "change", listener: (change: { accounts?: readonly SolanaAccount[] }) => void) => () => void } | undefined;
    return events?.on("change", ({ accounts }) => {
      if (!accounts || adapter.current !== current) return;
      if (!accounts.length) { clear(); return; }
      current.value.account = accounts[0]; setAddress(accounts[0].address);
    });
  }, [kind, address]);

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

  const sendTransaction = useCallback(async (envelope: TransactionEnvelope, onSubmitted?: (signature:string) => void) => {
    let submittedSignature:string|undefined;
    try {
      if (!adapter.current || !address) throw new Error("Connect your wallet first.");
      const [{ Connection, Transaction, VersionedTransaction }, { default: bs58 }] = await Promise.all([import("@solana/web3.js"), import("bs58")]);
      const connection = new Connection(config.publicRpcUrl, "confirmed");
      const bytes = decodeBase64(envelope.transactionBase64);
      let transaction: unknown;
      if (envelope.transactionVersion === 0) transaction = VersionedTransaction.deserialize(bytes);
      else transaction = Transaction.from(bytes);
      let signature: string;

      if (adapter.current.kind === "phantom") {
        const result = await adapter.current.provider.signAndSendTransaction(transaction, { preflightCommitment: "confirmed", maxRetries: 5 });
        signature = typeof result === "string" ? result : result.signature;
      } else {
        const { wallet, account } = adapter.current.value;
        const chain = config.network === "devnet" ? "solana:devnet" : "solana:mainnet";
        const sendFeature = wallet.features["solana:signAndSendTransaction"] as SolanaSignAndSend | undefined;
        if (sendFeature) {
          const [result] = await sendFeature.signAndSendTransaction({ account, transaction: bytes, chain, options: { preflightCommitment: "confirmed", maxRetries: 5 } });
          if (!result) throw new Error("MetaMask did not return a transaction signature.");
          signature = bs58.encode(result.signature);
        } else {
          const signFeature = wallet.features["solana:signTransaction"] as SolanaSignTransaction | undefined;
          if (!signFeature) throw new Error("MetaMask does not support Solana transactions.");
          const [result] = await signFeature.signTransaction({ account, transaction: bytes, chain });
          if (!result) throw new Error("MetaMask did not return a signed transaction.");
          signature = await connection.sendRawTransaction(result.signedTransaction, { maxRetries: 5, preflightCommitment: "confirmed" });
        }
      }

      submittedSignature=signature;
      onSubmitted?.(signature);
      await waitForConfirmation(connection, signature, envelope.lastValidBlockHeight);
      return signature;
    } catch (error) {
      console.error("AQUA wallet transaction failed", error);
      if(submittedSignature)throw new Error("Transaction was submitted, but confirmation could not be completed. Check "+submittedSignature+" on the explorer before retrying.");
      throw new Error(friendlyWalletError(error));
    }
  }, [address, config.network, config.publicRpcUrl]);

  const signTransactions = useCallback(async (envelopes: TransactionEnvelope[]) => {
    if (!adapter.current || !address) throw new Error("Connect your wallet first.");
    if (!envelopes.length) throw new Error("No transactions were prepared.");
    const { Transaction, VersionedTransaction } = await import("@solana/web3.js");
    const transactions = envelopes.map((envelope) => {
      const bytes = decodeBase64(envelope.transactionBase64);
      return envelope.transactionVersion === 0 ? VersionedTransaction.deserialize(bytes) : Transaction.from(bytes);
    });
    try {
      if (adapter.current.kind === "phantom") {
        if (!adapter.current.provider.signAllTransactions) throw new Error("Update Phantom to sign these transactions.");
        const signed = await adapter.current.provider.signAllTransactions(transactions);
        if (signed.length !== envelopes.length) throw new Error("Phantom did not sign every transaction.");
        return signed.map((transaction, index) => ({ ...envelopes[index], signedTransactionBase64: base64(transaction.serialize()) }));
      }
      const { wallet, account } = adapter.current.value;
      const feature = wallet.features["solana:signTransaction"] as SolanaSignTransaction | undefined;
      if (!feature) throw new Error("MetaMask does not support transaction batch signing.");
      const chain = config.network === "devnet" ? "solana:devnet" : "solana:mainnet";
      const results = await feature.signTransaction(...envelopes.map((envelope) => ({ account, transaction: decodeBase64(envelope.transactionBase64), chain })));
      if (results.length !== envelopes.length) throw new Error("MetaMask did not sign every transaction.");
      return results.map((result, index) => ({ ...envelopes[index], signedTransactionBase64: base64(result.signedTransaction) }));
    } catch (error) {
      throw new Error(friendlyWalletError(error));
    }
  }, [address, config.network]);

  const signTransaction = useCallback(async (envelope: TransactionEnvelope) => (await signTransactions([envelope]))[0]!, [signTransactions]);
  const signTransactionBatch = useCallback(async (envelopes: LaunchBatchEnvelope[]): Promise<SignedTransactionEnvelope[]> => {
    const signed = await signTransactions(envelopes);
    return signed.map((value, i) => ({ ...value, step: envelopes[i]!.step }));
  }, [signTransactions]);

  const submitSignedTransaction = useCallback(async (envelope: SignedTransactionEnvelope) => {
    try {
      const { Connection } = await import("@solana/web3.js");
      const connection = new Connection(config.publicRpcUrl, "confirmed");
      const signature = await connection.sendRawTransaction(decodeBase64(envelope.signedTransactionBase64), { maxRetries: 5, preflightCommitment: "confirmed" });
      await waitForConfirmation(connection, signature, envelope.lastValidBlockHeight);
      return signature;
    } catch (error) {
      throw new Error(friendlyWalletError(error));
    }
  }, [config.publicRpcUrl]);

  const value = useMemo(() => ({ address, kind, connecting, modalOpen, setModalOpen, phantomInstalled, connect, disconnect, signMessage, sendTransaction, signTransaction, signTransactionBatch, submitSignedTransaction }), [address, kind, connecting, modalOpen, phantomInstalled, connect, disconnect, signMessage, sendTransaction, signTransaction, signTransactionBatch, submitSignedTransaction]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("WalletProvider missing");
  return value;
}

