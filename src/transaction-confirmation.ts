type Status = { err: unknown; confirmationStatus?: string | null } | null;
type ConfirmationRpc = {
  getSignatureStatuses(signatures: string[], options: { searchTransactionHistory: boolean }): Promise<{ value: Status[] }>;
  getBlockHeight(commitment: "finalized"): Promise<number>;
};

export class TransactionOutcomeError extends Error {
  readonly signature: string;
  readonly outcome: "failed" | "expired" | "pending";
  constructor(signature: string, outcome: "failed" | "expired" | "pending", message: string) {
    super(message); this.name = "TransactionOutcomeError"; this.signature = signature; this.outcome = outcome;
  }
}

function failed(signature: string, error: unknown) {
  const detail = JSON.stringify(error);
  const slippage = /"Custom":6036\b|AmountOutBelowMinimum/.test(detail);
  return new TransactionOutcomeError(signature, "failed", slippage
    ? "The buy failed because the price moved beyond your slippage limit. No purchase was made. Refresh the quote before approving again."
    : `The transaction failed on Solana. Reference: ${signature}. Error: ${detail}`);
}

/** A transport error says nothing about execution. Never submit another purchase here. */
export async function waitForConfirmation(rpc: ConfirmationRpc, signature: string, lastValidBlockHeight: number,
  options: { now?: () => number; wait?: (ms: number) => Promise<void>; timeoutMs?: number } = {}) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const deadline = now() + (options.timeoutMs ?? 180_000);
  let retryDelay = 1_200;
  const inspect = (status: Status) => {
    // Processed status may be on a fork. Only decide success/failure after confirmation.
    if (status?.confirmationStatus !== "confirmed" && status?.confirmationStatus !== "finalized") return false;
    if (status.err) throw failed(signature, status.err);
    return true;
  };
  while (now() < deadline) {
    try {
      const status = (await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0] ?? null;
      if (inspect(status)) return;
      if (!status && await rpc.getBlockHeight("finalized") > lastValidBlockHeight) {
        const finalStatus = (await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0] ?? null;
        if (inspect(finalStatus)) return;
        if (!finalStatus) throw new TransactionOutcomeError(signature, "expired", "The transaction expired before it was confirmed. Check its explorer status before approving a replacement: " + signature);
      }
      retryDelay = 1_200;
    } catch (error) {
      if (error instanceof TransactionOutcomeError) throw error;
      retryDelay = Math.min(retryDelay * 2, 10_000);
    }
    await wait(Math.min(retryDelay, Math.max(0, deadline - now())));
  }
  throw new TransactionOutcomeError(signature, "pending", "Transaction submitted. Solana confirmation is still unavailable; do not submit another purchase. Check " + signature + " on the explorer.");
}
