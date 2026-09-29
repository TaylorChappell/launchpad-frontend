import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotCandles,chartCandles,withLiveCandle,compactCandles,candlePrice} from '../src/market-candles.ts';
const t=1790640000000;
const point=(offset,price,cap=price*1000000000)=>({sampledAt:t+offset*60000,priceUsd:price,fdvUsd:cap});
test('USD OHLC aggregates ordered samples, retaining both wicks and the historic cap',()=>{
 const h=snapshotCandles([point(2,3),point(0,2),point(1,1),point(3,2.5)],'1h');
 assert.equal(h.candles.length,1);
 assert.deepEqual(h.candles[0].price,{open:2,high:3,low:1,close:2.5});
 assert.equal(h.candles[0].cap.high,3000000000);
 assert.equal(h.candles[0].time,t/1000);
});
test('deduplicates observations and preserves gaps without generating synthetic prices',()=>{
 const h=snapshotCandles([point(0,2),point(0,3),point(60,4),point(70,NaN),point(80,-1)],'1h');
 assert.equal(h.candles.length,2);assert.equal(h.candles[0].price.open,3);
 assert.equal(h.candles[1].time-h.candles[0].time,3600);
 assert.equal(chartCandles({...h,candles:[...h.candles,{time:t/1000+1,price:{open:5,high:2,low:1,close:2},cap:null}]},'price').length,2);
});
test('live updates preserve opening price and wicks, rejecting older updates',()=>{
 const h=snapshotCandles([point(0,2),point(1,4)],'1h');
 assert.equal(withLiveCandle(h,{sampledAt:t,priceUsd:9,marketCapUsd:9}),h);
 const fresh=withLiveCandle(h,{sampledAt:t+120000,priceUsd:1,marketCapUsd:1e9});
 assert.deepEqual(fresh.candles[0].price,{open:2,high:4,low:1,close:1});
 assert.equal(h.candles[0].price.close,4);
 const next=withLiveCandle(fresh,{sampledAt:t+600000,priceUsd:3,marketCapUsd:3e9});
 assert.equal(next.candles.length,2);
 assert.equal(next.candles[1].time,t/1000+600);
});
test('tiny token prices stay readable and missing cap is not coerced into zero',()=>{
 const h=snapshotCandles([{sampledAt:t,priceUsd:1e-10}], '24h');
 assert.equal(chartCandles(h,'cap').length,0);
 assert.equal(chartCandles(h,'price')[0].open,1e-10);
 assert.equal(candlePrice(1e-10),'$1.00e-10');
 assert.equal(candlePrice(1234567),'$1.23M');
});
test('mini candles cover the entire history and preserve extrema',()=>{
 const points=Array.from({length:96},(_,i)=>({time:1+i,open:i+2,high:i+5,low:i+1,close:i+3}));
 const bars=compactCandles(points);
 assert.equal(bars.length,32);assert.equal(bars[0].time,1);
 assert.equal(bars.at(-1).close,points.at(-1).close);
 assert.equal(Math.max(...bars.map(p=>p.high)),100);
});

test('merging pages keeps all history ordered and rejects stale candle revisions',async()=>{
 const {mergeCandleHistory}=await import('../src/market-candles.ts');
 const older=snapshotCandles([point(0,2),point(5,3)],'1h');
 const newer=snapshotCandles([point(5,4),point(10,5)],'1h');
 const merged=mergeCandleHistory(older,newer);
 assert.equal(merged.candles.length,3);assert.equal(merged.candles[1].price.close,4);
 const stale={...older,candles:older.candles.map(p=>({...p,lastSampleAt:p.lastSampleAt-1}))};
 assert.equal(mergeCandleHistory(merged,stale).candles[1].price.close,4);
 assert.equal(mergeCandleHistory(older,{...newer,intervalSeconds:60}).candles.length,2);
});
