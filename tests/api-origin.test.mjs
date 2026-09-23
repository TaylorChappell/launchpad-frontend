import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveApiOrigin,AQUA_PUBLIC_API_ORIGIN,LEGACY_PUBLIC_API_ORIGIN} from '../src/api-origin.ts';
test('prefers the canonical API even when an old production override remains',()=>{
  assert.equal(AQUA_PUBLIC_API_ORIGIN,"https://aquaapi.fun");
  assert.equal(resolveApiOrigin("https://aquafamily.fun/"),AQUA_PUBLIC_API_ORIGIN);
  assert.equal(resolveApiOrigin(),AQUA_PUBLIC_API_ORIGIN);
  assert.equal(resolveApiOrigin(` ${LEGACY_PUBLIC_API_ORIGIN}/ `),AQUA_PUBLIC_API_ORIGIN);
  assert.equal(resolveApiOrigin(undefined,LEGACY_PUBLIC_API_ORIGIN),AQUA_PUBLIC_API_ORIGIN);
});
test('keeps staging and local requests on their configured backend',()=>{
  for(const url of ['https://launchpad-backend-staging.up.railway.app','http://localhost:3000','https://custom.example/api'])assert.equal(resolveApiOrigin(url,AQUA_PUBLIC_API_ORIGIN),url);
});
test('invalid or credential-bearing configuration falls through without exposing credentials',()=>{
  for(const url of ['not a URL','https://','javascript:alert(1)','https://user:password@example.com','https://example.com?token=secret'])assert.equal(resolveApiOrigin(url,AQUA_PUBLIC_API_ORIGIN),AQUA_PUBLIC_API_ORIGIN);
});
