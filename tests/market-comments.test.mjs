import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeComments } from "../src/market-comments.ts";

const comment = (id, createdAt, body = "Hello") => ({ id, createdAt, body, launchId: "coin", authorWallet: "wallet" });
test("new posts stay at the top when an older page finishes loading", () => {
  const newest = comment("c", 300), older = comment("a", 100), middle = comment("b", 200);
  assert.deepEqual(mergeComments([newest], [older, middle]), [newest, middle, older]);
});
test("retries deduplicate comments and tied timestamps use the server's ID order", () => {
  const a = comment("00000000-0000-4000-8000-000000000001", 100);
  const b = comment("00000000-0000-4000-8000-000000000002", 100);
  assert.deepEqual(mergeComments([a, b], [b, a]), [b, a]);
});
