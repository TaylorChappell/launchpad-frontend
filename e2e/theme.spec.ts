import {test,expect,type Page} from '@playwright/test';
const mint='11111111111111111111111111111111';
const history=(interval:string,currency="SOL")=>{
 const intervalSeconds=({"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400} as Record<string,number>)[interval]??300;
 const end=(Math.floor(Date.now()/1000/intervalSeconds)-2)*intervalSeconds;
 return {source:"indexed_pool_trades",currency,intervalSeconds,nextBefore:null,candles:Array.from({length:60},(_,i)=>{
  const open=.000001*(2+i*.02+Math.sin(i/3)*.25),close=open*(i%3===0?.97:1.03);
  const price={open,close,high:Math.max(open,close)*1.025,low:Math.min(open,close)*.975};
  return {time:end-(59-i)*intervalSeconds,lastSampleAt:(end-(59-i)*intervalSeconds)*1000,price,cap:Object.fromEntries(Object.entries(price).map(([k,v])=>[k,v*1e9]))};
 })};
};
async function setup(page:Page,launchOverrides:Record<string,unknown>={}){
 await page.addInitScript(()=>localStorage.setItem('aqua:update:holder-workspace-v2','seen'));
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  let json:unknown={};
  if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',publicRpcUrl:'https://rpc.invalid',useTestnet:false,marketGovernanceEnabled:false,transactionsEnabled:false,whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
  else if(/^\/api\/launches\/[^/]+$/.test(path))json={launch:{id:path.split('/').at(-1),mint,creatorWallet:mint,name:'Ocean Club',symbol:'OCEAN',description:'A community coin.',pairType:path.includes('sol')?'sol':'stock',pairMint:mint,pairSymbol:path.includes('sol')?'SOL':path.includes('stock')?'NVDAx':'CUSTOM',stockMint:mint,stockSymbol:'SOL',stock:{mint,symbol:'SOL',name:'Solana'},rewardMode:'holder_rewards',status:'live',txCount:0,holderCount:320,devBuySol:0,rewardAccumulatedUsd:750,rewardRedeemableUsd:420,aquaIndexed:true,pairPriceUsd:120,priceUpdatedAt:Date.now(),priceStatus:"live",priceUsd:.000003,marketCapUsd:3000,tvlUsd:2000,volume24hUsd:5000,tokenDecimals:6,totalSupplyRaw:'1000000000000000',createdAt:Date.now(),...launchOverrides},trades:[],creatorLock:null,rewardModeState:null};
  else if(path.endsWith('/trade-candles'))json=history(url.searchParams.get('interval')??'5m',path.includes('stock')?'NVDAx':path.includes('custom')?'CUSTOM':'SOL');
  else if(path.endsWith('/market-data'))json={snapshots:[]};
  else if(path==='/api/stocks')json={stocks:[]};
  else if(path==='/api/launches')json={launches:[]};
  else if(path.includes('/notifications/'))json={notifications:[]};
  else if(path.endsWith('/holdings'))json={holdings:[]};
  else if(path.endsWith('/claim-history'))json={claims:[],lifetime:[],hasMore:false};
  else if(path.includes('governance'))json={enabled:false};
  else if(path==='/api/market-prices/stream')return route.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
  else if(path==='/api/market-prices')json={prices:[]};
  return route.fulfill({json});
 });
 await page.route('https://rpc.invalid/**',route=>route.fulfill({json:{jsonrpc:'2.0',id:route.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
 await page.route('**/account/**',route=>route.fulfill({json:{enabled:false,profiles:{}}}));
}


const toggle = (page: Page, dark = false) => page.getByRole('button', { name: dark ? 'Switch to light mode' : 'Switch to dark mode', exact: true });

test('light is the default even on dark systems; keyboard toggle is beside search and persists', async ({ page }, info) => {
  await setup(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/');
  await expect(toggle(page)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const search = await page.getByRole('button', { name: 'Search AQUA markets' }).boundingBox();
  const button = await toggle(page).boundingBox();
  expect(button!.x).toBeGreaterThanOrEqual(search!.x + search!.width);
  await toggle(page).press('Enter');
  await expect(toggle(page, true)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('aqua:theme'))).toBe('dark');
  await page.reload();
  await expect(toggle(page, true)).toBeVisible();
  await page.goto('/#/portfolio');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: info.outputPath('compact-dark-portfolio.png'), fullPage: true });
  await toggle(page, true).click();
  await page.reload();
  await expect(toggle(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('aqua:theme'))).toBe('light');
});

test('saved dark preference applies before the application loads', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('aqua:theme', 'dark'));
  await page.route('**/src/main.tsx', route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, color: getComputedStyle(document.documentElement).backgroundColor, scheme: document.documentElement.style.colorScheme }))).toEqual({ theme: 'dark', color: 'rgb(7, 23, 34)', scheme: 'dark' });
});

