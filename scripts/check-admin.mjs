// Local, offline render checks. No wallet, network, or live admin session is used.
// Run: node scripts/check-admin.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const temporary = await mkdtemp(path.join(tmpdir(), "aqua-admin-check-"));
const output = path.join(temporary, "render.cjs");
const controller = `export const state = { calls: 0, query: '', authorized: true, connected: true, governance: true, data: null };`;
await build({
  absWorkingDir: root, bundle: true, platform: "node", format: "cjs", outfile: output,
  jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
  define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { Admin } from './src/pages/Admin';
    import { state } from 'test-controller';
    export function render(data, query, options = {}) {
      Object.assign(state, { calls: 0, query, data, authorized: true, connected: true, governance: true }, options);
      return renderToStaticMarkup(<MemoryRouter><Admin/></MemoryRouter>);
    }
  ` },
  plugins: [{ name: "offline-admin-fixtures", setup(build) {
    build.onResolve({ filter: /^test-controller$/ }, () => ({ path: "controller", namespace: "fixture" }));
    build.onResolve({ filter: /^(react|react-router-dom|\.\.\/context|\.\.\/api)$/ }, args => {
      if (!args.importer.endsWith("/src/pages/Admin.tsx")) return;
      return { path: args.path, namespace: "fixture" };
    });
    build.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
      const contents = args.path === "controller" ? controller : args.path === "react" ? `
        export * from 'react';
        import { useState as actual } from 'react';
        import { state } from 'test-controller';
        export function useState(value) {
          state.calls++;
          return actual(state.calls === 1 ? 'offline-session' : state.calls === 2 ? state.data : value);
        }
      ` : args.path === "react-router-dom" ? `
        export { Link } from 'react-router-dom';
        import { state } from 'test-controller';
        export const useSearchParams = () => [new URLSearchParams(state.query), () => {}];
      ` : args.path === "../context" ? `
        import { state } from 'test-controller';
        export const useWallet = () => ({ address: state.connected ? (state.authorized ? 'offline-admin' : 'other-wallet') : null });
        export const useRuntime = () => ({ config: { adminWallet: 'offline-admin', useTestnet: true, marketGovernanceEnabled: state.governance } });
      ` : `export const api = new Proxy({}, { get() { throw new Error('No network access is allowed in this test'); } });`;
      return { contents, loader: "js", resolveDir: root };
    });
  } }],
});
const { render } = (await import(pathToFileURL(output).href)).default;
const data = {
  generatedAt: 1_780_000_000_000, flags: { feeKeeperEnabled: true, solFeeConversionEnabled: true, rewardDistributionEnabled: false, conversionMinimumUsdCents: 100, conversionSlippageBps: 300, keeperIntervalMs: 30_000, rewardEpochSeconds: 3600 },
  counts: { live_launches: 16 }, runtime: { available: false, reason: "Offline fixture" },
  launches: [{ id: "market-a", symbol: "TEST" }],
  diagnostics: Array.from({ length: 20 }, (_, i) => ({ launch_id: `market-${i}`, status: "blocked", stage: "conversion", message: "No route found", updated_at: 1_780_000_000_000 })),
  conversions: [], settlements: [], rewardPurchases: [], rewardEpochs: [], creatorLocks: [],
  proposals: [{ id: "proposal-a", launchId: "market-a", type: "dex_payment", marketSymbol: "TEST", status: "ready", targetUsd: 300, fundedUsd: 300, fundedLamports: "2000000000", reservedLamports: "1000000000", yesPowerRaw: "80", noPowerRaw: "20", eligibleVoters: 3, endsAt: 1780000000, payload: { detailsSubmittedAt: 1780000000, dexDetails: { description: "An approved profile", websiteUrl: "https://example.test" } }, createdAt: 1780000000000 }],
};
let count = 0;
const check = (test) => { test(); count++; };
check(() => { const html = render(data, "section=overview"); assert.match(html, /Action queue/); assert.match(html, /ADMIN_DISCORD_WEBHOOK_URL/); assert.match(html, /Unavailable/); });
check(() => { const html = render(data, "section=dex"); assert.match(html, /An approved profile/); assert.match(html, /Withdraw reserved SOL/); assert.match(html, /1 SOL/); assert.match(html, /\$300.00/); });
check(() => { const html = render(data, "section=logs"); assert.match(html, /Errors only/); assert.match(html, /1–15 of 20/); assert.match(html, /Page 1 \/ 2/); assert.match(html, /Copy record/); });
check(() => { const html = render(data, "section=logs&search=does-not-exist"); assert.match(html, /No records match your filters/); assert.doesNotMatch(html, /No route found/); });
check(() => { const html = render(data, "section=dex&search=does-not-exist"); assert.match(html, /No proposals match this view/); assert.doesNotMatch(html, /Withdraw reserved SOL/); });
check(() => { assert.match(render(data, "section=rewards"), /No reward epochs match/); });
check(() => { assert.match(render(data, "section=custody"), /Offline fixture/); });
check(() => { const html = render(data, "section=dex", { governance: false }); assert.match(html, /Market governance is disabled/); assert.doesNotMatch(html, /Withdraw reserved SOL/); });
check(() => { const html = render(data, "section=dex", { authorized: false }); assert.match(html, /Access restricted/); assert.doesNotMatch(html, /An approved profile/); });
check(() => { const html = render(data, "section=overview", { connected: false }); assert.match(html, /Connect admin wallet/); assert.doesNotMatch(html, /Action queue/); });
check(() => { const html = render({ ...data, alerts: { configured: true, valid: false, failedDeliveries: 0, lastDeliveredAt: null } }, "section=custody"); assert.match(html, /configured webhook URL is invalid/); });
check(() => { const html = render({ ...data, proposals: [{ ...data.proposals[0], openChallenges: 1, challenges: [{ id: "c1", reason: "Evidence for review", wallet: "claimant", createdAt: 1780000000000 }] }] }, "section=dex"); assert.match(html, /Evidence for review/); assert.match(html, /disabled=""[^>]*>Withdraw reserved SOL/); });
console.log(`Admin render checks: ${count} passed (offline fixtures; not a browser interaction test).`);
