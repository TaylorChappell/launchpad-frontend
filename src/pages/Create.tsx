import { handoffLaunchBatch, watchLaunchSubmission } from "../launch-relay";
import { readLaunchDraft,saveLaunchDraft } from "../launch-draft";
import { ensureAccountSession } from "../account-api";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Check, Droplets, ImagePlus, Info, Rocket,
  Loader2, RefreshCw, Search, X,
} from "lucide-react";
import { NetworkSolana } from "@web3icons/react";
import { Link, useSearchParams } from "react-router-dom";
import { studioAssetFile, studioRequest, studioSession, type StudioProject } from "../studio-api";
import "./studio.css";
import { toast } from "sonner";
import { ApiError, api } from "../api";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import { PageBubbles } from "../components/PageBubbles";
import { TokenMark } from "../components/TokenCard";
import { RewardModeIcon } from "../components/RewardModeIcon";
import { DexProfileFields } from "../components/MarketProposals";
import { DexScreenerIcon } from "../components/DexScreenerIcon";
import type { DexProfile } from "../types";
import type { Launch, LaunchBatchEnvelope, LaunchConfirmation, LaunchRelayStatus, StockOption, TransactionEnvelope } from "../types";

type DevBuyCurrency = "SOL" | "USDC";
type RewardMode = "holder_rewards" | "buyback_burn" | "jackpot";
type Form = {
  name: string; symbol: string; description: string; xUrl: string; websiteUrl: string;
  telegramUrl: string; devBuyCurrency: DevBuyCurrency; launchAmount: string; rewardMode: RewardMode;
};
type ChainStage = "mint" | "pool" | "liquidity" | "lock" | "devBuy";
type ProgressKey = "approval" | ChainStage;
type ProgressState = "waiting" | "active" | "done" | "error";
type PendingAction = { launchId: string; stage: ChainStage; envelope?: TransactionEnvelope; signature?: string };

