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
 data.funding={total:{totalLamports:'10000000000',rewardLamports:'7500000000',fundLamports:'2500000000'},activeRound:{totalLamports:'2500000001',rewardLamports:'1250000001',fundLamports:'1250000000'}};
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
test('clean leaderboard supports voting, switching and removing without extra sections',async({page},info)=>{
 const s=await setup(page);await expect(page.locator('.cb-leader')).toHaveCount(10);
 await expect(page.locator('.cb-your-vote,.cb-picker,.cb-rank-foot,.cb-orbit>span')).toHaveCount(0);
 for(const copy of ['YOUR VOICE','THE RACE FOR TOMORROW','POWERED BY AQUA HOLDERS','THIS ROUND CLOSES IN'])await expect(page.getByText(copy,{exact:true})).toHaveCount(0);
 const first=page.locator('.cb-leader').first(),second=page.locator('.cb-leader').nth(1);
 await first.getByRole('button',{name:'Vote for OCEAN'}).click();await expect(first.getByRole('button',{name:'Remove vote for OCEAN'})).toHaveAttribute('aria-pressed','true');
 await second.getByRole('button',{name:'Vote for JELLY'}).click();await expect(second.getByRole('button',{name:'Remove vote for JELLY'})).toHaveAttribute('aria-pressed','true');await expect(first.getByRole('button',{name:'Vote for OCEAN'})).toBeEnabled();
 await second.getByRole('button',{name:'Remove vote for JELLY'}).click();await expect(second.getByRole('button',{name:'Vote for JELLY'})).toBeEnabled();
 expect(s.calls.filter(c=>c.path?.endsWith('/unboost'))).toHaveLength(1);expect(s.calls.filter(c=>c.path?.endsWith('/vote'))).toHaveLength(2);expect(s.calls.filter(c=>c.search)).toHaveLength(0);
 await page.getByRole('button',{name:'Show more coins'}).click();await expect(page.locator('.cb-leader')).toHaveCount(12);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/clean-boost-${info.project.name}.png`});
});
test('guests connect explicitly and ineligible holders cannot submit',async({page})=>{
 const guest=await setup(page,{guest:true});await page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'}).click();await expect(page.getByRole('dialog',{name:'Connect your wallet'})).toBeVisible();expect(guest.calls.filter(c=>c.path)).toHaveLength(0);
 await page.goto('about:blank');await page.unrouteAll({behavior:'wait'});const s=await setup(page,{eligible:false});const button=page.locator('.cb-leader').first().getByRole('button');await expect(button).toBeDisabled();await expect(button).toHaveAttribute('title','Hold at least 0.1% of AQUA to vote.');expect(s.calls.filter(c=>c.path)).toHaveLength(0);
});
test('cancelled signing and failed refresh do not show a confirmed vote',async({page})=>{
 const s=await setup(page);await page.evaluate(()=>{(window as any).rejectVote=true;});await page.locator('.cb-leader').first().getByRole('button',{name:'Vote for OCEAN'}).click();await expect(page.getByText('Approval cancelled',{exact:true})).toBeVisible();expect(s.calls.filter(c=>c.path?.endsWith('/vote'))).toHaveLength(0);await expect(page.locator('.cb-vote.is-chosen')).toHaveCount(0);
 s.fail=true;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.locator('.cb-alert')).toContainText('Leaderboard connection interrupted');await expect(page.locator('.cb-leader').first().getByRole('button')).toBeDisabled();s.fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.cb-alert')).toHaveCount(0);
});
test('closed, empty and disabled rounds have no actionable votes',async({page})=>{
 const s=await setup(page);s.data.round.endsAt=Math.floor(Date.now()/1000)-1;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.locator('.cb-leader').first().getByRole('button')).toBeDisabled();s.data.leaders=[];await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.locator('.cb-empty')).toBeVisible();s.data.enabled=false;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(page.getByRole('heading',{name:'Voting is currently unavailable'})).toBeVisible();
});
test('a delayed refresh cannot overwrite a confirmed vote',async({page})=>{
 await page.clock.install();const s=await setup(page);await expect(page.locator('.cb-leader')).toHaveCount(10);s.hold=true;await page.clock.fastForward(15000);await expect.poll(()=>Boolean(s.release)).toBe(true);
 const first=page.locator('.cb-leader').first();await first.getByRole('button',{name:'Vote for OCEAN'}).click();await expect(first.getByRole('button',{name:'Remove vote for OCEAN'})).toHaveAttribute('aria-pressed','true');s.release!();await page.waitForTimeout(200);await expect(first.getByRole('button',{name:'Remove vote for OCEAN'})).toHaveAttribute('aria-pressed','true');
});

test('shows reward totals inside Boosted today without an extra panel',async({page},info)=>{
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:740});
 const s=await setup(page);const today=page.locator('.cb-today');
 await expect(today).toContainText('BOOSTED TODAY');await expect(today.locator('.cb-today-rewards strong')).toContainText('1.250000001');await expect(today).toContainText('1.25 SOL to DEX funding');
 await expect(page.locator('.cb-funding')).toHaveCount(0);await expect(page.getByText('All-time rewards:',{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await today.scrollIntoViewIfNeeded();await today.screenshot({path:`/tmp/boosted-today-${info.project.name}.png`,animations:'disabled'});
 s.data.funding.activeRound.rewardLamports='0';s.data.funding.activeRound.fundLamports='0';await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(today.locator('.cb-today-rewards strong')).toContainText('0');await expect(today.locator('.cb-today-dex')).toHaveCount(0);
 delete s.data.funding;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(today).toContainText('Unavailable');
 s.data.activeBonus=null;await page.getByRole('button',{name:'Refresh leaderboard'}).click();await expect(today).toHaveCount(0);await expect(page.locator('.cb-funding')).toHaveCount(0);
});
