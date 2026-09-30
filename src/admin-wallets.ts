import type { RuntimeConfig } from "./types";

export function isAdminWallet(wallet: string | null | undefined, config: Pick<RuntimeConfig, "adminWallet" | "adminWallets">): boolean {
  return Boolean(wallet && (config.adminWallets ?? (config.adminWallet ? [config.adminWallet] : [])).includes(wallet));
}

export function adminSessionKey(wallet: string | null | undefined): string {
  return `aqua-admin-session-v2:${wallet ?? "disconnected"}`;
}
