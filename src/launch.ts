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
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error("This asset has an invalid decimal configuration.");
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) throw new Error("Enter a valid amount.");
  const [wholeInput, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`This asset supports up to ${decimals} decimal places.`);
  const whole = wholeInput || "0";
  return `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "") || "0";
}
