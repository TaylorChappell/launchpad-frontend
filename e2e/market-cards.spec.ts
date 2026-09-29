import { test, expect, type Page } from '@playwright/test';

const sol='So11111111111111111111111111111111111111112';
const orca='orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE';
const mint='11111111111111111111111111111111';
const base={mint,creatorWallet:mint,name:'Aqua',symbol:'AQUA',pairType:'sol',pairMint:sol,pairSymbol:'SOL',stockMint:sol,stockSymbol:'SOL',stock:{mint:sol,symbol:'SOL',name:'Solana',logoUrl:null},rewardMode:'holder_rewards',status:'live',marketCapUsd:1800000,volume24hUsd:334900,holderCount:2800,aquaIndexed:true,tokenDecimals:6,createdAt:Date.now()-12*86400000,rewardAccumulatedUsd:94300,rewardRedeemableUsd:62600,dexPaid:true,xUrl:'https://x.com/aquafamily',telegramUrl:'https://t.me/aqua',websiteUrl:'https://aquafamily.fun',imageUrl:'/missing-token.png'};
const coins=[
  {...base,id:'aqua',latestProjectUpdateAt:Date.now()},
  {...base,id:'burn',mint:orca,name:'Ocean Burn',symbol:'BURN',pairType:'stock',pairMint:orca,pairSymbol:'ORCA',rewardMode:'buyback_burn',burnSummary:{totalSol:12.5,totalTokenRaw:'1250000000000'},dexPaid:false,dexFundingStatus:'funding'},
  {...base,id:'jackpot',mint:'jackpot',name:'Lucky Tide',symbol:'TIDE',pairType:'stock',pairMint:mint,pairSymbol:'USDC',rewardMode:'jackpot',jackpotSummary:{currentPotRaw:'12345678',rewardSymbol:'USDC',rewardDecimals:6}},
  {...base,id:'custom',mint:'custom',name:'A very long community name with a custom paired token',symbol:'VERYLONGSYMBOL',pairType:'stock',pairMint:mint,pairSymbol:'CUSTOMTOKEN',stockMint:mint,stockSymbol:'NVDAx',stock:{mint,symbol:'NVDAx',name:'Nvidia',logoUrl:null},pairLogoUrl:'/missing-pair.png',rewardAccumulatedUsd:0,rewardRedeemableUsd:null,xUrl:null,telegramUrl:null,websiteUrl:null,dexPaid:false},
  {...base,id:'new',mint:'new',name:'New launch',symbol:'NEW',aquaIndexed:false,marketCapUsd:null,volume24hUsd:null,holderCount:null,rewardAccumulatedUsd:null,rewardRedeemableUsd:null,xUrl:'javascript:alert(1)',telegramUrl:null,websiteUrl:null,dexPaid:false},
  {...base,id:'partial',mint:'partial',name:'Jackpot indexing',symbol:'JACK',rewardMode:'jackpot',jackpotSummary:{currentPotRaw:'unavailable',rewardSymbol:'SOL',rewardDecimals:9},dexPaid:false},
];

async function setup(page:Page){
  const requests:string[]=[];
  await page.addInitScript(()=>localStorage.setItem('aqua:update:holder-workspace-v2','seen'));
  await page.route('**/missing-*.png',route=>route.fulfill({status:404,body:''}));
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    let json:unknown={};
    if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',transactionsEnabled:false,whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
    else if(path==='/api/launches')json={launches:coins,hasMore:false,nextOffset:coins.length};
    else if(path==='/api/governance')json={enabled:true,governanceMint:mint,activeBonus:{mint:orca}};
    else if(path==='/api/stocks')json={stocks:[]};
    else if(path.endsWith('/market-data')){requests.push(path);json={snapshots:path.includes('/custom/')?[]:Array.from({length:24},(_,i)=>({sampledAt:Date.now()-(24-i)*3600000,priceUsd:2-i*.03+Math.sin(i)*.1}))};}
    else if(path==='/api/market-prices/stream')return route.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
    else if(path==='/api/market-prices')json={prices:[]};
    return route.fulfill({json});
  });
  await page.route('**/account/**',route=>route.fulfill({json:{enabled:false,profiles:[]}}));
  return requests;
}

