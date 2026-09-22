import test from "node:test";
import assert from "node:assert/strict";
import { confirmLaunchPrerequisites } from "../src/launch-approval.ts";

function setup() {
  const events = [], controller = new AbortController();
  let confirmed = "";
  const io = {
    approve: async step => { events.push(`approve:${step}`); if (step === "liquidity") assert.equal(confirmed, "pool"); return { step }; },
    submit: async envelope => { events.push(`submit:${envelope.step}`); return envelope.step; },
    confirm: async signature => { events.push(`confirm:${signature}`); confirmed = signature; },
    refresh: async () => { events.push("refresh"); return { batch: confirmed === "pool" ? [{ step: "liquidity" }, { step: "lock" }] : [{ step: "lock" }] }; },
  };
  const run = batch => confirmLaunchPrerequisites(batch, io, controller.signal, () => {});
  return { events, controller, io, run };
}
test("confirms each prerequisite before the next wallet prompt and leaves the final lock for the backend handoff", async () => {
  const s = setup();
  assert.deepEqual(await s.run([{ step: "pool" }, { step: "liquidity" }, { step: "lock" }]), { step: "lock" });
  assert.deepEqual(s.events, ["approve:pool", "submit:pool", "confirm:pool", "refresh", "approve:liquidity", "submit:liquidity", "confirm:liquidity", "refresh"]);
});
test("does not request another signature when prerequisite confirmation fails", async () => {
  const s = setup(); s.io.confirm = async () => { throw Error("RPC unavailable"); };
  await assert.rejects(s.run([{ step: "pool" }]), /RPC unavailable/);
  assert.deepEqual(s.events, ["approve:pool", "submit:pool"]);
});
test("wallet rejection never broadcasts a transaction", async () => {
  const s = setup(); s.io.approve = async () => { throw Error("User rejected"); };
  await assert.rejects(s.run([{ step: "pool" }]), /User rejected/); assert.deepEqual(s.events, []);
});
test("aborting after wallet approval prevents submission", async () => {
  const s = setup(); s.io.approve = async step => { s.controller.abort(); return { step }; };
  await assert.rejects(s.run([{ step: "pool" }]), { name: "AbortError" }); assert.deepEqual(s.events, []);
});
test("a stale refresh cannot cause the same launch step to be sent twice", async () => {
  const s = setup(); s.io.refresh = async () => ({ batch: [{ step: "pool" }] });
  await assert.rejects(s.run([{ step: "pool" }]), /next launch approval/);
  assert.equal(s.events.filter(e => e.startsWith("submit:")).length, 1);
});
test("a lock-only resume needs no further prerequisite transactions", async () => {
  const s = setup(); await s.run([{ step: "lock" }]); assert.deepEqual(s.events, []);
});
