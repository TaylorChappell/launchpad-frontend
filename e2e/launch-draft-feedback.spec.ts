import { test, expect, type Page } from '@playwright/test';

const wallet = '11111111111111111111111111111111';
const key = `launch:mainnet-beta:${wallet}`;
const pair = { symbol:'SOL', underlyingSymbol:'SOL', name:'Solana', mint:'So11111111111111111111111111111111111111112', verifiedAt:1, restricted:false, orcaTvlUsd:100000, orcaVolume24hUsd:10000 };
const draft = { id:'unfinished-draft', form:{name:'Ocean draft',symbol:'OCEAN',description:'Unfinished coin',rewardMode:'holder_rewards',launchAmount:'',devBuyCurrency:'SOL'}, file:null, stockMint:pair.mint, dexFundingEnabled:false };
async function setup(page: Page, saved: any = draft, live = false, gate?: Promise<void>) {
  await page.addInitScript(({wallet,key,saved}) => {
    localStorage.setItem('aqua:update:holder-workspace-v2','seen');
    localStorage.setItem('aqua:wallet','phantom');
    (window as any).phantom = {solana:{isPhantom:true,connect:async()=>({publicKey:{toString:()=>wallet}}),on(){},removeListener(){}}};
    (window as any).draftSeeded = new Promise<void>((resolve,reject) => {
      if (sessionStorage.getItem('draft-seeded')) { resolve(); return; }
      const request = indexedDB.open('aqua-launch-drafts',1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('drafts','readwrite');
        if(saved) tx.objectStore('drafts').put(saved,key);
        tx.oncomplete = () => { db.close(); sessionStorage.setItem('draft-seeded','yes'); resolve(); };
      };
    });
  },{wallet,key,saved});
  const coin = {id:'old-launch',name:'Ocean draft',symbol:'OCEAN',creatorWallet:wallet,status:live?'live':'pool_pending',createdAt:1};
  await page.route('**/api/**',async r => {
    const url = new URL(r.request().url()), path = url.pathname;
    if(path === '/api/config') {
      await page.evaluate(() => (window as any).draftSeeded);
      return r.fulfill({json:{brand:'AQUA',network:'mainnet-beta',useTestnet:false,transactionsEnabled:true,marketGovernanceEnabled:false,publicRpcUrl:'https://rpc.invalid',whirlpools:{},fees:{},creatorLocks:{},sniperDefense:{supported:false}}});
    }
    if(path === '/api/stocks') return r.fulfill({json:{stocks:[pair],refreshing:true}});
    if(path === '/api/launches') return r.fulfill({json:{launches:url.searchParams.get('status') === 'pending' ? [coin] : url.searchParams.get('status') === 'live' && live ? [coin] : [],hasMore:false}});
    if(path === '/api/launches/old-launch') { if(gate) await gate; return r.fulfill({json:{launch:coin}}); }
    if(path.endsWith('/submission')) return r.fulfill({json:{launchId:'old-launch',status:'complete',symbol:'OCEAN',rewardMode:'holder_rewards'}});
    if(path === '/api/market-prices/stream') return r.fulfill({contentType:'text/event-stream',body:'data: {"prices":[]}\n\n'});
    return r.fulfill({json:{enabled:false,notifications:[],launches:[],prices:[]}});
  });
  await page.route('**/account/**',r=>r.fulfill({json:{enabled:false}}));
}
async function stored(page: Page) {
  return page.evaluate(async key => {
    return await new Promise<any>((resolve,reject) => {
      const request = indexedDB.open('aqua-launch-drafts',1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {const db=request.result, r=db.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>{resolve(r.result??null);db.close();};};
    });
  },key);
}

test('unfinished form restores without waiting for the pair catalogue, and edits survive reload',async({page})=>{
  await setup(page);await page.goto('/#/create');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Ocean draft');
  await expect(page.locator('.wizard-draft-loading')).toHaveCount(0);
  await page.getByPlaceholder('Aqua Robotics').fill('Still creating');
  await expect.poll(async()=> (await stored(page))?.form.name).toBe('Still creating');
  await page.reload();await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Still creating');
});

test('loading covers the form until a linked draft is checked',async({page},info)=>{
  let release!:()=>void; const gate = new Promise<void>(resolve=>{release=resolve;});
  await setup(page,{...draft,launchId:'old-launch'},false,gate);await page.goto('/#/create');
  await expect(page.locator('.wizard-draft-loading')).toBeVisible();
  await expect(page.locator('.wizard-form-content')).toHaveAttribute('inert','');
  await page.screenshot({path:info.outputPath('compact-draft-loading.png'),fullPage:true});
  release();await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Ocean draft');
  await expect(page.locator('.wizard-form-content')).not.toHaveAttribute('inert','');
});

for (const legacy of [true,false]) test(`${legacy?'legacy':'linked'} completed coin does not repopulate the wizard`,async({page})=>{
  const saved=legacy?{...draft,id:undefined}:{...draft,launchId:'old-launch'};
  await setup(page,saved,true);await page.goto('/#/create');
  await expect(page.locator('.wizard-main')).toHaveAttribute('aria-busy','false');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('');
  await expect.poll(async()=> (await stored(page))?.form.name ?? '').toBe('');
  await page.reload();await expect(page.locator('.wizard-main')).toHaveAttribute('aria-busy','false');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('');
});

test('completed launch clears its own saved draft and cannot be resaved by a pending write',async({page})=>{
  await setup(page,{...draft,launchId:'old-launch'});await page.goto('/#/create');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Ocean draft');
  await page.getByRole('button',{name:'Resume launch',exact:true}).click();
  await expect(page.getByRole('heading',{name:'$OCEAN launched'})).toBeVisible();
  await expect.poll(()=>stored(page)).toBeNull();
  await page.waitForTimeout(900);
  expect(await stored(page)).toBeNull();
  await page.reload();await expect(page.locator('.wizard-main')).toHaveAttribute('aria-busy','false');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('');
});

test('resuming another coin does not delete an unrelated unfinished draft',async({page})=>{
  await setup(page,{...draft,form:{...draft.form,name:'Next coin',symbol:'NEXT'}});await page.goto('/#/create');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Next coin');
  await page.getByRole('button',{name:'Resume launch',exact:true}).click();
  await expect(page.getByRole('heading',{name:'$OCEAN launched'})).toBeVisible();
  await page.reload();await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Next coin');
});

test('editing an earlier launch creates a separate draft that survives resuming the old coin',async({page})=>{
  await setup(page,{...draft,launchId:'old-launch'});await page.goto('/#/create');
  await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Ocean draft');
  await page.getByPlaceholder('Aqua Robotics').fill('Next coin');
  await expect.poll(async()=> (await stored(page))?.form.name).toBe('Next coin');
  expect((await stored(page)).launchId).toBeUndefined();
  await page.getByRole('button',{name:'Resume launch',exact:true}).click();
  await expect(page.getByRole('heading',{name:'$OCEAN launched'})).toBeVisible();
  await page.reload();await expect(page.getByPlaceholder('Aqua Robotics')).toHaveValue('Next coin');
});

test('draft storage orders writes and retires only the completed identity',async({page})=>{
  await setup(page,null);await page.goto('/#/');
  const result=await page.evaluate(async()=>{
    // @ts-expect-error Browser-only Vite module import for real IndexedDB regression coverage.
    const storage=await import('/src/launch-draft.ts');
    const k='test:ordered-draft';
    const first=storage.saveLaunchDraft(k,{id:'a',form:{name:'Completed'}});
    const remove=storage.removeLaunchDraft(k,'a');
    const stale=storage.saveLaunchDraft(k,{id:'a',form:{name:'Stale write'}});
    await Promise.all([first,remove,stale]);
    const retired=await storage.readLaunchDraft(k);
    await storage.saveLaunchDraft(k,{id:'b',form:{name:'New draft'}});
    await storage.removeLaunchDraft(k,'a');
    return {retired,current:await storage.readLaunchDraft(k)};
  });
  expect(result).toEqual({retired:null,current:{id:'b',form:{name:'New draft'}}});
});

test('filter icon is plain black, refresh clicks spin, and the connected wallet animates',async({page},info)=>{
  await setup(page,null);await page.goto('/#/');
  const refresh=page.getByRole('button',{name:'Refresh market rankings'});
  await refresh.click();await expect(refresh).toHaveAttribute('data-refreshing','true');
  await expect(refresh.locator('svg')).toHaveCSS('animation-name','spin');
  await expect(refresh).not.toHaveAttribute('data-refreshing','true');
  await refresh.focus();await page.keyboard.press('Enter');await expect(refresh).toHaveAttribute('data-refreshing','true');
  const walletButton=page.locator('.wallet-menu-trigger');await walletButton.click();
  await expect(page.locator('.wallet-dropdown')).toHaveCSS('animation-name','wallet-menu-arrive');
  await page.screenshot({path:info.outputPath('compact-connected-wallet.png'),fullPage:true});
  await page.keyboard.press('Escape');await expect(walletButton).toBeFocused();
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await expect(page.locator('.filter-modal-icon')).toHaveCSS('color','rgb(17, 17, 17)');
  await expect(page.locator('.filter-modal-icon')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  await walletButton.click();await expect(page.locator('.wallet-dropdown')).toHaveCSS('animation-name','none');
  await page.keyboard.press('Escape');await refresh.click();await expect(refresh).toHaveAttribute('data-refreshing','true');
  await expect(refresh.locator('svg')).toHaveCSS('animation-name','none');
});
