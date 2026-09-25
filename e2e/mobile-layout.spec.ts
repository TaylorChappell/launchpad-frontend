import { test, expect, type Page } from "@playwright/test";

const mint = "11111111111111111111111111111111";
const launch = {
  id: "mobile", mint, creatorWallet: mint, name: "Ocean Club", symbol: "OCEAN",
  description: "A community building together.", stockMint: mint, stockSymbol: "ORCA", stockName: "Orca",
  stock: { mint, symbol: "ORCA", name: "Orca", logoUrl: null },
  pairMint: mint, pairType: "stock", pairSymbol: "ORCA", rewardMode: "holder_rewards", status: "live",
  txCount: 0, marketCapUsd: 124000, tvlUsd: 21000, volume24hUsd: 54000, change24h: 12,
  holderCount: 320, aquaIndexed: true, totalSupplyRaw: "1000000000000000", tokenDecimals: 6,
  createdAt: Date.now(), devBuySol: 0, rewardAccumulatedUsd: 750, rewardRedeemableUsd: 420,
};

async function setup(page: Page) {
  await page.addInitScript(() => localStorage.setItem("aqua:update:holder-workspace-v2", "seen"));
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path === "/api/config") json = { brand: "AQUA", network: "mainnet-beta", useTestnet: false,
      transactionsEnabled: false, marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid",
      whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
      creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } };
    else if (path === "/api/launches/mobile") json = { launch, trades: [], creatorLock: null, rewardModeState: null };
    else if (path === "/api/launches" || path === "/api/search") json = { launches: [launch], hasMore: false, nextOffset: 1 };
    else if (path.endsWith("/market-data")) json = { snapshots: Array.from({length:12},(_,i)=>({sampledAt:Date.now()-(12-i)*60000,marketCapUsd:112000+i*1000,fdvUsd:112000+i*1000,priceUsd:.000112+i*.000001})) };
    else if (path.endsWith("/community")) json = { posts: [{ id: "post", kind: "message", launchId: "mobile", authorWallet: mint, createdAt: Date.now(), body: "Welcome to the Ocean community", reactions: [], reply: null }], pinned: null, latest: null, nextCursor: null };
    else if (path.endsWith("/holders")) json = { holders: [], hasMore: false, total: 0 };
    else if (path === "/api/stocks") json = { stocks: [] };
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
    const tabs=page.getByRole("navigation",{name:"Market navigation",exact:true});
    await expect(tabs).toHaveCount(1);
    await expect(tabs.getByRole("button",{name:"Community",exact:true})).toHaveCount(1);
    const boxes = await page.evaluate(() => {
      const box = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      return { chart: box("#market-chart"), trade: box("#market-trade"), tabs: box(".market-information-tabs"), community: box(".community"), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(boxes.community.top).toBeGreaterThanOrEqual(boxes.chart.bottom);
    expect(boxes.overflow, `no page overflow at ${width}px`).toBeLessThanOrEqual(2);
    if (width <= 1100) {
      expect(boxes.trade.top).toBeGreaterThanOrEqual(boxes.chart.bottom);
      expect(Math.abs(boxes.trade.right-boxes.chart.right)).toBeLessThanOrEqual(1);
      expect(boxes.community.top).toBeGreaterThanOrEqual(boxes.trade.bottom);
      const clearMenu=async(selector:string)=>page.evaluate(selector=>{
        const panel=document.querySelector(selector)!.getBoundingClientRect();
        const menu=document.querySelector(".market-information-tabs")!.getBoundingClientRect();
        return panel.top-menu.bottom;
      },selector);
      await tabs.getByRole("button", { name: "Trade", exact: true }).click();
      await expect.poll(()=>clearMenu("#market-trade")).toBeGreaterThanOrEqual(8);
      await expect.poll(()=>clearMenu("#market-trade")).toBeLessThan(35);
      const menuTop=(await tabs.boundingBox())!.y;
      expect(menuTop).toBeGreaterThanOrEqual(64);
      expect(menuTop).toBeLessThan(120);
      await expect(tabs.getByRole("button", { name: "Trade", exact: true })).toHaveAttribute("aria-pressed", "true");
      await tabs.getByRole("button", { name: "Community", exact: true }).click();
      await expect(tabs.getByRole("button", { name: "Community", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect.poll(()=>clearMenu(".community")).toBeGreaterThanOrEqual(8);
      await expect.poll(()=>clearMenu(".community")).toBeLessThan(35);
      if (width === 390) await page.screenshot({ path: info.outputPath("mobile-community.png") });
      await tabs.getByRole("button", { name: "Chart", exact: true }).click();
      await expect.poll(()=>clearMenu("#market-chart")).toBeGreaterThanOrEqual(8);
      await expect.poll(()=>clearMenu("#market-chart")).toBeLessThan(35);
      if (width === 390) {
        await page.screenshot({ path: info.outputPath("mobile-chart.png") });
        await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
        await page.screenshot({ path: info.outputPath("mobile-market-header.png") });
      }
    } else {
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
  const tabs=page.getByRole("navigation",{name:"Market navigation",exact:true});
  await expect(tabs).toBeVisible();
  await page.evaluate(()=>{
    const positions:number[]=[];
    Object.assign(window,{marketScrollPositions:positions});
    window.addEventListener("scroll",()=>positions.push(window.scrollY));
  });
  await tabs.getByRole("button",{name:"Community",exact:true}).click();
  await expect.poll(()=>page.locator(".community").evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeLessThan(170);
  await expect.poll(()=>page.evaluate(()=>new Set((window as unknown as {marketScrollPositions:number[]}).marketScrollPositions.map(Math.round)).size)).toBeGreaterThan(2);
  await tabs.getByRole("button",{name:"Project",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Project information",exact:true})).toBeVisible();
  await expect(tabs.getByRole("button",{name:"Project",exact:true})).toBeInViewport();
  await page.emulateMedia({reducedMotion:"reduce"});
  await tabs.getByRole("button",{name:"Trade",exact:true}).click();
  await tabs.getByRole("button",{name:"Community",exact:true}).click();
  await expect(tabs.getByRole("button",{name:"Community",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect.poll(()=>page.locator(".community").evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBeLessThan(170);
  await expect(page.locator(".community")).toBeInViewport();
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
  await dialog.getByRole("link", { name: "My holdings", exact: true }).click();
  await expect(page).toHaveURL(/portfolio/);
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".bottom-nav").getByRole("link", { name: "Portfolio" })).toHaveAttribute("aria-current", "page");
  await more.click();
  await page.screenshot({ path: info.outputPath("mobile-navigation.png") });
  await dialog.getByRole("button", { name: /Search coins/ }).click();
  await expect(page.getByRole("dialog", { name: "Search AQUA", exact: true })).toBeVisible();
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
  await page.getByRole("textbox", { name: "Search all markets" }).focus();
  await expect(page.locator(".bottom-nav")).toBeHidden();
  expect(await page.getByRole("textbox", { name: "Search all markets" }).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.getByRole("textbox", { name: "Search all markets" }).blur();
  await expect(page.locator(".bottom-nav")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Connect X account", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.locator(".wallet-menu-trigger").click();
  const dropdown = await page.locator(".wallet-dropdown").boundingBox();
  expect(dropdown!.x).toBeGreaterThanOrEqual(0);
  expect(dropdown!.x + dropdown!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(page.locator(".wallet-dropdown")).toHaveCount(0);
  await expect(page.locator(".wallet-menu-trigger")).toBeFocused();
});
