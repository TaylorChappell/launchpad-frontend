import { test, expect, type Page } from "@playwright/test";
const wallet = "11111111111111111111111111111111", token = "a".repeat(64), id = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page) {
  const flow={surveys:[] as any[],quotes:[] as any[],jobs:[] as any[],surveyFail:false,quoteFail:false,chat:false};
  const project: any = {id,name:"Sea Cat",revision:1,updated_at:Date.now(),state:{name:"Sea Cat",launch:{name:"Sea Cat",symbol:"SEA",description:"",stockMint:"",rewardMode:"holder_rewards",imagePath:"",xUrl:"",websiteUrl:"",telegramUrl:"",dexFundingEnabled:false,dexProfile:{description:"",bannerUrl:"",websiteUrl:"",xUrl:"",telegramUrl:""}},files:[{path:"frontend/index.html",content:"<main>Sea Cat</main>",encoding:"utf8",locked:false}],folders:[],lockedFields:[]}};
  await page.addInitScript(({wallet,token}) => {
    localStorage.setItem("aqua:update:holder-workspace-v2","seen");
    localStorage.setItem("aqua:wallet","phantom");
    localStorage.setItem(`aqua:studio:${wallet}`,JSON.stringify({token,expiresAt:Date.now()+86400000}));
    Object.assign(window,{phantom:{solana:{isPhantom:true,publicKey:{toString:()=>wallet},connect:async()=>({publicKey:{toString:()=>wallet}}),on(){},removeListener(){}}}});
  },{wallet,token});
  await page.route("**/api/config",r=>r.fulfill({json:{brand:"AQUA",network:"mainnet-beta",useTestnet:false,transactionsEnabled:false,marketGovernanceEnabled:false,publicRpcUrl:"https://rpc.invalid",whirlpools:{},fees:{transferFeeBps:200,platformBps:100,stockRewardsBps:100},creatorLocks:{minimumSeconds:86400,maximumSeconds:31536000,maximumFeeShareBps:5000},sniperDefense:{supported:false}}}));
  await page.route("**/api/launches?**",r=>r.fulfill({json:{launches:[],hasMore:false,nextOffset:0}}));
  await page.route("**/api/governance**",r=>r.fulfill({json:{enabled:false}}));
  await page.route("**/api/notifications/**",r=>r.fulfill({json:{notifications:[]}}));
  await page.route("**/api/market-prices**",r=>r.fulfill({json:{prices:[]}}));
  await page.route("**/account/**",r=>r.fulfill({json:{enabled:false,connected:false}}));
  await page.route("https://rpc.invalid/**",r=>r.fulfill({json:{jsonrpc:"2.0",id:r.request().postDataJSON().id,result:{context:{slot:1},value:0}}}));
  await page.route("**/studio/**",async r=>{
    const path = new URL(r.request().url()).pathname.replace(/^.*\/studio/,"");
    if(path === "/config") return r.fulfill({json:{enabled:true,paidEnabled:true,surveySupported:true,setup:{ready:true,issues:[]},depositsEnabled:false,depositSetup:{ready:false,issues:[]},decimals:6,model:"test",imageModel:"test",knowledge:{pairs:[]},hosting:{enabled:true,domain:"aquafamily.fun",prefix:"stg-"}}});
    if(path === "/promotion") return r.fulfill({json:{active:false}});
    if(path === "/account") return r.fulfill({json:{balanceMicroUsd:"100000000",ledger:[]}});
    if(path === "/projects") return r.fulfill({json:[project]});
    if(path === `/projects/${id}`) {
      if(r.request().method() === "POST") { project.state=r.request().postDataJSON().state;project.revision++; }
      return r.fulfill({json:project});
    }
    if(path.endsWith("/survey")) {
      const input=r.request().postDataJSON();flow.surveys.push(input);
      if(flow.surveyFail)return r.fulfill({status:502,json:{error:"Atlantis couldn't prepare the survey. Try again, or turn on Skip survey to continue with your brief."}});
      const image=input.prompt.includes("banner");
      return r.fulfill({json:{task:flow.chat?"chat":image?"image":"website",title:image?"Sea Cat DEX banner":"Sea Cat's underwater playground",questions:flow.chat?[]:image?[{id:"q1",question:"Where should Sea Cat sit in the banner?",options:[{label:"Surfing on the right",description:"Leave open water for the name on the left."},{label:"Centre of the wave",description:"Make the character the entire focus."}]}]:[{id:"q1",question:"How should Sea Cat's underwater world feel?",options:[{label:"Hand-painted storybook",description:"Soft coral colours and paper textures."},{label:"Arcade aquarium",description:"Chunky pixel art with playful bubbles."}]},{id:"q2",question:"How should the swimming cat move?",options:[{label:"Follow the cursor",description:"Sea Cat swims gently towards visitors."},{label:"Swim on click",description:"A click sends Sea Cat across the reef."}]},{id:"q3",topic:"contract_address",question:"Should the contract address appear on Sea Cat's site?",options:[{label:"Fill it when I launch",description:"Show the CA and let Atlantis fill it automatically after launch."},{label:"I will set it manually",description:"Show the CA using the value I set in Variables."},{label:"No CA on the site",description:"Keep the website focused on the character."}]}]}});
    }
    if(path.endsWith("/quote")) {
      const input=r.request().postDataJSON();flow.quotes.push(input);
      if(flow.quoteFail)return r.fulfill({status:503,json:{error:"Quote temporarily unavailable"}});
      return r.fulfill({json:{id:"survey-job",effort:input.effort,maximumMicroUsd:"100",creditExempt:true}});
    }
    if(path.endsWith("/jobs")) {
      if(r.request().method()==="POST"){
        const quote=flow.quotes.at(-1);flow.jobs.push({id:"survey-job",project_id:id,revision:project.revision,status:"queued",kind:"auto",prompt:quote.prompt,survey_answers:quote.surveyAnswers,effort:quote.effort,created_at:Date.now(),reserved_micro_usd:"100",charged_raw:"0",reserved_raw:"0"});
        return r.fulfill({json:{id:"survey-job",status:"queued"}});
      }
      return r.fulfill({json:flow.jobs});
    }
    if(path.endsWith("/hosting"))return r.fulfill({json:{enabled:true,domain:"aquafamily.fun",prefix:"",site:null}});
    return r.fulfill({status:404,json:{error:"Unexpected test route "+path}});
  });
  await page.goto("/#/");
  await expect(page.locator(".wallet-menu-trigger")).toBeVisible();
  await page.goto("/#/studio");
  await expect(page.getByLabel("Message Atlantis")).toBeVisible();
  return flow;
}

