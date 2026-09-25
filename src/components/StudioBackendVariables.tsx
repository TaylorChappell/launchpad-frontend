import { useEffect, useId, useState } from "react";
import { Check, KeyRound, Plus, Trash2 } from "lucide-react";
import { studioRequest } from "../studio-api";

type Configuration = {revision:number;variables:Record<string,string>;secrets:Array<{name:string;configured:boolean}>};
type Operation = {name:string;kind:"variable"|"secret";action:"set"|"generate"|"remove";value?:string};
export function StudioBackendVariables({projectId,token,busy,run}:{projectId:string;token:string;busy:boolean;run:(label:string,action:()=>Promise<void>)=>Promise<void>}) {
  const [config,setConfig]=useState<Configuration|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [reload,setReload]=useState(0);
  const [values,setValues]=useState<Record<string,string>>({});
  const [adding,setAdding]=useState(false);
  const [name,setName]=useState("");
  const [value,setValue]=useState("");
  const [kind,setKind]=useState<"variable"|"secret">("secret");
  const [generate,setGenerate]=useState(false);
  const uid=useId();
  useEffect(()=>{
    const controller=new AbortController();setConfig(null);setError("");
    studioRequest<Configuration>(`/projects/${projectId}/private-config`,token,undefined,undefined,controller.signal)
      .then(next=>{if(!controller.signal.aborted){setConfig(next);setValues({});}})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Could not load backend settings.");});
    return ()=>controller.abort();
  },[projectId,token,reload]);
  async function commit(operations:Operation[]) {
    if(!config)return;
    setError("");setNotice("");
    await run("Saving backend settings",async()=>{
      const next=await studioRequest<Configuration>(`/projects/${projectId}/private-config`,token,{revision:config.revision,operations},"PUT");
      setConfig(next);setValues({});setValue("");setName("");setAdding(false);setNotice("Saved. Publish to apply these settings.");
    });
  }
  if(!config)return <div>{error?<><p role="alert">{error}</p><button onClick={()=>setReload(n=>n+1)}>Reload settings</button></>:<p role="status">Loading backend settings…</p>}</div>;
  const entries=[...Object.keys(config.variables).map(name=>({name,kind:"variable" as const,configured:true})),...config.secrets.map(item=>({...item,kind:"secret" as const}))];
  return <div className="at-backend-variables">
    <div className="at-private-note"><KeyRound size={18}/><p>Private to your app’s backend. Secret values stay hidden after saving and are excluded from exports.</p></div>
    <fieldset className="at-variables-fields" disabled={busy}>
      {!entries.length&&<div className="at-config-empty"><strong>Your app’s private settings</strong><p>Add an API key or server setting here. Atlantis can also create required fields and generate app secrets as it builds.</p></div>}
      {entries.map(item=><section className="at-variable-section" key={item.name}>
        <div className="at-variable-heading"><label htmlFor={uid+item.name}>{item.name}</label><span className="at-config-badge">{item.kind==="secret"?"Secret":"Variable"}</span></div>
        <div className="at-private-input"><input id={uid+item.name} type={item.kind==="secret"?"password":"text"} value={values[item.name]??(item.kind==="variable"?config.variables[item.name]:"")} maxLength={item.kind==="secret"?8192:2000} autoComplete="off" spellCheck={false} placeholder={item.configured?"Enter a replacement value":"Enter required value"} onChange={e=>{setValues(old=>({...old,[item.name]:e.target.value}));setNotice("");}}/>
          <button type="button" aria-label={"Remove "+item.name} onClick={()=>void commit([{name:item.name,kind:item.kind,action:"remove"}])}><Trash2 size={16}/></button></div>
        {item.kind==="secret"&&<small className={item.configured?"at-secret-ready":"at-secret-missing"}>{item.configured?<><Check size={13}/>Saved securely</>:"Required · add a value before publishing"}</small>}
      </section>)}
      {adding?<section className="at-variable-new">
        <div className="at-ca-mode" role="group" aria-label="Backend value type"><button type="button" aria-pressed={kind==="secret"} onClick={()=>setKind("secret")}>Secret</button><button type="button" aria-pressed={kind==="variable"} onClick={()=>{setKind("variable");setGenerate(false);}}>Variable</button></div>
        <label htmlFor={uid+"name"}>Name<input id={uid+"name"} value={name} maxLength={64} placeholder={kind==="secret"?"API_KEY":"APP_NAME"} autoFocus autoComplete="off" spellCheck={false} onChange={e=>setName(e.target.value.toUpperCase())}/></label>
        {kind==="secret"&&<label className="at-generate-secret"><input type="checkbox" checked={generate} onChange={e=>{setGenerate(e.target.checked);setValue("");}}/>Generate a random app secret</label>}
        {!generate&&<label htmlFor={uid+"value"}>Value<input id={uid+"value"} type={kind==="secret"?"password":"text"} value={value} maxLength={kind==="secret"?8192:2000} autoComplete="off" spellCheck={false} placeholder={kind==="secret"?"Paste your secret value":"Enter backend value"} onChange={e=>setValue(e.target.value)}/></label>}
        <div className="at-variable-new-actions"><button type="button" disabled={!name.trim()||(!generate&&kind==="secret"&&!value.trim())} onClick={()=>{
          const key=name.trim();
          if(!/^[A-Z][A-Z0-9_]{0,63}$/.test(key)){setError("Use letters, numbers and underscores. Start with a letter.");return;}
          if(entries.some(item=>item.name===key)){setError("That name already has a field above.");return;}
          void commit([{name:key,kind,action:generate?"generate":"set",...(!generate?{value}:{})}]);
        }}>Save {kind}</button><button type="button" onClick={()=>{setAdding(false);setValue("");setError("");}}>Cancel</button></div>
      </section>:<button type="button" className="at-variable-add-button" disabled={entries.length>=48} onClick={()=>{setAdding(true);setError("");}}><Plus size={15}/>Add backend value</button>}
      {error&&<p role="alert" className="at-variable-error">{error}</p>}
      <div className="at-variables-footer"><div><span role="status" className="at-variable-save-state">{notice||(Object.keys(values).length?"Unsaved changes":"Settings saved")}</span><small>Used by the next published version of your app.</small></div><button type="button" className="at-primary" disabled={!Object.keys(values).length||entries.some(item=>item.kind==="secret"&&Object.hasOwn(values,item.name)&&!values[item.name].trim())} onClick={()=>void commit(entries.filter(item=>Object.hasOwn(values,item.name)).map(item=>({name:item.name,kind:item.kind,action:"set",value:values[item.name]})))}>Save changes</button></div>
    </fieldset>
  </div>;
}
