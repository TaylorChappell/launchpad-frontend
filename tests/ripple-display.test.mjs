import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rippleDollars} from '../src/ripple-display.ts';
test('Ripple shows dollars to two decimals without disguising unavailable valuation as zero',()=>{
  assert.equal(rippleDollars('12345'),'$123.45');
  assert.equal(rippleDollars('1'),'$0.01');
  assert.equal(rippleDollars('0'),'$0.00');
  assert.equal(rippleDollars(undefined,'0'),'$0.00');
  assert.equal(rippleDollars(null,'1000000000'),'—');
  assert.equal(rippleDollars(undefined),'—');
});
