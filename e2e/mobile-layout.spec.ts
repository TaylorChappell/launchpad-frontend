import { test, expect, type Page } from "@playwright/test";

const mint = "11111111111111111111111111111111";
const launch = {
  id: "mobile", mint, creatorWallet: mint, name: "Ocean Club", symbol: "OCEAN",
  description: "A community building together.", xUrl: "https://x.com/aquafamily", websiteUrl: "https://ocean.example.org", telegramUrl: "https://t.me/ocean_club", marketPolicyAddress: mint, stockMint: mint, stockSymbol: "ORCA", stockName: "Orca",
  stock: { mint, symbol: "ORCA", name: "Orca", logoUrl: null },
  pairMint: mint, pairType: "stock", pairSymbol: "ORCA", rewardMode: "holder_rewards", status: "live",
  txCount: 0, marketCapUsd: 124000, tvlUsd: 21000, volume24hUsd: 54000, change24h: 12,
  holderCount: 320, aquaIndexed: true, totalSupplyRaw: "1000000000000000", tokenDecimals: 6,
  createdAt: Date.now(), devBuySol: 0, rewardAccumulatedUsd: 750, rewardRedeemableUsd: 420,
};

async function setup(page: Page, trading = false) {
  await page.addInitScript(() => localStorage.setItem("aqua:update:holder-workspace-v2", "seen"));
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path === "/api/config") json = { brand: "AQUA", network: "mainnet-beta", useTestnet: false,
      transactionsEnabled: trading, marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid",
      whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
      creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } };
    else if (path === "/api/launches/mobile") json = { launch, trades: [], creatorLock: null, rewardModeState: null };
    else if (path === "/api/launches" || path === "/api/search") json = { launches: [launch], hasMore: false, nextOffset: 1 };
    else if (path.endsWith("/market-data")) json = { snapshots: Array.from({length:12},(_,i)=>({sampledAt:Date.now()-(12-i)*60000,marketCapUsd:112000+i*1000,fdvUsd:112000+i*1000,priceUsd:.000112+i*.000001})) };
    else if (path.endsWith("/community")) json = { posts: [{ id: "post", kind: "message", launchId: "mobile", authorWallet: mint, createdAt: Date.now(), body: "Welcome to the Ocean community", reactions: [], reply: null }], pinned: null, latest: null, nextCursor: null };
    else if (path.endsWith("/holders")) json = { holders: [], hasMore: false, total: 0 };
    else if (path === "/api/stocks") json = { stocks: [{ mint, symbol: "ORCA", name: "Orca", decimals: 6 }] };
    else if (path.includes("governance")) json = { enabled: false };
    else if (path.includes("notifications")) json = { notifications: [] };
    else if (path === "/api/market-prices/stream") return route.fulfill({ contentType: "text/event-stream", body: 'data: {"prices":[]}\n\n' });
    else if (path === "/api/market-prices") json = { prices: [] };
    return route.fulfill({ json });
  });
  await page.route("**/account/**", route => route.fulfill({ json: { enabled: false, profiles: [] } }));
}

