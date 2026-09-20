import { X, ArrowRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useDialog } from "./useDialog";
import { usePromotion } from "../usePromotion";
export function StudioAnnouncement({onClose}:{onClose:()=>void}){
  const ref=useDialog(true,onClose),{promotion,active,remaining}=usePromotion();
  return <div className="community-update-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="studio-announcement-title" className="community-update-flash atlantis-launch-update">
      <button className="community-update-close" aria-label="Close update" onClick={onClose}><X/></button>
      <div className="community-update-copy"><small>ATLANTIS STUDIO · NOW LIVE</small><h2 id="studio-announcement-title">Build more around your token.</h2><p>Create websites, apps, mini-games, artwork and meme generators in AQUA. Preview your work, review AI edits and export the source code to ZIP or GitHub.</p></div>
      {active&&<p className="community-update-eligibility">Free launch access: {Math.floor(remaining/3600000)}h {Math.floor(remaining%3600000/60000)}m remaining. Includes up to ${promotion?.allowanceUsd??5} of AI usage per wallet. Add credit after your allowance is used.</p>}
      <footer><NavLink to="/updates/atlantis-free" onClick={onClose}>Read the update <ArrowRight/></NavLink><NavLink to="/studio" onClick={onClose}>Open Atlantis Studio <ArrowRight/></NavLink></footer>
    </section>
  </div>;
}
