import { API_URL } from "./api";
import { StudioApiError, studioSessionKey } from "./studio-api";
export type GithubConnection = {
  enabled: boolean;
  connected: boolean;
  login: string | null;
  connectedAt: number | null;
};

export function savedAccountSession(address: string | null) {
  if (!address) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(studioSessionKey(address)) ?? "null");
    if (typeof saved?.token === "string" && /^[a-f0-9]{64}$/.test(saved.token) && saved.expiresAt > Date.now()+60_000) return saved.token;
  } catch { /* Missing sessions require wallet proof, not just a public address. */ }
  return null;
}
export async function ensureAccountSession(address: string, signMessage: (message: string) => Promise<{signature:string}>, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) throw new Error("Wallet changed. Sign in again.");
  return savedAccountSession(address) ?? (await signInAccount(address, signMessage, isCurrent)).token;
}

export type WalletSignInInput = { domain: string; uri: string; statement: string; version: string; chainId: string; nonce: string; issuedAt: string; expirationTime: string };
export type WalletSignInOutput = { account: { address: string }; signedMessage: Uint8Array; signature: Uint8Array; signatureType?: string };

export async function signInWithWallet(signIn: (input: WalletSignInInput) => Promise<WalletSignInOutput>, isCurrent: () => boolean) {
  const challenge = await accountRequest<{ id: string; input: WalletSignInInput }>("/auth/sign-in/challenge", "", {});
  if (!isCurrent()) throw new Error("Wallet changed. Connect again.");
  const output = await signIn(challenge.input);
  if (!isCurrent()) throw new Error("Wallet changed. Connect again.");
  if (output.signatureType && output.signatureType !== "ed25519") throw new Error("This wallet signature format is not supported.");
  const session = await accountRequest<{ token: string; expiresAt: number }>("/auth/sign-in/session", "", {
    id: challenge.id, wallet: output.account.address,
    message: new TextDecoder("utf-8", { fatal: true }).decode(output.signedMessage),
    signature: btoa(String.fromCharCode(...output.signature)),
  });
  if (!isCurrent()) throw new Error("Wallet changed. Connect again.");
  localStorage.setItem(studioSessionKey(output.account.address), JSON.stringify(session));
  window.dispatchEvent(new Event("aqua:account-session"));
  return output.account;
}
export type GithubExport = {
  id: string;
  target?: "frontend" | "backend" | "all";
  name: string;
  private: boolean;
  status: string;
  stage: string;
  full_name: string | null;
  branch: string | null;
  commit_sha: string | null;
  error: string | null;
};
export async function accountRequest<T>(
  path: string,
  token = "",
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}/account${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new StudioApiError(
      data.error ?? "AQUA could not complete this request.",
      response.status,
    );
  return data;
}
export async function signInAccount(
  address: string,
  signMessage: (message: string) => Promise<{ signature: string }>,
  isCurrent: () => boolean = () => true,
) {
  const challenge = await accountRequest<{ id: string; message: string }>(
    "/auth/challenge",
    "",
    { wallet: address },
  );
  if (!isCurrent()) throw new Error("Wallet changed. Sign in again.");
  const signed = await signMessage(challenge.message);
  if (!isCurrent()) throw new Error("Wallet changed. Sign in again.");
  const session = await accountRequest<{ token: string; expiresAt: number }>(
    "/auth/session",
    "",
    { id: challenge.id, wallet: address, signature: signed.signature },
  );
  if (!isCurrent()) throw new Error("Wallet changed. Sign in again.");
  localStorage.setItem(studioSessionKey(address), JSON.stringify(session));
  window.dispatchEvent(new Event("aqua:account-session"));
  return session;
}
