import {test,expect,type Page} from '@playwright/test';
const mint='11111111111111111111111111111111';
const history=(range:string)=>{
 const intervalSeconds=range==='1h'?300:range==='7d'?3600:range==='all'?86400:900;
 const end=Math.floor(Date.now()/1000/intervalSeconds)*intervalSeconds;
 return {intervalSeconds,candles:Array.from({length:60},(_,i)=>{
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
  if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',transactionsEnabled:false,whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
  else if(/^\/api\/launches\/[^/]+$/.test(path))json={launch:{id:path.split('/').at(-1),mint,creatorWallet:mint,name:'Ocean Club',symbol:'OCEAN',description:'A community coin.',pairType:path.includes('sol')?'sol':'stock',pairMint:mint,pairSymbol:path.includes('sol')?'SOL':path.includes('stock')?'NVDAx':'CUSTOM',stockMint:mint,stockSymbol:'SOL',stock:{mint,symbol:'SOL',name:'Solana'},rewardMode:'holder_rewards',status:'live',txCount:0,holderCount:320,devBuySol:0,rewardAccumulatedUsd:750,rewardRedeemableUsd:420,aquaIndexed:true,priceUsd:.000003,marketCapUsd:3000,tvlUsd:2000,volume24hUsd:5000,tokenDecimals:6,totalSupplyRaw:'1000000000000000',createdAt:Date.now()},trades:[],creatorLock:null,rewardModeState:null};
  else if(path.endsWith('/usd-candles'))json=history(url.searchParams.get('range')??'24h');
  else if(path.endsWith('/market-data'))json={snapshots:[]};
  else if(path==='/api/stocks')json={stocks:[]};
  else if(path==='/api/launches')json={launches:[]};
  else if(path.includes('governance'))json={enabled:false};
  else if(path==='/api/market-prices/stream')return route.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
  else if(path==='/api/market-prices')json={prices:[]};
  return route.fulfill({json});
 });
 await page.route('**/account/**',route=>route.fulfill({json:{enabled:false,profiles:[]}}));
}

test('TradingView candles render SOL, stock and custom coins with seamless controls',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 for(const id of ['sol','stock','custom']){
  await page.goto('/#/token/'+id);
  const chart=page.locator('#market-chart');
  await expect(chart.locator('.tradingview-canvas canvas').first()).toBeVisible();
  await expect(chart.locator('.tradingview-canvas')).toHaveAttribute('data-bars','60');
  await expect(chart.locator('.candle-legend')).toContainText('USD · 15m candles');
  await chart.getByRole('button',{name:'Price',exact:true}).click();
  await expect(chart.locator('.candle-ohlc')).toContainText('$0.00000');
  await chart.locator('canvas').first().evaluate(el=>el.setAttribute('data-original','true'));
  await chart.getByRole('button',{name:'1H',exact:true}).click();
  await expect(chart.locator('.candle-legend')).toContainText('USD · 5m candles');
  await expect(chart.locator('canvas').first()).toHaveAttribute('data-original','true');
  await chart.getByRole('button',{name:'7D',exact:true}).click();
  await expect(chart.locator('.candle-legend')).toContainText('USD · 1h candles');
  await chart.getByRole('button',{name:'All time',exact:true}).click();
  await expect(chart.locator('.candle-legend')).toContainText('USD · 1d candles');
  await chart.getByRole('button',{name:'Reset chart view'}).click();
  await expect(chart.locator('canvas').first()).toHaveAttribute('data-original','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
 await page.locator('#market-chart').scrollIntoViewIfNeeded();
 await page.locator('#market-chart').screenshot({path:info.outputPath('compact-tradingview-candles.png')});
 await expect(page.locator('.chart-attribution a')).toHaveAttribute('href','https://www.tradingview.com/');
 expect(errors).toEqual([]);
});

test('new coins stay empty, API failures retry and old snapshot APIs remain compatible',async({page})=>{
 await setup(page);
 await page.route('**/usd-candles?*',route=>route.fulfill({json:{intervalSeconds:900,candles:[]}}));
 await page.goto('/#/token/new');
 await expect(page.getByText('Waiting for indexed price history.',{exact:true})).toBeVisible();
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','0');
 await page.unroute('**/usd-candles?*');
 let fail=true;
 await page.route('**/usd-candles?*',route=>fail?route.fulfill({status:400,json:{error:'Unavailable'}}):route.fulfill({json:history('24h')}));
 await page.goto('/#/token/retry');
 await expect(page.getByText("Couldn't load chart.",{exact:false})).toBeVisible();
 fail=false;
 await page.locator('#market-chart').getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('.tradingview-canvas')).toHaveAttribute('data-bars','60');
 await page.unroute('**/usd-candles?*');
 await page.route('**/usd-candles?*',route=>route.fulfill({status:404,json:{error:'Not found'}}));
 await page.route('**/market-data?*',route=>route.fulfill({json:{snapshots:Array.from({length:20},(_,i)=>({sampledAt:Date.now()-(20-i)*60000,priceUsd:1+i,fdvUsd:100000+i*1000}))}}));
 await page.goto('/#/token/legacy');
 await expect.poll(()=>page.locator('.tradingview-canvas').getAttribute('data-bars')).not.toBe('0');
 await expect(page.locator('#market-chart canvas').first()).toBeVisible();
});
