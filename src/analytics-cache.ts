export const ANALYTICS_REFRESH_MS = 5 * 60_000;
const snapshotLifetime = 30 * 60_000;
type Snapshot<T> = { key: string; at: number; data: T };

/** Public analytics only. Keep completed periods and in-flight reads across
 * navigation; switching tabs must not abort useful work or start it again. */
export function createAnalyticsCache<T>(storageKey: string, validate: (value: unknown, key: string) => value is T, limit = 24) {
  const snapshots = new Map<string, Snapshot<T>>();
  const pending = new Map<string, Promise<T>>();
  let restored = false;
  const valid = (snapshot: Snapshot<T>, now: number) => snapshot && typeof snapshot.key === "string"
    && Number.isFinite(snapshot.at) && now >= snapshot.at && now - snapshot.at < snapshotLifetime
    && validate(snapshot.data, snapshot.key);
  function restore(now: number) {
    if (restored) return;
    restored = true;
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) for (const snapshot of saved.slice(-limit)) {
        if (valid(snapshot, now)) snapshots.set(snapshot.key, snapshot);
      }
    } catch { /* Memory caching works when browser storage is unavailable. */ }
  }
  function read(key: string, now = Date.now()): T | null {
    restore(now);
    const snapshot = snapshots.get(key);
    if (!snapshot || !valid(snapshot, now)) { snapshots.delete(key); return null; }
    return snapshot.data;
  }
  function load(key: string, request: () => Promise<T>, refresh = false): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing;
    const now = Date.now(), cached = read(key, now);
    if (!refresh && cached && now - snapshots.get(key)!.at < ANALYTICS_REFRESH_MS) return Promise.resolve(cached);
    const work = Promise.resolve().then(request).then(data => {
      if (!validate(data, key)) throw new Error("Analytics period data unavailable.");
      const at = Date.now();
      snapshots.delete(key);
      snapshots.set(key, { key, at, data });
      for (const [id, snapshot] of snapshots) if (!valid(snapshot, at)) snapshots.delete(id);
      while (snapshots.size > limit) snapshots.delete(snapshots.keys().next().value!);
      try { sessionStorage.setItem(storageKey, JSON.stringify([...snapshots.values()])); } catch { /* Retain the in-memory result. */ }
      return data;
    }).finally(() => { if (pending.get(key) === work) pending.delete(key); });
    pending.set(key, work);
    return work;
  }
  return { read, load };
}
