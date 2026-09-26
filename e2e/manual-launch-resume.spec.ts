import { test, expect, type Page } from '@playwright/test';
import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

const wallet='11111111111111111111111111111111';
async function setup(page:Page,listed=true,retryBatch=false) {
  const calls={status:0,retry:0,create:0,sends:0};
  await page.addInitScript(wallet=>{
    localStorage.setItem('aqua:update:holder-workspace-v2','seen');
    localStorage.setItem('aqua:wallet','phantom');
    localStorage.setItem(`aqua:launch-relay:mainnet-beta:${wallet}`,'old-launch');
    localStorage.setItem(`aqua:studio:${wallet}`,JSON.stringify({token:'a'.repeat(64),expiresAt:Date.now()+3600000}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>wallet}}),on(){},removeListener(){},
      signAllTransactions:async()=>{throw Error('Unexpected wallet approval');},signAndSendTransaction:async()=>{throw Error('Unexpected wallet approval');}}}});
  },wallet);
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname;
    let json:any={};
    if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',useTestnet:false,transactionsEnabled:true,marketGovernanceEnabled:false,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
    else if(path==='/api/stocks')json={refreshing:false,stocks:[{symbol:'SOL',underlyingSymbol:'SOL',name:'Solana',mint:'So11111111111111111111111111111111111111112',verifiedAt:1,restricted:false,orcaTvlUsd:100000,orcaVolume24hUsd:10000}]};
    else if(path==='/api/launches' && r.request().method()==='GET')json={launches:listed?[{id:'old-launch',symbol:'OLD',name:'Previous coin',creatorWallet:wallet,status:'pool_pending'}]:[],hasMore:false};
    else if(path==='/api/launches' && r.request().method()==='POST'){calls.create++;return r.fulfill({status:503,json:{error:'New launch preparation unavailable'}});}
    else if(path==='/api/uploads')json={imageId:'artwork'};
    else if(path.endsWith('/submission')){calls.status++;json={launchId:'old-launch',status:'needs_approval',error:'Previous launch stopped'};}
    else if(path.endsWith('/retry-transaction')){calls.retry++;
      if(retryBatch)return r.fulfill({json:{launchId:'old-launch',batch:[{step:'pool',transactionVersion:0,lastValidBlockHeight:100,
        transactionBase64:Buffer.from(new VersionedTransaction(new TransactionMessage({payerKey:new PublicKey(wallet),recentBlockhash:wallet,instructions:[]}).compileToV0Message()).serialize()).toString('base64')}]}});
      return r.fulfill({status:409,json:{error:'Signed transaction does not match the issued launch step'}});}
    else if(path.includes('/submit')){calls.sends++;return r.fulfill({status:400,json:{error:'Unexpected submission'}});}
    else if(path.includes('/governance'))json={enabled:false};
    else if(path.includes('/notifications'))json={notifications:[]};
    return r.fulfill({json});
  });
  await page.route('**/account/**',r=>r.fulfill({json:{enabled:false}}));
  return calls;
}

for(const listed of [true,false]) test(`saved launch waits for Resume with ${listed?'listed':'local-only'} recovery, including after refresh`,async({page})=>{
  const calls=await setup(page,listed);
  await page.clock.install();
  await page.goto('/#/create');
  await expect(page.getByRole('button',{name:'Resume launch',exact:true})).toBeVisible();
  await page.clock.fastForward(60000);
  expect(calls).toEqual({status:0,retry:0,create:0,sends:0});
  await expect(page.getByText('Launch stopped',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Resume launch',exact:true}).click();
  await expect(page.getByText('Signed transaction does not match the issued launch step')).toBeVisible();
  expect(calls.status).toBe(1);expect(calls.retry).toBe(1);
  await page.clock.fastForward(60000);
  expect(calls.retry).toBe(1);expect(calls.status).toBe(1);
  await page.reload();
  await expect(page.getByRole('button',{name:'Resume launch',exact:true})).toBeVisible();
  await page.clock.fastForward(60000);
  expect(calls.retry).toBe(1);expect(calls.status).toBe(1);
});

test('Launch starts a new attempt instead of retrying the failed launch',async({page})=>{
  const calls=await setup(page,true,true);
  await page.goto('/#/create');
  await page.getByRole('button',{name:'Resume launch',exact:true}).click();
  await expect(page.getByText('The wallet could not complete this transaction. Nothing was submitted.')).toBeVisible();
  await page.getByPlaceholder('Aqua Robotics').fill('New coin');
  await page.getByPlaceholder('AQR').fill('NEW');
  await page.locator('input[type="file"]').setInputFiles({name:'art.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Launch',exact:true}).click();
  await expect(page.getByText('New launch preparation unavailable')).toBeVisible();
  expect(calls).toEqual({status:1,retry:1,create:1,sends:0});
});
