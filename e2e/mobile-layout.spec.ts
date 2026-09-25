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

test("community stays below chart and trading at phone, tablet and desktop sizes", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "One explicit viewport sweep covers both layouts.");
  test.setTimeout(60_000);
  await setup(page);
  for (const width of [320, 360, 390, 430, 820, 1100, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#/token/mobile?tab=community");
    await expect(page.locator(".community-scroll")).toContainText("Welcome to the Ocean community");
    const boxes = await page.evaluate(() => {
      const box = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      return { chart: box("#market-chart"), trade: box("#market-trade"), tabs: box(".market-information-tabs"), community: box(".community"), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(boxes.community.top, `community after tabs at ${width}px`).toBeGreaterThanOrEqual(boxes.tabs.bottom);
    expect(boxes.tabs.top, `tabs after chart at ${width}px`).toBeGreaterThanOrEqual(boxes.chart.bottom);
    if(boxes.overflow>2) {
      console.log(await page.locator('body *').evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(el).position!=="absolute").map(el=>({tag:el.tagName,classes:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,30)));
      await page.screenshot({path:info.outputPath("mobile-overflow.png"),fullPage:true});
    }
    expect(boxes.overflow, `no page overflow at ${width}px`).toBeLessThanOrEqual(2);
    if (width <= 1100) {
      expect(boxes.trade.top).toBeGreaterThanOrEqual(boxes.chart.bottom);
      expect(boxes.tabs.top).toBeGreaterThanOrEqual(boxes.trade.bottom);
      await page.getByRole("button", { name: "Open trading panel", exact: true }).click();
      await expect.poll(async()=> (await page.locator(".trade-card").boundingBox())!.y).toBeGreaterThanOrEqual(120);
      const trade = await page.locator(".trade-card").boundingBox();
      const shortcuts = await page.locator(".market-mobile-shortcuts").boundingBox();
      expect(trade!.y).toBeGreaterThanOrEqual(shortcuts!.y + shortcuts!.height);
      expect(trade!.y).toBeLessThan(220);
      await page.getByRole("button", { name: "Open community", exact: true }).click();
      await expect(page.locator(".market-information-tabs").getByRole("button", { name: "Community", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect.poll(async()=> (await page.locator(".market-information-tabs").boundingBox())!.y).toBeLessThan(220);
      const tabs = await page.locator(".market-information-tabs").boundingBox();
      expect(tabs!.y).toBeGreaterThanOrEqual(shortcuts!.y + shortcuts!.height);
      if (width === 390) await page.screenshot({ path: info.outputPath("mobile-community.png") });
    } else {
      expect(boxes.trade.left).toBeGreaterThanOrEqual(boxes.chart.right);
    }
  }
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
