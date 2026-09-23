type SolflareLike = { isSolflare?: boolean };

export function getSolflareProvider<T extends SolflareLike>(target: { solflare?: T }): T | undefined {
  return target.solflare?.isSolflare ? target.solflare : undefined;
}

export function solflareBrowseUrl(href: string) {
  const url = new URL(href);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Open AQUA over HTTPS to connect Solflare.");
  }
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(url.href)}?ref=${encodeURIComponent(url.origin)}`;
}

// Solflare can return the signature bytes directly; Phantom wraps them.
export function messageSignature(result: Uint8Array | { signature: Uint8Array }): Uint8Array {
  const signature = result instanceof Uint8Array ? result : result?.signature;
  if (!(signature instanceof Uint8Array) || signature.length !== 64) {
    throw new Error("The wallet did not return a valid message signature. Connect again.");
  }
  return signature;
}
