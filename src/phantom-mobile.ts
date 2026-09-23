type PhantomLike = { isPhantom?: boolean };

export function getPhantomProvider<T extends PhantomLike>(target: { phantom?: { solana?: T }; solana?: T }): T | undefined {
  if (target.phantom?.solana?.isPhantom) return target.phantom.solana;
  if (target.solana?.isPhantom) return target.solana;
  return undefined;
}

export function isMobileBrowser(device: { userAgent: string; maxTouchPoints?: number } = navigator) {
  return /Android|iPhone|iPad|iPod/i.test(device.userAgent)
    || (/Macintosh/i.test(device.userAgent) && (device.maxTouchPoints ?? 0) > 1);
}

export function phantomBrowseUrl(href: string) {
  const url = new URL(href);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Open AQUA over HTTPS to connect Phantom.");
  }
  return `https://phantom.app/ul/browse/${encodeURIComponent(url.href)}?ref=${encodeURIComponent(url.origin)}`;
}
