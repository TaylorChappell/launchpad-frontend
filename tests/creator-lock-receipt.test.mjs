import test from "node:test";
import assert from "node:assert/strict";
import { creatorLockSubmissionFailed } from "../src/creator-lock-receipt.ts";
const rpc = (statuses, height = 100) => ({getSignatureStatuses:async()=>({value:[statuses.shift()??null]}),getBlockHeight:async()=>height});
test("lock additions keep successful, uncertain and still-valid submissions pending",async()=>{
  for(const confirmationStatus of ["processed","confirmed","finalized"])assert.equal(await creatorLockSubmissionFailed(rpc([{err:null,confirmationStatus}]),"sig",90),false);
  assert.equal(await creatorLockSubmissionFailed(rpc([{err:{failed:true},confirmationStatus:"confirmed"}]),"sig",90),false);
  assert.equal(await creatorLockSubmissionFailed(rpc([null],90),"sig",90),false);
});
test("a failed final transaction or expired missing transaction releases the retry",async()=>{
  assert.equal(await creatorLockSubmissionFailed(rpc([{err:{failed:true},confirmationStatus:"finalized"}]),"sig",90),true);
  assert.equal(await creatorLockSubmissionFailed(rpc([null,null],91),"sig",90),true);
});
test("late receipts and RPC outages cannot authorize a second token deposit",async()=>{
  assert.equal(await creatorLockSubmissionFailed(rpc([null,{err:null,confirmationStatus:"confirmed"}],91),"sig",90),false);
  await assert.rejects(creatorLockSubmissionFailed({getSignatureStatuses:async()=>{throw Error("offline");}},"sig",90));
});
