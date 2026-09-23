import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('aqua:update:holder-workspace-v2','seen'));
 await page.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname==='/api/config'?{brand:'AQUA',network:'mainnet-beta',useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:true,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}:{prices:[],launches:[],hasMore:false}}));
 await page.route('**/studio/promotion',r=>r.fulfill({json:{active:true,endsAt:null,serverNow:Date.now(),allowanceUsd:10}}));
 await page.route('**/account/x/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
});
test('developer examples use the canonical public domain independently of staging',async({page},info)=>{
 await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.AQUA_CONFIG={API_URL:"https://launchpad-backend-staging.up.railway.app"};'}));
 const backendRequests:string[]=[];page.on('request',r=>{if(r.url().includes('/api/config'))backendRequests.push(r.url());});
 await page.goto('/#/developers');
 await expect(page.locator('.dev-code').first()).toContainText('curl https://aquafamily.fun/v1/markets');
 await expect(page.locator('.dev-base')).toHaveAttribute('href','https://aquafamily.fun/v1');
 await expect(page.locator('#overview')).toContainText('previous');
 expect(backendRequests).toContain('https://launchpad-backend-staging.up.railway.app/api/config');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.screenshot({path:`/tmp/aqua-developers-${info.project.name}.png`});
});
test('guide explains current builder, community and funding behavior without mobile overflow',async({page},info)=>{
 await page.goto('/#/how-it-works');
 await expect(page.locator('#atlantis-studio')).toContainText('$10 total AI budget per wallet');
 for(const [id,text] of [['launch-recovery','Resume launch'],['website-publishing','explicit per-project choice'],['dex-boosts','5%, 10%, 20% or No'],['automatic-funds','expires after 24 hours'],['community','Community polls collect opinions'],['public-api','https://aquafamily.fun/v1']])await expect(page.locator('#'+id)).toContainText(text);
 const broken=await page.locator('nav[aria-label="How AQUA works sections"] button').evaluateAll(buttons=>buttons.length);expect(broken).toBeGreaterThan(20);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.locator('#automatic-funds').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/aqua-guide-${info.project.name}.png`});
});
