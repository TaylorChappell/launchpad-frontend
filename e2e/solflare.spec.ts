import { test, expect, type Page } from '@playwright/test';
import { PublicKey, Transaction, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';

const address = '11111111111111111111111111111111';
async function setup(page: Page, injected = true, reject = false) {
  await page.route('**/wallet-harness', r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/e2e/fixtures/wallet-harness.tsx"></script>' }));
  await page.route('**/api/config', r => r.fulfill({ json: { network: 'mainnet-beta', publicRpcUrl: 'https://rpc.invalid' } }));
  await page.route('**/account/auth/challenge', r => r.fulfill({ json: { id: 'login', message: 'AQUA login proof' } }));
  await page.route('**/account/auth/session', r => {
    expect(r.request().postDataJSON()).toEqual({ id: 'login', wallet: address, signature: Buffer.alloc(64, 7).toString('base64') });
    return r.fulfill({ json: { token: 'a'.repeat(64), expiresAt: Date.now() + 3600000 } });
  });
  await page.route('**/account/sign-out', r => r.fulfill({ json: {} }));
  await page.route('https://rpc.invalid/**', r => {
    const req = r.request().postDataJSON();
    return r.fulfill({ json: { jsonrpc: '2.0', id: req.id, result: { context: { slot: 1 }, value: [{ slot: 1, confirmations: 1, err: null, confirmationStatus: 'confirmed' }] } } });
  });
  await page.addInitScript(({ address, injected, reject }) => {
    const calls = { connects: [] as any[], messages: [] as string[], batches: [] as number[], sends: [] as any[], disconnects: 0 };
    const events = new Map<string, Set<(...args: any[]) => void>>();
    const provider = {
      isSolflare: true, publicKey: null as { toString: () => string } | null,
      async connect(options?: any) { calls.connects.push(options ?? null); this.publicKey = { toString: () => address }; },
      async disconnect() { calls.disconnects++; this.publicKey = null; },
      async signMessage(bytes: Uint8Array) { calls.messages.push(new TextDecoder().decode(bytes)); if (reject) throw new Error('User rejected the request'); return new Uint8Array(64).fill(7); },
      async signAllTransactions(transactions: any[]) { calls.batches.push(transactions.length); return transactions.map(transaction => ({ serialize: () => transaction.serialize({ requireAllSignatures: false, verifySignatures: false }) })); },
      async signAndSendTransaction(transaction: any, options: any) { calls.sends.push({ version: transaction.version ?? 'legacy', options }); return 'test-solflare-signature'; },
      on(event: string, listener: (...args: any[]) => void) { if (!events.has(event)) events.set(event, new Set()); events.get(event)!.add(listener); },
      removeListener(event: string, listener: (...args: any[]) => void) { events.get(event)?.delete(listener); },
    };
    Object.assign(window, { solflareCalls: calls, injectSolflare: () => { (window as any).solflare = provider; },
      changeSolflare: (key: string | null) => { provider.publicKey = key ? { toString: () => key } : null; events.get('accountChanged')?.forEach(fn => fn(provider.publicKey)); },
      phantom: { solana: { isPhantom: true, connect() { throw new Error('Wrong wallet selected'); } } },
    });
    if (injected) (window as any).solflare = provider;
  }, { address, injected, reject });
  await page.goto('/wallet-harness');
}

test('Solflare authenticates, signs legacy/v0 transactions, restores and disconnects', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  const row = page.getByRole('button', { name: /Solflare.*Detected.*Connect/ });
  await expect(row.locator('svg').first()).toBeVisible();
  await row.click();
  await expect(page.getByTestId('address')).toHaveText(address);
  expect(await page.evaluate(() => (window as any).solflareCalls.messages)).toEqual(['AQUA login proof']);
  const payer = new PublicKey(address);
  const ix = SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: 1 });
  const v0 = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: address, instructions: [ix] }).compileToV0Message());
  const legacy = new Transaction({ feePayer: payer, recentBlockhash: address }).add(ix);
  const envelopes = [
    { step: 'pool', transactionVersion: 0, transactionBase64: Buffer.from(v0.serialize()).toString('base64'), lastValidBlockHeight: 100 },
    { step: 'liquidity', transactionVersion: 'legacy', transactionBase64: legacy.serialize({ requireAllSignatures: false }).toString('base64'), lastValidBlockHeight: 100 },
  ];
  const results = await page.evaluate(async envelopes => {
    const wallet = (window as any).testWallet;
    const signed = await wallet.signTransactionBatch(envelopes);
    const signatures = [];
    for (const envelope of envelopes) signatures.push(await wallet.sendTransaction(envelope));
    const proof = await wallet.signMessage('Vote proof');
    return { signed, signatures, proof };
  }, envelopes);
  expect(results.signed.map((e: any) => e.signedTransactionBase64)).toEqual(envelopes.map(e => e.transactionBase64));
  expect(results.signed.map((e: any) => e.step)).toEqual(['pool', 'liquidity']);
  expect(results.signatures).toEqual(['test-solflare-signature', 'test-solflare-signature']);
  expect(results.proof.signature).toBe(Buffer.alloc(64, 7).toString('base64'));
  await page.reload();
  await expect(page.getByTestId('address')).toHaveText(address);
  expect(await page.evaluate(() => (window as any).solflareCalls.connects)).toEqual([{ onlyIfTrusted: true }]);
  expect(await page.evaluate(() => (window as any).solflareCalls.messages)).toEqual([]);
  await page.evaluate(() => (window as any).changeSolflare('So11111111111111111111111111111111111111112'));
  await expect(page.getByTestId('address')).toHaveText('So11111111111111111111111111111111111111112');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByTestId('address')).toHaveText('Disconnected');
  expect(await page.evaluate(() => localStorage.getItem('aqua:wallet'))).toBeNull();
  expect(await page.evaluate(() => (window as any).solflareCalls.disconnects)).toBe(1);
});

test('declining Solflare login does not establish an authenticated session', async ({ page }) => {
  await setup(page, true, true);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: /Solflare.*Connect/ }).click();
  await expect(page.getByText('User rejected the request')).toBeVisible();
  await expect(page.getByTestId('address')).toHaveText('Disconnected');
  expect(await page.evaluate(() => localStorage.getItem('aqua:wallet'))).toBeNull();
});

test('missing Solflare opens the app on mobile or installation on desktop; late injection is detected', async ({ page }, info) => {
  await setup(page, false);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  if (info.project.name === 'mobile') {
    const href = await page.getByRole('link', { name: /Solflare.*Open/ }).getAttribute('href');
    const link = new URL(href!);
    expect(link.origin).toBe('https://solflare.com');
    expect(decodeURIComponent(link.pathname.slice('/ul/v1/browse/'.length))).toBe(page.url());
    expect(link.searchParams.get('ref')).toBe(new URL(page.url()).origin);
  } else {
    await page.evaluate(() => { window.open = ((url: string) => { (window as any).openedUrl = url; return null; }) as typeof window.open; });
    await page.getByRole('button', { name: /Solflare.*Get/ }).click();
    expect(await page.evaluate(() => (window as any).openedUrl)).toBe('https://www.solflare.com/download/');
  }
  await page.evaluate(() => (window as any).injectSolflare());
  await expect(page.getByRole('button', { name: /Solflare.*Detected.*Connect/ })).toBeVisible();
});
