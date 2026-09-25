import { test, expect, type Page } from '@playwright/test';
const address='11111111111111111111111111111111';
async function setup(page:Page) {
  await page.addInitScript(address=>{
    localStorage.setItem('aqua:update:holder-workspace-v2','seen'); localStorage.setItem('aqua:wallet','phantom');
    Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signMessage:async()=>({signature:new Uint8Array(64).fill(1)})}}});
  },address);
  const diagnostics:any={generatedAt:Date.now(),counts:{live_launches:2,claimable_epochs:1,unclaimed_entitlements:3},flags:{},runtime:{available:false},launches:[],diagnostics:[],conversions:[],settlements:[],rewardPurchases:[],rewardEpochs:[],creatorLocks:[],proposals:[],marketMetrics:{volumeUsd:{'1h':125,'24h':2450,max:12345.67},unpricedVolumeMarkets:1,unclaimedUsd:87.5,unclaimedMarkets:[{id:'coin',name:'Ocean Club',symbol:'OCEAN',unclaimedUsd:87.5,entitlements:3}]}};
  await page.route('**/studio/promotion',r=>r.fulfill({json:{active:false,endsAt:null,serverNow:Date.now()}}));
  await page.route('**/account/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname;
    if(path==='/api/config')return r.fulfill({json:{brand:'AQUA',adminWallet:address,network:'mainnet-beta',useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:true,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}});
    if(path==='/api/admin/challenge')return r.fulfill({json:{challenge:'challenge',message:'Test admin verification',expiresAt:Date.now()+60000}});
    if(path==='/api/admin/session')return r.fulfill({json:{token:'admin-test-session',expiresAt:Date.now()+60000}});
    if(path==='/api/admin/diagnostics')return r.fulfill({json:diagnostics});
    if(path==='/api/analytics')return r.fulfill({json:{totals:{rewardsAccumulatedUsd:200,rewardsRedeemableUsd:87.5,buybackSol:2,volume24hUsd:2450,liveMarkets:2,totalMarketCapUsd:10000},rewardHistory:[],buybackHistory:[],recentBuybacks:[],claimedAssets:[],stalePriceMarkets:0,marketBreakdownLimit:200,markets:[{id:'coin',name:'Ocean Club',symbol:'OCEAN',marketCapUsd:10000,rewardsAccumulatedUsd:200,rewardsRedeemableUsd:87.5,buybackSol:2}]}});
    return r.fulfill({json:{enabled:false,prices:[],notifications:[],launches:[]}});
  });
  await page.route('https://rpc.invalid/**',r=>r.fulfill({json:{jsonrpc:'2.0',id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
  return diagnostics;
}
test('admin switches all volume ranges and opens per-market unclaimed totals',async({page},info)=>{
  const data=await setup(page);await page.goto('/#/admin');await page.getByRole('button',{name:'Verify wallet',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Control room',exact:true})).toBeVisible();
  const volume=page.getByRole('article',{name:'Trading volume'});
  await expect(volume).toContainText('$2,450.00');await expect(volume.getByRole('button',{name:'24hr',exact:true})).toHaveAttribute('aria-pressed','true');
  await volume.getByRole('button',{name:'1hr',exact:true}).click();await expect(volume).toContainText('$125.00');
  await volume.getByRole('button',{name:'Max',exact:true}).click();await expect(volume).toContainText('$12,345.67');await expect(volume).toContainText('All indexed history');await expect(volume).toContainText('1 unpriced market(s) excluded');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.screenshot({path:`/tmp/admin-metrics-${info.project.name}.png`,fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:/Funded & unclaimed/}).click();
  await expect(page.getByRole('heading',{name:'Funded & unclaimed',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'$87.50',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Overview',exact:true}).click();delete data.marketMetrics;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(volume).toContainText('Unavailable');
});
test('public analytics has no unclaimed metric or table column',async({page})=>{
  await setup(page);await page.goto('/#/analytics');await expect(page.getByText('Holder rewards allocated',{exact:true})).toBeVisible();
  await expect(page.locator('main').getByText(/unclaimed/i)).toHaveCount(0);await expect(page.getByRole('columnheader',{name:'Rewards allocated',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'Buyback funding',exact:true})).toBeVisible();
});
