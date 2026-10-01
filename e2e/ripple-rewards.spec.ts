import { test, expect, type Page } from "@playwright/test";
const address="11111111111111111111111111111111";
const signature="ripple-confirmed-receipt";
async function setup(page:Page,pending=false,linked=true,tracking="live",admin=false,likesAuthorized?:boolean,injected=true) {
  await page.addInitScript(({address,signature,pending,admin,injected})=>{
    sessionStorage.setItem("aqua:x-prompt:"+address,"1");localStorage.setItem("aqua:update:holder-workspace-v2","seen");if(injected)localStorage.setItem("aqua:wallet","phantom");
    if(admin)sessionStorage.setItem("aqua-admin-session-v2:11111111111111111111111111111111","verified-admin");
    if(pending)localStorage.setItem("aqua:pending-reward:mainnet-beta:"+address+":ripple",JSON.stringify({wallet:address,launchId:"coin",name:"Ripple",signature,epochId:"epoch-ripple",amountUsd:250}));
    if(injected)Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signMessage:async()=>({signature:new Uint8Array(64)}),signAndSendTransaction(){throw Error("A pending receipt must not be resubmitted");}}}});
  },{address,signature,pending,admin,injected});
  await page.route("**/api/**",r=>{
    const path=new URL(r.request().url()).pathname;
    let json:unknown={};
    if(path==="/api/config")json={adminWallet:admin?address:undefined,brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false},rippleRewards:{enabled:true,rewardBps:1500,boostBps:1000}};
    else if(path.endsWith("/holdings"))json={holdings:[]};
    else if(path.endsWith("/claim-history"))json={claims:[],lifetime:[],hasMore:false};
    else if(path.includes("/notifications/"))json={notifications:[]};
    else if(path==="/api/rewards/"+address||path.endsWith("/rewards"))json={rewards:[],cumulativeRewards:[],holdings:[],markets:[]};
    else if(path.endsWith("/activity"))json={enabled:true,signedIn:true,holdersOnly:true,status:"tracking",reason:null,checkedAt:Date.now(),poolLamports:"100000000",rewardBps:1500,boostBps:1000,service:{mode:tracking,message:tracking==="paused"?"Daily X tracking limit reached. Tracking resumes after midnight UTC.":null,lastEventAt:Date.now(),settlementMinutes:15},nextPayoutAt:Date.now()+900000,measurementHours:8,checkHours:[1,2,4,8],settlementHours:1,totalPosts:142,posts:[{id:"123",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:true,createdAt:Date.now()-86400000,text:"Come swim with $OCEAN",checksCompleted:2,totalChecks:4,nextCheckAt:Date.now()+3600000,trackingStatus:"tracking",score:1234,metrics:{like_count:20,impression_count:1500},amountLamports:"25000000",earnedUsdCents:"250",status:"claimable",reason:null},{id:"124",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,createdAt:Date.now(),text:"A new $OCEAN post",checksCompleted:0,totalChecks:32,nextCheckAt:Date.now()+3600000,trackingStatus:"tracking",score:0,metrics:{like_count:2,impression_count:100},amountLamports:"0",status:"measuring",reason:null},{id:"125",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,createdAt:Date.now()-172800000,text:"The biggest $OCEAN reward",metrics:{like_count:99},amountLamports:"1000000000",earnedUsdCents:"10000",status:"claimable",reason:null}]};
    else if(path==="/api/market-prices/stream")return r.fulfill({contentType:"text/event-stream",body:'data: {"prices":[]}\n\n'});
    else if(path==="/api/market-prices")json={prices:[]};
    else if(path==="/api/launches")json={launches:[],hasMore:false,nextOffset:0};
    else if(path.includes("governance"))json={enabled:false};
    return r.fulfill({json});
  });
  await page.route("**/account/x/config",r=>r.fulfill({json:{enabled:true}}));
  await page.route("**/v1/wallets/x?*",r=>r.fulfill({json:{profiles:linked?{[address]:{id:"10",username:"aqua_tester",name:"Tester",avatarUrl:null,profileUrl:"https://x.com/aqua_tester",connectedAt:1,updatedAt:1,rippleLikesAuthorized:likesAuthorized}}:{}}}));
  await page.route("https://rpc.invalid/**",r=>r.fulfill({json:{jsonrpc:"2.0",id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
}
async function prepareXReturn(page:Page) {
  await setup(page,false,true,"live",false,false);
  const config=page.waitForRequest("**/account/x/config");
  await page.goto("/#/portfolio?tab=ripple");
  const api=(await config).url().replace(/\/account\/x\/config$/,"");
  await expect(page.getByRole("region",{name:"X reconnection required"})).toBeVisible();
  const state="a".repeat(64),receipt="b".repeat(64),key="aqua:x-link:"+api;
  await page.evaluate(({key,state,address})=>{
    sessionStorage.setItem(key,JSON.stringify({state,wallet:address,returnTo:"#/portfolio?tab=ripple"}));
    localStorage.setItem("aqua:studio:"+address,JSON.stringify({token:"d".repeat(64),expiresAt:Date.now()+3600000}));
  },{key,state,address});
  return {state,receipt,key};
}
test("X reconnect completion renews permissions and returns directly to Ripple",async({page})=>{
  const pending=await prepareXReturn(page),requests:string[]=[];
  page.on("request",r=>{if(r.method()==="DELETE")requests.push(r.url());});
  await page.route("**/account/x/complete",r=>{
    expect(r.request().postDataJSON()).toEqual({state:pending.state,receipt:pending.receipt});
    expect(r.request().headers().authorization).toBe("Bearer "+"d".repeat(64));
    return r.fulfill({json:{profile:{id:"10",username:"aqua_tester",name:"Tester",avatarUrl:null,profileUrl:"https://x.com/aqua_tester",connectedAt:1,updatedAt:2,rippleLikesAuthorized:true}}});
  });
  await page.goto("/#/connect-x?state="+pending.state+"&receipt="+pending.receipt);
  await page.getByRole("button",{name:"Finish reconnecting X",exact:true}).click();
  await expect(page).toHaveURL(/#\/portfolio\?tab=ripple$/);
  await expect(page.getByRole("region",{name:"Ripple Rewards",exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"X reconnection required"})).toHaveCount(0);
  expect(await page.evaluate(key=>sessionStorage.getItem(key),pending.key)).toBeNull();
  expect(requests).toEqual([]);
});
for(const callbackError of [false,true])test(`X account mismatch offers a fresh sign-in from ${callbackError?"the callback":"an older completion receipt"}`,async({page},testInfo)=>{
  const pending=await prepareXReturn(page),mutations:string[]=[];
  const message="X returned @another_account, but this wallet is linked to @aqua_tester. Switch to @aqua_tester on X, then try signing in again.";
  page.on("request",r=>{if(r.url().includes("/account/x/")&&r.method()!=="GET")mutations.push(r.method()+" "+new URL(r.url()).pathname);});
  await page.route("**/account/x/complete",r=>r.fulfill({status:409,json:{error:message}}));
  const consent=new URL("/mock-x-consent",page.url()).toString(),state="c".repeat(64);
  await page.route(consent,r=>r.fulfill({contentType:"text/html",body:"<h1>Mock X consent</h1>"}));
  await page.route("**/account/x/connect",r=>r.fulfill({json:{state,url:consent}}));
  await page.goto("/#/connect-x?state="+pending.state+(callbackError?"&error="+encodeURIComponent(message):"&receipt="+pending.receipt));
  if(!callbackError)await page.getByRole("button",{name:"Finish reconnecting X",exact:true}).click();
  await expect(page.getByRole("alert")).toHaveText(message);
  await expect(page.getByRole("link",{name:"Open X to switch accounts"})).toHaveAttribute("href","https://x.com/");
  await expect(page.getByRole("button",{name:"Finish reconnecting X",exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  if(callbackError)await page.screenshot({path:testInfo.outputPath("compact-x-reconnect-recovery.png"),fullPage:true});
  await page.getByRole("button",{name:"Try X sign-in again",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Mock X consent"})).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)??"null"),pending.key)).toEqual({state,wallet:address,returnTo:"#/portfolio?tab=ripple"});
  expect(mutations).toEqual(callbackError?["POST /account/x/connect"]:["POST /account/x/complete","POST /account/x/connect"]);
});
test("Ripple has its own tab with separate claims, post rewards and no mobile overflow",async({page})=>{
  await setup(page);await page.goto("/#/portfolio");
  const nav=page.getByRole("tablist",{name:"Portfolio sections"});
  await expect(nav.getByRole("tab")).toHaveText(["Holdings0","Rewards","Ripple142","Activity","Created"]);
  await expect(page.getByRole("region",{name:"Ripple Rewards",exact:true})).toHaveCount(0);
  await nav.getByRole("tab",{name:/^Ripple\s*142$/}).click();
  await expect(page).toHaveURL(/tab=ripple/);
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("heading",{name:"Ripple Rewards",exact:true})).toBeVisible();
  await expect(panel.getByText("$2.50",{exact:true})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Claim",exact:true})).toBeDisabled();
  await expect(panel.getByText("No rewards to claim yet.", {exact:true})).toHaveCount(0);
  await expect(panel.getByText(/Live detection|Hourly rewards|15-minute rewards|Next round|Next check|Check \d of|Last checked|Scheduled detection/)).toHaveCount(0);
  await expect(panel.locator('.ripple-post-amount').getByText("$0.00",{exact:true})).toBeVisible();
  await expect(panel.getByText("A new $OCEAN post",{exact:true})).toBeVisible();
  await expect(panel.locator('.ripple-post-amount b')).toHaveText(['$100.00','$2.50','$0.00']);
  await expect(panel.locator('.ripple-post-metrics').nth(1)).toContainText('20 likes');
  await expect(panel.getByRole("link",{name:"Reply on X"})).toHaveAttribute("href","https://x.com/i/status/123");
  await expect(panel.getByText("From every reward mode")).toHaveCount(0);
  await expect(panel.getByText("Awaiting activation")).toHaveCount(0);
  await expect(panel.getByText("Your posts. Your rewards.")).toHaveCount(0);
  await page.reload();await expect(panel.getByText("$2.50",{exact:true})).toBeVisible();
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

test("Ripple requests renewed X permission without hiding saved rewards or starting authorization automatically",async({page},testInfo)=>{
  await setup(page,true,true,"live",false,false);
  let authorizations=0;
  await page.route("**/account/auth/challenge",r=>r.fulfill({json:{id:"00000000-0000-4000-8000-000000000001",message:"Sign in to AQUA"}}));
  await page.route("**/account/auth/session",r=>r.fulfill({json:{token:"a".repeat(64),expiresAt:Date.now()+86400000}}));
  await page.route("**/account/x/connect",r=>{authorizations++;return r.fulfill({status:503,json:{error:"X connection is temporarily unavailable."}});});
  await page.goto("/#/portfolio?tab=ripple");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  const reconnect=panel.getByRole("region",{name:"X reconnection required"});
  await expect(reconnect).toContainText("Your existing rewards are safe.");
  await expect(panel.getByRole("button",{name:"Check confirmation",exact:true})).toBeVisible();
  await expect(panel.getByText("$2.50",{exact:true})).toBeVisible();
  expect(authorizations).toBe(0);
  await page.screenshot({path:testInfo.outputPath("compact-ripple-reconnect.png"),fullPage:true});
  await reconnect.getByRole("button",{name:"Reconnect X",exact:true}).click();
  await expect(reconnect.getByRole("alert")).toHaveText("X connection is temporarily unavailable.");
  expect(authorizations).toBe(1);
  await expect(reconnect.getByRole("button",{name:"Reconnect X",exact:true})).toBeEnabled();
  await expect(panel.getByRole("button",{name:"Check confirmation",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test("authorized Ripple accounts get keyboard-accessible post help and sorting without a reconnect panel",async({page},testInfo)=>{
  await setup(page,false,true,"live",false,true);
  await page.goto("/#/portfolio?tab=ripple");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("heading",{name:"Your posts",exact:true})).toBeVisible();
  await expect(panel.getByRole("region",{name:"X reconnection required"})).toHaveCount(0);
  const help=panel.locator(".ripple-help");
  await help.locator("summary").focus();await page.keyboard.press("Enter");
  await expect(help).toHaveAttribute("open","");
  await expect(help.getByText("Hold the coin",{exact:true})).toBeVisible();
  await expect(help.getByRole("button",{name:"Refresh my posts",exact:true})).toBeVisible();
  await panel.getByRole("combobox",{name:"Sort posts"}).click();
  await page.getByRole("option",{name:"Most recent",exact:true}).click();
  await expect(panel.locator(".ripple-post-text").first()).toHaveText("A new $OCEAN post");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({path:testInfo.outputPath("compact-ripple-help.png"),fullPage:true});
  await help.locator("summary").focus();await page.keyboard.press("Enter");
  await expect(help).not.toHaveAttribute("open","");
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
  await expect(page.getByRole("tablist",{name:"Portfolio sections"}).getByRole("tab",{name:"Ripple",exact:true}).locator("span")).toHaveCount(0);
  await expect(panel.getByRole("button",{name:"Check confirmation",exact:true})).toBeVisible();
});

test("a completed zero-reward post remains visible and a delayed scan preserves earned rewards",async({page})=>{
  await setup(page);
  await page.route("**/api/ripple/*/activity",r=>r.fulfill({json:{enabled:true,signedIn:true,status:"paused",checkedAt:Date.now(),posts:[
    {id:"900",launchId:"coin",symbol:"OCEAN",wallet:address,isReply:false,text:"Still supporting $OCEAN",createdAt:Date.now()-36000000,metrics:{like_count:0,impression_count:20},amountLamports:"0",checksCompleted:4,totalChecks:4,nextCheckAt:null,trackingStatus:"completed",status:"completed",reason:null}
  ]}}));
  await page.goto("/#/portfolio?tab=ripple");const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByText("Still supporting $OCEAN")).toBeVisible();
  await expect(panel.locator('.ripple-post-amount').getByText("$0.00",{exact:true})).toBeVisible();
  await expect(panel.getByText(/Checks complete|Check 4 of 4|Post updates are delayed/)).toHaveCount(0);
  await expect(panel.getByRole("button",{name:"Claim",exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test("Ripple reports a detection outage while keeping posts and claims visible",async({page})=>{
  await setup(page,false,true,'paused');await page.goto('/#/portfolio?tab=ripple');
  const panel=page.getByRole('region',{name:'Ripple Rewards',exact:true});
  await expect(panel.getByText('Tracking paused',{exact:true})).toHaveCount(0);
  await expect(panel.getByText('Daily X tracking limit reached. Tracking resumes after midnight UTC.')).toHaveCount(0);
  await expect(panel.getByText('$2.50',{exact:true})).toBeVisible();
  await expect(panel.getByRole('status').filter({hasText:'Post detection is temporarily delayed.'})).toHaveText('Post detection is temporarily delayed. Your saved posts and rewards are still here.');
  await expect(panel.getByRole('button',{name:'Claim',exact:true})).toBeVisible();
});

test("Ripple enables Claim from the combined claim response and displays its total",async({page})=>{
  await setup(page);
  await page.route("**/api/ripple/*/rewards",r=>r.fulfill({json:{markets:[{
    launchId:"coin",canClaim:true,claimMode:"cumulative",claimableEpochIds:[],
    grossRedeemableUsdCents:636,accumulatingUsdCents:0,pendingUsdCents:0,
    netClaimableUsdCents:631,claimableUsdCents:636,minimumClaimUsdCents:500
  }],rippleClaim:{availableUsdCents:636,minimumUsdCents:500,canClaim:true}}}));
  await page.goto("/#/portfolio?tab=ripple");
  const panel=page.getByRole("region",{name:"Ripple Rewards",exact:true});
  await expect(panel.getByRole("button",{name:"Claim",exact:true})).toBeEnabled();
  await expect(panel.locator(".ripple-available")).toHaveText("Available to claim $6.36");
  await expect(panel.locator(".reward-claim-list")).toHaveCount(0);
});

test("admin Ripple lists every post with dollar earnings, pagination and server-side search",async({page})=>{
  await setup(page,false,true,"live",true);
  await page.route("**/api/admin/diagnostics?*",r=>r.fulfill({json:{generatedAt:Date.now(),proposals:[],diagnostics:[],launches:[],runtime:{available:false},conversions:[],settlements:[],rewardPurchases:[],rewardEpochs:[],counts:{},flags:{},alerts:{configured:true,valid:true}}}));
  const requests:Array<{search:string;offset:number}>=[];
  await page.route("**/api/admin/ripple?*",r=>{
    expect(r.request().headers().authorization).toBe("Bearer verified-admin");
    const q=new URL(r.request().url()).searchParams,search=q.get("search")??"",offset=Number(q.get("offset"));requests.push({search,offset});
    const posts=Array.from({length:26},(_,i)=>({id:String(100+i),launchId:"coin",symbol:"OCEAN",coinName:"Ocean",wallet:address,username:i===25?"another":"aqua_tester",text:i===25?"Last post":"Supporting $OCEAN "+i,createdAt:Date.now(),metrics:{like_count:5,impression_count:1000},amountLamports:i===25?"0":"1000000000",earnedUsdCents:i===25?"0":"10000",claimedUsdCents:"0",status:"tracking",reason:null})).filter(p=>!search||p.username.includes(search));
    return r.fulfill({json:{totalPosts:posts.length,earnedUsdCents:search?"0":"250000",claimedUsdCents:"0",unpricedPosts:0,offset,limit:25,hasMore:offset+25<posts.length,posts:posts.slice(offset,offset+25),service:{mode:'paused',message:'Daily X tracking limit reached.',budget:{requests:1000,requestLimit:1000,postReads:16,postReadLimit:1000,resetsAt:Date.now()+3600000,requestCounts:{search:750,lookup:100,stream_rules:100,stream_connect:50}}}}});
  });
  await page.goto("/#/portfolio");
  await expect(page.getByRole("heading",{name:"Your positions",exact:true})).toBeVisible();
  await page.evaluate(()=>sessionStorage.setItem("aqua-admin-session-v2:11111111111111111111111111111111","verified-admin"));
  await page.goto("/#/admin?section=ripple");
  await expect(page.getByRole("navigation",{name:"Admin sections"}).getByRole("button",{name:"Ripple rewards",exact:true})).toHaveAttribute("aria-current","page");
  const records=page.getByRole("region",{name:"Ripple post records"});
  const health=page.getByRole('region',{name:'Ripple detection health'});
  await expect(health).toContainText('1,000 / 1,000');
  await expect(health).toContainText('16 / 1,000');
  await expect(health).toContainText('Search 750 · Engagement 100 · Stream 150');
  await expect(records.locator("tbody tr")).toHaveCount(25);
  await expect(records.locator("tbody tr").first()).toContainText("$100.00");
  await expect(records.getByRole("link",{name:"@aqua_tester"}).first()).toHaveAttribute("href","https://x.com/i/status/100");
  await page.getByRole("button",{name:"Next Ripple posts"}).click();
  await expect(records.locator("tbody tr")).toHaveCount(1);await expect(records).toContainText("Last post");
  await expect(records).toContainText("$0.00");
  await page.getByRole("textbox",{name:"Search admin records"}).fill("another");
  await expect.poll(()=>requests.at(-1)).toEqual({search:"another",offset:0});
  await expect(page.getByRole("button",{name:"Next Ripple posts"})).toBeDisabled();
  await expect(page.locator(".ops-pager")).toContainText("1–1 of 1");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


test("admin inspects deferred Ripple engagement, audit flags and funding rounds",async({page},testInfo)=>{
  await setup(page,false,true,"live",true);
  await page.route("**/api/admin/diagnostics?*",r=>r.fulfill({json:{generatedAt:Date.now(),proposals:[],diagnostics:[],launches:[],runtime:{available:false},conversions:[],settlements:[],rewardPurchases:[],rewardEpochs:[],counts:{},flags:{},alerts:{configured:true,valid:true}}}));
  const now=Date.now(),statuses:string[]=[];
  const diagnostics={availableLamports:'1000000000',releaseLimitLamports:'250000000',budgetLamports:'25000000',allocatedLamports:'25000000',carryoverLamports:'975000000',weightedScore:'1000',consideredChecks:2,rewardedPosts:1,deferredChecks:1,expiredChecks:0,solPriceUsd:100};
  await page.route("**/api/admin/ripple?*",r=>{
    const status=new URL(r.request().url()).searchParams.get('status')??'all';statuses.push(status);
    return r.fulfill({json:{totalPosts:1,earnedUsdCents:'0',claimedUsdCents:'0',unpricedPosts:0,pendingChecks:1,auditChecks:1,offset:0,limit:25,hasMore:false,
      posts:[{id:'999',launchId:'coin',symbol:'AQUA',coinName:'Aqua',wallet:address,username:'aqua_tester',text:'Supporting $AQUA',createdAt:now-3600000,metrics:{like_count:10,impression_count:278},amountLamports:'0',earnedUsdCents:'0',claimedUsdCents:'0',status:'completed',rewardStatus:status==='audit'?'audit':'awaiting_funding',pendingChecks:1,auditChecks:1,checksCompleted:4,totalChecks:32,reason:null}],
      overview:{availableLamports:'975000000',totalMarkets:1,catchupHours:72,markets:[{launchId:'coin',symbol:'AQUA',availableLamports:'975000000',lastFundedAt:now,pendingChecks:1,auditChecks:1,oldestPendingAt:now-3600000,checkedAt:now,coveredUntil:now-30000,scanPending:false,scanError:null,unpublishedEpochs:0,payoutStatus:'waiting',payoutAttemptedAt:now,payoutSuccessAt:now-900000,payoutMessage:'Waiting for a fresh holder check.'}],rounds:[{launchId:'coin',symbol:'AQUA',endsAt:now,epochId:'epoch',epochStatus:'claimable',diagnostics}]}}});
  });
  await page.route('**/api/admin/ripple/coin/posts/999',r=>{
    expect(r.request().headers().authorization).toBe('Bearer verified-admin');
    return r.fulfill({json:{launchId:'coin',postId:'999',scoringVersion:3,nextCheckAt:null,trackingEndReason:'Tracking window ended',excludedReason:null,highWater:{like_count:10},catchupHours:72,
      checks:[{number:4,measuredAt:now-3600000,processedAt:null,metrics:{like_count:10,impression_count:278},delta:{like_count:10,impression_count:278},score:326,effectiveScore:316,expiresAt:now+3600000,pendingReason:'awaiting_funding',outcome:null,reason:null,auditCandidate:false,epochId:null,amountLamports:'0',earnedUsdCents:null},
        {number:1,measuredAt:now-7200000,processedAt:now-6000000,metrics:{like_count:1},delta:{like_count:1},score:110,effectiveScore:100,expiresAt:now+3600000,reason:null,auditCandidate:true,amountLamports:'0',earnedUsdCents:null}]}});
  });
  await page.goto('/#/portfolio');await expect(page.getByRole('heading',{name:'Your positions',exact:true})).toBeVisible();
  await page.goto('/#/admin?section=ripple');
  await expect(page.getByRole('region',{name:'Ripple post records'})).toContainText('Awaiting funding');
  await page.getByRole('combobox',{name:'Ripple status',exact:true}).click();await page.getByRole('option',{name:'Review historical $0',exact:true}).click();
  await expect.poll(()=>statuses.at(-1)).toBe('audit');
  await page.locator('.ops-ripple-funding>summary').click();
  await expect(page.getByRole('region',{name:'Ripple funding by coin'})).toContainText('Waiting for a fresh holder check.');
  await expect(page.getByRole('region',{name:'Ripple settlement rounds'})).toContainText('0.975 SOL');
  await page.screenshot({path:testInfo.outputPath('compact-ripple-admin.png'),fullPage:true});
  const inspect=page.getByRole('button',{name:'Inspect post 999'});await inspect.click();
  const dialog=page.getByRole('dialog',{name:'Post reward history'});
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('Awaiting funding');await expect(dialog).toContainText('Historical $0 · review');
  await expect(dialog).toContainText('72 hours per check');await expect(dialog).toContainText('316');
  expect(await dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({path:testInfo.outputPath('compact-ripple-history.png'),fullPage:true});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(inspect).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});


const mobileReturn={state:'f'.repeat(64),receipt:'e'.repeat(64)};
const mobileReturnPath='/#/connect-x?'+new URLSearchParams(mobileReturn);
async function mockMobileReturn(page:Page,owner=address){
  await page.route('**/account/x/return',r=>{
    expect(r.request().postDataJSON()).toEqual(mobileReturn);
    expect(r.request().headers().authorization).toBeUndefined();
    return r.fulfill({json:{wallet:owner,username:'mobile_user',expiresAt:Date.now()+600000}});
  });
  await page.route('**/account/auth/challenge',r=>r.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',message:'Sign in to AQUA'}}));
  await page.route('**/account/auth/session',r=>{
    expect(r.request().postDataJSON().wallet).toBe(address);
    expect(r.request().postDataJSON().signature).toBeTruthy();
    return r.fulfill({json:{token:'d'.repeat(64),expiresAt:Date.now()+3600000}});
  });
  let completions=0;
  await page.route('**/account/x/complete',r=>{
    expect(r.request().headers().authorization).toBe('Bearer '+'d'.repeat(64));
    expect(r.request().postDataJSON()).toEqual(mobileReturn);completions++;
    return r.fulfill({json:{profile:{id:'10',username:'mobile_user',name:'Mobile User',avatarUrl:null,profileUrl:'https://x.com/mobile_user',connectedAt:1,updatedAt:2,rippleLikesAuthorized:true}}});
  });
  return ()=>completions;
}
for(const blockedStorage of [false,true])test(`X return recovers without the original tab${blockedStorage?' even when session storage is blocked':''}`,async({page})=>{
  await setup(page,false,false);const completions=await mockMobileReturn(page);
  if(blockedStorage)await page.addInitScript(()=>{
    for(const method of ['getItem','setItem','removeItem'] as const){
      const original=Storage.prototype[method];
      Object.defineProperty(Storage.prototype,method,{value:function(key:string,...args:unknown[]){
        if(key.startsWith('aqua:x-link:'))throw new DOMException('Storage unavailable','SecurityError');
        return Reflect.apply(original,this,[key,...args]);
      }});
    }
  });
  await page.goto(mobileReturnPath);
  const panel=page.locator('.x-callback');
  await expect(panel).toContainText('@mobile_user');
  await expect(page).toHaveURL(/receipt=/);
  await expect(page.getByRole('button',{name:'Connect accounts',exact:true})).toHaveCount(0);
  expect(completions()).toBe(0);
  await panel.getByRole('button',{name:'Link X to this wallet',exact:true}).click();
  await expect(page).toHaveURL(/#\/portfolio\?tab=ripple$/);
  expect(completions()).toBe(1);
  await expect(page.getByRole('region',{name:'X reconnection required'})).toHaveCount(0);
});
test('mobile X return carries its receipt through Phantom and Solflare into a fresh wallet browser',async({page,browser,isMobile})=>{
  test.skip(!isMobile,'Wallet browser links are mobile-only.');
  await setup(page,false,false,'live',false,undefined,false);const initialCompletions=await mockMobileReturn(page);
  await page.goto(mobileReturnPath);
  await page.locator('.x-callback').getByRole('button',{name:'Connect wallet',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Connect your wallet'});await expect(modal).toBeVisible();
  const links=await Promise.all(['Phantom','Solflare'].map(name=>modal.locator('.wallet-list').getByRole('link',{name:new RegExp(name)}).getAttribute('href')));
  const returns=links.map(link=>new URL(decodeURIComponent(new URL(link!).pathname.split('/browse/')[1])));
  for(const returned of returns)expect(Object.fromEntries(new URLSearchParams(returned.hash.split('?')[1]))).toEqual(mobileReturn);
  expect(initialCompletions()).toBe(0);
  const fresh=await browser.newContext();
  try{
    const next=await fresh.newPage();await setup(next,false,false);const completions=await mockMobileReturn(next);
    await next.goto(returns[0].toString());
    await next.locator('.x-callback').getByRole('button',{name:'Link X to this wallet',exact:true}).click();
    await expect(next).toHaveURL(/#\/portfolio\?tab=ripple$/);expect(completions()).toBe(1);
  }finally{await fresh.close();}
});
test('recovering X in a different wallet does not allow linking',async({page})=>{
  await setup(page,false,false);const completions=await mockMobileReturn(page,'So11111111111111111111111111111111111111112');
  await page.goto(mobileReturnPath);const panel=page.locator('.x-callback');
  await expect(panel).toContainText('Your connected wallet is different.');
  await expect(panel.getByRole('button',{name:'Link X to this wallet',exact:true})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Connect wallet',exact:true})).toBeEnabled();expect(completions()).toBe(0);
});
test('an expired mobile X callback shows recovery instructions without linking',async({page})=>{
  await setup(page,false,false);const completions=await mockMobileReturn(page);
  await page.route('**/account/x/return',r=>r.fulfill({status:409,json:{error:'X sign-in expired or was cancelled. Open Ripple and connect X again.'}}));
  await page.goto(mobileReturnPath);const panel=page.locator('.x-callback');
  await expect(panel.getByRole('alert')).toContainText('X sign-in expired');
  await expect(panel.getByRole('link',{name:'Open Ripple'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Link X to this wallet',exact:true})).toHaveCount(0);
  expect(completions()).toBe(0);
});
test('a temporary mobile return error can retry without restarting X authorization',async({page})=>{
  await setup(page,false,false);const completions=await mockMobileReturn(page);let attempts=0;
  await page.route('**/account/x/return',r=>++attempts===1?r.fulfill({status:503,json:{error:'Connection temporarily unavailable.'}}):r.fallback());
  await page.goto(mobileReturnPath);const panel=page.locator('.x-callback');
  await expect(panel.getByRole('alert')).toHaveText('Connection temporarily unavailable.');
  await panel.getByRole('button',{name:'Retry connection check'}).click();
  await expect(panel.getByRole('button',{name:'Link X to this wallet',exact:true})).toBeEnabled();
  expect(attempts).toBe(2);expect(completions()).toBe(0);
});
