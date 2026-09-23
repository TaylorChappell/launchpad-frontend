import { test, expect } from "@playwright/test";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

test("launch approval includes activation and buy, with no wallet request after the market opens", async ({ page }) => {
  const address = Keypair.generate().publicKey.toBase58();
  const payer = new (await import("@solana/web3.js")).PublicKey(address);
  const envelope = (amount: number) => ({ transactionVersion: 0, lastValidBlockHeight: 100,
    transactionBase64: Buffer.from(new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: address,
      instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: amount })] }).compileToV0Message()).serialize()).toString("base64") });
  const batch = ["pool","prepare","liquidity","lock"].map((step,index) => ({ step, ...envelope(index + 2) }));
  await page.addInitScript(address => {
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    localStorage.setItem("aqua:wallet", "phantom");
    localStorage.setItem(`aqua:studio:${address}`, JSON.stringify({ token: "a".repeat(64), expiresAt: Date.now() + 3600000 }));
    const state = { sends: 0, batches: [] as number[] };
    Object.assign(window, { launchTestWallet: state, phantom: { solana: {
      isPhantom: true, connect: async () => ({ publicKey: { toString: () => address } }), on: () => {}, removeListener: () => {},
      signAndSendTransaction: async () => { state.sends++; return { signature: "mint-signature" }; },
      signAllTransactions: async (transactions: unknown[]) => { state.batches.push(transactions.length); return transactions; },
    } } });
  }, address);
  await page.route("**/api/config", r => r.fulfill({ json: { brand: "AQUA", network: "mainnet-beta", useTestnet: false, transactionsEnabled: true,
    marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid", whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
    creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } } }));
  await page.route("**/api/stocks?**", r => r.fulfill({ json: { refreshing: false, stocks: [{ symbol: "SOL", underlyingSymbol: "SOL", name: "Solana",
    mint: "So11111111111111111111111111111111111111112", verifiedAt: 1, restricted: false, orcaTvlUsd: 100000, orcaVolume24hUsd: 10000 }] } }));
  let walletLoaded = false;
  await page.route("**/api/launches?**", r => { if (r.request().url().includes(address)) walletLoaded = true; return r.fulfill({ json: { launches: [], hasMore: false } }); });
  await page.route("**/api/governance", r => r.fulfill({ json: { enabled: false } }));
  await page.route("**/api/uploads", r => r.fulfill({ json: { imageId: "artwork" } }));
  await page.route("**/api/launches", r => {
    expect(r.request().postDataJSON().devBuyAmountRaw).toBe("1000000000");
    return r.fulfill({ json: { ...envelope(1), launchId: "test-launch", mint: address, step: "mint" } });
  });
  await page.route("https://rpc.invalid/**", r => {
    const request = r.request().postDataJSON();
    return r.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: [{ slot: 1, confirmations: 1, err: null, confirmationStatus: "confirmed" }] } } });
  });
  await page.route("**/api/launches/test-launch/confirm", r => r.fulfill({ json: { launchId: "test-launch", nextStep: "pool", batch, devBuyIncluded: true } }));
  let submissions = 0; let lateBuys = 0;
  await page.route("**/api/launches/test-launch/submit-batch", async r => {
    submissions++;
    expect(r.request().postDataJSON().transactions.map((tx: {step:string}) => tx.step)).toEqual(["pool","prepare","liquidity","lock"]);
    return r.fulfill({ json: { launchId: "test-launch", status: "complete", mint: address, symbol: "TEST", rewardMode: "holder_rewards", devBuyIncluded: true, devBuySignature: "activation-signature" } });
  });
  await page.route("**/api/launches/test-launch/dev-buy-**", r => { lateBuys++; return r.fulfill({ status: 500, json: { error: "Buy already included" } }); });
  await page.goto("/#/create");
  await expect(page.getByPlaceholder("Aqua Robotics")).toBeVisible();
  await expect.poll(() => walletLoaded).toBe(true);
  await page.getByPlaceholder("Aqua Robotics").fill("Atomic Test");
  await page.getByPlaceholder("AQR").fill("TEST");
  await page.locator('input[type="file"]').setInputFiles({ name: "art.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose the pair and reward" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Optional first buy in SOL").fill("1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Launch", exact: true }).click();
  await expect(page.getByRole("heading", { name: "$TEST launched", exact: true })).toBeVisible();
  expect(submissions).toBe(1); expect(lateBuys).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { launchTestWallet: unknown }).launchTestWallet)).toEqual({ sends: 1, batches: [4] });
});
