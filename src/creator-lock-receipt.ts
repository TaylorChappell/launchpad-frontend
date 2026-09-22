import type { Connection } from "@solana/web3.js";

export async function creatorLockSubmissionFailed(rpc: Pick<Connection,"getSignatureStatuses"|"getBlockHeight">, signature: string, lastValidBlockHeight: number) {
  const status = (await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
  if (status) return Boolean(status.err && status.confirmationStatus === "finalized");
  if (await rpc.getBlockHeight("finalized") <= lastValidBlockHeight) return false;
  // A submission may have landed while the final block height was being read.
  const recheck = (await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
  return !recheck;
}
