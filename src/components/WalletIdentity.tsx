import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useRuntime } from "../context";
import { useWalletX, type XProfile } from "../x-identity";
import { solscanAccountUrl } from "../creator-lock";
export function XAvatar({ profile }: { profile: XProfile }) {
  const [failed, setFailed] = useState(false);
  return profile.avatarUrl && !failed ? <img className="x-avatar" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> : <span className="x-avatar x-avatar-fallback" aria-hidden="true">{profile.name.slice(0,1)}</span>;
}
export function WalletIdentity({ wallet, link = true, explorer = true, avatar = true }: { wallet: string; link?: boolean; explorer?: boolean; avatar?: boolean }) {
  const { profile } = useWalletX(wallet), { config } = useRuntime();
  const short = wallet.length > 16 ? wallet.slice(0,4)+"…"+wallet.slice(-4) : wallet || "—";
  if (!profile) return link ? <a className="wallet-identity-address" href={solscanAccountUrl(wallet, config.network)} target="_blank" rel="noreferrer" title={wallet}>{short}</a> : <span title={wallet}>{short}</span>;
  const content = <>{avatar && <XAvatar key={profile.avatarUrl} profile={profile}/>}<span>@{profile.username}</span></>;
  return <span className="x-identity" title={`${profile.name} · ${wallet}`}>{link ? <a className="x-profile-link" href={profile.profileUrl} target="_blank" rel="noreferrer">{content}</a> : <span className="x-profile-link">{content}</span>}{link && explorer && <a className="x-wallet-explorer" href={solscanAccountUrl(wallet, config.network)} target="_blank" rel="noreferrer" aria-label={`View wallet ${wallet} on Solscan`}><ExternalLink size={11}/></a>}</span>;
}
