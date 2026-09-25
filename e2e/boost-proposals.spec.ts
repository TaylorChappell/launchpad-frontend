import { test, expect, type Page } from "@playwright/test";

const address = "11111111111111111111111111111111";
async function setup(page: Page, state = "voting", automatic: "profile" | "boost" | "aqua" | null = null, openGovernance = true) {
  await page.addInitScript(address => {
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    localStorage.setItem("aqua:wallet", "phantom");
    Object.assign(window, { phantom: { solana: { isPhantom: true, publicKey: { toString: () => address },
      connect: async () => ({ publicKey: { toString: () => address } }), on() {}, removeListener() {},
      signMessage: async () => ({ signature: new Uint8Array(64).fill(1) }) } } });
  }, address);
  await page.route("**/api/config", r => r.fulfill({ json: { brand: "AQUA", network: "mainnet-beta", useTestnet: false, transactionsEnabled: false,
    marketGovernanceEnabled: true, publicRpcUrl: "https://rpc.invalid", whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
    creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } } }));
  await page.route("**/api/notifications/**", r => r.fulfill({ json: { notifications: [] } }));
  await page.route("**/api/governance**", r => r.fulfill({ json: { enabled: false } }));
  await page.route("**/api/stocks", r => r.fulfill({ json: { stocks: [] } }));
  await page.route("**/api/market-prices", r => r.fulfill({ json: { prices: [] } }));
  await page.route("**/api/market-prices/stream", r => r.fulfill({ contentType: "text/event-stream", body: 'data: {"prices":[]}\n\n' }));
  await page.route("https://rpc.invalid/**", r => r.fulfill({ json: { jsonrpc: "2.0", id: r.request().postDataJSON().id, result: { context: { slot: 1 }, value: 0 } } }));
  await page.route("**/api/launches/coin/market-data?**", r => r.fulfill({ json: { snapshots: [] } }));
  const now = Math.floor(Date.now() / 1000);
  await page.route("**/api/launches/coin", r => r.fulfill({ json: { launch: {
    id: "coin", mint: address, creatorWallet: address, name: "Ocean coin", symbol: "OCEAN", description: "An ocean community",
    stockMint: address, stockSymbol: "SOL", stockName: "Solana", stock: { mint: address, symbol: "SOL", name: "Solana" },
    pairMint: address, pairType: "sol", pairSymbol: "SOL", rewardMode: "holder_rewards", status: "live", txCount: 0,
    marketCapUsd: 1000, tvlUsd: 100, holderCount: 1, aquaIndexed: true, totalSupplyRaw: "1000000", tokenDecimals: 6,
    createdAt: Date.now() - 10000000, launchedAt: now - 10000, devBuySol: 0, rewardAccumulatedUsd: 0, rewardRedeemableUsd: 0,
  }, trades: [], creatorLock: null, rewardModeState: null } }));
  const power = { currentRaw: "10000", averageRaw: "10000", effectiveRaw: "10000", thresholdRaw: "1000", eligible: true, windowStartsAt: now - 10000 };
  const data = { enabled: true, testingMode: false, dexPaid: true, creatorWallet: address, totalSupplyRaw: "1000000", proposalsOpenAt: now - 900,
    createPower: power, votePower: power, votes: {} as Record<string, string>,
    options: { dex_boost: { available: true, completed: false, reason: null } },
    proposals: [{ id: "boost", launchId: "coin", type: "dex_boost", isDefault: false, proposerWallet: address, status: state,
      payload: { reason: "Give our community more visibility on DEX Screener.", ...(state === "completed" ? { collectedUsdCents: "9800" } : {}) },
      startsAt: now - 60, endsAt: now + 840, yesPowerRaw: "30000", noPowerRaw: "10000", eligibleVoters: 4,
      pollPowerRaw: { "5": "10000", "10": "15000", "20": "5000", no: "10000" }, fundingPercent: state === "voting" ? null : 10,
      fundingStartsAt: now - 1800, fundingEndsAt: now + 1800, fundedUsd: state === "completed" ? 98 : 250, fundedLamports: "2500000000", targetUsd: 0,
      returnedLamports: state === "completed" ? "980000000" : "0", outcome: state === "completed" ? "below_minimum" : null, createdAt: Date.now() - 60000 }],
  };
  if (automatic) {
    Object.assign(data, { automaticFundingEnabled: true, enabled: automatic !== "aqua", dexPaid: automatic !== "profile" });
    Object.assign(data.proposals[0], { isAutomatic: true, collectionPaused: automatic === "profile", type: automatic === "profile" ? "dex_payment" : "dex_boost", fundingPercent: 10, fundedUsd: 74, targetUsd: automatic === "profile" ? 300 : 0 });
  }
  await page.route("**/api/launches/coin/proposals**", r => {
    if (r.request().url().endsWith("/challenge")) return r.fulfill({ json: { challenge: "test-challenge", message: "Vote for " + r.request().postDataJSON().content.choice, expiresAt: Date.now() + 60000 } });
    if (r.request().url().endsWith("/vote")) {
      expect(r.request().postDataJSON()).toMatchObject({ wallet: address, choice: "10", message: "Vote for 10" });
      data.votes.boost = "10";
    }
    return r.fulfill({ json: data });
  });
  await page.goto("/#/token/coin");
  if (openGovernance) await page.getByRole("button", { name: "More details", exact: true }).click();
  return data;
}

