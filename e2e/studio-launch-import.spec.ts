import { test, expect, type Page } from '@playwright/test';

const address = '11111111111111111111111111111111';
const id = '11111111-1111-4111-8111-111111111111';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const pair = { symbol: 'SOL', underlyingSymbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', verifiedAt: 1, restricted: false, orcaTvlUsd: 100000, orcaVolume24hUsd: 10000 };
async function setup(page: Page, failBanner = false) {
  let releaseProject!: () => void, releaseBanner!: () => void;
  const projectGate = new Promise<void>(resolve => { releaseProject = resolve; });
  const bannerGate = new Promise<void>(resolve => { releaseBanner = resolve; });
  const calls = { projects: 0, banners: 0, launches: [] as any[] };
  await page.addInitScript(address => {
    localStorage.setItem('aqua:update:holder-workspace-v2', 'seen');
    localStorage.setItem('aqua:wallet', 'phantom');
    localStorage.setItem(`aqua:studio:${address}`, JSON.stringify({ token: 'a'.repeat(64), expiresAt: Date.now() + 3600000 }));
    (window as any).phantom = { solana: { isPhantom: true, publicKey: { toString: () => address }, connect: async () => ({ publicKey: { toString: () => address } }), on() {}, removeListener() {} } };
  }, address);
  await page.route(/\/(?:api|studio)\//, async r => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/config') return r.fulfill({ json: { brand: 'AQUA', network: 'mainnet-beta', transactionsEnabled: true, marketGovernanceEnabled: false, publicRpcUrl: 'https://rpc.invalid', fees: {}, whirlpools: {}, creatorLocks: {}, sniperDefense: { supported: false } } });
    if (path === '/api/stocks') return r.fulfill({ json: { stocks: [pair], refreshing: false } });
    if (path === `/studio/projects/${id}`) {
      calls.projects++; await projectGate;
      return r.fulfill({ json: { id, name: 'Squid', revision: 1, hostedWebsiteUrl: 'https://squid.aquafamily.fun', state: {
        launch: { name: 'Squid', symbol: 'SQUID', description: 'A squid.', stockMint: pair.mint, rewardMode: 'holder_rewards', imagePath: 'assets/coin.png', xUrl: '', websiteUrl: '', telegramUrl: '', dexFundingEnabled: false, dexProfile: { description: '', bannerPath: 'assets/banner.png', bannerUrl: '', websiteUrl: '', xUrl: '', telegramUrl: '' } },
        files: ['coin', 'banner'].map(name => ({ path: `assets/${name}.png`, encoding: 'base64', content: png })),
      } } });
    }
    if (path === '/api/uploads') {
      const isBanner = r.request().postDataBuffer()?.includes(Buffer.from('banner.png'));
      if (isBanner) { calls.banners++; await bannerGate; if (failBanner && calls.banners === 1) return r.fulfill({ status: 503, json: { error: 'Banner upload unavailable' } }); }
      return r.fulfill({ json: { imageId: 'artwork', imageUrl: 'https://images.example.com/banner.png' } });
    }
    if (path === '/api/launches' && r.request().method() === 'POST') { calls.launches.push(r.request().postDataJSON()); return r.fulfill({ status: 503, json: { error: 'Test launch preparation stopped' } }); }
    return r.fulfill({ json: { launches: [], notifications: [], enabled: false } });
  });
  await page.goto(`/#/create?studio=${id}`);
  return { calls, releaseProject, releaseBanner };
}

test('full-screen loading hides the wizard until details and artwork are ready and preserves the Studio launch link', async ({ page }) => {
  const { calls, releaseProject, releaseBanner } = await setup(page);
  await expect(page.getByRole('heading', { name: 'Loading coin details' })).toBeVisible();
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveCount(0);
  await expect.poll(() => calls.projects).toBe(1);
  const box = await page.locator('.launch-details-loading').boundingBox();
  expect(box?.width).toBe(page.viewportSize()!.width); expect(box?.height).toBe(page.viewportSize()!.height);
  releaseProject();
  await expect.poll(() => calls.banners).toBe(1);
  await expect(page.getByRole('heading', { name: 'Loading coin details' })).toBeVisible();
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveCount(0);
  releaseBanner();
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Squid');
  await expect(page.getByPlaceholder('AQR')).toHaveValue('SQUID');
  await expect(page.locator('.launch-details-loading')).toHaveCount(0);
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Launch', exact: true }).click();
  await expect.poll(() => calls.launches.length).toBe(1);
  expect(calls.launches[0]).toMatchObject({ studioProjectId: id, name: 'Squid', symbol: 'SQUID', websiteUrl: 'https://squid.aquafamily.fun' });
});

test('a failed import stays out of the wizard and can be retried', async ({ page }) => {
  const { releaseProject, releaseBanner, calls } = await setup(page, true);
  releaseProject(); releaseBanner();
  await expect(page.getByText('Banner upload unavailable')).toBeVisible();
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveCount(0);
  expect(calls.launches).toEqual([]);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Squid');
  expect(calls.projects).toBe(2); expect(calls.banners).toBe(2);
});
