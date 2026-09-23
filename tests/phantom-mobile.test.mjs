import test from "node:test";
import assert from "node:assert/strict";
import { getPhantomProvider, isMobileBrowser, phantomBrowseUrl } from "../src/phantom-mobile.ts";

test("detects iPhone, Android and desktop-mode iPad without treating desktop touchscreens as phones", () => {
  for (const userAgent of ["iPhone", "iPad", "Android"]) assert.equal(isMobileBrowser({ userAgent }), true);
  assert.equal(isMobileBrowser({ userAgent: "Macintosh", maxTouchPoints: 5 }), true);
  assert.equal(isMobileBrowser({ userAgent: "Macintosh", maxTouchPoints: 0 }), false);
  assert.equal(isMobileBrowser({ userAgent: "Windows", maxTouchPoints: 10 }), false);
});
test("prefers namespaced Phantom and supports the legacy mobile provider without selecting another wallet", () => {
  const modern = { isPhantom: true }, legacy = { isPhantom: true };
  assert.equal(getPhantomProvider({ phantom: { solana: modern }, solana: legacy }), modern);
  assert.equal(getPhantomProvider({ solana: legacy }), legacy);
  assert.equal(getPhantomProvider({ solana: { isPhantom: false } }), undefined);
  assert.equal(getPhantomProvider({}), undefined);
});
test("browse link preserves the staging host, route, query and fragment", () => {
  const target = "https://staging.example.com/aqua/?source=phone#/token/coin?tab=comments";
  const link = new URL(phantomBrowseUrl(target));
  assert.equal(link.origin, "https://phantom.app");
  assert.equal(decodeURIComponent(link.pathname.slice("/ul/browse/".length)), target);
  assert.equal(link.searchParams.get("ref"), "https://staging.example.com");
});
test("browse links reject unsafe origins but allow local test servers", () => {
  for (const url of ["javascript:alert(1)", "http://example.com", "file:///aqua"]) assert.throws(() => phantomBrowseUrl(url));
  assert.match(phantomBrowseUrl("http://127.0.0.1:4173/#/studio"), /^https:\/\/phantom.app\/ul\/browse\//);
});
