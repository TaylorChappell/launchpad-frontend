import { launchBudgetFixture, mockLaunchSafety } from "./fixtures/launch-safety";
import { test, expect } from "@playwright/test";
import { Keypair, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

for (const scenario of [{ pair: "SOL", buy: "1", cancel: false }, { pair: "ORCA", buy: "1", cancel: false }, { pair: "SOL", buy: "", cancel: false }, { pair: "SOL", buy: "1", cancel: true }]) test(`one signing request launches ${scenario.pair} with ${scenario.buy || "no"} dev buy${scenario.cancel ? " after cancellation" : ""}`, async ({ page }) => {
  const creator = Keypair.generate();
  const address = creator.publicKey.toBase58();
  const payer = new (await import("@solana/web3.js")).PublicKey(address);
  const envelope = (amount: number) => ({ transactionVersion: 0, lastValidBlockHeight: 100,
    transactionBase64: Buffer.from(new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: address,
      instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: amount })] }).compileToV0Message()).serialize()).toString("base64") });
  const mintSigner = Keypair.generate();
  const mintTx = new Transaction({ feePayer: payer, recentBlockhash: address }).add(SystemProgram.createAccount({
    fromPubkey: payer, newAccountPubkey: mintSigner.publicKey, lamports: 1, space: 82, programId: SystemProgram.programId }));
  mintTx.sign(creator, mintSigner);
  // Exercise legacy mint + v0 pool transactions in the same wallet request.
  const mintEnvelope = { transactionVersion: "legacy", lastValidBlockHeight: 100, transactionBase64: mintTx.serialize().toString("base64") };
  const batch = [{ step: "mint", ...mintEnvelope }, ...["pool","prepare",...(scenario.pair === "ORCA" ? ["funding"] : []),"liquidity"].map((step,index) => ({ step, ...envelope(index + 2) }))];
  await page.addInitScript(({address,cancel}) => {
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    localStorage.setItem("aqua:wallet", "phantom");
    localStorage.setItem(`aqua:studio:${address}`, JSON.stringify({ token: "a".repeat(64), expiresAt: Date.now() + 3600000 }));
    const state = { sends: 0, approvals: 0, batches: [] as number[] };
    Object.assign(window, { launchTestWallet: state, phantom: { solana: {
      isPhantom: true, connect: async () => ({ publicKey: { toString: () => address } }), on: () => {}, removeListener: () => {},
      signAndSendTransaction: async () => { state.sends++; return { signature: "mint-signature" }; },
      signTransaction: async (transaction: unknown) => { state.approvals++; return transaction; },
      signAllTransactions: async (transactions: unknown[]) => { state.batches.push(transactions.length); if(cancel && state.batches.length === 1) throw Error("User declined"); return transactions; },
    } } });
  }, {address,cancel:scenario.cancel});
  await page.route("**/api/config", r => r.fulfill({ json: { brand: "AQUA", network: "mainnet-beta", useTestnet: false, transactionsEnabled: true,
    marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid", whirlpools: {}, fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 },
    creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } } }));
  await page.route("**/api/stocks?**", r => r.fulfill({ json: { refreshing: false, stocks: [{ symbol: scenario.pair, underlyingSymbol: scenario.pair, name: scenario.pair,
    mint: scenario.pair === "SOL" ? "So11111111111111111111111111111111111111112" : "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", verifiedAt: 1, restricted: false, orcaTvlUsd: 100000, orcaVolume24hUsd: 10000 }] } }));
  let walletLoaded = false;
  await page.route("**/api/launches?**", r => { if (r.request().url().includes(address)) walletLoaded = true; return r.fulfill({ json: { launches: [], hasMore: false } }); });
  await page.route("**/api/governance", r => r.fulfill({ json: { enabled: false } }));
  await page.route("**/api/uploads", r => r.fulfill({ json: { imageId: "artwork" } }));
  let creations=0;
  await page.route("**/api/launches", r => {
    creations++;
    expect(r.request().postDataJSON().devBuyAmountRaw).toBe(scenario.buy ? "1000000000" : "0");
    expect(r.request().postDataJSON().batchSigning).toBe(true);
    return r.fulfill({ json: { ...mintEnvelope, batch, launchId: "test-launch", mint: address, step: "mint" } });
  });
  await page.route("https://rpc.invalid/**", r => {
    const request = r.request().postDataJSON();
    return r.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: [{ slot: 1, confirmations: 1, err: null, confirmationStatus: "confirmed" }] } } });
  });
  let mintConfirmations=0;
  await page.route("**/api/launches/test-launch/confirm", r => { mintConfirmations++;return r.fulfill({ json: { launchId: "test-launch", nextStep: "pool", batch, devBuyIncluded: Boolean(scenario.buy) } }); });
  let submissions = 0; let lateBuys = 0;let simulations=0;
  await page.route("**/api/launches/test-launch/submission",r=>r.fulfill({json:{launchId:"test-launch",status:"not_submitted"}}));
  await page.route("**/api/launches/test-launch/prepare-batch",r=>{
    expect(r.request().postDataJSON().transactions.map((tx: {step:string})=>tx.step)).toEqual(batch.map(tx=>tx.step));simulations++;
    return r.fulfill({json:{ready:true}});
  });
  await page.route("**/api/launches/test-launch/retry-transaction",r=>r.fulfill({json:{launchId:"test-launch",batch:batch.slice(submissions),devBuyIncluded:true}}));
  await page.route("**/api/launches/test-launch/submit-batch", async r => {
    submissions++;
    expect(simulations).toBe(submissions+(scenario.cancel?1:0));
    expect(r.request().postDataJSON().sequential).toBe(false);
    expect(r.request().postDataJSON().transactions.map((tx: {step:string}) => tx.step)).toEqual(batch.map(tx=>tx.step));
    return r.fulfill({ json: { launchId: "test-launch", status: "complete",approvalReady:false, mint: address, symbol: "TEST", rewardMode: "holder_rewards", devBuyIncluded: Boolean(scenario.buy), devBuySignature: "activation-signature" } });
  });
  await page.route("**/api/launches/test-launch/dev-buy-**", r => { lateBuys++; return r.fulfill({ status: 500, json: { error: "Buy already included" } }); });
  await mockLaunchSafety(page);
  let funded=false;
  await page.route("**/api/launches/budget",route=>route.fulfill({json:funded?launchBudgetFixture:{...launchBudgetFixture,availableLamports:"1000000000",requiredLamports:"1120000000",shortfallLamports:"120000000",maximumBuyLamports:"880000000",sufficient:false}}));
  await page.goto("/#/create");
  await expect(page.getByPlaceholder("Aqua Robotics")).toBeVisible();
  await expect.poll(() => walletLoaded).toBe(true);
  await page.getByPlaceholder("Aqua Robotics").fill("Atomic Test");
  await page.getByPlaceholder("AQR").fill("TEST");
  await page.locator('input[type="file"]').setInputFiles({ name: "art.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose a trading pair" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose the reward mode" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coin settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review & launch" })).toBeVisible();
  await page.getByLabel("Optional first buy in SOL").fill(scenario.buy);
  await page.getByRole("checkbox").check();
  await expect(page.getByText("More SOL needed",{exact:true})).toBeVisible();
  await expect(page.getByRole("button", { name: "Launch", exact: true })).toBeDisabled();
  funded=true;
  await page.getByRole("button", { name: "Refresh balance", exact: true }).click();
  await page.getByRole("button", { name: "Launch", exact: true }).click();
  if(scenario.cancel) {
    await expect(page.getByText("Launch stopped",{exact:true})).toBeVisible();
    expect(submissions).toBe(0);
    await page.getByRole("button",{name:"Resume launch",exact:true}).click();
  }
  await expect(page.getByRole("heading", { name: "$TEST launched", exact: true })).toBeVisible();
  expect(submissions).toBe(1); expect(lateBuys).toBe(0); expect(creations).toBe(1); expect(mintConfirmations).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { launchTestWallet: unknown }).launchTestWallet)).toEqual({ sends: 0, approvals: 0, batches: scenario.cancel ? [batch.length,batch.length] : [batch.length] });
});
