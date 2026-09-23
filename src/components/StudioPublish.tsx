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
export function StudioPublish({ project, state, edit, token, dirty, busy, hasBackend, save, run }: Props) {
  const [hosting, setHosting] = useState<StudioHosting | null>(null);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [newVariable, setNewVariable] = useState("");
  const variables = state.frontendVariables ?? {};
  const variableKeys = [...new Set(["TOKEN_CA", ...(hasBackend ? ["BACKEND_URL"] : []), ...Object.keys(variables).map(key => key === "API_BASE_URL" ? "BACKEND_URL" : key)])];
  const setVariable = (key: string, value: string) => edit(old => ({...old,frontendVariables:{...old.frontendVariables,[key]:value,...(key === "BACKEND_URL" ? {API_BASE_URL:value} : {})}}));
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setError(""); setHosting(null);
    studioRequest<StudioHosting>(`/projects/${project.id}/hosting`, token, undefined, undefined, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setHosting(value);
      setSlug(value.site?.slug ?? project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, ""));
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load publishing."); });
    return () => { mounted.current = false; controller.abort(); };
  }, [project.id, token, reload]);
  if (error) return <div><p role="alert">{error}</p><button onClick={() => setReload(value => value + 1)}>Try again</button></div>;
  if (!hosting) return <p role="status">Loading website…</p>;
  const published = hosting.site?.published;
  const changed = dirty || project.revision !== hosting.site?.revision;
  const validSlug = slug.length >= 3 && slug.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  return <div className="at-publish">
    <p>Publish your website on {hosting.domain}. Your edits stay private until you publish them.</p>
    {!hosting.enabled && <p className="at-notice">Website publishing is not available yet.</p>}
    <label className="at-field">Website address
      <div className="at-publish-address"><input aria-label="Website name" value={slug} maxLength={40} disabled={busy || Boolean(hosting.site)} onChange={event => setSlug(event.target.value.toLowerCase())} autoComplete="off" spellCheck={false}/><span>.{hosting.domain}</span></div>
    </label>
    {!hosting.site && <p className="at-muted">Use 3–40 lowercase letters, numbers or hyphens. This address stays with your project.</p>}
    {published && <div className="at-publish-live"><span><strong>Website published</strong><small>{changed ? "You have changes to publish." : "Your saved version is live."}</small></span><a href={`https://${hosting.site!.slug}.${hosting.domain}`} target="_blank" rel="noreferrer">Visit website ↗</a></div>}
    {!hosting.configurationSupported && <p role="alert">The backend needs the latest staging deployment before these settings can be saved or published.</p>}
    <fieldset className="at-public-variables" disabled={busy || !hosting.configurationSupported}>
      <legend>Frontend variables</legend>
      <p className="at-muted">Public values used by your website. Atlantis can fill in values it knows. Never enter passwords or secret API keys here.</p>
      {variableKeys.map(key => <label className="at-field" key={key}>{key === "TOKEN_CA" ? "Contract address (TOKEN_CA)" : key === "BACKEND_URL" ? "Backend URL (BACKEND_URL)" : key}
        <input aria-label={key} value={variables[key] ?? (key === "BACKEND_URL" ? variables.API_BASE_URL : "") ?? ""} maxLength={2000} disabled={key === "TOKEN_CA" && state.autoFillCA === true} placeholder={key === "BACKEND_URL" ? "https://your-backend.up.railway.app" : key === "TOKEN_CA" ? "Enter the CA when ready" : "Public value"} onChange={event => setVariable(key,event.target.value)} spellCheck={false}/>
      </label>)}
      <div className="at-variable-add"><input aria-label="New variable name" value={newVariable} maxLength={64} placeholder="PUBLIC_VARIABLE_NAME" onChange={event=>setNewVariable(event.target.value.toUpperCase())}/><button type="button" disabled={!/^[A-Z][A-Z0-9_]{0,63}$/.test(newVariable) || /SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN/.test(newVariable) || variableKeys.includes(newVariable) || Object.keys(variables).length >= 48} onClick={()=>{setVariable(newVariable,"");setNewVariable("");}}>Add variable</button></div>
      <label className="at-ca-choice"><input type="checkbox" checked={state.autoFillCA === true} onChange={event=>edit(old=>({...old,autoFillCA:event.target.checked}))}/><span>Fill the website CA automatically when I launch this coin</span></label>
      <p className="at-muted">Optional. When enabled, connected CA fields and trading links update after your launch is confirmed. Otherwise, your manual values stay in control. Ask Atlantis to connect any hardcoded fields.</p>
      {hasBackend && <p className="at-muted">Deploy the backend, then paste its actual public URL above. Publishing here hosts the frontend. Allow this website’s origin in your backend’s CORS settings.</p>}
      <button type="button" disabled={!dirty} onClick={()=>void run("Saving website settings",async()=>{const saved=await save();if(saved && mounted.current)setNotice("Settings saved. Publish changes to update the live website.");})}>Save settings</button>
    </fieldset>
    {notice && <p role="status" className="at-notice">{notice}</p>}
    <div className="at-export-actions">
      <button className="at-primary" disabled={busy || !hosting.enabled || !hosting.configurationSupported || !validSlug} onClick={() => void run("Publishing website", async () => {
        setNotice("");
        const saved = await save();
        if (!saved) return;
        const next = await studioRequest<StudioHosting>(`/projects/${saved.id}/hosting`, token, { slug, revision: saved.revision });
        if (mounted.current) { setHosting(next); setNotice("Published. Allow up to 15 seconds for the website to update."); setConfirmUnpublish(false); }
      })}>{published ? "Publish changes" : "Publish website"}</button>
      {published && <button disabled={busy} onClick={() => setConfirmUnpublish(true)}>Unpublish</button>}
    </div>
    {confirmUnpublish && <div className="at-publish-confirm"><p>Take this website offline? Your project and its address will be kept.</p><div className="at-export-actions"><button disabled={busy} onClick={() => void run("Taking website offline", async () => {
      const next = await studioRequest<StudioHosting>(`/projects/${project.id}/hosting`, token, undefined, "DELETE");
      if (mounted.current) { setHosting(next); setConfirmUnpublish(false); setNotice("Unpublished. It may take up to 15 seconds to go offline."); }
    })}>Unpublish website</button><button disabled={busy} onClick={() => setConfirmUnpublish(false)}>Cancel</button></div></div>}
  </div>;
}
