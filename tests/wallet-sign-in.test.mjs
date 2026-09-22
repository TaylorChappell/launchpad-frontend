import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWalletSignIn } from "../src/wallet-sign-in.ts";

const address = "11111111111111111111111111111111";
const proof = { signedMessage: new TextEncoder().encode("signed proof"), signature: new Uint8Array(64) };
test("accepts single and array Wallet Standard results and preserves the account and proof", () => {
  const account = { address, publicKey: new Uint8Array(32), features: ["solana:signMessage"] };
  for (const result of [{ account, ...proof }, [{ account, ...proof }]]) {
    const normalized = normalizeWalletSignIn(result);
    assert.equal(normalized.account, account);
    assert.equal(normalized.signedMessage, proof.signedMessage);
    assert.equal(normalized.signature, proof.signature);
  }
});
test("accepts injected public-key results without needing account.address", () => {
  for (const publicKey of [address, { toBase58: () => address }, { toString: () => address }, new Uint8Array(32)]) {
    for (const result of [{ publicKey, ...proof }, [{ publicKey, ...proof }]]) {
      assert.equal(normalizeWalletSignIn(result).account.address, address);
    }
  }
});
test("accepts serialized byte arrays without altering their values", () => {
  const normalized = normalizeWalletSignIn({ publicKey: address, signedMessage: [...proof.signedMessage], signature: [...proof.signature] });
  assert.deepEqual(normalized.signedMessage, proof.signedMessage);
  assert.deepEqual(normalized.signature, proof.signature);
});
test("rejects empty, ambiguous and malformed results with an actionable error", () => {
  for (const result of [undefined, null, [], [{}, {}], {}, { ...proof }, { account: {}, ...proof }, { account: { address: "invalid" }, ...proof }, { account: { address } }, { account: { address }, ...proof, signature: [256] }, { account: { address }, ...proof, signatureType: "other" }]) {
    assert.throws(() => normalizeWalletSignIn(result), error => error instanceof Error && !(error instanceof TypeError) && /wallet|sign-in/i.test(error.message));
  }
});
