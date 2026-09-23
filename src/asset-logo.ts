import { API_URL } from "./api";
export function assetLogoUrl(url: string | null | undefined) {
  return url?.startsWith("/api/pair-icons/") ? `${API_URL}${url}` : url ?? null;
}
