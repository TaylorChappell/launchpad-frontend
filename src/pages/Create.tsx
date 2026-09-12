import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleDollarSign, Coins, Droplets,
  ExternalLink, ImagePlus, Info, Loader2, LockKeyhole, RefreshCw, Search,
  Sparkles, Waves, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import { buildLaunchMessage, decimalToRaw } from "../launch";
import type { LaunchConfirmation, StockOption, TransactionEnvelope } from "../types";

type LaunchCurrency = "SOL" | "USDC" | "STOCK";
type Form = {
  name: string; symbol: string; description: string; xUrl: string; websiteUrl: string;
  telegramUrl: string; launchCurrency: LaunchCurrency; launchAmount: string;
};
type ChainStage = "mint" | "pool" | "liquidity" | "lock" | "devBuy";
type ProgressKey = "approval" | ChainStage;
type ProgressState = "waiting" | "active" | "done" | "error";
type PendingAction = { envelope: TransactionEnvelope; stage: ChainStage; launchId: string; signature?: string };

const empty: Form = { name: "", symbol: "", description: "", xUrl: "", websiteUrl: "", telegramUrl: "", launchCurrency: "SOL", launchAmount: "" };
const wizardSteps = [
  { label: "Coin", short: "Name and artwork" },
  { label: "Reward stock", short: "Choose the permanent pair" },
  { label: "Launch", short: "Choose how to enter" },
] as const;
const chainSteps: Array<{ key: ProgressKey; label: string; detail: string }> = [
  { key: "approval", label: "Authorise launch", detail: "Confirm the launch details" },
  { key: "mint", label: "Create token", detail: "Create the Token-2022 mint" },
  { key: "pool", label: "Open Whirlpool", detail: "Create the Orca stock pair" },
  { key: "liquidity", label: "Add liquidity", detail: "Fund the opening market" },
  { key: "lock", label: "Lock liquidity", detail: "Lock the position permanently" },
  { key: "devBuy", label: "Initial buy", detail: "Complete the optional first buy" },
];
const initialProgress = (): Record<ProgressKey, ProgressState> => ({ approval: "waiting", mint: "waiting", pool: "waiting", liquidity: "waiting", lock: "waiting", devBuy: "waiting" });
const normaliseUrl = (value: string, prefix = "https://") => value.trim() ? (/^https?:\/\//i.test(value.trim()) ? value.trim() : `${prefix}${value.trim()}`) : null;
const normaliseTelegram = (value: string) => {
  const clean = value.trim().replace(/^@/, "");
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (/^(t\.me|telegram\.me)\//i.test(clean)) return `https://${clean}`;
  return `https://t.me/${clean}`;
};
const isEnvelope = (value: LaunchConfirmation): value is LaunchConfirmation & TransactionEnvelope => Boolean(value.transactionBase64 && value.lastValidBlockHeight && value.transactionVersion !== undefined);

export function Create() {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [form, setForm] = useState<Form>(empty);
  const [step, setStep] = useState(0);
  const [stocks, setStocks] = useState<StockOption[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [visibleStocks, setVisibleStocks] = useState(10);
  const [stock, setStock] = useState<StockOption | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionState, setExecutionState] = useState<"running" | "error" | "complete">("running");
  const [progress, setProgress] = useState(initialProgress);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [launchId, setLaunchId] = useState("");
  const [executionError, setExecutionError] = useState("");

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function loadStocks() {
    setStockLoading(true); setStockError("");
    try {
      const result = await api.stocks();
      setStocks(result.stocks);
      if (!stock && result.stocks[0]) setStock(result.stocks[0]);
      if (!result.stocks.length) setStockError("No supported stock pairs are available right now.");
    } catch (error) {
      setStockError(error instanceof Error ? error.message : "Could not load stocks.");
    } finally { setStockLoading(false); }
  }

  useEffect(() => { void loadStocks(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const filteredStocks = useMemo(() => {
    const query = stockQuery.trim().toLowerCase();
    const result = query ? stocks.filter((item) => `${item.symbol} ${item.underlyingSymbol} ${item.name}`.toLowerCase().includes(query)) : stocks;
    return result.slice(0, visibleStocks);
  }, [stocks, stockQuery, visibleStocks]);
  const stockResultsCount = useMemo(() => {
    const query = stockQuery.trim().toLowerCase();
    return query ? stocks.filter((item) => `${item.symbol} ${item.underlyingSymbol} ${item.name}`.toLowerCase().includes(query)).length : stocks.length;
  }, [stocks, stockQuery]);
  const amount = Number(form.launchAmount || "0");
  const hasInitialBuy = Number.isFinite(amount) && amount > 0;
  const amountValid = !form.launchAmount.trim() || hasInitialBuy;
  const validForStep = [form.name.trim().length >= 2 && form.symbol.trim().length >= 2, Boolean(stock) && acknowledged, amountValid];
  const transferFee = config.fees.transferFeeBps / 100;
  const platformFee = config.fees.platformBps / 100;
  const rewardFee = config.fees.stockRewardsBps / 100;
  const currencySymbol = form.launchCurrency === "STOCK" ? stock?.symbol ?? "STOCK" : form.launchCurrency;
  const currencyDecimals = form.launchCurrency === "SOL" ? 9 : form.launchCurrency === "USDC" ? 6 : stock?.decimals ?? 6;

  function chooseArtwork(next: File | null) {
    if (next && next.size > 3 * 1024 * 1024) { toast.error("Artwork must be 3 MB or smaller."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(next ? URL.createObjectURL(next) : "");
  }

  function nextStep() {
    if (!validForStep[step]) {
      toast.error(step === 0 ? "Add a coin name and ticker." : step === 1 ? "Choose a stock and confirm the restriction notice." : "Enter a valid amount.");
      return;
    }
    setStep((current) => Math.min(wizardSteps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setStage(key: ProgressKey, value: ProgressState) { setProgress((current) => ({ ...current, [key]: value })); }

  async function continueLaunch(action: PendingAction) {
    let retryAction = action;
    setExecutionState("running"); setExecutionError(""); setStage(action.stage, "active"); setPending(action);
    try {
      let signature = action.signature;
      if (!signature) {
        signature = await wallet.sendTransaction(action.envelope);
        retryAction = { ...action, signature }; setPending(retryAction);
      }
      if (action.stage === "devBuy") {
        setStage("devBuy", "done"); setPending(null); setExecutionState("complete"); toast.success("AQUA market launched"); return;
      }
      const confirmation = await api.confirmLaunch(action.launchId, signature);
      setStage(action.stage, "done");
      if (confirmation.status === "live") {
        if (confirmation.devBuy && hasInitialBuy) await continueLaunch({ envelope: confirmation.devBuy, stage: "devBuy", launchId: action.launchId });
        else { setPending(null); setExecutionState("complete"); toast.success("AQUA market launched"); }
        return;
      }
      if (!confirmation.nextStep || !isEnvelope(confirmation)) throw new Error("The backend returned an incomplete launch step.");
      await continueLaunch({ envelope: confirmation, stage: confirmation.nextStep, launchId: action.launchId });
    } catch (error) {
      setStage(action.stage, "error"); setPending(retryAction); setExecutionState("error");
      setExecutionError(error instanceof Error ? error.message : "The launch could not continue.");
    }
  }

  async function beginLaunch() {
    if (!wallet.address) { wallet.setModalOpen(true); return; }
    if (!stock || !acknowledged || !amountValid || !form.name.trim() || !form.symbol.trim()) { toast.error("Complete every required launch step first."); return; }
    if (hasInitialBuy && form.launchCurrency !== "STOCK") {
      toast.error(`${form.launchCurrency} routing is not enabled by the current backend yet. Choose ${stock.symbol} or leave the initial buy empty.`); return;
    }
    if (!config.transactionsEnabled) { toast.error("On-chain launching is not enabled by the backend."); return; }

    setExecutionOpen(true); setExecutionState("running"); setExecutionError(""); setProgress(initialProgress());
    setStage("approval", "active"); setLaunchId(""); setPending(null);
    try {
      const clientRequestId = crypto.randomUUID(); const timestamp = Date.now(); const symbol = form.symbol.trim().toUpperCase();
      const message = buildLaunchMessage({ wallet: wallet.address, requestId: clientRequestId, symbol, stockSymbol: stock.symbol, timestamp });
      const signed = await wallet.signMessage(message);
      let imageId: string | null = null;
      if (file) {
        const body = new FormData(); body.set("file", file); body.set("creatorWallet", wallet.address); body.set("clientRequestId", clientRequestId);
        body.set("symbol", symbol); body.set("stockSymbol", stock.symbol); body.set("timestamp", String(timestamp)); body.set("signature", signed.signature); body.set("message", signed.message);
        imageId = (await api.upload(body)).imageId;
      }
      const initialBuyRaw = hasInitialBuy ? decimalToRaw(form.launchAmount, currencyDecimals) : "0";
      const intent = await api.createLaunch({
        creatorWallet: wallet.address, clientRequestId, symbol, stockSymbol: stock.symbol, timestamp,
        signature: signed.signature, message: signed.message, name: form.name.trim(), description: form.description.trim(), imageId,
        stockMint: stock.mint, launchCurrency: form.launchCurrency, launchAmountRaw: initialBuyRaw,
        devBuyStockRaw: form.launchCurrency === "STOCK" ? initialBuyRaw : "0",
        devBuyLamports: form.launchCurrency === "SOL" ? initialBuyRaw : "0",
        sniperDefense: false, xUrl: normaliseUrl(form.xUrl), websiteUrl: normaliseUrl(form.websiteUrl), telegramUrl: normaliseTelegram(form.telegramUrl),
      });
      setLaunchId(intent.launchId); setStage("approval", "done");
      await continueLaunch({ envelope: intent, stage: "mint", launchId: intent.launchId });
    } catch (error) {
      setStage("approval", "error"); setExecutionState("error"); setExecutionError(error instanceof Error ? error.message : "The launch could not be prepared.");
    }
  }

  const shownChainSteps = chainSteps.filter((item) => item.key !== "devBuy" || hasInitialBuy);

  return <main className="page launch-wizard-page launch-wizard-only">
    <section className="wizard-shell">
      <div className="wizard-caustics" aria-hidden="true"/>
      <aside className="wizard-rail" aria-label="Launch steps">
        <div className="wizard-rail-head"><span>Create coin</span><b>{step + 1} of {wizardSteps.length}</b></div>
        <div className="wizard-rail-track"><i style={{ height: `${(step / (wizardSteps.length - 1)) * 100}%` }}/></div>
        {wizardSteps.map((item, index) => <button key={item.label} className={`${index === step ? "active" : ""} ${index < step ? "done" : ""}`} onClick={() => { if (index <= step) setStep(index); }} disabled={index > step}>
          <span>{index < step ? <Check size={15}/> : index + 1}</span><div><b>{item.label}</b><small>{item.short}</small></div>
        </button>)}
        <div className="wizard-rail-pulse" aria-hidden="true"><i/><i/><i/></div>
      </aside>

      <div className="wizard-main">
        {step === 0 && <WizardSection title="Create your coin" description="Add the basics. Everything except the name and ticker is optional.">
          <div className="coin-identity-grid">
            <label className="wizard-artwork">
              {preview ? <img src={preview} alt="Token artwork preview"/> : <><ImagePlus/><b>Add artwork</b><small>PNG, JPG, WebP or GIF</small></>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => chooseArtwork(event.target.files?.[0] ?? null)}/>
              {preview && <button type="button" aria-label="Remove artwork" onClick={(event) => { event.preventDefault(); chooseArtwork(null); }}><X size={15}/></button>}
            </label>
            <div className="wizard-field-grid">
              <Field label="Coin name"><input value={form.name} maxLength={32} placeholder="Aqua Robotics" onChange={(event) => update("name", event.target.value)}/></Field>
              <Field label="Ticker"><div className="ticker-input"><span>$</span><input value={form.symbol} maxLength={10} placeholder="AQR" onChange={(event) => update("symbol", event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}/></div></Field>
              <Field label="Description" wide><textarea value={form.description} rows={4} maxLength={360} placeholder="What is this coin about?" onChange={(event) => update("description", event.target.value)}/><small className="field-count">{form.description.length}/360</small></Field>
            </div>
          </div>
          <details className="wizard-optional"><summary><span>Socials</span><small>Optional</small><ChevronDown size={16}/></summary><div className="wizard-field-grid three">
            <Field label="X"><input value={form.xUrl} placeholder="x.com/account or post" onChange={(event) => update("xUrl", event.target.value)}/></Field>
            <Field label="Website"><input value={form.websiteUrl} placeholder="project.com" onChange={(event) => update("websiteUrl", event.target.value)}/></Field>
            <Field label="Telegram"><input value={form.telegramUrl} placeholder="t.me/community" onChange={(event) => update("telegramUrl", event.target.value)}/></Field>
          </div></details>
        </WizardSection>}

        {step === 1 && <WizardSection title="Choose a reward stock" description="The coin launches against this stock and holders earn the same asset.">
          <div className="stock-search"><Search size={17}/><input value={stockQuery} placeholder="Search stocks or tickers" onChange={(event) => { setStockQuery(event.target.value); setVisibleStocks(10); }}/><span>{stocks.length} stocks</span></div>
          {stockLoading ? <div className="stock-loading"><Loader2 className="spin"/><span>Loading stocks</span></div> : stockError ? <div className="stock-error"><Info/><span>{stockError}</span><button onClick={() => void loadStocks()}><RefreshCw size={14}/> Retry</button></div> : <>
            <div className="stock-picker">{filteredStocks.map((item) => <button key={item.mint} className={stock?.mint === item.mint ? "selected" : ""} onClick={() => { setStock(item); setAcknowledged(false); }}>
              <StockLogo stock={item}/><div><b>{item.symbol}</b><small>{item.name}</small></div><span>{item.marketOpen === false ? "Market closed" : "Available"}</span><i>{stock?.mint === item.mint && <Check size={14}/>}</i>
            </button>)}</div>
            {filteredStocks.length === 0 && <div className="no-stock-results">No stocks match “{stockQuery}”.</div>}
            {filteredStocks.length < stockResultsCount && <button className="stock-more" onClick={() => setVisibleStocks((value) => value + 20)}>Show more</button>}
          </>}
          {stock && <div className="selected-stock-strip"><StockLogo stock={stock}/><div><small>Permanent stock pair</small><b>${form.symbol || "TOKEN"} / {stock.symbol}</b></div><span>Holder rewards in {stock.symbol}</span></div>}
          <label className="stock-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I understand tokenized stocks may be restricted or unavailable in my jurisdiction.</span></label>
        </WizardSection>}

        {step === 2 && <WizardSection title="Launch your coin" description="Choose the currency for your optional first buy, or leave the amount empty.">
          <div className="launch-currency-grid" role="radiogroup" aria-label="Launch currency">
            <CurrencyButton code="SOL" name="Solana" active={form.launchCurrency === "SOL"} onClick={() => { update("launchCurrency", "SOL"); update("launchAmount", ""); }} icon={<span className="solana-glyph">S</span>}/>
            <CurrencyButton code="USDC" name="USD Coin" active={form.launchCurrency === "USDC"} onClick={() => { update("launchCurrency", "USDC"); update("launchAmount", ""); }} icon={<CircleDollarSign/>}/>
            <CurrencyButton code={stock?.symbol ?? "STOCK"} name="Selected stock" active={form.launchCurrency === "STOCK"} onClick={() => { update("launchCurrency", "STOCK"); update("launchAmount", ""); }} icon={stock ? <StockLogo stock={stock}/> : <Coins/>}/>
          </div>
          <Field label="Initial buy" wide><div className="unit-input launch-amount-input"><input inputMode="decimal" value={form.launchAmount} placeholder="Optional" onChange={(event) => update("launchAmount", event.target.value.replace(/[^0-9.]/g, ""))}/><span>{currencySymbol}</span></div></Field>
          {hasInitialBuy && form.launchCurrency !== "STOCK" && <div className="currency-route-note"><Info/><span>{form.launchCurrency} first-buy routing must be enabled on the backend before this option can submit. You can still launch without an initial buy.</span></div>}
          <div className="launch-rules-grid launch-rules-simple">
            <div><Droplets/><span><small>Total transfer fee</small><b>{transferFee}%</b></span></div>
            <div><Coins/><span><small>Stock rewards</small><b>{rewardFee}%</b></span></div>
            <div><Sparkles/><span><small>Platform route</small><b>{platformFee}%</b></span></div>
            <div><LockKeyhole/><span><small>Liquidity</small><b>Locked</b></span></div>
          </div>
          <div className="launch-final-summary"><div className="review-token-art">{preview ? <img src={preview} alt=""/> : <Droplets/>}</div><div><b>{form.name || "Unnamed coin"}</b><span>${form.symbol || "TICKER"} paired with {stock?.symbol ?? "stock"}</span></div><strong>{hasInitialBuy ? `${form.launchAmount} ${currencySymbol}` : "No initial buy"}</strong></div>
          <button className="wizard-launch-button" onClick={() => void beginLaunch()} disabled={!validForStep[2]}><span className="button-current"/>{wallet.address ? <><Waves/> Launch ${form.symbol || "coin"}</> : <><Waves/> Connect wallet to launch</>}</button>
        </WizardSection>}

        <footer className="wizard-actions"><button className="wizard-back" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ArrowLeft/> Back</button>{step < wizardSteps.length - 1 && <button className="wizard-next" onClick={nextStep} disabled={!validForStep[step]}>Continue <ArrowRight/></button>}</footer>
      </div>
    </section>

    {executionOpen && <div className="launch-execution-overlay" role="presentation"><section className="launch-execution" role="dialog" aria-modal="true" aria-labelledby="execution-title">
      <div className="execution-water" aria-hidden="true"><i/><i/><i/><i/></div>
      {executionState === "complete" ? <div className="execution-complete"><span><Check/></span><small>Market live</small><h2 id="execution-title">Your coin is on Orca.</h2><p>The pool is open and its liquidity position is permanently locked.</p><Link className="primary full" to={`/token/${launchId}`}>View ${form.symbol} market <ExternalLink size={16}/></Link></div> : <>
        <header className="execution-heading"><div><small>Launching ${form.symbol}</small><h2 id="execution-title">Follow your wallet</h2><p>Approve each step as it becomes ready.</p></div>{executionState === "error" && <button onClick={() => setExecutionOpen(false)} aria-label="Close launch progress"><X/></button>}</header>
        <div className="execution-steps">{shownChainSteps.map((item) => <div key={item.key} className={progress[item.key]}><span>{progress[item.key] === "done" ? <Check/> : progress[item.key] === "active" ? <Loader2 className="spin"/> : progress[item.key] === "error" ? <X/> : null}</span><div><b>{item.label}</b><small>{item.detail}</small></div><em>{progress[item.key] === "active" ? "Wallet" : progress[item.key] === "done" ? "Confirmed" : progress[item.key] === "error" ? "Stopped" : "Waiting"}</em></div>)}</div>
        {executionState === "error" && <div className="execution-error"><Info/><span>{executionError}</span></div>}
        {executionState === "error" && <div className="execution-actions">{pending ? <button className="primary full" onClick={() => void continueLaunch(pending)}><RefreshCw/> Retry this step</button> : <button className="primary full" onClick={() => void beginLaunch()}><RefreshCw/> Start again</button>}<button className="execution-close" onClick={() => setExecutionOpen(false)}>Return to launch</button></div>}
      </>}
    </section></div>}
  </main>;
}

function WizardSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="wizard-section"><header><h2>{title}</h2><p>{description}</p></header><div className="wizard-section-body">{children}</div></section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`wizard-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }
function CurrencyButton({ code, name, active, icon, onClick }: { code: string; name: string; active: boolean; icon: ReactNode; onClick: () => void }) { return <button type="button" role="radio" aria-checked={active} className={active ? "selected" : ""} onClick={onClick}><i>{icon}</i><span><b>{code}</b><small>{name}</small></span><em>{active && <Check/>}</em></button>; }
function StockLogo({ stock }: { stock: StockOption }) { const [failed, setFailed] = useState(false); return <span className="stock-logo">{stock.logoUrl && !failed ? <img src={stock.logoUrl} alt="" onError={() => setFailed(true)}/> : stock.underlyingSymbol.slice(0, 2)}</span>; }
