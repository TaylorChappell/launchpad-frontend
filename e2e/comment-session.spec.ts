import { test, expect, type Page } from "@playwright/test";

const address = "11111111111111111111111111111111", token = "a".repeat(64);
async function setup(page: Page, restored = false, authenticated = false, signInShape = "standard") {
  await page.addInitScript(({ address, token, restored, authenticated, signInShape }) => {
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    if (restored) localStorage.setItem("aqua:wallet", "phantom");
    if (authenticated) localStorage.setItem(`aqua:studio:${address}`, JSON.stringify({ token, expiresAt: Date.now() + 86400000 }));
    const calls = { signIn: 0, signMessage: 0 };
    Object.assign(window, { commentWalletCalls: calls, phantom: { solana: {
      isPhantom: true, publicKey: { toString: () => address },
      connect: async () => ({ publicKey: { toString: () => address } }), on() {}, removeListener() {},
      signIn: async () => {
        calls.signIn++;
        if (signInShape === "rejected") throw new Error("User rejected the request");
        if (signInShape === "undefined") return undefined;
        if (signInShape === "malformed" || signInShape === "fallback-rejected") return {};
        const proof = { signedMessage: new TextEncoder().encode("SIWS proof"), signature: new Uint8Array(64) };
        if (signInShape === "address") return { address, ...proof };
        if (signInShape === "injected") return { publicKey: { toString: () => address }, ...proof };
        const result = { account: { address }, ...proof };
        return signInShape === "array" ? [result] : result;
      },
      signMessage: async (message: Uint8Array) => {
        calls.signMessage++;
        if (signInShape === "fallback-rejected") throw new Error("User rejected the login signature");
        if (["malformed", "undefined"].includes(signInShape) && new TextDecoder().decode(message) === "Fresh fallback proof") return { signature: new Uint8Array(64) };
        throw new Error("Unexpected message-signing request");
      },
    } } });
  }, { address, token, restored, authenticated, signInShape });
  await page.route("**/api/config", r => r.fulfill({ json: { brand: "AQUA", network: "mainnet-beta", useTestnet: false,
    transactionsEnabled: false, marketGovernanceEnabled: false, publicRpcUrl: "https://rpc.invalid", whirlpools: {},
    fees: { transferFeeBps: 200, platformBps: 100, stockRewardsBps: 100 }, creatorLocks: { minimumSeconds: 86400, maximumSeconds: 31536000, maximumFeeShareBps: 5000 }, sniperDefense: { supported: false } } }));
  await page.route("**/account/x/config", r => r.fulfill({ json: { enabled: false } }));
  await page.route("**/api/notifications/**", r => r.fulfill({ json: { notifications: [] } }));
  await page.route("**/api/governance**", r => r.fulfill({ json: { enabled: false } }));
  await page.route("**/api/stocks", r => r.fulfill({ json: { stocks: [] } }));
  await page.route("**/api/market-prices", r => r.fulfill({ json: { prices: [] } }));
  await page.route("**/api/market-prices/stream", r => r.fulfill({ contentType: "text/event-stream", body: 'data: {"prices":[]}\n\n' }));
  await page.route("https://rpc.invalid/**", r => { const request = r.request().postDataJSON(); return r.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: { context: { slot: 1 }, value: 0 } } }); });
  await page.route("**/api/launches/coin/market-data?**", r => r.fulfill({ json: { snapshots: [] } }));
  await page.route("**/api/launches/coin", r => r.fulfill({ json: { launch: {
    id: "coin", mint: address, creatorWallet: address, name: "Comment test", symbol: "TEST", description: "A test market",
    stockMint: address, stockSymbol: "SOL", stockName: "Solana", stock: { mint: address, symbol: "SOL", name: "Solana" },
    pairMint: address, pairType: "sol", pairSymbol: "SOL", rewardMode: "holder_rewards", status: "live", txCount: 0,
    marketCapUsd: 1000, tvlUsd: 100, holderCount: 1, aquaIndexed: true, totalSupplyRaw: "1000000", tokenDecimals: 6,
    createdAt: Date.now(), launchedAt: Math.floor(Date.now() / 1000), devBuySol: 0, rewardAccumulatedUsd: 0, rewardRedeemableUsd: 0,
  }, trades: [], creatorLock: null, rewardModeState: null } }));
  await page.route("**/account/auth/sign-in/challenge", r => r.fulfill({ json: { id: "challenge", input: { nonce: "testnonce" } } }));
  await page.route("**/account/auth/sign-in/session", r => {
    expect(r.request().postDataJSON()).toMatchObject({ wallet: address, message: "SIWS proof" });
    return r.fulfill({ json: { token, expiresAt: Date.now() + 86400000 } });
  });
  await page.route("**/account/auth/challenge", r => {
    expect(r.request().postDataJSON()).toEqual({ wallet: address });
    return r.fulfill({ json: { id: "fresh-challenge", message: "Fresh fallback proof" } });
  });
  await page.route("**/account/auth/session", r => {
    expect(r.request().postDataJSON()).toEqual({ id: "fresh-challenge", wallet: address, signature: Buffer.alloc(64).toString("base64") });
    return r.fulfill({ json: { token, expiresAt: Date.now() + 86400000 } });
  });
  const posts: string[] = [];
  const comments: any[] = [];
  await page.route("**/api/launches/coin/comments", r => {
    if (r.request().method() === "GET") return r.fulfill({ json: { comments, hasMore: false, nextCursor: null } });
    expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
    const input = r.request().postDataJSON(); posts.push(input.body);
    const parent = comments.find(c => c.id === input.replyTo);
    if (input.replyTo) expect(parent).toBeTruthy();
    const comment = { ...input, launchId: "coin", authorWallet: address, createdAt: Date.now(), reply: parent ? { id: parent.id, authorWallet: parent.authorWallet, body: parent.body.slice(0, 200) } : null };
    comments.unshift(comment);
    return r.fulfill({ json: { comment } });
  });
  await page.goto("/#/token/coin");
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  return posts;
}

