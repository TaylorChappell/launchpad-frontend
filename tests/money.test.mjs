import {test} from "node:test";
import assert from "node:assert/strict";
import {usd,rawUsd} from "../src/money.ts";
test("missing USD references remain unknown, and exact token quantities are scaled for display only",()=>{
  assert.equal(usd(null),"—");assert.equal(usd(Infinity),"—");assert.equal(usd(0),"$0.00");
  assert.equal(rawUsd("1000000000",9,150),150);
  assert.equal(rawUsd("10000",6,1),.01);
  for(const [raw,decimals,price] of [["1",null,150],["1",9,null],["1",9,0],["bad",9,2],["1",-1,2],["1",NaN,2]])assert.equal(rawUsd(raw,decimals,price),null);
});
