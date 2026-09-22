import { API_URL, ApiError } from "./api";
import { studioSessionKey } from "./studio-api";
import type { TransactionEnvelope } from "./types";

export type ProjectUpdate = { id: string; launchId: string; authorWallet: string; body: string; createdAt: number };
export type RewardDeposit = {
  id: string; launchId: string; amountLamports: string; rewardMode: string; targetSymbol: string;
  status: "prepared" | "queued" | "received" | "credited" | "failed" | "expired";
  signature: string | null; conversionSignature: string | null; outputRaw: string | null;
  createdAt: number; updatedAt: number; retrying: boolean;
};
async function request<T>(path: string, token = "", body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}/api/launches/${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", signal: AbortSignal.timeout(25000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    // Remove only the rejected session; the next explicit action can reauthenticate.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(studioSessionKey("")) && JSON.parse(localStorage.getItem(key) ?? "null")?.token === token) localStorage.removeItem(key);
      }
    } catch { /* Storage can be unavailable. */ }
  }
  if (!response.ok) throw new ApiError(result.error ?? "Could not complete this request.", response.status, result);
  return result;
}
export function savedCreatorSession(wallet: string | null) {
  if (!wallet) return "";
  try { const saved = JSON.parse(localStorage.getItem(studioSessionKey(wallet)) ?? "null"); return saved?.expiresAt > Date.now() + 60000 ? String(saved.token ?? "") : ""; } catch { return ""; }
}
export const creatorApi = {
  updates: (id: string, offset = 0) => request<{ updates: ProjectUpdate[]; hasMore: boolean }>(`${encodeURIComponent(id)}/project-updates?offset=${offset}`),
  publish: (id: string, token: string, update: { id: string; body: string }) => request<{ update: ProjectUpdate }>(`${encodeURIComponent(id)}/project-updates`, token, update),
  deposits: (id: string, token: string) => request<{ deposits: RewardDeposit[] }>(`${encodeURIComponent(id)}/reward-deposits`, token),
  prepareDeposit: (id: string, token: string, deposit: { id: string; amountLamports: string }) => request<{ deposit: RewardDeposit; envelope: TransactionEnvelope; slippageBps: number }>(`${encodeURIComponent(id)}/reward-deposits`, token, deposit),
  submitDeposit: (id: string, token: string, depositId: string, signedTransactionBase64: string) => request<{ deposit: RewardDeposit }>(`${encodeURIComponent(id)}/reward-deposits/${encodeURIComponent(depositId)}/submit`, token, { signedTransactionBase64 }),
};
