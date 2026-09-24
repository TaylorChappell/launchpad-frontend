import { test, expect } from "@playwright/test";

test("Created shows live coins in reward-style rows and sends unlocked coins to fee setup", async ({ page }) => {
  const address = "11111111111111111111111111111111";
  await page.addInitScript((wallet) => {
    localStorage.setItem("aqua:wallet", "phantom");
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    Object.assign(window, { phantom: { solana: { isPhantom: true, publicKey: { toString: () => wallet }, connect: async () => ({ publicKey: { toString: () => wallet } }), on() {}, removeListener() {} } } });
  }, address);
  await page.route("**/api/config", route => route.fulfill({ json: { brand: "AQUA", network: "mainnet-beta", useTestnet: false, transactionsEnabled: false,
    marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid", whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
    creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } } }));
  await page.route("**/api/wallets/*/holdings", r => r.fulfill({ json: { holdings: [] } }));
  await page.route("**/api/wallets/*/claim-history", r => r.fulfill({ json: { claims: [], lifetime: [], hasMore: false } }));
  await page.route("**/api/rewards/*", r => r.fulfill({ json: { rewards: [], holdings: [], markets: [] } }));
  const coin = (id: string, status: string, creatorLock: object | null = null) => ({ id, mint: address, name: id, symbol: id.toUpperCase(), creatorWallet: address,
    status, creatorLock, createdAt: Date.now(), pairSymbol: "SOL", tokenDecimals: 6 });
  const live = coin("live-coin", "live");
  const locked = coin("locked-coin", "live", { status: "active", vaultTokenAccount: address, amountRaw: "100000", totalSupplyRaw: "1000000", creatorWallet: address });
  const unfinished = coin("unfinished-coin", "mint_pending");
  const requestedStatuses: string[] = [];
  await page.route("**/api/launches?**", route => {
    requestedStatuses.push(new URL(route.request().url()).searchParams.get("status") ?? "");
    return route.fulfill({ json: { launches: [live, locked, unfinished], hasMore: false, nextOffset: 3 } });
  });
  await page.route("**/api/launches/locked-coin/creator-fees?**", route => route.fulfill({ json: { wallet: address, availableLamports: "300575534", pendingLamports: "0", claimsEnabled: true, pendingClaim: null } }));
  await page.route("**/api/launches/unfinished-coin", route => route.fulfill({ json: { launch: unfinished, trades: [], creatorLock: null, rewardModeState: null } }));
  await page.goto("/#/portfolio?tab=created");
  const rows = page.locator(".created-market-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first().getByRole("link", { name: /Set up creator fees/ })).toHaveAttribute("href", "#/manage/live-coin?tab=fees");
  await expect(rows.first().getByRole("button", { name: "Claim" })).toHaveCount(0);
  await expect(rows.nth(1).getByText("0.300575534")).toBeVisible();
  await expect(rows.nth(1).getByRole("button", { name: "Claim" })).toBeEnabled();
  await expect(page.getByText("unfinished-coin")).toHaveCount(0);
  expect(requestedStatuses.every(status => status === "live")).toBe(true);
  await page.goto("/#/token/unfinished-coin");
  await expect(page.getByRole("heading", { name: "Market not available" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "unfinished-coin" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});
