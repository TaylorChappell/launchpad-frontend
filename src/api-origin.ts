export const AQUA_PUBLIC_API_ORIGIN = "https://aquafamily.fun";
export const LEGACY_PUBLIC_API_ORIGIN = "https://launchpad-backend-production-63dc.up.railway.app";

// Upgrade only the former production origin. Explicit staging/local backends stay isolated.
export function resolveApiOrigin(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) continue;
    try {
      const url = new URL(value.trim());
      if (url.username || url.password || url.search || url.hash) continue;
      const origin = url.href.replace(/\/$/, "");
      return origin === LEGACY_PUBLIC_API_ORIGIN ? AQUA_PUBLIC_API_ORIGIN : origin;
    } catch { /* Try the next configuration source. */ }
  }
  return AQUA_PUBLIC_API_ORIGIN;
}
