import { test, expect, type Page } from '@playwright/test';
import { PublicKey, Transaction, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
const address='11111111111111111111111111111111';
async function setup(page:Page,reject=false,late=false) {
 await page.route('**/wallet-harness',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module">import R from "/@react-refresh";R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/e2e/fixtures/wallet-harness.tsx"></script>'}));
 await page.route('**/api/config',r=>r.fulfill({json:{network:'mainnet-beta',publicRpcUrl:'https://rpc.invalid'}}));
 await page.route('**/account/auth/challenge',r=>r.fulfill({json:{id:'login',message:'AQUA login proof'}}));
 await page.route('**/account/auth/session',r=>{expect(r.request().postDataJSON()).toEqual({id:'login',wallet:address,signature:Buffer.alloc(64,7).toString('base64')});return r.fulfill({json:{token:'a'.repeat(64),expiresAt:Date.now()+3600000}});});
 await page.route('**/account/sign-out',r=>r.fulfill({json:{}}));
 await page.route('https://rpc.invalid/**',r=>r.fulfill({json:{jsonrpc:'2.0',id:r.request().postDataJSON().id,result:{context:{slot:1},value:[{slot:1,confirmations:1,err:null,confirmationStatus:'confirmed'}]}}}));
 await page.addInitScript(({address,reject,late})=>{
  const account={address,publicKey:new Uint8Array(32),chains:['solana:mainnet','solana:devnet'],features:['solana:signMessage','solana:signTransaction','solana:signAndSendTransaction']};
  const calls={connects:0,messages:[] as string[],batches:[] as number[],chains:[] as string[],disconnects:0};
  const listeners=new Set<(data:any)=>void>();
  const wallet={name:'Jupiter',version:'1.0.0',icon:'data:image/svg+xml,<svg/>',chains:account.chains,accounts:localStorage.getItem('jupiter-trusted')?[account]:[],features:{
   'standard:connect':{version:'1.0.0',connect:async()=>{calls.connects++;wallet.accounts=[account];localStorage.setItem('jupiter-trusted','yes');return {accounts:wallet.accounts};}},
   'standard:disconnect':{version:'1.0.0',disconnect:async()=>{calls.disconnects++;wallet.accounts=[];localStorage.removeItem('jupiter-trusted');}},
   'standard:events':{version:'1.0.0',on:(_:string,fn:(d:any)=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);}},
   'solana:signMessage':{version:'1.0.0',signMessage:async(input:any)=>{calls.messages.push(new TextDecoder().decode(input.message));if(reject)throw Error('User rejected the request');return [{signature:new Uint8Array(64).fill(7)}];}},
   'solana:signTransaction':{version:'1.0.0',signTransaction:async(...inputs:any[])=>{calls.batches.push(inputs.length);calls.chains.push(...inputs.map(i=>i.chain));return inputs.map(i=>({signedTransaction:i.transaction}));}},
   'solana:signAndSendTransaction':{version:'1.0.0',signAndSendTransaction:async(input:any)=>{calls.chains.push(input.chain);return [{signature:new Uint8Array(64).fill(8)}];}}
  }};
  const register=(api:any)=>api.register(wallet);
  if(!late)window.addEventListener('wallet-standard:app-ready',(e:any)=>register(e.detail));
  Object.assign(window,{jupiterCalls:calls,injectJupiter:()=>window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet',{detail:register})),changeJupiter:(address:string|null)=>{wallet.accounts=address?[{...account,address}]:[];listeners.forEach(fn=>fn({accounts:wallet.accounts}));}});
 },{address,reject,late});
 await page.goto('/wallet-harness');
}
test('Jupiter is last, authenticates, signs legacy/v0, restores and handles account changes',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
 await expect(page.locator('.wallet-row').last()).toContainText('Jupiter');
 await page.getByRole('button',{name:/Jupiter.*Detected.*Connect/}).click();await expect(page.getByTestId('address')).toHaveText(address);
 const payer=new PublicKey(address),ix=SystemProgram.transfer({fromPubkey:payer,toPubkey:payer,lamports:1});
 const v0=new VersionedTransaction(new TransactionMessage({payerKey:payer,recentBlockhash:address,instructions:[ix]}).compileToV0Message());
 const legacy=new Transaction({feePayer:payer,recentBlockhash:address}).add(ix);
 const envelopes=[{step:'pool',transactionVersion:0,transactionBase64:Buffer.from(v0.serialize()).toString('base64'),lastValidBlockHeight:100},{step:'liquidity',transactionBase64:Buffer.from(legacy.serialize({requireAllSignatures:false,verifySignatures:false})).toString('base64'),lastValidBlockHeight:100}];
 const result=await page.evaluate(async envelopes=>{const w=(window as any).testWallet;return {signed:await w.signTransactionBatch(envelopes),sent:await Promise.all(envelopes.map(e=>w.sendTransaction(e))),proof:await w.signMessage('Vote proof')};},envelopes);
 expect(result.signed.map((e:any)=>e.signedTransactionBase64)).toEqual(envelopes.map(e=>e.transactionBase64));
 expect(result.sent).toEqual([bs58.encode(new Uint8Array(64).fill(8)),bs58.encode(new Uint8Array(64).fill(8))]);
 expect(result.proof.signature).toBe(Buffer.alloc(64,7).toString('base64'));
 expect(await page.evaluate(()=>(window as any).jupiterCalls.chains)).toEqual(Array(4).fill('solana:mainnet'));
 await page.reload();await expect(page.getByTestId('address')).toHaveText(address);
 expect(await page.evaluate(()=>(window as any).jupiterCalls.connects)).toBe(0);
 expect(await page.evaluate(()=>(window as any).jupiterCalls.messages)).toEqual([]);
 await page.evaluate(()=>(window as any).changeJupiter('So11111111111111111111111111111111111111112'));await expect(page.getByTestId('address')).toHaveText('So11111111111111111111111111111111111111112');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByTestId('address')).toHaveText('Disconnected');
 expect(await page.evaluate(()=>localStorage.getItem('aqua:wallet'))).toBeNull();
 expect(await page.evaluate(()=>(window as any).jupiterCalls.disconnects)).toBe(1);
});
test('late Jupiter discovery works and rejected login stays disconnected',async({page})=>{
 await setup(page,true,true);await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await expect(page.locator('.wallet-row').last()).toContainText('Install required');
 await page.evaluate(()=>(window as any).injectJupiter());await page.getByRole('button',{name:/Jupiter.*Detected.*Connect/}).click();
 await expect(page.getByText('User rejected the request')).toBeVisible();await expect(page.getByTestId('address')).toHaveText('Disconnected');
 expect(await page.evaluate(()=>localStorage.getItem('aqua:wallet'))).toBeNull();
});
