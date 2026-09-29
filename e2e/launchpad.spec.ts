import {test,expect} from "@playwright/test";

test("legacy rewards opens the combined portfolio and retries an existing receipt without another wallet transaction",async({page})=>{
  const address="11111111111111111111111111111111",signature="test-confirmed-receipt";
  await page.addInitScript(({address,signature})=>{
    localStorage.setItem("aqua:wallet","phantom");
    localStorage.setItem("aqua:pending-reward:mainnet-beta:"+address,JSON.stringify({wallet:address,launchId:"m1",name:"Test coin",signature,sequence:"1",amountUsd:300}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>address}}),on:()=>{},removeListener:()=>{},signAndSendTransaction:()=>{throw Error("Should not ask for a second transaction");}}}});
  },{address,signature});
  await page.route("**/api/wallets/*/holdings",r=>r.fulfill({json:{holdings:[]}}));
  await page.route("**/api/wallets/*/claim-history",r=>r.fulfill({json:{claims:[{signature,usd_cents:"300"}],lifetime:[],lifetimeUsdCents:"52380",hasMore:false}}));
  await page.route("**/api/rewards/"+address,r=>r.fulfill({json:{rewards:[],holdings:[],markets:[]}}));
  let confirmations=0,preparations=0;
  await page.route("**/api/rewards/markets/*/claim-transaction",r=>{preparations++;return r.fulfill({status:500,json:{error:"unexpected"}});});
  await page.route("**/api/rewards/markets/m1/confirm",r=>{
    confirmations++;expect(r.request().postDataJSON()).toEqual({claimant:address,signature,sequence:"1"});
    return r.fulfill({json:{claimed:true,signature,sequence:"1",amountRaw:"3000000",stockDecimals:6,stockSymbol:"ORCA"}});
  });
  await page.goto("/#/rewards");
  await expect(page).toHaveURL(/portfolio\?tab=rewards/);
  await page.getByRole("button",{name:"Check confirmation",exact:true}).click();
  await expect(page.getByText("3 ORCA claimed",{exact:true})).toBeVisible();
  const share=page.getByRole("dialog",{name:"Share your reward"});
  await expect(share).toBeVisible();
  await expect(share.getByRole("button",{name:"Post on X"})).toBeEnabled();
  await share.getByRole("button",{name:"Close"}).click();
  expect(confirmations).toBe(1);expect(preparations).toBe(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),"aqua:pending-reward:mainnet-beta:"+address)).toBeNull();
  await page.getByRole("tab",{name:"Holdings",exact:false}).filter({hasText:"Holdings"}).first().click();
  await expect(page.getByRole("heading",{name:"Your positions",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test("analytics prioritizes totals, handles empty history and stays within the viewport",async({page})=>{
  await page.route("**/api/analytics*",r=>r.fulfill({json:{range:new URL(r.request().url()).searchParams.get('range')??'all',
    generatedAt:Date.now(),oldestIndexedAt:Date.now(),stalePriceMarkets:0,marketBreakdownLimit:100,
    totals:{buybackSol:1.25,buybackFundedSol:1.5,rewardsClaimedAllocationUsd:2,rewardsAccumulatedUsd:45,rewardsRedeemableUsd:12,dexFundedMarkets:3,liveMarkets:7,totalMarketCapUsd:8000,volume24hUsd:650},
    markets:[],claimedAssets:[],recentBuybacks:[],rewardHistory:[],buybackHistory:[]
  }}));
  await page.goto("/#/analytics");
  await expect(page.getByRole("heading",{name:"Analytics",exact:true})).toBeVisible();
  await expect(page.locator(".network-metric-featured").getByText("Holder rewards",{exact:true})).toBeVisible();
  await expect(page.locator(".network-metrics article").filter({hasText:"AQUA DEX funded"}).locator("strong")).toHaveText("3");
  await page.getByRole("button",{name:"Buybacks",exact:true}).click();
  await expect(page.getByRole("heading",{name:"No buybacks recorded in this period."})).toBeVisible();
  await expect(page.locator(".workspace-disclosure")).not.toHaveAttribute("open","");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("aqua:update:holder-workspace-v2","seen"));
  await page.route("**/api/auto-rewards/activity?*",route=>route.fulfill({json:{running:false,nextPayoutAt:Date.now()+10800000,rounds:[],selectedRound:null,payouts:[],hasMore:false}}));
  await page.route("**/api/auto-rewards/wallets/*",route=>route.fulfill({json:{wallet:new URL(route.request().url()).pathname.split("/").at(-1),enabled:false,enabledAt:null,nextPayoutAt:Date.now()+10800000,running:false}}));
  await page.route("**/api/config",route=>route.fulfill({json:{brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}}));
  await page.route("**/api/launches?**",route=>route.fulfill({json:{launches:[],hasMore:false,nextOffset:0}}));
  await page.route("**/api/market-prices",route=>route.fulfill({json:{prices:[]}}));
  await page.route("**/api/market-prices/stream",route=>route.fulfill({contentType:"text/event-stream",body:'data: {"prices":[]}\n\n'}));
  await page.route("**/api/governance",route=>route.fulfill({json:{enabled:false}}));
});
test("market controls are visible, bookmarkable and do not overflow",async({page})=>{
  await page.goto("/#/");
  await expect(page.getByRole("heading",{name:"Coins that reward the people who hold."})).toBeVisible();
  await expect(page.getByRole("button",{name:"Card view",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("combobox",{name:"Pair",exact:true})).toHaveCount(0);
  const surface=await page.locator(".explore-intro").evaluate(el=>({padding:parseFloat(getComputedStyle(el).paddingLeft),background:getComputedStyle(document.body).backgroundImage}));
  expect(surface.padding).toBeGreaterThan(12);
  expect(surface.background).toContain("gradient");
  await page.getByRole("button",{name:"Filters",exact:true}).click();
  await page.getByRole("combobox",{name:"Pair",exact:true}).click();
  await page.getByRole("option",{name:"ORCA",exact:true}).click();
  await page.getByRole("button",{name:"Apply filters",exact:true}).click();
  await expect(page).toHaveURL(/pair=ORCA/);
  await page.getByRole("button",{name:"Table view",exact:true}).click();
  await expect(page).toHaveURL(/view=table/);
  await expect(page).toHaveURL(/pair=ORCA/);
  await page.getByRole("button",{name:"Watchlist",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Your watchlist is empty"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button",{name:"Watchlist",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.goto('/#/how-it-works');await page.goto('/#/');
  await expect(page.getByRole("button",{name:"Watchlist",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Filters",exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Filter markets'});
  await expect(dialog.getByRole('combobox',{name:'Pair',exact:true})).toHaveText('ORCA');
  await dialog.getByRole('combobox',{name:'Pair',exact:true}).click();await page.getByRole('option',{name:'SOL',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.reload();await page.getByRole("button",{name:"Filters",exact:true}).click();
  await expect(dialog.getByRole('combobox',{name:'Pair',exact:true})).toHaveText('ORCA');
  await dialog.getByRole('button',{name:'Reset',exact:true}).click();await dialog.getByRole('button',{name:'Apply filters'}).click();
  await page.goto('/#/');await page.getByRole("button",{name:"Filters",exact:true}).click();
  await expect(dialog.getByRole('combobox',{name:'Pair',exact:true})).toHaveText('All pairs');
  await page.keyboard.press('Escape');
  await page.goto('/#/?sort=recent&dex=unpaid');
  await expect(page.getByRole('button',{name:'New',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole("button",{name:"Filters",exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Not paid',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');await page.goto('/#/');
  await expect(page.getByRole('button',{name:'New',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Clear filters'}).click();await page.reload();
  await expect(page.getByRole('button',{name:'Clear filters'})).toHaveCount(0);
});
test("wallet modal closes immediately and returns focus",async({page})=>{
  await page.goto("/#/");
  const button=page.getByRole("button",{name:"Connect wallet",exact:true});await button.click();
  await expect(page.getByRole("dialog",{name:"Connect your wallet"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(button).toBeFocused();
});

test("phone browsers open the current AQUA page in Phantom instead of requiring an extension", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile universal link.");
  await page.goto("/#/portfolio?tab=rewards");
  const original = page.url();
  await page.getByRole("button", {name:"Connect wallet",exact:true}).first().click();
  const link = page.getByRole("link", {name:/Phantom.*Open/});
  const href = await link.getAttribute("href");
  const target = new URL(href!);
  expect(target.origin).toBe("https://phantom.app");
  expect(decodeURIComponent(target.pathname.slice("/ul/browse/".length))).toBe(original);
  expect(target.searchParams.get("ref")).toBe(new URL(original).origin);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.route("https://phantom.app/**", r => r.fulfill({contentType:"text/html",body:"<title>Phantom handoff</title>"}));
  await link.click();
  await expect(page).toHaveURL(href!);
});

test("the wallet picker detects a provider injected after loading", async ({page}) => {
  await page.goto("/#/");
  await page.getByRole("button", {name:"Connect wallet",exact:true}).click();
  await page.evaluate(() => {
    (window as any).phantom = {solana:{isPhantom:true}};
  });
  await expect(page.getByRole("button", {name:/Phantom.*Detected.*Connect/})).toBeVisible();
  await expect(page.getByRole("link", {name:/Phantom.*Open/})).toHaveCount(0);
});
test("unknown routes recover instead of showing a blank shell",async({page})=>{
  await page.goto("/#/missing-market-page");
  await expect(page.getByRole("heading",{name:"Page not found"})).toBeVisible();
  await page.getByRole("link",{name:"Explore markets",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Coins that reward the people who hold."})).toBeVisible();
});
test("holdings asks for a wallet rather than inventing zero balances",async({page})=>{
  await page.goto("/#/portfolio");
  await expect(page.getByRole("heading",{name:"Your portfolio"})).toBeVisible();
  await expect(page.getByText("Priced holdings")).toHaveCount(0);
});

test("claim all confirms coins sequentially and stops safely at an unconfirmed receipt",async({page})=>{
  const {Transaction,SystemProgram,PublicKey}=await import("@solana/web3.js");
  const address="11111111111111111111111111111111";
  const tx=new Transaction({feePayer:new PublicKey(address),recentBlockhash:address}).add(SystemProgram.transfer({fromPubkey:new PublicKey(address),toPubkey:new PublicKey(address),lamports:1}));
  const transactionBase64=tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString("base64");
  await page.addInitScript(address=>{
    localStorage.setItem("aqua:wallet","phantom");let sent=0;
    Object.assign(window,{phantom:{solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>address}}),on:()=>{},removeListener:()=>{},signAndSendTransaction:async()=>({signature:"mock-signature-"+(++sent)})}}});
  },address);
  await page.route("https://rpc.invalid/**",r=>{const req=r.request().postDataJSON();return r.fulfill({json:{jsonrpc:"2.0",id:req.id,result:req.method==="getSignatureStatuses"?{context:{slot:1},value:[{slot:1,confirmations:1,err:null,confirmationStatus:"confirmed"}]}:1}});});
  const confirmed:string[]=[],prepared:string[]=[];
  const markets=["m1","m2","m3"].map((launchId,i)=>({launchId,canClaim:true,claimMode:"cumulative",claimableEpochIds:[],claimableUsdCents:300-i,netClaimableUsdCents:280-i,accumulatingUsdCents:300-i,grossRedeemableUsdCents:300-i,pendingUsdCents:0,estimatedClaimFeeUsdCents:20,minimumClaimUsdCents:100}));
  await page.route("**/api/wallets/*/holdings",r=>r.fulfill({json:{holdings:[]}}));
  await page.route("**/api/wallets/*/claim-history",r=>r.fulfill({json:{claims:[],lifetime:[],hasMore:false}}));
  await page.route("**/api/rewards/"+address,r=>r.fulfill({json:{rewards:[],holdings:[],markets:markets.filter(m=>!confirmed.includes(m.launchId))}}));
  await page.route("**/api/rewards/markets/*/claim-transaction",r=>{
    const id=r.request().url().split("/").at(-2)!;prepared.push(id);
    if(id==="m2")expect(confirmed).toEqual(["m1"]);
    return r.fulfill({json:{transactionBase64,transactionVersion:"legacy",lastValidBlockHeight:100,sequence:"1"}});
  });
  await page.route("**/api/rewards/markets/*/confirm",r=>{
    const id=r.request().url().split("/").at(-2)!;
    if(id==="m2")return r.fulfill({status:409,json:{error:"Still finalizing"}});
    confirmed.push(id);return r.fulfill({json:{amountRaw:"3000000",stockDecimals:6,stockSymbol:"ORCA"}});
  });
  await page.goto("/#/portfolio?tab=rewards");
  await expect(page.locator(".portfolio-value > strong")).toHaveCSS("color","rgb(255, 255, 255)");
  await expect(page.locator(".rewards-gift-art")).toBeVisible();
  await page.getByRole("button",{name:"Claim all",exact:true}).click();
  await expect(page.getByText("Claim submitted. Confirmation is pending; you can safely retry confirmation.")).toBeVisible();
  expect(prepared).toEqual(["m1","m2"]);expect(confirmed).toEqual(["m1"]);
  await expect(page.getByRole("button",{name:"Claim all",exact:true})).toBeDisabled();
  const receipt=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??"null"),"aqua:pending-reward:mainnet-beta:"+address);
  expect(receipt.launchId).toBe("m2");expect(receipt.signature).toBe("mock-signature-2");
});

test("promotions has both programs, working Studio link and no horizontal overflow",async({page})=>{
  await page.goto("/#/promotions");
  await expect(page.getByRole("heading",{name:"$2,500 in launch rewards"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"$250 for standout creations"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Build in Atlantis"})).toHaveAttribute("href","#/studio");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test('analytics updates in place, animates bars and preserves expanded content across periods',async({page},info)=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let requested=false;
 const now=Date.now();
 await page.route('**/api/analytics*',async r=>{
  const range=new URL(r.request().url()).searchParams.get('range')??'all',short=range==='24h';
  if(short){requested=true;await gate;}
  return r.fulfill({json:{range,generatedAt:now,oldestIndexedAt:now,stalePriceMarkets:0,marketBreakdownLimit:100,totals:{buybackSol:short?1:9,liveMarkets:short?2:10,volumeUsd:short?100:900,dexFundedMarkets:short?1:3,rewardsAccumulatedUsd:short?10:50},markets:Array.from({length:12},(_,i)=>({id:'m'+i,name:'Test coin '+i,symbol:'TEST',volumeUsd:short?100:900,rewardsAccumulatedUsd:short?10:50,buybackSol:short?1:9})),claimedAssets:[],recentBuybacks:short?[]:[{signature:'receipt',createdAt:now,amountSol:9,amountTokens:100}],rewardHistory:(short?[1,2,7]:[40,8,2]).map((allocatedUsd,i)=>({time:now-(3-i)*3600000,allocatedUsd})),buybackHistory:[]}});
 });
 await page.goto('/#/analytics');await expect(page.locator('.network-metric-featured strong')).toHaveText('$50.00');await expect(page.getByText('All-time total',{exact:true})).toBeVisible();
 await expect(page.locator('.data-freshness')).toHaveCount(0);
 await page.getByRole('button',{name:'Show more markets'}).click();
 await page.locator('.workspace-disclosure summary').click();
 const chart=await page.locator('.allocation-chart .recharts-surface').elementHandle();
 const panel=await page.locator('.network-metrics').elementHandle();
 await page.getByRole('button',{name:'24 hours',exact:true}).click();
 try{
  await expect.poll(()=>requested).toBe(true);
  await expect(page.getByRole('button',{name:'24 hours',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.network-metric-featured strong')).toHaveText('$50.00');
  await expect(page.getByText('All-time total',{exact:true})).toBeVisible();
  await expect(page.locator('.workspace-loading')).toHaveCount(0);
  await expect(page.locator('.workspace-disclosure')).toHaveAttribute('open','');
  await expect(page.locator('.analytics-market-table tbody tr')).toHaveCount(12);
  const animation=page.evaluate(()=>new Promise<number>(resolve=>{
   const shapes=new Set<string>(),start=performance.now();
   const sample=()=>{shapes.add([...document.querySelectorAll('.allocation-chart .recharts-bar-rectangle path')].map(el=>el.getAttribute('d')).join('|'));if(performance.now()-start<1200)requestAnimationFrame(sample);else resolve(shapes.size);};sample();
  }));
  release();
  await expect(page.locator('.network-metric-featured strong')).toHaveText('$10.00');
  expect(await animation).toBeGreaterThan(2);
  expect(await panel!.evaluate(el=>el.isConnected)).toBe(true);expect(await chart!.evaluate(el=>el.isConnected)).toBe(true);
  await expect(page.locator('.workspace-disclosure')).toHaveAttribute('open','');
  await expect(page.locator('.analytics-market-table tbody tr')).toHaveCount(12);
  await expect(page.locator('.analytics-market-table tbody')).toContainText('$100');await expect(page.locator('.recent-buybacks')).toContainText('No buybacks in this period.');
  await expect(page.locator('.network-metrics article').filter({hasText:'Coins launched'}).locator('strong')).toHaveText('2');
  await page.screenshot({path:info.outputPath('compact-analytics.png'),fullPage:true});
 }finally{release();}
});

test('analytics discards superseded periods and retains the last data on refresh failure',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let requested=false,fail=true;
 await page.route('**/api/analytics*',async r=>{
  const range=new URL(r.request().url()).searchParams.get('range')??'all';
  if(range==='24h'){requested=true;await gate;}
  if(range==='30d'&&fail)return r.fulfill({status:503,json:{error:'Unavailable'}});
  return r.fulfill({json:{range,totals:{buybackSol:0,liveMarkets:1,volumeUsd:0,dexFundedMarkets:0,rewardsAccumulatedUsd:range==='7d'?70:range==='30d'?30:50},markets:[],claimedAssets:[],recentBuybacks:[],rewardHistory:[],buybackHistory:[]}}).catch(()=>{});
 });
 await page.goto('/#/analytics');await expect(page.locator('.network-metric-featured strong')).toHaveText('$50.00');
 await page.getByRole('button',{name:'24 hours',exact:true}).click();
 try{
  await expect.poll(()=>requested).toBe(true);await page.getByRole('button',{name:'7 days',exact:true}).click();
  await expect(page.locator('.network-metric-featured strong')).toHaveText('$70.00');release();
  await page.getByRole('button',{name:'30 days',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Showing the last received data.');
  await expect(page.locator('.network-metric-featured strong')).toHaveText('$70.00');
  await expect(page.locator('.network-metric-featured small')).toHaveText('Last 7 days');
  await expect(page.locator('.workspace-loading')).toHaveCount(0);
  fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.locator('.network-metric-featured strong')).toHaveText('$30.00');
  await expect(page.getByRole('alert')).toHaveCount(0);
 }finally{release();}
});

test('analytics preloads periods once, reuses them across navigation and refreshes on demand',async({page})=>{
 const overview:Record<string,number>={},payouts:Record<string,number>={};
 const totals:Record<string,number>={all:50,'24h':24,'7d':70,'30d':30};
 await page.clock.install();
 await page.route('**/api/analytics*',r=>{
  const range=new URL(r.request().url()).searchParams.get('range')??'all';overview[range]=(overview[range]??0)+1;
  return r.fulfill({json:{range,totals:{buybackSol:0,liveMarkets:1,volumeUsd:0,dexFundedMarkets:0,rewardsAccumulatedUsd:totals[range]+100*(overview[range]-1)},markets:[],claimedAssets:[],recentBuybacks:[],rewardHistory:[],buybackHistory:[]}});
 });
 await page.route('**/api/auto-rewards/activity?*',r=>{
  const range=new URL(r.request().url()).searchParams.get('range')??'all';payouts[range]=(payouts[range]??0)+1;
  return r.fulfill({json:{running:false,nextPayoutAt:Date.now(),rounds:[],selectedRound:null,payouts:[],hasMore:false}});
 });
 await page.goto('/#/analytics');
 await expect(page.locator('.network-metric-featured strong')).toHaveText('$50.00');
 const warmed={all:1,'24h':1,'7d':1,'30d':1};
 await expect.poll(()=>overview).toEqual(warmed);await expect.poll(()=>payouts).toEqual(warmed);
 // Wait for response bodies to reach the cache, not just for requests to begin.
 await expect.poll(()=>page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('aqua:analytics')).map(key=>JSON.parse(sessionStorage.getItem(key)!).length))).toEqual([4,4]);
 for(let cycle=0;cycle<2;cycle++)for(const [label,total] of [['24 hours',24],['7 days',70],['30 days',30],['All time',50]] as const){
  await page.getByRole('button',{name:label,exact:true}).click();
  await expect(page.locator('.network-metric-featured strong')).toHaveText('$'+total+'.00');
  await expect(page.locator('.network-metrics')).toHaveAttribute('aria-busy','false');
 }
 await page.clock.fastForward(30_000);
 expect(overview).toEqual(warmed);expect(payouts).toEqual(warmed);
 await page.goto('/#/how-it-works');await page.goto('/#/analytics');
 await expect(page.locator('.network-metric-featured strong')).toHaveText('$50.00');
 await page.reload();await expect(page.locator('.network-metric-featured strong')).toHaveText('$50.00');
 expect(overview).toEqual(warmed);expect(payouts).toEqual(warmed);
 await page.getByRole('button',{name:'24 hours',exact:true}).click();
 await page.getByRole('button',{name:'Refresh analytics',exact:true}).click();
 await expect(page.locator('.network-metric-featured strong')).toHaveText('$124.00');
 expect(overview).toEqual({...warmed,'24h':2});expect(payouts).toEqual(warmed);
 await page.getByRole('button',{name:'Refresh auto rewards',exact:true}).click();
 await expect.poll(()=>payouts).toEqual({...warmed,'24h':2});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
