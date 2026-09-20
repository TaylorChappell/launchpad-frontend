import {readWithRetry} from "../src/read-retry.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {mergeTrades,tradeTime} from "../src/trade-history.ts";
import {cachedRead,clearReadCache} from "../src/read-cache.ts";
test("live activity merges without dropping older pages or duplicating trades",()=>{
  const previous=Array.from({length:20},(_,i)=>({id:String(20-i),block_time:20-i,wallet:"a",side:"buy"}));
  const merged=mergeTrades(previous,[{id:"21",block_time:21,wallet:"b",side:"sell"},...previous.slice(0,10)]);
  assert.equal(merged.length,21);assert.equal(merged.at(-1).id,"1");assert.equal(merged[0].id,"21");
});
test("chain time takes precedence over delayed ingestion",()=>{
  assert.equal(tradeTime({block_time:100,created_at:999999}),100000);
});
test("read cache deduplicates requests, invalidates values, and never caches errors",async()=>{
  clearReadCache();let calls=0;const read=async()=>++calls;
  assert.deepEqual(await Promise.all([cachedRead("a",read),cachedRead("a",read)]),[1,1]);
  clearReadCache();assert.equal(await cachedRead("a",read),2);
  await assert.rejects(cachedRead("bad",async()=>{throw Error("offline");}));
  assert.equal(await cachedRead("bad",async()=>3),3);
});

test("invalidation does not reuse an in-flight pre-mutation response",async()=>{
  clearReadCache();let finish;const old=cachedRead("mutation",()=>new Promise(resolve=>{finish=resolve;}));
  clearReadCache();assert.equal(await cachedRead("mutation",async()=>2),2);
  finish(1);assert.equal(await old,1);assert.equal(await cachedRead("mutation",async()=>3),2);
});

test("read retry is bounded and excludes authentication or validation failures",async()=>{
  let calls=0;const signal=new AbortController().signal;
  assert.equal(await readWithRetry(async()=>{if(++calls===1)throw Object.assign(Error("busy"),{status:503});return 7;},signal),7);
  assert.equal(calls,2);
  let denied=0;await assert.rejects(readWithRetry(async()=>{denied++;throw Object.assign(Error("denied"),{status:401});},signal));assert.equal(denied,1);
  const cancelled=new AbortController();cancelled.abort();let abortCalls=0;
  await assert.rejects(readWithRetry(async()=>{abortCalls++;throw TypeError("offline");},cancelled.signal));assert.equal(abortCalls,1);
});
