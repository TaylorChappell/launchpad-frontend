export function quoteAmounts(quote: Record<string, unknown>) {
  const estimated = String(quote.tokenEstOut ?? quote.outAmount ?? "");
  const minimum = String(quote.tokenMinOut ?? quote.otherAmountThreshold ?? "");
  if (!/^\d+$/.test(estimated) || !/^\d+$/.test(minimum) || BigInt(estimated) <= 0n || BigInt(minimum) <= 0n || BigInt(minimum) > BigInt(estimated)) {
    throw new Error("A reliable quote is unavailable for this amount. Try a different amount or payment asset.");
  }
  return { estimated, minimum };
}

export function displayTokenAmount(raw: string, decimals: number) {
  const padded = raw.padStart(decimals + 1, "0");
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, "") : "";
  return BigInt(whole).toLocaleString("en-US") + (fraction ? "." + fraction : "");
}
