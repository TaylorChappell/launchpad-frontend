import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
export function Promotions(){
  return <main className="page holder-workspace promotions-page">
    <header className="workspace-heading"><div><h1>Promotions</h1></div><img src={import.meta.env.BASE_URL+"aqua-gift.webp"} alt="Blue gift box"/></header>
    <div className="promotion-grid">
      <article className="promotion-card"><small className="workspace-eyebrow">COMMUNITY LAUNCH PROGRAM</small><h2><strong>$2,500</strong> in launch rewards</h2><p>Launch on AQUA and build your community. Our launch rewards program supports community and builder milestones.</p><a className="promotion-details" href="https://x.com/Aqua_Launchpad/status/2100283826693922893" target="_blank" rel="noreferrer">See milestones and program details <ArrowUpRight size={16}/></a><footer><Link className="primary" to="/create">Launch your token <ArrowRight size={16}/></Link></footer></article>
      <article className="promotion-card creator-promotion"><small className="workspace-eyebrow">ATLANTIS CREATOR REWARDS</small><h2><strong>$250</strong> for standout creations</h2><p>Several $250 rewards are available for some of the first creators who use Atlantis Studio to build something meaningful for their memecoin.</p><ol><li>Create a website, app, mini-game or community experience.</li><li>Launch your token on AQUA and put real effort into your project.</li><li>Reach out to the AQUA team and show us what you’re building.</li></ol><p className="promotion-note">The AQUA team selects the projects it wants to support. A submission does not guarantee a reward.</p><a className="promotion-details" href="https://x.com/Aqua_Launchpad/status/2101709470585999561" target="_blank" rel="noreferrer">Read the announcement <ArrowUpRight size={16}/></a><footer><Link className="primary" to="/studio">Build in Atlantis <ArrowRight size={16}/></Link><a href="https://x.com/Aqua_Launchpad" target="_blank" rel="noreferrer">Contact AQUA <ArrowUpRight size={14}/></a></footer></article>
    </div>
  </main>;
}
