import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pairCatalogPollDelay} from '../src/pair-catalog-refresh.ts';
test('a failed source is retried after its cooldown, then stops once recovered',()=>{
  assert.equal(pairCatalogPollDelay({refreshing:true},0),2000);
  assert.equal(pairCatalogPollDelay({refreshing:false,customPairWarning:'RPC unavailable',retryAfterMs:5000},2000),5000);
  assert.equal(pairCatalogPollDelay({refreshing:true},7000),2000);
  assert.equal(pairCatalogPollDelay({refreshing:false},9000),null);
});
test('retries are bounded and cannot create a zero-delay request loop',()=>{
  assert.equal(pairCatalogPollDelay({warning:'retry',retryAfterMs:-1},0),1000);
  assert.equal(pairCatalogPollDelay({warning:'retry',retryAfterMs:999999},0),30000);
  assert.equal(pairCatalogPollDelay({customPairWarning:'retry'},120000),null);
});
