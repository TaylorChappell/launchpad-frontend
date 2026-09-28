import assert from "node:assert/strict";
import test from "node:test";
import { addressClaimSignature } from "../src/address-claim-signature.ts";
const signature = "5bXfgHJ96ejTUzAj3HviBa1thjjkJot9b9VAREG2f5sUKN4StisQ7dQUcZFv1z8Diuqc6NKu8Gfvc5CW81vDKTPw";
test("accepts the reported transaction signature and explorer links",()=>{
  for(const input of [signature, ` ${signature} `, `https://solscan.io/tx/${signature}`, `https://solscan.io/tx/${signature}/?cluster=mainnet-beta`, `https://explorer.solana.com/tx/${signature}`]) assert.equal(addressClaimSignature(input),signature);
});
test("rejects account links, invalid signatures and unrelated websites",()=>{
  for(const input of ["", "not a signature", "1".repeat(32), "1".repeat(100), `https://solscan.io/account/${signature}`, `https://example.com/tx/${signature}`, `https://solscan.io.example.com/tx/${signature}`]) assert.throws(()=>addressClaimSignature(input));
});
