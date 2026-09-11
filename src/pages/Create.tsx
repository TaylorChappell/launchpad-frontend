import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Clock3, ImagePlus, Loader2, LockKeyhole, ShieldCheck, Sparkles, TimerReset, X } from "lucide-react";
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
  const [launchOpen,setLaunchOpen] = useState(false);

  useEffect(() => {
    api.stocks().then(data => { setStocks(data.stocks); setStockState(data.stocks.length ? "ready" : "unavailable"); if (data.stocks.length) setForm(current => current.stockSymbol === "SOL" ? {...current, stockSymbol:data.stocks[0].symbol} : current); }).catch(() => setStockState("unavailable"));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reward = form.stockSymbol !== "SOL";
  const stock = stocks.find(item => item.symbol === form.stockSymbol);
  const quote = useMemo(() => quoteBuy(devBuy ? devSol : 0, reward), [devBuy, devSol, reward]);
  const detailsReady = form.name.trim().length >= 2 && form.symbol.length >= 2;
  const rewardsReady = !reward || (Boolean(stock?.mint) && ack);
  const readyForOptions = detailsReady && rewardsReady;
  const set = (key:keyof Form,value:string) => setForm(current => ({...current,[key]:value}));

  function openLaunchOptions() {
    if (!wallet.address) { wallet.setModalOpen(true); return; }
    if (!detailsReady || !rewardsReady) { toast.error("Complete the required launch details."); return; }
    setLaunchOpen(true);
  }

  async function launch() {
    if (!config.transactionsEnabled || !wallet.address) return;
    setBusy(true);
    try {
      const clientRequestId=crypto.randomUUID(); const timestamp=Date.now();
      const message=buildLaunchMessage({wallet:wallet.address,requestId:clientRequestId,symbol:form.symbol,stockSymbol:reward?form.stockSymbol:null,timestamp});
      const signed=await wallet.signMessage(message); let imageId:string|null=null;
      if(file){const body=new FormData();body.set("file",file);body.set("creatorWallet",wallet.address);body.set("clientRequestId",clientRequestId);body.set("symbol",form.symbol);body.set("stockSymbol",reward?form.stockSymbol:"");body.set("timestamp",String(timestamp));body.set("signature",signed.signature);body.set("message",signed.message);imageId=(await api.upload(body)).imageId;}
      const result=await api.createLaunch({creatorWallet:wallet.address,clientRequestId,name:form.name.trim(),symbol:form.symbol,description:form.description.trim(),imageId,stockSymbol:reward?stock!.symbol:null,stockName:reward?stock!.name:null,stockMint:reward?stock!.mint:null,devBuySol:devBuy?devSol:0,xUrl:url(form.xUrl),websiteUrl:url(form.websiteUrl),telegramUrl:url(form.telegramUrl,"https://t.me/"),timestamp,signature:signed.signature,message:signed.message});
      toast.success("Launch signed and saved"); setLaunchOpen(false); nav(`/token/${result.launch.id}`);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Launch failed."); }
    finally { setBusy(false); }
  }

  return <main className="page create-page">
    <header className="create-heading"><h1>Create a coin that gives back.</h1><p>Choose the tokenized stock your community can earn. AQUA handles the reward stream separately from platform revenue and makes the distribution record visible.</p></header>

    <section className="creator-promise"><span><Sparkles/></span><div><b>Holder-first by default</b><p>The stock reward stream is for eligible holders. Creators do not receive a separate cut from the reward vault.</p></div><strong>1% → stock rewards</strong></section>

    <div className="create-layout">
      <section className="form-stack">
        <FormPanel title="Token identity" note="Required">
          <div className="token-fields">
            <label className="artwork" aria-label="Upload token image">{preview?<span style={{backgroundImage:`url(${preview})`}}/>:<><ImagePlus/><b>Upload token image</b><small>PNG, JPG or WebP<br/>Maximum 3 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const next=e.target.files?.[0]??null;setFile(next);setPreview(next?URL.createObjectURL(next):"");}}/>{file&&<button type="button" aria-label="Remove token image" onClick={(e)=>{e.preventDefault();setFile(null);setPreview("");}}><X size={14}/></button>}</label>
            <div className="field-grid"><Field label="Token name"><input value={form.name} maxLength={32} placeholder="Example: Neural Index" onChange={e=>set("name",e.target.value)}/></Field><Field label="Ticker"><input value={form.symbol} maxLength={10} placeholder="NEUR" onChange={e=>set("symbol",e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase())}/></Field><Field label="Description" wide><textarea rows={4} maxLength={360} value={form.description} placeholder="Tell holders what this community represents." onChange={e=>set("description",e.target.value)}/><small>{form.description.length}/360</small></Field></div>
          </div>
        </FormPanel>

        <FormPanel title="Holder reward" note="Choose the value stream">
          <div className="pair-choices"><Choice selected={reward} disabled={stockState !== "ready"} title="Tokenized stock rewards" text="1% of each trade enters a separate reserve used to buy the selected reward asset." onClick={()=>set("stockSymbol",stocks[0]?.symbol??"SOL")}/><Choice selected={!reward} title="Standard SOL market" text="No stock reward stream. The 1% platform fee still applies." onClick={()=>set("stockSymbol","SOL")}/></div>
          {stockState === "unavailable" && <div className="inline-notice"><AlertTriangle/><div><b>Stock rewards are temporarily unavailable</b><span>The verified xStock registry did not return eligible Solana assets. Standard launches remain available.</span></div></div>}
          {reward && <div className="stock-config"><Field label="Verified stock reward"><select value={form.stockSymbol} onChange={e=>{set("stockSymbol",e.target.value);setAck(false);}}>{stocks.map(item=><option key={item.symbol} value={item.symbol} disabled={item.halted}>{item.symbol} · {item.name}{item.halted?" (halted)":""}</option>)}</select></Field><label className="legal-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/><span>I understand tokenized stocks can be restricted or halted and may not be available in my jurisdiction.</span></label></div>}
        </FormPanel>

        <FormPanel title="Reward rules" note="Platform standard">
          <div className="reward-rules"><RuleIcon icon={<TimerReset/>} title="Amount × time" text="Eligible balance and holding duration combine into an AQUA Score."/><RuleIcon icon={<Clock3/>} title="Epoch distribution" text="Rewards accumulate for batched purchase and transparent distribution."/><RuleIcon icon={<ShieldCheck/>} title="Separate vault" text="Reward value is kept distinct from the platform fee route."/></div>
          <p className="rules-note"><LockKeyhole/>These rules are fixed by the reward program, not changed by individual creators.</p>
        </FormPanel>

        <details className="optional-panel"><summary><span><ChevronDown/> Project links</span><small>Optional</small></summary><div className="field-grid"><Field label="X account or post"><input value={form.xUrl} placeholder="x.com/account or /status/..." onChange={e=>set("xUrl",e.target.value)}/></Field><Field label="Website"><input value={form.websiteUrl} placeholder="yourproject.xyz" onChange={e=>set("websiteUrl",e.target.value)}/></Field><Field label="Telegram" wide><input value={form.telegramUrl} placeholder="t.me/yourcommunity" onChange={e=>set("telegramUrl",e.target.value)}/></Field></div></details>

        <section className="launch-bottom"><div><h2>Ready to make it real?</h2><p>Your wallet will show the final transaction before anything is submitted.</p></div><button className="primary launch-button" disabled={!readyForOptions} onClick={openLaunchOptions}>{wallet.address ? `Launch ${form.symbol ? `$${form.symbol}` : "coin"}` : "Connect wallet to launch"}</button></section>
      </section>
    </div>

    {launchOpen && <div className="wallet-overlay" role="presentation" onMouseDown={()=>!busy&&setLaunchOpen(false)}><section className="launch-options-modal" role="dialog" aria-modal="true" aria-labelledby="launch-options-title" onMouseDown={event=>event.stopPropagation()}><button className="modal-close" onClick={()=>setLaunchOpen(false)} aria-label="Close launch options"><X size={17}/></button><span className="modal-mascot"><img src={`${import.meta.env.BASE_URL}aqua-logo.png`} alt=""/></span><h2 id="launch-options-title">One last launch option</h2><p>Choose whether your wallet should buy tokens in the launch transaction. This is public and does not receive special reward treatment.</p><div className="switch-row"><div><b>Initial developer buy</b><small>Optional, maximum 10 SOL</small></div><button className={`switch ${devBuy?"on":""}`} onClick={()=>setDevBuy(!devBuy)} aria-label="Toggle initial developer buy" aria-pressed={devBuy}><i/></button></div>{devBuy&&<><div className="dev-amount"><span>Initial buy</span><b>{devSol.toFixed(1)} SOL</b></div><input className="range" type="range" min="0.1" max="10" step="0.1" value={devSol} onChange={e=>setDevSol(Number(e.target.value))}/><div className="launch-option-note">Estimated {quote.netSol.toFixed(3)} SOL enters the market after fees.</div></>}<div className="modal-launch-summary"><span>{form.name} · ${form.symbol}</span><b>{reward ? `${form.stockSymbol} holder rewards` : "Standard SOL market"}</b></div><div className={`deployment-state ${config.transactionsEnabled?"ready":"unavailable"}`}>{config.transactionsEnabled?<ShieldCheck/>:<LockKeyhole/>}<div><b>{config.transactionsEnabled?"Ready for wallet approval":"Launching is not active yet"}</b><span>{config.transactionsEnabled?"Your wallet will display the final transaction.":"A deployed launch program must be configured before submission."}</span></div></div><button className="primary full" disabled={!config.transactionsEnabled||busy} onClick={()=>void launch()}>{busy?<><Loader2 className="spin"/>Waiting for wallet</>:"Sign and launch"}</button></section></div>}
  </main>;
}

function FormPanel({title,note,children}:{title:string;note:string;children:React.ReactNode}) { return <section className="form-panel"><header><h2>{title}</h2><small>{note}</small></header>{children}</section>; }
function Field({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}) { return <label className={wide?"field wide":"field"}><span>{label}</span>{children}</label>; }
function Choice({selected,title,text,onClick,disabled=false}:{selected:boolean;title:string;text:string;onClick:()=>void;disabled?:boolean}) { return <button className={`pair-choice ${selected?"selected":""}`} onClick={onClick} disabled={disabled}><b>{title}</b>{selected&&<Check/>}<small>{text}</small>{disabled&&<em>Unavailable</em>}</button>; }
function RuleIcon({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) { return <div><span>{icon}</span><b>{title}</b><small>{text}</small></div>; }