const surveyDialog=(page:Page)=>page.getByRole("dialog",{name:"A few creative choices"});
async function send(page:Page,prompt:string){await page.getByLabel("Message Atlantis").fill(prompt);await page.getByRole("button",{name:"Send message",exact:true}).click();}
test("website survey waits for answers, supports custom text and back navigation, and submits one brief",async({page},info)=>{
 const flow=await setup(page);await send(page,"Build a website for Sea Cat with an interactive swimming mascot");
 const dialog=surveyDialog(page);await expect(dialog).toBeVisible();expect(flow.quotes).toHaveLength(0);expect(flow.jobs).toHaveLength(0);
 await expect(dialog.getByRole("button",{name:"Next",exact:true})).toBeDisabled();
 await dialog.getByRole("radio",{name:/Hand-painted storybook/}).check();await dialog.getByRole("button",{name:"Next",exact:true}).click();
 await dialog.getByRole("radio",{name:/My own answer/}).check();await dialog.getByLabel("Your custom answer").fill("The cat should chase a glowing fish when you tap the reef.");
 await dialog.getByRole("button",{name:"Previous question"}).click();await expect(dialog.getByRole("radio",{name:/Hand-painted storybook/})).toBeChecked();await dialog.getByRole("button",{name:"Next",exact:true}).click();
 await expect(dialog.getByLabel("Your custom answer")).toHaveValue("The cat should chase a glowing fish when you tap the reef.");
 await dialog.screenshot({path:`/tmp/atlantis-survey-custom-${info.project.name}.png`});
 await dialog.getByRole("button",{name:"Next",exact:true}).click();await dialog.getByRole("radio",{name:/I will set it manually/}).check();
 await dialog.getByRole("button",{name:"Start creating"}).click();await expect(dialog).toHaveCount(0);
 await expect.poll(()=>flow.jobs.length).toBe(1);expect(flow.surveys).toHaveLength(1);expect(flow.quotes[0]).toMatchObject({prompt:"Build a website for Sea Cat with an interactive swimming mascot",surveyAnswers:[{question:"How should Sea Cat's underwater world feel?",answer:"Hand-painted storybook: Soft coral colours and paper textures."},{question:"How should the swimming cat move?",answer:"The cat should chase a glowing fish when you tap the reef."},{topic:"contract_address",question:"Should the contract address appear on Sea Cat's site?",answer:"I will set it manually: Show the CA using the value I set in Variables."}]});
 await page.getByText("Creative choices",{exact:true}).click();await expect(page.locator('.at-survey-answers')).toContainText("chase a glowing fish");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test("image requests get artwork choices and skipping a survey never sends unchosen options",async({page},info)=>{
 const flow=await setup(page);await send(page,"Create a DEX banner for Sea Cat");const dialog=surveyDialog(page);await expect(dialog.getByRole("heading",{name:"Where should Sea Cat sit in the banner?"})).toBeVisible();await expect(dialog.getByText(/contract address/)).toHaveCount(0);
 await dialog.screenshot({path:`/tmp/atlantis-survey-image-${info.project.name}.png`});
 await dialog.getByRole("radio",{name:/Surfing on the right/}).check();await dialog.getByRole("button",{name:"Skip this survey"}).click();await expect.poll(()=>flow.jobs.length).toBe(1);expect(flow.quotes[0].surveyAnswers).toEqual([]);await expect(page.getByRole("switch",{name:"Skip survey",exact:true})).not.toBeChecked();
});
test("skip survey preference persists alongside auto-apply and bypasses the planner",async({page})=>{
 const flow=await setup(page);await page.getByRole("switch",{name:"Skip survey",exact:true}).check();await page.getByRole("switch",{name:"Auto-apply edits"}).check();await page.reload();await expect(page.getByRole("switch",{name:"Skip survey",exact:true})).toBeChecked();await expect(page.getByRole("switch",{name:"Auto-apply edits"})).toBeChecked();
 await send(page,"Draw a Sea Cat coin icon");await expect.poll(()=>flow.jobs.length).toBe(1);expect(flow.surveys).toHaveLength(0);expect(flow.quotes[0].surveyAnswers).toEqual([]);
});
test("closing or failing the survey restores the original draft without a generation",async({page})=>{
 const flow=await setup(page);const brief="Create a Sea Cat DEX banner";await send(page,brief);await surveyDialog(page).getByRole("button",{name:"Close dialog"}).click();await expect(page.getByLabel("Message Atlantis")).toHaveValue(brief);expect(flow.jobs).toHaveLength(0);expect(flow.quotes).toHaveLength(0);
 flow.surveyFail=true;await page.getByRole("button",{name:"Send message",exact:true}).click();await expect(page.getByLabel("Message Atlantis")).toHaveValue(brief);await expect(page.getByText(/Atlantis couldn't prepare the survey/)).toBeVisible();expect(flow.jobs).toHaveLength(0);
 await page.getByRole("switch",{name:"Skip survey",exact:true}).check();await page.getByRole("button",{name:"Send message",exact:true}).click();await expect.poll(()=>flow.jobs.length).toBe(1);
});
test("survey answers survive a quote failure and chat requests go straight through",async({page})=>{
 const flow=await setup(page);flow.chat=true;await send(page,"What is a CA?");await expect.poll(()=>flow.jobs.length).toBe(1);await expect(surveyDialog(page)).toHaveCount(0);expect(flow.quotes[0].surveyAnswers).toEqual([]);
 flow.jobs.length=0;flow.chat=false;flow.quoteFail=true;await page.reload();await send(page,"Create a DEX banner for Sea Cat");const dialog=surveyDialog(page);await dialog.getByRole("radio",{name:/Centre of the wave/}).check();await dialog.getByRole("button",{name:"Start creating"}).click();await expect(page.getByLabel("Message Atlantis")).toHaveValue("Create a DEX banner for Sea Cat");expect(flow.jobs).toHaveLength(0);
 flow.quoteFail=false;await page.getByRole("button",{name:"Send message",exact:true}).click();await expect.poll(()=>flow.jobs.length).toBe(1);expect(flow.surveys).toHaveLength(2);expect(flow.quotes.at(-1).surveyAnswers).toEqual([{question:"Where should Sea Cat sit in the banner?",answer:"Centre of the wave: Make the character the entire focus."}]);
});
