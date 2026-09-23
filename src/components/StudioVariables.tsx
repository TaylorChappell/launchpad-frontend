import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { studioRequest, type StudioProject, type StudioHosting, type StudioState } from "../studio-api";

type Props = {
  project: StudioProject;
  state: StudioState;
  edit: (change: (old: StudioState) => StudioState) => void;
  token: string;
  dirty: boolean;
  busy: boolean;
  hasBackend: boolean;
  save: () => Promise<StudioProject | null>;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
};
export function StudioVariables({ project, state, edit, token, dirty, busy, hasBackend, save, run }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [newVariable, setNewVariable] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const inputId = useId();
  const variables = state.frontendVariables ?? {};
  const customKeys = Object.keys(variables).filter(key => !["TOKEN_CA","BACKEND_URL","API_BASE_URL"].includes(key));
  const automatic = state.autoFillCA === true;
  const backendUrl = variables.BACKEND_URL ?? variables.API_BASE_URL ?? "";
  const backendValid = (() => { if (!backendUrl) return true; try { const url = new URL(backendUrl); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } })();
  const setVariable = (key: string, value: string) => edit(old => ({...old,frontendVariables:{...old.frontendVariables,[key]:value,...(key === "BACKEND_URL" ? {API_BASE_URL:value} : {})}}));
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setError(""); setSupported(null);
    studioRequest<StudioHosting>(`/projects/${project.id}/hosting`, token, undefined, undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) setSupported(value.configurationSupported === true);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load variables."); });
    return () => { mounted.current = false; controller.abort(); };
  }, [project.id, token, reload]);
  if (error) return <div><p role="alert">{error}</p><button onClick={() => setReload(value => value + 1)}>Try again</button></div>;
  if (supported === null) return <p role="status">Loading variables…</p>;
  return <div className="at-variables">
    <p className="at-variables-intro">Your website’s settings, all in one place.</p>
    {!supported && <p role="alert">Update the staging backend to edit variables.</p>}
    <fieldset className="at-variables-fields" disabled={busy || !supported} aria-label="Website variables">
      <section className="at-variable-section" aria-labelledby={inputId+"-ca-title"}>
        <div className="at-variable-heading"><h3 id={inputId+"-ca-title"}>Contract address</h3><span className="at-variable-key">CA</span></div>
        <div className="at-ca-mode" role="group" aria-label="Contract address mode">
          <button type="button" aria-pressed={!automatic} onClick={()=>{setNotice("");edit(old=>({...old,autoFillCA:false}));}}>Enter manually</button>
          <button type="button" aria-pressed={automatic} onClick={()=>{setNotice("");edit(old=>({...old,autoFillCA:true}));}}>Fill on launch</button>
        </div>
        {automatic ? <p className="at-ca-automatic"><Check size={16}/><span>Atlantis will add your CA after this coin launches.</span></p> :
          <input id={inputId+"-ca"} aria-label="Contract address" value={variables.TOKEN_CA ?? ""} maxLength={2000} placeholder="Paste your contract address" onChange={event=>{setNotice("");setVariable("TOKEN_CA",event.target.value);}} spellCheck={false} autoComplete="off"/>}
      </section>
      <section className="at-variable-section">
        <div className="at-variable-heading"><label htmlFor={inputId+"-backend"}>Backend URL</label><span className="at-variable-optional">{hasBackend ? "API connection" : "Optional"}</span></div>
        <input id={inputId+"-backend"} type="url" value={backendUrl} maxLength={2000} placeholder="https://your-backend.up.railway.app" onChange={event=>{setNotice("");setVariable("BACKEND_URL",event.target.value);}} spellCheck={false} autoComplete="off" aria-invalid={!backendValid} aria-describedby={!backendValid ? inputId+"-url-error" : undefined}/>
        {!backendValid && <p id={inputId+"-url-error"} className="at-variable-error">Enter a public HTTPS URL without a username or password.</p>}
      </section>
      <section className="at-variable-section at-custom-variables">
        <button type="button" className="at-variables-disclosure" aria-expanded={customOpen} aria-controls={inputId+"-custom"} onClick={()=>setCustomOpen(value=>!value)}><span>Other variables{customKeys.length > 0 && <small>{customKeys.length}</small>}</span><ChevronDown size={16}/></button>
        <div id={inputId+"-custom"} hidden={!customOpen}>
          {customKeys.map(key=><div className="at-custom-variable" key={key}>
            <label htmlFor={inputId+key}>{key}</label>
            <div><input id={inputId+key} value={variables[key]} maxLength={2000} placeholder="Value" onChange={event=>{setNotice("");setVariable(key,event.target.value);}} spellCheck={false}/><button type="button" aria-label={"Remove "+key} onClick={()=>{setNotice("");edit(old=>{const next={...old.frontendVariables};delete next[key];return {...old,frontendVariables:next};});}}><Trash2 size={16}/></button></div>
          </div>)}
          {adding ? <div className="at-variable-new">
            <label htmlFor={inputId+"-name"}>Name<input id={inputId+"-name"} aria-label="New variable name" value={newVariable} maxLength={64} placeholder="VARIABLE_NAME" autoFocus onChange={event=>{setNewVariable(event.target.value.toUpperCase());setFieldError("");}}/></label>
            <label htmlFor={inputId+"-value"}>Value<input id={inputId+"-value"} aria-label="New variable value" value={newValue} maxLength={2000} placeholder="Enter a public value" onChange={event=>setNewValue(event.target.value)}/></label>
            {fieldError && <p role="alert" className="at-variable-error">{fieldError}</p>}
            <div className="at-variable-new-actions"><button type="button" disabled={!newVariable.trim()} onClick={()=>{
              const key=newVariable.trim();
              if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(key)) {setFieldError("Use letters, numbers and underscores. Start with a letter.");return;}
              if (/SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN/.test(key)) {setFieldError("Keep secret keys on your backend.");return;}
              if (["TOKEN_CA","BACKEND_URL","API_BASE_URL"].includes(key) || Object.hasOwn(variables,key)) {setFieldError("That variable already has a field above.");return;}
              setVariable(key,newValue);setNewVariable("");setNewValue("");setAdding(false);setNotice("");
            }}>Add</button><button type="button" onClick={()=>{setAdding(false);setFieldError("");}}>Cancel</button></div>
          </div> : <button type="button" className="at-variable-add-button" disabled={Object.keys(variables).length >= 48} onClick={()=>setAdding(true)}><Plus size={15}/>Add variable</button>}
        </div>
      </section>
      <div className="at-variables-footer">
        <div><span className="at-variable-save-state" role="status">{notice || (dirty ? "Unsaved changes" : "All changes saved")}</span><small>Publish saved changes to update your website.</small></div>
        <button type="button" className="at-primary" disabled={!dirty || !backendValid} onClick={()=>void run("Saving variables",async()=>{const saved=await save();if(saved && mounted.current)setNotice("Variables saved");})}>Save variables</button>
      </div>
    </fieldset>
    <p className="at-variables-public">These values are public. Keep passwords and secret keys on your backend.</p>
  </div>;
}
