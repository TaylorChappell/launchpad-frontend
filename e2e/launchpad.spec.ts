import {test,expect} from "@playwright/test";
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("aqua:update:atlantis-launch-v1","seen"));
  await page.route("**/api/config",route=>route.fulfill({json:{brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}}));
  await page.route("**/api/launches?**",route=>route.fulfill({json:{launches:[],hasMore:false,nextOffset:0}}));
  await page.route("**/api/market-prices",route=>route.fulfill({json:{prices:[]}}));
  await page.route("**/api/governance",route=>route.fulfill({json:{enabled:false}}));
});
test("market controls are visible, bookmarkable and do not overflow",async({page})=>{
  await page.goto("/#/");
  await expect(page.getByRole("heading",{name:"Find your next community."})).toBeVisible();
  await page.getByRole("combobox",{name:"Pair",exact:true}).selectOption("ORCA");
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
  await expect(page.getByRole("heading",{name:"Find your next community."})).toBeVisible();
});
test("holdings asks for a wallet rather than inventing zero balances",async({page})=>{
  await page.goto("/#/portfolio");
  await expect(page.getByRole("heading",{name:"Your holdings. Your rewards."})).toBeVisible();
  await expect(page.getByText("Priced holdings")).toHaveCount(0);
});
