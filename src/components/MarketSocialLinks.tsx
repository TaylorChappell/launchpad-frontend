import { Copy, Globe2, Send } from "lucide-react";
import { toast } from "sonner";
import type { Launch } from "../types";
import { XLogo } from "./XConnect";

function externalUrl(value?: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function MarketSocialLinks({launch, className = "", copyAddress}: {launch: Pick<Launch, "name" | "xUrl" | "websiteUrl" | "telegramUrl">; className?: string; copyAddress?: string}) {
  const links = [
    {href: externalUrl(launch.xUrl), label: `${launch.name} on X`, icon: <XLogo/>},
    {href: externalUrl(launch.telegramUrl), label: `${launch.name} on Telegram`, icon: <Send size={16}/>},
    {href: externalUrl(launch.websiteUrl), label: `${launch.name} website`, icon: <Globe2 size={17}/>},
  ].filter(link => link.href);
  async function copyContractAddress() {
    if (!copyAddress) return;
    try { await navigator.clipboard.writeText(copyAddress); toast.success("Contract address copied"); }
    catch { toast.error("Clipboard unavailable. Please try again."); }
  }
  if (!links.length && !copyAddress) return null;
  return <nav className={`market-social-links ${className}`} aria-label={`${launch.name} links`}>
    {links.map(link => <a key={link.label} href={link.href!} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>{link.icon}</a>)}
    {copyAddress && <button type="button" className="card-copy-ca" aria-label="Copy contract address" title="Copy contract address" onClick={() => void copyContractAddress()}><span>CA</span><Copy size={14}/></button>}
  </nav>;
}
