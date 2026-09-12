export function buildLaunchMessage(input: { wallet: string; requestId: string; symbol: string; stockSymbol: string; timestamp: number }) {
  return [
    "AQUA",
    "Action: create launch intent",
    `Wallet: ${input.wallet}`,
    `Request: ${input.requestId}`,
    `Token: ${input.symbol.toUpperCase()}`,
    `Reward stock: ${input.stockSymbol}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

export function decimalToRaw(value: string, decimals: number) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Enter a valid stock amount.");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`This stock supports up to ${decimals} decimal places.`);
  return `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "") || "0";
}
