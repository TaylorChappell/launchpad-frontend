import { test, expect } from "@playwright/test";

for (const status of ["mint_pending", "pool_pending", "liquidity_pending"]) test(`creator dashboard waits for ${status} to finish before polling deposits`, async ({ page }) => {
  const address = "11111111111111111111111111111111";
  await page.addInitScript(address => {
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    localStorage.setItem("aqua:wallet", "phantom");
    localStorage.setItem(`aqua:studio:${address}`, JSON.stringify({ token: "a".repeat(64), expiresAt: Date.now() + 86400000 }));
    Object.assign(window, { phantom: { solana: {
      isPhantom: true, publicKey: { toString: () => address },
      connect: async () => ({ publicKey: { toString: () => address } }), on() {}, removeListener() {},
    } } });
  }, address);
  await page.route("**/api/config", r => r.fulfill({ json: { brand: "AQUA", network: "mainnet-beta", useTestnet: false, transactionsEnabled: false,
    marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid", whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
    creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } } }));
  await page.route("https://rpc.invalid/**", r => r.fulfill({ json: { jsonrpc: "2.0", id: r.request().postDataJSON().id, result: { context: { slot: 1 }, value: 0 } } }));
  await page.route("**/api/notifications/**", r => r.fulfill({ json: { notifications: [] } }));
  let currentStatus = status, depositRequests = 0;
  await page.route("**/api/launches/coin", r => r.fulfill({ json: { launch: {
    id: "coin", name: "Test coin", symbol: "TEST", creatorWallet: address, mint: address, imageUrl: "", status: currentStatus,
    pairType: "sol", stockSymbol: "SOL", rewardMode: "holder_rewards", holderCount: 1, volume24hUsd: 0, rewardAccumulatedUsd: 0,
  }, creatorLock: null } }));
  await page.route("**/api/launches/coin/reward-deposits", r => { depositRequests++; return r.fulfill({ json: { deposits: [] } }); });
  await page.clock.install();
  await page.goto("/#/manage/coin");
  await expect(page.getByRole("heading", { name: "Finish launching this coin first" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume launch", exact: true })).toHaveAttribute("href", "#/create");
  await page.clock.fastForward(31000);
  expect(depositRequests).toBe(0);
  await expect(page.getByRole("button", { name: "Deposit SOL", exact: true })).toHaveCount(0);
  currentStatus = "live";
  await page.getByRole("button", { name: "Check launch status" }).click();
  await expect(page.getByRole("button", { name: "Deposit SOL", exact: true })).toBeVisible();
  await expect.poll(() => depositRequests).toBeGreaterThan(0);
});
