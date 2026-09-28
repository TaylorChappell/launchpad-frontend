import {test} from 'node:test';
import assert from 'node:assert/strict';
import {marketShareUrl} from '../src/share-market.ts';
test('market share links use the public transactions URL without social share metadata',()=>{
 assert.equal(marketShareUrl('test-e468acc3'),'https://aquafamily.fun/#/token/test-e468acc3?tab=transactions');
 assert.equal(marketShareUrl('coin/a?b'),'https://aquafamily.fun/#/token/coin%2Fa%3Fb?tab=transactions');
});
