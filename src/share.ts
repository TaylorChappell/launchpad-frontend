const REWARDS_URL = "https://aquafamily.fun/#/rewards";

export function rewardClaimShareText(amount: string, total: string) {
  return `Just claimed ${amount} in rewards from @aqua_launchpad 💧\n\nThat's ${total} in total rewards I've claimed so far 🌊\n\nCheck yours here 👇\n${REWARDS_URL}`;
}

export function creatorLockShareText(input: { amount: string; symbol: string; lockUrl: string }) {
  return `Just locked ${input.amount} $${input.symbol} on @aqua_launchpad 💧\n\nView the verified lock here 👇\n${input.lockUrl}`;
}

export function openXComposer(text: string) {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
