import { RedirectSettingsPanel } from "../components/RedirectSettingsPanel";
import { dismissLaunchResume, isLaunchResumeDismissed } from "../launch-resume-dismissal";
import { recipientLabel, type RedirectRecipient } from "../fee-redirect-api";
import { RefreshButton } from "../components/RefreshButton";
import { ChevronDown } from "lucide-react";
import { Select } from "../components/Select";
import { assetLogoUrl } from "../asset-logo";
import { TransactionOutcomeError } from "../transaction-confirmation";
import { pairCatalogPollDelay } from "../pair-catalog-refresh";
import { runSequentialLaunch, watchLaunchSubmission } from "../launch-relay";
import { readLaunchDraft,saveLaunchDraft,removeLaunchDraft } from "../launch-draft";
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
import { LaunchDetailsLoading } from "../components/LaunchDetailsLoading";
import { LaunchRecoveryPanel } from "../components/LaunchRecoveryPanel";
import type { LaunchBudget } from "../types";
import { PageBubbles } from "../components/PageBubbles";
import { RewardModeIcon } from "../components/RewardModeIcon";
import { DexProfileFields } from "../components/MarketProposals";
import { CoinFeeBreakdown } from "../components/CoinFeeBreakdown";
import "../coin-settings.css";
import "./launch-resume.css";
import { PercentControl } from "../components/PercentControl";
import type { DexProfile } from "../types";
import type { Launch, LaunchBatchEnvelope, LaunchConfirmation, LaunchRelayStatus, StockOption, TransactionEnvelope } from "../types";

type RewardMode = "holder_rewards" | "buyback_burn" | "jackpot" | "fee_redirect";
type Form = {
  redirectRecipient?: RedirectRecipient | null;
  name: string; symbol: string; description: string; xUrl: string; websiteUrl: string;
  rewardFeeBps: number; rippleRewardBps: number;
  telegramUrl: string; devBuyCurrency: "SOL"; launchAmount: string; rewardMode: RewardMode;
};
type LaunchDraft = {
  id?: string; launchId?: string; legacy?: boolean;
  form: Omit<Form, "devBuyCurrency"> & {devBuyCurrency?: "SOL" | "USDC"};
  file: File | null; dexFundingEnabled: boolean;
  marketingMode?: "off" | "proposal" | "automatic"; dexFundingMode?: "proposal" | "automatic";
  dexProfile: DexProfile; stockMint?: string;
};
type ChainStage = "mint" | "pool" | "prepare" | "funding" | "liquidity" | "lock" | "devBuy";
type ProgressKey = "approval" | ChainStage;
type ProgressState = "waiting" | "active" | "done" | "error";
type PendingAction = { launchId: string; stage: ChainStage; envelope?: TransactionEnvelope; signature?: string };