for (const shape of ["standard", "injected", "array", "address", "malformed", "undefined"]) test(`one wallet connection signs in with ${shape} response, then comments post without another wallet prompt`, async ({ page }) => {
  const posts = await setup(page, false, false, shape);
  await page.locator(".market-comments").getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /Phantom.*Connect/ }).click();
  await expect(page.getByRole("dialog", { name: "Connect your wallet" })).toHaveCount(0);
  for (const body of ["First comment", "Second comment"]) {
    await page.getByLabel("Your comment", { exact: true }).fill(body);
    await page.getByRole("button", { name: "Post comment", exact: true }).click();
    await expect(page.locator(".market-comment-feed").getByText(body, { exact: true })).toBeVisible();
  }
  expect(posts).toEqual(["First comment", "Second comment"]);
  expect(await page.evaluate(() => (window as any).commentWalletCalls)).toEqual({ signIn: 1, signMessage: ["malformed", "undefined"].includes(shape) ? 1 : 0 });
});

test("rejecting the fallback login leaves the wallet unauthenticated", async ({ page }) => {
  await setup(page, false, false, "fallback-rejected");
  let sessionRequests = 0;
  await page.route("**/account/auth/session", r => { sessionRequests++; return r.fulfill({ status: 400, json: { error: "Unexpected session request" } }); });
  await page.locator(".market-comments").getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /Phantom.*Connect/ }).click();
  await expect(page.getByText("User rejected the login signature")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Connect your wallet" })).toBeVisible();
  expect(sessionRequests).toBe(0);
  expect(await page.evaluate(() => (window as any).commentWalletCalls)).toEqual({ signIn: 1, signMessage: 1 });
  expect(await page.evaluate(address => localStorage.getItem(`aqua:studio:${address}`), address)).toBeNull();
});

