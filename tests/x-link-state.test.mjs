import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureXReturn, xReturnPath } from '../src/x-link-state.ts';
const state='a'.repeat(64),receipt='b'.repeat(64),wallet='11111111111111111111111111111111';
function store(value){let saved=JSON.stringify(value);return {getItem:()=>saved,setItem:(_key,v)=>{saved=v;}};}
test('an X return requires the browser that initiated the same state and retains its original wallet',()=>{
 const storage=store({state,wallet,returnTo:'#/portfolio'});
 assert.equal(captureXReturn(storage,'key',new URLSearchParams({state:'c'.repeat(64),receipt})),null);
 const result=captureXReturn(storage,'key',new URLSearchParams({state,receipt}));
 assert.equal(result.wallet,wallet);assert.equal(result.receipt,receipt);
 assert.deepEqual(captureXReturn(storage,'key',new URLSearchParams()),JSON.parse(JSON.stringify(result)));
});
test('missing storage, cancellation and malformed receipt cannot produce a usable X approval',()=>{
 assert.equal(captureXReturn(store(null),'key',new URLSearchParams({state,receipt})),null);
 const storage=store({state,wallet,returnTo:'#/'});
 assert.equal(captureXReturn(storage,'key',new URLSearchParams({state,receipt:'bad'})).receipt,undefined);
 assert.equal(captureXReturn(storage,'key',new URLSearchParams({state,receipt,error:'Cancelled'})).receipt,undefined);
});
test('X completion returns only to an internal route',()=>{
 assert.equal(xReturnPath('#/token/coin?tab=updates'),'/token/coin?tab=updates');
 for(const path of ['#//evil.example','https://evil.example','#/connect-x?receipt=secret','javascript:alert(1)'])assert.equal(xReturnPath(path),'/');
});
