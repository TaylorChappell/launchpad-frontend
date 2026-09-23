import test from "node:test";
import assert from "node:assert/strict";
import { waitForConfirmation, TransactionOutcomeError } from "../src/transaction-confirmation.ts";

function fixture(statuses, height = 50) {
  let time = 0; const delays = []; let reads = 0; let heights = 0;
  return {
    rpc: { getSignatureStatuses: async () => { reads++; const next = statuses.length > 1 ? statuses.shift() : statuses[0]; if (next instanceof Error) throw next; return { value: [next] }; },
      getBlockHeight: async commitment => { assert.equal(commitment, "finalized"); heights++; return height; } },
    options: { now: () => time, wait: async ms => { delays.push(ms); time += ms; }, timeoutMs: 15000 },
    delays, reads: () => reads, heights: () => heights,
  };
}
const confirmed = { err: null, confirmationStatus: "confirmed" };
test("confirmation survives exhausted RPC rate-limit retries without resubmitting", async () => {
  const f = fixture([Error("429 Too Many Requests"), Error("Failed to fetch"), confirmed]);
  await waitForConfirmation(f.rpc, "signature", 100, f.options);
  assert.equal(f.reads(), 3); assert.ok(f.delays[1] > f.delays[0]);
});
test("confirmed status wins even when the block-height service is unavailable", async () => {
  const f = fixture([confirmed]);
  await waitForConfirmation(f.rpc, "signature", 100, f.options);
  assert.equal(f.heights(), 0);
});
test("preserves the real slippage error and signature", async () => {
  const f = fixture([{ ...confirmed, err: { InstructionError: [2, { Custom: 6036 }] } }]);
  await assert.rejects(waitForConfirmation(f.rpc, "signature", 100, f.options), error => {
    assert.ok(error instanceof TransactionOutcomeError); assert.equal(error.outcome, "failed");
    assert.equal(error.signature, "signature"); assert.match(error.message, /slippage/); return true;
  });
});
test("RPC outage remains pending and retains its signature", async () => {
  const f = fixture([Error("429")]);
  await assert.rejects(waitForConfirmation(f.rpc, "signature", 100, f.options), { outcome: "pending", signature: "signature" });
});
test("expiry rechecks for a transaction that landed during the height read", async () => {
  const f = fixture([null, confirmed], 101);
  await waitForConfirmation(f.rpc, "signature", 100, f.options);
  assert.equal(f.reads(), 2);
});
test("processed signatures remain pending beyond expiry rather than encouraging another buy", async () => {
  const f = fixture([{ err: null, confirmationStatus: "processed" }], 101);
  await assert.rejects(waitForConfirmation(f.rpc, "signature", 100, f.options), { outcome: "pending" });
  assert.equal(f.heights(), 0);
});
test("missing signatures expire only after a finalized height and a second status read", async () => {
  const f = fixture([null], 101);
  await assert.rejects(waitForConfirmation(f.rpc, "signature", 100, f.options), { outcome: "expired" });
  assert.equal(f.reads(), 2);
});
