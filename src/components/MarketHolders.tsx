import { useEffect,useState } from "react";
import { api } from "../api";
import { useRuntime,useWallet } from "../context";
import { Link } from "react-router-dom";
import { displayTokenAmount } from "../trade-quote";
import type { Launch } from "../types";
export function MarketHolders({launch}:{launch:Launch}){
  const {config}=useRuntime(),[data,setData]=useState<Awaited<ReturnType<typeof api.holders>>|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  useEffect(()=>{let active=true;api.holders(launch.id).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError("Holder index unavailable");});return()=>{active=false;};},[launch.id]);
  return <section className="dashboard-section"><h2>Indexed holders</h2><p>{data?.note||error||"Loading…"}</p>{data&&<><p>Top 10 indexed wallets: {Number(data.summary.total)>0?(Number(data.summary.top_ten)/Number(data.summary.total)*100).toFixed(2):"0"}% · Creator indexed share: {Number(data.summary.total)>0?(Number(data.summary.creator)/Number(data.summary.total)*100).toFixed(2):"0"}%</p><div className="table-scroll"><table className="market-table"><thead><tr><th>Wallet</th><th>Balance</th><th>Indexed share</th></tr></thead><tbody>{data.holders.map(h=><tr key={h.wallet}><td><a href={"https://solscan.io/account/"+h.wallet+(config.network==="devnet"?"?cluster=devnet":"")} target="_blank" rel="noreferrer">{h.wallet.slice(0,5)}…{h.wallet.slice(-4)}</a>{h.wallet===h.creator_wallet&&" · Creator"}</td><td>{displayTokenAmount(h.balance_raw,launch.tokenDecimals)}</td><td>{Number(h.indexed_total_raw)>0?(Number(h.balance_raw)/Number(h.indexed_total_raw)*100).toFixed(2)+"%":"Unavailable"}</td></tr>)}</tbody></table></div>{data.hasMore&&<button className="soft-button" disabled={loading} onClick={async()=>{setLoading(true);try{const next=await api.holders(launch.id,data.holders.length);setData({...next,holders:[...data.holders,...next.holders]});}catch{setError("Could not load more holders");}finally{setLoading(false);}}}>Load more holders</button>}</>}{error&&<p role="alert">{error}</p>}</section>;
}
export function MarketPosition({launch}:{launch:Launch}){
  const wallet=useWallet(),[data,setData]=useState<Awaited<ReturnType<typeof api.holdings>>|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;setData(null);setError("");if(wallet.address)api.holdings(wallet.address).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError("Position unavailable");});return()=>{active=false;};},[wallet.address,launch.id]);
  const holding=data?.holdings.find(h=>h.launch.id===launch.id);
  return <section className="dashboard-section"><h2>Your position</h2>{!wallet.address?<button className="primary" onClick={()=>wallet.setModalOpen(true)}>Connect wallet</button>:error?<p role="alert">{error}</p>:!data?<p>Loading indexed balance…</p>:holding?<p>{displayTokenAmount(holding.balanceRaw,launch.tokenDecimals)} {launch.symbol} · {holding.valueUsd===null?"Price unavailable":new Intl.NumberFormat("en",{style:"currency",currency:"USD"}).format(holding.valueUsd)} · observed {new Date(holding.balanceUpdatedAt).toLocaleString()}</p>:<p>No indexed position in this market.</p>}<Link to="/portfolio">View all holdings and claim receipts →</Link></section>;
}
