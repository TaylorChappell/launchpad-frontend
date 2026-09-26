import type { LaunchRelayStatus, SignedTransactionEnvelope, LaunchBatchEnvelope, LaunchRetryResponse } from "./types";

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


/** Request each approval only after the prior receipt is confirmed. Never split
 * the liquidity instruction from its atomic opening buy. */
export async function runSequentialLaunch(input: {
  api: RelayApi & {
    prepareLaunchApproval(id:string,creator:string,envelope:LaunchBatchEnvelope,signal?:AbortSignal):Promise<{ready:boolean}>;
    retryLaunchTransaction(id:string,creator:string):Promise<LaunchRetryResponse>;
  };
  id:string;creator:string;batch:LaunchBatchEnvelope[];signal:AbortSignal;
  sign(batch:LaunchBatchEnvelope[]):Promise<SignedTransactionEnvelope[]>;
  onApproval(step:LaunchBatchEnvelope["step"]):void;
  onState(state:LaunchRelayStatus):void;
  reconnecting():void;
}) {
  let batch=input.batch;
  for (let approval=0;approval<6;approval++) {
    input.signal.throwIfAborted();
    const next=batch[0];
    if (!next) throw new Error("The next launch transaction is unavailable.");
    const prepared=await input.api.prepareLaunchApproval(input.id,input.creator,next,input.signal);
    input.signal.throwIfAborted();
    if (!prepared.ready) throw new Error("The next launch step is not ready for approval.");
    input.onApproval(next.step);
    const signed=await input.sign([next]);
    input.signal.throwIfAborted();
    const accepted=await handoffLaunchBatch(input.api,input.id,signed,input.signal,input.reconnecting);
    input.onState(accepted);
    const settled=["complete","needs_approval"].includes(accepted.status)?accepted:await watchLaunchSubmission(input.api,input.id,input.signal,input.onState,input.reconnecting);
    input.signal.throwIfAborted();
    if (settled.status==="complete") return settled;
    if (!settled.approvalReady) throw new Error(settled.error??"Resume to approve the remaining launch steps.");
    // Rebuild after confirmation: use current accounts, quotes and blockhashes.
    const fresh=await input.api.retryLaunchTransaction(input.id,input.creator);
    input.signal.throwIfAborted();
    if (fresh.status==="live") return {...settled,status:"complete" as const};
    batch=fresh.batch??[];
  }
  throw new Error("Launch progress changed. Resume to check the remaining steps.");
}
