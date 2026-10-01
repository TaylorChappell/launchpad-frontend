import { test, expect, type Page } from "@playwright/test";
import { Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { launchRecoveryFixture, launchBudgetFixture } from "./fixtures/launch-safety";
const wallet = Keypair.generate().publicKey.toBase58();
async function setup(page: Page, state = launchRecoveryFixture) {
  await page.addInitScript(wallet => {
    localStorage.setItem("aqua:update:holder-workspace-v2", "seen");
    localStorage.setItem("aqua:wallet", "phantom");
    localStorage.setItem(`aqua:launch-relay:mainnet-beta:${wallet}`, "old-launch");
    localStorage.setItem(`aqua:studio:${wallet}`, JSON.stringify({token:"a".repeat(64),expiresAt:Date.now()+3600000}));
    Object.assign(window,{recoveryApprovals:0,phantom:{solana:{
      isPhantom:true,connect:async()=>({publicKey:{toString:()=>wallet}}),on(){},removeListener(){},
      signTransaction:async(transaction:unknown)=>{(window as any).recoveryApprovals++;return transaction;},
    }}});
  },wallet);
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/api/config")return route.fulfill({json:{brand:"AQUA",network:"mainnet-beta",transactionsEnabled:true,marketGovernanceEnabled:false,fees:{},whirlpools:{},creatorLocks:{},sniperDefense:{supported:false}}});
    if(path.endsWith("/recovery"))return route.fulfill({json:state});
    if(path==="/api/launches/budget")return route.fulfill({json:launchBudgetFixture});
    return route.fulfill({json:{launches:[],stocks:[],notifications:[],enabled:false}});
  });
  await page.route("**/account/**",route=>route.fulfill({json:{enabled:false}}));
  return ()=>page.goto("/#/create");
}
test("a completed buy offers lock-only resume and no automated withdrawal",async({page},info)=>{
  const go=await setup(page,{...launchRecoveryFixture,devBuyConfirmed:true,activationConfirmed:true,positionActive:true});
  await go();
  await expect(page.getByText("Your dev buy completed. Resume to finish the permanent lock without buying again.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Get recovery quote"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Resume launch",exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).recoveryApprovals)).toBe(0);
  await page.screenshot({path:info.outputPath("compact-launch-recovery.png"),fullPage:true});
});
test("unused funding recovery shows its quote before requesting a wallet signature",async({page})=>{
  let state:any={...launchRecoveryFixture,canRecover:true,fundingConfirmed:true};
  const go=await setup(page,state);
  let prepared=0,submitted=0;
  await page.route("**/api/launches/old-launch/recovery",route=>route.fulfill({json:state}));
  await page.route("**/api/launches/old-launch/recovery/transaction",route=>{
    prepared++;
    const envelope={transactionBase64:Buffer.from(new VersionedTransaction(new TransactionMessage({payerKey:new PublicKey(wallet),recentBlockhash:wallet,instructions:[]}).compileToV0Message()).serialize()).toString("base64"),transactionVersion:0,lastValidBlockHeight:100,minimumOutputRaw:"900000000"};
    state={...state,canRecover:false,recoveryState:"approval",recoveryTransaction:envelope};
    return route.fulfill({json:envelope});
  });
  await page.route("**/api/launches/old-launch/recovery/submit",route=>{
    submitted++;expect(route.request().postDataJSON().signedTransactionBase64).toBeTruthy();
    state={...state,recoveryState:"complete",recoveryTransaction:null,recoverySignature:"recovery-signature"};
    return route.fulfill({json:{signature:"recovery-signature"}});
  });
  await go();
  await page.getByRole("button",{name:"Get recovery quote"}).click();
  await expect(page.getByText("0.9 SOL",{exact:false})).toBeVisible();
  expect(prepared).toBe(1);expect(submitted).toBe(0);
  expect(await page.evaluate(()=>(window as any).recoveryApprovals)).toBe(0);
  await expect(page.getByRole("button",{name:"Resume launch",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Approve recovery"}).click();
  await expect(page.getByRole("heading",{name:"Funds recovered"})).toBeVisible();
  expect(submitted).toBe(1);
  expect(await page.evaluate(()=>(window as any).recoveryApprovals)).toBe(1);
  await expect(page.getByRole("button",{name:"Start a new launch"})).toBeVisible();
});
test("pending transactions prevent another approval",async({page})=>{
  const go=await setup(page,{...launchRecoveryFixture,unresolved:true});
  await go();
  await expect(page.getByRole("button",{name:"Resume launch",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Get recovery quote"})).toHaveCount(0);
});

test('dismissal survives reload for this launch without hiding a different launch',async({page})=>{
  const go=await setup(page);let candidate='old-launch';
  await page.route('**/api/launches?*',r=>r.fulfill({json:{launches:[{id:candidate,creatorWallet:wallet,status:'pool_pending',createdAt:1}]}}));
  await go();await expect(page.getByRole('region',{name:'Resume your launch'})).toBeVisible();
  await page.getByRole('button',{name:'Dismiss this launch reminder'}).click();
  await expect(page.getByRole('region',{name:'Resume your launch'})).toHaveCount(0);
  await page.reload();await expect(page.getByPlaceholder('Aqua Robotics')).toBeVisible();
  await expect(page.getByRole('region',{name:'Resume your launch'})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).recoveryApprovals)).toBe(0);
  candidate='another-launch';await page.reload();
  await expect(page.getByRole('region',{name:'Resume your launch'})).toBeVisible();
});
