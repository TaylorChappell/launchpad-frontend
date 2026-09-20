import {useEffect,useMemo,useRef,useState} from "react";
import type {StudioFile} from "../studio-api";
import {studioPreview} from "../studio-preview";
import {studioPreviewPages} from "../studio-preview-paths";
export function StudioPreviewChecks({files}:{files:StudioFile[]}){
  const [running,setRunning]=useState(false),[index,setIndex]=useState(0),[findings,setFindings]=useState<string[]>([]),[tested,setTested]=useState(0);
  const cases=useMemo(()=>studioPreviewPages(files).slice(0,20).flatMap(path=>[1280,390].map(width=>({path,width}))),[files]);
  const current=cases[index],frame=useRef<HTMLIFrameElement>(null);
  const [channel]=useState(()=>crypto.randomUUID());
  const html=useMemo(()=>running&&current?studioPreview(files,current.path,{channel,location:current.path,storage:{local:{},session:{}}}):"",[files,running,index,channel]);
  useEffect(()=>{setRunning(false);setIndex(0);setFindings([]);setTested(0);},[files]);
  useEffect(()=>{
    if(!running||!current)return;
    let started=false,finished=false;
    const label=current.path+" ("+current.width+"px)";
    const complete=()=>{if(finished)return;finished=true;setTested(v=>v+1);if(index+1<cases.length)setIndex(v=>v+1);else setRunning(false);};
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.data?.type!=="aqua-preview"||event.data.channel!==channel)return;
      const data=event.data;
      if(data.kind==="quality"||data.kind==="exercise")setFindings(old=>[...new Set([...old,...(Array.isArray(data.issues)?data.issues.filter((v:unknown)=>typeof v==="string").slice(0,60).map((v:string)=>label+": "+v):[])])]);
      if(data.kind==="notice"&&typeof data.message==="string")setFindings(old=>[...new Set([...old,label+": "+data.message.slice(0,300)])]);
      if(data.kind==="quality"&&!started){started=true;frame.current?.contentWindow?.postMessage({type:"aqua-preview-exercise",channel},"*");}
      if(data.kind==="exercise")complete();
    };
    window.addEventListener("message",receive);
    const timer=window.setTimeout(()=>{setFindings(old=>[...old,label+": test timed out or the page navigated outside its preview. Inspect manually."]);complete();},15_000);
    return()=>{window.removeEventListener("message",receive);window.clearTimeout(timer);};
  },[running,index,cases,channel]);
  return <div><button type="button" onClick={()=>{if(running){setRunning(false);return;}setFindings([]);setIndex(0);setTested(0);setRunning(true);}}>{running?"Stop checks":"Test pages & controls"}</button>
    <p role="status">{running?"Checking "+current?.path+"…":tested?"Checked "+tested+" page/viewport combinations. "+findings.length+" items need review.":"Run links, assets, scripts, mobile overflow and visible control smoke checks in disposable isolated previews."}</p>
    <p>At most 20 pages and 50 controls per page. A visible response is not proof of correct behavior. Network calls, wallet actions, payments and deployed backends are not tested.</p>
    <ul>{findings.map((finding,i)=><li key={i}>{finding}</li>)}</ul>
    {running&&current&&<iframe key={index} ref={frame} title="Disposable website quality test" aria-hidden="true" tabIndex={-1} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={html} style={{position:"fixed",left:-10000,top:0,width:current.width,height:850,opacity:0,pointerEvents:"none"}}/>}
  </div>;
}
