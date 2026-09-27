import { test, expect, type Page } from '@playwright/test';
const address='11111111111111111111111111111111', now=Date.now();
const signature='2'.repeat(88);
const conversion={id:'conversion',launchId:'ocean',symbol:'OCEAN',name:'Ocean Club',decimals:6,status:'distributed',route:'direct_launch_pool',grossRaw:'125000000',inputRaw:'120000000',inputLossRaw:'0',solLamports:'2000000000',createdAt:now-60000,updatedAt:now-1000,soldAt:now-2000,estimatedSaleTime:false,error:null,
  slicePolicy:{maxImpactBps:50,quote:{observedAt:now-60000,grossRaw:'125000000',inputRaw:'120000000',estimatedSolLamports:'2000000000',estimatedUsdCents:'25000',impactBps:25}},
  withdrawSignature:null,poolSignature:signature,swapSignature:signature,payoutSignature:null,stepCount:1,
  steps:[{step:'pool',signature,status:'confirmed',bytes:1100,feeLamports:'5000',createdAt:now-3000,updatedAt:now-2000}]};
const market={launchId:'ocean',symbol:'OCEAN',name:'Ocean Club',mint:'mint',decimals:6,vaultRaw:'9007199254740993',vaultUsd:1801.44,indexedAt:now-5000,status:'waiting',stage:'conversion',message:'Fee conversion is pacing sales; the next slice is not due yet.',lastAttemptAt:now-1000,lastSuccessAt:now-60000,batchBudgetRaw:'1000000000',batchRemainingRaw:'750000000',nextSliceAt:now+60000,pacing:{status:'scheduled',observedAt:now-1000,estimatedClearAt:now+7200000,catchup:{mode:'catch_up',reason:'buying_active',participationBps:750,buyBudgetRaw:'500000000'}},backlogRaw:'9007199254740993',backlogUsd:1801.44,incomingHourUsd:500,convertedHourUsd:1400,estimatedClearAt:now+7200000,conversionId:'pending',conversionStatus:'planned',plannedRaw:'125000000',plannedCurrentUsd:250,slicePolicy:conversion.slicePolicy,conversionError:null};
async function setup(page:Page,authorized=true) {
  const requests:URL[]=[],state={fail:false};
  await page.addInitScript(({address})=>{
    sessionStorage.setItem('aqua-admin-session-v1','verified-admin');
    localStorage.setItem('aqua:update:holder-workspace-v2','seen');localStorage.setItem('aqua:wallet','phantom');
    Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signMessage:async()=>({signature:new Uint8Array(64).fill(1)})}}});
  },{address});
  await page.route('**/studio/promotion',r=>r.fulfill({json:{active:false,endsAt:null,serverNow:now}}));
  await page.route('**/account/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
  await page.route('**/api/**',r=>{
    const url=new URL(r.request().url()),path=url.pathname;
    if(path==='/api/config')return r.fulfill({json:{brand:'AQUA',adminWallet:authorized?address:'other-wallet',network:'mainnet-beta',useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}});
    if(path==='/api/admin/diagnostics')return r.fulfill({json:{generatedAt:now,proposals:[],diagnostics:[],launches:[],runtime:{available:false},conversions:[],settlements:[],rewardPurchases:[],rewardEpochs:[],counts:{},flags:{}}});
    if(path==='/api/admin/fee-keeper'){
      expect(r.request().headers().authorization).toBe('Bearer verified-admin');requests.push(url);
      if(state.fail)return r.fulfill({status:503,json:{error:'Analytics temporarily unavailable'}});
      const offset=Number(url.searchParams.get('offset')),search=url.searchParams.get('search'),range=url.searchParams.get('range');
      return r.fulfill({json:{generatedAt:now,range,search,settings:{enabled:true,conversionEnabled:true,slicingEnabled:true,intervalMs:60000,conversionIntervalMs:15000,catchupEnabled:true,buyParticipationBps:750,minimumUsd:1,preferredSliceUsd:50,clearHours:2,maxImpactBps:50,slippageBps:100},
        summary:{markets:search?0:1,active:search?0:1,blocked:0,lastAttemptAt:now-1000,throughput:{backlogUsd:1801.44,incomingHourUsd:500,convertedHourUsd:1400,catchupMarkets:1,unknownPrices:0},sales:{count:3,solLamports:range==='1h'?'1000000000':'6000000000',averageLamports:'2000000000',largestLamports:'3000000000',estimatedTimeCount:0},transactions:{confirmed:9,feeLamports:'45000',missingFeeCount:0}},
        queue:search?[]:[market],queueLimit:100,history:search?[]:[{...conversion,id:offset?'older':'conversion',symbol:offset?'OLDER':'OCEAN'}],total:search?0:26,offset,limit:25,hasMore:!search&&offset===0}});
    }
    return r.fulfill({json:{enabled:false,prices:[],notifications:[],launches:[]}});
  });
  await page.route('https://rpc.invalid/**',r=>r.fulfill({json:{jsonrpc:'2.0',id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
  return {requests,state};
}
test('admin sees planned sales, exact amounts and expandable transaction sizes on desktop and mobile',async({page},info)=>{
  await setup(page);await page.goto('/#/admin?section=keeper');
  await expect(page.getByRole('heading',{name:'What the keeper is doing'})).toBeVisible();
  const queue=page.getByRole('region',{name:'Fee keeper market queue'});
  await expect(queue).toContainText('9,007,199,254.740993 OCEAN');
  await expect(queue).toContainText('$250.00 at planning');await expect(queue).toContainText('0.25% quoted impact');
  await expect(page.getByLabel('Fee keeper throughput')).toContainText('$1,801.44');
  await expect(page.getByLabel('Fee keeper throughput')).toContainText('7.5%');
  await expect(queue).toContainText('catch up');await expect(queue).toContainText('Processed $1,400.00 /h');
  await expect(page.getByLabel('Conversion controls')).toContainText('15s');
  const card=page.locator('.ops-keeper-conversion').first();await card.locator('summary').click();
  await expect(card.getByRole('cell',{name:'1,100 bytes'})).toBeVisible();
  await expect(card.getByRole('cell',{name:'0.000005 SOL',exact:true})).toBeVisible();
  await expect(card.locator('a[href*="solscan.io/tx/"]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.screenshot({path:info.outputPath('fee-keeper.png'),fullPage:true,animations:'disabled'});
});
test('range, pagination, search and refresh failures keep the report understandable',async({page})=>{
  const {requests,state}=await setup(page);await page.goto('/#/admin?section=keeper');
  await expect(page.locator('.ops-keeper-history')).toContainText('$OCEAN');
  await page.getByRole('button',{name:'Next conversions'}).click();await expect(page.locator('.ops-keeper-history')).toContainText('$OLDER');
  await page.getByRole('button',{name:'1 hour',exact:true}).click();await expect(page.locator('.ops-keeper-history')).toContainText('$OCEAN');
  await expect(page.getByRole('button',{name:'1 hour',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(requests.at(-1)?.searchParams.get('offset')).toBe('0');expect(requests.at(-1)?.searchParams.get('range')).toBe('1h');
  state.fail=true;await page.getByRole('button',{name:'Refresh keeper'}).click();
  await expect(page.getByRole('alert')).toContainText('Showing the last successful snapshot');
  state.fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('textbox',{name:'Search admin records'}).fill('missing');
  await expect(page.getByText('No markets match your search.',{exact:true})).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('search')).toBe('missing');
});
test('the fee keeper report is inaccessible to non-admin wallets',async({page})=>{
  const {requests}=await setup(page,false);await page.goto('/#/admin?section=keeper');
  await expect(page.getByRole('heading',{name:'Access restricted'})).toBeVisible();
  expect(requests).toHaveLength(0);await expect(page.getByRole('heading',{name:'What the keeper is doing'})).toHaveCount(0);
});
test('the active tab refreshes itself and stops fetching when the admin leaves it',async({page})=>{
  const {requests}=await setup(page);await page.goto('/#/admin?section=keeper');
  await expect(page.getByRole('heading',{name:'What the keeper is doing'})).toBeVisible();
  await page.clock.install();
  const before=requests.length;
  await page.getByRole('button',{name:'Refresh keeper'}).click();
  await expect(page.getByRole('button',{name:'Refresh keeper'})).toBeEnabled();
  const refreshed=requests.length;expect(refreshed).toBeGreaterThan(before);
  await page.clock.fastForward(16_000);await expect.poll(()=>requests.length).toBeGreaterThan(refreshed);
  await page.getByRole('button',{name:'Overview',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Action queue'})).toBeVisible();
  const left=requests.length;await page.clock.fastForward(30_000);expect(requests.length).toBe(left);
});
