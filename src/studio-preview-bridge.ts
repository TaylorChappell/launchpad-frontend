export type PreviewStorage = {local:Record<string,string>; session:Record<string,string>};
export type PreviewBridgeOptions = {channel:string; location:string; storage?:PreviewStorage};

// Runs only inside the sandbox. No access to AQUA's wallet, storage or DOM.
export function studioPreviewBridge(options: PreviewBridgeOptions) {
  const send = (kind:string, data:Record<string,unknown>) => parent.postMessage({type:"aqua-preview",channel:options.channel,kind,...data},"*");
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
