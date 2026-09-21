import type { LaunchRelayStatus, SignedTransactionEnvelope } from "./types";

type RelayApi = {
  submitLaunchBatch(id: string, transactions: SignedTransactionEnvelope[], signal?: AbortSignal): Promise<LaunchRelayStatus>;
  launchSubmission(id: string, signal?: AbortSignal): Promise<LaunchRelayStatus>;
};
function retryable(error: unknown) {
  const status = (error as { status?: number })?.status;
  return !status || status === 408 || status === 429 || status >= 500 || (error as { code?: string })?.code === "LAUNCH_BUSY";
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1_500);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Retry the SAME signed batch if acknowledgement is lost; never rebuild here. */
export async function handoffLaunchBatch(api: RelayApi, id: string, transactions: SignedTransactionEnvelope[], signal: AbortSignal, reconnecting: () => void) {
  const canonical = JSON.stringify(transactions.map(({ step, signedTransactionBase64 }) => ({ step, signedTransactionBase64 })));
  const batchHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))), byte => byte.toString(16).padStart(2, "0")).join("");
  for (;;) {
    signal.throwIfAborted();
    try { return await api.submitLaunchBatch(id, transactions, signal); }
    catch (error) {
      signal.throwIfAborted();
      if (!retryable(error)) throw error;
      reconnecting();
      try {
        const state = await api.launchSubmission(id, signal);
        if (state.status === "complete" || state.batchHash === batchHash) return state;
      } catch (readError) {
        signal.throwIfAborted();
        if (!retryable(readError)) throw readError;
      }
      await pause(signal);
    }
  }
}

/** Browser polling is observational: losing it never cancels backend execution. */
export async function watchLaunchSubmission(api: RelayApi, id: string, signal: AbortSignal, onState: (state: LaunchRelayStatus) => void, reconnecting: () => void) {
  for (;;) {
    signal.throwIfAborted();
    try {
      const state = await api.launchSubmission(id, signal);
      onState(state);
      if (!["queued", "running"].includes(state.status)) return state;
    } catch (error) {
      signal.throwIfAborted();
      if (!retryable(error)) throw error;
      reconnecting();
    }
    await pause(signal);
  }
}
