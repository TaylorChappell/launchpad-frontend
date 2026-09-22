export type XPending = { state: string; wallet: string; returnTo: string; receipt?: string; error?: string };
type Storage = Pick<globalThis.Storage,"getItem"|"setItem">;
export function readPendingX(storage: Storage, key: string): XPending | null {
  try {
    const p=JSON.parse(storage.getItem(key) ?? "null");
    return p && /^[a-f0-9]{64}$/.test(p.state) && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.wallet)
      && typeof p.returnTo === "string" ? p : null;
  } catch { return null; }
}
export function captureXReturn(storage: Storage, key: string, params: URLSearchParams): XPending | null {
  const saved=readPendingX(storage,key), state=params.get("state");
  if (!state) return saved;
  if (!saved || saved.state !== state) return null;
  const receipt=params.get("receipt"), error=params.get("error");
  const next={...saved,receipt:!error && receipt && /^[a-f0-9]{64}$/.test(receipt) ? receipt : undefined,error:error ?? undefined};
  try { storage.setItem(key,JSON.stringify(next)); return next; } catch { return null; }
}
export function xReturnPath(hash: string) { return /^#\/(?!\/)/.test(hash) && !hash.startsWith("#/connect-x") ? hash.slice(1) : "/"; }
