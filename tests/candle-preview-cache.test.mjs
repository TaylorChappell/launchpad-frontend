import test from 'node:test';
import assert from 'node:assert/strict';
import {readCandlePreview,rememberCandlePreview} from '../src/candle-preview-cache.ts';

const page={source:'indexed_pool_trades',currency:'SOL',intervalSeconds:300,nextBefore:null,candles:[],historyPending:true};
test('chart previews stay separate by market and timeframe and accept repaired history',()=>{
  rememberCandlePreview('preview-a','5m',page,1000);
  assert.equal(readCandlePreview('preview-a','5m',1100),page);
  assert.equal(readCandlePreview('preview-a','15m',1100),null);
  assert.equal(readCandlePreview('preview-b','5m',1100),null);
  const repaired={...page,historyPending:false};
  rememberCandlePreview('preview-a','5m',repaired,1200);
  assert.equal(readCandlePreview('preview-a','5m',1300),repaired);
});
test('reading a preview does not extend its five-minute expiry',()=>{
  rememberCandlePreview('preview-expiry','5m',page,1000);
  assert.equal(readCandlePreview('preview-expiry','5m',300_999),page);
  assert.equal(readCandlePreview('preview-expiry','5m',301_000),null);
});
test('chart previews bound memory while retaining recently used markets',()=>{
  for(let i=0;i<24;i++)rememberCandlePreview('preview-limit-'+i,'5m',page,1000);
  readCandlePreview('preview-limit-0','5m',1100);
  rememberCandlePreview('preview-limit-new','5m',page,1200);
  assert.equal(readCandlePreview('preview-limit-1','5m',1300),null);
  assert.equal(readCandlePreview('preview-limit-0','5m',1300),page);
  assert.equal(readCandlePreview('preview-limit-new','5m',1300),page);
});
