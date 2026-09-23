import { useEffect, useRef, useState } from "react";
import { studioRequest, type StudioProject, type StudioHosting } from "../studio-api";

type Props = {
  project: StudioProject;
  token: string;
  dirty: boolean;
  busy: boolean;
  hasBackend: boolean;
  save: () => Promise<StudioProject | null>;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
};
export function StudioPublish({ project, token, dirty, busy, hasBackend, save, run }: Props) {
  const [hosting, setHosting] = useState<StudioHosting | null>(null);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
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
      <div className="at-publish-address"><span>{hosting.prefix}</span><input aria-label="Website name" value={slug} maxLength={40} disabled={busy || Boolean(hosting.site)} onChange={event => setSlug(event.target.value.toLowerCase())} autoComplete="off" spellCheck={false}/><span>.{hosting.domain}</span></div>
    </label>
    {!hosting.site && <p className="at-muted">Use 3–40 lowercase letters, numbers or hyphens. This address stays with your project.</p>}
    {published && <div className="at-publish-live"><span><strong>Website published</strong><small>{changed ? "You have changes to publish." : "Your saved version is live."}</small></span><a href={hosting.site!.url} target="_blank" rel="noreferrer">Visit website ↗</a></div>}
    <p className="at-muted">Launch your coin from this project to fill its connected CA fields and trading links automatically. Older websites with a hardcoded CA need their fields connected in Atlantis first.</p>
    {hasBackend && <p className="at-muted">This publishes the website only. Features that use your backend need that backend deployed and its public API URL configured.</p>}
    {notice && <p role="status" className="at-notice">{notice}</p>}
    <div className="at-export-actions">
      <button className="at-primary" disabled={busy || !hosting.enabled || !validSlug} onClick={() => void run("Publishing website", async () => {
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
