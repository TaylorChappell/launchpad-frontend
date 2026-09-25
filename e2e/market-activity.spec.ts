import { test, expect, type Page } from '@playwright/test';

const mint='11111111111111111111111111111111';
async function setup(page:Page) {
  const now=Date.now();
  const state={ comment:{id:'00000000-0000-4000-8000-000000000001',createdAt:now-1000}, failComments:false, updateAt:now-2000 };
  const launch=()=>({id:'coin',mint,creatorWallet:mint,name:'Ocean Club',symbol:'OCEAN',description:'A community building together.',
    stockMint:mint,stockSymbol:'ORCA',stockName:'Custom Orca',stock:{mint,symbol:'ORCA',name:'Custom Orca',logoUrl:`/api/pair-icons/${mint}`},
    pairMint:mint,pairType:'stock',pairSymbol:'ORCA',pairLogoUrl:`/api/pair-icons/${mint}`,rewardMode:'holder_rewards',status:'live',txCount:0,
    marketCapUsd:124000,tvlUsd:21000,volume24hUsd:54000,change24h:12,holderCount:320,aquaIndexed:true,totalSupplyRaw:'1000000000',tokenDecimals:6,
    createdAt:now,launchedAt:Math.floor(now/1000),devBuySol:0,rewardAccumulatedUsd:750,rewardRedeemableUsd:420,
    latestProjectUpdateAt:state.updateAt,latestComment:state.comment});
  await page.addInitScript(()=>localStorage.setItem('aqua:update:holder-workspace-v2','seen'));
  await page.route('**/api/**', async r=>{
    const url=new URL(r.request().url()); const path=url.pathname;
    let json:any={};
    if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
    else if(path==='/api/launches')json={launches:[launch(),{...launch(),id:'old',name:'Older market',latestProjectUpdateAt:now-3601000}],hasMore:false,nextOffset:2};
    else if(path==='/api/launches/coin')json={launch:launch(),trades:[],creatorLock:null,rewardModeState:null};
    else if(path.endsWith('/market-data'))json={snapshots:[]};
    else if(path.endsWith('/project-updates'))json={updates:[{id:'update',launchId:'coin',authorWallet:mint,createdAt:state.updateAt,body:'Our new website is live.'}],hasMore:false};
    else if(path.endsWith('/community')){if(state.failComments)return r.fulfill({status:503,json:{error:'Temporarily unavailable'}});json={posts:url.searchParams.get('filter')==='updates'?[{id:'update',kind:'update',launchId:'coin',authorWallet:mint,createdAt:state.updateAt,body:'Our new website is live.',reactions:[]}]:[{...state.comment,kind:'message',launchId:'coin',authorWallet:mint,body:'Excited for the next release.',reply:null,reactions:[]}],pinned:null,latest:state.comment,nextCursor:null};}
    else if(path==='/api/stocks')json={stocks:[]};
    else if(path.includes('/governance'))json={enabled:false};
    else if(path.includes('/notifications'))json={notifications:[]};
    else if(path==='/api/market-prices/stream')return r.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
    else if(path==='/api/market-prices')json={prices:[]};
    else if(path.startsWith('/api/pair-icons/'))return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="16" fill="#12a5bb"/><circle cx="16" cy="16" r="8" fill="white"/></svg>'});
    return r.fulfill({json});
  });
  await page.route('**/account/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
  return state;
}

test('community replaces comments; details and position sit under trading; comments track unread across visits',async({page},info)=>{
  const state=await setup(page);
  await page.goto('/#/token/coin');
  const tabs=page.locator('.market-information-tabs');
  await expect(tabs.getByRole('button',{name:'Updates',exact:true})).toHaveCount(0);
  await expect(tabs.getByRole('button',{name:'Your position',exact:true})).toHaveCount(0);
  await expect(tabs.locator('.market-unread-dot')).toBeVisible();
  await page.getByRole('button',{name:'More details',exact:true}).click();
  await expect(page.getByText('Our new website is live.')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'About Ocean Club'})).toBeVisible();
  await page.getByRole('button',{name:'Close details',exact:true}).click();
  const position=page.locator('.market-position-dropdown');
  await expect(position.locator('.market-position')).toHaveCount(0);
  const tradeSelector=info.project.name==='mobile'?'.market-trade-actions':'.trade-card';
  expect(await position.evaluate(el=>el.previousElementSibling?.matches('.market-more-details'))).toBe(true);
  // Measure both boxes in the same frame while section navigation may animate.
  const [tradeBox,positionBox]=await page.evaluate(tradeSelector=>[tradeSelector,'.market-position-dropdown'].map(selector=>{
    const {y,height}=document.querySelector(selector)!.getBoundingClientRect();return {y,height};
  }),tradeSelector);
  expect(positionBox!.y).toBeGreaterThanOrEqual(tradeBox!.y+tradeBox!.height-1);
  expect(positionBox!.y-(tradeBox!.y+tradeBox!.height)).toBeLessThan(100);
  await position.locator('summary').click();
  await expect(position.getByRole('button',{name:'Connect wallet'})).toBeVisible();
  await position.locator('summary').click();
  await expect(position.locator('.market-position')).toHaveCount(0);
  state.failComments=true;
  await tabs.getByRole('button',{name:/^Community/}).click();
  await expect(page.locator('.community')).toContainText('Temporarily unavailable');
  await expect(tabs.locator('.market-unread-dot')).toBeVisible();
  state.failComments=false;
  await page.getByRole('button',{name:'Refresh community'}).click();
  await expect(page.getByText('Excited for the next release.')).toBeVisible();
  await expect(tabs.locator('.market-unread-dot')).toHaveCount(0);
  await page.reload();
  await expect(tabs).toBeVisible();
  await expect(tabs.locator('.market-unread-dot')).toHaveCount(0);
  state.comment={id:'00000000-0000-4000-8000-000000000002',createdAt:Date.now()};
  await page.reload();
  await expect(tabs.locator('.market-unread-dot')).toBeVisible();
  await tabs.getByRole('button',{name:'Transactions',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`/tmp/market-ux-${info.project.name}.png`,fullPage:true});
});

test('market bells link to Community in cards and table; exact custom icon wins over preset symbol',async({page},info)=>{
  await setup(page);
  await page.goto('/#/');
  const card=page.locator('.token-card').first();
  await expect(card.getByRole('link',{name:'Read new project update'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Read new project update'})).toHaveCount(1);
  await expect(card.locator('.asset-mark img')).toHaveAttribute('src',new RegExp(`/api/pair-icons/${mint}$`));
  await expect(card.locator('.asset-mark.orca')).toHaveCount(0);
  await card.getByRole('link',{name:'Read new project update'}).click();
  await expect(page.getByText('Our new website is live.')).toBeVisible();
  await page.goto('/#/?view=table');
  await expect(page.locator('.market-table').getByRole('link',{name:'Read new project update'})).toHaveCount(1);
  await page.locator('.market-table').getByRole('link',{name:'Read new project update'}).click();
  await expect(page.getByText('Our new website is live.')).toBeVisible();
  await page.goto('/#/');
  await expect(page.locator('.token-card')).toHaveCount(2);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`/tmp/market-ux-cards-${info.project.name}.png`,fullPage:true});
});

test('announcement bell expires after one hour without a reload',async({page})=>{
  const state=await setup(page); state.updateAt=Date.now()-3_590_000;
  await page.clock.install();
  await page.goto('/#/');
  await expect(page.getByRole('link',{name:'Read new project update'})).toHaveCount(1);
  await page.clock.fastForward(11000);
  await expect(page.getByRole('link',{name:'Read new project update'})).toHaveCount(0);
});
