import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Gift, Globe2, ShieldAlert, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { quoteBuy, quoteSell } from "../curve";
import { DEMO } from "../fixtures";
import type { Launch, Trade } from "../types";
import { Metric, TokenMark } from "../components/TokenCard";

const compact = new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:2});
const money = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:4});

export function Token() {
  const {id=""}=useParams(); const wallet=useWallet(); const {config}=useRuntime();
  const previewLaunch = DEMO.find(x=>x.id===id)??null;
  const [launch,setLaunch]=useState<Launch|null>(previewLaunch); const [trades,setTrades]=useState<Trade[]>([]); const [sample,setSample]=useState(Boolean(previewLaunch)); const [loaded,setLoaded]=useState(false);
  const [side,setSide]=useState<"buy"|"sell">("buy"); const [amount,setAmount]=useState("1");
  useEffect(()=>{api.launch(id).then(data=>{setLaunch(data.launch);setTrades(data.trades);setSample(false);}).catch(()=>undefined).finally(()=>setLoaded(true));},[id]);
  const n=Math.max(0,Number(amount)||0);
  const q=useMemo(()=>!launch?null:side==="buy"?quoteBuy(n,Boolean(launch.stockSymbol),launch.virtualSolReserve,launch.virtualTokenReserve):quoteSell(n,Boolean(launch.stockSymbol),launch.virtualSolReserve,launch.virtualTokenReserve,launch.realSolReserve),[launch,n,side]);
  const chart=useMemo(()=>!launch?[]:Array.from({length:38},(_,i)=>({i,p:Math.max(.000001,launch.priceUsd||.0001)*(.42+i/61)*(1+Math.sin(i*.67)*.05)})),[launch]);
  if(!launch && loaded)return <main className="page empty-state"><h2>Market not found</h2><p>This market is not present in the connected AQUA index.</p><Link className="primary" to="/">Return to Explore</Link></main>;
  if(!launch)return <main className="page"><div className="page-loading">Loading market…</div></main>;
  const fee=q?.platformFee??0; const reward=q?.rewardFee??0; const output=side==="buy"?(q&&"tokensOut" in q?q.tokensOut:0):(q&&"solOut" in q?q.solOut:0);
  const canTrade = !sample && config.transactionsEnabled;
  const activityRows = sample ? sampleTrades(launch) : trades;
  const explorerUrl = `https://explorer.solana.com/address/${launch.mint}${config.network === "devnet" ? "?cluster=devnet" : ""}`;

  return <main className="page token-page">
    <Link className="back" to="/"><ArrowLeft/>Explore markets</Link>
    {sample&&<div className="sample-banner"><b>SAMPLE MARKET</b><span>All prices, holders, trades and rewards on this page are illustrative.</span></div>}
    <section className="token-hero"><div className="token-identity"><TokenMark launch={launch} large/><div><div><h1>{launch.name}</h1><span>${launch.symbol}</span><em className={launch.status}>{launch.status==="orca"?"ORCA":"CURVE"}</em></div><p>{launch.description}</p><footer>{launch.xUrl&&<a href={launch.xUrl} target="_blank" rel="noreferrer">X <ExternalLink/></a>}{launch.websiteUrl&&<a href={launch.websiteUrl} target="_blank" rel="noreferrer"><Globe2/> Website</a>}{!sample&&<a href={explorerUrl} target="_blank" rel="noreferrer">Explorer <ExternalLink/></a>}<button onClick={()=>{void navigator.clipboard.writeText(launch.mint);toast.success("Mint copied");}}><Copy/> {launch.mint.slice(0,5)}…{launch.mint.slice(-4)}</button></footer></div></div><div className="hero-metrics"><Metric label="Price" value={money.format(launch.priceUsd)}/><Metric label="Market cap" value={`$${compact.format(launch.marketCapUsd)}`}/><Metric label="24h volume" value={`$${compact.format(launch.volume24hUsd)}`}/><Metric label="24h change" value={`${launch.change24h>=0?"+":""}${launch.change24h.toFixed(1)}%`} tone={launch.change24h>=0?"up":"down"}/></div></section>
    <div className="token-layout"><section className="token-main">
      <div className="chart-panel"><header><div><small>ILLUSTRATIVE CURVE MODEL</small><b>{money.format(launch.priceUsd)}</b></div><span>MODEL</span></header><div className="chart"><ResponsiveContainer><AreaChart data={chart}><defs><linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#73edf2" stopOpacity=".25"/><stop offset="1" stopColor="#73edf2" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(137,214,223,.07)"/><YAxis orientation="right" axisLine={false} tickLine={false} tick={{fill:"#648087",fontSize:10}}/><Tooltip contentStyle={{background:"#061820",border:"1px solid rgba(137,214,223,.18)",borderRadius:8}}/><Area type="monotone" dataKey="p" stroke="#73edf2" fill="url(#tokenFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></div>
      <div className="info-grid"><div className="info-panel"><small>GRADUATION PROGRESS</small><h2>{launch.progress.toFixed(1)}%</h2><div className="progress big"><i style={{width:`${launch.progress}%`}}/></div><p>{launch.realSolReserve.toFixed(2)} of {config.graduationSol} SOL. The market becomes eligible for Orca migration at the configured target.</p></div><div className="info-panel reward"><Gift/><b>Stock reward route</b>{launch.stockSymbol?<><div><Metric label="Distributed" value={`$${compact.format(launch.rewardDistributedUsd)}`}/><Metric label="Reserve" value={`${launch.rewardVaultStock.toFixed(3)} ${launch.stockSymbol}`}/></div><p>A separate 1% reward fee funds batched {launch.stockSymbol} purchases.</p></>:<p>This SOL market does not collect a stock reward fee.</p>}</div></div>
      <div className="activity"><header><div><b>Market activity</b><span>{sample?"Illustrative transactions":"Indexed onchain transactions"}</span></div><strong>{launch.txCount.toLocaleString()} total</strong></header><div className="activity-scroll"><table><thead><tr><th>Type</th><th>Wallet</th><th>SOL</th><th>Tokens</th></tr></thead><tbody>{activityRows.length?activityRows.map(t=><tr key={t.id}><td className={t.side}>{t.side.toUpperCase()}</td><td>{t.wallet}</td><td>{t.solAmount.toFixed(3)}</td><td>{compact.format(t.tokenAmount)}</td></tr>):<tr><td colSpan={4} className="no-activity">No indexed trades yet.</td></tr>}</tbody></table></div></div>
    </section><aside className="trade-card"><div className="trade-tabs"><button className={side==="buy"?"active":""} onClick={()=>setSide("buy")}>Buy</button><button className={side==="sell"?"active":""} onClick={()=>setSide("sell")}>Sell</button></div><label>You pay</label><div className="trade-input"><input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))}/><b>{side==="buy"?"SOL":launch.symbol}</b></div><TradeRow label="Estimated receive" value={`${compact.format(output)} ${side==="buy"?launch.symbol:"SOL"}`} strong/><TradeRow label="Platform fee" value={`${fee.toFixed(4)} SOL`}/><TradeRow label="Stock reward fee" value={launch.stockSymbol?`${reward.toFixed(4)} SOL`:"Off"} accent={Boolean(launch.stockSymbol)}/><TradeRow label="Route" value={launch.status==="orca"?`Orca / ${launch.stockSymbol??"SOL"}`:"Virtual curve"}/><button className="primary full" disabled={!n||!canTrade} onClick={()=>{if(!wallet.address)wallet.setModalOpen(true);}}>{sample?"Preview only":!config.transactionsEnabled?"Trading unavailable":wallet.address?(side==="buy"?`Buy ${launch.symbol}`:`Sell ${launch.symbol}`):"Connect wallet"}</button>{!canTrade&&<div className="locked"><ShieldAlert/><span><b>{sample?"Sample market":"Transactions disabled"}</b>{sample?"No transaction can be submitted from example data.":"No deployed launch program is configured for this network."}</span></div>}<div className="creator"><span>Creator</span><b>{launch.creatorWallet}</b><span>Developer buy</span><b>{launch.devBuySol.toFixed(1)} SOL · {launch.devSupplyPct.toFixed(1)}%</b><span>Holders</span><b><Users/> {compact.format(launch.holderCount)}</b></div></aside></div>
  </main>;
}

function TradeRow({label,value,strong,accent}:{label:string;value:string;strong?:boolean;accent?:boolean}) { return <div className={`trade-row ${strong?"strong":""}`}><span>{label}</span><b className={accent?"green":""}>{value}</b></div>; }
function sampleTrades(l:Launch):Trade[] { return Array.from({length:6},(_,i)=>({id:`${l.id}-${i}`,wallet:`${["7mQx","K8p2","3Zva","P9eL","6Twu","A1cx"][i]}…${["fQ2","9Mp","k71","w30","Jq4","8xd"][i]}`,side:i===2||i===5?"sell":"buy",solAmount:.17+((i*37)%20)/10,tokenAmount:82900+i*182300,priceUsd:l.priceUsd,createdAt:Date.now()-i*90000})); }
