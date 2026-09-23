import { test, expect, type Page } from "@playwright/test";
const wallet = "11111111111111111111111111111111", token = "a".repeat(64), id = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page, enabled = true) {
  let site: any = null;
  const calls: string[] = [];
  const project = {id,name:"Sea Cat",revision:1,updated_at:Date.now(),state:{name:"Sea Cat",launch:{name:"Sea Cat",symbol:"SEA",description:"",stockMint:"",rewardMode:"holder_rewards",imagePath:"",xUrl:"",websiteUrl:"",telegramUrl:"",dexFundingEnabled:false,dexProfile:{description:"",bannerUrl:"",websiteUrl:"",xUrl:"",telegramUrl:""}},files:[{path:"frontend/index.html",content:"<main>Sea Cat</main>",encoding:"utf8",locked:false}],folders:[],lockedFields:[]}};
  await page.addInitScript(({wallet,token}) => {
    localStorage.setItem("aqua:update:holder-workspace-v2","seen");
    localStorage.setItem("aqua:wallet","phantom");
    localStorage.setItem(`aqua:studio:${wallet}`,JSON.stringify({token,expiresAt:Date.now()+86400000}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>wallet},connect:async()=>({publicKey:{toString:()=>wallet}}),on(){},removeListener(){}}}});
  },{wallet,token});
  await page.route("**/api/config",r=>r.fulfill({json:{brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}}));
  await page.route("**/api/launches?**",r=>r.fulfill({json:{launches:[],hasMore:false,nextOffset:0}}));
  await page.route("**/api/governance**",r=>r.fulfill({json:{enabled:false}}));
  await page.route("**/api/notifications/**",r=>r.fulfill({json:{notifications:[]}}));
  await page.route("**/api/market-prices**",r=>r.fulfill({json:{prices:[]}}));
  await page.route("**/account/**",r=>r.fulfill({json:{enabled:false,connected:false}}));
  await page.route("https://rpc.invalid/**",r=>r.fulfill({json:{jsonrpc:"2.0",id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
  await page.route("**/studio/**",async r=>{
    const path = new URL(r.request().url()).pathname.replace(/^.*\/studio/,"");
    if(path === "/config") return r.fulfill({json:{enabled:true,paidEnabled:false,setup:{ready:false,issues:[]},depositsEnabled:false,depositSetup:{ready:false,issues:[]},decimals:6,model:"test",imageModel:"test",knowledge:{pairs:[]},hosting:{enabled,domain:"aquafamily.fun",prefix:"stg-"}}});
    if(path === "/promotion") return r.fulfill({json:{active:false}});
    if(path === "/account") return r.fulfill({json:{balanceMicroUsd:"0",ledger:[]}});
    if(path === "/projects") return r.fulfill({json:[project]});
    if(path === `/projects/${id}`) return r.fulfill({json:project});
    if(path.endsWith("/jobs")) return r.fulfill({json:[]});
    if(path.endsWith("/hosting")) {
      expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
      if(r.request().method() === "POST") { expect(r.request().postDataJSON()).toEqual({slug:"sea-cat",revision:1}); calls.push("publish");site={slug:"sea-cat",url:"https://stg-sea-cat.aquafamily.fun",revision:1,published:true,publishedAt:Date.now()}; }
      if(r.request().method() === "DELETE") { calls.push("unpublish");site.published=false; }
      return r.fulfill({json:{enabled,domain:"aquafamily.fun",prefix:"stg-",site}});
    }
    return r.fulfill({status:404,json:{error:"Unexpected test route "+path}});
  });
  await page.goto("/#/");
  await expect(page.locator(".wallet-menu-trigger")).toBeVisible();
  await page.goto("/#/studio");
  await page.getByRole("button",{name:"Publish",exact:true}).click();
  return calls;
}
test("publishes a project, locks its address, links the live site and unpublishes with confirmation",async({page})=>{
  const calls=await setup(page);
  const dialog=page.getByRole("dialog",{name:"Publish website",exact:true});
  await expect(dialog.getByRole("textbox",{name:"Website name"})).toHaveValue("sea-cat");
  await dialog.getByRole("button",{name:"Publish website",exact:true}).click();
  await expect(dialog.getByRole("link",{name:"Visit website"})).toHaveAttribute("href","https://stg-sea-cat.aquafamily.fun");
  await expect(dialog.getByRole("textbox",{name:"Website name"})).toBeDisabled();
  await dialog.getByRole("button",{name:"Unpublish",exact:true}).click();
  expect(calls).toEqual(["publish"]);
  await dialog.getByRole("button",{name:"Unpublish website",exact:true}).click();
  await expect(dialog.getByRole("link",{name:"Visit website"})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Publish website",exact:true})).toBeEnabled();
  expect(calls).toEqual(["publish","unpublish"]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test("publishing stays disabled until hosting is configured",async({page})=>{
  const calls=await setup(page,false);
  const dialog=page.getByRole("dialog",{name:"Publish website",exact:true});
  await expect(dialog.getByText("Website publishing is not available yet.")).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Publish website",exact:true})).toBeDisabled();
  expect(calls).toEqual([]);
});
