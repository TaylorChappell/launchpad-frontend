import test from 'node:test';
import assert from 'node:assert/strict';
import {isPriceLive,mergeMarketPrice,withLatestMarketPoint} from '../src/market-prices.ts';
test('never replaces a newer price with a slower full-page response',()=>{
  const launch={id:'a',priceUpdatedAt:200,marketCapUsd:10};
  assert.equal(mergeMarketPrice(launch,{id:'a',priceUpdatedAt:100,marketCapUsd:1}),launch);
  assert.equal(mergeMarketPrice(launch,{id:'b',priceUpdatedAt:300}),launch);
  assert.equal(mergeMarketPrice(launch,{id:'a',priceUpdatedAt:300,marketCapUsd:20}).marketCapUsd,20);
});
test('stale, missing and disconnected quotes are not shown as live',()=>{
  assert.equal(isPriceLive({priceStatus:'live',priceUpdatedAt:100000},110000),true);
  assert.equal(isPriceLive({priceStatus:'live',priceUpdatedAt:100000},170000),false);
  assert.equal(isPriceLive({priceStatus:'delayed',priceUpdatedAt:100000},110000),false);
  assert.equal(isPriceLive({}),false);
});
test('adds the current quote to the chart without changing saved history',()=>{
  const now=Date.now(),history=[{sampledAt:now-60000,fdvUsd:10}];
  const launch={priceStatus:'live',priceUpdatedAt:now,marketCapUsd:20,fdvUsd:20};
  const result=withLatestMarketPoint(history,launch);
  assert.equal(result.length,2);assert.equal(result[1].marketCapUsd,20);assert.equal(history.length,1);
  assert.equal(withLatestMarketPoint(history,{...launch,priceStatus:'delayed'}),history);
});
