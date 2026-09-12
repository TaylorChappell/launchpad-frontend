import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ImagePlus, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { buildLaunchMessage, quoteBuy } from "../curve";
import type { StockOption } from "../types";

type Form = {name:string; symbol:string; description:string; stockSymbol:string; xUrl:string; websiteUrl:string; telegramUrl:string};
const empty: Form = {name:"",symbol:"",description:"",stockSymbol:"SOL",xUrl:"",websiteUrl:"",telegramUrl:""};
const url = (value:string,prefix="https://") => value.trim() ? (/^https?:\/\//i.test(value.trim()) ? value.trim() : `${prefix}${value.trim()}`) : null;

export function Create() {
  const nav = useNavigate();
  const wallet = useWallet();
  const { config } = useRuntime();
  const [form,setForm] = useState(empty);
  const [stocks,setStocks] = useState<StockOption[]>([]);
  const [stockState,setStockState] = useState<"loading"|"ready"|"unavailable">("loading");
  const [devBuy,setDevBuy] = useState(false);
  const [devSol,setDevSol] = useState(1);
  const [ack,setAck] = useState(false);
  const [file,setFile] = useState<File|null>(null);
  const [preview,setPreview] = useState("");
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    api.stocks().then(data => { setStocks(data.stocks); setStockState(data.stocks.length ? "ready" : "unavailable"); }).catch(() => setStockState("unavailable"));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reward = form.stockSymbol !== "SOL";
  const stock = stocks.find(item => item.symbol === form.stockSymbol);
  const quote = useMemo(() => quoteBuy(devBuy ? devSol : 0, reward), [devBuy, devSol, reward]);
  const detailsReady = form.name.trim().length >= 2 && form.symbol.length >= 2;
  const rewardsReady = !reward || (Boolean(stock?.mint) && ack);
  const ready = detailsReady && rewardsReady && config.transactionsEnabled;
  const set = (key:keyof Form,value:string) => setForm(current => ({...current,[key]:value}));

  async function launch() {
    if (!config.transactionsEnabled) return;
    if (!wallet.address) { wallet.setModalOpen(true); return; }
    if (!detailsReady || !rewardsReady) return toast.error("Complete the required launch details.");
    setBusy(true);
    try {
      const clientRequestId=crypto.randomUUID(); const timestamp=Date.now();
      const message=buildLaunchMessage({wallet:wallet.address,requestId:clientRequestId,symbol:form.symbol,stockSymbol:reward?form.stockSymbol:null,timestamp});
      const signed=await wallet.signMessage(message); let imageId:string|null=null;
      if(file){const body=new FormData();body.set("file",file);body.set("creatorWallet",wallet.address);body.set("clientRequestId",clientRequestId);body.set("symbol",form.symbol);body.set("stockSymbol",reward?form.stockSymbol:"");body.set("timestamp",String(timestamp));body.set("signature",signed.signature);body.set("message",signed.message);imageId=(await api.upload(body)).imageId;}
      const result=await api.createLaunch({creatorWallet:wallet.address,clientRequestId,name:form.name.trim(),symbol:form.symbol,description:form.description.trim(),imageId,stockSymbol:reward?stock!.symbol:null,stockName:reward?stock!.name:null,stockMint:reward?stock!.mint:null,devBuySol:devBuy?devSol:0,xUrl:url(form.xUrl),websiteUrl:url(form.websiteUrl),telegramUrl:url(form.telegramUrl,"https://t.me/"),timestamp,signature:signed.signature,message:signed.message});
      toast.success("Launch signed and saved"); nav(`/token/${result.launch.id}`);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Launch failed."); }
    finally { setBusy(false); }
  }

  return <main className="page create-page">
    <header className="create-heading"><span className="eyebrow">CREATE MARKET</span><h1>Launch with clear terms.</h1><p>Configure the token, choose its fee route, then review every cost before your wallet signs.</p></header>
    <div className="step-rail" aria-label="Launch steps"><span className={detailsReady ? "done" : "active"}><i>1</i>Token</span><b/><span className={detailsReady && !rewardsReady ? "active" : detailsReady ? "done" : ""}><i>2</i>Structure</span><b/><span className={detailsReady && rewardsReady ? "active" : ""}><i>3</i>Review</span></div>

    <div className="create-layout">
      <section className="form-stack">
        <FormPanel number="01" title="Token identity" note="Required">
          <div className="token-fields">
            <label className="artwork" aria-label="Upload token image">{preview?<span style={{backgroundImage:`url(${preview})`}}/>:<><ImagePlus/><b>Upload token image</b><small>PNG, JPG or WebP<br/>Maximum 3 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const next=e.target.files?.[0]??null;setFile(next);setPreview(next?URL.createObjectURL(next):"");}}/>{file&&<button aria-label="Remove token image" onClick={(e)=>{e.preventDefault();setFile(null);setPreview("");}}><X size={14}/></button>}</label>
            <div className="field-grid"><Field label="Token name"><input value={form.name} maxLength={32} placeholder="Example: Neural Index" onChange={e=>set("name",e.target.value)}/></Field><Field label="Ticker"><input value={form.symbol} maxLength={10} placeholder="NEUR" onChange={e=>set("symbol",e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase())}/></Field><Field label="Description" wide><textarea rows={4} maxLength={360} value={form.description} placeholder="Explain the market and its community." onChange={e=>set("description",e.target.value)}/><small>{form.description.length}/360</small></Field></div>
          </div>
        </FormPanel>

        <FormPanel number="02" title="Market structure" note="Required">
          <div className="pair-choices"><Choice selected={!reward} title="SOL market" text="1% platform fee. Liquidity graduates to a token and SOL Orca pool." onClick={()=>set("stockSymbol","SOL")}/><Choice selected={reward} disabled={stockState !== "ready"} title="Stock rewards" text="Adds a separate 1% reserve to purchase the selected tokenized stock." onClick={()=>set("stockSymbol",stocks[0]?.symbol??"SOL")}/></div>
          {stockState === "unavailable" && <div className="inline-notice"><AlertTriangle/><div><b>Stock rewards are temporarily unavailable</b><span>The verified xStock registry did not return eligible Solana assets. SOL launches remain available.</span></div></div>}
          {reward && <div className="stock-config"><Field label="Verified reward asset"><select value={form.stockSymbol} onChange={e=>{set("stockSymbol",e.target.value);setAck(false);}}>{stocks.map(item=><option key={item.symbol} value={item.symbol} disabled={item.halted}>{item.symbol} · {item.name}{item.halted?" (halted)":""}</option>)}</select></Field><label className="legal-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/><span>I understand tokenized stocks can be restricted or halted and may not be available in my jurisdiction.</span></label></div>}
        </FormPanel>

        <FormPanel number="03" title="Developer buy" note="Optional">
          <div className="switch-row"><div><b>Buy in the launch transaction</b><small>Maximum 10 SOL. The amount is public in the market record.</small></div><button className={`switch ${devBuy?"on":""}`} onClick={()=>setDevBuy(!devBuy)} aria-label="Toggle initial developer buy" aria-pressed={devBuy}><i/></button></div>
          {devBuy&&<><div className="dev-amount"><span>Initial buy</span><b>{devSol.toFixed(1)} SOL</b></div><input className="range" type="range" min="0.1" max="10" step="0.1" value={devSol} onChange={e=>setDevSol(Number(e.target.value))}/></>}
        </FormPanel>

        <details className="optional-panel"><summary><span><ChevronDown/> Project links</span><small>Optional</small></summary><div className="field-grid"><Field label="X account or post"><input value={form.xUrl} placeholder="x.com/account or /status/..." onChange={e=>set("xUrl",e.target.value)}/></Field><Field label="Website"><input value={form.websiteUrl} placeholder="yourproject.xyz" onChange={e=>set("websiteUrl",e.target.value)}/></Field><Field label="Telegram" wide><input value={form.telegramUrl} placeholder="t.me/yourcommunity" onChange={e=>set("telegramUrl",e.target.value)}/></Field></div></details>
      </section>

      <aside className="launch-summary">
        <div className="summary-top"><span className="eyebrow">REVIEW</span><h2>Launch summary</h2><p>Amounts shown before signing are estimates. Your wallet displays the final transaction.</p></div>
        <div className="summary-token"><span>{form.symbol.slice(0,2)||"AQ"}</span><div><b>{form.name||"Untitled token"}</b><small>${form.symbol||"TICKER"} / {reward?form.stockSymbol:"SOL"}</small></div></div>
        <div className="summary-group"><h3>Market</h3><Row label="Pricing" value="Virtual SOL curve"/><Row label="Graduation" value={`${config.graduationSol} SOL`}/><Row label="Destination" value="Orca liquidity"/></div>
        <div className="summary-group"><h3>Fees</h3><Row label="Platform fee" value={`${(config.fees.platformBps/100).toFixed(2)}%`}/><Row label="Stock reward fee" value={reward?`${(config.fees.rewardsBps/100).toFixed(2)}%`:"Off"} accent={reward}/><Row label="Network and rent" value="Calculated at signing"/><Row label="Developer buy" value={devBuy?`${devSol.toFixed(1)} SOL`:"None"}/>{devBuy&&<Row label="Estimated net to curve" value={`${quote.netSol.toFixed(3)} SOL`}/>}</div>
        <div className={`deployment-state ${config.transactionsEnabled?"ready":"unavailable"}`}>{config.transactionsEnabled?<ShieldCheck/>:<LockKeyhole/>}<div><b>{config.transactionsEnabled?"Program available":"Launching unavailable"}</b><span>{config.transactionsEnabled?`${config.network} program ready for wallet review.`:"No deployed launch program is configured for this network."}</span></div></div>
        <button className="primary full" disabled={!ready||busy} onClick={()=>void launch()}>{busy?<><Loader2 className="spin"/>Waiting for wallet</>:!config.transactionsEnabled?"Launching unavailable":wallet.address?"Review transaction":"Connect wallet to continue"}</button>
        <p className="signature-note"><ShieldCheck/> AQUA cannot submit a launch without your wallet approval.</p>
      </aside>
    </div>
  </main>;
}

function FormPanel({number,title,note,children}:{number:string;title:string;note:string;children:React.ReactNode}) { return <section className="form-panel"><header><span>{number}</span><h2>{title}</h2><small>{note}</small></header>{children}</section>; }
function Field({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}) { return <label className={wide?"field wide":"field"}><span>{label}</span>{children}</label>; }
function Choice({selected,title,text,onClick,disabled=false}:{selected:boolean;title:string;text:string;onClick:()=>void;disabled?:boolean}) { return <button className={`pair-choice ${selected?"selected":""}`} onClick={onClick} disabled={disabled}><b>{title}</b>{selected&&<Check/>}<small>{text}</small>{disabled&&<em>Unavailable</em>}</button>; }
function Row({label,value,accent}:{label:string;value:string;accent?:boolean}) { return <div className="summary-row"><span>{label}</span><b className={accent?"green":""}>{value}</b></div>; }
