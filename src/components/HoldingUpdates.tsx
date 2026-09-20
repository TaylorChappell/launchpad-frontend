import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {api} from "../api";
import {useRuntime} from "../context";
export function HoldingUpdates({wallet}:{wallet:string}){
  const {config}=useRuntime(),[data,setData]=useState<Awaited<ReturnType<typeof api.holdingGovernance>>|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true,pending=false;setData(null);const load=async()=>{if(pending)return;pending=true;try{const value=await api.holdingGovernance(wallet);if(active){setData(value);setError(false);}}catch{if(active)setError(true);}finally{pending=false;}};void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},30_000);return()=>{active=false;window.clearInterval(timer);};},[wallet]);
  return <section className="dashboard-section"><h2>Decisions affecting your holdings</h2><p>Approved DEX funding can direct 80% of incoming market rewards to the approved reserve while funding is active. A withdrawal is not evidence that the DEX order has been delivered.</p>
    {error&&<p role="alert">Governance updates unavailable. Any previous rows may be stale.</p>}
    {!data&&!error?<p>Checking decisions…</p>:data?.proposals.length?<div className="table-scroll"><table className="market-table"><thead><tr><th>Market / decision</th><th>State</th><th>Funded / target</th><th>Withdrawn</th><th>Evidence</th></tr></thead><tbody>{data.proposals.map(p=><tr key={p.id}><td><Link to={"/token/"+p.launch_id}>{p.symbol} · {p.type.replaceAll("_"," ")}</Link></td><td>{p.status}</td><td>${(Number(p.funded_usd_cents)/100).toFixed(2)} / ${(Number(p.target_usd_cents)/100).toFixed(2)}</td><td>{(Number(p.withdrawn_lamports)/1e9).toFixed(4)} SOL</td><td>{p.withdrawal_signature&&<a href={"https://solscan.io/tx/"+p.withdrawal_signature+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">Withdrawal ↗</a>}{p.dex_order_reference&&<span> Order: {p.dex_order_reference}</span>}<Link to={"/token/"+p.launch_id}> View vote &amp; completion</Link></td></tr>)}</tbody></table></div>:!error&&<p>No indexed governance decisions for your current positions.</p>}
  </section>;
}
