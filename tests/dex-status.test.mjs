import { test } from "node:test";
import assert from "node:assert/strict";
import { dexBadgeState } from "../src/dex-status.ts";

test("market badges distinguish voting, accumulating, funded and paid", () => {
  assert.equal(dexBadgeState({ dexFundingStatus: "voting" }), "vote");
  assert.equal(dexBadgeState({ dexFundingStatus: "funding" }), "funding");
  for (const status of ["ready", "withdrawing", "withdrawn"]) assert.equal(dexBadgeState({ dexFundingStatus: status }), "funded");
  assert.equal(dexBadgeState({ dexPaid: true, dexFundingStatus: "voting" }), "paid");
  assert.equal(dexBadgeState({}), null);
});

test("fresh proposal data updates the header and clears rejected votes", () => {
  const launch = { dexFundingStatus: "voting" };
  const data = { dexPaid: false, proposals: [{ type: "dex_payment", status: "funding" }, { type: "dex_update", status: "voting" }] };
  assert.equal(dexBadgeState(launch, data), "funding");
  assert.equal(dexBadgeState(launch, { ...data, proposals: [{ type: "dex_payment", status: "rejected" }, { type: "cto", status: "voting" }] }), null);
  assert.equal(dexBadgeState(launch, { ...data, dexPaid: true }), "paid");
});
