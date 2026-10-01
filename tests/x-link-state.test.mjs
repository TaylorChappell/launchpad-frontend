import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureXReturn, xConnectionPath, xReturnPath, xReturnReceipt } from '../src/x-link-state.ts';
import { phantomBrowseUrl } from '../src/phantom-mobile.ts';
import { solflareBrowseUrl } from '../src/solflare.ts';
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
test('a mobile recovery requires both opaque callback values and rejects errors',()=>{
 assert.deepEqual(xReturnReceipt(new URLSearchParams({state,receipt})),{state,receipt});
 for(const params of [{state},{receipt},{state,receipt:'bad'},{state:'bad',receipt},{state,receipt,error:''}])assert.equal(xReturnReceipt(new URLSearchParams(params)),null);
});
test('mobile wallet handoffs preserve the receipt in the nested AQUA fragment',()=>{
 const url='https://aquafamily.fun/#'+xConnectionPath({state,receipt});
 const phantom=new URL(phantomBrowseUrl(url));
 const solflare=new URL(solflareBrowseUrl(url));
 for(const link of [phantom,solflare]){
   const nested=new URL(decodeURIComponent(link.pathname.split('/browse/')[1]));
   assert.equal(nested.origin,'https://aquafamily.fun');
   assert.equal(nested.search,'');
   assert.deepEqual(xReturnReceipt(new URLSearchParams(nested.hash.split('?')[1])),{state,receipt});
 }
 assert.equal(xConnectionPath({state}),'/connect-x');
});
