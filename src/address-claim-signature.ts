import bs58 from "bs58";

export function addressClaimSignature(input: string): string {
  let signature = input.trim();
  if (/^https?:\/\//i.test(signature)) {
    const url = new URL(signature);
    const match = url.pathname.match(/^\/tx\/([^/]+)\/?$/);
    if (!["solscan.io", "explorer.solana.com"].includes(url.hostname) || !match) throw new Error("Paste a Solana transaction signature or its Solscan link.");
    signature = match[1];
  }
  try { if (bs58.decode(signature).length === 64) return signature; } catch { /* Show the same clear error for malformed signatures. */ }
  throw new Error("Paste a valid Solana transaction signature or its Solscan link.");
}
