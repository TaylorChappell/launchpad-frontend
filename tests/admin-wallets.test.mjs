import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminWallet, adminSessionKey } from '../src/admin-wallets.ts';

test('every listed admin is recognized, with legacy single-wallet fallback', () => {
  const config = { adminWallet: 'primary', adminWallets: ['primary', 'secondary'] };
  assert.equal(isAdminWallet('primary', config), true);
  assert.equal(isAdminWallet('secondary', config), true);
  assert.equal(isAdminWallet('outsider', config), false);
  assert.equal(isAdminWallet(undefined, {}), false);
  assert.equal(isAdminWallet('primary', { adminWallet: 'primary' }), true);
  assert.equal(isAdminWallet('primary', { adminWallet: 'primary', adminWallets: [] }), false);
});

test('cached admin sessions are scoped to the connected wallet', () => {
  assert.notEqual(adminSessionKey('primary'), adminSessionKey('secondary'));
  assert.notEqual(adminSessionKey('primary'), adminSessionKey(null));
});
