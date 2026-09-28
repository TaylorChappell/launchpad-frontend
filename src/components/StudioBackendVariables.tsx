import { useEffect, useId, useRef, useState } from "react";
import { Check, KeyRound, Plus, Trash2, Undo2 } from "lucide-react";
import { studioRequest } from "../studio-api";

type Configuration = {revision:number;variables:Record<string,string>;secrets:Array<{name:string;configured:boolean}>};
type Operation = {name:string;kind:"variable"|"secret";action:"set"|"generate"|"remove";value?:string};
export function StudioBackendVariables({projectId,token,busy,run,onDirtyChange}:{projectId:string;token:string;busy:boolean;run:(label:string,action:()=>Promise<void>)=>Promise<void>;onDirtyChange?:(dirty:boolean)=>void}) {
  const [config,setConfig]=useState<Configuration|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[reload,setReload]=useState(0);
  const [draft,setDraft]=useState<Record<string,Operation>>({}),[adding,setAdding]=useState(false),[name,setName]=useState(""),[value,setValue]=useState("");
  const beforeRemoval=useRef<Record<string,Operation|undefined>>({});
  const [kind,setKind]=useState<"variable"|"secret">("secret"),[generate,setGenerate]=useState(false);
  const uid=useId(),dirty=Object.keys(draft).length>0||Boolean(name||value);
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);
  useEffect(()=>{
    const controller=new AbortController();setConfig(null);setError("");setDraft({});
    studioRequest<Configuration>(`/projects/${projectId}/private-config`,token,undefined,undefined,controller.signal)
      .then(next=>{if(!controller.signal.aborted)setConfig(next);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Could not load backend settings.");});
    return()=>controller.abort();
  },[projectId,token,reload]);
  if(!config)return <div>{error?<><p role="alert">{error}</p><button onClick={()=>setReload(n=>n+1)}>Reload settings</button></>:<p role="status">Loading backend settings…</p>}</div>;
  const saved=[...Object.keys(config.variables).map(name=>({name,kind:"variable" as const,configured:true})),...config.secrets.map(item=>({...item,kind:"secret" as const}))];
  const entries=[...saved,...Object.values(draft).filter(op=>!saved.some(item=>item.name===op.name)).map(op=>({name:op.name,kind:op.kind,configured:false}))];
  const stage=(operation:Operation)=>{if(operation.action==="remove")beforeRemoval.current[operation.name]=draft[operation.name];setDraft(old=>({...old,[operation.name]:operation}));setNotice("");};
  const undo=(name:string)=>setDraft(old=>{const next={...old};const prior=old[name]?.action==="remove"?beforeRemoval.current[name]:undefined;if(prior)next[name]=prior;else delete next[name];return next;});
  const invalid=Object.values(draft).some(op=>op.kind==="secret"&&op.action==="set"&&!op.value?.trim());
  return <div className="at-backend-variables">
    <div className="at-private-note"><KeyRound size={18}/><p>Only your backend can read these values. Saved secrets stay hidden and are excluded from exports.</p></div>
    <fieldset className="at-variables-fields" disabled={busy}>
      {!entries.length&&<div className="at-config-empty"><strong>Your app’s private settings</strong><p>Add API credentials here. Atlantis can create required fields and generate secrets for your app.</p></div>}
      {entries.map(item=>{const change=draft[item.name],removed=change?.action==="remove";return <section className={`at-variable-section ${removed?"at-variable-removed":""}`} key={item.name}>
        <div className="at-variable-heading"><label htmlFor={uid+item.name}>{item.name}</label><span className="at-config-badge">{removed?"Will be removed":change?"Unsaved":item.kind==="secret"&&!item.configured?"Required":item.kind==="secret"?"Secret":"Variable"}</span></div>
        {removed?<p>Removed when you save. <button type="button" onClick={()=>undo(item.name)}><Undo2 size={13}/>Undo</button></p>:<>
          {change?.action==="generate"?<p>A random secret will be generated when you save.</p>:<div className="at-private-input"><input id={uid+item.name} type={item.kind==="secret"?"password":"text"} value={change?.value??(item.kind==="variable"?config.variables[item.name]??"":"")} maxLength={item.kind==="secret"?8192:2000} autoComplete="off" spellCheck={false} placeholder={item.configured?"Enter a replacement value":"Enter required value"} onChange={e=>stage({name:item.name,kind:item.kind,action:"set",value:e.target.value})}/><button type="button" aria-label={"Remove "+item.name} onClick={()=>saved.some(value=>value.name===item.name)?stage({name:item.name,kind:item.kind,action:"remove"}):undo(item.name)}><Trash2 size={16}/></button></div>}
          {change&&<button type="button" className="at-variable-undo" onClick={()=>undo(item.name)}><Undo2 size={13}/>Discard this change</button>}
          <small className={item.configured?"at-secret-ready":"at-secret-missing"}>{change?"Ready to save · publish afterwards to apply":item.configured?<><Check size={13}/>Configured</>:"Required before publishing"}</small>
        </>}
      </section>;})}
      {adding?<section className="at-variable-new">
        <div className="at-ca-mode" role="group" aria-label="Backend value type"><button type="button" aria-pressed={kind==="secret"} onClick={()=>setKind("secret")}>Secret</button><button type="button" aria-pressed={kind==="variable"} onClick={()=>{setKind("variable");setGenerate(false);}}>Variable</button></div>
        <label htmlFor={uid+"name"}>Name<input id={uid+"name"} value={name} maxLength={64} placeholder={kind==="secret"?"API_KEY":"APP_NAME"} autoFocus autoComplete="off" spellCheck={false} onChange={e=>setName(e.target.value.toUpperCase())}/></label>
        {kind==="secret"&&<label className="at-generate-secret"><input type="checkbox" checked={generate} onChange={e=>{setGenerate(e.target.checked);setValue("");}}/>Generate a random app secret</label>}
        {!generate&&<label htmlFor={uid+"value"}>Value<input id={uid+"value"} type={kind==="secret"?"password":"text"} value={value} maxLength={kind==="secret"?8192:2000} autoComplete="off" spellCheck={false} placeholder={kind==="secret"?"Paste the key from your provider’s developer dashboard":"Enter backend value"} onChange={e=>setValue(e.target.value)}/></label>}
        <div className="at-variable-new-actions"><button type="button" disabled={!name.trim()||(!generate&&kind==="secret"&&!value.trim())} onClick={()=>{
          const key=name.trim();if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(key)){setError("Use letters, numbers and underscores. Start with a letter.");return;}
          if(entries.some(item=>item.name===key)){setError("That name already has a field above.");return;}
          stage({name:key,kind,action:generate?"generate":"set",...(!generate?{value}:{})});setName("");setValue("");setAdding(false);setError("");
        }}>Add to changes</button><button type="button" onClick={()=>{setAdding(false);setName("");setValue("");setError("");}}>Cancel</button></div>
      </section>:<button type="button" className="at-variable-add-button" disabled={entries.length>=48} onClick={()=>{setAdding(true);setError("");}}><Plus size={15}/>Add backend value</button>}
      {error&&<p role="alert" className="at-variable-error">{error}</p>}
      <div className="at-variables-footer"><div><span role="status" className="at-variable-save-state">{notice||(dirty?"Unsaved changes":"Settings saved")}</span><small>Save, then publish to apply your changes.</small></div><button type="button" className="at-primary" disabled={!Object.keys(draft).length||invalid||Boolean(name||value)} onClick={()=>void run("Saving backend settings",async()=>{
        setError("");const next=await studioRequest<Configuration>(`/projects/${projectId}/private-config`,token,{revision:config.revision,operations:Object.values(draft)},"PUT");
        setConfig(next);setDraft({});beforeRemoval.current={};setNotice("Saved · publish to apply");
      })}>Save changes</button></div>
      {invalid&&<p role="alert">Enter a value for each changed secret, or remove it explicitly.</p>}
    </fieldset>
  </div>;
}
