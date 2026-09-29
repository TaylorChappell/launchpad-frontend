import {test,expect,type Page} from '@playwright/test';
const mint='11111111111111111111111111111111';
const history=(interval:string,currency="SOL")=>{
 const intervalSeconds=({"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400} as Record<string,number>)[interval]??300;
 const end=(Math.floor(Date.now()/1000/intervalSeconds)-2)*intervalSeconds;
 return {source:"indexed_pool_trades",currency,intervalSeconds,nextBefore:null,candles:Array.from({length:60},(_,i)=>{
  const open=.000001*(2+i*.02+Math.sin(i/3)*.25),close=open*(i%3===0?.97:1.03);
  const price={open,close,high:Math.max(open,close)*1.025,low:Math.min(open,close)*.975};
  return {time:end-(59-i)*intervalSeconds,lastSampleAt:(end-(59-i)*intervalSeconds)*1000,price,cap:Object.fromEntries(Object.entries(price).map(([k,v])=>[k,v*1e9]))};
 })};
};
async function setup(page:Page){
 await page.addInitScript(()=>localStorage.setItem('aqua:update:holder-workspace-v2','seen'));
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  let json:unknown={};
  if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',publicRpcUrl:'https://rpc.invalid',useTestnet:false,marketGovernanceEnabled:false,transactionsEnabled:false,whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
  else if(/^\/api\/launches\/[^/]+$/.test(path))json={launch:{id:path.split('/').at(-1),mint,creatorWallet:mint,name:'Ocean Club',symbol:'OCEAN',description:'A community coin.',pairType:path.includes('sol')?'sol':'stock',pairMint:mint,pairSymbol:path.includes('sol')?'SOL':path.includes('stock')?'NVDAx':'CUSTOM',stockMint:mint,stockSymbol:'SOL',stock:{mint,symbol:'SOL',name:'Solana'},rewardMode:'holder_rewards',status:'live',txCount:0,holderCount:320,devBuySol:0,rewardAccumulatedUsd:750,rewardRedeemableUsd:420,aquaIndexed:true,priceUpdatedAt:Date.now(),priceStatus:"live",priceUsd:.000003,marketCapUsd:3000,tvlUsd:2000,volume24hUsd:5000,tokenDecimals:6,totalSupplyRaw:'1000000000000000',createdAt:Date.now()},trades:[],creatorLock:null,rewardModeState:null};
  else if(path.endsWith('/trade-candles'))json=history(url.searchParams.get('interval')??'5m',path.includes('stock')?'NVDAx':path.includes('custom')?'CUSTOM':'SOL');
  else if(path.endsWith('/market-data'))json={snapshots:[]};
  else if(path==='/api/stocks')json={stocks:[]};
  else if(path==='/api/launches')json={launches:[]};
  else if(path.includes('/notifications/'))json={notifications:[]};
  else if(path.endsWith('/holdings'))json={holdings:[]};
  else if(path.endsWith('/claim-history'))json={claims:[],lifetime:[],hasMore:false};
  else if(path.includes('governance'))json={enabled:false};
  else if(path==='/api/market-prices/stream')return route.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
  else if(path==='/api/market-prices')json={prices:[]};
  return route.fulfill({json});
 });
 await page.route('https://rpc.invalid/**',route=>route.fulfill({json:{jsonrpc:'2.0',id:route.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
 await page.route('**/account/**',route=>route.fulfill({json:{enabled:false,profiles:{}}}));
}

test('TradingView candles render SOL, stock and custom coins with seamless controls',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 for(const id of ['sol','stock','custom']){
  await page.goto('/#/token/'+id);
  const chart=page.locator('#market-chart');
  await expect(chart.locator('.tradingview-canvas canvas').first()).toBeVisible();
  await expect(chart.locator('.tradingview-canvas')).toHaveAttribute('data-bars','60');
  // A newer live USD valuation must not append a candle to idle trade history.
  await expect(chart.locator('.candle-legend')).toContainText(`${id==='stock'?'NVDAx':id==='custom'?'CUSTOM':'SOL'} · 5m candles`);
  await chart.getByRole('button',{name:'Price',exact:true}).click();
  await expect(chart.locator('.candle-ohlc')).toContainText(id==='stock'?'NVDAx':id==='custom'?'CUSTOM':'SOL');
  await chart.locator('canvas').first().evaluate(el=>el.setAttribute('data-original','true'));
  await expect(chart.locator('[aria-label="Candle timeframe"] button')).toHaveText(['5m','15m','1h','4h','1d']);
  await expect(chart.getByRole('button',{name:'5m',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const frame of ['15m','1h','4h','1d']){
    await chart.getByRole('button',{name:frame,exact:true}).click();
    await expect(chart.locator('.candle-legend')).toContainText(`${id==='stock'?'NVDAx':id==='custom'?'CUSTOM':'SOL'} · ${frame} candles`);
    await expect(chart.locator('canvas').first()).toHaveAttribute('data-original','true');
  }
  await chart.getByRole('button',{name:'Reset chart view'}).click();
  await expect(chart.locator('canvas').first()).toHaveAttribute('data-original','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
 await page.locator('#market-chart').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-100));
 await page.locator('#market-chart').screenshot({path:info.outputPath('compact-tradingview-candles.png')});
 await expect(page.locator('.chart-attribution a')).toHaveAttribute('href','https://www.tradingview.com/');
 expect(errors).toEqual([]);
});

test('new coins stay empty, API failures retry and mismatched resolutions are rejected',async({page})=>{
 await setup(page);
 await page.route('**/trade-candles?*',route=>route.fulfill({json:{source:"indexed_pool_trades",currency:"SOL",intervalSeconds:300,candles:[],nextBefore:null}}));
 await page.goto('/#/token/new');
 await expect(page.getByText('No indexed trades yet.',{exact:true})).toBeVisible();
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','0');
 await page.unroute('**/trade-candles?*');
 let fail=true;
 await page.route('**/trade-candles?*',route=>fail?route.fulfill({status:400,json:{error:'Unavailable'}}):route.fulfill({json:history('5m')}));
 await page.goto('/#/token/retry');
 await expect(page.getByText("Couldn't load chart.",{exact:false})).toBeVisible();
 fail=false;
 await page.locator('#market-chart').getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','60');
 await page.unroute('**/trade-candles?*');
 await page.route('**/trade-candles?*',route=>route.fulfill({json:history('15m')}));
 await page.goto('/#/token/legacy');
 await expect(page.getByText('This timeframe needs the latest chart API.',{exact:true})).toBeVisible();
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','0');
});

test('earlier candles are available without truncating or changing the chosen resolution',async({page})=>{
 await setup(page);
 const latest=Math.floor(Date.now()/300000)*300;
 const beforeRequests:string[]=[];
 await page.route('**/trade-candles?*',route=>{
  const url=new URL(route.request().url()),before=url.searchParams.get('before');
  expect(url.searchParams.get('interval')).toBe('5m');expect(url.searchParams.has('range')).toBe(false);
  if(before)beforeRequests.push(before);
  const count=before?300:500,end=before?Number(before)-300:latest;
  const template=history('5m').candles[0];
  return route.fulfill({json:{source:"indexed_pool_trades",currency:"SOL",intervalSeconds:300,nextBefore:before?null:latest-499*300,candles:Array.from({length:count},(_,i)=>({...template,time:end-(count-1-i)*300,lastSampleAt:(end-(count-1-i)*300)*1000}))}});
 });
 await page.goto('/#/token/history');
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','500');
 await expect(page.getByRole('button',{name:'Earlier candles',exact:true})).toHaveCount(0);
 const canvas=page.locator('.tradingview-canvas canvas').first();
 await canvas.scrollIntoViewIfNeeded();
 for(let i=0;i<16&&!beforeRequests.length;i++){
  const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.7,box.y+box.height/2,{steps:12});await page.mouse.up();
  await page.waitForTimeout(80);
 }
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','800');
 expect(beforeRequests).toHaveLength(1);
 await expect(page.getByRole('button',{name:'Earlier candles',exact:true})).toHaveCount(0);
});

test('transaction header shares one row and rewards do not shift while loading',async({page},info)=>{
 await setup(page);
 await page.addInitScript(address=>{
  localStorage.setItem('aqua:wallet','phantom');sessionStorage.setItem('aqua:x-prompt:'+address,'1');
  Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){}}}});
 },mint);
 let finish:()=>void=()=>{};
 const responseReady=new Promise<void>(resolve=>{finish=resolve;});
 await page.route('**/api/rewards/*',async route=>{await responseReady;await route.fulfill({json:{rewards:[],cumulativeRewards:[],holdings:[],markets:[]}});});
 await page.goto('/#/token/sol');
 const nav=page.getByRole('tablist',{name:'Market navigation'});
 await expect(page.locator('.market-activity-header')).toBeVisible();
 for(const width of [320,390,1440]){
  if(info.project.name==='mobile'&&width!==390)continue;
  await page.setViewportSize({width,height:900});
  const boxes=await page.locator('.market-activity-header').evaluate(el=>[el.querySelector('b')!,el.querySelector('.trade-filter')!,el.querySelector('strong')!].map(item=>{const r=item.getBoundingClientRect();return {middle:r.top+r.height/2,right:r.right};}));
  expect(Math.max(...boxes.map(b=>b.middle))-Math.min(...boxes.map(b=>b.middle))).toBeLessThan(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
 await nav.getByRole('tab',{name:'Rewards',exact:true}).click();
 await expect(page.locator('.market-reward-skeleton')).toBeVisible();
 const offset=()=>page.locator('.market-reward-activity').evaluate(el=>el.getBoundingClientRect().top-document.getElementById('market-information')!.getBoundingClientRect().top);
 const before=await offset();finish();
 await expect(page.locator('.reward-scope-note')).toBeVisible();
 expect(Math.abs(await offset()-before)).toBeLessThan(1);
 await nav.getByRole('tab',{name:'Transactions',exact:true}).click();
 await expect(page.locator('.market-activity-header')).toBeVisible();
 await nav.getByRole('tab',{name:'Rewards',exact:true}).click();
 await expect(page.locator('.reward-scope-note')).toBeVisible();
 await expect(page.locator('.market-reward-skeleton')).toHaveCount(0);
 await page.locator('#market-information').screenshot({path:info.outputPath('compact-market-rewards.png')});
});
