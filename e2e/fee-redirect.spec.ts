import {test,expect,type Page} from '@playwright/test';
import {mockLaunchSafety} from './fixtures/launch-safety';
const address='11111111111111111111111111111111',id='11111111-1111-4111-8111-111111111111';
const pair={symbol:'SOL',underlyingSymbol:'SOL',name:'Solana',mint:'So11111111111111111111111111111111111111112',verifiedAt:1,restricted:false,orcaTvlUsd:100000,orcaVolume24hUsd:10000};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const recipient={kind:'x',subject:'42',label:'@builder',avatarUrl:null,profileUrl:'https://x.com/i/user/42',wallet:null};
async function setup(page:Page,dark=false,wrongOwner=false){
  const calls={launches:[] as any[],resolve:[] as any[],activate:[] as any[],github:[] as any[]};let activated=false;
  await page.addInitScript(({address,dark})=>{
    localStorage.setItem('aqua:update:holder-workspace-v2','seen');localStorage.setItem('aqua:wallet','phantom');
    sessionStorage.setItem(`aqua:x-prompt:${address}`,'1');
    localStorage.setItem('aqua:theme',dark?'dark':'light');
    localStorage.setItem(`aqua:studio:${address}`,JSON.stringify({token:'a'.repeat(64),expiresAt:Date.now()+3600000}));
    (window as any).phantom={solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){}}};
  },{address,dark});
  await page.route(/\/(?:api|studio|account)\//,async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path==='/api/config')return r.fulfill({json:{brand:'AQUA',network:'mainnet-beta',transactionsEnabled:true,marketGovernanceEnabled:true,publicRpcUrl:'https://rpc.invalid',launchSettings:{variableRewardFeesEnabled:true,orcaFeeRate:10000},rewardModes:{enabled:true,jackpot:{enabled:true},feeRedirect:{enabled:true,providers:{wallet:true,x:true,github:true}}},fees:{},whirlpools:{},creatorLocks:{},sniperDefense:{supported:false}}});
    if(path==='/api/stocks')return r.fulfill({json:{stocks:[pair],refreshing:false}});
    if(path==='/api/fee-redirect/config')return r.fulfill({json:{enabled:true,providers:{wallet:true,x:true,github:true}}});
    if(path==='/account/x/config')return r.fulfill({json:{enabled:true}});
    if(path===`/studio/projects/${id}`)return r.fulfill({json:{id,name:'Tide',revision:1,state:{launch:{name:'Tide',symbol:'TIDE',description:'Supporting the people who build.',stockMint:pair.mint,rewardMode:'holder_rewards',imagePath:'assets/coin.png',xUrl:'',websiteUrl:'',telegramUrl:'',dexFundingEnabled:false,dexProfile:{description:'',bannerPath:'',bannerUrl:'',websiteUrl:'',xUrl:'',telegramUrl:''}},files:[{path:'assets/coin.png',encoding:'base64',content:png}]}}});
    if(path==='/api/uploads')return r.fulfill({json:{imageId:'artwork',imageUrl:'https://images.example.test/coin.png'}});
    if(path==='/api/fee-redirect/resolve'){
      const body=r.request().postDataJSON();calls.resolve.push(body);expect(r.request().headers().authorization).toBe('Bearer '+'a'.repeat(64));
      return r.fulfill({json:{recipient:body.kind==='wallet'?{...recipient,kind:'wallet',subject:address,label:address,profileUrl:null,wallet:address}:body.kind==='github'?{...recipient,kind:'github',subject:'78',label:'builder',profileUrl:'https://github.com/builder'}:recipient}});
    }
    if(path==='/api/launches'&&r.request().method()==='POST'){calls.launches.push(r.request().postDataJSON());return r.fulfill({status:503,json:{error:'Test launch preparation stopped'}});}
    if(path===`/api/launches/${id}`)return r.fulfill({json:{launch:{id,name:'Tide',symbol:'TIDE',mint:address,stockMint:pair.mint,stockSymbol:'SOL',stockName:'Solana',pairType:'sol',rewardMode:'fee_redirect',redirectRecipient:recipient,status:'graduated',createdAt:1,creatorWallet:address}}});
    if(path===`/api/fee-redirect/markets/${id}`)return r.fulfill({json:{redirect:{recipient:{...recipient,wallet:activated?address:null},recipientBps:5000,holderBps:5000,pending:[{mint:pair.mint,amountRaw:'250000000'}],totals:[]}}});
    if(path==='/api/fee-redirect/mine')return r.fulfill({json:{markets:[{id,name:'Tide',symbol:'TIDE',recipient}]}});
    if(path==='/api/fee-redirect/activate'){
      calls.activate.push(r.request().postDataJSON());
      if(wrongOwner)return r.fulfill({status:403,json:{error:'Connect the selected X account to this wallet first.'}});
      activated=true;return r.fulfill({json:{recipient:{...recipient,wallet:address}}});
    }
    if(path==='/account/integrations/github/connect'){calls.github.push(r.request().postDataJSON());return r.fulfill({status:503,json:{error:'Verification stopped before external sign-in'}});}
    if(path.includes('/rewards'))return r.fulfill({json:{markets:[],totals:{}}});
    return r.fulfill({json:{launches:[],notifications:[],enabled:false}});
  });
  await mockLaunchSafety(page);return calls;
}
test('launch checks the recipient, invalidates edits and sends the provider ID',async({page},info)=>{
  const calls=await setup(page,true);await page.goto(`/#/create?studio=${id}`);
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Tide');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose a trading pair',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose the reward mode',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:/Fee Redirect/}).click();
  const next=page.getByRole('button',{name:'Continue',exact:true});await expect(next).toBeDisabled();
  await page.getByRole('button',{name:'X account',exact:true}).click();
  await page.getByLabel('X handle or profile URL').fill('@builder');
  await page.getByRole('button',{name:'Check recipient',exact:true}).click();
  await expect(page.getByText('Account found · ownership required to claim')).toBeVisible();await expect(next).toBeEnabled();
  await page.getByLabel('X handle or profile URL').fill('@edited');await expect(next).toBeDisabled();
  await page.getByRole('button',{name:'Check recipient',exact:true}).click();await expect(next).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:info.outputPath('compact-redirect-dark-launch.png'),fullPage:true});
  await next.click();await expect(page.getByRole('heading',{name:'Coin settings',exact:true})).toBeVisible();await next.click();await expect(page.getByRole('heading',{name:'DEX Screener profile',exact:true})).toBeVisible();await page.getByRole('button',{name:'Skip profile details'}).click();
  await expect(page.getByText('50% to @builder · 50% to holders')).toBeVisible();
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Launch',exact:true}).click();
  await expect.poll(()=>calls.launches.length).toBe(1);
  expect(calls.launches[0]).toMatchObject({rewardMode:'fee_redirect',redirectRecipient:{kind:'x',subject:'42'}});
  expect(calls.launches[0].redirectRecipient).not.toHaveProperty('label');
});
test('wallet and GitHub recipients are selectable and returning to holders clears the payload',async({page})=>{
  const calls=await setup(page);await page.goto(`/#/create?studio=${id}`);await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Tide');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose a trading pair',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose the reward mode',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:/Fee Redirect/}).click();await page.getByLabel('Solana wallet address').fill(address);await page.getByRole('button',{name:'Check recipient',exact:true}).click();await expect(page.getByText('Wallet address checked')).toBeVisible();
  await page.getByRole('button',{name:'GitHub',exact:true}).click();await page.getByLabel('GitHub username or profile URL').fill('github.com/builder');await page.getByRole('button',{name:'Check recipient',exact:true}).click();await expect(page.getByText('Account found · ownership required to claim')).toBeVisible();
  expect(calls.resolve.map(r=>r.kind)).toEqual(['wallet','github']);
  await page.getByRole('radio',{name:/Holder Rewards/}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Coin settings',exact:true})).toBeVisible();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'DEX Screener profile',exact:true})).toBeVisible();await page.getByRole('button',{name:'Skip profile details'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Launch',exact:true}).click();
  await expect.poll(()=>calls.launches.length).toBe(1);expect(calls.launches[0].rewardMode).toBe('holder_rewards');expect(calls.launches[0]).not.toHaveProperty('redirectRecipient');
});
for(const dark of [false,true])test(`recipient activation is explicit and usable in ${dark?'dark':'light'} mode`,async({page},info)=>{
  const calls=await setup(page,dark);await page.goto(`/#/fee-redirect?market=${id}`);
  await expect(page.getByRole('heading',{name:'Activate recipient rewards'})).toBeVisible();
  const activate=page.getByRole('button',{name:'Activate payout wallet',exact:true});await expect(activate).toBeDisabled();
  await expect(page.getByText('Their share is reserved while holders keep earning.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:info.outputPath(`compact-redirect-${dark?'dark':'light'}-recipient.png`),fullPage:true});
  await page.getByRole('checkbox',{name:/fixed payout wallet/}).check();await activate.click();
  await expect(page.getByRole('heading',{name:'Your claimable rewards'})).toBeVisible();expect(calls.activate).toEqual([{kind:'x',subject:'42'}]);
  await expect(page.getByText('Your rewards will appear here when this market allocates them.')).toBeVisible();
});
test('a wrong social identity stays unclaimed and GitHub verification requests identity scope',async({page})=>{
  const calls=await setup(page,false,true);await page.goto(`/#/fee-redirect?market=${id}`);
  await page.getByRole('checkbox',{name:/fixed payout wallet/}).check();await page.getByRole('button',{name:'Activate payout wallet'}).click();
  await expect(page.getByRole('alert')).toHaveText('Connect the selected X account to this wallet first.');await expect(page.getByRole('heading',{name:'Your claimable rewards'})).toHaveCount(0);
  await page.getByRole('button',{name:'Verify GitHub'}).click();await expect.poll(()=>calls.github.length).toBe(1);expect(calls.github[0]).toEqual({purpose:'redirect'});
});
