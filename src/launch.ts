export function estimateLaunchFees(solIn: number, rewards: boolean, platformBps: number, rewardsBps: number) {
  const platformFee = solIn * platformBps / 10_000;
  const rewardFee = rewards ? solIn * rewardsBps / 10_000 : 0;
  return { platformFee, rewardFee, netSol: Math.max(0, solIn - platformFee - rewardFee) };
}

export function buildLaunchMessage(input: { wallet: string; requestId: string; symbol: string; stockSymbol: string | null; timestamp: number }) {
  return ["AQUA", "Action: create", `Wallet: ${input.wallet}`, `Request: ${input.requestId}`, `Token: ${input.symbol.toUpperCase()}`, `Pair: ${input.stockSymbol ?? "SOL"}`, `Timestamp: ${input.timestamp}`].join("\n");
}
