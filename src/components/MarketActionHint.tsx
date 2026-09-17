import { useId, type ReactNode } from "react";

export function MarketActionHint({ text, disabled = false, children }: { text: string; disabled?: boolean; children: ReactNode }) {
  const id = useId();
  return <span className="market-action-hint" tabIndex={disabled ? 0 : undefined} aria-describedby={id}>
    {children}<span id={id} role="tooltip">{text}</span>
  </span>;
}

export function holdingPercent(raw: string | undefined, totalRaw: string | undefined) {
  if (!raw || !totalRaw || BigInt(totalRaw) <= 0n) return "Unavailable";
  const value = BigInt(raw) * 1_000_000n / BigInt(totalRaw);
  return `${new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value) / 10_000)}%`;
}