test("fallback requires a server-verified proof before creating an authenticated session", async ({ page }) => {
  await setup(page, false, false, "malformed");
  let sessionRequests = 0;
  await page.route("**/account/auth/sign-in/session", r => { sessionRequests++; return r.fulfill({ status: 400, json: { error: "Unexpected session request" } }); });
  await page.route("**/account/auth/session", r => r.fulfill({ status: 401, json: { error: "Invalid wallet proof" } }));
  await page.locator(".market-comments").getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /Phantom.*Connect/ }).click();
  await expect(page.getByText("Invalid wallet proof")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Connect your wallet" })).toBeVisible();
  expect(sessionRequests).toBe(0);
  expect(await page.evaluate(address => localStorage.getItem(`aqua:studio:${address}`), address)).toBeNull();
});

for (const failure of ["rejected", "server"]) test(`a ${failure} sign-in does not open a fallback signing prompt`, async ({ page }) => {
  await setup(page, false, false, failure === "rejected" ? "rejected" : "standard");
  const message = failure === "rejected" ? "User rejected the request" : "Invalid wallet proof";
  if (failure === "server") await page.route("**/account/auth/sign-in/session", r => r.fulfill({ status: 401, json: { error: message } }));
  await page.locator(".market-comments").getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /Phantom.*Connect/ }).click();
  await expect(page.getByText(message)).toBeVisible();
  expect(await page.evaluate(() => (window as any).commentWalletCalls)).toEqual({ signIn: 1, signMessage: 0 });
  expect(await page.evaluate(address => localStorage.getItem(`aqua:studio:${address}`), address)).toBeNull();
});

test("a restored session can comment without signing in again", async ({ page }) => {
  const posts = await setup(page, true, true);
  await page.getByLabel("Your comment", { exact: true }).fill("Still signed in");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.locator(".market-comment-feed").getByText("Still signed in", { exact: true })).toBeVisible();
  expect(posts).toEqual(["Still signed in"]);
  expect(await page.evaluate(() => (window as any).commentWalletCalls)).toEqual({ signIn: 0, signMessage: 0 });
});

test("an old connection without a session does not silently open the wallet", async ({ page }) => {
  await setup(page, true);
  await expect(page.getByRole("button", { name: "Reconnect wallet", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post comment", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).commentWalletCalls)).toEqual({ signIn: 0, signMessage: 0 });
});

test("compact comments support reply previews, cancellation, refresh and keyboard posting", async ({ page }) => {
  const posts = await setup(page, true, true);
  const field = page.getByLabel("Your comment", { exact: true });
  await expect(field).toBeVisible();
  expect((await page.locator(".market-comment-composer").boundingBox())!.height).toBeLessThan(140);
  await field.fill("The new release is ready.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await page.locator(".market-comment").getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.locator(".comment-reply-draft")).toContainText("Replying to");
  await expect(field).toBeFocused();
  await page.getByRole("button", { name: "Cancel reply", exact: true }).click();
  await expect(page.locator(".comment-reply-draft")).toHaveCount(0);
  await page.locator(".market-comment").getByRole("button", { name: "Reply", exact: true }).click();
  await field.fill("Trying it now!");
  await field.press("Control+Enter");
  await expect(page.locator(".market-comment").first().locator(".comment-text")).toHaveText("Trying it now!");
  await expect(page.locator(".market-comment").first().locator(".comment-reference")).toContainText("The new release is ready.");
  await page.getByRole("button", { name: "Refresh comments", exact: true }).click();
  await expect(page.locator(".market-comment")).toHaveCount(2);
  expect(posts).toEqual(["The new release is ready.", "Trying it now!"]);
  expect(await page.evaluate(() => (window as any).commentWalletCalls)).toEqual({ signIn: 0, signMessage: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test("long comments expand without overflowing the thread", async ({ page }) => {
  await setup(page, true, true);
  const body = "Progress update. ".repeat(35) + "Final detail.";
  await page.getByLabel("Your comment", { exact: true }).fill(body);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await page.getByRole("button", { name: "Read more", exact: true }).click();
  await expect(page.locator(".comment-text")).toHaveText(body);
  await page.getByRole("button", { name: "Show less", exact: true }).click();
  await expect(page.locator(".comment-text")).not.toContainText("Final detail.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});
