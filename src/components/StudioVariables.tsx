import { useEffect, useRef, useState } from "react";
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
  const variables = state.frontendVariables ?? {};
  const variableKeys = [...new Set(["TOKEN_CA", ...(hasBackend ? ["BACKEND_URL"] : []), ...Object.keys(variables).map(key => key === "API_BASE_URL" ? "BACKEND_URL" : key)])];
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
    <p>Configure your website’s public values. Saved changes appear in previews and exports; publish again to update your live website.</p>
    {!supported && <p role="alert">The backend needs the latest staging deployment before these settings can be saved.</p>}
    <fieldset className="at-public-variables" disabled={busy || !supported}>
      <legend>Frontend variables</legend>
      <p className="at-muted">Public values used by your website. Atlantis can fill in values it knows. Never enter passwords or secret API keys here.</p>
      {variableKeys.map(key => <label className="at-field" key={key}>{key === "TOKEN_CA" ? "Contract address (TOKEN_CA)" : key === "BACKEND_URL" ? "Backend URL (BACKEND_URL)" : key}
        <input aria-label={key} value={variables[key] ?? (key === "BACKEND_URL" ? variables.API_BASE_URL : "") ?? ""} maxLength={2000} disabled={key === "TOKEN_CA" && state.autoFillCA === true} placeholder={key === "BACKEND_URL" ? "https://your-backend.up.railway.app" : key === "TOKEN_CA" ? "Enter the CA when ready" : "Public value"} onChange={event => setVariable(key,event.target.value)} spellCheck={false}/>
      </label>)}
      <div className="at-variable-add"><input aria-label="New variable name" value={newVariable} maxLength={64} placeholder="PUBLIC_VARIABLE_NAME" onChange={event=>setNewVariable(event.target.value.toUpperCase())}/><button type="button" disabled={!/^[A-Z][A-Z0-9_]{0,63}$/.test(newVariable) || /SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN/.test(newVariable) || variableKeys.includes(newVariable) || Object.keys(variables).length >= 48} onClick={()=>{setVariable(newVariable,"");setNewVariable("");}}>Add variable</button></div>
      <label className="at-ca-choice"><input type="checkbox" checked={state.autoFillCA === true} onChange={event=>edit(old=>({...old,autoFillCA:event.target.checked}))}/><span>Fill the website CA automatically when I launch this coin</span></label>
      <p className="at-muted">Optional. When enabled, connected CA fields and trading links update after your launch is confirmed. Otherwise, your manual values stay in control. Ask Atlantis to connect any hardcoded fields.</p>
      {hasBackend && <p className="at-muted">Deploy the backend, then paste its actual public URL above. The published website hosts the frontend. Allow this website’s origin in your backend’s CORS settings.</p>}
      <button type="button" disabled={!dirty} onClick={()=>void run("Saving variables",async()=>{const saved=await save();if(saved && mounted.current)setNotice("Variables saved. Publish changes to update the live website.");})}>Save variables</button>
    </fieldset>
    {notice && <p role="status" className="at-notice">{notice}</p>}
  </div>;
}
