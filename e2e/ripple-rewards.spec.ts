import { test, expect, type Page } from "@playwright/test";
const address="11111111111111111111111111111111";
const signature="ripple-confirmed-receipt";
async function setup(page:Page,pending=false,linked=true,tracking="live") {
  await page.addInitScript(({address,signature,pending})=>{
    sessionStorage.setItem("aqua:x-prompt:"+address,"1");localStorage.setItem("aqua:update:holder-workspace-v2","seen");localStorage.setItem("aqua:wallet","phantom");
    if(pending)localStorage.setItem("aqua:pending-reward:mainnet-beta:"+address+":ripple",JSON.stringify({wallet:address,launchId:"coin",name:"Ripple",signature,epochId:"epoch-ripple",amountUsd:250}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signMessage:async()=>({signature:new Uint8Array(64)}),signAndSendTransaction(){throw Error("A pending receipt must not be resubmitted");}}}});
  },{address,signature,pending});
  await page.route("**/api/**",r=>{
    const path=new URL(r.request().url()).pathname;
    let json:unknown={};
    if(path==="/api/config")json={brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false},rippleRewards:{enabled:true,rewardBps:1500,boostBps:1000}};
    else if(path.endsWith("/holdings"))json={holdings:[]};
    else if(path.endsWith("/claim-history"))json={claims:[],lifetime:[],hasMore:false};
    else if(path.includes("/notifications/"))json={notifications:[]};
    else if(path==="/api/rewards/"+address||path.endsWith("/rewards"))json={rewards:[],cumulativeRewards:[],holdings:[],markets:[]};
    else if(path.endsWith("/activity"))json={enabled:true,signedIn:true,holdersOnly:true,status:"tracking",reason:null,checkedAt:Date.now(),poolLamports:"100000000",rewardBps:1500,boostBps:1000,service:{mode:tracking,message:tracking==="paused"?"Daily X tracking limit reached. Tracking resumes after midnight UTC.":null,lastEventAt:Date.now(),settlementMinutes:15},nextPayoutAt:Date.now()+900000,measurementHours:8,checkHours:[1,2,4,8],settlementHours:1,totalPosts:142,posts:[{id:"123",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:true,createdAt:Date.now()-86400000,text:"Come swim with $OCEAN",checksCompleted:2,totalChecks:4,nextCheckAt:Date.now()+3600000,trackingStatus:"tracking",score:1234,metrics:{like_count:20,impression_count:1500},amountLamports:"25000000",status:"claimable",reason:null},{id:"124",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,createdAt:Date.now(),text:"A new $OCEAN post",checksCompleted:0,totalChecks:32,nextCheckAt:Date.now()+3600000,trackingStatus:"tracking",score:0,metrics:{like_count:2,impression_count:100},amountLamports:"0",status:"measuring",reason:null},{id:"125",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,createdAt:Date.now()-172800000,text:"The biggest $OCEAN reward",metrics:{like_count:99},amountLamports:"1000000000",status:"claimable",reason:null}]};
    else if(path==="/api/market-prices/stream")return r.fulfill({contentType:"text/event-stream",body:'data: {"prices":[]}\n\n'});
    else if(path==="/api/market-prices")json={prices:[]};
    else if(path==="/api/launches")json={launches:[],hasMore:false,nextOffset:0};
    else if(path.includes("governance"))json={enabled:false};
    return r.fulfill({json});
  });
  await page.route("**/account/x/config",r=>r.fulfill({json:{enabled:true}}));
  await page.route("**/v1/wallets/x?*",r=>r.fulfill({json:{profiles:linked?{[address]:{id:"10",username:"aqua_tester",name:"Tester",avatarUrl:null,profileUrl:"https://x.com/aqua_tester",connectedAt:1,updatedAt:1}}:{}}}));
  await page.route("https://rpc.invalid/**",r=>r.fulfill({json:{jsonrpc:"2.0",id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
}
test("Ripple has its own tab with separate claims, post rewards and no mobile overflow",async({page})=>{
  await setup(page);await page.goto("/#/portfolio");
  const nav=page.getByRole("navigation",{name:"Portfolio sections"});
  await expect(nav.getByRole("button")).toHaveText(["Holdings0","Rewards","Ripple142","Activity","Created"]);
  await expect(page.getByRole("region",{name:"Ripple Rewards",exact:true})).toHaveCount(0);
  await nav.getByRole("button",{name:/^Ripple\s*142$/}).click();
  await expect(page).toHaveURL(/tab=ripple/);
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("heading",{name:"Ripple Rewards",exact:true})).toBeVisible();
  await expect(panel.getByText("0.025 SOL",{exact:true})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Claim",exact:true})).toBeDisabled();
  await expect(panel.getByText("No rewards to claim yet.", {exact:true})).toHaveCount(0);
  await expect(panel.getByText(/Live detection|Hourly rewards|15-minute rewards|Next round|Next check|Check \d of|Last checked|Scheduled detection/)).toHaveCount(0);
  await expect(panel.getByText("0 SOL",{exact:true})).toBeVisible();
  await expect(panel.getByText("A new $OCEAN post",{exact:true})).toBeVisible();
  await expect(panel.locator('.ripple-post-amount b')).toHaveText(['1 SOL','0.025 SOL','0 SOL']);
  await expect(panel.locator('.ripple-post-metrics').nth(1)).toContainText('20 likes');
  await expect(panel.getByRole("link",{name:"Reply on X"})).toHaveAttribute("href","https://x.com/i/status/123");
  await expect(panel.getByText("From every reward mode")).toHaveCount(0);
  await expect(panel.getByText("Awaiting activation")).toHaveCount(0);
  await expect(panel.getByText("Your posts. Your rewards.")).toHaveCount(0);
  await page.reload();await expect(panel.getByText("0.025 SOL",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({path:`/tmp/ripple-${test.info().project.name}.png`,fullPage:true});
});
test("Ripple claim confirmation restores its own receipt without touching holder claims",async({page})=>{
  await setup(page,true);let confirmations=0;
  await page.route("**/api/rewards/epoch-ripple/confirm",r=>{confirmations++;expect(r.request().postDataJSON()).toEqual({claimant:address,signature});return r.fulfill({json:{claimed:true,signature}});});
  await page.goto("/#/portfolio?tab=ripple");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await panel.getByRole("button",{name:"Check confirmation",exact:true}).click();
  await expect(panel.getByText("$2.50 claimed",{exact:true})).toBeVisible();expect(confirmations).toBe(1);
  expect(await page.evaluate(key=>localStorage.getItem(key),"aqua:pending-reward:mainnet-beta:"+address+":ripple")).toBeNull();
});

test("unlinked wallets see a centered Connect X prompt in Ripple",async({page})=>{
  await setup(page,false,false);await page.goto("/#/portfolio?tab=ripple");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("heading",{name:"Connect X to your wallet"})).toBeVisible();
  const button=panel.getByRole("button",{name:"Connect X",exact:true});await expect(button).toBeEnabled();
  await expect(panel.getByRole("button",{name:"Claim all"})).toHaveCount(0);
  const box=await panel.boundingBox(),connect=await button.boundingBox();
  expect(Math.abs((box!.x+box!.width/2)-(connect!.x+connect!.width/2))).toBeLessThan(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test("an expired AQUA session can sign in again while existing Ripple claims stay visible",async({page})=>{
  await setup(page,true);let signedIn=false,signatures=0;
  await page.route("**/api/ripple/*/activity",r=>r.fulfill({json:{enabled:true,signedIn,holdersOnly:true,status:"tracking",reason:null,checkedAt:Date.now(),poolLamports:"0",rewardBps:1500,boostBps:1000,measurementHours:8,checkHours:[1,2,4,8],settlementHours:1,posts:[]}}));
  await page.route("**/account/auth/challenge",r=>r.fulfill({json:{id:"00000000-0000-4000-8000-000000000001",message:"Sign in to AQUA"}}));
  await page.route("**/account/auth/session",r=>{
    expect(r.request().postDataJSON().wallet).toBe(address);expect(r.request().postDataJSON().signature).toBeTruthy();
    signatures++;signedIn=true;return r.fulfill({json:{token:"a".repeat(64),expiresAt:Date.now()+86400000}});
  });
  await page.goto("/#/portfolio?tab=ripple");const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByText("Sign in to AQUA to earn new Ripple rewards.")).toBeVisible();
  await expect(panel.getByRole("button",{name:"Check confirmation",exact:true})).toBeVisible();expect(signatures).toBe(0);
  await panel.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(panel.getByText("Sign in to AQUA to earn new Ripple rewards.")).toHaveCount(0);expect(signatures).toBe(1);
  await expect(page.getByRole("navigation",{name:"Portfolio sections"}).getByRole("button",{name:"Ripple",exact:true}).locator("span")).toHaveCount(0);
  await expect(panel.getByRole("button",{name:"Check confirmation",exact:true})).toBeVisible();
});

test("a completed zero-reward post remains visible and a delayed scan preserves earned rewards",async({page})=>{
  await setup(page);
  await page.route("**/api/ripple/*/activity",r=>r.fulfill({json:{enabled:true,signedIn:true,status:"paused",checkedAt:Date.now(),posts:[
    {id:"900",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,text:"Still supporting $OCEAN",createdAt:Date.now()-36000000,metrics:{like_count:0,impression_count:20},amountLamports:"0",checksCompleted:4,totalChecks:4,nextCheckAt:null,trackingStatus:"completed",status:"completed",reason:null}
  ]}}));
  await page.goto("/#/portfolio?tab=ripple");const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByText("Still supporting $OCEAN")).toBeVisible();
  await expect(panel.getByText("0 SOL",{exact:true})).toBeVisible();
  await expect(panel.getByText(/Checks complete|Check 4 of 4|Post updates are delayed/)).toHaveCount(0);
  await expect(panel.getByRole("button",{name:"Claim",exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test("Ripple keeps posts visible without tracking details",async({page})=>{
  await setup(page,false,true,'paused');await page.goto('/#/portfolio?tab=ripple');
  const panel=page.getByRole('region',{name:'Ripple Rewards',exact:true});
  await expect(panel.getByText('Tracking paused',{exact:true})).toHaveCount(0);
  await expect(panel.getByText('Daily X tracking limit reached. Tracking resumes after midnight UTC.')).toHaveCount(0);
  await expect(panel.getByText('0.025 SOL',{exact:true})).toBeVisible();
});

test("Ripple enables Claim only when a reward can be claimed",async({page})=>{
  await setup(page);
  await page.route("**/api/ripple/*/rewards",r=>r.fulfill({json:{markets:[{
    launchId:"coin",canClaim:true,claimMode:"cumulative",claimableEpochIds:[],
    grossRedeemableUsdCents:250,accumulatingUsdCents:0,pendingUsdCents:0,
    netClaimableUsdCents:245,claimableUsdCents:250,minimumClaimUsdCents:100
  }]}}));
  await page.goto("/#/portfolio?tab=ripple");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("button",{name:"Claim",exact:true})).toBeEnabled();
  await expect(panel.locator(".reward-claim-list")).toHaveCount(0);
});
