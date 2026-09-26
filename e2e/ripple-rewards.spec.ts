import { test, expect, type Page } from "@playwright/test";
const address="11111111111111111111111111111111";
const signature="ripple-confirmed-receipt";
async function setup(page:Page,pending=false) {
  await page.addInitScript(({address,signature,pending})=>{
    localStorage.setItem("aqua:update:holder-workspace-v2","seen");localStorage.setItem("aqua:wallet","phantom");
    if(pending)localStorage.setItem("aqua:pending-reward:mainnet-beta:"+address+":ripple",JSON.stringify({wallet:address,launchId:"coin",name:"Ripple",signature,epochId:"epoch-ripple",amountUsd:250}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signAndSendTransaction(){throw Error("A pending receipt must not be resubmitted");}}}});
  },{address,signature,pending});
  await page.route("**/api/**",r=>{
    const path=new URL(r.request().url()).pathname;
    let json:unknown={};
    if(path==="/api/config")json={brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false},rippleRewards:{enabled:true,rewardBps:1500,boostBps:1000}};
    else if(path.endsWith("/holdings"))json={holdings:[]};
    else if(path.endsWith("/claim-history"))json={claims:[],lifetime:[],hasMore:false};
    else if(path.includes("/notifications/"))json={notifications:[]};
    else if(path==="/api/rewards/"+address||path.endsWith("/rewards"))json={rewards:[],cumulativeRewards:[],holdings:[],markets:[]};
    else if(path.endsWith("/activity"))json={enabled:true,status:"tracking",reason:null,checkedAt:Date.now(),poolLamports:"100000000",rewardBps:1500,boostBps:1000,measurementHours:24,posts:[{id:"123",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:true,createdAt:Date.now()-86400000,score:1234,metrics:{like_count:20,impression_count:1500},amountLamports:"25000000",status:"claimable",reason:null},{id:"124",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,createdAt:Date.now(),score:0,metrics:{like_count:2,impression_count:100},amountLamports:"0",status:"measuring",reason:null}]};
    else if(path==="/api/market-prices/stream")return r.fulfill({contentType:"text/event-stream",body:'data: {"prices":[]}\n\n'});
    else if(path==="/api/market-prices")json={prices:[]};
    else if(path==="/api/launches")json={launches:[],hasMore:false,nextOffset:0};
    else if(path.includes("governance"))json={enabled:false};
    return r.fulfill({json});
  });
  await page.route("**/account/**",r=>r.fulfill({json:{enabled:false}}));
  await page.route("https://rpc.invalid/**",r=>r.fulfill({json:{jsonrpc:"2.0",id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
}
test("Ripple lives in Holdings with separate claims, per-tweet amounts and no mobile overflow",async({page})=>{
  await setup(page);await page.goto("/#/portfolio");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("heading",{name:"Your posts. Your rewards."})).toBeVisible();
  await expect(panel.getByText("0.025 SOL",{exact:true})).toBeVisible();
  await expect(panel.getByText("Measuring · 24h",{exact:true})).toBeVisible();
  await expect(panel.getByRole("link",{name:"Reply on X"})).toHaveAttribute("href","https://x.com/i/status/123");
  await panel.locator("summary").click();
  await expect(panel.getByText(/Holding the coin is not required/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({path:`/tmp/ripple-${test.info().project.name}.png`,fullPage:true});
});
test("Ripple claim confirmation restores its own receipt without touching holder claims",async({page})=>{
  await setup(page,true);let confirmations=0;
  await page.route("**/api/rewards/epoch-ripple/confirm",r=>{confirmations++;expect(r.request().postDataJSON()).toEqual({claimant:address,signature});return r.fulfill({json:{claimed:true,signature}});});
  await page.goto("/#/portfolio");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await panel.getByRole("button",{name:"Check confirmation",exact:true}).click();
  await expect(panel.getByText("$2.50 claimed",{exact:true})).toBeVisible();expect(confirmations).toBe(1);
  expect(await page.evaluate(key=>localStorage.getItem(key),"aqua:pending-reward:mainnet-beta:"+address+":ripple")).toBeNull();
});
