import test from 'node:test';
import assert from 'node:assert/strict';
import { marketPreferences, marketPreferencesKey, readMarketPreferences, saveMarketPreferences } from '../src/market-preferences.ts';

test('discovery saves valid filters and category without persisting search or unrelated state', () => {
  const saved = marketPreferences(new URLSearchParams('sort=trending&pair=ORCA&mode=jackpot&dex=paid&minCap=1000&maxCap=9000&minVolume=500&minLiquidity=200&minHolders=12&ageHours=24&q=private-search&view=table'));
  assert.deepEqual(Object.fromEntries(saved), {sort:'trending',pair:'ORCA',mode:'jackpot',dex:'paid',minCap:'1000',maxCap:'9000',minVolume:'500',minLiquidity:'200',minHolders:'12',ageHours:'24'});
});

test('invalid stored settings fall back safely and clearing filters removes prior values', () => {
  assert.equal(marketPreferences(new URLSearchParams('sort=bad&mode=bad&dex=bad&minCap=Infinity&maxCap=-1&minHolders=1.5&ageHours=unknown')).toString(), 'sort=volume');
  assert.equal(marketPreferences(new URLSearchParams('minCap=20&maxCap=10')).toString(), 'sort=volume');
  let stored = '';
  globalThis.localStorage = {getItem: key => key === marketPreferencesKey ? stored : null, setItem: (key, value) => { assert.equal(key, marketPreferencesKey); stored = value; }};
  try {
    saveMarketPreferences(new URLSearchParams('sort=watchlist&dex=paid&minCap=1000'));
    assert.equal(readMarketPreferences().toString(), 'sort=watchlist&dex=paid&minCap=1000');
    saveMarketPreferences(new URLSearchParams('sort=watchlist'));
    assert.equal(readMarketPreferences().toString(), 'sort=watchlist');
  } finally { delete globalThis.localStorage; }
});

test('blocked browser storage never prevents market browsing', () => {
  globalThis.localStorage = {getItem: () => {throw Error('blocked');}, setItem: () => {throw Error('blocked');}};
  try {
    assert.equal(readMarketPreferences().toString(), 'sort=volume');
    assert.equal(saveMarketPreferences(new URLSearchParams('sort=recent&dex=unpaid')).toString(), 'sort=recent&dex=unpaid');
  } finally { delete globalThis.localStorage; }
});
