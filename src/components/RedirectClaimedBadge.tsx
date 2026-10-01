import { BadgeCheck } from 'lucide-react';
import type { Launch } from '../types';
import '../fee-redirect.css';
export function RedirectClaimedBadge({launch}:{launch:Pick<Launch,'rewardMode'|'redirectClaimed'>}){
  if(launch.rewardMode!=='fee_redirect'||!launch.redirectClaimed)return null;
  return <span className="redirect-claimed-badge" title="The redirect recipient has received a confirmed reward payout. This is not an endorsement of the coin."><BadgeCheck size={14} aria-hidden="true"/>Recipient claimed</span>;
}
