import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteAmounts, displayTokenAmount } from '../src/trade-quote.ts';

test('reads Orca and Jupiter minimum outputs without losing precision', () => {
  const expected = { estimated: '9007199254740993000', minimum: '9007199254740992000' };
  assert.deepEqual(quoteAmounts({ tokenEstOut: expected.estimated, tokenMinOut: expected.minimum }), expected);
  assert.deepEqual(quoteAmounts({ outAmount: expected.estimated, otherAmountThreshold: expected.minimum }), expected);
});
test('rejects missing, zero, malformed and contradictory quotes', () => {
  for (const quote of [{}, { outAmount: '10' }, { outAmount: '0', otherAmountThreshold: '0' }, { outAmount: '10', otherAmountThreshold: '11' }, { outAmount: '1e3', otherAmountThreshold: '1' }, { outAmount: '10', otherAmountThreshold: '-1' }]) assert.throws(() => quoteAmounts(quote));
});
test('displays tiny amounts and large balances exactly', () => {
  assert.equal(displayTokenAmount('1', 9), '0.000000001');
  assert.equal(displayTokenAmount('9007199254740993123', 6), '9,007,199,254,740.993123');
  assert.equal(displayTokenAmount('1000000', 6), '1');
  assert.equal(displayTokenAmount('1250', 0), '1,250');
});
