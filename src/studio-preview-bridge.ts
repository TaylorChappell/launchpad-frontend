export type PreviewStorage = {local:Record<string,string>; session:Record<string,string>};
export type PreviewBridgeOptions = {channel:string; location:string; storage?:PreviewStorage};

// Runs only inside the sandbox. No access to AQUA's wallet, storage or DOM.
export function studioPreviewBridge(options: PreviewBridgeOptions) {
  const send = (kind:string, data:Record<string,unknown>) => parent.postMessage({type:"aqua-preview",channel:options.channel,kind,...data},"*");
  const errors:string[]=[];
  addEventListener("error",event=>errors.push("Script error: "+event.message));
  addEventListener("unhandledrejection",event=>errors.push("Unhandled promise: "+String(event.reason?.message??event.reason)));
  const check=()=>{
    const issues:string[]=[...errors];
    if(document.documentElement.scrollWidth>window.innerWidth+2)issues.push("Content overflows the preview width. Check mobile layout.");
    for(const img of Array.from(document.images))if(img.complete&&!img.naturalWidth)issues.push("Image did not load: "+(img.alt||"unnamed image"));
    for(const el of Array.from(document.querySelectorAll("button,input,select,textarea")))if(!el.textContent?.trim()&&!el.getAttribute("aria-label")&&!(el as HTMLElement).id&&!el.getAttribute("placeholder"))issues.push("An interactive control needs an accessible label.");
    send("quality",{issues});
  };
  addEventListener("message",event=>{if(event.source===parent&&event.data?.type==="aqua-preview-check"&&event.data.channel===options.channel)check();});
  addEventListener("load",check);
  addEventListener("message",async event=>{
    if(event.source!==parent||event.data?.type!=="aqua-preview-exercise"||event.data.channel!==options.channel)return;
    const issues:string[]=[];
    const controls=Array.from(document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input[type="submit"],input[type="button"]')).slice(0,50);
    let exercised=0;
    for(const control of controls){
      if(control.disabled||!control.getClientRects().length)continue;
      const label=control.getAttribute("aria-label")||control.textContent?.trim()||control.getAttribute("value")||"Unnamed control";
      const form=control.closest("form");
      if(form)for(const field of Array.from(form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>("input,textarea,select"))){
        if(field instanceof HTMLInputElement&&["hidden","file","submit","button","password"].includes(field.type))continue;
        if(field instanceof HTMLInputElement&&["checkbox","radio"].includes(field.type))field.checked=true;
        else if(field instanceof HTMLSelectElement){if(field.options.length)field.value=field.options[field.options.length-1].value;}
        else if(!field.value)field.value=field instanceof HTMLInputElement&&field.type==="email"?"preview@example.invalid":field instanceof HTMLInputElement&&field.type==="number"?"1":"Preview example";
        field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("change",{bubbles:true}));
      }
      const before=document.body.innerHTML;
      let changed=false;const observer=new MutationObserver(()=>{changed=true;});observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
      control.click();exercised++;
      await new Promise(resolve=>setTimeout(resolve,150));
      observer.disconnect();
      if(!changed&&document.body.innerHTML===before)issues.push('Review "'+label.slice(0,70)+'": no visible response detected. Downloads, navigation and backend-only actions require separate verification.');
    }
    if(document.querySelectorAll("button,input[type=submit],input[type=button]").length>50)issues.push("More than 50 controls: inspect the remaining controls manually.");
    issues.push(...errors);
    if(document.documentElement.scrollWidth>innerWidth+2)issues.push("Horizontal overflow after interaction.");
    send("exercise",{issues,exercised,forms:document.forms.length});
  });
  addEventListener("securitypolicyviolation",()=>send("notice",{message:"A resource or backend request was blocked by the isolated preview. Deploy the backend and configure API_BASE_URL to test network features."}));
  let current = options.location;
  const scroll = (hash:string) => {
    if (!hash) { window.scrollTo(0,0); return; }
    let name = hash.slice(1);
    try { name = decodeURIComponent(name); } catch { /* Use the literal fragment. */ }
    const target = document.getElementById(name) ?? Array.from(document.getElementsByName(name))[0];
    target?.scrollIntoView();
  };
  addEventListener("message",event => {
    if (event.source !== parent || event.data?.type !== "aqua-preview-scroll" || event.data.channel !== options.channel) return;
    if (typeof event.data.location === "string") current = event.data.location;
    scroll(typeof event.data.hash === "string" ? event.data.hash : "");
  });
  const click = (event:MouseEvent) => {
    if (event.defaultPrevented || event.button > 1) return;
    const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!anchor?.hasAttribute("href")) return;
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (anchor.hasAttribute("download")) { send("notice",{message:"Download this file from Images & assets or Export."}); return; }
    if (!href || href === "#") return;
    send("navigate",{href,from:current});
  };
  // Bubble after the page's own handlers so functional custom controls keep
  // their behavior. Navigation stays in the project's virtual file tree.
  addEventListener("click",click);
  addEventListener("auxclick",click);
  addEventListener("submit",event => {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    const form = event.target;
    const action = (event as SubmitEvent).submitter?.getAttribute("formaction") ?? form.getAttribute("action");
    if (!action || form.method.toLowerCase() !== "get") {
      send("notice",{message:"This form needs a working submit handler or a deployed backend. Ask Atlantis to connect it."});
      return;
    }
    const url = new URL(action,"https://studio-preview.invalid/"+current.replace(/^frontend\//,""));
    for (const [key,value] of new FormData(form)) if (typeof value === "string") url.searchParams.append(key,value);
    send("navigate",{href:url.origin === "https://studio-preview.invalid" ? url.pathname+url.search+url.hash : url.href,from:current});
  });
  history.back = () => send("history",{delta:-1});
  history.forward = () => send("history",{delta:1});
  history.go = (delta=0) => send("history",{delta});
  addEventListener("error",event => send("notice",{message:"This page’s script failed: "+(event.message || "Unknown script error")}));
  addEventListener("unhandledrejection",event => send("notice",{message:"This page’s script failed: "+String(event.reason?.message ?? event.reason ?? "Unknown script error")}));
  // Sandboxed documents have no origin-backed storage. Give local-only widgets
  // an isolated, size-limited preview store that survives page navigation.
  for (const [name,scope] of [["localStorage","local"],["sessionStorage","session"]] as const) {
    try { void window[name].length; } catch {
      let values = {...options.storage?.[scope]};
      const persist = () => send("storage",{scope,values});
      const store = {
        get length() { return Object.keys(values).length; },
        key: (index:number) => Object.keys(values)[index] ?? null,
        getItem: (key:string) => Object.prototype.hasOwnProperty.call(values,String(key)) ? values[String(key)] : null,
        setItem: (key:string,value:string) => {
          const next = {...values,[String(key)]:String(value)};
          if (JSON.stringify(next).length > 65536) throw new DOMException("Preview storage is full","QuotaExceededError");
          values = next; persist();
        },
        removeItem: (key:string) => { delete values[String(key)]; persist(); },
        clear: () => { values = {}; persist(); },
      };
      Object.defineProperty(window,name,{value:store,configurable:true});
    }
  }
}
