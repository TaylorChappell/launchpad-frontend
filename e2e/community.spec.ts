import { test,expect,type Page } from '@playwright/test';
const creator='11111111111111111111111111111111',holder='22222222222222222222222222222222',token='a'.repeat(64);
const image='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#045683"/><stop offset="1" stop-color="#38c7ce"/></linearGradient></defs><rect width="640" height="360" fill="url(#a)"/><circle cx="480" cy="60" r="190" fill="#fff" opacity=".06"/><path d="M0 270Q160 130 320 270T640 270V360H0" fill="#fff" opacity=".14"/><text x="40" y="145" fill="white" font-family="sans-serif" font-size="20" letter-spacing="4">OCEAN CLUB</text><text x="40" y="200" fill="white" font-family="sans-serif" font-weight="bold" font-size="42">A new wave is coming.</text></svg>';
async function setup(page:Page,role:'creator'|'holder'|'visitor'|'admin'='creator'){
 const wallet=role==='admin'?'admin':role==='holder'?holder:creator,now=Date.now();
 await page.addInitScript(({wallet,role,token})=>{localStorage.setItem('aqua:update:holder-workspace-v2','seen');if(role!=='visitor'){localStorage.setItem('aqua:wallet','phantom');localStorage.setItem(`aqua:studio:${wallet}`,JSON.stringify({token,expiresAt:Date.now()+86400000}));Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>wallet},connect:async()=>({publicKey:{toString:()=>wallet}}),on(){},removeListener(){}}}});}}, {wallet,role,token});
 const make=(id:string,body:string,author=holder,extra:any={})=>({id,launchId:'coin',body,authorWallet:author,createdAt:now-600000+Number(id.slice(-2))*1000,kind:'message',imageUrl:null,reply:null,poll:null,reactions:[],...extra});
 const posts=[make('01','The new site is looking so good. Who’s here for the next wave?'),make('02','We’re live! The Ocean Club website is ready.\nThanks to everyone who helped shape it.',creator,{kind:'update',reactions:[{emoji:'🔥',count:12,mine:false},{emoji:'❤️',count:8,mine:false}]}),make('03','Little preview of what we’ve been working on 🌊',creator,{imageUrl:'/api/launches/coin/community/03/image'}),make('04','Love this direction. Clean and simple 👏',holder,{reply:{id:'01',authorWallet:holder,body:'The new site is looking so good.'},reactions:[{emoji:'👍',count:3,mine:false}]}),make('05','What would you like to see next?',creator,{kind:'poll',poll:{options:[{label:'Community art contest',votes:14},{label:'Weekly project updates',votes:22},{label:'Trading tools',votes:8}],myChoice:null,closesAt:now+3600000}})];
 const state={posts,pinned:posts[0] as any,fail:false,failSend:false,calls:[] as any[],nextCursor:null as string|null,older:[] as any[]};
 await page.route('**/api/**',async r=>{
  const path=new URL(r.request().url()).pathname,q=new URL(r.request().url()).searchParams,method=r.request().method();let json:any={};
  if(path==='/api/config')json={brand:'AQUA',network:'mainnet-beta',transactionsEnabled:false,marketGovernanceEnabled:false,adminWallet:'admin',publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}};
  else if(path==='/api/launches/coin')json={launch:{id:'coin',mint:creator,creatorWallet:creator,name:'Ocean Club',symbol:'OCEAN',description:'A community building together.',stockMint:creator,stockSymbol:'SOL',stockName:'Solana',stock:{mint:creator,symbol:'SOL',name:'Solana'},pairMint:creator,pairType:'sol',pairSymbol:'SOL',rewardMode:'holder_rewards',status:'live',txCount:0,marketCapUsd:124000,tvlUsd:21000,volume24hUsd:54000,change24h:12,holderCount:320,aquaIndexed:true,totalSupplyRaw:'1000000000',tokenDecimals:6,createdAt:now,launchedAt:Math.floor(now/1000),devBuySol:0,rewardAccumulatedUsd:750,rewardRedeemableUsd:420,latestComment:{id:'05',createdAt:now}},trades:[],creatorLock:null,rewardModeState:null};
  else if(path.endsWith('/market-data'))json={snapshots:[]};
  else if(path.endsWith('/image'))return r.fulfill({contentType:'image/svg+xml',body:image});
  else if(path.endsWith('/community')&&method==='GET'){
   if(state.fail)return r.fulfill({status:503,json:{error:'Connection interrupted. Try again.'}});
   const filter=q.get('filter'),pagePosts=q.get('cursor')?state.older:state.posts.filter(p=>filter==='updates'?p.kind==='update':filter==='polls'?p.kind==='poll':p.kind==='message');
   json={latestByKind:Object.fromEntries(['message','update','poll'].map(kind=>{const p=state.posts.filter(p=>p.kind===kind).at(-1);return [kind,p?{id:p.id,createdAt:p.createdAt}:null];}).filter(([,p])=>p)),posts:[...pagePosts].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)),pinned:state.pinned,nextCursor:q.get('cursor')?null:state.nextCursor,latest:{id:state.posts.at(-1)!.id,createdAt:state.posts.at(-1)!.createdAt}};
  }else if(path.endsWith('/community')&&method==='POST'){
   if(state.failSend)return r.fulfill({status:503,json:{error:'Could not send. Try again.'}});
   let input:any;if(r.request().headers()['content-type'].includes('multipart/form-data')){input=JSON.parse(r.request().postData()!.split('name="post"\r\n\r\n')[1].split('\r\n--')[0]);input.imageUrl='/api/launches/coin/community/new/image';}else input=r.request().postDataJSON();
   expect(r.request().headers().authorization).toBe(`Bearer ${token}`);state.calls.push(input);const parent=state.posts.find(p=>p.id===input.replyTo);
   const post=make(input.id,input.body,wallet,{...input,createdAt:Date.now(),reply:parent?{id:parent.id,body:parent.body,authorWallet:parent.authorWallet}:null,poll:input.kind==='poll'?{holdersOnly:input.holdersOnly,options:input.options.map((label:string)=>({label,votes:0})),closesAt:Date.now()+input.durationHours*3600000,myChoice:null}:null});state.posts.push(post);json={post};
  }else if(path.endsWith('/project-updates')&&method==='POST'){const input=r.request().postDataJSON();state.calls.push(input);const post=make(input.id,input.body,creator,{kind:'update',createdAt:Date.now()});state.posts.push(post);json={update:post};}
  else if(path.includes('/community/')&&method==='POST'){
   const parts=path.split('/'),action=parts.at(-1),id=parts.at(-2),post=state.posts.find(p=>p.id===id)!,input=r.request().postDataJSON();state.calls.push({action,id,...input});
   if(action==='vote'){post.poll.myChoice=input.choice;post.poll.options[input.choice].votes++;json={post};}
   else if(action==='react'){post.reactions=[{emoji:input.emoji,count:1,mine:input.active}];json={post};}
   else if(action==='moderate'){if(input.action==='pin')state.pinned=post;if(input.action==='unpin')state.pinned=null;if(input.action==='delete')state.posts=state.posts.filter(p=>p.id!==id);json={ok:true};}
   else json={ok:true};
  }else if(path==='/api/stocks')json={stocks:[]};else if(path.includes('/governance'))json={enabled:false};else if(path.includes('/notifications'))json={notifications:[]};else if(path.endsWith('/stream'))return r.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});else if(path==='/api/market-prices')json={prices:[]};
  return r.fulfill({json});
 });
 await page.route('**/account/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
 await page.route('https://rpc.invalid/**',r=>r.fulfill({json:{jsonrpc:'2.0',id:1,result:{value:0,context:{slot:1}}}}));
 await page.goto('/#/token/coin?tab=community');await expect(page.locator('.community-message')).toHaveCount(3);return state;
}
test('polished conversation supports creator updates, polls, filters and mobile layout',async({page},info)=>{
 const state=await setup(page);const room=page.locator('.community');
 await expect(page.getByRole('button',{name:'Comments',exact:true})).toHaveCount(0);
 await expect(room.getByRole('button',{name:'Create poll'})).toHaveCount(0);
 await room.getByRole('button',{name:'Polls',exact:true}).click();await expect(room.locator('.community-message')).toHaveCount(1);
 await room.getByRole('button',{name:/Weekly project updates/}).click();expect(state.calls.at(-1)).toMatchObject({action:'vote',choice:1});
 await room.getByRole('button',{name:'Updates',exact:true}).click();await expect(room.locator('.community-message')).toHaveCount(1);
 await room.getByRole('button',{name:'Create update',exact:true}).click();await page.getByLabel('Project update',{exact:true}).fill('Next community call is Friday. See you there!');await page.getByRole('button',{name:'Publish update',exact:true}).click();await expect(room.locator('.community-message').last()).toContainText('Next community call');
 await room.getByRole('button',{name:'Polls',exact:true}).click();await room.getByRole('button',{name:'Create poll'}).click();const dialog=page.getByRole('dialog',{name:'Ask your community'});await dialog.getByLabel('Question').fill('Which artwork should we make?');await dialog.getByLabel('Option 1').fill('Ocean');await dialog.getByLabel('Option 2').fill('Coral');await dialog.getByRole('button',{name:'Create poll',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(room.locator('.community-message').last()).toContainText('Which artwork');
 expect(state.calls.at(-1)).toMatchObject({kind:'poll',options:['Ocean','Coral'],durationHours:24});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await room.getByRole('button',{name:'Chat',exact:true}).click();await room.scrollIntoViewIfNeeded();
 expect(await room.locator('.community-send').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 await room.screenshot({path:`/tmp/community-${info.project.name}.png`});
});
test('messages retain failed drafts, support replies and image lightbox',async({page})=>{
 const state=await setup(page,'holder');const room=page.locator('.community');await expect(room.getByRole('button',{name:'Create poll'})).toHaveCount(0);
 const field=room.getByLabel('Your message');state.failSend=true;await field.fill('This should stay until sent');await room.getByRole('button',{name:'Send message'}).click();await expect(room.getByRole('alert')).toContainText('Could not send');await expect(field).toHaveValue('This should stay until sent');state.failSend=false;await room.getByRole('button',{name:'Send message'}).click();await expect(room.locator('.community-message').last()).toContainText('This should stay');
 await room.locator('.community-message').last().getByRole('button',{name:'Message options'}).click();await page.getByRole('menuitem',{name:'Reply',exact:true}).click();await field.fill('Reply from the community');await room.getByRole('button',{name:'Send message'}).click();await expect(room.locator('.community-message').last().locator('.community-reply-preview')).toContainText('This should stay');
 await page.getByLabel('Attach a picture').setInputFiles({name:'wave.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=','base64')});await expect(room.getByAltText('Picture ready to send')).toBeVisible();await room.getByRole('button',{name:'Send message'}).click();await expect(room.locator('.community-message').last().getByRole('button',{name:'Open picture'})).toBeVisible();await room.locator('.community-message').last().getByRole('button',{name:'Open picture'}).click();await expect(page.getByRole('dialog',{name:'Community picture'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('reactions, pinned messages and report/delete dialogs work',async({page})=>{
 const state=await setup(page,'admin');const room=page.locator('.community');const post=room.locator('#community-01');await post.getByRole('button',{name:'Message options'}).click();await page.getByRole('menuitemcheckbox',{name:'React 🔥'}).click();await expect(post.getByRole('button',{name:'🔥 reaction, 1'})).toHaveAttribute('aria-pressed','true');
 await post.getByRole('button',{name:'Message options'}).click();await page.getByRole('menuitem',{name:'Pin message',exact:true}).click();await expect(room.locator('.community-pin')).toContainText('The new site');
 await post.getByRole('button',{name:'Message options'}).click();await page.getByRole('menuitem',{name:'Report',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Send report'}).click();expect(state.calls.at(-1)).toMatchObject({action:'report',reason:'Spam'});
 await post.getByRole('button',{name:'Message options'}).click();await page.getByRole('menuitem',{name:'Delete message',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete message',exact:true}).click();await expect(post).toHaveCount(0);
});
test('reading older messages is not interrupted by incoming messages; pagination preserves older history',async({page})=>{
 const state=await setup(page);const room=page.locator('.community'),feed=room.locator('.community-scroll');
 for(let i=0;i<20;i++)state.posts.push({...state.posts[0],id:'history-'+i,body:'Earlier conversation '+i,createdAt:Date.now()-100000+i});await room.getByRole('button',{name:'Refresh community'}).click();await expect(room.locator('.community-message')).toHaveCount(23);
 await feed.evaluate(el=>el.scrollTop=0);await expect(room.getByRole('button',{name:'Latest messages'})).toBeVisible();
 const before=await feed.evaluate(el=>el.scrollTop);state.posts.push({...state.posts[0],id:'new-message',body:'Just arrived',createdAt:Date.now()});await room.getByRole('button',{name:'Refresh community'}).click();await expect(room.getByRole('button',{name:'1 new message'})).toBeVisible();expect(await feed.evaluate(el=>el.scrollTop)).toBe(before);
 await room.getByRole('button',{name:'1 new message'}).click();await expect(room.locator('.community-message').last()).toContainText('Just arrived');await expect(room.locator('.community-jump')).toHaveCount(0);
 state.nextCursor='older';state.older=[{...state.posts[0],id:'older-post',body:'The very first hello',createdAt:Date.now()-86400000}];await page.reload();await expect(room.getByRole('button',{name:'Earlier messages'})).toHaveCount(1);await room.getByRole('button',{name:'Earlier messages'}).click();await expect(room.locator('#community-older-post')).toHaveCount(1);await room.getByRole('button',{name:'Refresh community'}).click();await expect(room.locator('#community-older-post')).toHaveCount(1);
});
test('visitors can read the room, connect explicitly and recover from loading failures',async({page})=>{
 const state=await setup(page,'visitor');const room=page.locator('.community');await expect(room.getByRole('button',{name:'Connect wallet'})).toBeVisible();await expect(room.getByLabel('Your message')).toHaveCount(0);state.fail=true;await room.getByRole('button',{name:'Refresh community'}).click();await expect(room.getByRole('alert')).toContainText('Connection interrupted');state.fail=false;await room.getByRole('button',{name:'Try again'}).click();await expect(room.getByRole('alert')).toHaveCount(0);await expect(room.locator('.community-message')).toHaveCount(3);
});
test('moderators can dismiss an older report without retaining it in the queue',async({page})=>{
 const state=await setup(page,'admin');let reports=state.posts.slice(0,2).map(p=>({...p,reports:1,reasons:['Spam']}));
 await page.route('**/api/launches/coin/community-reports',r=>r.fulfill({json:{posts:[...reports].reverse()}}));
 await page.route('**/api/launches/coin/community/01/moderate',r=>{expect(r.request().postDataJSON()).toEqual({action:'dismiss'});reports=reports.filter(p=>p.id!=='01');return r.fulfill({json:{ok:true}});});
 const room=page.locator('.community');await room.getByRole('button',{name:'Reported posts'}).click();await expect(room.locator('.community-message')).toHaveCount(2);await room.locator('#community-01').getByRole('button',{name:'Dismiss reports'}).click();await expect(room.locator('#community-01')).toHaveCount(0);await expect(room.locator('.community-message')).toHaveCount(1);
});
test('floating message menu supports right click, more reactions and keyboard dismissal without changing the bubble',async({page},info)=>{
 const state=await setup(page,'admin');const room=page.locator('.community'),post=room.locator('#community-01');
 await post.getByRole('button',{name:'Message options'}).scrollIntoViewIfNeeded();
 const before=await post.boundingBox();
 await post.getByRole('button',{name:'Message options'}).click();
 const menu=page.getByRole('menu',{name:'Message actions'});
 await expect(menu).toBeVisible();await expect(post.getByRole('button',{name:'Reply to message'})).toHaveCount(0);
 expect((await post.boundingBox())!.height).toBe(before!.height);expect(await menu.evaluate(el=>el.parentElement===document.body)).toBe(true);
 await menu.getByRole('menuitem',{name:'More reactions'}).click();await expect(menu.getByRole('menuitemcheckbox',{name:'React 🚀'})).toBeVisible();
 expect((await post.boundingBox())!.height).toBe(before!.height);
 const bounds=await menu.boundingBox(),viewport=page.viewportSize()!;expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height);
 await page.screenshot({path:`/tmp/community-menu-${info.project.name}.png`});
 await menu.getByRole('menuitemcheckbox',{name:'React 🚀'}).click();await expect(menu).toHaveCount(0);expect(state.calls.at(-1)).toMatchObject({action:'react',emoji:'🚀',active:true});
 await post.locator('.community-text').click({button:'right'});await expect(menu).toBeVisible();await expect(menu.getByRole('menuitem',{name:'Reply',exact:true})).toBeVisible();await expect(menu.getByRole('menuitem',{name:'Report',exact:true})).toBeVisible();await expect(menu.getByRole('menuitem',{name:'Delete message',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(post.getByRole('button',{name:'Message options'})).toBeFocused();
 await post.getByRole('button',{name:'Message options'}).click();await room.getByLabel('Your message').click();await expect(menu).toHaveCount(0);
});
for(const role of ['creator','holder','visitor'] as const)test(`${role} gets the correct filtered feed controls and replies return to chat`,async({page})=>{
 await setup(page,role);const room=page.locator('.community');
 if(role!=='visitor')await room.getByLabel('Your message').fill('Keep my chat draft');
 await room.getByRole('button',{name:'Updates',exact:true}).click();await expect(room.getByLabel('Your message')).toHaveCount(0);await expect(room.getByPlaceholder('Message the community…')).toHaveCount(0);await expect(room.getByRole('button',{name:'Connect wallet'})).toHaveCount(0);
 await expect(room.getByRole('button',{name:'Create update',exact:true})).toHaveCount(role==='creator'?1:0);await expect(room.getByRole('button',{name:'Create poll',exact:true})).toHaveCount(0);
 if(role==='creator'){await room.getByRole('button',{name:'Create update',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Create update'});await expect(dialog.getByLabel('Project update')).toHaveValue('');await dialog.getByRole('button',{name:'Close',exact:true}).click();}
 await room.getByRole('button',{name:'Polls',exact:true}).click();await expect(room.getByLabel('Your message')).toHaveCount(0);await expect(room.getByRole('button',{name:'Create poll',exact:true})).toHaveCount(role==='creator'?1:0);await expect(room.getByRole('button',{name:'Create update',exact:true})).toHaveCount(0);
 await room.locator('.community-message').last().getByRole('button',{name:'Message options'}).click();await expect(page.getByRole('menuitem',{name:'Reply',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await room.getByRole('button',{name:'Chat',exact:true}).click();
 if(role!=='visitor'){await expect(room.getByLabel('Your message')).toHaveValue('Keep my chat draft');}

});

test('creator has no moderation access and announcement cards cannot receive replies',async({page},info)=>{
 await setup(page);const room=page.locator('.community');await expect(room.getByRole('button',{name:'Reported posts'})).toHaveCount(0);
 await room.locator('#community-01').getByRole('button',{name:'Message options'}).click();await expect(page.getByRole('menuitem',{name:'Delete message'})).toHaveCount(0);await expect(page.getByRole('menuitem',{name:'Pin message'})).toHaveCount(0);await page.keyboard.press('Escape');
 await expect(room.getByRole('img',{name:'New updates'})).toBeVisible();await expect(room.getByRole('img',{name:'New polls'})).toBeVisible();
 await room.getByRole('button',{name:'Updates',exact:true}).click();await expect(room.locator('.is-update')).toHaveCount(1);await expect(room.getByRole('img',{name:'New updates'})).toHaveCount(0);
 const card=room.locator('.is-update'),width=await card.evaluate(el=>el.getBoundingClientRect().width),feedWidth=await room.locator('.community-scroll').evaluate(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight));expect(Math.abs(width-feedWidth)).toBeLessThan(2);
 await card.getByRole('button',{name:'Message options'}).click();await expect(page.getByRole('menuitem',{name:'Reply',exact:true})).toHaveCount(0);await page.getByRole('menuitemcheckbox',{name:'React ❤️'}).click();await expect(card.getByRole('button',{name:'❤️ reaction, 1'})).toBeVisible();await expect(card.locator('.community-reactions img')).toHaveCount(0);
 await room.screenshot({path:`/tmp/community-refine-updates-${info.project.name}.png`});
 await room.getByRole('button',{name:'Chat',exact:true}).click();await expect(room.locator('.is-update,.is-poll')).toHaveCount(0);
});
test('formats an update, attaches its image, and creates a holder-only poll',async({page})=>{
 const state=await setup(page);const room=page.locator('.community');await room.getByRole('button',{name:'Updates',exact:true}).click();await room.getByRole('button',{name:'Create update'}).click();
 const dialog=page.getByRole('dialog',{name:'Create update'}),field=dialog.getByLabel('Project update',{exact:true});await field.fill('Big news');await field.evaluate((el:HTMLTextAreaElement)=>el.setSelectionRange(0,3));await dialog.getByRole('button',{name:'Bold',exact:true}).click();await expect(field).toHaveValue('**Big** news');await field.evaluate((el:HTMLTextAreaElement)=>el.setSelectionRange(8,12));await dialog.getByRole('button',{name:'Underline',exact:true}).click();await expect(dialog.locator('.community-update-preview strong')).toHaveText('Big');await expect(dialog.locator('.community-update-preview u')).toHaveText('news');
 await dialog.getByLabel('Attach update picture').setInputFiles({name:'news.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=','base64')});await dialog.getByRole('button',{name:'Publish update'}).click();await expect(dialog).toHaveCount(0);await expect(room.locator('.is-update').last().locator('strong')).toHaveText('Big');await expect(room.locator('.is-update').last().getByRole('button',{name:'Open picture'})).toBeVisible();expect(state.calls.at(-1)).toMatchObject({kind:'update',bodyFormat:'styled'});
 await room.getByRole('button',{name:'Polls',exact:true}).click();await room.getByRole('button',{name:'Create poll'}).click();const poll=page.getByRole('dialog');await poll.getByLabel('Question').fill('Next release?');await poll.getByLabel('Option 1').fill('Friday');await poll.getByLabel('Option 2').fill('Monday');await poll.getByRole('checkbox',{name:/Holders only/}).check();await poll.getByRole('button',{name:'Create poll'}).click();await expect(poll).toHaveCount(0);expect(state.calls.at(-1)).toMatchObject({holdersOnly:true});await expect(room.locator('.is-poll').last()).toContainText('minimum 0.1%');
});
test('remembers market and community tabs on refresh and when opening another coin',async({page})=>{
 await setup(page);const room=page.locator('.community');await room.getByRole('button',{name:'Polls',exact:true}).click();await page.reload();await expect(room.getByRole('button',{name:'Polls',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.route('**/api/launches/second',async route=>{await route.fulfill({json:{launch:{id:'second',name:'Second coin',symbol:'TWO',creatorWallet:creator,mint:creator,status:'live',pairSymbol:'SOL',stockSymbol:'SOL',pairType:'sol',rewardMode:'holder_rewards',stock:{mint:creator,symbol:'SOL',name:'Solana'},totalSupplyRaw:'1000',tokenDecimals:6,createdAt:Date.now()},trades:[],creatorLock:null,rewardModeState:null}});});
 await page.goto('/#/token/second');await expect(page.getByRole('button',{name:'Community',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.community').getByRole('button',{name:'Polls',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('AQUA admin can review reports centrally and confirm deletion',async({page})=>{
 const state=await setup(page,'admin');await page.evaluate(()=>sessionStorage.setItem('aqua-admin-session-v1','verified-admin'));
 let reports=[{...state.posts[0],reports:2,reasons:['Scam','Spam']}];
 await page.route('**/api/admin/diagnostics?*',route=>route.fulfill({json:{generatedAt:Date.now(),proposals:[],diagnostics:[],launches:[],runtime:{available:false},conversions:[],settlements:[],rewardPurchases:[],rewardEpochs:[],counts:{},flags:{},alerts:{configured:true,valid:true}}}));
 await page.route('**/api/admin/community-reports?*',route=>{expect(route.request().headers().authorization).toBe('Bearer verified-admin');return route.fulfill({json:{posts:reports,hasMore:false}});});
 await page.route('**/api/admin/community/coin/01',route=>{expect(route.request().headers().authorization).toBe('Bearer verified-admin');expect(route.request().postDataJSON()).toEqual({action:'delete'});reports=[];return route.fulfill({json:{ok:true}});});
 await page.goto('/#/admin?section=community');await expect(page.locator('.ops-community-reports')).toContainText('Scam, Spam');await page.getByRole('button',{name:'Delete post',exact:true}).click();await expect(page.getByText('Delete this post permanently?')).toBeVisible();await page.getByRole('button',{name:'Confirm delete'}).click();await expect(page.getByText('No reports in this view.')).toBeVisible();
});
