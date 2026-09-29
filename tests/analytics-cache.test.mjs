import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_REFRESH_MS, createAnalyticsCache } from '../src/analytics-cache.ts';

const validate=(data,key)=>Boolean(data&&data.range===key&&Number.isFinite(data.total));
const value=(range,total=1)=>({range,total});
function setup(t){
 const saved=new Map(),descriptor=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:key=>saved.get(key)??null,setItem:(key,data)=>saved.set(key,data)}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'sessionStorage',descriptor);else delete globalThis.sessionStorage;});
 let now=1_000_000;t.mock.method(Date,'now',()=>now);
 return {saved,advance:ms=>{now+=ms;}};
}

test('period switches share in-flight requests and reuse completed snapshots',async t=>{
 setup(t);const cache=createAnalyticsCache('analytics',validate);
 let release,calls=0;const gate=new Promise(resolve=>{release=resolve;});
 const request=async()=>{calls++;await gate;return value('24h',24);};
 const first=cache.load('24h',request),second=cache.load('24h',request);
 assert.equal(first,second);
 await cache.load('7d',async()=>value('7d',70));
 assert.equal(cache.read('24h'),null);assert.equal(cache.read('7d').total,70);
 release();const result=await first;
 assert.equal(await cache.load('24h',request),result);assert.equal(calls,1);
 assert.equal(cache.read('24h'),result);assert.equal(cache.read('7d').total,70);
});

test('stale snapshots stay readable during refresh, survive failure, and retry successfully',async t=>{
 const {advance}=setup(t),cache=createAnalyticsCache('analytics',validate);
 const original=await cache.load('all',async()=>value('all',50));
 advance(ANALYTICS_REFRESH_MS);
 let reject;const request=cache.load('all',()=>new Promise((_,fail)=>{reject=fail;}));
 await Promise.resolve();assert.equal(cache.read('all'),original);
 reject(new Error('offline'));await assert.rejects(request,/offline/);
 assert.equal(cache.read('all'),original);
 assert.equal((await cache.load('all',async()=>value('all',60))).total,60);
});

test('manual refresh bypasses fresh snapshots while concurrent refreshes still share work',async t=>{
 setup(t);const cache=createAnalyticsCache('analytics',validate);
 await cache.load('all',async()=>value('all',50));
 const refresh=cache.load('all',async()=>value('all',60),true);
 assert.equal(cache.load('all',async()=>value('all',99),true),refresh);
 assert.equal((await refresh).total,60);
});

test('session snapshots survive navigation, isolate backends, and expire after thirty minutes',async t=>{
 const {advance}=setup(t);await createAnalyticsCache('staging',validate).load('all',async()=>value('all',50));
 const restored=createAnalyticsCache('staging',validate);
 assert.equal(restored.read('all').total,50);
 assert.equal((await restored.load('all',async()=>{throw Error('unexpected request');})).total,50);
 assert.equal(createAnalyticsCache('production',validate).read('all'),null);
 advance(30*60_000);assert.equal(restored.read('all'),null);
 assert.equal(createAnalyticsCache('staging',validate).read('all'),null);
});

test('invalid or wrong-period data never replaces a good snapshot',async t=>{
 const {saved}=setup(t),cache=createAnalyticsCache('analytics',validate);
 const original=await cache.load('all',async()=>value('all',50));
 await assert.rejects(cache.load('all',async()=>value('24h',24),true),/period data unavailable/);
 assert.equal(cache.read('all'),original);
 saved.set('malformed',JSON.stringify([null,{key:'all',at:Date.now(),data:null},{key:'7d',at:Date.now()+1,data:value('7d')},{key:'30d',at:Date.now(),data:value('30d')}]));
 const restored=createAnalyticsCache('malformed',validate);
 assert.equal(restored.read('all'),null);assert.equal(restored.read('7d'),null);assert.equal(restored.read('30d').total,1);
});

test('storage limits are bounded and disabled storage does not break in-memory caching',async t=>{
 setup(t);const cache=createAnalyticsCache('analytics',validate,2);
 for(const range of ['24h','7d','30d'])await cache.load(range,async()=>value(range));
 assert.equal(cache.read('24h'),null);assert.equal(cache.read('30d').total,1);
 assert.equal(createAnalyticsCache('analytics',validate,2).read('24h'),null);
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw Error('blocked');}});
 const memory=createAnalyticsCache('blocked',validate);
 const result=await memory.load('all',async()=>value('all'));
 assert.equal(memory.read('all'),result);
});
