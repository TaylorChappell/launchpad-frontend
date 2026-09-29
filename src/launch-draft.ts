// Local-only drafts. Never store wallet secrets or signed transactions here.
const writes = new Map<string, Promise<unknown>>();
const retired = new Set<string>();

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("aqua-launch-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function enqueue<T>(key: string, action: () => Promise<T>): Promise<T> {
  const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
  writes.set(key, next);
  void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
  return next;
}
export async function readLaunchDraft<T>(key: string): Promise<T | null> {
  await writes.get(key)?.catch(() => {});
  const db = await database();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const request = db.transaction("drafts").objectStore("drafts").get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export function saveLaunchDraft(key: string, value: { id?: string; [key: string]: unknown }) {
  return enqueue(key, async () => {
    if (value.id && retired.has(`${key}:${value.id}`)) return;
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}
// Delete only the draft that completed; a different draft may have been started meanwhile.
export function removeLaunchDraft(key: string, id?: string) {
  if (id) retired.add(`${key}:${id}`);
  return enqueue(key, async () => {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite"), store = tx.objectStore("drafts");
        const request = store.get(key);
        request.onsuccess = () => { if (request.result?.id === id) store.delete(key); };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}
