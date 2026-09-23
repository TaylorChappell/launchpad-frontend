import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSolflareProvider, solflareBrowseUrl, messageSignature } from '../src/solflare.ts';

test('Solflare detection does not confuse other injected wallets', () => {
  const solflare = { isSolflare: true }, phantom = { isPhantom: true };
  assert.equal(getSolflareProvider({ solflare, solana: phantom }), solflare);
  assert.equal(getSolflareProvider({ solflare: phantom }), undefined);
  assert.equal(getSolflareProvider({ solana: phantom }), undefined);
});

test('Solflare mobile handoff preserves the route and query', () => {
  const href = 'https://aquafamily.fun/#/token/coin?tab=project';
  const link = new URL(solflareBrowseUrl(href));
  assert.equal(link.origin, 'https://solflare.com');
  assert.equal(decodeURIComponent(link.pathname.slice('/ul/v1/browse/'.length)), href);
  assert.equal(link.searchParams.get('ref'), 'https://aquafamily.fun');
  assert.throws(() => solflareBrowseUrl('javascript:alert(1)'));
  assert.throws(() => solflareBrowseUrl('http://aquafamily.fun'));
});

test('Solflare and Phantom message signatures retain their exact bytes', () => {
  const signature = new Uint8Array(64).fill(19);
  assert.equal(messageSignature(signature), signature);
  assert.equal(messageSignature({ signature }), signature);
  for (const malformed of [undefined, {}, new Uint8Array(63), { signature: 'invalid' }]) {
    assert.throws(() => messageSignature(malformed));
  }
});