test("one market navigation keeps content clear at phone, tablet and desktop sizes", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "One explicit viewport sweep covers both layouts.");
  test.setTimeout(60_000);
  await setup(page);
  for (const width of [320, 390, 430, 820, 1100, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#/token/mobile?tab=community");
    await expect(page.locator(".community-scroll")).toContainText("Welcome to the Ocean community");
    const tabs=page.getByRole("tablist",{name:"Market navigation",exact:true});
    await expect(tabs).toHaveCount(1);
    await expect(tabs.locator(".market-tab-label")).toHaveText(["Transactions", "Community", "Proposals", "Rewards", "Holders"]);
    await expect(tabs.getByRole("tab",{name:"Community",exact:true})).toHaveCount(1);
    const boxes = await page.evaluate(() => {
      const box = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      return { chart: box("#market-chart"), trade: box("#market-trade"), tabs: box(".market-information-tabs"), community: box(".community"), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(boxes.community.top).toBeGreaterThanOrEqual(boxes.chart.bottom);
    expect(boxes.overflow, `no page overflow at ${width}px`).toBeLessThanOrEqual(2);
    if (width <= 1100) {
      await expect(page.locator("#market-trade .trade-card")).toHaveCount(0);
      await expect(page.getByRole("group", { name: "Trade this coin" }).getByRole("button", { name: "Buy", exact: true })).toBeVisible();
      expect(boxes.trade.top).toBeGreaterThanOrEqual(boxes.chart.bottom);
      expect(Math.abs(boxes.trade.right-boxes.chart.right)).toBeLessThanOrEqual(1);
      expect(boxes.community.top).toBeGreaterThanOrEqual(boxes.trade.bottom);
      const clearMenu=async(selector:string)=>page.evaluate(selector=>{
        const panel=document.querySelector(selector)!.getBoundingClientRect();
        const menu=document.querySelector(".market-information-tabs")!.getBoundingClientRect();
        return panel.top-menu.bottom;
      },selector);
      await tabs.getByRole("tab", { name: "Community", exact: true }).click();
      await expect(tabs.getByRole("tab", { name: "Community", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect.poll(()=>clearMenu(".community")).toBeGreaterThanOrEqual(8);
      await expect.poll(()=>clearMenu(".community")).toBeLessThan(35);
      if (width === 390) await page.screenshot({ path: info.outputPath("mobile-community.png") });
      if (width === 390) {
        await page.locator("#market-chart").scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("mobile-chart.png") });
        await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
        await page.screenshot({ path: info.outputPath("mobile-market-header.png") });
      }
    } else {
      await expect(page.locator("#market-trade .trade-card")).toBeVisible();
      await expect(page.locator(".market-trade-actions")).toHaveCount(0);
      expect(boxes.tabs.top).toBeGreaterThanOrEqual(boxes.chart.bottom);
      expect(boxes.trade.left).toBeGreaterThanOrEqual(boxes.chart.right);
      await expect(tabs.getByRole("button", { name: "Chart", exact: true })).toHaveCount(0);
    }
  }
});

test("phone market navigation scrolls smoothly and keeps later tabs reachable",async({page},info)=>{
  test.skip(info.project.name!=="mobile","Phone section navigation.");
  await setup(page);
  await page.goto("/#/token/mobile?tab=transactions");
  const tabs=page.getByRole("tablist",{name:"Market navigation",exact:true});
  await expect(tabs).toBeVisible();
  await tabs.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
    const positions:number[]=[];
    Object.assign(window,{marketScrollPositions:positions});
    window.addEventListener("scroll",()=>positions.push(window.scrollY));
  });
  await tabs.getByRole("tab",{name:"Community",exact:true}).click();
  await expect.poll(()=>page.locator(".community").evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeLessThan(170);
  await expect.poll(()=>page.evaluate(()=>new Set((window as unknown as {marketScrollPositions:number[]}).marketScrollPositions.map(Math.round)).size)).toBeGreaterThan(2);
  await tabs.getByRole("tab",{name:"Holders",exact:true}).click();
  await expect(page.locator(".holder-activity")).toContainText("320 wallets");
  await expect(tabs.getByRole("tab",{name:"Holders",exact:true})).toBeInViewport();
  await page.emulateMedia({reducedMotion:"reduce"});
  await tabs.getByRole("tab",{name:"Transactions",exact:true}).click();
  await tabs.getByRole("tab",{name:"Community",exact:true}).click();
  await expect(tabs.getByRole("tab",{name:"Community",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect.poll(()=>page.locator(".community").evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeLessThan(170);
  await expect(page.locator(".community")).toBeInViewport();
  for (const tab of ["governance", "proposals"]) {
    await page.goto(`/#/token/mobile?tab=${tab}`);
    await expect(tabs.getByRole("tab",{name:"Proposals",exact:true})).toHaveAttribute("aria-pressed","true");
    await expect(tabs.getByRole("tab",{name:"Proposals",exact:true})).toBeInViewport();
    await expect(page.locator(".community-proposals")).toContainText("Proposals are unavailable for this market.");
    await expect(page.getByRole("dialog",{name:"Market details",exact:true})).toHaveCount(0);
  }
  await page.screenshot({path:"/tmp/aqua-market-proposals-mobile.png",animations:"disabled"});
});

test("phone navigation locks the page, closes with Escape and opens destinations at the top", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Phone navigation.");
  await setup(page);
  await page.goto("/#/token/mobile?tab=community");
  const more = page.getByRole("button", { name: "More navigation", exact: true });
  await more.click();
  const dialog = page.getByRole("dialog", { name: "Navigate AQUA" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await more.click();
  await dialog.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(page).toHaveURL(/portfolio/);
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".bottom-nav").getByRole("link", { name: "Portfolio" })).toHaveAttribute("aria-current", "page");
  await more.click();
  await page.screenshot({ path: info.outputPath("mobile-navigation.png") });
  await dialog.getByRole("button", { name: /Search coins/ }).click();
  await expect(page.getByRole("dialog", { name: "Search AQUA", exact: true })).toBeVisible();
  await page.screenshot({path:info.outputPath("compact-search.png")});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test("discovery controls and phone navigation are touch sized on a small screen", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Phone discovery.");
  await setup(page);
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto("/#/");
  await expect(page.locator(".token-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Pair", exact: true })).toBeVisible();
  const controls = await page.locator(".bottom-nav a, .bottom-nav button, .discovery-tabs button, .discovery-tools button").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
  expect(controls.every(height => height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.getByRole("textbox",{name:"Minimum liquidity"}).focus();
  await expect(page.getByRole("textbox",{name:"Minimum liquidity"})).toBeFocused();
  await page.getByRole("button",{name:"Close filters"}).click();
  await expect(page.getByRole("button",{name:"Filters",exact:true})).toBeFocused();
  await page.screenshot({ path: info.outputPath("mobile-explore.png"), fullPage: true });
  await page.getByRole("button", { name: "Table view", exact: true }).click();
  await expect(page.locator(".market-table")).toBeVisible();
  expect(await page.evaluate(() => innerWidth)).toBe(320);
  expect(await page.evaluate(() => innerHeight)).toBe(667);
  await page.locator(".market-table .market-identity").click();
  await expect(page).toHaveURL(/token\/mobile/);
});

test("connected wallet controls and menus fit a narrow phone with X linking enabled", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Phone wallet header.");
  await setup(page);
  await page.addInitScript(address => {
    localStorage.setItem("aqua:wallet", "phantom");
    sessionStorage.setItem(`aqua:x-prompt:${address}`, "1");
    Object.assign(window, { phantom: { solana: { isPhantom: true,
      connect: async () => ({ publicKey: { toString: () => address } }), on() {}, removeListener() {},
    } } });
  }, mint);
  await page.route("**/account/x/config", route => route.fulfill({ json: { enabled: true } }));
  await page.route("**/v1/wallets/x?*", route => route.fulfill({ json: { profiles: [] } }));
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto("/#/token/mobile?tab=community");
  await expect(page.getByRole("button", { name: "Connect accounts", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.locator(".wallet-menu-trigger").click();
  const dropdown = await page.locator(".wallet-dropdown").boundingBox();
  expect(dropdown!.x).toBeGreaterThanOrEqual(0);
  expect(dropdown!.x + dropdown!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(page.locator(".wallet-dropdown")).toHaveCount(0);
  await expect(page.locator(".wallet-menu-trigger")).toBeFocused();
});

test("mobile Buy and Sell open the matching trade sheet and stack with the wallet picker", async ({page},info)=>{
  test.skip(info.project.name!=="mobile","Mobile trade sheet.");
  await setup(page);
  await page.goto("/#/token/mobile?tab=transactions");
  const actions=page.getByRole("group",{name:"Trade this coin"});
  await actions.getByRole("button",{name:"Buy",exact:true}).click();
  const sheet=page.getByRole("dialog",{name:"Trade OCEAN",exact:true});
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button",{name:"Buy",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(sheet.getByRole("button",{name:"Sell",exact:true})).toHaveAttribute("aria-pressed","false");
  const scroll=await page.evaluate(()=>scrollY);
  await page.mouse.wheel(0,500);
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);
  await sheet.getByRole("button",{name:"Connect wallet",exact:true}).click();
  const picker=page.getByRole("dialog",{name:"Connect your wallet",exact:true});
  await expect(picker).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(await picker.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button",{name:"Connect wallet",exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(actions.getByRole("button",{name:"Buy",exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).not.toBe("hidden");
  await actions.getByRole("button",{name:"Sell",exact:true}).click();
  await expect(sheet.getByRole("button",{name:"Sell",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(sheet.locator(".trade-input b")).toHaveText("OCEAN");
  await expect(sheet.locator(".trade-receive b")).toHaveText("SOL");
  await page.screenshot({path:info.outputPath("mobile-sell-sheet.png")});
  await sheet.getByRole("button",{name:"Close trade",exact:true}).click();
  await page.setViewportSize({width:320,height:568});
  await actions.getByRole("button",{name:"Buy",exact:true}).click();
  await expect(sheet.getByRole("button",{name:"Buy",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(sheet.getByRole("button",{name:"Close trade",exact:true})).toBeInViewport();
  expect(await sheet.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
  await sheet.getByRole("button",{name:"Connect wallet",exact:true}).scrollIntoViewIfNeeded();
  await expect(sheet.getByRole("button",{name:"Connect wallet",exact:true})).toBeInViewport();
  await page.setViewportSize({width:1440,height:900});
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button",{name:"Close trade",exact:true}).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator("#market-trade .trade-card")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).not.toBe("hidden");
});

test("mobile trade sheet requests the chosen side and clears the previous amount on reopen",async({page},info)=>{
  test.skip(info.project.name!=="mobile","Mobile trade direction.");
  await setup(page,true);
  await page.addInitScript(address=>{
    localStorage.setItem("aqua:wallet","phantom");
    Object.assign(window,{phantom:{solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){}}}});
  },mint);
  await page.route('https://rpc.invalid/**',route=>{
    const request=route.request().postDataJSON();
    const value=request.method==='getBalance'?1000000000:[{pubkey:mint,account:{lamports:1,owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',executable:false,rentEpoch:0,data:{program:'spl-token',parsed:{info:{tokenAmount:{amount:'8000000',decimals:6,uiAmount:8}}},space:165}}}];
    return route.fulfill({json:{jsonrpc:'2.0',id:request.id,result:{context:{slot:1},value}}});
  });
  const quotes:Array<{side:string|null;amount:string|null}>=[];
  await page.route("**/api/launches/mobile/quote?*",route=>{
    const query=new URL(route.request().url()).searchParams;
    quotes.push({side:query.get("side"),amount:query.get("amountRaw")});
    if(query.get("side")==="sell"){expect(query.get("sellCurrency")).toBe("SOL");expect(query.get("slippageBps")).toBe("1500");}
    return route.fulfill({json:{route:"orca",outputMint:"So11111111111111111111111111111111111111112",quote:{tokenEstOut:"10000000",tokenMinOut:"9000000"}}});
  });
  await page.goto("/#/token/mobile?tab=transactions");
  const actions=page.getByRole("group",{name:"Trade this coin"});
  const sheet=page.getByRole("dialog",{name:"Trade OCEAN",exact:true});
  await actions.getByRole("button",{name:"Buy",exact:true}).click();
  await sheet.getByRole("textbox",{name:"You pay",exact:true}).fill("1");
  await expect.poll(()=>quotes.at(-1)).toEqual({side:"buy",amount:"1000000"});
  await expect(sheet.locator(".trade-receive strong")).toHaveText("10");
  await sheet.getByRole("button",{name:"Close trade",exact:true}).click();
  await actions.getByRole("button",{name:"Sell",exact:true}).click();
  await expect(sheet.getByRole("textbox",{name:"You pay",exact:true})).toHaveValue("");
  await sheet.getByRole("button",{name:"25%",exact:true}).click();
  await expect(sheet.getByRole("textbox",{name:"You pay",exact:true})).toHaveValue("2");
  await expect.poll(()=>quotes.at(-1)).toEqual({side:"sell",amount:"2000000"});
  await expect(sheet.locator(".trade-receive b")).toHaveText("SOL");
  await expect(sheet.locator('.trade-detail-row')).toContainText('8 OCEAN');
  const [presets,available]=await sheet.evaluate(el=>['.trade-presets','.trade-detail-row'].map(selector=>{
    const {top,bottom}=el.querySelector(selector)!.getBoundingClientRect();return {top,bottom};
  }));
  expect(available.top).toBeGreaterThanOrEqual(presets.bottom);
  await sheet.screenshot({path:info.outputPath('compact-sell-available.png')});
});

test("a pending mobile trade stays mounted through dismiss attempts and a resize",async({page},info)=>{
  test.skip(info.project.name!=="mobile","Pending mobile trade.");
  await setup(page,true);
  await page.addInitScript(address=>{
    localStorage.setItem("aqua:wallet","phantom");
    Object.assign(window,{phantom:{solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){}}}});
  },mint);
  await page.route("**/api/launches/mobile/quote?*",route=>route.fulfill({json:{route:"orca",quote:{tokenEstOut:"10000000",tokenMinOut:"9000000"}}}));
  let requested=false;
  let release!:()=>void;
  const transaction=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/launches/mobile/trade-transaction",async route=>{
    requested=true;await transaction;
    await route.fulfill({status:503,json:{error:"Test trade unavailable"}});
  });
  await page.goto("/#/token/mobile?tab=transactions");
  await expect(page.locator(".wallet-button.connected")).toBeVisible();
  await page.getByRole("group",{name:"Trade this coin"}).getByRole("button",{name:"Buy",exact:true}).click();
  const sheet=page.getByRole("dialog",{name:"Trade OCEAN",exact:true});
  await sheet.getByRole("textbox",{name:"You pay",exact:true}).fill("1");
  await sheet.getByRole("button",{name:"Buy OCEAN",exact:true}).click();
  await expect.poll(()=>requested).toBe(true);
  await expect(sheet.getByRole("button",{name:"Close trade",exact:true})).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  await page.setViewportSize({width:1440,height:900});
  await expect(sheet.getByRole("button",{name:"Waiting for confirmation"})).toBeVisible();
  release();
  await expect(sheet.getByRole("status").filter({hasText:"Test trade unavailable"})).toContainText("Test trade unavailable");
  await expect(sheet.getByRole("button",{name:"Close trade",exact:true})).toBeEnabled();
  await sheet.getByRole("button",{name:"Close trade",exact:true}).click();
  await expect(page.locator("#market-trade .trade-card")).toBeVisible();
});


test("More details sits below trading and preserves the page when dismissed", async ({page},info)=>{
  await setup(page);
  await page.goto("/#/token/mobile?tab=transactions");
  const more=page.getByRole("button",{name:"More details",exact:true});
  await expect(more).toBeVisible();
  const selector=info.project.name==="mobile"?".market-trade-actions":".trade-card";
  const positions=await page.evaluate(selector=>[selector,".market-more-details"].map(s=>{const r=document.querySelector(s)!.getBoundingClientRect();return{top:r.top,bottom:r.bottom};}),selector);
  expect(positions[1].top).toBeGreaterThanOrEqual(positions[0].bottom);
  expect(positions[1].top-positions[0].bottom).toBeLessThan(24);
  await more.click();
  const sheet=page.getByRole("dialog",{name:"Market details",exact:true});
  await expect(sheet.getByText("A community building together.", {exact:true})).toBeVisible();
  await expect(sheet.getByText("OCEAN / ORCA", {exact:true})).toBeVisible();
  expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const scroll=await page.evaluate(()=>scrollY);
  await sheet.getByRole("button",{name:"Copy token mint"}).scrollIntoViewIfNeeded();
  await expect(sheet.getByRole("button",{name:"Close details"})).toBeInViewport();
  await expect(sheet.locator(".market-chain-details")).not.toHaveAttribute("open", "");
  await sheet.getByText("On-chain details",{exact:true}).click();
  await expect(sheet.getByRole("link",{name:"Inspect mint"})).toHaveAttribute("href",`https://solscan.io/account/${mint}`);
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).not.toBe("hidden");
  await more.click();
  await page.screenshot({path:info.outputPath("compact-market-details.png"),animations:"disabled"});
  await sheet.getByRole("button",{name:"Close details"}).click();
  if(info.project.name==="mobile"){
    await page.setViewportSize({width:320,height:568});
    await more.click();
    expect(await sheet.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
    await sheet.getByText("On-chain details",{exact:true}).click();
    await sheet.getByRole("link",{name:"Pool explorer"}).scrollIntoViewIfNeeded();
    await expect(sheet.getByRole("link",{name:"Pool explorer"})).toBeInViewport();
    await sheet.getByRole("button",{name:"Close details"}).click();
  }
  await page.goto("/#/token/mobile?tab=project");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button",{name:"Close details"}).click();
  await expect(page).toHaveURL(/tab=transactions/);
  await expect(page.getByRole("tablist",{name:"Market navigation"}).getByRole("tab",{name:"Transactions",exact:true})).toHaveAttribute("aria-pressed","true");
});

test("market header keeps social icons and launch age together", async ({page},info)=>{
 await setup(page);await page.goto('/#/token/mobile');await expect(page.locator('.market-identity-heading')).toContainText('Ocean Club');
 await expect(page.locator('.market-identity-heading .market-launch-age')).toBeVisible();
 await expect(page.locator('.token-hero').getByRole('link',{name:/Explorer|Mode policy/})).toHaveCount(0);
 if(info.project.name==='desktop') {
  await expect(page.getByRole('link',{name:'Visit on X',exact:true}).locator('svg')).toBeVisible();
  await expect(page.locator('.token-identity footer').getByRole('button',{name:'Share market',exact:true}).locator('svg')).toBeVisible();
 }
 await page.locator('.token-hero').screenshot({path:'/tmp/aqua-market-header-'+info.project.name+'.png'});
});


test("Coin settings opens below More details and displays the coin's configured fees",async({page})=>{
  await setup(page);
  await page.route("**/api/launches/mobile",route=>route.fulfill({json:{launch:{...launch,transferFeeBps:500,rewardFeeBps:400,rippleRewardBps:300,orcaFeeRate:10000,marketingMode:"off",dexFundingMode:"proposal"},trades:[],creatorLock:null,rewardModeState:null}}));
  await page.goto("/#/token/mobile?tab=community");
  const button=page.getByRole("button",{name:"Coin settings",exact:true});
  await expect(button).toBeVisible();
  const boxes=await page.evaluate(()=>[".market-more-details:not(.market-coin-settings)",".market-coin-settings"].map(s=>{const r=document.querySelector(s)!.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));
  expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
  await button.click();const dialog=page.getByRole("dialog",{name:"Coin settings",exact:true});
  await expect(dialog.locator('.coin-fee-breakdown dt')).toHaveText(['Rewards fee','Platform fee','Orca fee']);
  await expect(dialog.locator('.coin-fee-breakdown dd')).toHaveText(['4%','1%','1%']);
  await expect(dialog.getByText(/Community Boost|Combined fee rates|Token fee/)).toHaveCount(0);
  await expect(dialog.getByText('3% of trading rewards',{exact:true})).toBeVisible();
  await expect(dialog.getByText('Off',{exact:true})).toBeVisible();
  await expect(dialog.getByText('Proposal only',{exact:true})).toBeVisible();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();
  await expect(page).toHaveURL(/tab=community/);
});

test('restored market cards and filter dialog fit both layouts and keep draft changes separate',async({page},info)=>{
 await setup(page);await page.goto('/#/');
 const card=page.locator('.token-card').first();await expect(card).toBeVisible();
 await expect(card.locator('.reward-card-focus')).toBeVisible();
 await expect(card.locator('.market-social-links a')).toHaveCount(3);
 await expect(card.getByRole('link',{name:'Ocean Club on Telegram',exact:true})).toHaveAttribute('href','https://t.me/ocean_club');
 await expect(card.getByRole('link',{name:'Ocean Club website',exact:true})).toHaveAttribute('href','https://ocean.example.org/');
 await expect(card.getByRole('button',{name:'Share market',exact:true})).toHaveCount(0);
 await expect(card.locator('.token-pair .asset-mark')).toHaveCSS('border-radius','50%');
 await page.context().route('https://x.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Ocean on X</title>'}));
 const popupPromise=page.waitForEvent('popup');
 await card.getByRole('link',{name:'Ocean Club on X',exact:true}).click();
 const popup=await popupPromise;await expect(popup).toHaveURL('https://x.com/aquafamily');await popup.close();
 await expect(page).not.toHaveURL(/token\/mobile/);
 await expect(card.locator('.card-cap')).toContainText('Market cap');
 await expect(card.locator('.token-stats .metric small')).toHaveText(['24h volume','Holders']);
 // Measure actual content so clipping cannot hide a layout failure.
 await expect(card).toHaveCSS('overflow-x','hidden');
 const content=card.locator('.token-card-link');
 expect(await content.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 const bounds=await card.boundingBox();
 expect(bounds!.x).toBeGreaterThanOrEqual(0);
 expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('textbox',{name:'Search all markets'})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('compact-explore.png'),fullPage:true});
 const opener=page.getByRole('button',{name:'Filters',exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Filter markets'});await expect(dialog).toBeVisible();
 await dialog.getByRole('combobox',{name:'Pair',exact:true}).click();
 await page.getByRole('option',{name:'ORCA',exact:true}).click();
 await expect(dialog.getByRole('combobox',{name:'Pair',exact:true})).toHaveText('ORCA');
 await expect(page).not.toHaveURL(/pair=ORCA/);
 await dialog.getByRole('textbox',{name:'Minimum market cap',exact:true}).fill('1000');
 await dialog.getByRole('button',{name:'Paid',exact:true}).click();
 await page.screenshot({path:info.outputPath('compact-filters.png')});
 await dialog.getByRole('combobox',{name:'Rewards',exact:true}).focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');
 await expect(dialog.getByRole('combobox',{name:'Rewards',exact:true})).toHaveText('Fee Redirect');
 await dialog.getByRole('button',{name:'Apply filters'}).click();
 await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();await expect(page).toHaveURL(/minCap=1000/);await expect(page).toHaveURL(/mode=fee_redirect/);
 await opener.click();await dialog.getByRole('button',{name:'Reset',exact:true}).click();await dialog.getByRole('button',{name:'Close filters'}).click();await expect(page).toHaveURL(/minCap=1000/);
 await page.goto('/#/portfolio');await expect(page.getByRole('heading',{name:'Your portfolio'})).toBeVisible();await expect(page.getByRole('tablist')).toHaveCount(0);
 await expect(page.locator('.portfolio-welcome')).toHaveCSS('display','block');
 await page.screenshot({path:info.outputPath('compact-portfolio.png'),fullPage:true});
 await page.goto('/#/studio');await expect(page.getByRole('heading',{name:'Open Atlantis Studio',exact:true})).toBeVisible();await expect(page.locator('.at-example-site')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('compact-atlantis.png'),fullPage:true});
});
