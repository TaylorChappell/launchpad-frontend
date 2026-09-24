import {test,expect,type Page} from '@playwright/test';
const fixtureApi=process.env.SHOWCASE_TEST_API;
test.skip(!fixtureApi,'Run with SHOWCASE_TEST_API pointing to the isolated backend showcase router.');
async function setup(page:Page,enabled=true){
 await page.addInitScript(()=>{localStorage.setItem('aqua:update:holder-workspace-v2','seen');});
 const mutations:string[]=[];page.on('request',req=>{if(['POST','PUT','PATCH','DELETE'].includes(req.method()))mutations.push(req.url());});
 await page.route('**/studio/promotion',r=>r.fulfill({json:{active:false}}));
 await page.route('**/account/x/**',r=>r.fulfill({json:{enabled:false,profiles:[]}}));
 await page.route('**/api/**',async r=>{
  const url=new URL(r.request().url());
  if(url.pathname==='/api/config')return r.fulfill({json:{brand:'AQUA',stagingShowcaseEnabled:enabled,marketGovernanceEnabled:true,transactionsEnabled:true,network:'mainnet-beta',publicRpcUrl:'https://rpc.invalid',useTestnet:false,whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}});
  if(url.pathname==='/api/showcase'||url.pathname.startsWith('/api/launches/__showcase__'))return r.fulfill({response:await page.request.get(fixtureApi+url.pathname+url.search)});
  if(url.pathname==='/api/governance')return r.fulfill({json:{enabled:false,reason:'Not enabled in fixture server'}});
  if(url.pathname==='/api/launches')return r.fulfill({json:{launches:[],hasMore:false,nextOffset:0}});
  if(url.pathname==='/api/market-prices/stream')return r.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
  return r.fulfill({json:{profiles:[],prices:[],notifications:[],stocks:[],launches:[]}});
 });
 return mutations;
}
test('preview catalogue is conditional and links to the real market layouts',async({page})=>{
 await setup(page);await page.goto('/#/');const catalog=page.getByRole('region',{name:'Staging feature showcase'});await expect(catalog).toBeVisible();await expect(catalog.getByRole('link')).toHaveCount(6);await catalog.getByRole('button',{name:/Show all/}).click();await expect(catalog.getByRole('link')).toHaveCount(14);
 await catalog.getByRole('link',{name:/Electric Eel/}).click();await expect(page.getByRole('complementary',{name:'Staging preview'})).toContainText('Automatic 10% DEX boost');await expect(page.locator('.boost-proposal-card').first()).toContainText('10%');await expect(page.getByRole('button',{name:'Preview only',exact:true})).toBeDisabled();
});
test('production config shows no showcase controls or requests',async({page})=>{
 await setup(page,false);const calls:string[]=[];page.on('request',r=>calls.push(r.url()));await page.goto('/#/');await expect(page.getByRole('heading',{name:'Explore markets'})).toBeVisible();await expect(page.locator('.showcase-catalog')).toHaveCount(0);expect(calls.some(url=>url.includes('/api/showcase'))).toBe(false);
});
test('CTO, funding, boost and refund states render without wallet actions',async({page},info)=>{
 const mutations=await setup(page);
 for(const [slug,text] of [['cto-vote','Community Takeover'],['cto-complete','Community Takeover'],['auto-boost','Mini DEX boost'],['auto-boost-paused','ten quiet minutes'],['auto-dex','10% of incoming rewards'],['dex-vote','Fund the token profile'],['dex-funded','Profile funding'],['dex-update','Update Dex'],['boost-vote','Choose the funding rate'],['boost-ready','30x']]){
  await page.goto(`/#/token/__showcase__${slug}?tab=governance`);await expect(page.locator('.showcase-banner')).toBeVisible();
  if(slug==='cto-complete')await page.getByText('Past proposals · 1',{exact:true}).click();
  await expect(page.locator('.token-main')).toContainText(text);await expect(page.getByRole('button',{name:'Preview only',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 }
 await page.getByText('Past proposals · 1',{exact:true}).click();await expect(page.locator('.token-main')).toContainText('Funds returned to holders');expect(mutations).toEqual([]);
 await page.locator('.boost-proposal-card').first().screenshot({path:`/tmp/showcase-governance-${info.project.name}.png`});
});
test('reward modes, locks and community use populated read-only previews',async({page},info)=>{
 const mutations=await setup(page);
 await page.goto('/#/token/__showcase__rewards?tab=rewards');await expect(page.locator('.showcase-lock')).toContainText('10%');await expect(page.getByRole('button',{name:'Claim',exact:true})).toBeDisabled();await expect(page.locator('.market-reward-activity')).toContainText('Total accumulated');
 await page.getByLabel('Preview scenario').selectOption('__showcase__burn');await expect(page.locator('.token-main')).toContainText('38.52 SOL');
 await page.getByLabel('Preview scenario').selectOption('__showcase__jackpot');await expect(page.locator('.jackpot-podium .podium-place')).toHaveCount(5);await expect(page.locator('.token-main')).toContainText('Previous');
 await page.getByLabel('Preview scenario').selectOption('__showcase__community');await expect(page.locator('.community-message')).toHaveCount(3);await expect(page.locator('.community-composer')).toHaveCount(0);await expect(page.locator('.community-message .community-more').first()).toBeDisabled();
 await page.getByRole('button',{name:/Updates/}).click();await expect(page.locator('.community-post')).toHaveCount(1);await expect(page.locator('.community-post')).toContainText('A new chapter for our community');await expect(page.locator('.community-post img').last()).toBeVisible();
 await page.getByRole('button',{name:/Polls/}).click();await expect(page.locator('.community-poll')).toContainText('Ends in');await expect(page.locator('.community-poll>button').first()).toBeDisabled();expect(mutations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.locator('.community').screenshot({path:`/tmp/showcase-community-${info.project.name}.png`});
});
