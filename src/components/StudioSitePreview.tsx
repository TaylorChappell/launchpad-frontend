import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react";
import type { StudioFile } from "../studio-api";
import { studioPreview } from "../studio-preview";
import { studioPreviewPages, studioPreviewTarget } from "../studio-preview-paths";
import type { PreviewStorage } from "../studio-preview-bridge";

export function StudioSitePreview({files,variables,mobile=false}:{files:StudioFile[];variables?:Record<string,string>;mobile?:boolean}) {
  const viewport=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(0);
  useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(element);return()=>observer.disconnect();},[]);
  const frameWidth=mobile?375:1440,frameHeight=mobile?812:1000;
  const scale=width?Math.min(1,width/frameWidth):1;
  const pages = useMemo(() => studioPreviewPages(files),[files]);
  const [history,setHistory] = useState({entries:[pages[0] ?? "frontend/index.html"],index:0});
  const [reload,setReload] = useState(0), [notice,setNotice] = useState("");
  const [channel] = useState(() => crypto.randomUUID());
  const frame = useRef<HTMLIFrameElement>(null);
  const storage = useRef<PreviewStorage>({local:{},session:{}});
  const stored = history.entries[history.index];
  const current = studioPreviewTarget(files,"/"+stored.replace(/^frontend\//,""))
    ?? {path:pages[0] ?? "frontend/index.html",search:"",hash:"",location:pages[0] ?? "frontend/index.html"};
  const location = current.location;
  const compiled = useMemo(() => {
    const issues:string[] = [];
    return {html:studioPreview(files,current.path,{variables,channel,location:current.path+current.search,storage:storage.current,onIssue:issue=>issues.push(issue)}),issues};
  },[files,variables,current.path,current.search,channel,reload]);
  const scroll = useCallback(() => frame.current?.contentWindow?.postMessage({type:"aqua-preview-scroll",channel,hash:current.hash,location},"*"),[channel,current.hash,location]);
  useEffect(scroll,[scroll]);
  const move = useCallback((delta:number) => {
    setNotice("");
    if (delta === 0) setReload(value=>value+1);
    else setHistory(value=>({...value,index:Math.max(0,Math.min(value.entries.length-1,value.index+delta))}));
  },[]);
  const navigate = useCallback((href:string) => {
    const target = studioPreviewTarget(files,href,location);
    if (!target) {
      setNotice(/^[a-z][a-z\d+.-]*:|^\/\//i.test(href) ? "External links are available from your exported website." : `This page is missing from the project: ${href.slice(0,180)}. Ask Atlantis to add it or fix the link.`);
      return;
    }
    setNotice("");
    if (target.location === location) { scroll(); return; }
    setHistory(value=>({entries:[...value.entries.slice(0,value.index+1),target.location],index:value.index+1}));
  },[files,location,scroll]);
  useEffect(() => {
    const receive = (event:MessageEvent) => {
      const data = event.data;
      if (event.source !== frame.current?.contentWindow || data?.type !== "aqua-preview" || data.channel !== channel) return;
      if (data.kind === "navigate" && typeof data.href === "string") navigate(data.href);
      if (data.kind === "history" && Number.isSafeInteger(data.delta)) move(data.delta);
      if (data.kind === "notice" && typeof data.message === "string") setNotice(data.message.slice(0,300));
      if (data.kind === "storage" && (data.scope === "local" || data.scope === "session") && data.values && typeof data.values === "object" && !Array.isArray(data.values)) {
        const entries = Object.entries(data.values);
        if (entries.every(([,value])=>typeof value === "string") && JSON.stringify(data.values).length <= 65536)
          storage.current[data.scope as keyof PreviewStorage] = Object.fromEntries(entries) as Record<string,string>;
      }
    };
    window.addEventListener("message",receive);
    return () => window.removeEventListener("message",receive);
  },[channel,navigate,move]);
  return <div className="at-site-preview">
    {pages.length > 1 && <div className="at-preview-nav" aria-label="Preview navigation">
      <button type="button" aria-label="Previous preview page" disabled={history.index===0} onClick={()=>move(-1)}><ArrowLeft size={15}/></button>
      <button type="button" aria-label="Next preview page" disabled={history.index>=history.entries.length-1} onClick={()=>move(1)}><ArrowRight size={15}/></button>
      <select aria-label="Preview page" value={current.path} onChange={event=>navigate("/"+event.target.value.replace(/^frontend\//,""))}>
        {pages.map(path=><option key={path} value={path}>{path.replace(/^frontend\//,"")}</option>)}
      </select>
      <button type="button" aria-label="Reload preview page" onClick={()=>move(0)}><RotateCw size={14}/></button>
    </div>}
    {(notice || compiled.issues.length > 0) && <div className="at-preview-notice" role="status"><span>{notice || compiled.issues[0]}</span>{notice && <button type="button" aria-label="Dismiss preview message" onClick={()=>setNotice("")}><X size={14}/></button>}</div>}
    <div className="at-preview-viewport" ref={viewport} style={{height:frameHeight*scale}}><iframe style={{width:frameWidth,height:frameHeight,transform:`scale(${scale})`}} title="Isolated website preview" ref={frame} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={compiled.html} onLoad={scroll}/></div>
  </div>;
}
