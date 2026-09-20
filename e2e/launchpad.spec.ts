import {test,expect} from "@playwright/test";

test("legacy rewards opens the combined portfolio and retries an existing receipt without another wallet transaction",async({page})=>{
  const address="11111111111111111111111111111111",signature="test-confirmed-receipt";
  await page.addInitScript(({address,signature})=>{
    localStorage.setItem("aqua:wallet","phantom");
    localStorage.setItem("aqua:pending-reward:mainnet-beta:"+address,JSON.stringify({wallet:address,launchId:"m1",name:"Test coin",signature,sequence:"1",amountUsd:300}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>address}}),on:()=>{},removeListener:()=>{},signAndSendTransaction:()=>{throw Error("Should not ask for a second transaction");}}}});
  },{address,signature});
  await page.route("**/api/wallets/*/holdings",r=>r.fulfill({json:{holdings:[]}}));
  await page.route("**/api/wallets/*/claim-history",r=>r.fulfill({json:{claims:[],lifetime:[],hasMore:false}}));
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
  expect(confirmations).toBe(1);expect(preparations).toBe(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),"aqua:pending-reward:mainnet-beta:"+address)).toBeNull();
  await page.getByRole("button",{name:"Holdings",exact:false}).filter({hasText:"Holdings"}).first().click();
  await expect(page.getByRole("heading",{name:"Your positions",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test("analytics prioritizes totals, handles empty history and stays within the viewport",async({page})=>{
  await page.route("**/api/analytics",r=>r.fulfill({json:{
    generatedAt:Date.now(),oldestIndexedAt:Date.now(),stalePriceMarkets:0,marketBreakdownLimit:100,
    totals:{buybackSol:1.25,buybackFundedSol:1.5,rewardsClaimedAllocationUsd:2,rewardsAccumulatedUsd:45,rewardsRedeemableUsd:12,liveMarkets:7,totalMarketCapUsd:8000,volume24hUsd:650},
    markets:[],claimedAssets:[],recentBuybacks:[],rewardHistory:[],buybackHistory:[]
  }}));
  await page.goto("/#/analytics");
  await expect(page.getByRole("heading",{name:"Activity that gives back."})).toBeVisible();
  await expect(page.getByText("Holder rewards allocated",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Buybacks",exact:true}).click();
  await expect(page.getByRole("heading",{name:"No buybacks recorded in this period."})).toBeVisible();
  await expect(page.locator(".workspace-disclosure")).not.toHaveAttribute("open","");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("aqua:update:holder-workspace-v2","seen"));
  await page.route("**/api/config",route=>route.fulfill({json:{brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}}));
  await page.route("**/api/launches?**",route=>route.fulfill({json:{launches:[],hasMore:false,nextOffset:0}}));
  await page.route("**/api/market-prices",route=>route.fulfill({json:{prices:[]}}));
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
  await page.getByRole("combobox",{name:"Pair",exact:true}).selectOption("ORCA");
  await expect(page).toHaveURL(/pair=ORCA/);
  await page.getByRole("button",{name:"Table view",exact:true}).click();
  await expect(page).toHaveURL(/view=table/);
  await expect(page).toHaveURL(/pair=ORCA/);
  await page.getByRole("button",{name:"Watchlist",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Your watchlist is empty"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test("wallet modal closes immediately and returns focus",async({page})=>{
  await page.goto("/#/");
  const button=page.getByRole("button",{name:"Connect wallet",exact:true});await button.click();
  await expect(page.getByRole("dialog",{name:"Connect your wallet"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(button).toBeFocused();
});
test("unknown routes recover instead of showing a blank shell",async({page})=>{
  await page.goto("/#/missing-market-page");
  await expect(page.getByRole("heading",{name:"Page not found"})).toBeVisible();
  await page.getByRole("link",{name:"Explore markets",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Coins that reward the people who hold."})).toBeVisible();
});
test("holdings asks for a wallet rather than inventing zero balances",async({page})=>{
  await page.goto("/#/portfolio");
  await expect(page.getByRole("heading",{name:"Your holdings. Your rewards."})).toBeVisible();
  await expect(page.getByText("Priced holdings")).toHaveCount(0);
});