test("boost funding uses the existing governance view and signs the chosen percentage", async ({ page }, info) => {
  await setup(page);
  const card = page.locator(".boost-proposal-card");
  await expect(card.getByRole("heading", { name: "Choose the funding rate" })).toBeVisible();
  await expect(card.locator(".boost-poll-options button")).toHaveCount(4);
  await card.getByRole("button", { name: "10% 37.5%", exact: true }).click();
  await expect(card.getByRole("button", { name: "10% 37.5%", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".market-information-tabs").getByRole("button", { name: "Promotions", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await card.screenshot({ path: `/tmp/aqua-boost-poll-${info.project.name}.png` });
  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await page.getByRole("button", { name: "Proposals", exact: true }).click();
  await page.getByRole("button", { name: "Fund DEX boost", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("5% · 10% · 20% · No", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("$3,999", { exact: true })).toBeVisible();
});

test("funding shows the hour countdown and the affordable pack", async ({ page }) => {
  await setup(page, "funding");
  const card = page.locator(".boost-proposal-card");
  await expect(card.getByText("30x affordable", { exact: true })).toBeVisible();
  await expect(card.getByText("$399 unlocks 50x", { exact: true })).toBeVisible();
  await expect(card.getByText("Funding ends in", { exact: false })).toBeVisible();
});

test("a sub-minimum campaign shows its refund in the existing proposal history", async ({ page }) => {
  await setup(page, "completed");
  await page.getByText("Past proposals · 1", { exact: true }).click();
  const card = page.locator(".boost-proposal-card");
  await expect(card.getByRole("heading", { name: "Funds returned to holders" })).toBeVisible();
  await expect(card.getByText("0.98 SOL returned to holders.", { exact: true })).toBeVisible();
  await expect(card.getByText(/purchased/)).toHaveCount(0);
});

test("completed automatic mini boosts disappear from proposal history", async ({ page }) => {
  await setup(page, "completed", "boost", false);
  await expect(page.getByRole("button", { name: "Governance" })).toHaveCount(0);
  await expect(page.getByText(/Past proposals/)).toHaveCount(0);
});


test("automatic profile funding stays compact and permits a holder funding vote", async ({ page }, info) => {
  await setup(page, "funding", "profile");
  const card = page.locator(".automatic-funding-card");
  await expect(card.getByText("10% of incoming rewards", { exact: true })).toBeVisible();
  await expect(card.getByText("Auto funding", { exact: true })).toBeVisible();
  await expect(card.getByText(/Expires in/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Proposals", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await card.screenshot({ path: `/tmp/aqua-auto-profile-${info.project.name}.png` });
});

test("AQUA shows automatic mini boosts with no holder proposal controls", async ({ page }, info) => {
  await setup(page, "funding", "aqua");
  const card = page.locator(".boost-proposal-card");
  await expect(card.getByRole("heading", { name: "Mini DEX boost", exact: true })).toBeVisible();
  await expect(card.getByText("$100 minimum", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Proposals", exact: true })).toHaveCount(0);
  await expect(card.locator(".boost-poll-options")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await card.screenshot({ path: `/tmp/aqua-auto-boost-${info.project.name}.png` });
});


test("a proposal survey returns to the details sheet with focus and scroll locked", async ({page})=>{
  await setup(page,"funding");
  await page.getByRole("button",{name:"Challenge proposal",exact:true}).click();
  const survey=page.getByRole("dialog",{name:"Challenge this proposal",exact:true});
  await expect(survey).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(await survey.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(survey).toHaveCount(0);
  const details=page.getByRole("dialog",{name:"Market details",exact:true});
  await expect(details).toBeVisible();
  await expect(details.getByRole("button",{name:"Challenge proposal",exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).not.toBe("hidden");
});
