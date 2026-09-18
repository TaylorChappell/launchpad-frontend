export function formatJackpotAmount(raw: string, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const hundredths = (BigInt(raw) * 100n + scale / 2n) / scale;
  return `${(hundredths / 100n).toLocaleString("en-US")}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}
