import type { LaunchBatchEnvelope, SignedTransactionEnvelope } from "./types";

export async function confirmLaunchPrerequisites(batch: LaunchBatchEnvelope[], io: {
  approve(step: "pool" | "liquidity"): Promise<SignedTransactionEnvelope>;
  submit(envelope: SignedTransactionEnvelope): Promise<string>;
  confirm(signature: string): Promise<unknown>;
  refresh(): Promise<{ batch?: LaunchBatchEnvelope[] }>;
}, signal: AbortSignal, progress: (step: "pool" | "liquidity", status: "active" | "done") => void) {
  const order = ["pool", "liquidity", "lock"];
  let last = -1;
  while (batch[0]?.step !== "lock") {
    signal.throwIfAborted();
    const step = batch[0]?.step;
    if (!step || order.indexOf(step) <= last) throw new Error("The next launch approval is unavailable. Resume to continue.");
    last = order.indexOf(step);
    progress(step, "active");
    const approved = await io.approve(step);
    signal.throwIfAborted();
    const signature = await io.submit(approved);
    signal.throwIfAborted();
    await io.confirm(signature);
    progress(step, "done");
    signal.throwIfAborted();
    batch = (await io.refresh()).batch ?? [];
  }
  signal.throwIfAborted();
  if (batch.length !== 1) throw new Error("The final approval must contain only the liquidity lock.");
  return batch[0];
}
