import { API_URL } from "./api";
import { StudioApiError, studioSessionKey } from "./studio-api";
export type GithubConnection = {
  enabled: boolean;
  connected: boolean;
  login: string | null;
  connectedAt: number | null;
};

export async function ensureAccountSession(address: string, signMessage: (message: string) => Promise<{signature:string}>) {
  try {
    const saved = JSON.parse(localStorage.getItem(studioSessionKey(address)) ?? "null");
    if (saved?.token && saved.expiresAt > Date.now()+60_000) return saved.token as string;
  } catch { /* Missing sessions require wallet proof, not just a public address. */ }
  return (await signInAccount(address, signMessage)).token;
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
