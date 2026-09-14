import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Check, Droplets, ImagePlus, Info, Rocket,
  Loader2, RefreshCw, Search, X,
} from "lucide-react";
import { NetworkSolana } from "@web3icons/react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import { PageBubbles } from "../components/PageBubbles";
import { TokenMark } from "../components/TokenCard";
import type { Launch, LaunchBatchEnvelope, LaunchConfirmation, StockOption, TransactionEnvelope } from "../types";

type DevBuyCurrency = "SOL" | "USDC";
type Form = {
  name: string; symbol: string; description: string; xUrl: string; websiteUrl: string;
  telegramUrl: string; devBuyCurrency: DevBuyCurrency; launchAmount: string;
};
type ChainStage = "mint" | "pool" | "liquidity" | "lock" | "devBuy";
type ProgressKey = "approval" | ChainStage;
type ProgressState = "waiting" | "active" | "done" | "error";
type PendingAction = { launchId: string; stage: ChainStage; envelope?: TransactionEnvelope; signature?: string };

const empty: Form = { name: "", symbol: "", description: "", xUrl: "", websiteUrl: "", telegramUrl: "", devBuyCurrency: "SOL", launchAmount: "" };
const wizardSteps = [
  { label: "Coin", short: "Name and artwork" },
  { label: "Pair & rewards", short: "Choose SOL or an xStock" },
  { label: "Dev buy", short: "Optional first buy" },
] as const;
const chainSteps: Array<{ key: ProgressKey; label: string; detail: string }> = [
  { key: "approval", label: "Prepare launch", detail: "Store artwork and immutable metadata" },
  { key: "mint", label: "Create token", detail: "Wallet approval 1 of 2" },
  { key: "pool", label: "Approve Orca market", detail: "Wallet approval 2 signs the launch batch" },
  { key: "liquidity", label: "Verify liquidity", detail: "Prove the opening position is active" },
  { key: "lock", label: "Lock liquidity", detail: "Permanently lock the verified position" },
  { key: "devBuy", label: "Initial buy", detail: "Optional transaction after launch" },
];
const initialProgress = (): Record<ProgressKey, ProgressState> => ({ approval: "waiting", mint: "waiting", pool: "waiting", liquidity: "waiting", lock: "waiting", devBuy: "waiting" });
const normaliseUrl = (value: string, prefix = "https://") => value.trim() ? (/^https?:\/\//i.test(value.trim()) ? value.trim() : `${prefix}${value.trim()}`) : null;
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const normaliseTelegram = (value: string) => {
  const clean = value.trim().replace(/^@/, "");
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (/^(t\.me|telegram\.me)\//i.test(clean)) return `https://${clean}`;
  return `https://t.me/${clean}`;
};
const isEnvelope = (value: Partial<TransactionEnvelope>): value is TransactionEnvelope => Boolean(value.transactionBase64 && value.lastValidBlockHeight && value.transactionVersion !== undefined);
const launchToastId = "aqua-launch-progress";
const amountPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionState, setExecutionState] = useState<"running" | "error" | "complete">("running");
  const [progress, setProgress] = useState(initialProgress);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [recoverableLaunch, setRecoverableLaunch] = useState<Launch | null>(null);
  const [completedLaunch, setCompletedLaunch] = useState<{ id: string; mint?: string } | null>(null);

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
  useEffect(() => {
    if (!wallet.address) { setRecoverableLaunch(null); return; }
    let active = true;
    api.launches().then(({ launches }) => {
      if (!active) return;
      setRecoverableLaunch(launches.find((item) => item.creatorWallet === wallet.address && item.status !== "live") ?? null);
    }).catch(() => { if (active) setRecoverableLaunch(null); });
    return () => { active = false; };
  }, [wallet.address]);

  const filteredStocks = useMemo(() => {
    const query = stockQuery.trim().toLowerCase();
    const result = query ? stocks.filter((item) => `${item.symbol} ${item.underlyingSymbol} ${item.name}`.toLowerCase().includes(query)) : stocks;
    return result.slice(0, visibleStocks);
  }, [stocks, stockQuery, visibleStocks]);
  const stockResultsCount = useMemo(() => {
    const query = stockQuery.trim().toLowerCase();
    return query ? stocks.filter((item) => `${item.symbol} ${item.underlyingSymbol} ${item.name}`.toLowerCase().includes(query)).length : stocks.length;
  }, [stocks, stockQuery]);
  const amountInput = form.launchAmount.trim();
  const amount = Number(amountInput || "0");
  const amountValid = !amountInput || (amountPattern.test(amountInput) && Number.isFinite(amount) && amount >= 0);
  const hasInitialBuy = amountValid && amount > 0;
  const validForStep = [form.name.trim().length >= 2 && form.symbol.trim().length >= 2 && Boolean(file), Boolean(stock) && (!stock?.restricted || acknowledged), amountValid];
  const currencySymbol = form.devBuyCurrency;
  const launchCost = config.launchCost;
  const currencyDecimals = form.devBuyCurrency === "SOL" ? 9 : 6;
  const launching = executionOpen && executionState === "running";
  const activeProgress = chainSteps.find((item) => progress[item.key] === "active")?.label ?? "Preparing launch";

  function chooseArtwork(next: File | null) {
    if (next && next.size > 3 * 1024 * 1024) { toast.error("Artwork must be 3 MB or smaller."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(next ? URL.createObjectURL(next) : "");
  }

  function nextStep() {
    if (!validForStep[step]) {
      toast.error(step === 0 ? "Add a coin name, ticker, and artwork." : step === 1 ? "Choose SOL or a supported stock." : "Enter a valid amount.");
      return;
    }
    setStep((current) => Math.min(wizardSteps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setStage(key: ProgressKey, value: ProgressState) { setProgress((current) => ({ ...current, [key]: value })); }

  function showLaunchError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setExecutionState("error");
    setExecutionOpen(false);
    toast.error("Launch stopped", { id: launchToastId, description: message, duration: 10_000 });
  }

  function showLaunchStatus(title: string, description: string) {
    toast.loading(title, { id: launchToastId, description });
  }

  function finishLaunch(launchId: string, mint?: string) {
    setPending(null); setExecutionState("complete"); setExecutionOpen(false); setRecoverableLaunch(null);
    setCompletedLaunch({ id: launchId, mint });
    toast.success("AQUA market launched", { id: launchToastId, description: `$${form.symbol || "Your coin"} is live on Orca.` });
  }

  function launchAnother() {
    if (preview) URL.revokeObjectURL(preview);
    setForm(empty); setFile(null); setPreview(""); setStep(0); setStock(null); setAcknowledged(false); setAcceptedTerms(false);
    setProgress(initialProgress()); setPending(null); setCompletedLaunch(null); setExecutionState("running");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function executeDevBuyPlan(confirmation: LaunchConfirmation) {
    const transactions = confirmation.devBuyPlan?.transactions ?? [];
    if (!transactions.length) return;
    setStage("devBuy", "active");
    for (const [index, transaction] of transactions.entries()) {
      showLaunchStatus(transaction.label, `Approve transaction ${index + 1} of ${transactions.length} for the optional first buy.`);
      await wallet.sendTransaction(transaction);
    }
    if (confirmation.devBuyPlan?.buyAmountRaw) {
      showLaunchStatus(`Buy $${form.symbol}`, "Preparing a fresh Orca transaction after the conversion confirmed.");
      const buy = await api.devBuyTransaction(confirmation.launchId, { trader: wallet.address!, amountRaw: confirmation.devBuyPlan.buyAmountRaw, slippageBps: 300 });
      await wallet.sendTransaction(buy);
    }
    setStage("devBuy", "done");
  }

  async function executeLaunchBatch(id: string, batch: LaunchBatchEnvelope[], repairAttempted = false) {
    let activeStage: ChainStage = batch[0]?.step ?? "pool";
    try {
      if (!batch.length) throw new Error("The backend did not return the Orca launch batch.");
      setPending({ launchId: id, stage: activeStage });
      setStage(activeStage, "active");
      showLaunchStatus("Approve the Orca launch", "Review the market and liquidity transactions in your wallet.");
      const signedBatch = await wallet.signTransactionBatch(batch);
      let finalConfirmation: LaunchConfirmation | null = null;
      for (const signed of signedBatch) {
        activeStage = signed.step;
        setPending({ launchId: id, stage: signed.step });
        setStage(signed.step, "active");
        const validation = await api.validateBatchStep(id, signed.step, signed.signedTransactionBase64);
        if (validation.confirmationRecorded) {
          setStage(signed.step, "done");
          continue;
        }
        const signature = validation.alreadyConfirmed
          ? validation.signature
          : await wallet.submitSignedTransaction(signed);
        if (!signature) throw new Error(`AQUA could not recover the confirmed ${signed.step} transaction.`);
        showLaunchStatus("Waiting for confirmation", `Solana is confirming the ${signed.step} transaction.`);
        finalConfirmation = await api.confirmLaunch(id, signature);
        setStage(signed.step, "done");
      }
      if (finalConfirmation?.status !== "live") {
        const recovered = await api.retryLaunchTransaction(id, wallet.address!);
        if (recovered.status !== "live") throw new Error("The launch steps confirmed, but the backend did not mark the market live.");
      }
      if (finalConfirmation?.devBuyPlan && hasInitialBuy) {
        try { await executeDevBuyPlan(finalConfirmation); }
        catch (error) { setStage("devBuy", "error"); toast.warning("Coin launched without the optional first buy", { description: error instanceof Error ? error.message : "The initial buy was not completed.", duration: 10_000 }); }
      }
      if (finalConfirmation?.devBuyError) toast.warning("Coin launched without the optional first buy", { description: finalConfirmation.devBuyError, duration: 10_000 });
      finishLaunch(id, finalConfirmation?.mint);
    } catch (error) {
      let failure: unknown = error;
      if (!repairAttempted && error instanceof ApiError && error.rebuildRequired && wallet.address) {
        try {
          const fresh = await api.retryLaunchTransaction(id, wallet.address);
          if (fresh.status === "live") { finishLaunch(id); return; }
          if (!fresh.batch?.length) throw new Error("The backend could not rebuild the remaining Orca launch transactions.");
          await executeLaunchBatch(id, fresh.batch, true);
          return;
        } catch (recoveryError) {
          failure = recoveryError;
        }
      }
      setPending({ launchId: id, stage: activeStage });
      setStage(activeStage, "error");
      showLaunchError(failure, "The Orca launch batch could not continue.");
    }
  }

  async function continueLaunch(action: PendingAction) {
    if (!action.envelope) throw new Error("The next launch transaction is unavailable.");
    setExecutionOpen(true); setExecutionState("running"); setStage(action.stage, "active");
    let retryAction = action;
    setPending(action);
    try {
      let signature = action.signature;
      if (!signature) {
        showLaunchStatus(action.stage === "mint" ? "Approve token creation" : "Approve transaction", "Review the request in your wallet to continue.");
        signature = await wallet.sendTransaction(action.envelope);
        retryAction = { ...action, signature };
        setPending(retryAction);
      }
      showLaunchStatus("Waiting for confirmation", "Solana is confirming your transaction.");
      if (action.stage === "devBuy") {
        setStage("devBuy", "done"); finishLaunch(action.launchId); return;
      }
      const confirmation = await api.confirmLaunch(action.launchId, signature);
      setStage(action.stage, "done");
      if (action.stage === "mint") {
        if (!confirmation.batch?.length) throw new Error("The backend did not return the Orca launch batch.");
        await executeLaunchBatch(action.launchId, confirmation.batch);
        return;
      }
      if (confirmation.status === "live") {
        if (confirmation.devBuyPlan && hasInitialBuy) {
          try { await executeDevBuyPlan(confirmation); }
          catch (error) { setStage("devBuy", "error"); toast.warning("Coin launched without the optional first buy", { description: error instanceof Error ? error.message : "The initial buy was not completed.", duration: 10_000 }); }
        }
        if (confirmation.devBuyError) toast.warning("Coin launched without the optional first buy", { description: confirmation.devBuyError, duration: 10_000 });
        finishLaunch(action.launchId, confirmation.mint);
        return;
      }
      if (!confirmation.nextStep || !isEnvelope(confirmation)) throw new Error("The backend returned an incomplete launch step.");
      await continueLaunch({ envelope: confirmation, stage: confirmation.nextStep, launchId: action.launchId });
    } catch (error) {
      if (action.stage === "mint" && retryAction.signature) {
        setPending({ launchId: action.launchId, stage: "pool" });
        setStage("mint", "done"); setStage("pool", "error");
      } else {
        setPending(retryAction); setStage(action.stage, "error");
      }
      showLaunchError(error, "The launch could not continue.");
    }
  }

  async function retryLaunch() {
    if (!pending || !wallet.address) { await beginLaunch(); return; }
    if (pending.signature) { await continueLaunch(pending); return; }
    try {
      setExecutionOpen(true); setExecutionState("running"); setStage(pending.stage, "active");
      showLaunchStatus("Resuming launch", "AQUA is rebuilding the next safe transaction.");
      if (pending.stage === "mint") { await beginLaunch(); return; }
      if (pending.stage === "devBuy") {
        const envelope = await api.tradeTransaction(pending.launchId, {
          trader: wallet.address,
          side: "buy",
          amountRaw: decimalToRaw(form.launchAmount, currencyDecimals),
          slippageBps: 300,
        });
        await continueLaunch({ envelope, stage: "devBuy", launchId: pending.launchId });
        return;
      }
      const fresh = await api.retryLaunchTransaction(pending.launchId, wallet.address);
      if (fresh.status === "live") {
        setStage("lock", "done"); finishLaunch(pending.launchId); return;
      }
      if (fresh.batch?.length) { await executeLaunchBatch(pending.launchId, fresh.batch); return; }
      if (!fresh.step || !isEnvelope(fresh)) throw new Error("The backend returned an incomplete recovery step.");
      await continueLaunch({ envelope: fresh, stage: fresh.step, launchId: pending.launchId });
    } catch (error) {
      setStage(pending.stage, "error");
      showLaunchError(error, "A fresh transaction could not be prepared.");
    }
  }

  async function resumeExistingLaunch() {
    if (!recoverableLaunch || !wallet.address) return;
    if (launching) return;
    setExecutionOpen(true); setExecutionState("running"); setPending(null);
    showLaunchStatus("Resuming launch", "AQUA is checking confirmed steps and preparing what remains.");
    try {
      const fresh = await api.retryLaunchTransaction(recoverableLaunch.id, wallet.address);
      const restored = initialProgress();
      restored.approval = "done"; restored.mint = "done";
      if (fresh.status === "live") {
        restored.pool = "done"; restored.liquidity = "done"; restored.lock = "done"; setProgress(restored); finishLaunch(recoverableLaunch.id, recoverableLaunch.mint); return;
      }
      if (fresh.batch?.length) {
        const first = fresh.batch[0]?.step;
        if (first === "liquidity" || first === "lock") restored.pool = "done";
        if (first === "lock") restored.liquidity = "done";
        setProgress(restored);
        await executeLaunchBatch(recoverableLaunch.id, fresh.batch);
      } else {
        if (!fresh.step || !isEnvelope(fresh)) throw new Error("The backend returned an incomplete recovery step.");
        if (fresh.step === "liquidity" || fresh.step === "lock") restored.pool = "done";
        if (fresh.step === "lock") restored.liquidity = "done";
        setProgress(restored);
        await continueLaunch({ envelope: fresh, stage: fresh.step, launchId: recoverableLaunch.id });
      }
      setRecoverableLaunch(null);
    } catch (error) {
      showLaunchError(error, "The existing launch could not be resumed.");
    }
  }

  async function beginLaunch() {
    if (launching) return;
    if (!wallet.address) { wallet.setModalOpen(true); return; }
    if (!stock || !file || (stock.restricted && !acknowledged) || !amountValid || !form.name.trim() || !form.symbol.trim() || !acceptedTerms) { toast.error("Complete every required launch step and accept the Terms of Service first."); return; }
    if (!config.transactionsEnabled) { toast.error(config.transactionsDisabledReason ?? "On-chain launching is not enabled by the backend."); return; }

    setExecutionOpen(true); setExecutionState("running"); setProgress(initialProgress()); setPending(null);
    setStage("approval", "active");
    showLaunchStatus("Preparing your launch", "Uploading artwork and creating permanent token metadata.");
    try {
      const clientRequestId = crypto.randomUUID(); const symbol = form.symbol.trim().toUpperCase();
      const body = new FormData(); body.set("file", file); body.set("creatorWallet", wallet.address); body.set("clientRequestId", clientRequestId);
      const imageId = (await api.upload(body)).imageId;
      const initialBuyRaw = hasInitialBuy ? decimalToRaw(form.launchAmount, currencyDecimals) : "0";
      const intent = await api.createLaunch({
        creatorWallet: wallet.address, clientRequestId, symbol, stockSymbol: stock.symbol,
        name: form.name.trim(), description: form.description.trim(), imageId,
        stockMint: stock.mint, poolPair: stock.symbol === "SOL" ? "SOL" : "STOCK",
        devBuyStockRaw: "0", devBuyLamports: "0",
        devBuyCurrency: form.devBuyCurrency, devBuyAmountRaw: initialBuyRaw,
        sniperDefense: false, xUrl: normaliseUrl(form.xUrl), websiteUrl: normaliseUrl(form.websiteUrl), telegramUrl: normaliseTelegram(form.telegramUrl),
      });
      setStage("approval", "done");
      await continueLaunch({ envelope: intent, stage: "mint", launchId: intent.launchId });
    } catch (error) {
      setStage("approval", "error");
      showLaunchError(error, "The launch could not be prepared.");
    }
  }

  return <main className="page launch-wizard-page launch-wizard-only">
    <PageBubbles count={22}/>
    {recoverableLaunch && <section className="launch-resume-banner"><span className="resume-coin-bubble"><TokenMark launch={recoverableLaunch}/></span><div><b>Continue ${recoverableLaunch.symbol}</b><small>A previous launch has a confirmed on-chain step waiting to continue.</small></div><button onClick={() => void resumeExistingLaunch()}><span className="resume-button-current" aria-hidden="true"/><span>Resume launch</span><ArrowRight/></button></section>}
    <section className={`wizard-shell ${launching ? "is-launching" : ""}`}>
      <div className="wizard-caustics" aria-hidden="true"/>
      {launching && <div className="wizard-launching-screen" role="status" aria-live="polite" aria-label={`Launching ${form.symbol}`}>
        <div className="launching-water" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <section className="launch-simple-status">
          <span className="launching-orb"><Loader2 className="spin"/></span>
          <h2>Launching</h2>
          <span className="sr-only">{activeProgress}</span>
        </section>
      </div>}
      {completedLaunch ? <section className="launch-complete-screen" aria-live="polite">
        <div className="launch-complete-water" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <span className="launch-complete-orb"><Rocket/></span>
        <small>Orca market live</small>
        <h1>${form.symbol} launched</h1>
        <p>Your pool is active, the full supply is committed to locked liquidity, and holder rewards follow the selected pair.</p>
        <div className="launch-complete-actions">
          <a className="complete-primary" href={`#/token/${completedLaunch.id}`}><span className="button-current"/>Go to coin <ArrowRight/></a>
          <button className="complete-secondary" onClick={launchAnother}>Launch another coin</button>
        </div>
      </section> : <>
      <aside className="wizard-rail" aria-label="Launch steps">
        <div className="wizard-rail-head"><span>Create coin</span><b>{step + 1} of {wizardSteps.length}</b></div>
        <div className="wizard-rail-track"><i style={{ height: `${(step / (wizardSteps.length - 1)) * 100}%` }}/></div>
        {wizardSteps.map((item, index) => <button key={item.label} className={`${index === step ? "active" : ""} ${index < step ? "done" : ""}`} onClick={() => { if (index <= step) setStep(index); }} disabled={index > step}>
          <span>{index < step ? <Check size={15}/> : index + 1}</span><div><b>{item.label}</b><small>{item.short}</small></div>
        </button>)}
        <div className="wizard-rail-pulse" aria-hidden="true"><i/><i/><i/></div>
      </aside>

      <div className="wizard-main">
        {step === 0 && <WizardSection title="Create your coin" description="Add a name, ticker, and artwork. The description and socials are optional.">
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
          <section className="wizard-socials"><header><span>Socials</span><small>Optional</small></header><div className="wizard-field-grid three">
            <Field label="X"><input value={form.xUrl} placeholder="x.com/account or post" onChange={(event) => update("xUrl", event.target.value)}/></Field>
            <Field label="Website"><input value={form.websiteUrl} placeholder="project.com" onChange={(event) => update("websiteUrl", event.target.value)}/></Field>
            <Field label="Telegram"><input value={form.telegramUrl} placeholder="t.me/community" onChange={(event) => update("telegramUrl", event.target.value)}/></Field>
          </div></section>
        </WizardSection>}

        {step === 1 && <WizardSection title="Choose the pair and reward" description="Launch against SOL or one supported xStock. Holders earn the same asset you choose.">
          <div className="stock-search"><Search size={17}/><input value={stockQuery} placeholder="Search SOL or stocks" onChange={(event) => { setStockQuery(event.target.value); setVisibleStocks(10); }}/><span>{stocks.length} assets</span></div>
          {stockLoading ? <div className="stock-loading"><Loader2 className="spin"/><span>Loading stocks</span></div> : stockError ? <div className="stock-error"><Info/><span>{stockError}</span><button onClick={() => void loadStocks()}><RefreshCw size={14}/> Retry</button></div> : <>
            <div className="stock-picker">{filteredStocks.map((item) => <button key={item.mint} className={stock?.mint === item.mint ? "selected" : ""} onClick={() => { setStock(item); setAcknowledged(false); }}>
              <StockLogo stock={item}/><div><b>{item.symbol}</b><small>{item.name}</small></div><span className="stock-market-depth">{item.symbol === "SOL" ? <><b>Native pair</b><small>SOL rewards</small></> : <><b>${compactNumber.format(item.orcaTvlUsd)} TVL</b><small>${compactNumber.format(item.orcaVolume24hUsd)} 24h</small></>}</span><i>{stock?.mint === item.mint && <Check size={14}/>}</i>
            </button>)}</div>
            {filteredStocks.length === 0 && <div className="no-stock-results">No stocks match “{stockQuery}”.</div>}
            {filteredStocks.length < stockResultsCount && <button className="stock-more" onClick={() => setVisibleStocks((value) => value + 20)}>Show more</button>}
          </>}
          {stock && <div className="selected-stock-strip"><StockLogo stock={stock}/><div><small>Permanent pair and reward</small><b>${form.symbol || "COIN"} / {stock.symbol}</b></div><span>Holder rewards in {stock.symbol}</span></div>}
          {stock?.restricted && <label className="stock-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I understand tokenized stocks may be restricted or unavailable in my jurisdiction.</span></label>}
        </WizardSection>}

        {step === 2 && <WizardSection title="Optional dev buy" description="Choose SOL or USDC to make the first buy. Leave the amount at zero to skip it.">
          <div className="launch-currency-grid pair-choice-grid" role="radiogroup" aria-label="Initial buy currency">
            <CurrencyButton code="SOL" name="Pay with Solana" active={form.devBuyCurrency === "SOL"} onClick={() => { update("devBuyCurrency", "SOL"); update("launchAmount", ""); }} icon={<NetworkSolana className="currency-brand-icon" variant="branded"/>}/>
            <CurrencyButton code="USDC" name="Pay with USD Coin" active={form.devBuyCurrency === "USDC"} onClick={() => { update("devBuyCurrency", "USDC"); update("launchAmount", ""); }} icon={<span className="usdc-mark">$</span>}/>
          </div>
          <Field label={`Optional first buy in ${currencySymbol}`} wide><div className="unit-input launch-amount-input"><input inputMode="decimal" value={form.launchAmount} placeholder="0" onChange={(event) => update("launchAmount", event.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}/><span>{currencySymbol}</span></div></Field>
          {launchCost && <div className="launch-cost-card">
            <div><span><b>Estimated launch cost</b><small>before any optional first buy</small></span><strong>{launchCost.estimatedTotalSol.minimum.toFixed(2)}–{launchCost.estimatedTotalSol.maximum.toFixed(2)} SOL</strong></div>
            <p><b>{launchCost.platformFeeSol.toFixed(2)} SOL AQUA fee</b> funds keeper operations. The rest is estimated Solana/Orca account rent and network fees; your wallet approval shows the authoritative amount.</p>
          </div>}
          <div className="launch-final-summary"><div className="review-token-art">{preview ? <img src={preview} alt=""/> : <Droplets/>}</div><div><b>{form.name || "Unnamed coin"}</b><span>${form.symbol || "TICKER"} / {stock?.symbol ?? "PAIR"} on Orca · rewards in {stock?.symbol ?? "the pair"}</span></div><strong>{hasInitialBuy ? `${form.launchAmount} ${currencySymbol}` : "No initial buy"}</strong></div>
          <label className="terms-acceptance"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)}/><span>I have read and agree to the <Link to="/terms" target="_blank">Terms of Service</Link>, including the cryptoasset, permanent-liquidity and third-party risks.</span></label>
          <button className="wizard-launch-button" onClick={() => void (pending ? retryLaunch() : beginLaunch())} disabled={!validForStep[2] || launching || !acceptedTerms} aria-busy={launching}><span className="button-current"/><span className="launch-button-bubbles" aria-hidden="true"><i/><i/><i/><i/></span>{launching && <Loader2 className="spin"/>}<span>{launching ? "Launching" : wallet.address ? "Launch" : "Connect wallet to launch"}</span></button>
        </WizardSection>}

        <footer className="wizard-actions"><button className="wizard-back" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ArrowLeft/> Back</button>{step < wizardSteps.length - 1 && <button className="wizard-next" onClick={nextStep} disabled={!validForStep[step]}>Continue <ArrowRight/></button>}</footer>
      </div>
      </>}
    </section>

  </main>;
}

function WizardSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="wizard-section"><header><h2>{title}</h2><p>{description}</p></header><div className="wizard-section-body">{children}</div></section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`wizard-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }
function CurrencyButton({ code, name, active, icon, onClick }: { code: string; name: string; active: boolean; icon: ReactNode; onClick: () => void }) { return <button type="button" role="radio" aria-checked={active} className={active ? "selected" : ""} onClick={onClick}><i>{icon}</i><span><b>{code}</b><small>{name}</small></span><em>{active && <Check/>}</em></button>; }
function StockLogo({ stock }: { stock: StockOption }) { const [failed, setFailed] = useState(false); return <span className="stock-logo">{stock.symbol === "SOL" ? <NetworkSolana className="currency-brand-icon" variant="branded"/> : stock.logoUrl && !failed ? <img src={stock.logoUrl} alt="" onError={() => setFailed(true)}/> : stock.underlyingSymbol.slice(0, 2)}</span>; }
