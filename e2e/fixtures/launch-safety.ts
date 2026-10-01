import type { Page } from "@playwright/test";
export const launchBudgetFixture = {
  availableLamports:"10000000000",requiredLamports:"1120000000",reserveLamports:"120000000",
  buyLamports:"1000000000",shortfallLamports:"0",maximumBuyLamports:"9880000000",sufficient:true,
};
export const launchRecoveryFixture = {
  launchId:"old-launch",symbol:"OLD",pairSymbol:"ORCA",pairMint:"orca",pairBalanceRaw:"970",recoverableRaw:"970",
  canRecover:false,locked:false,positionActive:false,activationConfirmed:false,devBuyConfirmed:false,fundingConfirmed:false,
  unresolved:false,approvalsExpired:true,recoveryState:"none",recoverySignature:null,recoveryTransaction:null,
  steps:[{step:"mint",confirmed:true,signature:null},{step:"pool",confirmed:true,signature:null}],
  budget:launchBudgetFixture,positionAddress:null,
};
export async function mockLaunchSafety(page: Page) {
  await page.route("**/api/launches/budget",route=>route.fulfill({json:launchBudgetFixture}));
  await page.route("**/api/launches/*/recovery",route=>route.fulfill({json:launchRecoveryFixture}));
}
