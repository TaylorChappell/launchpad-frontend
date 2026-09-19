/** Display only. Billing and balance checks retain their integer micro-USD precision. */
export function usdCredit(microUsd: string, rounding: "nearest" | "up" = "nearest") {
  const value = BigInt(microUsd);
  const magnitude = value < 0n ? -value : value;
  const cents = (magnitude + (rounding === "up" ? 9999n : 5000n)) / 10000n;
  return `${value < 0n && cents > 0n ? "-" : ""}$${(cents / 100n).toLocaleString("en-US")}.${(cents % 100n).toString().padStart(2, "0")}`;
}
