import { test, expect } from "@playwright/test";
const mint = "11111111111111111111111111111111";
const launch = {
  id: "mobile", mint, creatorWallet: mint, name: "Ocean Club", symbol: "OCEAN",
  description: "A community building together.", stockMint: mint, stockSymbol: "ORCA", stockName: "Orca",
  stock: { mint, symbol: "ORCA", name: "Orca", logoUrl: null },
  pairMint: mint, pairType: "stock", pairSymbol: "ORCA", rewardMode: "holder_rewards", status: "live",
  txCount: 0, marketCapUsd: 124000, tvlUsd: 21000, volume24hUsd: 54000, change24h: 12,
  holderCount: 320, aquaIndexed: true, totalSupplyRaw: "1000000000000000", tokenDecimals: 6,
  createdAt: Date.now(), devBuySol: 0, rewardAccumulatedUsd: 750, rewardRedeemableUsd: 420,
};


test('cached Explore is visible before refresh completes; DEX filters stay isolated', async ({page})=>{
 let requests=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const queries:URLSearchParams[]=[];
 await page.addInitScript(()=>localStorage.setItem('aqua:update:holder-workspace-v2','seen'));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/launches') {requests++;queries.push(url.searchParams);if(requests===2)await gate;return route.fulfill({json:{launches:url.searchParams.get('dex')==='paid'?[{...launch,id:'paid',name:'Paid coin',dexPaid:true}]:[{...launch,name:requests>=2?'Fresh Ocean':'Ocean Club'}],hasMore:false,nextOffset:1}});}
  if(path==='/api/config')return route.fulfill({json:{network:'mainnet-beta',marketGovernanceEnabled:false,transactionsEnabled:false,fees:{},creatorLocks:{},whirlpools:{},sniperDefense:{supported:false}}});
  if(path==='/api/market-prices/stream')return route.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
  return route.fulfill({json:{enabled:false,launches:[],prices:[],notifications:[]}});
 });
 await page.route('**/account/**',r=>r.fulfill({json:{enabled:false}}));
 await page.goto('/#/');await expect(page.locator('.token-grid')).toContainText('Ocean Club');
 await expect(page.locator('.discovery-tabs button').first()).toHaveText('Top volume');await expect(page.getByRole('button',{name:'Top volume',exact:true})).toHaveAttribute('aria-pressed','true');expect(queries[0].get('sort')).toBe('volume');
 await page.reload();await expect.poll(()=>requests).toBe(2);
 await expect(page.locator('.token-grid')).toContainText('Ocean Club');await expect(page.locator('.market-skeletons')).toHaveCount(0);
 release();await expect(page.locator('.token-grid')).toContainText('Fresh Ocean');
 await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByLabel('DEX status').selectOption('paid');
 await expect(page.locator('.token-grid')).toContainText('Paid coin');await expect(page.locator('.token-grid')).not.toContainText('Fresh Ocean');expect(queries.at(-1)?.get('dex')).toBe('paid');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByLabel('DEX status')).toHaveValue('all');
});
