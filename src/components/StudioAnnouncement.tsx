import { X, ArrowRight, Gift, ChartNoAxesCombined, PanelsTopLeft } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useDialog } from "./useDialog";
import { usePromotion } from "../usePromotion";
export function StudioAnnouncement({onClose}:{onClose:()=>void}){
  const ref=useDialog(true,onClose),{active,remaining}=usePromotion();
  return <div className="community-update-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="studio-announcement-title" className="release-dialog">
      <button className="release-close" aria-label="Close update" onClick={onClose}><X size={18}/></button>
      <small className="workspace-eyebrow">WHAT’S NEW IN AQUA</small>
      <h2 id="studio-announcement-title">More for your community.<br/><span>More for your holdings.</span></h2>
      <div className="release-features">
        <div><Gift/><span><b>Holdings &amp; rewards, together</b><p>Track your coins and claim your rewards in one place. You can also claim straight from a market.</p></span></div>
        <div><ChartNoAxesCombined/><span><b>A clearer view of AQUA</b><p>See market activity, holder allocations and completed buybacks at a glance.</p></span></div>
        <div><PanelsTopLeft/><span><b>Build with Atlantis Studio</b><p>Create websites, apps, mini-games, artwork and meme generators. Preview, edit and export to ZIP or GitHub.</p></span></div>
      </div>
      {active&&<p className="release-promotion">Free Studio access · {Math.floor(remaining/3600000)}h {Math.floor(remaining%3600000/60000)}m remaining</p>}
      <footer><NavLink className="primary" to="/portfolio" onClick={onClose}>My holdings <ArrowRight size={16}/></NavLink><NavLink to="/studio" onClick={onClose}>Open Atlantis Studio <ArrowRight size={15}/></NavLink></footer>
    </section>
  </div>;
}