const empty: Form = { name: "", symbol: "", description: "", xUrl: "", websiteUrl: "", telegramUrl: "", devBuyCurrency: "SOL", launchAmount: "", rewardMode: "holder_rewards" };
const governanceWizardSteps = [
  { label: "Coin", short: "Name and artwork" },
  { label: "Pair & rewards", short: "Choose your pair and rewards" },
  { label: "Reward mode", short: "Choose how the holder share works" },
  { label: "DEX profile", short: "Optional profile draft" },
  { label: "Dev buy", short: "Optional first buy" },
] as const;
const standardWizardSteps = governanceWizardSteps.filter((item) => item.label !== "DEX profile");
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
  const [searchParams] = useSearchParams();
  const importedStudio = useRef("");
  const [studioImportMessage, setStudioImportMessage] = useState("");
  const { config } = useRuntime();
  const dexProfileEnabled = config.marketGovernanceEnabled;
  const wizardSteps = dexProfileEnabled ? governanceWizardSteps : standardWizardSteps;
  const devBuyStep = dexProfileEnabled ? 4 : 3;
  const [form, setForm] = useState<Form>(empty);
  const [dexFundingEnabled, setDexFundingEnabled] = useState(false);
  const [dexProfile, setDexProfile] = useState<DexProfile>({ description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" });
  const [step, setStep] = useState(0);
  const [stocks, setStocks] = useState<StockOption[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [pairResult, setPairResult] = useState<{ query: string; stock?: StockOption; error?: string } | null>(null);
  const [pairLookupEnabled, setPairLookupEnabled] = useState(false);
  const [pairWarning, setPairWarning] = useState("");
  const searchedMint = stockQuery.trim();
  const mintSearch = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(searchedMint);
  const searchedPair = pairResult?.query === searchedMint ? pairResult : null;
  const pairChecking = mintSearch && pairLookupEnabled && !stocks.some(item => item.mint === searchedMint) && !searchedPair;
  useEffect(() => {
    if (!mintSearch || !pairLookupEnabled || stocks.some(item => item.mint === searchedMint)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api.lookupPair(searchedMint, controller.signal).then(({ stock: found }) => {
        if (!controller.signal.aborted) setPairResult({ query: searchedMint, stock: found });
      }).catch(error => {
        if (!controller.signal.aborted) setPairResult({ query: searchedMint, error: error instanceof Error ? error.message : "Could not check this pair." });
      });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [searchedMint, mintSearch, pairLookupEnabled, stocks]);
  const [visibleStocks, setVisibleStocks] = useState(10);
  const [stock, setStock] = useState<StockOption | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionState, setExecutionState] = useState<"running" | "error" | "complete">("running");
  const [progress, setProgress] = useState(initialProgress);
  const [relayMessage, setRelayMessage] = useState("");
  const relayController = useRef<AbortController | null>(null);
  const relayStorageKey = `aqua:launch-relay:${config.network}:${wallet.address ?? "guest"}`;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [recoverableLaunch, setRecoverableLaunch] = useState<Launch | null>(null);
  const [completedLaunch, setCompletedLaunch] = useState<{ id: string; mint?: string; symbol: string; rewardMode: RewardMode } | null>(null);

  const draftKey="launch:"+config.network+":"+(wallet.address??"guest");
  const priorDraftKey=useRef(draftKey);
  const [draftReady,setDraftReady]=useState("");
  const [draftStatus,setDraftStatus]=useState("Loading local draft…");
  useEffect(()=>{
    if(stockLoading||draftReady===draftKey)return;
    let active=true;const carryGuest=priorDraftKey.current==="launch:"+config.network+":guest";priorDraftKey.current=draftKey;setDraftStatus("Loading local draft…");
    if(searchParams.get("studio")){setDraftReady(draftKey);return;}
    readLaunchDraft<{form:Form;file:File|null;dexFundingEnabled:boolean;dexProfile:DexProfile;stockMint:string}>(draftKey).then(async draft=>{
      if(!active)return;
      if(draft||!carryGuest){setForm(empty);setFile(null);setPreview("");setDexFundingEnabled(false);setDexProfile({description:"",bannerUrl:"",websiteUrl:"",xUrl:"",telegramUrl:""});setStock(stocks[0]??null);setStep(0);}
      if(draft?.form){setForm({...empty,...draft.form});setDexFundingEnabled(Boolean(draft.dexFundingEnabled));if(draft.dexProfile)setDexProfile(draft.dexProfile);if(draft.file instanceof File)chooseArtwork(draft.file);const saved=stocks.find(s=>s.mint===draft.stockMint);if(saved)setStock(saved);else if(draft.stockMint){
        setStock(null);
        if(pairLookupEnabled){try{const found=await api.lookupPair(draft.stockMint);if(!active)return;setStock(found.stock);}catch{if(!active)return;setDraftStatus("Draft restored. Your saved pair is unavailable; choose another pair.");return;}}
      }}
      setDraftStatus(draft?"Draft restored on this device.":"Draft will be saved on this device.");
    }).catch(()=>{if(active)setDraftStatus("Local drafts unavailable. Keep this page open until launch.");}).finally(()=>{if(active)setDraftReady(draftKey);});
    return()=>{active=false;};
  },[draftKey,stockLoading]);
  useEffect(()=>{
    if(draftReady!==draftKey||completedLaunch)return;
    let active=true;
    const timer=window.setTimeout(()=>{void saveLaunchDraft(draftKey,{form,file,dexFundingEnabled,dexProfile,stockMint:stock?.mint}).then(()=>{if(active)setDraftStatus("Draft saved on this device.");}).catch(()=>{if(active)setDraftStatus("Draft could not save. Keep this page open until launch.");});},600);
    return()=>{active=false;window.clearTimeout(timer);};
  },[draftKey,draftReady,form,file,dexFundingEnabled,dexProfile,stock?.mint,completedLaunch]);

  useEffect(() => {
    const id=searchParams.get("studio");
    if(!id||!wallet.address||stockLoading||!stocks.length||importedStudio.current===`${wallet.address}:${id}`)return;
    const token=studioSession(wallet.address);
    if(!token){setStudioImportMessage("Open Studio and sign in with this wallet, then choose Review launch again.");return;}
    let cancelled=false;
    void studioRequest<StudioProject>(`/projects/${encodeURIComponent(id)}`,token).then(async project=>{
      if(cancelled)return;
      const draft=project.state.launch;
      setForm(old=>({...old,name:draft.name,symbol:draft.symbol,description:draft.description,xUrl:draft.xUrl,websiteUrl:draft.websiteUrl,telegramUrl:draft.telegramUrl,rewardMode:draft.rewardMode}));
      let selected=stocks.find(item=>item.mint===draft.stockMint);
      if(draft.stockMint && !selected){
        setStock(null);
        if(pairLookupEnabled){try{selected=(await api.lookupPair(draft.stockMint)).stock;}catch{/* Keep the requested pair unselected when verification fails. */}}
        if(cancelled)return;
      }
      if(selected)setStock(selected);
      setDexFundingEnabled(config.marketGovernanceEnabled&&draft.dexFundingEnabled);
      let importedProfile={...draft.dexProfile};
      if(draft.dexProfile.bannerPath){
        const banner=project.state.files.find(item=>item.path===draft.dexProfile.bannerPath);
        if(!banner)throw Error("The assigned DEX banner is missing. Choose another image in Studio before reviewing the launch.");
        const body=new FormData();body.set("file",studioAssetFile(banner));body.set("creatorWallet",wallet.address!);body.set("clientRequestId",crypto.randomUUID());
        const upload=await api.upload(body,await ensureAccountSession(wallet.address!,wallet.signMessage));
        if(cancelled)return;
        importedProfile={...importedProfile,bannerUrl:upload.imageUrl};
      }
      setDexProfile(importedProfile);
      const artwork=project.state.files.find(item=>item.path===draft.imagePath);
      if(artwork)chooseArtwork(studioAssetFile(artwork));
      importedStudio.current=`${wallet.address}:${id}`;
      setStudioImportMessage(`Imported ${project.name}. Review every detail before launching.${draft.stockMint&&!selected?" Your saved pair is unavailable; choose a supported pair.":""}`);
    }).catch(reason=>{if(!cancelled)setStudioImportMessage(reason instanceof Error?reason.message:"Could not import Studio draft.");});
    return()=>{cancelled=true;};
  },[wallet.address,searchParams,stockLoading,stocks,config.marketGovernanceEnabled,pairLookupEnabled]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function loadStocks() {
    setStockLoading(true); setStockError("");
    try {
      const result = await api.stocks();
      setStocks(result.stocks);
      setPairLookupEnabled(Boolean(result.customPairsEnabled));
      setPairWarning(result.customPairWarning ?? "");
      if (!stock && result.stocks[0]) setStock(result.stocks[0]);
      if (!result.stocks.length) setStockError("No supported pairs are available right now.");
    } catch (error) {
      setStockError(error instanceof Error ? error.message : "Could not load pairs.");
    } finally { setStockLoading(false); }
  }

  useEffect(() => { void loadStocks(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!wallet.address) { setRecoverableLaunch(null); return; }
    let active = true;
    api.launches({creator:wallet.address,status:"pending",limit:1,sort:"recent"}).then(({ launches }) => {
      if (!active) return;
      setRecoverableLaunch(launches.find((item) => item.creatorWallet === wallet.address && item.status !== "live") ?? null);
    }).catch(() => { if (active) setRecoverableLaunch(null); });
    return () => { active = false; };
  }, [wallet.address]);

  const pairOptions = useMemo(() => {
    const options = [...stocks];
    for (const item of [searchedPair?.stock, stock]) if (item && !options.some(option => option.mint === item.mint)) options.push(item);
    return options;
  }, [stocks, searchedPair?.stock, stock]);
  const filteredStocks = useMemo(() => {
    const query = stockQuery.trim().toLowerCase();
    const result = query ? pairOptions.filter((item) => `${item.symbol} ${item.underlyingSymbol} ${item.name} ${item.mint}`.toLowerCase().includes(query)) : pairOptions;
    return result.slice(0, visibleStocks);
  }, [pairOptions, stockQuery, visibleStocks]);
  const stockResultsCount = useMemo(() => {
    const query = stockQuery.trim().toLowerCase();
    return query ? pairOptions.filter((item) => `${item.symbol} ${item.underlyingSymbol} ${item.name} ${item.mint}`.toLowerCase().includes(query)).length : pairOptions.length;
  }, [pairOptions, stockQuery]);
  const amountInput = form.launchAmount.trim();
  const amount = Number(amountInput || "0");
  const amountValid = !amountInput || (amountPattern.test(amountInput) && Number.isFinite(amount) && amount >= 0);
  const hasInitialBuy = amountValid && amount > 0;
  const dexDraftValid = [dexProfile.bannerUrl, dexProfile.websiteUrl, dexProfile.xUrl, dexProfile.telegramUrl].every((value) => {
    if (!value.trim()) return true;
    try { return ["https:", "http:"].includes(new URL(value.trim()).protocol); } catch { return false; }
  });
  const validForStep = [
    form.name.trim().length >= 2 && form.symbol.trim().length >= 2 && Boolean(file),
    Boolean(stock) && (!stock?.restricted || acknowledged),
    form.rewardMode === "holder_rewards" || Boolean(config.rewardModes?.enabled && (form.rewardMode === "buyback_burn" || (form.rewardMode === "jackpot" && config.rewardModes.jackpot.enabled))),
    ...(dexProfileEnabled ? [dexDraftValid] : []),
    amountValid,
  ];
  const currencySymbol = form.devBuyCurrency;
  const launchCost = config.launchCost;
  const currencyDecimals = form.devBuyCurrency === "SOL" ? 9 : 6;
  const launching = executionOpen && executionState === "running";
  const activeProgress = chainSteps.find((item) => progress[item.key] === "active")?.label ?? "Preparing launch";

  function chooseArtwork(next: File | null) {
    if (next && next.size > 3_000_000) { toast.error("Artwork must be 3 MB or smaller."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(next ? URL.createObjectURL(next) : "");
  }

  function nextStep() {
    if (!validForStep[step]) {
      toast.error(step === 0 ? "Add a coin name, ticker, and artwork." : step === 1 ? "Choose SOL, ORCA, or a supported xStock." : step === 2 ? "Choose an available reward mode." : dexProfileEnabled && step === 3 ? "Use a valid https:// URL for DEX profile links." : "Enter a valid amount.");
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

  function finishLaunch(launchId: string, mint?: string, identity?: Pick<LaunchRelayStatus, "symbol" | "rewardMode">) {
    try { localStorage.removeItem(relayStorageKey); } catch { /* Storage may be unavailable. */ }
    setRelayMessage("");
    setPending(null); setExecutionState("complete"); setExecutionOpen(false); setRecoverableLaunch(null);
    setCompletedLaunch({ id: launchId, mint, symbol: identity?.symbol || form.symbol, rewardMode: identity?.rewardMode ?? form.rewardMode });
    toast.success("AQUA market launched", { id: launchToastId, description: `$${identity?.symbol || form.symbol || "Your coin"} is live on Orca.` });
  }

  function launchAnother() {
    if (preview) URL.revokeObjectURL(preview);
    setRelayMessage(""); setForm(empty); setFile(null); setPreview(""); setStep(0); setStock(null); setAcknowledged(false); setAcceptedTerms(false);
    setDexProfile({ description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" });
    setProgress(initialProgress()); setPending(null); setCompletedLaunch(null); setExecutionState("running");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function executeDevBuyPlan(confirmation: LaunchConfirmation, signal?: AbortSignal) {
    const transactions = confirmation.devBuyPlan?.transactions ?? [];
    if (!transactions.length) return;
    setStage("devBuy", "active");
    for (const [index, transaction] of transactions.entries()) {
      signal?.throwIfAborted();
      showLaunchStatus(transaction.label, `Approve transaction ${index + 1} of ${transactions.length} for the optional first buy.`);
      await wallet.sendTransaction(transaction);
    }
    if (confirmation.devBuyPlan?.buyAmountRaw) {
      signal?.throwIfAborted();
      showLaunchStatus(`Buy $${form.symbol}`, "Preparing a fresh Orca transaction after the conversion confirmed.");
      const buy = await api.devBuyTransaction(confirmation.launchId, { trader: wallet.address!, amountRaw: confirmation.devBuyPlan.buyAmountRaw, slippageBps: 300 });
      signal?.throwIfAborted();
      await wallet.sendTransaction(buy);
    }
    setStage("devBuy", "done");
  }

  function relayState(state: LaunchRelayStatus) {
    if (state.step) { setPending({ launchId: state.launchId, stage: state.step }); setStage(state.step, "active"); }
    setRelayMessage("AQUA has your approval and is completing the launch. You can close this page.");
  }

  async function observeRelay(id: string, controller: AbortController) {
    const state = await watchLaunchSubmission(api, id, controller.signal, relayState, () => {
      setRelayMessage("Reconnecting to AQUA. An accepted launch continues on the server.");
    });
    if (state.status === "needs_approval") throw new ApiError(state.error ?? "Resume to approve the remaining transactions.", 409, { rebuildRequired: true });
    if (state.status !== "complete") throw new Error("AQUA has not received the signed batch. Resume to approve the remaining launch transactions.");
    return state;
  }

  // Save only the launch ID, never wallet signatures. A refresh reattaches to the job.
  useEffect(() => {
    setExecutionOpen(false); setPending(null); setRelayMessage("");
    if (!wallet.address) return;
    const controller = new AbortController();
    relayController.current?.abort();
    relayController.current = controller;
    let saved: string | null = null;
    try { saved = localStorage.getItem(relayStorageKey); } catch { /* Storage may be unavailable. */ }
    if (saved) {
      const id = saved;
      setPending({ launchId: id, stage: "pool" });
      setExecutionOpen(true); setExecutionState("running");
      void observeRelay(id, controller).then(state => {
        if (!controller.signal.aborted) finishLaunch(id, state.mint, state);
      }).catch(error => {
        if (!controller.signal.aborted) showLaunchError(error, "Could not restore launch status.");
      });
    }
    return () => { relayController.current?.abort(); toast.dismiss(launchToastId); };
  }, [relayStorageKey]);

  async function attachExistingRelay(id: string) {
    relayController.current?.abort();
    const controller = new AbortController();
    relayController.current = controller;
    const state = await api.launchSubmission(id, controller.signal);
    if (state.status === "not_submitted" || state.status === "needs_approval") return false;
    try { localStorage.setItem(relayStorageKey, id); } catch { /* Storage may be unavailable. */ }
    const complete = state.status === "complete" ? state : await observeRelay(id, controller);
    if (!controller.signal.aborted) finishLaunch(id, complete.mint, complete);
    return true;
  }

  async function executeLaunchBatch(id: string, batch: LaunchBatchEnvelope[]) {
    const activeStage: ChainStage = batch[0]?.step ?? "pool";
    relayController.current?.abort();
    const controller = new AbortController();
    relayController.current = controller;
    try {
      if (!batch.length) throw new Error("The backend did not return the Orca launch batch.");
      setPending({ launchId: id, stage: activeStage });
      setStage(activeStage, "active");
      setRelayMessage("Approve the remaining launch transactions in your wallet.");
      showLaunchStatus("Approve the Orca launch", "Review the market and liquidity transactions in your wallet.");
      const signedBatch = await wallet.signTransactionBatch(batch);
      controller.signal.throwIfAborted();
      try { localStorage.setItem(relayStorageKey, id); } catch { /* Storage may be unavailable. */ }
      setRelayMessage("Sending your approval to AQUA. Keep this page open until it is received.");
      const accepted = await handoffLaunchBatch(api, id, signedBatch, controller.signal, () => {
        setRelayMessage("Reconnecting to send your approval. Keep this page open until AQUA confirms receipt.");
      });
      relayState(accepted);
      showLaunchStatus("Completing your launch", "AQUA is handling the transactions. This page no longer needs to stay connected.");
      const complete = accepted.status === "complete" ? accepted : await observeRelay(id, controller);
      controller.signal.throwIfAborted();
      if (hasInitialBuy) {
        try {
          setRelayMessage("Your coin is live. The optional first buy needs a separate wallet approval.");
          const plan = await api.launchDevBuyPlan(id, wallet.address!);
          controller.signal.throwIfAborted();
          if (plan.devBuyError) throw new Error(plan.devBuyError);
          await executeDevBuyPlan(plan, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) return;
          toast.warning("Coin launched without the optional first buy", { description: error instanceof Error ? error.message : "The initial buy was not completed.", duration: 10_000 });
        }
      }
      finishLaunch(id, complete.mint, complete);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStage(activeStage, "error");
      showLaunchError(error, "The launch could not continue.");
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
      if (await attachExistingRelay(pending.launchId)) return;
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
      if (await attachExistingRelay(recoverableLaunch.id)) return;
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
    if (!stock || !file || !validForStep.every(Boolean) || !acceptedTerms) { toast.error("Complete every required launch step and accept the Terms of Service first."); return; }
    if (!config.transactionsEnabled) { toast.error(config.transactionsDisabledReason ?? "On-chain launching is not enabled by the backend."); return; }

    setExecutionOpen(true); setExecutionState("running"); setProgress(initialProgress()); setPending(null);
    setStage("approval", "active");
    showLaunchStatus("Preparing your launch", "Uploading artwork and creating permanent token metadata.");
    try {
      const clientRequestId = crypto.randomUUID(); const symbol = form.symbol.trim().toUpperCase();
      const body = new FormData(); body.set("file", file); body.set("creatorWallet", wallet.address); body.set("clientRequestId", clientRequestId);
      const imageId = (await api.upload(body, await ensureAccountSession(wallet.address!,wallet.signMessage))).imageId;
      const initialBuyRaw = hasInitialBuy ? decimalToRaw(form.launchAmount, currencyDecimals) : "0";
      const intent = await api.createLaunch({
        creatorWallet: wallet.address, clientRequestId, symbol, stockSymbol: stock.symbol,
        ...(importedStudio.current === `${wallet.address}:${searchParams.get("studio")}` ? { studioProjectId: searchParams.get("studio") } : {}),
        name: form.name.trim(), description: form.description.trim(), imageId,
        stockMint: stock.mint, poolPair: stock.mint === "So11111111111111111111111111111111111111112" ? "SOL" : "STOCK",
        devBuyStockRaw: "0", devBuyLamports: "0",
        devBuyCurrency: form.devBuyCurrency, devBuyAmountRaw: initialBuyRaw, rewardMode: form.rewardMode,
        sniperDefense: false, xUrl: normaliseUrl(form.xUrl), websiteUrl: normaliseUrl(form.websiteUrl), telegramUrl: normaliseTelegram(form.telegramUrl),
        ...(dexProfileEnabled ? { dexFundingEnabled, dexProfile: Object.fromEntries(Object.entries(dexProfile).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) } : {}),
      });
      setStage("approval", "done");
      await continueLaunch({ envelope: intent, stage: "mint", launchId: intent.launchId });
    } catch (error) {
      setStage("approval", "error");
      showLaunchError(error, "The launch could not be prepared.");
    }
  }

  return <main className="page launch-wizard-page launch-wizard-only">
    {!launching && !completedLaunch && <div className="at-launch-entry"><span><strong>Start with Atlantis Studio.</strong> Create your artwork, website and launch draft in one place.</span><Link to="/studio">Open Studio ↗</Link></div>}
    {studioImportMessage && <div className="at-import-notice" role="status">{studioImportMessage}</div>}
    <PageBubbles count={22}/>
    {recoverableLaunch && !launching && !completedLaunch && <section className="launch-resume-banner"><span className="resume-coin-bubble"><TokenMark launch={recoverableLaunch}/></span><div><b>Continue ${recoverableLaunch.symbol}</b><small>A previous launch has a confirmed on-chain step waiting to continue.</small></div><button onClick={() => void resumeExistingLaunch()}><span className="resume-button-current" aria-hidden="true"/><span>Resume launch</span><ArrowRight/></button></section>}
    <section className={`wizard-shell ${launching ? "is-launching" : ""}`}>
      <div className="wizard-caustics" aria-hidden="true"/>
      {launching && <div className="wizard-launching-screen" role="status" aria-live="polite" aria-label={`Launching ${form.symbol}`}>
        <div className="launching-water" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <section className="launch-simple-status">
          <span className="launching-orb"><Loader2 className="spin"/></span>
          <h2>Launching</h2>
          <p role="status">{relayMessage || activeProgress}</p>
        </section>
      </div>}
      {completedLaunch ? <section className="launch-complete-screen" aria-live="polite">
        <div className="launch-complete-water" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <span className="launch-complete-orb"><Rocket/></span>
        <small>Orca market live</small>
        <h1>${completedLaunch.symbol} launched</h1>
        <p>Your pool is active, the full supply is committed to locked liquidity, and {completedLaunch.rewardMode === "holder_rewards" ? "holder rewards are accruing" : completedLaunch.rewardMode === "buyback_burn" ? "market buybacks and burns are active" : "hourly jackpot scoring is active"}.</p>
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

      <div className="wizard-main">{launchCost && <p className="status-inline">Estimated launch: {launchCost.estimatedTotalSol.minimum.toFixed(2)}–{launchCost.estimatedTotalSol.maximum.toFixed(2)} SOL, excluding optional first buy. {draftStatus} Approved launch transactions are handed to AQUA for completion.</p>}
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

        {step === 1 && <WizardSection title="Choose the pair and reward" description={pairLookupEnabled ? "Choose SOL, ORCA, AQUA, an eligible Pump.fun coin, or a supported xStock. Holders earn your selected pair asset." : "Launch against SOL, official ORCA, or one supported xStock. Holders earn the same asset you choose."}>
          <div className="stock-search"><Search size={17}/><input value={stockQuery} aria-label="Search pairs or paste a Pump.fun mint address" placeholder={pairLookupEnabled ? "Search pairs or paste a Pump.fun CA" : "Search SOL, ORCA, or stocks"} onChange={(event) => { setStockQuery(event.target.value); setPairResult(null); setVisibleStocks(10); }}/><span>{pairOptions.length} assets</span></div>
          {stockLoading ? <div className="stock-loading"><Loader2 className="spin"/><span>Loading pairs</span></div> : stockError ? <div className="stock-error"><Info/><span>{stockError}</span><button onClick={() => void loadStocks()}><RefreshCw size={14}/> Retry</button></div> : <>
            <div className="stock-picker">{filteredStocks.map((item) => <button key={item.mint} className={stock?.mint === item.mint ? "selected" : ""} onClick={() => { setStock(item); setAcknowledged(false); }}>
              <StockLogo stock={item}/><div><b>{item.symbol}</b><small>{item.name}</small></div><span className="stock-market-depth">{item.mint === "So11111111111111111111111111111111111111112" ? <><b>Native pair</b><small>SOL rewards</small></> : item.mint === "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" ? <><b>Official ORCA</b><small>ORCA rewards</small></> : item.assetKind ? <><b>{item.assetKind === "aqua" ? "AQUA pair" : "Pump.fun"}</b><small>${compactNumber.format(item.liquidityUsd ?? 0)} liquidity</small></> : <><b>${compactNumber.format(item.orcaTvlUsd)} TVL</b><small>${compactNumber.format(item.orcaVolume24hUsd)} 24h</small></>}</span><i>{stock?.mint === item.mint && <Check size={14}/>}</i>
            </button>)}</div>
            {pairChecking && <div className="pair-lookup-status" role="status"><Loader2 size={16} className="spin"/>Checking this coin and its swap routes…</div>}
            {searchedPair?.error && <div className="pair-lookup-error" role="alert">{searchedPair.error}</div>}
            {filteredStocks.length === 0 && !pairChecking && !searchedPair?.error && <div className="no-stock-results">{mintSearch && !pairLookupEnabled ? "Custom pairs are not enabled yet." : `No pairs match “${stockQuery}”.`}</div>}
            {filteredStocks.length < stockResultsCount && <button className="stock-more" onClick={() => setVisibleStocks((value) => value + 20)}>Show more</button>}
          </>}
          {stock && <div className="selected-stock-strip"><StockLogo stock={stock}/><div><small>Permanent pair and reward</small><b>${form.symbol || "COIN"} / {stock.symbol}</b></div><span>Holder rewards in {stock.symbol}</span></div>}
          {stock?.assetKind && <div className="selected-pair-address"><span>{stock.assetKind === "aqua" ? "AQUA" : "Pump.fun"} mint</span><a href={`https://solscan.io/token/${stock.mint}`} target="_blank" rel="noreferrer">{stock.mint}</a>{Boolean(stock.transferFeeBps) && <small>{(stock.transferFeeBps! / 100).toFixed(0)}% token transfer fee applies to swaps and rewards.</small>}</div>}
          {pairWarning && <p className="pair-lookup-error">AQUA pair: {pairWarning}</p>}
          {stock?.restricted && <label className="stock-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I understand tokenized stocks may be restricted or unavailable in my jurisdiction.</span></label>}
        </WizardSection>}

        {step === 2 && <WizardSection title="Choose the reward mode" description="This policy is permanent after launch, so holders always know how the reward share will be used.">
          <div className="reward-mode-grid" role="radiogroup" aria-label="Reward mode">
            <ModeButton active={form.rewardMode === "holder_rewards"} onClick={() => update("rewardMode", "holder_rewards")} icon={<RewardModeIcon mode="holder_rewards"/>} title="Holder Rewards" eyebrow="Steady rewards">
              The holder share is converted into the selected pair asset and distributed by balance × time held. Rewards accumulate into one claim per market.
            </ModeButton>
            <ModeButton active={form.rewardMode === "buyback_burn"} disabled={!config.rewardModes?.enabled} onClick={() => update("rewardMode", "buyback_burn")} icon={<RewardModeIcon mode="buyback_burn"/>} title="Buyback & Burn" eyebrow="Reduce supply">
              The holder share becomes SOL, buys this coin through the live market, then permanently burns every token purchased.
            </ModeButton>
            <ModeButton active={form.rewardMode === "jackpot"} disabled={!config.rewardModes?.enabled || !config.rewardModes.jackpot.enabled} onClick={() => update("rewardMode", "jackpot")} icon={<RewardModeIcon mode="jackpot"/>} title="Hourly Jackpot" eyebrow="5 winners · every hour">
              Five distinct holders split each pot 50% / 20% / 20% / 5% / 5%. Holding and buying earlier increases your score; selling cuts accrued score.
            </ModeButton>
          </div>
          {!config.rewardModes?.enabled && <div className="reward-mode-notice"><Info/> Alternative modes will unlock after the staged program upgrade is enabled. Holder Rewards remains available.</div>}
        </WizardSection>}

        {dexProfileEnabled && step === 3 && <WizardSection title="DEX Funding Mode" description="Optional. Fund your DEX Screener profile together using market fees.">
          <label className="launch-dex-toggle"><input type="checkbox" checked={dexFundingEnabled} onChange={event => setDexFundingEnabled(event.target.checked)}/><span><b>Enable DEX Funding Mode</b><small>Open a holder vote five minutes after launch. If approved, 80% of incoming market rewards funds the $300 profile target; 20% continues to holder rewards.</small></span></label><div className="launch-dex-intro"><DexScreenerIcon/><div><b>Let holders decide</b><p>Save an optional initial profile below. Eligible holders can propose replacement information and vote on it. If disabled here, holders can propose funding later.</p></div></div>
          <div className="launch-dex-fields"><DexProfileFields profile={dexProfile} update={(key, value) => setDexProfile((current) => ({ ...current, [key]: value }))} optional/></div>
          {!dexDraftValid && <p className="survey-error">Use full https:// URLs, or leave these fields empty.</p>}
          <button className="proposal-text-action" onClick={() => { setDexFundingEnabled(false); setDexProfile({ description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" }); setStep(devBuyStep); }}>Skip for now <ArrowRight/></button>
        </WizardSection>}

        {step === devBuyStep && <WizardSection title="Optional dev buy" description="Choose SOL or USDC to make the first buy. Leave the amount at zero to skip it.">
          <div className="launch-currency-grid pair-choice-grid" role="radiogroup" aria-label="Initial buy currency">
            <CurrencyButton code="SOL" name="Pay with Solana" active={form.devBuyCurrency === "SOL"} onClick={() => { update("devBuyCurrency", "SOL"); update("launchAmount", ""); }} icon={<NetworkSolana className="currency-brand-icon" variant="branded"/>}/>
            <CurrencyButton code="USDC" name="Pay with USD Coin" active={form.devBuyCurrency === "USDC"} onClick={() => { update("devBuyCurrency", "USDC"); update("launchAmount", ""); }} icon={<span className="usdc-mark">$</span>}/>
          </div>
          <Field label={`Optional first buy in ${currencySymbol}`} wide><div className="unit-input launch-amount-input"><input inputMode="decimal" value={form.launchAmount} placeholder="0" onChange={(event) => update("launchAmount", event.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}/><span>{currencySymbol}</span></div></Field>
          {launchCost && <div className="launch-cost-card">
            <div><span><b>Estimated launch cost</b><small>before any optional first buy</small></span><strong>{launchCost.estimatedTotalSol.minimum.toFixed(2)}–{launchCost.estimatedTotalSol.maximum.toFixed(2)} SOL</strong></div>
            <p><b>{launchCost.platformFeeSol.toFixed(2)} SOL AQUA fee</b> funds keeper operations. The rest is estimated Solana/Orca account rent and network fees; your wallet approval shows the authoritative amount.</p>
          </div>}
          <div className="launch-final-summary"><div className="review-token-art">{preview ? <img src={preview} alt=""/> : <Droplets/>}</div><div><b>{form.name || "Unnamed coin"}</b><span>${form.symbol || "TICKER"} / {stock?.symbol ?? "PAIR"} · {form.rewardMode === "holder_rewards" ? "Holder Rewards" : form.rewardMode === "buyback_burn" ? "Buyback & Burn" : "Hourly Jackpot"}</span></div><strong>{hasInitialBuy ? `${form.launchAmount} ${currencySymbol}` : "No initial buy"}</strong></div>
          <label className="terms-acceptance"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)}/><span>I have read and agree to the <Link to="/terms" target="_blank">Terms of Service</Link>, including the cryptoasset, permanent-liquidity and third-party risks.</span></label>
          <button className="wizard-launch-button" onClick={() => void (pending ? retryLaunch() : beginLaunch())} disabled={!validForStep.every(Boolean) || launching || !acceptedTerms} aria-busy={launching}><span className="button-current"/><span className="launch-button-bubbles" aria-hidden="true"><i/><i/><i/><i/></span>{launching && <Loader2 className="spin"/>}<span>{launching ? "Launching" : wallet.address ? "Launch" : "Connect wallet to launch"}</span></button>
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
function ModeButton({ active, disabled, onClick, icon, title, eyebrow, children }: { active: boolean; disabled?: boolean; onClick: () => void; icon: ReactNode; title: string; eyebrow: string; children: ReactNode }) { return <button type="button" role="radio" aria-checked={active} disabled={disabled} className={`reward-mode-option ${active ? "selected" : ""}`} onClick={onClick}><i>{icon}</i><div><small>{eyebrow}</small><b>{title}</b><p>{children}</p></div><em>{disabled ? "Coming soon" : active ? <Check/> : null}</em></button>; }
function StockLogo({ stock }: { stock: StockOption }) { const [failed, setFailed] = useState(false); return <span className="stock-logo">{stock.mint === "So11111111111111111111111111111111111111112" ? <NetworkSolana className="currency-brand-icon" variant="branded"/> : stock.logoUrl && !failed ? <img src={stock.logoUrl} alt="" onError={() => setFailed(true)}/> : stock.underlyingSymbol.slice(0, 2)}</span>; }

