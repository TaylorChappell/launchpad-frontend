import { test, expect, type Page } from '@playwright/test';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const address='11111111111111111111111111111111',other='So11111111111111111111111111111111111111112';
const id='11111111-1111-4111-8111-111111111111',state='c'.repeat(64),receipt='d'.repeat(64);
type Options={guest?:boolean;dark?:boolean;kind?:'x'|'github'|'wallet';linked?:boolean;activated?:boolean;wrongWallet?:boolean;reject?:boolean;pending?:boolean;empty?:boolean};
async function setup(page:Page,o:Options={}){
  let linked=o.linked??true,activated=o.activated??false,paid=false;
  const calls={activate:[] as unknown[],confirmed:0,prepared:0,complete:0};
  const kind=o.kind??'github';
  const target={kind,subject:kind==='wallet'?address:'42',label:kind==='wallet'?address:kind==='x'?'@builder':'builder',avatarUrl:null,profileUrl:kind==='wallet'?null:kind==='x'?'https://x.com/i/user/42':'https://github.com/builder'};
  const recipient=()=>({...target,wallet:o.wrongWallet?other:kind==='wallet'||activated?address:null});
  const launch=()=>({id,name:'Tide',symbol:'TIDE',mint:address,stockMint:other,stockSymbol:'SOL',stockName:'Solana',pairType:'sol',pairSymbol:'SOL',pairMint:other,rewardMode:'fee_redirect',redirectRecipient:target,redirectClaimed:paid,status:'live',createdAt:1,creatorWallet:address,aquaIndexed:true,marketCapUsd:20000,volume24hUsd:5000,holderCount:42,tvlUsd:1000,change24h:2,tokenDecimals:6});
  const profile=()=>({id:linked?'42':'99',username:linked?'builder':'someone_else',name:'Builder',avatarUrl:null,profileUrl:'https://x.com/builder',connectedAt:1,updatedAt:1});
  const tx=new Transaction({feePayer:new PublicKey(address),recentBlockhash:address}).add(SystemProgram.transfer({fromPubkey:new PublicKey(address),toPubkey:new PublicKey(address),lamports:1}));
  const transactionBase64=tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');
  await page.addInitScript(({address,o})=>{
    localStorage.setItem('aqua:update:holder-workspace-v2','seen');localStorage.setItem('aqua:theme',o.dark?'dark':'light');
    if(!o.guest){localStorage.setItem('aqua:wallet','phantom');sessionStorage.setItem('aqua:x-prompt:'+address,'1');localStorage.setItem('aqua:studio:'+address,JSON.stringify({token:'a'.repeat(64),expiresAt:Date.now()+3600000}));
      (window as any).phantom={solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),disconnect:async()=>{},on(){},removeListener(){},signMessage:async()=>({signature:new Uint8Array(64)}),signAndSendTransaction:async()=>{if(o.reject)throw Error('User rejected the request');return {signature:'recipient-test-signature'};}}};}
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as any).copiedClaimLink=value;}}});
  },{address,o});
  await page.route('**/v1/wallets/x?*',r=>r.fulfill({json:{profiles:kind==='x'?{[address]:profile()}:{}}}));
  await page.route(/\/(?:api|account|studio)\//,async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path==='/api/config')return r.fulfill({json:{brand:'AQUA',network:'mainnet-beta',transactionsEnabled:true,publicRpcUrl:'https://rpc.invalid',marketGovernanceEnabled:false,fees:{},whirlpools:{},creatorLocks:{},sniperDefense:{supported:false},rewardModes:{enabled:true,feeRedirect:{enabled:true,providers:{wallet:true,x:true,github:true}}}}});
    if(path==='/account/x/config')return r.fulfill({json:{enabled:true}});
    if(path==='/api/fee-redirect/config')return r.fulfill({json:{enabled:true,providers:{wallet:true,x:true,github:true}}});
    if(path===`/api/launches/${id}`)return r.fulfill({json:{launch:launch(),trades:[]}});
    if(path==='/api/launches')return r.fulfill({json:{launches:[launch()],hasMore:false}});
    if(path===`/api/fee-redirect/markets/${id}`)return r.fulfill({json:{redirect:{recipient:recipient(),claimed:paid,recipientBps:5000,holderBps:5000,pending:[],totals:[{mint:other,symbol:'SOL',decimals:9,allocatedRaw:'1000000000',claimableRaw:paid?'0':'1000000000',claimedRaw:paid?'1000000000':'0'}]}}});
    if(path==='/api/fee-redirect/mine')return r.fulfill({json:{markets:[{id,name:'Tide',symbol:'TIDE',recipient:recipient()}]}});
    if(path==='/api/fee-redirect/activate'){calls.activate.push(r.request().postDataJSON());expect(r.request().headers().authorization).toBe('Bearer '+'a'.repeat(64));activated=true;return r.fulfill({json:{recipient:recipient()}});}
    if(path==='/account/integrations/github/identity')return r.fulfill({json:{enabled:true,connected:linked,accounts:linked?[{id:'42',login:'builder'}]:[{id:'99',login:'someone_else'}]}});
    if(path==='/account/integrations/github/connect')return r.fulfill({json:{state,url:`http://127.0.0.1:4173/#/fee-redirect?github=callback&state=${state}&code=test-code`}});
    if(path==='/account/integrations/github/complete'){calls.complete++;expect(r.request().postDataJSON()).toEqual({state,code:'test-code'});linked=true;return r.fulfill({json:{connected:true}});}
    if(path==='/account/x/connect')return r.fulfill({json:{state,url:`http://127.0.0.1:4173/#/connect-x?state=${state}&receipt=${receipt}`}});
    if(path==='/account/x/complete'){calls.complete++;linked=true;return r.fulfill({json:{profile:profile()}});}
    if(path===`/api/rewards/${address}`)return r.fulfill({json:{rewards:[{launchId:id,distributionMode:'redirect'}],holdings:[],markets:paid||o.empty?[]:[{launchId:id,balanceRaw:'0',claimMode:'cumulative',claimSequence:'1',claimableEpochIds:[],grossRedeemableUsdCents:2000,pendingUsdCents:0,estimatedClaimFeeLamports:'5000',estimatedClaimFeeUsdCents:1,netClaimableUsdCents:1999,minimumClaimUsdCents:500,canClaim:true,claimableUsdCents:2000,accumulatingUsdCents:0}]}});
    if(path===`/api/rewards/markets/${id}/claim-transaction`){calls.prepared++;return r.fulfill({json:{transactionBase64,transactionVersion:'legacy',lastValidBlockHeight:100,sequence:'1'}});}
    if(path===`/api/rewards/markets/${id}/confirm`){calls.confirmed++;if(o.pending&&calls.confirmed===1)return r.fulfill({status:409,json:{error:'Confirmation is pending'}});paid=true;return r.fulfill({json:{amountRaw:'1000000000',stockDecimals:9,stockSymbol:'SOL'}});}
    if(path.endsWith('/holdings'))return r.fulfill({json:{holdings:[]}});
    if(path.endsWith('/claim-history'))return r.fulfill({json:{claims:[],lifetime:[],hasMore:false}});
    if(path==='/api/market-prices/stream')return r.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
    return r.fulfill({json:{launches:[],stocks:[],notifications:[],prices:[],markets:[],enabled:false}});
  });
  await page.route('https://rpc.invalid/**',r=>r.fulfill({json:{jsonrpc:'2.0',id:r.request().postDataJSON().id,result:{context:{slot:1},value:[{slot:1,confirmations:1,err:null,confirmationStatus:'confirmed'}]}}}));
  return calls;
}

