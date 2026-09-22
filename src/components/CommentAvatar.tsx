import { UserRound } from "lucide-react";
import { useWalletX } from "../x-identity";
import { XAvatar } from "./WalletIdentity";

export function CommentAvatar({ wallet }: { wallet: string }) {
  const { profile } = useWalletX(wallet);
  return <span className="comment-avatar" aria-hidden="true">{profile ? <XAvatar profile={profile} key={profile.avatarUrl}/> :
    <UserRound className="comment-avatar-guest" strokeWidth={1.9}/>}</span>;
}
