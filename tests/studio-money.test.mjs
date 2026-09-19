import test from 'node:test';
import assert from 'node:assert/strict';
import { usdCredit } from '../src/studio-money.ts';

test('displays exactly two decimals and rounds without floating-point errors', () => {
  for (const [raw, formatted] of [['0','$0.00'],['1','$0.00'],['1234567','$1.23'],['1235000','$1.24'],['9999999','$10.00'],['-1235000','-$1.24'],['-1','$0.00'],['9007199254740993000','$9,007,199,254,740.99']]) {
    assert.equal(usdCredit(raw),formatted);
  }
});
test('rounds a required top-up or spending limit up to the next cent', () => {
  assert.equal(usdCredit('1','up'),'$0.01');
  assert.equal(usdCredit('10000','up'),'$0.01');
  assert.equal(usdCredit('10001','up'),'$0.02');
  assert.equal(usdCredit('1234567','up'),'$1.24');
});
