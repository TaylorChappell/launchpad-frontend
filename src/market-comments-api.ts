import { API_URL, ApiError } from "./api";
import { studioSessionKey } from "./studio-api";
import type { CommentPage, MarketComment } from "./market-comments";

async function request<T>(id: string, query: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/launches/${encodeURIComponent(id)}/comments${query}`, {
    ...init, cache: "no-store",
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.error ?? "Could not load comments. Please try again.", response.status, result);
  return result;
}

export const commentsApi = {
  list: (id: string, cursor: string | null, signal?: AbortSignal) =>
    request<CommentPage>(id, cursor ? `?cursor=${encodeURIComponent(cursor)}` : "", { signal }),
  async publish(id: string, wallet: string, token: string, comment: { id: string; body: string; replyTo?: string | null }) {
    try {
      return await request<{ comment: MarketComment }>(id, "", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(comment),
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          const key = studioSessionKey(wallet);
          if (JSON.parse(localStorage.getItem(key) ?? "null")?.token === token) localStorage.removeItem(key);
        } catch { /* A rejected session will need another wallet sign-in. */ }
      }
      throw error;
    }
  },
};