test('AQUA market cards support every reward mode, pair and incomplete market data',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const requests=await setup(page);await page.goto('/#/');
  const cards=page.locator('.aqua-market-card');await expect(cards).toHaveCount(6);
  const aqua=cards.nth(0);await aqua.scrollIntoViewIfNeeded();
  await expect(aqua.locator('.card-cap > strong')).toHaveText('$1.8M');
  await expect(aqua.locator('.card-reward-total')).toHaveText('$94.3K');
  await expect(aqua.locator('.card-reward-strip')).not.toContainText(/Accumulated|Redeemable/);
  await expect(aqua.locator('.card-pair-medallion .asset-mark.solana')).toBeVisible();
  await expect(aqua.getByRole('img',{name:'24-hour price history'})).toBeVisible();
  await expect(aqua.locator('.card-trend svg path')).toHaveCount(2);
  await expect(cards.locator('.card-trend canvas')).toHaveCount(0);
  await expect(aqua.locator('.card-trend')).toHaveClass(/is-falling/);
  await expect(aqua.locator('.token-mark img')).toHaveCount(0);
  await expect(aqua.locator('.market-tag')).toHaveText('AQUA featured');
  const [bell,star]=await Promise.all([aqua.locator('.market-update-link').boundingBox(),page.getByRole('button',{name:'Watch AQUA',exact:true}).boundingBox()]);
  expect(bell!.x+bell!.width).toBeLessThanOrEqual(star!.x);
  await page.getByRole('button',{name:'Watch AQUA',exact:true}).click();
  await expect(page.getByRole('button',{name:'Remove AQUA',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page).not.toHaveURL(/token\//);
  await expect(cards.nth(1).locator('.card-reward-heading')).toContainText('Burn BURN');
  await expect(cards.nth(1).locator('.card-reward-total')).toHaveText('1.3M BURN');
  await expect(cards.nth(1).locator('.card-pair-medallion .asset-mark.orca')).toHaveCount(1);
  await expect(cards.nth(2).locator('.card-reward-heading')).toContainText('Win USDC');
  await expect(cards.nth(2).locator('.card-reward-total')).toHaveText('12.3 USDC');
  const custom=cards.nth(3);await custom.scrollIntoViewIfNeeded();
  await expect(custom.locator('.card-pair-medallion .generic-stock-mark')).toBeVisible();
  await expect(custom.locator('.card-reward-heading')).toContainText('Earn NVDAx');
  await expect(custom.locator('.card-reward-total')).toHaveText('$0');
  await expect(custom.locator('.card-trend svg')).toHaveCount(0);
  await expect(custom.locator('.market-social-links a')).toHaveCount(0);
  await expect(cards.nth(4).locator('.card-cap > strong')).toHaveText('Indexing');
  await expect(cards.nth(4).locator('.market-social-links a')).toHaveCount(0);
  await expect(cards.nth(5).locator('.card-reward-total')).toHaveText('— SOL');
  await expect(cards.getByRole('button',{name:'Copy contract address',exact:true})).toHaveCount(6);
  for(const card of [aqua,custom]){
    await expect(card.locator('.market-social-links > :last-child')).toHaveAttribute('aria-label','Copy contract address');
  }
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{Object.assign(window,{copiedContract:text});}}}));
  await aqua.getByRole('button',{name:'Copy contract address',exact:true}).click();
  expect(await page.evaluate(()=>(window as unknown as {copiedContract:string}).copiedContract)).toBe(mint);
  await custom.getByRole('button',{name:'Copy contract address',exact:true}).click();
  expect(await page.evaluate(()=>(window as unknown as {copiedContract:string}).copiedContract)).toBe('custom');
  await expect(page).not.toHaveURL(/token\//);
  expect(requests.some(path=>path.includes('/new/'))).toBe(false);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:info.outputPath('compact-card-modes.png'),fullPage:true,animations:'disabled'});
  await aqua.evaluate(el=>window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+window.scrollY-110)));
  await aqua.screenshot({path:info.outputPath('compact-aqua-card.png'),animations:'disabled'});
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard blocked');}}}));
  await aqua.getByRole('button',{name:'Copy contract address',exact:true}).click();
  await expect(page.getByText('Clipboard unavailable. Please try again.',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('cards stay contained at small phone, tablet and desktop widths',async({page},info)=>{
  test.skip(info.project.name!=='desktop','One viewport sweep covers every card.');
  await setup(page);await page.goto('/#/');
  await expect(page.locator('.aqua-market-card')).toHaveCount(6);
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    const overflow=await page.locator('.aqua-market-card').evaluateAll(cards=>cards.map(card=>({
      card:card.scrollWidth-card.clientWidth,
      content:card.querySelector('.token-card-link')!.scrollWidth-card.querySelector('.token-card-link')!.clientWidth,
      footer:card.querySelector('.card-footer')!.scrollWidth-card.querySelector('.card-footer')!.clientWidth,
    })));
    for(const result of overflow){expect(result.card,`${width}px card`).toBeLessThanOrEqual(1);expect(result.content,`${width}px content`).toBeLessThanOrEqual(1);expect(result.footer,`${width}px footer`).toBeLessThanOrEqual(1);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});
