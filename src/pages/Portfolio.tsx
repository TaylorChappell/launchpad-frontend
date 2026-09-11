import { Clock3, Gift, PieChart, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet } from "../context";

export function Portfolio(){
  const wallet=useWallet();
  return <main className="page simple-page portfolio-page"><h1>Your AQUA portfolio</h1><p>Bring coin positions, time-weighted reward status, and tokenized stock allocations into one holder view.</p>{!wallet.address?<div className="empty-card portfolio-empty"><span className="empty-mascot"><img src={`${import.meta.env.BASE_URL}aqua-logo.png`} alt=""/></span><h2>Connect to follow your reward journey</h2><p>Use Phantom or MetaMask to look up eligible balances and holding history.</p><button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button></div>:<><div className="simple-stats"><Box icon={<PieChart/>} l="Coin positions" v="0"/><Box icon={<Clock3/>} l="Active AQUA Scores" v="0"/><Box icon={<Gift/>} l="Claimable stocks" v="$0.00"/></div><div className="empty-card"><WalletCards/><h2>No indexed positions yet</h2><p>Your eligible coin balances and stock reward allocations will appear here when wallet proofs are available.</p><Link className="primary" to="/">Explore reward markets</Link></div></>}</main>;
}

function Box({icon,l,v}:{icon:React.ReactNode;l:string;v:string}){return <div><span>{icon}</span><small>{l}</small><b>{v}</b></div>}
