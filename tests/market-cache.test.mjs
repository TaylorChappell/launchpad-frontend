import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMarketSnapshot, saveMarketSnapshot } from '../src/market-cache.ts';
test('snapshots isolate filters/backends, expire and retain bounded public pages', () => {
 const data={launches:[],hasMore:false,nextOffset:0};
 saveMarketSnapshot('staging-volume',data,1000);
 assert.equal(readMarketSnapshot('staging-volume',1001),data);
 assert.equal(readMarketSnapshot('main-volume',1001),null);
 assert.equal(readMarketSnapshot('staging-paid',1001),null);
 assert.equal(readMarketSnapshot('staging-volume',301000),null);
 for(let i=0;i<9;i++)saveMarketSnapshot('page'+i,data,500000);
 assert.equal(readMarketSnapshot('page0',500001),null);
 assert.equal(readMarketSnapshot('page8',500001),data);
});
