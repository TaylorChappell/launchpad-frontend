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
  assert.doesNotMatch(execution, /submitSignedTransaction|validateBatchStep|confirmLaunch/);
});

async function sequentialFixture() {
  const {runSequentialLaunch}=await import('../src/launch-relay.ts');
  const events=[];let confirmed=0;
  const steps=['pool','prepare','liquidity','lock'];
  const batch=steps.map(step=>({step,transactionBase64:step,transactionVersion:0}));
  const state=()=>({launchId:'coin',mint:'mint',status:confirmed===4?'complete':'needs_approval',approvalReady:confirmed<4,error:null});
  const api={
    prepareLaunchApproval:async(_id,_creator,envelope)=>{assert.equal(envelope.step,steps[confirmed]);events.push('simulate:'+envelope.step);return {ready:true};},
    submitLaunchBatch:async(_id,transactions)=>{assert.equal(transactions.length,1);assert.equal(transactions[0].step,steps[confirmed]);events.push('confirm:'+steps[confirmed++]);return state();},
    launchSubmission:async()=>state(),
    retryLaunchTransaction:async()=>{events.push('rebuild');return {batch:batch.slice(confirmed)};},
  };
  const input={api,id:'coin',creator:'wallet',batch,signal:new AbortController().signal,
    sign:async batch=>{events.push('sign:'+batch[0].step);return batch.map(envelope=>({...envelope,signedTransactionBase64:'signed:'+envelope.step}));},onApproval:()=>{},onState:()=>{},reconnecting:()=>{}};
  return {runSequentialLaunch,input,events};
}
test('launch approvals follow successful simulations and confirmed prerequisites',async()=>{
  const f=await sequentialFixture();const result=await f.runSequentialLaunch(f.input);assert.equal(result.status,'complete');
  assert.deepEqual(f.events,['simulate:pool','sign:pool','confirm:pool','rebuild','simulate:prepare','sign:prepare','confirm:prepare','rebuild','simulate:liquidity','sign:liquidity','confirm:liquidity','rebuild','simulate:lock','sign:lock','confirm:lock']);
});
test('failed simulation never opens the wallet or submits a launch step',async()=>{
  const f=await sequentialFixture();f.input.api.prepareLaunchApproval=async()=>{throw Error('Account not ready');};
  await assert.rejects(f.runSequentialLaunch(f.input),/Account not ready/);assert.deepEqual(f.events,[]);
});
test('cancelled approval stops before submitting or requesting another step',async()=>{
  const f=await sequentialFixture();f.input.sign=async()=>{throw Error('User declined');};
  await assert.rejects(f.runSequentialLaunch(f.input),/User declined/);assert.deepEqual(f.events,['simulate:pool']);
});
test('failed on-chain execution does not request dependent approvals',async()=>{
  const f=await sequentialFixture();f.input.api.submitLaunchBatch=async()=>({status:'needs_approval',approvalReady:false,error:'Transaction failed'});
  await assert.rejects(f.runSequentialLaunch(f.input),/Transaction failed/);assert.deepEqual(f.events,['simulate:pool','sign:pool']);
});
