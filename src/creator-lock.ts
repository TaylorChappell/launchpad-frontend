import type { CreatorLock } from "./types";

export function activeCreatorLock(lock: CreatorLock | null | undefined) {
  return lock?.status === "active" && lock.vaultTokenAccount && lock.amountRaw !== "0" ? lock : null;
}

export function creatorLockPercent(lock: CreatorLock | null | undefined) {
  const active = activeCreatorLock(lock);
  if (!active) return 0;
  try {
    const amount = BigInt(active.amountRaw);
    const supply = BigInt(active.totalSupplyRaw);
    if (amount <= 0n || supply <= 0n) return 0;
    return Number(amount * 100_000_000n / supply) / 1_000_000;
  } catch {
    return 0;
  }
}

export function creatorLockPercentLabel(lock: CreatorLock | null | undefined) {
  const percent = creatorLockPercent(lock);
  if (percent <= 0) return "0%";
  return `${percent.toFixed(percent < 0.01 ? 4 : 2).replace(/\.?0+$/, "")}%`;
}

export function solscanAccountUrl(address: string, network: "devnet" | "mainnet-beta") {
  return `https://solscan.io/account/${address}${network === "devnet" ? "?cluster=devnet" : ""}`;
}