for(const dark of [false,true])test(`guest device and Phantom guide stay clear in ${dark?'dark':'light'} mode`,async({page},info)=>{
  await setup(page,{guest:true,dark});await page.goto(`/#/claim-redirect/${id}`);
  await expect(page.getByRole('heading',{name:'Rewards for builder.'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`compact-recipient-${dark?'dark':'light'}-welcome.png`),fullPage:true});
  await page.getByRole('button',{name:/Desktop/}).click();await page.getByRole('button',{name:'I don’t have a wallet'}).click();
  await expect(page.getByRole('link',{name:'Install the browser extension'})).toHaveAttribute('href','https://phantom.com/download');
  await expect(page.getByText('Choose Google or Apple in Phantom and finish setup.')).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Change device'}).click();
  await page.getByRole('button',{name:/Mobile/}).click();await page.getByRole('button',{name:'I don’t have a wallet'}).click();
  const url=await page.getByRole('link',{name:'Open in Phantom',exact:true}).getAttribute('href');
  expect(decodeURIComponent(url!)).toContain(`#/claim-redirect/${id}?device=mobile`);
  await expect(page.getByRole('link',{name:'Install the mobile app'})).toHaveAttribute('href','https://phantom.com/download');
  await page.screenshot({path:info.outputPath(`compact-recipient-${dark?'dark':'light'}-phantom.png`),fullPage:true});
});
for(const kind of ['github','x'] as const)test(`${kind} callback returns to the claim flow and requires explicit activation`,async({page},info)=>{
  const calls=await setup(page,{kind,linked:false,dark:true});await page.goto(`/#/claim-redirect/${id}?device=mobile`);
  await expect(page.getByRole('heading',{name:'One quick connection.'})).toBeVisible();
  await page.getByRole('button',{name:`Connect ${kind==='github'?'GitHub':'X'}`,exact:true}).click();
  await expect(page.getByRole('heading',{name:'That’s you.'})).toBeVisible();await expect(page).toHaveURL(new RegExp(`/claim-redirect/${id}\\?device=mobile`));
  expect(calls.complete).toBe(1);expect(calls.activate).toHaveLength(0);
  const activate=page.getByRole('button',{name:'Use this payout wallet'});await expect(activate).toBeDisabled();
  await page.screenshot({path:info.outputPath(`compact-recipient-${kind}-activation.png`),fullPage:true});
  await page.getByRole('checkbox').check();await activate.click();
  await expect(page.getByRole('heading',{name:'Your rewards are here.'})).toBeVisible();expect(calls.activate).toEqual([{kind,subject:'42'}]);
});
test('direct wallet recipients skip social sign-in, claim once and earn a public badge',async({page},info)=>{
  const calls=await setup(page,{kind:'wallet',dark:true});await page.goto(`/#/claim-redirect/${id}`);
  await expect(page.getByRole('heading',{name:'Your rewards are here.'})).toBeVisible();
  await expect(page.getByText('Tap Claim, then approve the prompt in your wallet.')).toBeVisible();
  await page.screenshot({path:info.outputPath('compact-recipient-claim.png'),fullPage:true});
  await page.getByRole('button',{name:'Claim',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nice. Rewards received.'})).toBeVisible();await expect(page.getByText('1 SOL claimed',{exact:true})).toBeVisible();
  expect(calls.prepared).toBe(1);expect(calls.confirmed).toBe(1);expect(calls.activate).toHaveLength(0);
  await page.screenshot({path:info.outputPath('compact-recipient-success.png'),fullPage:true});
  await page.goto('/#/');await expect(page.getByText('Recipient claimed',{exact:true})).toBeVisible();
});
test('wrong payout wallet cannot activate or claim',async({page})=>{
  const calls=await setup(page,{wrongWallet:true});await page.goto(`/#/claim-redirect/${id}`);
  await expect(page.getByRole('heading',{name:'Switch to the payout wallet.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Claim',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Use this payout wallet'})).toHaveCount(0);
  expect(calls.prepared).toBe(0);expect(calls.activate).toHaveLength(0);
});
test('wallet cancellation never shows a claimed state or badge',async({page})=>{
  const calls=await setup(page,{activated:true,reject:true});await page.goto(`/#/claim-redirect/${id}`);await page.getByRole('button',{name:'Claim',exact:true}).click();
  await expect(page.locator('.danger-note')).toBeVisible();await expect(page.getByRole('heading',{name:'Nice. Rewards received.'})).toHaveCount(0);expect(calls.confirmed).toBe(0);
  await page.goto('/#/');await expect(page.locator('.token-card')).toBeVisible();await expect(page.getByText('Recipient claimed',{exact:true})).toHaveCount(0);
});
test('pending confirmation survives refresh and retries without another claim transaction',async({page})=>{
  const calls=await setup(page,{activated:true,pending:true});await page.goto(`/#/claim-redirect/${id}`);await page.getByRole('button',{name:'Claim',exact:true}).click();
  await expect(page.getByRole('button',{name:'Check confirmation'})).toBeVisible();await expect(page.getByRole('heading',{name:'Nice. Rewards received.'})).toHaveCount(0);
  await page.reload();await page.getByRole('button',{name:'Check confirmation'}).click();
  await expect(page.getByRole('heading',{name:'Nice. Rewards received.'})).toBeVisible();expect(calls.prepared).toBe(1);expect(calls.confirmed).toBe(2);
});
test('linked non-holders discover and claim redirects from the Rewards tab',async({page})=>{
  const calls=await setup(page,{activated:true});await page.goto('/#/portfolio?tab=rewards');
  await expect(page.getByRole('region',{name:'Redirected rewards'})).toContainText('Tide');
  await expect(page.getByText('Redirect + holder rewards · Ready to claim')).toBeVisible();
  await page.getByRole('button',{name:'Claim',exact:true}).click();await expect.poll(()=>calls.confirmed).toBe(1);
});
test('unactivated account rewards appear in Rewards and the coin panel copies the guided link',async({page})=>{
  await setup(page);await page.goto('/#/portfolio?tab=rewards');await page.getByRole('link',{name:/Tide.*Set up & claim/}).click();
  await expect(page.getByRole('heading',{name:'That’s you.'})).toBeVisible();
  await page.goto(`/#/fee-redirect?market=${id}`);await page.getByRole('button',{name:'Copy claim link'}).click();
  await expect(page.getByRole('button',{name:'Claim link copied'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).copiedClaimLink)).toBe(`http://127.0.0.1:4173/#/claim-redirect/${id}`);
});
test('an empty settled balance cannot submit a claim',async({page})=>{
  const calls=await setup(page,{activated:true,empty:true});await page.goto(`/#/claim-redirect/${id}`);
  await expect(page.getByText('Your rewards will appear here when this market allocates them.')).toBeVisible();await expect(page.getByRole('button',{name:'Claim',exact:true})).toHaveCount(0);expect(calls.prepared).toBe(0);
});
