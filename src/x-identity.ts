import { xReturnPath } from "./x-link-state";
import { useEffect, useSyncExternalStore } from "react";
import { API_URL } from "./api";
import { ensureAccountSession } from "./account-api";
import { studioSessionKey } from "./studio-api";
export type XProfile = { id: string; username: string; name: string; avatarUrl: string | null; profileUrl: string; connectedAt: number; updatedAt: number };
type Entry = { profile: XProfile | null; loaded: boolean; until: number };
const empty: Entry = { profile: null, loaded: false, until: 0 };
const entries = new Map<string, Entry>(), listeners = new Map<string, Set<() => void>>(), pending = new Set<string>(), inflight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const validWallet = (wallet: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
function emit(wallet: string) { listeners.get(wallet)?.forEach(fn => fn()); }
export function setWalletX(wallet: string, profile: XProfile | null) { entries.set(wallet, { profile, loaded: true, until: Date.now()+60000 }); emit(wallet); }
async function flush() {
  timer = undefined;
  const wallets = [...pending].slice(0, 100); wallets.forEach(w => { pending.delete(w); inflight.add(w); });
  if (!wallets.length) return;
  const versions = wallets.map(wallet => entries.get(wallet));
  try {
    const response = await fetch(`${API_URL}/v1/wallets/x?wallets=${wallets.join(",")}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Profiles unavailable");
    const { profiles } = await response.json();
    wallets.forEach((wallet, i) => { if (entries.get(wallet) === versions[i]) setWalletX(wallet, profiles[wallet] ?? null); });
  } catch {
    wallets.forEach(wallet => { const previous = entries.get(wallet) ?? empty; entries.set(wallet, { ...previous, until: Date.now()+30000 }); emit(wallet); });
  } finally { wallets.forEach(w => inflight.delete(w)); if (pending.size) timer = setTimeout(() => void flush(), 30); }
}
function queue(wallet: string) {
  if (!validWallet(wallet) || inflight.has(wallet) || (entries.get(wallet)?.until ?? 0) > Date.now()) return;
  pending.add(wallet); if (!timer) timer = setTimeout(() => void flush(), 30);
}
export function useWalletX(wallet: string | null | undefined) {
  const key = wallet ?? "";
  const state = useSyncExternalStore(fn => { const set = listeners.get(key) ?? new Set(); set.add(fn); listeners.set(key,set); return () => { set.delete(fn); if (!set.size) listeners.delete(key); }; }, () => entries.get(key) ?? empty);
  useEffect(() => { if (!key) return; queue(key); const refresh = () => { if (document.visibilityState === "visible") queue(key); }; const timer = window.setInterval(refresh, 60000); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, [key]);
  return state;
}
export async function xRequest<T>(path: string, token = "", body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`${API_URL}/account/x${path}`, { method: method ?? (body === undefined ? "GET" : "POST"), cache: "no-store", signal: AbortSignal.timeout(30000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) { try { for (const key of Object.keys(localStorage)) { if (key.startsWith(studioSessionKey("")) && JSON.parse(localStorage.getItem(key) ?? "null")?.token === token) localStorage.removeItem(key); } } catch { /* Storage may be disabled. */ } }
    throw new Error(data.error ?? "X connection could not finish. Please try again.");
  }
  return data;
}
export const xPendingKey = `aqua:x-link:${API_URL}`;
export async function connectX(wallet: string, sign: (message: string) => Promise<{ signature: string }>, isCurrent: () => boolean) {
  const token = await ensureAccountSession(wallet, sign);
  if (!isCurrent()) throw new Error("Wallet changed. Connect X again.");
  const result = await xRequest<{ url: string; state: string }>("/connect", token, {});
  if (!isCurrent()) throw new Error("Wallet changed. Connect X again.");
  sessionStorage.setItem(xPendingKey, JSON.stringify({ state: result.state, wallet, returnTo: "#" + xReturnPath(window.location.hash) }));
  window.location.assign(result.url);
}
