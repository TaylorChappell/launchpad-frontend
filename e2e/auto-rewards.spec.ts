import {test,expect,type Page} from '@playwright/test';
const address='11111111111111111111111111111111',round=Date.UTC(2026,8,29,12),next=round+10800000;
async function setup(page:Page,connected=false){
 await page.addInitScript(({address,connected})=>{
  localStorage.setItem('aqua:update:holder-workspace-v2','seen');sessionStorage.setItem('aqua:x-prompt:'+address,'1');
  if(connected){localStorage.setItem('aqua:wallet','phantom');Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signMessage:async()=>({signature:new Uint8Array(64).fill(1)})}}});}
 },{address,connected});
 // Only the test's routed widget is synthetic. Production still requires server-side Siteverify.
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*',r=>r.fulfill({contentType:'application/javascript',body:`window.turnstile={render(el,opts){const b=document.createElement('button');b.type='button';b.textContent='Test verification';b.onclick=()=>{opts.callback('test-token');b.disabled=true;};el.style.minWidth=opts.size==='compact'?'150px':'300px';el.appendChild(b);return 'widget';},remove(){}};`}));
 await page.route('**/account/**',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({json:path.endsWith('/auth/challenge')?{id:'00000000-0000-4000-8000-000000000001',message:'Sign in to AQUA'}:path.endsWith('/auth/session')?{token:'a'.repeat(64),expiresAt:Date.now()+86400000}:{enabled:false,profiles:[]}});});
 await page.route('**/studio/promotion',r=>r.fulfill({json:{active:false}}));
 await page.route('**/api/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path==='/api/config')return r.fulfill({json:{brand:'AQUA',adminWallet:address,network:'mainnet-beta',useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}});
  if(path==='/api/auto-rewards/config')return r.fulfill({json:{siteKey:'test-site',walletlessEnabled:true,running:true}});
  if(path.startsWith('/api/auto-rewards/wallets/'))return r.fulfill({json:{wallet:address,enabled:false,enabledAt:null,nextPayoutAt:next,running:true}});
  if(path==='/api/auto-rewards/activity'||path==='/api/admin/auto-rewards/activity')return r.fulfill({json:{running:true,nextPayoutAt:next,selectedRound:round,rounds:[{scheduled_at:round,status:'completed',paid_wallets:1,payouts:1,paid_usd_cents:'625'}],payouts:[{id:'paid',wallet:address,launch_id:'ocean',name:'Ocean',status:'paid',amount_raw:'50000000',received_raw:'50000000',stock_symbol:'SOL',stock_decimals:9,usd_cents:625,signature:'receipt',paid_at:round+1000}],hasMore:false}});
  if(path==='/api/admin/auto-rewards/wallets')return r.fulfill({json:{wallets:[],hasMore:false}});
  if(path==='/api/admin/challenge')return r.fulfill({json:{challenge:'challenge',message:'Test verification',expiresAt:Date.now()+60000}});
  if(path==='/api/admin/session')return r.fulfill({json:{token:'admin-session',expiresAt:Date.now()+60000}});
  if(path==='/api/admin/diagnostics')return r.fulfill({json:{generatedAt:Date.now(),counts:{},flags:{},runtime:{available:false},launches:[],diagnostics:[],conversions:[],settlements:[],rewardPurchases:[],rewardEpochs:[],creatorLocks:[],proposals:[]}});
  if(path==='/api/analytics')return r.fulfill({json:{totals:{rewardsAccumulatedUsd:200,buybackSol:2,volume24hUsd:2450,liveMarkets:1,totalMarketCapUsd:10000},rewardHistory:[],buybackHistory:[],recentBuybacks:[],claimedAssets:[],stalePriceMarkets:0,marketBreakdownLimit:200,markets:[]}});
  return r.fulfill({json:{enabled:false,holdings:[],claims:[],lifetime:[],hasMore:false,posts:[],totalPosts:0,notifications:[],launches:[],prices:[],rewards:[],cumulativeRewards:[],markets:[]}});
 });
 await page.route('https://rpc.invalid/**',r=>r.fulfill({json:{jsonrpc:'2.0',id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
}
test('walletless activation requires verification, shows the daily limit and can retry',async({page},info)=>{
 await setup(page);let attempts=0;await page.route('**/api/auto-rewards/walletless',r=>{expect(r.request().postDataJSON()).toEqual({wallet:address,captcha:'test-token'});attempts++;return r.fulfill(attempts===1?{status:429,json:{error:'This network has already enabled another wallet today. Try again tomorrow.'}}:{json:{wallet:address,enabled:true,enabledAt:Date.now(),nextPayoutAt:next,running:true}});});
 await page.goto('/#/auto-rewards');await page.getByLabel('Solana wallet address').fill(address);const enable=page.getByRole('button',{name:'Enable auto rewards',exact:true});await expect(enable).toBeDisabled();
 await page.screenshot({path:info.outputPath('compact-auto-rewards-form.png'),fullPage:true});
 await page.getByRole('button',{name:'Test verification'}).click();await enable.click();await expect(page.getByRole('alert')).toContainText('already enabled another wallet');await expect(enable).toBeDisabled();
 await page.getByRole('button',{name:'Test verification'}).click();await enable.click();await expect(page.getByRole('heading',{name:'Auto rewards enabled'})).toBeVisible();
 await expect(page.getByText('Existing rewards stay available to claim manually.',{exact:false})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('holdings toggle authenticates the wallet and persists after reload',async({page})=>{
 await setup(page,true);let enabled=false;
 await page.route('**/api/auto-rewards/wallets/*',r=>r.fulfill({json:{wallet:address,enabled,enabledAt:null,nextPayoutAt:next,running:true}}));
 await page.route('**/api/auto-rewards/settings',r=>{expect(r.request().headers().authorization).toBe('Bearer '+'a'.repeat(64));enabled=r.request().postDataJSON().enabled;return r.fulfill({json:{wallet:address,enabled,enabledAt:Date.now(),nextPayoutAt:next,running:true}});});
 await page.goto('/#/portfolio');const toggle=page.getByRole('switch',{name:'Auto rewards'});await expect(toggle).toHaveAttribute('aria-checked','false');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');await page.reload();await expect(toggle).toHaveAttribute('aria-checked','true');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');
});
test('analytics displays the global round, wallet, amount and receipt without mobile overflow',async({page},info)=>{
 await setup(page);await page.goto('/#/analytics');const panel=page.getByRole('region',{name:'Auto rewards activity'});await expect(panel).toContainText('Next global round');await expect(panel.getByRole('cell',{name:/\$6.25/})).toBeVisible();await expect(panel.getByRole('cell',{name:'Paid',exact:true})).toBeVisible();await expect(panel.getByRole('link',{name:'View',exact:true})).toHaveAttribute('href','https://solscan.io/tx/receipt');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await panel.screenshot({path:info.outputPath('compact-auto-rewards-analytics.png')});
});
test('verified admins can enable a wallet with no CAPTCHA or duplicated search',async({page})=>{
 await setup(page,true);let enabled=false;
 await page.route('**/api/admin/auto-rewards/wallets*',r=>{if(r.request().method()==='POST'){expect(r.request().headers().authorization).toBe('Bearer admin-session');expect(r.request().postDataJSON()).toEqual({wallet:address,enabled:true});enabled=true;return r.fulfill({json:{wallet:address,enabled:true}});}return r.fulfill({json:{wallets:enabled?[{wallet:address,enabled:true,enabled_at:round,source:'admin'}]:[],hasMore:false}});});
 await page.goto('/#/admin?section=auto-rewards');await page.getByRole('button',{name:'Verify wallet',exact:true}).click();await expect(page.getByRole('heading',{name:'Auto rewards wallets'})).toBeVisible();await expect(page.getByLabel('Search admin records')).toHaveCount(0);await page.getByLabel('Wallet address',{exact:true}).fill(address);await page.getByRole('button',{name:'Enable auto rewards',exact:true}).click();await expect(page.getByRole('button',{name:'Disable',exact:true})).toBeVisible();
});

test('walletless verification fits a narrow phone without horizontal scrolling',async({page},info)=>{
 await page.setViewportSize({width:320,height:740});await setup(page);await page.goto('/#/auto-rewards');await expect(page.getByRole('button',{name:'Test verification'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.screenshot({path:info.outputPath('compact-auto-rewards-narrow.png'),fullPage:true});
});
