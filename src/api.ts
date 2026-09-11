import type { Launch, RuntimeConfig, StockOption, Trade } from "./types";

export const API_URL = String(import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

export const api = {
  config: () => request<RuntimeConfig>("/api/config"),
  launches: () => request<{ launches: Launch[] }>("/api/launches"),
  launch: (id: string) => request<{ launch: Launch; trades: Trade[] }>(`/api/launches/${encodeURIComponent(id)}`),
  stocks: () => request<{ stocks: StockOption[] }>("/api/stocks"),
  rewards: () => request<{ epochs: unknown[] }>("/api/rewards"),
  upload: async (body: FormData) => request<{ imageId: string; imageUrl: string }>("/api/uploads", { method: "POST", body }),
  createLaunch: (body: unknown) => request<{ launch: Launch; onchainStatus: string }>("/api/launches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
};