test('theme changes synchronise between tabs and storage reset restores light', async ({ page, context }) => {
  await setup(page); await page.goto('/#/');
  await expect(toggle(page)).toBeVisible();
  const other = await context.newPage();
  await setup(other); await other.goto('/#/portfolio');
  await expect(toggle(other)).toBeVisible();
  await toggle(page).click();
  await expect(toggle(other, true)).toBeVisible();
  await other.evaluate(() => localStorage.removeItem('aqua:theme'));
  await expect(toggle(page)).toBeVisible();
  await other.close();
});

test('the toggle remains usable when browser storage is unavailable', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  await page.goto('/#/');
  await expect(toggle(page)).toBeVisible();
  await toggle(page).click();
  await expect(toggle(page, true)).toBeVisible();
  await toggle(page, true).click();
  await expect(toggle(page)).toBeVisible();
});

test('dark chart updates its canvas without recreating it or changing selected controls', async ({ page }, info) => {
  await setup(page); await page.goto('/#/token/sol');
  const chart = page.locator('#market-chart');
  const canvas = chart.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await chart.getByRole('button', { name: 'Price', exact: true }).click();
  await chart.getByRole('button', { name: '15m', exact: true }).click();
  await canvas.evaluate(el => el.setAttribute('data-original', 'true'));
  await toggle(page).click();
  await expect(canvas).toHaveAttribute('data-original', 'true');
  await expect(chart.getByRole('button', { name: 'Price', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(chart.getByRole('button', { name: '15m', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => canvas.evaluate(el => Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(3, 3, 1, 1).data).slice(0, 3))).toEqual([14, 35, 50]);
  await chart.scrollIntoViewIfNeeded();
  await chart.screenshot({ path: info.outputPath('compact-dark-chart.png') });
  await toggle(page, true).click();
  await expect.poll(() => canvas.evaluate(el => Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(3, 3, 1, 1).data).slice(0, 3))).toEqual([255, 255, 255]);
});

test('dark pages, modals and animations stay legible and fit the viewport', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page); await page.goto('/#/');
  await toggle(page).click();
  for (const route of ['', 'create', 'studio', 'portfolio', 'how-it-works', 'claim-by-address', 'developers', 'boost']) {
    await page.goto('/#/' + route);
    await expect(toggle(page, true)).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('.page-loading')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), route).toBeLessThanOrEqual(1);
    const body = await page.locator('body').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color }));
    expect(body).toEqual({ background: 'rgb(7, 23, 34)', text: 'rgb(227, 243, 250)' });
    await page.screenshot({ path: info.outputPath(`compact-dark-${route || 'explore'}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Search AQUA markets' }).click();
  await expect(page.locator('.search-modal')).toBeVisible();
  const searchStyle = await page.locator('.search-modal').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
  expect(searchStyle.bg).toBe('rgb(16, 43, 60)');
  await page.screenshot({ path: info.outputPath('compact-dark-search.png') });
  await page.keyboard.press('Escape');
  await page.goto('/#/');
  const motion = await page.locator('.wallet-button').evaluate(el => getComputedStyle(el, '::before').animationName);
  expect(motion).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await toggle(page, true).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(errors).toEqual([]);
});

test('header controls remain separate at narrow phone and tablet widths', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One sweep covers the responsive widths.');
  await setup(page); await page.goto('/#/');
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(toggle(page)).toBeVisible();
    const controls = await page.locator('.header-actions > *').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().width > 0).map(el => { const r = el.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
    for (let i = 1; i < controls.length; i++) expect(controls[i].x, `${width}px overlap`).toBeGreaterThanOrEqual(controls[i - 1].right - 1);
    expect(controls.at(-1)!.right, `${width}px overflow`).toBeLessThanOrEqual(width);
  }
});
