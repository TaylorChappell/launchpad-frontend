import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMarketSnapshot, saveMarketSnapshot, refreshMarketSnapshot } from '../src/market-cache.ts';
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

test('ranking refresh retains loaded pages, uses fresh prices and drops removed tails when the list ends',()=>{
 const cached={launches:[{id:'a',priceUsd:1},{id:'b',priceUsd:2},{id:'c',priceUsd:3},{id:'d',priceUsd:4}],hasMore:true,nextOffset:4};
 const fresh={launches:[{id:'d',priceUsd:40},{id:'a',priceUsd:10}],hasMore:true,nextOffset:2};
 const merged=refreshMarketSnapshot(cached,fresh);
 assert.deepEqual(merged.launches,[{id:'d',priceUsd:40},{id:'a',priceUsd:10},{id:'b',priceUsd:2},{id:'c',priceUsd:3}]);
 assert.equal(merged.nextOffset,4);assert.equal(merged.hasMore,true);
 const ended={...fresh,hasMore:false};assert.equal(refreshMarketSnapshot(cached,ended),ended);
});
