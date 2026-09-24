import {test,expect,type Page} from '@playwright/test';
const address='11111111111111111111111111111111';
async function setup(page:Page,opts:{guest?:boolean;eligible?:boolean;empty?:boolean;disabled?:boolean}={}){
 await page.addInitScript(({address,guest})=>{
  localStorage.setItem('aqua:update:holder-workspace-v2','seen');
  if(!guest){localStorage.setItem('aqua:wallet','phantom');Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>address},connect:async()=>({publicKey:{toString:()=>address}}),on(){},removeListener(){},signMessage:async()=>{if((window as any).rejectVote)throw Error('Approval cancelled');return {signature:new Uint8Array(64).fill(1)};}}}});}
 },{address,guest:opts.guest});
 const names=['Ocean Club','Moon Jelly','Coral Cat','Sea Dog','Bubble Boy','Bluefin','Manta','Tide Rider','Octo','Lagoon','Reef','Blue Whale'];
 const coins=names.map((name,i)=>({launchId:'coin-'+i,mint:'mint-'+i,name,symbol:['OCEAN','JELLY','CORAL','SEADOG','BUBBLE','BLUEFIN','MANTA','TIDE','OCTO','LAGOON','REEF','WHALE'][i],imageId:'image-'+i,rewardMode:'holder_rewards',rank:i+1,votingPowerRaw:String((12-i)*1230000000000),voters:70-i*5}));
 const outsider={launchId:'outsider',mint:'outsider-mint',name:'Hidden Treasure',symbol:'GOLD',imageId:null,rewardMode:'holder_rewards'};
 const now=Math.floor(Date.now()/1000);
 const data:any={enabled:!opts.disabled,reason:'Voting is paused for maintenance.',governanceMint:'AQUA',totalSupplyRaw:'1000000000000000',decimals:6,minimumHoldingBps:10,bonusBps:1000,votingOpen:true,round:{id:'today',startsAt:now-300,endsAt:now+3600},leaders:opts.empty?[]:coins,wallet:opts.guest?null:{eligible:opts.eligible!==false,votingPowerRaw:'2300000000000',currentBalanceRaw:'2300000000000',averageBalanceRaw:'2300000000000',vote:null},activeBonus:coins[2]&&{...coins[2],endsAt:now+3600},previousWinner:null};
 const state={data,calls:[] as any[],fail:false,searchFail:false,hold:false,release:null as null|(()=>void)};
 await page.route('**/studio/promotion',r=>r.fulfill({json:{active:false,endsAt:null,serverNow:Date.now()}}));
 await page.route('**/account/x/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
 await page.route('**/api/**',async r=>{
  const url=new URL(r.request().url()),path=url.pathname;
  if(path.startsWith('/api/images/')){const i=Number(path.split('-').at(-1))||0;return r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="${['#279eda','#905dcc','#ef9b4d'][i%3]}"/><text x="40" y="53" text-anchor="middle" font-size="40">${['🐳','🪼','🐱'][i%3]}</text></svg>`});}
  if(path==='/api/config')return r.fulfill({json:{brand:'AQUA',network:'mainnet-beta',useTestnet:false,transactionsEnabled:true,marketGovernanceEnabled:true,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}});
  if(path==='/api/governance'){
   if(state.fail)return r.fulfill({status:500,json:{error:'Backend unavailable'}});
   const json=JSON.parse(JSON.stringify(data));
   if(state.hold){state.hold=false;await new Promise<void>(resolve=>state.release=resolve);}
   return r.fulfill({json});
  }
  if(path.includes('/api/governance/')){
   const body=r.request().postDataJSON();state.calls.push({path,body});
   if(path.endsWith('vote-challenge'))return r.fulfill({json:{challenge:'signed-challenge',message:'Vote '+body.targetMint,market:coins.find(c=>c.mint===body.targetMint)??outsider}});
   if(path.endsWith('unboost-challenge'))return r.fulfill({json:{challenge:'signed-challenge',message:'Remove vote'}});
   if(path.endsWith('/vote')){data.wallet.vote=coins.find(c=>c.mint===body.targetMint)??outsider;return r.fulfill({json:data});}
   if(path.endsWith('/unboost')){data.wallet.vote=null;return r.fulfill({json:data});}
  }
  if(path==='/api/search'){
   if(state.searchFail)return r.fulfill({status:400,json:{error:'Search unavailable'}});
   const q=url.searchParams.get('q')!;state.calls.push({search:q});
   return r.fulfill({json:{launches:q.includes('missing')?[]:[{...outsider,id:outsider.launchId,status:'live'}]}});
  }
  if(path==='/api/launches')return r.fulfill({json:{launches:coins.slice(0,4).map(c=>({...c,id:c.launchId,status:'live',imageUrl:'/api/images/'+c.imageId})),hasMore:false,nextOffset:4}});
  return r.fulfill({json:{prices:[],notifications:[],launches:[]}});
 });
 await page.goto('/#/boost');await expect(page.getByRole('heading',{name:'Community Boost.'})).toBeVisible();await expect(page.getByRole('button',{name:'Refresh leaderboard'})).toBeVisible();
 return state;
}
test('live ranking, wallet vote, changing and removing a choice work on desktop and phone',async({page},info)=>{
 const s=await setup(page);await expect(page.locator('.cb-leader')).toHaveCount(10);
 await expect(page.locator('.cb-leader').first()).toContainText('Ocean Club');await expect(page.locator('.cb-today')).toContainText('Coral Cat');
 await page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'}).click();
 await expect(page.locator('.cb-your-coin')).toContainText('Ocean Club');await expect(page.getByRole('status').filter({hasText:'confirmed'})).toBeVisible();
 expect(s.calls.filter(c=>c.path?.endsWith('/vote'))[0].body).toMatchObject({wallet:address,targetMint:'mint-0',message:'Vote mint-0',challenge:'signed-challenge'});
 await page.getByRole('button',{name:'Show more coins'}).click();await expect(page.locator('.cb-leader')).toHaveCount(12);
 await page.getByRole('button',{name:'Change coin'}).click();await expect(page.getByLabel('Find a coin to boost')).toBeFocused();
 await page.getByLabel('Find a coin to boost').fill('outsider-mint');await expect(page.locator('.cb-candidate')).toHaveCount(1);
 await page.locator('.cb-candidate').getByRole('button',{name:'Vote for GOLD'}).click();await expect(page.locator('.cb-your-coin')).toContainText('Hidden Treasure');
 await page.getByRole('button',{name:'Remove your vote'}).click();await expect(page.locator('.cb-your-coin')).toHaveCount(0);
 expect(s.calls.filter(c=>c.path?.endsWith('/unboost'))).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 expect(await page.locator('.cb-hero h1').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/community-boost-${info.project.name}.png`,fullPage:false});
});
test('guests connect explicitly, and insufficient holdings cannot submit a vote',async({page})=>{
 const guest=await setup(page,{guest:true});await page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'}).click();await expect(page.getByRole('dialog',{name:'Connect your wallet'})).toBeVisible();expect(guest.calls.filter(c=>c.path)).toHaveLength(0);
 await page.goto('about:blank');await page.unrouteAll({behavior:'wait'});const s=await setup(page,{eligible:false});await expect(page.locator('.cb-your-vote')).toContainText('Hold at least 0.1%');await expect(page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'})).toBeDisabled();expect(s.calls.filter(c=>c.path)).toHaveLength(0);
});
test('cancelled signing, failed refresh and failed search retain honest state and recover',async({page})=>{
 const s=await setup(page);await page.evaluate(()=>{(window as any).rejectVote=true;});await page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'}).click();await expect(page.locator('.cb-notice')).toContainText('Approval cancelled');expect(s.calls.filter(c=>c.path?.endsWith('/vote'))).toHaveLength(0);await expect(page.locator('.cb-your-coin')).toHaveCount(0);
 s.fail=true;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.getByRole('alert')).toContainText('Leaderboard connection interrupted');await expect(page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'})).toBeDisabled();s.fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.cb-alert')).toHaveCount(0);
 s.searchFail=true;await page.getByLabel('Find a coin to boost').fill('treasure');await expect(page.locator('.cb-search-results')).toContainText('Search unavailable');s.searchFail=false;await page.getByRole('button',{name:'Try again'}).click();await expect(page.locator('.cb-candidate')).toContainText('Hidden Treasure');await page.getByLabel('Find a coin to boost').fill('missing');await expect(page.locator('.cb-search-results')).toContainText('No eligible coin found');
});
test('empty and disabled rounds show clear states and expire without accepting votes',async({page})=>{
 const s=await setup(page,{empty:true});await expect(page.locator('.cb-empty')).toContainText('Make the first wave');
 s.data.round.endsAt=Math.floor(Date.now()/1000)-1;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.locator('.cb-candidate').first().getByRole('button')).toBeDisabled();
 s.data.enabled=false;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.getByRole('heading',{name:'Voting is currently unavailable'})).toBeVisible();
});
test('a late leaderboard response cannot overwrite a confirmed vote',async({page})=>{
 await page.clock.install();const s=await setup(page);await expect(page.locator('.cb-leader')).toHaveCount(10);
 s.hold=true;await page.clock.fastForward(15000);await expect.poll(()=>Boolean(s.release)).toBe(true);
 await page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'}).click();await expect(page.locator('.cb-your-coin')).toContainText('Ocean Club');
 s.release!();await page.waitForTimeout(200);await expect(page.locator('.cb-your-coin')).toContainText('Ocean Club');
});
