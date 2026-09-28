import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keeperAmount, keeperSteps, keeperUsd, keeperHealth } from '../src/fee-keeper-display.ts';

test('token display preserves integers above the JS safe range and handles decimals, zero, dust and unknown values', () => {
  assert.equal(keeperAmount('9007199254740993',6),'9,007,199,254.740993');
  assert.equal(keeperAmount('5000',9),'0.000005');
  assert.equal(keeperAmount('1',9),'<0.000001');
  assert.equal(keeperAmount('0',6),'0');
  assert.equal(keeperAmount(null),'—');
  assert.equal(keeperAmount('bad'),'—');
  assert.equal(keeperUsd(null),'—');
  assert.equal(keeperUsd(0),'$0.00');
});
test('direct SOL swaps are not duplicated when legacy pool and final-swap signatures are the same', () => {
  const conversion={steps:[{signature:'withdraw',createdAt:2}],withdrawSignature:'withdraw',poolSignature:'pool',swapSignature:'pool',payoutSignature:'payout'};
  const steps=keeperSteps(conversion);
  assert.equal(steps.length,3);
  assert.equal(steps.filter(s=>s.signature==='pool').length,1);
  assert.equal(steps.find(s=>s.signature==='pool').bytes,null);
  assert.equal(steps.find(s=>s.signature==='pool').status,'recorded');
});

test('keeper health distinguishes pacing, stalled updates and per-market failures',()=>{
  const data={generatedAt:1_000_000,settings:{intervalMs:60_000},summary:{lastAttemptAt:990_000,active:0,blocked:0}};
  assert.equal(keeperHealth(data).label,'Waiting');
  data.summary.active=2;assert.equal(keeperHealth(data).label,'Running');
  data.summary.blocked=1;assert.equal(keeperHealth(data).label,'Needs attention');
  data.summary.lastAttemptAt=700_000;assert.equal(keeperHealth(data).label,'Stale');
  data.summary.lastAttemptAt=null;assert.equal(keeperHealth(data).label,'Stale');
});