const empty: Form = { rewardFeeBps: 100, rippleRewardBps: 1500, name: "", symbol: "", description: "", xUrl: "", websiteUrl: "", telegramUrl: "", devBuyCurrency: "SOL", launchAmount: "", rewardMode: "holder_rewards" };
const governanceWizardSteps = [
  { label: "Coin", short: "Name and artwork" },
  { label: "Pair & rewards", short: "Choose your pair and rewards" },
  { label: "Reward mode", short: "Choose how the holder share works" },
  { label: "Settings", short: "Fees and community funding" },
  { label: "DEX profile", short: "Optional profile draft" },
  { label: "Review & launch", short: "Review and optional first buy" },
] as const;
const standardWizardSteps = governanceWizardSteps.filter((item) => item.label !== "DEX profile");
const chainSteps: Array<{ key: ProgressKey; label: string; detail: string }> = [
  { key: "approval", label: "Prepare launch", detail: "Store artwork and immutable metadata" },
  { key: "mint", label: "Create token", detail: "Approve token creation" },
  { key: "pool", label: "Approve Orca market", detail: "Approve after token creation confirms" },
  { key: "prepare", label: "Prepare accounts", detail: "The pool is not tradable yet" },
  { key: "funding", label: "Prepare buy funds", detail: "Convert SOL into the selected pair" },
  { key: "liquidity", label: "Open the market", detail: "Activate liquidity and execute the dev buy together" },
  { key: "lock", label: "Lock liquidity", detail: "Permanently lock the verified position" },
  { key: "devBuy", label: "Initial buy", detail: "Included in liquidity activation" },
];
const initialProgress = (): Record<ProgressKey, ProgressState> => ({ approval: "waiting", mint: "waiting", pool: "waiting", prepare: "waiting", funding: "waiting", liquidity: "waiting", lock: "waiting", devBuy: "waiting" });
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
  const studioId = searchParams.get("studio");
  const studioImportKey = `${wallet.address}:${studioId}`;
  const [studioImport, setStudioImport] = useState<{key: string; status: "loading" | "ready" | "error"; error?: string}>({key:"",status:"loading"});
  const [studioImportAttempt, setStudioImportAttempt] = useState(0);
  const studioImportReady = !studioId || (studioImport.key === studioImportKey && studioImport.status === "ready");
  const [studioImportMessage, setStudioImportMessage] = useState("");
  const { config, loading: runtimeLoading } = useRuntime();
  const dexProfileEnabled = config.marketGovernanceEnabled;
  const wizardSteps = dexProfileEnabled ? governanceWizardSteps : standardWizardSteps;
  const settingsStep = 3;
  const dexProfileStep = 4;
  const devBuyStep = dexProfileEnabled ? 5 : 4;
  const [form, setForm] = useState<Form>(empty);
  const [dexFundingEnabled, setDexFundingEnabled] = useState(false);
  const [marketingMode, setMarketingMode] = useState<"off"|"proposal"|"automatic">("automatic");
  const [dexFundingMode, setDexFundingMode] = useState<"proposal"|"automatic">("automatic");
  const [dexProfile, setDexProfile] = useState<DexProfile>({ description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" });
  const [step, setStep] = useState(0);
  const [stocks, setStocks] = useState<StockOption[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [pairsRefreshing, setPairsRefreshing] = useState(true);
  const [pairLoadVersion, setPairLoadVersion] = useState(0);
  const [pairLookupVersion, setPairLookupVersion] = useState(0);
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
  }, [searchedMint, mintSearch, pairLookupEnabled, stocks, pairLookupVersion]);
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
  const resumeDismissalKey = `aqua:launch-resume-cleared:${config.network}:${wallet.address ?? "guest"}`;
  const resumeDismissals = useRef<Record<string, number>>({});
  const [redirectSettingsOpen,setRedirectSettingsOpen]=useState(false);
  const [,refreshResumeDismissals]=useState(0);
  const resumeScope=`${config.network}:${wallet.address ?? "guest"}`;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [savedLaunchId, setSavedLaunchId] = useState<string | null>(null);
  const [recoverableLaunch, setRecoverableLaunch] = useState<Launch | null>(null);
  const resumeLaunchId=[pending?.launchId,recoverableLaunch?.id,savedLaunchId].find(id=>id&&!isLaunchResumeDismissed(resumeScope,id));
  function hideResume(){if(resumeLaunchId){dismissLaunchResume(resumeScope,resumeLaunchId);refreshResumeDismissals(n=>n+1);}}
  const [budget, setBudget] = useState<LaunchBudget | null>(null);
  const [budgetError, setBudgetError] = useState("");
  const [budgetVersion, setBudgetVersion] = useState(0);
  const [completedLaunch, setCompletedLaunch] = useState<{ id: string; mint?: string; symbol: string; rewardMode: RewardMode } | null>(null);

  const draftKey = "launch:" + config.network + ":" + (wallet.address ?? "guest");
  const priorDraftKey = useRef(draftKey);
  const draftIdentity = useRef({ id: crypto.randomUUID() as string, launchId: undefined as string | undefined, legacy: false });
  const draftWritable = useRef(false);
  const migratedGuest = useRef<{key: string; id: string} | null>(null);
  const [draftReady, setDraftReady] = useState("");
  const [draftError, setDraftError] = useState("");
  const [restoredPair, setRestoredPair] = useState<string | null>("default");
  const draftLoading = runtimeLoading || Boolean(wallet.connecting) || draftReady !== draftKey;
  useEffect(() => {
    if (runtimeLoading || wallet.connecting || draftReady === draftKey) return;
    let active = true;
    const previousKey = priorDraftKey.current;
    const carryGuest = previousKey === "launch:" + config.network + ":guest";
    draftWritable.current = false;
    setDraftError("");
    if (studioId) { draftWritable.current = true; setDraftReady(draftKey); return; }
    void readLaunchDraft<LaunchDraft>(draftKey).then(async saved => {
      let draft = saved;
      // Older drafts had no launch ID. Retire those only when their creator and coin match a live launch.
      if (draft?.form && wallet.address && (draft.launchId || draft.legacy || !draft.id)) {
        try {
          const candidates = draft.launchId ? [(await api.launch(draft.launchId)).launch]
            : (await api.launches({creator: wallet.address, status: "live", limit: 100})).launches;
          const launched = candidates.some(coin => coin?.status === "live" && coin.creatorWallet === wallet.address &&
            (draft!.launchId ? coin.id === draft!.launchId : coin.name === draft!.form.name.trim() && coin.symbol === draft!.form.symbol.trim().toUpperCase()));
          if (!active) return;
          if (launched) { await removeLaunchDraft(draftKey, draft.id); draft = null; }
        } catch { if (active) setDraftError("Could not check launch status. Your draft has been kept."); }
      }
      if (!active) return;
      priorDraftKey.current = draftKey;
      if (draft || !carryGuest || saved) {
        setForm(empty); setFile(null); setPreview(""); setDexFundingEnabled(false);
        setMarketingMode("automatic"); setDexFundingMode("automatic");
        setDexProfile({description:"",bannerUrl:"",websiteUrl:"",xUrl:"",telegramUrl:""});
        setStock(null); setStep(0); setAcknowledged(false); setAcceptedTerms(false);
        draftIdentity.current = { id: draft?.id ?? crypto.randomUUID(), launchId: draft?.launchId, legacy: Boolean(draft && (draft.legacy || !draft.id)) };
        setRestoredPair(draft?.stockMint ?? "default");
      } else if (previousKey !== draftKey) {
        migratedGuest.current = { key: previousKey, id: draftIdentity.current.id };
      }
      if (draft?.form) {
        setForm({...empty,...draft.form,devBuyCurrency:"SOL",launchAmount:draft.form.devBuyCurrency==="USDC"?"":draft.form.launchAmount??""});
        setDexFundingEnabled(Boolean(draft.dexFundingEnabled));
        setMarketingMode(draft.marketingMode??"automatic"); setDexFundingMode(draft.dexFundingMode??"automatic");
        if (draft.dexProfile) setDexProfile(draft.dexProfile);
        if (draft.file instanceof File) chooseArtwork(draft.file);
      }
      draftWritable.current = true;
    }).catch(() => { if (active) setDraftError("Local drafts unavailable. Keep this page open until launch."); })
      .finally(() => { if (active) setDraftReady(draftKey); });
    return () => { active = false; };
  }, [draftKey, runtimeLoading, wallet.connecting, studioId]);

  // Restore the form immediately; pair discovery continues independently in the background.
  useEffect(() => {
    if (draftLoading || studioId || !restoredPair) return;
    if (restoredPair === "default") { if (stocks.length) { setStock(stocks[0]); setRestoredPair(null); } return; }
    const saved = stocks.find(item => item.mint === restoredPair);
    if (saved) { setStock(saved); setRestoredPair(null); return; }
    if (stockLoading || pairsRefreshing) return;
    if (!pairLookupEnabled) { setRestoredPair(null); setDraftError("Choose another pair; your saved pair is unavailable."); return; }
    const controller = new AbortController();
    void api.lookupPair(restoredPair, controller.signal).then(({stock: found}) => {
      if (!controller.signal.aborted) { setStock(found); setRestoredPair(null); }
    }).catch(() => {
      if (!controller.signal.aborted) { setRestoredPair(null); setDraftError("Choose another pair; your saved pair is unavailable."); }
    });
    return () => controller.abort();
  }, [draftLoading, studioId, restoredPair, stocks, stockLoading, pairsRefreshing, pairLookupEnabled]);

  function draftSnapshot(): LaunchDraft {
    return {...draftIdentity.current, form, file, dexFundingEnabled, marketingMode, dexFundingMode, dexProfile, stockMint: restoredPair === "default" ? undefined : restoredPair ?? stock?.mint};
  }
  useEffect(() => {
    if (draftLoading || !draftWritable.current || completedLaunch || executionOpen || !studioImportReady) return;
    let active = true;
    const value = draftSnapshot();
    const timer = window.setTimeout(() => {
      void saveLaunchDraft(draftKey, value).then(async () => {
        const guest = migratedGuest.current;
        if (guest) { migratedGuest.current = null; await removeLaunchDraft(guest.key, guest.id); }
      }).catch(() => { if (active) setDraftError("Draft could not save. Keep this page open until launch."); });
    }, 600);
    return () => { active = false; window.clearTimeout(timer); };
  }, [draftKey, draftLoading, form, file, dexFundingEnabled, marketingMode, dexFundingMode, dexProfile, stock?.mint, restoredPair, completedLaunch, executionOpen, studioImportReady]);

  useEffect(() => {
    const id = studioId, address = wallet.address;
    if (!id || !address || stockLoading || pairsRefreshing) return;
    const key = `${address}:${id}`;
    if (importedStudio.current === key) return;
    if (!stocks.length) return;
    const token = studioSession(address);
    if (!token) {
      setStudioImport({key,status:"error",error:"Open Studio and sign in with this wallet, then choose Review launch again."});
      return;
    }
    let cancelled = false;
    setStudioImport({key,status:"loading"});
    setStudioImportMessage("");
    void studioRequest<StudioProject>(`/projects/${encodeURIComponent(id)}`,token).then(async project => {
      if (cancelled) return;
      const draft = project.state.launch;
      let selected = stocks.find(item => item.mint === draft.stockMint);
      if (draft.stockMint && !selected && pairLookupEnabled) {
        try { selected = (await api.lookupPair(draft.stockMint)).stock; }
        catch { /* An unavailable saved pair must be explicitly replaced in the wizard. */ }
        if (cancelled) return;
      }
      let importedProfile = {...draft.dexProfile};
      if (draft.dexProfile.bannerPath) {
        const banner = project.state.files.find(item => item.path === draft.dexProfile.bannerPath);
        if (!banner) throw Error("The assigned DEX banner is missing. Choose another image in Studio before reviewing the launch.");
        const body = new FormData(); body.set("file",studioAssetFile(banner)); body.set("creatorWallet",address); body.set("clientRequestId",crypto.randomUUID());
        const upload = await api.upload(body,await ensureAccountSession(address,wallet.signMessage));
        if (cancelled) return;
        importedProfile = {...importedProfile,bannerUrl:upload.imageUrl};
      }
      const artwork = project.state.files.find(item => item.path === draft.imagePath);
      if (draft.imagePath && !artwork) throw Error("The assigned coin artwork is missing. Choose another image in Studio before reviewing the launch.");
      const artworkFile = artwork ? studioAssetFile(artwork) : null;
      if (cancelled) return;
      // Apply only a complete import. Launch must retain its Studio project link.
      setForm({...empty,name:draft.name,symbol:draft.symbol,description:draft.description,xUrl:draft.xUrl,websiteUrl:draft.websiteUrl||project.hostedWebsiteUrl||"",telegramUrl:draft.telegramUrl,rewardMode:draft.rewardMode});
      setStock(selected ?? (draft.stockMint ? null : stocks[0]));
      setRestoredPair(null);
      setDexFundingEnabled(config.marketGovernanceEnabled && draft.dexFundingEnabled);
      setDexProfile(importedProfile);
      if (artworkFile) chooseArtwork(artworkFile);
      else { setFile(null); setPreview(""); }
      setStep(0);
      importedStudio.current = key;
      setStudioImport({key,status:"ready"});
      setStudioImportMessage(`Imported ${project.name}. Review every detail before launching.${draft.stockMint&&!selected?" Your saved pair is unavailable; choose a supported pair.":""}`);
    }).catch(reason => {
      if (!cancelled) setStudioImport({key,status:"error",error:reason instanceof Error ? reason.message : "Could not load your coin details."});
    });
    return () => { cancelled = true; };
  },[wallet.address,studioId,stockLoading,pairsRefreshing,stocks,config.marketGovernanceEnabled,pairLookupEnabled,studioImportAttempt]);

  function editDraft() {
    if (draftIdentity.current.launchId) draftIdentity.current = {id: crypto.randomUUID(), launchId: undefined, legacy: false};
  }
  const update = <K extends keyof Form>(key: K, value: Form[K]) => { editDraft(); setForm((current) => ({ ...current, [key]: value })); };

  // Keep the available pairs visible while independent catalogue sources load.
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    const started = Date.now();
    setStockError("");
    async function refresh() {
      try {
        const result = await api.pairCatalog(controller.signal);
        if (controller.signal.aborted) return;
        setStocks(current => current.length === result.stocks.length && current.every((item, index) =>
          item.mint === result.stocks[index].mint && item.verifiedAt === result.stocks[index].verifiedAt)
          ? current : result.stocks);
        setPairLookupEnabled(Boolean(result.customPairsEnabled));
        setPairWarning(result.customPairWarning ?? "");
        const pollDelay = pairCatalogPollDelay(result, Date.now() - started);
        setPairsRefreshing(Boolean(result.refreshing) && pollDelay !== null);
        setStockError(result.warning ?? (result.refreshing && pollDelay === null ? "Some pairs are taking longer to load." : ""));
        if (pollDelay !== null) timer = window.setTimeout(() => void refresh(), pollDelay);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStockError(error instanceof Error ? error.message : "Could not load pairs.");
        setPairsRefreshing(false);
        if (Date.now() - started < 120_000) timer = window.setTimeout(() => void refresh(), 5000);
      } finally {
        if (!controller.signal.aborted) setStockLoading(false);
      }
    }
    void refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [pairLoadVersion]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function resumeClearedBefore() {
    let stored = 0;
    try { stored = Number(localStorage.getItem(resumeDismissalKey) ?? 0); } catch { /* Keep the in-memory dismissal when storage is unavailable. */ }
    return Math.max(resumeDismissals.current[resumeDismissalKey] ?? 0, Number.isFinite(stored) ? stored : 0);
  }
  useEffect(() => {
    if (!wallet.address) { setRecoverableLaunch(null); return; }
    let active = true;
    api.launches({creator:wallet.address,status:"pending",limit:1,sort:"recent"}).then(({ launches }) => {
      if (!active) return;
      // Read at response time too: a slow request must not restore an older
      // resume after another launch has just completed.
      const clearedBefore = resumeClearedBefore();
      setRecoverableLaunch(launches.find((item) => item.creatorWallet === wallet.address && item.status !== "live"
        && (!clearedBefore || item.createdAt > clearedBefore)) ?? null);
    }).catch(() => { if (active) setRecoverableLaunch(null); });
    return () => { active = false; };
  }, [wallet.address, resumeDismissalKey]);

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
    form.rewardMode === "fee_redirect" ? Boolean(config.rewardModes?.feeRedirect?.enabled && form.redirectRecipient) : form.rewardMode === "holder_rewards" || Boolean(config.rewardModes?.enabled && (form.rewardMode === "buyback_burn" || (form.rewardMode === "jackpot" && config.rewardModes.jackpot.enabled))),
    Number.isInteger(form.rippleRewardBps) && form.rippleRewardBps >= 300 && form.rippleRewardBps <= 3000 && Number.isInteger(form.rewardFeeBps) && form.rewardFeeBps >= 100 && form.rewardFeeBps <= 400 && (form.rewardFeeBps === 100 || Boolean(config.launchSettings?.variableRewardFeesEnabled)),
    ...(dexProfileEnabled ? [dexDraftValid] : []),
    amountValid,
  ];
  const currencySymbol = "SOL";
  const launchCost = config.launchCost;
  const currencyDecimals = 9;
  const launching = executionOpen && executionState === "running";
  const activeProgress = chainSteps.find((item) => progress[item.key] === "active")?.label ?? "Preparing launch";
  useEffect(() => {
    setBudget(null); setBudgetError("");
    if (!wallet.address || step !== devBuyStep || !amountValid || launching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      let raw: string;
      try { raw = amount > 0 ? decimalToRaw(form.launchAmount, 9) : "0"; }
      catch { setBudgetError("Use no more than 9 decimal places for SOL."); return; }
      api.launchBudget(wallet.address!, raw, controller.signal).then(setBudget).catch(error => {
        if (!controller.signal.aborted) setBudgetError(error instanceof Error ? error.message : "Could not check your SOL balance.");
      });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [wallet.address, step, devBuyStep, amountValid, form.launchAmount, launching, budgetVersion]);

  function chooseArtwork(next: File | null) {
    if (next && next.size > 3_000_000) { toast.error("Artwork must be 3 MB or smaller."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(next ? URL.createObjectURL(next) : "");
  }

  function nextStep() {
    if (!validForStep[step]) {
      toast.error(step === 0 ? "Add a coin name, ticker, and artwork." : step === 1 ? "Choose SOL, ORCA, or a supported xStock." : step === 2 ? "Choose an available reward mode." : step === settingsStep ? "Choose a supported reward fee and a Ripple share between 3% and 30%." : dexProfileEnabled && step === dexProfileStep ? "Use a valid https:// URL for DEX profile links." : "Enter a valid amount.");
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
    const clearedBefore = Date.now();
    resumeDismissals.current[resumeDismissalKey] = clearedBefore;
    try { localStorage.setItem(resumeDismissalKey, String(clearedBefore)); } catch { /* Keep the in-memory dismissal. */ }
    if (draftIdentity.current.launchId === launchId) {
      draftWritable.current = false;
      void removeLaunchDraft(draftKey, draftIdentity.current.id).catch(() => setDraftError("Could not clear the completed draft."));
    }
    try { localStorage.removeItem(relayStorageKey); } catch { /* Storage may be unavailable. */ }
    setRelayMessage(""); setSavedLaunchId(null);
    setPending(null); setExecutionState("complete"); setExecutionOpen(false); setRecoverableLaunch(null);
    setCompletedLaunch({ id: launchId, mint, symbol: identity?.symbol || form.symbol, rewardMode: identity?.rewardMode ?? form.rewardMode });
    toast.success("AQUA market launched", { id: launchToastId, description: `$${identity?.symbol || form.symbol || "Your coin"} is live on Orca.` });
  }

  function launchAnother() {
    setSavedLaunchId(null); setRecoverableLaunch(null); setExecutionOpen(false);
    try { localStorage.removeItem(relayStorageKey); } catch { /* Storage may be unavailable. */ }
    if (preview) URL.revokeObjectURL(preview);
    draftIdentity.current = { id: crypto.randomUUID(), launchId: undefined, legacy: false };
    draftWritable.current = true; setDraftError(""); setRestoredPair("default");
    setDexFundingEnabled(false); setMarketingMode("automatic"); setDexFundingMode("automatic");
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
    if (state.step) {
      setPending({ launchId: state.launchId, stage: state.step });
      const order: ChainStage[] = ["mint", "pool", "prepare", "funding", "liquidity", "lock"];
      setProgress(current => {
        const updated = { ...current };
        for (const step of order.slice(0, order.indexOf(state.step!))) updated[step] = "done";
        updated[state.step!] = "active";
        return updated;
      });
    }
    setRelayMessage(state.approvalReady ? "Ready for your next wallet approval." : "Completing your approved launch transactions. Progress is saved if you leave this page.");
  }

  async function observeRelay(id: string, controller: AbortController) {
    const state = await watchLaunchSubmission(api, id, controller.signal, relayState, () => {
      setRelayMessage("Reconnecting to AQUA. An accepted launch continues on the server.");
    });
    if (state.status === "needs_approval" && !state.approvalReady) throw new ApiError(state.error ?? "Resume to approve the remaining transactions.", 409, { rebuildRequired: true });
    if (state.status !== "complete" && !state.approvalReady) throw new Error("AQUA has not received the signed batch. Resume to approve the remaining launch transactions.");
    return state;
  }

  // Remember the launch without reattaching or recovering until Resume is pressed.
  useEffect(() => {
    relayController.current?.abort();
    setExecutionOpen(false); setPending(null); setRelayMessage("");
    let saved: string | null = null;
    try { if (wallet.address) saved = localStorage.getItem(relayStorageKey); } catch { /* Storage may be unavailable. */ }
    setSavedLaunchId(saved);
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
    if (complete.approvalReady) return false;
    if (!controller.signal.aborted) finishLaunch(id, complete.mint, complete);
    return true;
  }

  async function executeLaunchBatch(id: string, batch: LaunchBatchEnvelope[]) {
    let activeStage: ChainStage = batch[0]?.step ?? "pool";
    relayController.current?.abort();
    const controller = new AbortController();
    relayController.current = controller;
    try {
      if (!batch.length) throw new Error("The backend did not return the Orca launch batch.");
      setPending({ launchId: id, stage: activeStage });
      setStage(activeStage, "active");
      try { localStorage.setItem(relayStorageKey, id); } catch { /* Storage may be unavailable. */ }
      const complete = await runSequentialLaunch({ api,id,creator:wallet.address!,batch,signal:controller.signal,
        sign:wallet.signTransactionBatch,batchSigning:wallet.canBatchSign,
        onApproval:(step,transactionCount)=>{
          if (activeStage !== step) setStage(activeStage, "done");
          activeStage=step;setPending({launchId:id,stage:step});setStage(step,"active");
          setRelayMessage(transactionCount>1 ? "Approve your launch transactions together in your wallet." : "Review the next step in your wallet.");
          showLaunchStatus(transactionCount>1 ? "Approve and finish launch" : step==="liquidity" ? "Approve liquidity and launch" : step==="lock" ? "Approve permanent lock" : "Approve launch setup",
            transactionCount>1 ? "One batch approval covers the remaining setup and launch. AQUA confirms the transactions in order." : "Review the request in your wallet to continue.");
        },onState:relayState,reconnecting:()=>setRelayMessage("Reconnecting to AQUA. Your approved step is saved; do not resubmit it.")});
      controller.signal.throwIfAborted();
      setStage(activeStage, "done");
      setStage("lock", "done");
      if (complete.devBuyIncluded) setStage("devBuy", "done");
      if (hasInitialBuy && !complete.devBuyIncluded) {
        try {
          setRelayMessage("Your coin is live. The optional first buy needs a separate wallet approval.");
          const plan = await api.launchDevBuyPlan(id, wallet.address!);
          controller.signal.throwIfAborted();
          if (plan.devBuyError) throw new Error(plan.devBuyError);
          await executeDevBuyPlan(plan, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) return;
          toast.warning(error instanceof TransactionOutcomeError && error.outcome === "pending" ? "Coin launched; buy confirmation pending" : "Coin launched; initial buy not completed", { description: error instanceof Error ? error.message : "The initial buy was not completed.", duration: 10_000 });
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
        signature = await wallet.sendTransaction(action.envelope, submitted => {
          retryAction = { ...action, signature: submitted };
          setPending(retryAction);
        });
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
          catch (error) { setStage("devBuy", "error"); toast.warning(error instanceof TransactionOutcomeError && error.outcome === "pending" ? "Coin launched; buy confirmation pending" : "Coin launched; initial buy not completed", { description: error instanceof Error ? error.message : "The initial buy was not completed.", duration: 10_000 }); }
        }
        if (confirmation.devBuyError) toast.warning("Coin launched without the optional first buy", { description: confirmation.devBuyError, duration: 10_000 });
        finishLaunch(action.launchId, confirmation.mint);
        return;
      }
      if (!confirmation.nextStep || !isEnvelope(confirmation)) throw new Error("The backend returned an incomplete launch step.");
      await continueLaunch({ envelope: confirmation, stage: confirmation.nextStep, launchId: action.launchId });
    } catch (error) {
      if (error instanceof TransactionOutcomeError && error.outcome === "failed") {
        retryAction = { ...action, signature: undefined };
      }
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
    if (!wallet.address || launching) return;
    if (pending && pending.launchId===resumeLaunchId) { await retryLaunch(); return; }
    const launchId = resumeLaunchId;
    if (!launchId) return;
    setExecutionOpen(true); setExecutionState("running"); setPending(null);
    showLaunchStatus("Resuming launch", "AQUA is checking confirmed steps and preparing what remains.");
    try {
      if (await attachExistingRelay(launchId)) return;
      const fresh = await api.retryLaunchTransaction(launchId, wallet.address);
      const restored = initialProgress();
      restored.approval = "done"; restored.mint = "done";
      if (fresh.status === "live") {
        restored.pool = "done"; restored.liquidity = "done"; restored.lock = "done"; setProgress(restored); finishLaunch(launchId, recoverableLaunch?.mint); return;
      }
      if (fresh.batch?.length) {
        const first = fresh.batch[0]?.step;
        if (first === "mint") restored.mint = "waiting";
        if (first === "liquidity" || first === "lock") restored.pool = "done";
        if (first === "lock") restored.liquidity = "done";
        setProgress(restored);
        await executeLaunchBatch(launchId, fresh.batch);
      } else {
        if (!fresh.step || !isEnvelope(fresh)) throw new Error("The backend returned an incomplete recovery step.");
        if (fresh.step === "mint") restored.mint = "waiting";
        if (fresh.step === "liquidity" || fresh.step === "lock") restored.pool = "done";
        if (fresh.step === "lock") restored.liquidity = "done";
        setProgress(restored);
        await continueLaunch({ envelope: fresh, stage: fresh.step, launchId: launchId });
      }
      setRecoverableLaunch(null);
    } catch (error) {
      showLaunchError(error, "The existing launch could not be resumed.");
    }
  }

  async function beginLaunch() {
    if (draftLoading) return;
    if (launching || !studioImportReady) return;
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
        creatorWallet: wallet.address, clientRequestId, symbol, stockSymbol: stock.symbol, batchSigning: wallet.canBatchSign,
        ...(importedStudio.current === `${wallet.address}:${searchParams.get("studio")}` ? { studioProjectId: searchParams.get("studio") } : {}),
        name: form.name.trim(), description: form.description.trim(), imageId,
        stockMint: stock.mint, poolPair: stock.mint === "So11111111111111111111111111111111111111112" ? "SOL" : "STOCK",
        devBuyStockRaw: "0", devBuyLamports: "0",
        devBuyCurrency: "SOL", devBuyAmountRaw: initialBuyRaw, rewardMode: form.rewardMode, ...(form.rewardMode === "fee_redirect" && form.redirectRecipient ? {redirectRecipient:{kind:form.redirectRecipient.kind,subject:form.redirectRecipient.subject}} : {}), rewardFeeBps: form.rewardFeeBps, rippleRewardBps: form.rippleRewardBps, marketingMode, dexFundingMode,
        sniperDefense: false, xUrl: normaliseUrl(form.xUrl), websiteUrl: normaliseUrl(form.websiteUrl), telegramUrl: normaliseTelegram(form.telegramUrl),
        ...(dexProfileEnabled ? { dexFundingEnabled, dexProfile: Object.fromEntries(Object.entries(dexProfile).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) } : {}),
      });
      draftIdentity.current = {...draftIdentity.current, launchId: intent.launchId};
      // Persist the association before wallet approvals, including when the tab closes during completion.
      try {
        await saveLaunchDraft(draftKey, draftSnapshot());
        // A quick launch can cancel the debounced save that normally retires the guest copy.
        const guest = migratedGuest.current;
        if (guest) { await removeLaunchDraft(guest.key, guest.id); if (migratedGuest.current === guest) migratedGuest.current = null; }
      } catch { setDraftError("Draft could not save. Keep this page open until launch."); }
      setStage("approval", "done");
      if (intent.batch?.length) await executeLaunchBatch(intent.launchId, intent.batch);
      else await continueLaunch({ envelope: intent, stage: "mint", launchId: intent.launchId });
    } catch (error) {
      setStage("approval", "error");
      showLaunchError(error, "The launch could not be prepared.");
    }
  }

  if (!studioImportReady) {
    const importError = studioImport.key === studioImportKey && studioImport.status === "error" ? studioImport.error : "";
    const pairError = !stockLoading && !pairsRefreshing && !stocks.length ? stockError || "No trading pairs are available. Try loading them again." : "";
    const message = !wallet.address ? (runtimeLoading || wallet.connecting ? "" : "Connect the wallet that owns this Studio project.") : importError || pairError;
    return <LaunchDetailsLoading message={message || undefined}>{message && <>
      {!wallet.address ? <button onClick={() => wallet.setModalOpen(true)}>Connect wallet</button>
        : <button onClick={() => { setStudioImport({key:studioImportKey,status:"loading"}); if (pairError) { setStockLoading(true); setPairLoadVersion(value => value + 1); } else setStudioImportAttempt(value => value + 1); }}>Try again</button>}
      <Link to="/studio">Back to Studio</Link>
    </>}</LaunchDetailsLoading>;
  }

  return <main className="page launch-wizard-page launch-wizard-only">
    {!launching && !completedLaunch && <div className="at-launch-entry"><span>Need artwork or a website? Atlantis Studio can help.</span><Link to="/studio">Open Studio ↗</Link></div>}
    {studioImportMessage && <div className="at-import-notice" role="status">{studioImportMessage}</div>}
    <PageBubbles count={6}/>
    {resumeLaunchId && wallet.address && !launching && !completedLaunch && <LaunchRecoveryPanel
      key={`${wallet.address}:${resumeLaunchId}`} launchId={resumeLaunchId}
      creator={wallet.address} disabled={draftLoading} onResume={() => void resumeExistingLaunch()} onNew={launchAnother} onDismiss={hideResume}/>}
    <RedirectSettingsPanel key={wallet.address ?? "guest"} open={redirectSettingsOpen && step===2} value={form.redirectRecipient} providers={config.rewardModes?.feeRedirect?.providers} onClose={()=>setRedirectSettingsOpen(false)} onSave={recipient=>{setForm(current=>({...current,rewardMode:"fee_redirect",redirectRecipient:recipient}));setRedirectSettingsOpen(false);}}/>
    <section className={`wizard-shell ${launching ? "is-launching" : ""}`}>
      <div className="wizard-caustics" aria-hidden="true"/>
      {launching && <div className="wizard-launching-screen" role="status" aria-live="polite" aria-label={`Launching ${form.symbol}`}>
        <div className="launching-water" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <section className="launch-simple-status">
          <span className="launching-orb"><Loader2 className="spin"/></span>
          <h2>Launching</h2>
          <p role="status">{relayMessage || activeProgress}</p><ol className="launch-progress-steps">{chainSteps.filter(item=>!["funding","devBuy"].includes(item.key)||hasInitialBuy).map(item=><li key={item.key} className={progress[item.key]}><span>{progress[item.key]==="done"?<Check size={14}/>:progress[item.key]==="active"?<Loader2 size={14} className="spin"/>:null}</span>{item.label}{progress[item.key]==="done"&&<small>Complete</small>}</li>)}</ol>
        </section>
      </div>}
      {completedLaunch ? <section className="launch-complete-screen" aria-live="polite">
        <div className="launch-complete-water" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <span className="launch-complete-orb"><Rocket/></span>
        <small>Orca market live</small>
        <h1>${completedLaunch.symbol} launched</h1>
        <p>Your pool is active, the full supply is committed to locked liquidity, and {completedLaunch.rewardMode === "fee_redirect" ? "rewards are split equally between your recipient and holders" : completedLaunch.rewardMode === "holder_rewards" ? "holder rewards are accruing" : completedLaunch.rewardMode === "buyback_burn" ? "market buybacks and burns are active" : "hourly jackpot scoring is active"}.</p>
        <div className="launch-complete-actions">
          <a className="complete-primary" href={`#/token/${completedLaunch.id}`}><span className="button-current"/>Go to coin <ArrowRight/></a>
          <button className="complete-secondary" onClick={launchAnother}>Launch another coin</button>
        </div>
      </section> : <>
      <aside className="wizard-rail" aria-label="Launch steps" inert={draftLoading}>
        <div className="wizard-rail-head"><span>Create coin</span><b>{step + 1} of {wizardSteps.length}</b></div>
        <div className="wizard-rail-track"><i style={{ height: `${(step / (wizardSteps.length - 1)) * 100}%` }}/></div>
        {wizardSteps.map((item, index) => <button key={item.label} aria-current={index === step ? "step" : undefined} className={`${index === step ? "active" : ""} ${index < step ? "done" : ""}`} onClick={() => { if (index <= step || validForStep.slice(0,index).every(Boolean)) setStep(index); }} disabled={index > step && !validForStep.slice(0,index).every(Boolean)}>
          <span>{index < step ? <Check size={15}/> : index + 1}</span><div><b>{item.label}</b><small>{item.short}</small></div>
        </button>)}
        <div className="wizard-rail-pulse" aria-hidden="true"><i/><i/><i/></div>
      </aside>

      <div className="wizard-main" aria-busy={draftLoading}>
        {draftLoading && <div className="wizard-draft-loading" role="status"><Loader2 className="spin" size={24}/><span>Loading your draft…</span></div>}
        <div className="wizard-form-content" inert={draftLoading}>{draftError && <p className="survey-error" role="status">{draftError}</p>}
        {step === 0 && <WizardSection title="Create your coin" description="Add a name, ticker, and artwork. The description and socials are optional.">
          <div className="coin-identity-grid">
            <label className="wizard-artwork">
              {preview ? <img src={preview} alt="Token artwork preview"/> : <><ImagePlus/><b>Add artwork</b><small>PNG, JPG, WebP or GIF</small></>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { editDraft(); chooseArtwork(event.target.files?.[0] ?? null); }}/>
              {preview && <button type="button" aria-label="Remove artwork" onClick={(event) => { event.preventDefault(); editDraft(); chooseArtwork(null); }}><X size={15}/></button>}
            </label>
            <div className="wizard-field-grid">
              <Field label="Coin name"><input value={form.name} maxLength={32} placeholder="Aqua Robotics" onChange={(event) => update("name", event.target.value)}/></Field>
              <Field label="Ticker"><div className="ticker-input"><span>$</span><input value={form.symbol} maxLength={10} placeholder="AQR" onChange={(event) => update("symbol", event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}/></div></Field>
              <Field label="Description" wide><textarea value={form.description} rows={4} maxLength={360} placeholder="What is this coin about?" onChange={(event) => update("description", event.target.value)}/><small className="field-count">{form.description.length}/360</small></Field>
            </div>
          </div>
          <details className="wizard-socials"><summary><span>Social links <small>Optional</small></span><ChevronDown size={17}/></summary><div className="wizard-field-grid three">
            <Field label="X"><input value={form.xUrl} placeholder="x.com/account or post" onChange={(event) => update("xUrl", event.target.value)}/></Field>
            <Field label="Website"><input value={form.websiteUrl} placeholder="project.com" onChange={(event) => update("websiteUrl", event.target.value)}/></Field>
            <Field label="Telegram"><input value={form.telegramUrl} placeholder="t.me/community" onChange={(event) => update("telegramUrl", event.target.value)}/></Field>
          </div></details>
        </WizardSection>}

        {step === 1 && <WizardSection title="Choose a trading pair" description="Choose the asset your coin pairs with. Sales on AQUA return SOL.">
          <div className="stock-search"><Search size={17}/><input value={stockQuery} aria-label="Search pairs or paste a Pump.fun mint address" placeholder={pairLookupEnabled ? "Search pairs or paste a Pump.fun CA" : "Search SOL, ORCA, or stocks"} onChange={(event) => { setStockQuery(event.target.value); setPairResult(null); setVisibleStocks(10); }}/><span>{pairOptions.length} assets</span></div>
          {stockLoading ? <div className="stock-loading"><Loader2 className="spin"/><span>Loading pairs</span></div> : <>
            <div className="stock-picker">{filteredStocks.map((item) => <button key={item.mint} className={stock?.mint === item.mint ? "selected" : ""} onClick={() => { editDraft(); setRestoredPair(null); setStock(item); setAcknowledged(false); }}>
              <StockLogo stock={item}/><div><b>{item.symbol}</b><small>{item.name}</small></div><span className="stock-market-depth">{item.mint === "So11111111111111111111111111111111111111112" ? <><b>Native pair</b><small>SOL rewards</small></> : item.mint === "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" ? <><b>Official ORCA</b><small>ORCA rewards</small></> : item.assetKind ? <><b>{item.assetKind === "aqua" ? "AQUA pair" : "Pump.fun"}</b><small>{item.liquidityUsd === undefined ? "Swap routes available" : `$${compactNumber.format(item.liquidityUsd)} liquidity`}</small></> : <><b>${compactNumber.format(item.orcaTvlUsd)} TVL</b><small>${compactNumber.format(item.orcaVolume24hUsd)} 24h</small></>}</span><i>{stock?.mint === item.mint && <Check size={14}/>}</i>
            </button>)}</div>
            {pairChecking && <div className="pair-lookup-status" role="status"><Loader2 size={16} className="spin"/>Checking this coin and its swap routes…</div>}
            {searchedPair?.error && <div className="stock-error" role="alert"><span>{searchedPair.error}</span><RefreshButton onClick={() => { setPairResult(null); setPairLookupVersion(value => value + 1); }}><RefreshCw size={14}/> Retry</RefreshButton></div>}
            {filteredStocks.length === 0 && !pairsRefreshing && !pairChecking && !searchedPair?.error && <div className="no-stock-results">{mintSearch && !pairLookupEnabled ? "Custom pairs are not enabled yet." : `No pairs match “${stockQuery}”.`}</div>}
            {filteredStocks.length < stockResultsCount && <button className="stock-more" onClick={() => setVisibleStocks((value) => value + 20)}>Show more</button>}
          </>}
          {!stockLoading && pairsRefreshing && <div className="pair-lookup-status" role="status"><Loader2 size={16} className="spin"/>Loading more pairs…</div>}
          {!stockLoading && stockError && <div className="stock-error"><Info/><span>{stockError}</span><RefreshButton onClick={() => setPairLoadVersion(value => value + 1)}><RefreshCw size={14}/> Retry</RefreshButton></div>}
          {stock && <div className="selected-stock-strip"><StockLogo stock={stock}/><div><small>Permanent pair and reward</small><b>${form.symbol || "COIN"} / {stock.symbol}</b></div><span>Holder rewards in {stock.symbol}</span></div>}
          {stock?.assetKind && <div className="selected-pair-address"><span>{stock.assetKind === "aqua" ? "AQUA" : "Pump.fun"} mint</span><a href={`https://solscan.io/token/${stock.mint}`} target="_blank" rel="noreferrer">{stock.mint}</a>{Boolean(stock.transferFeeBps) && <small>{(stock.transferFeeBps! / 100).toFixed(0)}% token transfer fee applies to swaps and rewards.</small>}</div>}
          {pairWarning && <div className="stock-error"><span>AQUA pair: {pairWarning}</span><RefreshButton onClick={() => setPairLoadVersion(value => value + 1)}><RefreshCw size={14}/> Retry</RefreshButton></div>}
          {stock?.restricted && <label className="stock-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I understand tokenized stocks may be restricted or unavailable in my jurisdiction.</span></label>}
        </WizardSection>}

        {step === 2 && <WizardSection title="Choose the reward mode" description="Choose how your coin rewards its holders.">
          <div className="reward-mode-grid" role="radiogroup" aria-label="Reward mode">
            <ModeButton active={form.rewardMode === "holder_rewards"} onClick={() => update("rewardMode", "holder_rewards")} icon={<RewardModeIcon mode="holder_rewards"/>} title="Holder Rewards" eyebrow="Steady rewards">
              Holders earn your pair asset based on their balance and time held.
            </ModeButton>
            <ModeButton active={form.rewardMode === "fee_redirect"} disabled={!config.rewardModes?.feeRedirect?.enabled} onClick={() => setRedirectSettingsOpen(true)} icon={<RewardModeIcon mode="fee_redirect"/>} title="Fee Redirect" eyebrow="50% recipient · 50% holders">
              Share rewards with a wallet, X account or GitHub user. Holders keep earning the other half.
            </ModeButton>
            <ModeButton active={form.rewardMode === "buyback_burn"} disabled={!config.rewardModes?.enabled} onClick={() => update("rewardMode", "buyback_burn")} icon={<RewardModeIcon mode="buyback_burn"/>} title="Buyback & Burn" eyebrow="Reduce supply">
              Rewards buy back your coin and permanently burn the tokens.
            </ModeButton>
            <ModeButton active={form.rewardMode === "jackpot"} disabled={!config.rewardModes?.enabled || !config.rewardModes.jackpot.enabled} onClick={() => update("rewardMode", "jackpot")} icon={<RewardModeIcon mode="jackpot"/>} title="Hourly Jackpot" eyebrow="5 winners · every hour">
              Five holders win each hour. Holding and buying earlier improves your score; selling reduces it.
            </ModeButton>
          </div>
          {form.rewardMode === "fee_redirect" && form.redirectRecipient && <div className="redirect-selection"><Check size={18}/><span><strong>50% to {recipientLabel(form.redirectRecipient)}</strong><small>50% to holders · Recipient checked</small></span><button type="button" className="secondary-button" onClick={()=>setRedirectSettingsOpen(true)}>Edit recipient</button></div>}
          {config.rippleRewards?.enabled && <div className="reward-mode-notice"><Info/> Set aside a share for Ripple Rewards in the next step.</div>}
          {!config.rewardModes?.enabled && <div className="reward-mode-notice"><Info/> Buyback &amp; Burn and Hourly Jackpot will unlock when their settlement services are enabled.</div>}
        </WizardSection>}

        {step === settingsStep && <WizardSection title="Coin settings" description="Set your fees and community funding.">
          <div className="launch-settings-grid">
            <PercentControl id="launch-reward-fee" label="Rewards fee" hint="Funds your coin’s rewards." value={form.rewardFeeBps} min={100} max={400} step={10} disabled={!config.launchSettings?.variableRewardFeesEnabled} onChange={value => update("rewardFeeBps", value)}>
              {!config.launchSettings?.variableRewardFeesEnabled && <small>Currently available: 1%.{form.rewardFeeBps !== 100 && <button type="button" className="proposal-text-action" onClick={() => update("rewardFeeBps",100)}>Use 1%</button>}</small>}
            </PercentControl>
            <PercentControl id="launch-ripple-share" label="Ripple share" hint="Rewards for X posts. No extra fee." value={form.rippleRewardBps} min={300} max={3000} step={100} onChange={value => update("rippleRewardBps", value)}/>
          </div>
          <CoinFeeBreakdown rewardFeeBps={form.rewardFeeBps} orcaFeeRate={config.launchSettings?.orcaFeeRate}/>
          <section className="launch-growth-settings"><h3>Community funding</h3>
            <div className="launch-advanced-fields">
              <label htmlFor="launch-marketing-mode">Marketing<Select id="launch-marketing-mode" aria-label="Marketing" aria-describedby="launch-funding-help" value={marketingMode} onChange={event=>{editDraft();setMarketingMode(event.target.value as typeof marketingMode);}}><option value="off">Off</option><option value="proposal">Proposal only</option><option value="automatic">Automatic</option></Select></label>
              <label htmlFor="launch-dex-funding-mode">DEX fund<Select id="launch-dex-funding-mode" aria-label="DEX fund" aria-describedby="launch-funding-help" value={dexFundingMode} onChange={event=>{editDraft();setDexFundingMode(event.target.value as typeof dexFundingMode);}}><option value="proposal">Proposal only</option><option value="automatic">Automatic</option></Select></label>
            </div>
            <p id="launch-funding-help">Automatic also includes holder proposals.</p>
          </section>
        </WizardSection>}

        {dexProfileEnabled && step === dexProfileStep && <WizardSection title="DEX Screener profile" description="Add an optional profile draft. Your community can propose updates later.">
          <div className="launch-dex-fields"><DexProfileFields profile={dexProfile} update={(key, value) => {editDraft();setDexProfile((current) => ({ ...current, [key]: value }));}} optional/></div>
          {!dexDraftValid && <p className="survey-error">Use full https:// URLs, or leave these fields empty.</p>}
          <button className="proposal-text-action" onClick={() => { editDraft(); setDexFundingEnabled(false); setDexProfile({ description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" }); setStep(devBuyStep); }}>Skip profile details <ArrowRight/></button>
        </WizardSection>}

        {step === devBuyStep && <WizardSection title="Review & launch" description="Check your coin, settings and cost before approving in your wallet.">
          <Field label={`Optional first buy in ${currencySymbol}`} wide><div className="unit-input launch-amount-input"><input inputMode="decimal" value={form.launchAmount} placeholder="0" onChange={(event) => update("launchAmount", event.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}/><span>{currencySymbol}</span></div></Field>
          {launchCost && <div className="launch-cost-card">
            <div><span><b>Estimated total</b><small>including your optional first buy</small></span><strong>{(launchCost.estimatedTotalSol.minimum+(amountValid?amount:0)).toFixed(2)}–{(launchCost.estimatedTotalSol.maximum+(amountValid?amount:0)).toFixed(2)} SOL</strong></div>
            <p>Includes the {launchCost.platformFeeSol.toFixed(2)} SOL launch fee and estimated network costs{hasInitialBuy?`, plus your ${form.launchAmount} SOL first buy`:""}.</p>
          </div>}
          {wallet.address && <div className="launch-budget-card" role="status">
            <b>{budget ? budget.sufficient ? "Enough SOL to finish launch setup" : "More SOL needed" : budgetError ? "Balance check unavailable" : "Checking your SOL balance…"}</b>
            {budget && <p>Wallet: {(Number(budget.availableLamports)/1e9).toFixed(4)} SOL · Setup allowance: {(Number(budget.reserveLamports)/1e9).toFixed(3)} SOL. Unused SOL stays in your wallet.</p>}
            {budget && !budget.sufficient && <p>Add {(Number(budget.shortfallLamports)/1e9).toFixed(6)} SOL or lower your first buy to {(Number(budget.maximumBuyLamports)/1e9).toFixed(6)} SOL or less.</p>}
            {budgetError && <p>{budgetError}</p>}
            <button type="button" onClick={() => setBudgetVersion(value=>value+1)}>Refresh balance</button>
          </div>}
          <p className="field-help">Liquidity, your optional first buy and permanent locking finish together. If the final transaction fails, the buy is reversed. Earlier setup and network fees still apply.</p>
          {wallet.canBatchSign && <p className="field-help">One signing request covers token creation, pool setup and permanent locking, including your optional first buy. Your wallet may show a review for each transaction.</p>}
          <div className="launch-final-summary"><div className="review-token-art">{preview ? <img src={preview} alt=""/> : <Droplets/>}</div><div><b>{form.name || "Unnamed coin"}</b><span>${form.symbol || "TICKER"} / {stock?.symbol ?? "PAIR"} · {form.rewardMode === "fee_redirect" ? "Fee Redirect" : form.rewardMode === "holder_rewards" ? "Holder Rewards" : form.rewardMode === "buyback_burn" ? "Buyback & Burn" : "Hourly Jackpot"}</span></div><strong>{hasInitialBuy ? `${form.launchAmount} ${currencySymbol}` : "No initial buy"}</strong></div>
          {form.rewardMode === "fee_redirect" && form.redirectRecipient && <div className="redirect-review"><strong>50% to {recipientLabel(form.redirectRecipient)} · 50% to holders</strong><br/>Recipient fixed at launch. Split applies after operating costs, Ripple and community funding.</div>}
          <div className="launch-settings-review"><span>Rewards fee <b>{form.rewardFeeBps/100}%</b></span><span>Ripple share <b>{form.rippleRewardBps/100}%</b></span><button type="button" onClick={() => setStep(settingsStep)}>Edit settings</button></div>
          <p className="field-help">Fees and Ripple share are fixed at launch. Review them before continuing.</p><label className="terms-acceptance"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)}/><span>I have read and agree to the <Link to="/terms" target="_blank">Terms of Service</Link>, including the cryptoasset, permanent-liquidity and third-party risks.</span></label>
          <button className="wizard-launch-button" onClick={() => void beginLaunch()} disabled={!validForStep.every(Boolean) || launching || !acceptedTerms || Boolean(wallet.address && (!budget || !budget.sufficient))} aria-busy={launching}><span className="button-current"/><span className="launch-button-bubbles" aria-hidden="true"><i/><i/><i/><i/></span>{launching && <Loader2 className="spin"/>}<span>{launching ? "Launching" : wallet.address ? "Launch" : "Connect wallet to launch"}</span></button>
        </WizardSection>}

        {!validForStep[step]&&<p className="wizard-validation" role="status">{step===0?[form.name.trim().length<2?"Add a name (at least 2 characters)":null,form.symbol.trim().length<2?"add a ticker (at least 2 characters)":null,!file?"add artwork":null].filter(Boolean).join(" · "):step===1?"Choose a pair and accept its acknowledgement if required.":step===2?"Choose an available reward mode.":step===settingsStep?"Choose an available fee and Ripple share.":dexProfileEnabled&&step===dexProfileStep?"Fix the profile links, or skip this optional step.":"Enter a valid first-buy amount, or leave it empty."}</p>}
        <footer className="wizard-actions"><button className="wizard-back" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ArrowLeft/> Back</button>{step < wizardSteps.length - 1 && <button className="wizard-next" onClick={nextStep} disabled={!validForStep[step]}><span>Continue</span> <ArrowRight/></button>}</footer>
      </div></div>
      </>}
    </section>

  </main>;
}

function WizardSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="wizard-section"><header><h2>{title}</h2><p>{description}</p></header><div className="wizard-section-body">{children}</div></section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`wizard-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }
function ModeButton({ active, disabled, onClick, icon, title, eyebrow, children }: { active: boolean; disabled?: boolean; onClick: () => void; icon: ReactNode; title: string; eyebrow: string; children: ReactNode }) { return <button type="button" role="radio" aria-checked={active} disabled={disabled} className={`reward-mode-option ${active ? "selected" : ""}`} onClick={onClick}><i>{icon}</i><div><small>{eyebrow}</small><b>{title}</b><p>{children}</p></div><em>{disabled ? "Coming soon" : active ? <Check/> : null}</em></button>; }
function StockLogo({ stock }: { stock: StockOption }) { const [failed, setFailed] = useState(false); useEffect(() => setFailed(false), [stock.mint, stock.logoUrl]); return <span className="stock-logo">{stock.mint === "So11111111111111111111111111111111111111112" ? <NetworkSolana className="currency-brand-icon" variant="branded"/> : stock.logoUrl && !failed ? <img src={assetLogoUrl(stock.logoUrl)!} alt="" onError={() => setFailed(true)}/> : stock.underlyingSymbol.slice(0, 2)}</span>; }
