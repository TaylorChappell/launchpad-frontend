import bs58 from "bs58";

export type WalletSignInOutput = { account: { address: string }; signedMessage: Uint8Array; signature: Uint8Array; signatureType?: string };
export class WalletSignInResponseError extends Error {}

/** Adapt injected-provider and Wallet Standard responses without changing the
 * signed proof. The backend must still verify the challenge and signature. */
export function normalizeWalletSignIn(result: unknown): WalletSignInOutput {
  if (Array.isArray(result)) {
    if (result.length !== 1) throw new WalletSignInResponseError("The wallet did not return one sign-in account. Connect again.");
    result = result[0];
  }
  if (!result || typeof result !== "object") throw new WalletSignInResponseError("The wallet did not return a sign-in result. Connect again.");
  const output = result as Record<string, any>;
  let address = output.account?.address ?? output.address;
  if (address === undefined && output.publicKey != null) {
    const key = output.publicKey;
    address = typeof key === "string" ? key : key instanceof Uint8Array ? bs58.encode(key)
      : typeof key.toBase58 === "function" ? key.toBase58() : typeof key.toString === "function" ? key.toString() : undefined;
  }
  try {
    if (typeof address !== "string" || bs58.decode(address).length !== 32) throw new Error();
  } catch {
    throw new WalletSignInResponseError("The wallet did not return a valid Solana sign-in account. Connect again.");
  }
  if (output.signatureType && output.signatureType !== "ed25519") throw new Error("This wallet signature format is not supported.");
  const bytes = (value: unknown) => value instanceof Uint8Array ? value
    : Array.isArray(value) && value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255) ? new Uint8Array(value) : null;
  const signedMessage = bytes(output.signedMessage), signature = bytes(output.signature);
  if (!signedMessage?.length || signature?.length !== 64) throw new WalletSignInResponseError("The wallet returned an incomplete sign-in proof. Connect again.");
  return { account: output.account?.address === address ? output.account : { address }, signedMessage, signature, signatureType: output.signatureType };
}
