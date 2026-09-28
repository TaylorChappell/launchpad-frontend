/** Display estimates only: raw integer strings remain authoritative for transactions. */
export const usd = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
export const compactNumber = (value: number) => Number.isFinite(value) ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value) : "—";
export function rawUsd(raw: string, decimals: number | null, price: number | null | undefined) {
  if (decimals === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 18 || price == null || !Number.isFinite(price) || price <= 0 || !/^\d+$/.test(raw)) return null;
  const value = Number(raw) / 10 ** decimals * price;
  return Number.isFinite(value) ? value : null;
}
