import { useWalletX } from "../x-identity";
import { XAvatar } from "./WalletIdentity";

export function CommentAvatar({ wallet }: { wallet: string }) {
  const { profile } = useWalletX(wallet);
  let hash = 2166136261;
  for (const char of wallet) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const hue = 180 + hash % 45;
  return <span className="comment-avatar" aria-hidden="true">{profile ? <XAvatar profile={profile} key={profile.avatarUrl}/> :
    <svg viewBox="0 0 7 7" focusable="false"><rect width="7" height="7" rx="1.8" fill={`hsl(${hue} 65% 92%)`}/>
      {Array.from({ length: 15 }, (_, i) => {
        const x = i % 3, y = Math.floor(i / 3);
        if (!((hash >>> i) & 1)) return null;
        return <g key={i} fill={`hsl(${hue} 55% 44%)`}><rect x={x + 1} y={y + 1} width="1" height="1"/>{x < 2 && <rect x={5 - x} y={y + 1} width="1" height="1"/>}</g>;
      })}
    </svg>}</span>;
}
