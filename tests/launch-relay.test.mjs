import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { handoffLaunchBatch, watchLaunchSubmission } from "../src/launch-relay.ts";

const batch = [{ step: "lock", signedTransactionBase64: "signed-by-wallet" }];
const batchHash = createHash("sha256").update(JSON.stringify(batch)).digest("hex");
const accepted = { launchId: "coin", mint: "mint", status: "queued", batchHash, step: "lock", error: null, rebuildRequired: false };

test("lost handoff acknowledgement recovers the accepted batch without rebuilding", async () => {
  let submissions = 0; let reconnects = 0;
  const api = { submitLaunchBatch: async () => { submissions++; throw new TypeError("Failed to fetch"); }, launchSubmission: async () => accepted };
  assert.deepEqual(await handoffLaunchBatch(api, "coin", batch, new AbortController().signal, () => reconnects++), accepted);
  assert.equal(submissions, 1); assert.equal(reconnects, 1);
});

test("an unaccepted handoff retries identical signed bytes", async () => {
  const submissions = [];
  const api = {
    submitLaunchBatch: async (_id, transactions) => { submissions.push(transactions); if (submissions.length === 1) throw new TypeError("offline"); return accepted; },
    launchSubmission: async () => ({ ...accepted, status: "not_submitted", batchHash: null }),
  };
  assert.deepEqual(await handoffLaunchBatch(api, "coin", batch, new AbortController().signal, () => {}), accepted);
  assert.equal(submissions.length, 2); assert.strictEqual(submissions[0], submissions[1]);
});

test("an old expired batch is not mistaken for acknowledgement of a fresh approval", async () => {
  let calls = 0;
  const api = { submitLaunchBatch: async () => { if (++calls === 1) throw new TypeError("lost"); return accepted; }, launchSubmission: async () => ({ ...accepted, batchHash: "old", status: "needs_approval" }) };
  assert.deepEqual(await handoffLaunchBatch(api, "coin", batch, new AbortController().signal, () => {}), accepted);
  assert.equal(calls, 2);
});

test("validation errors do not cause an infinite submission loop", async () => {
  let calls = 0;
  const api = { submitLaunchBatch: async () => { calls++; throw Object.assign(Error("invalid signature"), { status: 400 }); }, launchSubmission: async () => accepted };
  await assert.rejects(handoffLaunchBatch(api, "coin", batch, new AbortController().signal, () => {}), /invalid signature/);
  assert.equal(calls, 1);
});

test("lost status reads reconnect without resubmitting transactions", async () => {
  let reads = 0; let reconnects = 0;
  const api = { submitLaunchBatch: async () => { assert.fail("must not submit while observing"); }, launchSubmission: async () => { if (++reads === 1) throw new TypeError("offline"); return { ...accepted, status: "complete" }; } };
  const result = await watchLaunchSubmission(api, "coin", new AbortController().signal, () => {}, () => reconnects++);
  assert.equal(result.status, "complete"); assert.equal(reconnects, 1);
});

test("unmounting cancels browser polling only", async () => {
  const controller = new AbortController(); controller.abort();
  const api = { launchSubmission: async () => assert.fail("aborted watcher must not read") };
  await assert.rejects(watchLaunchSubmission(api, "coin", controller.signal, () => {}, () => {}), { name: "AbortError" });
});

test("launch UI removes the step list and keeps exactly two completion actions", () => {
  const source = readFileSync(new URL("../src/pages/Create.tsx", import.meta.url), "utf8");
  const launching = source.slice(source.indexOf('<section className="launch-simple-status">'), source.indexOf('{completedLaunch ?'));
  assert.doesNotMatch(launching, /<ol|<li|chainSteps\.filter/);
  const actions = source.slice(source.indexOf('<div className="launch-complete-actions">'), source.indexOf('</section> : <>'));
  assert.match(actions, /Go to coin/); assert.match(actions, /Launch another coin/);
  assert.doesNotMatch(actions, /Build website|Manage creator lock|Copy market link/);
  assert.equal((actions.match(/<(?:a|button|Link)\b/g) ?? []).length, 2);
  const execution = source.slice(source.indexOf('async function executeLaunchBatch'), source.indexOf('async function continueLaunch'));
  assert.doesNotMatch(execution, /signTransactionBatch/);
  assert.match(execution, /confirmLaunchPrerequisites/);
  assert.match(execution, /signedBatch = \[await approveLaunchStep\(id, "lock"\)\]/);
});
