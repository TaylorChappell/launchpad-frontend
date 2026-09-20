import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PageBubbles } from "../components/PageBubbles";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StudioMessage } from "../components/StudioMessage";
import {
  accountRequest,
  signInAccount,
  type GithubConnection,
  type GithubExport,
} from "../account-api";
import { DexProfileFields } from "../components/MarketProposals";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Code2,
  Download,
  Droplets,
  FilePlus2,
  FolderPlus,
  History,
  ImagePlus,
  LockKeyhole,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Github,
  Gauge,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useWallet } from "../context";
import { API_URL } from "../api";
import {
  aquaAmount,
  aquaRaw,
  usdCredit,
  studioAssetUrl,
  studioRequest,
  loadStudioConfig,
  studioConfigIsTransient,
  studioSession,
  clearStudioSession,
  StudioApiError,
  type StudioConfig,
  type StudioFile,
  type StudioJob,
  type StudioLaunch,
  type StudioProject,
  type StudioState,
} from "../studio-api";
import { StudioSitePreview } from "../components/StudioSitePreview";
import { studioChangeList } from "../studio-changes";
import type { TransactionEnvelope } from "../types";
import { lazyWithRecovery as lazy } from "../components/LazyRecovery";
const Editor = lazy(() => import("../components/StudioEditor"));
type Account = {
  balanceMicroUsd: string;
  creditExempt?: boolean;
  legacyBalanceNotice?: string | null;
  ledger: Array<{
    id: string;
    kind: string;
    amount_raw: string;
    amount_micro_usd: string | null;
    created_at: number;
    details: { chargedRaw?: string };
  }>;
};
type DepositQuote = TransactionEnvelope & {id:string;maximumCreditMicroUsd:string;expiresAt:number;price:{usdPrice:string;quotedAt:number}};
type Quote = {
  effort?: "low" | "medium" | "high";
  creditExempt: boolean;
  id: string;
  maximumMicroUsd: string;
  expiresAt: number;
  pricing: string;
};
type CreditGate = {
  balanceMicroUsd: string;
  requiredMicroUsd?: string;
};
type Version = {
  id: string;
  revision: number;
  label: string;
  created_at: number;
};
type Modal =
  | "credit"
  | "export"
  | "github"
  | "history"
  | "project"
  | "file"
  | "folder"
  | "rename"
  | "renameproject"
  | "remove"
  | null;
const imageFile = (f: StudioFile) =>
  /\.(png|jpe?g|webp|gif|svg)$/i.test(f.path);
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

export function Studio() {
  const wallet = useWallet();
  return <StudioWorkspace key={wallet.address ?? "visitor"} />;
}
function StudioWorkspace() {
  const wallet = useWallet(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const preferenceKey = `aqua:studio-preferences:${wallet.address ?? "visitor"}`;
  const [effort, setEffort] = useState<"low" | "medium" | "high">(() => {
    try { const value=JSON.parse(localStorage.getItem(preferenceKey) ?? "{}").effort; return ["low","medium","high"].includes(value) ? value : "low"; } catch { return "low"; }
  });
  const [autoApply,setAutoApply] = useState(() => {
    try { return JSON.parse(localStorage.getItem(preferenceKey) ?? "{}").autoApply === true; } catch { return false; }
  });
  const handledResults = useRef(new Set<string>());
  const autoApplyJobs = useRef(new Set<string>());
  const pendingSend = useRef<{projectId:string;revision:number;prompt:string;effort:typeof effort;quote:Quote;autoApply:boolean} | null>(null);
  const [sending, setSending] = useState<{projectId:string;prompt:string} | null>(null);
  const projectListVersion = useRef(0);
  const projectsCurrent = useRef<Array<Omit<StudioProject, "state">>>([]);
  const jobsVersion = useRef(0);
  const jobsCurrent = useRef<StudioJob[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const autoApplyCurrent = useRef(autoApply);
  autoApplyCurrent.current = autoApply;
  useEffect(() => {
    try { localStorage.setItem(preferenceKey,JSON.stringify({effort,autoApply})); } catch { /* Preferences still work for this session. */ }
  }, [preferenceKey,effort,autoApply]);
  const [token, setToken] = useState(() =>
    wallet.address ? studioSession(wallet.address) : "",
  );
  const autoSignInWallet = useRef("");
  const [config, setConfig] = useState<StudioConfig | null>(null),
    [account, setAccount] = useState<Account>({ balanceMicroUsd: "0", ledger: [] });
  const [depositQuote,setDepositQuote] = useState<DepositQuote | null>(null);
  const [configChecking,setConfigChecking] = useState(true);
  const configRequest = useRef<Promise<StudioConfig> | null>(null);
  const [depositChecking,setDepositChecking] = useState(false);
  const [depositStatus,setDepositStatus] = useState("Waiting for Solana finalization. Checking automatically; do not send another deposit.");
  const [depositRetry,setDepositRetry] = useState(0);
  const [projects, setProjects] = useState<Array<Omit<StudioProject, "state">>>(
      [],
    ),
    [project, setProject] = useState<StudioProject | null>(null);
  const [state, setState] = useState<StudioState | null>(null),
    [jobs, setJobs] = useState<StudioJob[]>([]),
    [review, setReview] = useState<StudioJob | null>(null);
  const [tab, setTab] = useState<"preview" | "details" | "code" | "assets">(
      "preview",
    ),
    [mobile, setMobile] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const messages = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState("frontend/index.html"),
    [prompt, setPrompt] = useState(""),
    [creditGate, setCreditGate] = useState<CreditGate | null>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = composerInput.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "0px";
      const height = input.scrollHeight;
      input.style.height = `${Math.min(180, Math.max(52, height))}px`;
      input.style.overflowY = height > 180 ? "auto" : "hidden";
    };
    resize();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) { width = input.clientWidth; resize(); }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [prompt, workspaceOpen, project?.id]);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [input, setInput] = useState("");
  const [repo, setRepo] = useState(""),
    [privateRepo, setPrivateRepo] = useState(true),
    [github, setGithub] = useState<GithubConnection | null>(null),
    [githubExports, setGithubExports] = useState<GithubExport[]>([]),
    [exportUrl, setExportUrl] = useState("");
  const [railwayToken, setRailwayToken] = useState("");
  const [railwayExportId, setRailwayExportId] = useState("");
  const [railwayOrigin, setRailwayOrigin] = useState("");
  const [railwayVariables, setRailwayVariables] = useState("");
  const [railwayUrl, setRailwayUrl] = useState("");
  useEffect(() => {
    setRailwayToken(""); setRailwayVariables(""); setRailwayExportId(""); setRailwayUrl("");
  }, [project?.id, modal]);
  const [modalProject, setModalProject] = useState<Omit<
    StudioProject,
    "state"
  > | null>(null);
  const [projectMenu, setProjectMenu] = useState<{
    project: Omit<StudioProject, "state">;
    top: number;
    left: number;
  } | null>(null);
  const [versions, setVersions] = useState<Version[]>([]),
    [pendingDeposit, setPendingDeposit] = useState<{
      id: string;
      signature: string;
    } | null>(() => {
      try {
        return JSON.parse(
          localStorage.getItem(`aqua:studio-deposit:${wallet.address}`) ??
            "null",
        );
      } catch {
        return null;
      }
    });
  const upload = useRef<HTMLInputElement>(null),
    projectId = useRef<string | null>(null),
    mounted = useRef(true),
    workspaceSession = useRef(""),
    taskLock = useRef(false);
  const dirty = useMemo(() => Boolean(
    state && project && JSON.stringify(state) !== JSON.stringify(project.state),
  ), [state, project]);
  const active = jobs.some((job) => ["queued", "running"].includes(job.status));
  jobsCurrent.current = jobs;
  projectsCurrent.current = projects;
  const workingProject = projects.find(item => item.active_job) ?? (active ? project : null);
  const generationBusy = Boolean(sending || workingProject);
  const visibleSending = sending?.projectId === project?.id ? sending : null;
  const blankWebsite = Boolean(
    state?.files
      .find((file) => file.path === "frontend/index.html")
      ?.content.includes('<main id="app"></main>'),
  );
  useEffect(() => {
    messages.current?.scrollTo({
      top: messages.current.scrollHeight,
      behavior: "auto",
    });
  }, [jobs.length, jobs[0]?.status, visibleSending, project?.id, workspaceOpen]);
  const file = state?.files.find((f) => f.path === selected),
    decimals = config?.decimals ?? null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function fail(reason: unknown) {
    if (!mounted.current) return;
    setError(errorText(reason));
    if (reason instanceof StudioApiError && reason.status === 401) {
      setToken("");
      if (wallet.address) clearStudioSession(wallet.address);
    }
  }
  async function task(label: string, fn: () => Promise<void>) {
    if (taskLock.current) return;
    taskLock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      taskLock.current = false;
      if (mounted.current) setBusy("");
    }
  }
  const request = <T,>(path: string, body?: unknown, method?: string) =>
    studioRequest<T>(path, token, body, method);
  async function refreshAccount() {
    const value = await request<Account>("/account");
    if (mounted.current) setAccount(value);
    return value;
  }
  function refreshStudioConfig() {
    if (configRequest.current) return configRequest.current;
    setConfigChecking(true);
    const promise = loadStudioConfig().then(value => {
      if (mounted.current) setConfig(value);
      return value;
    }).finally(() => {
      configRequest.current = null;
      if (mounted.current) setConfigChecking(false);
    });
    configRequest.current = promise;
    return promise;
  }
  async function checkStudioSetup() {
    await task("Checking AI setup", async () => {
      const [latestConfig] = await Promise.all([
        refreshStudioConfig(),
        token ? refreshAccount() : Promise.resolve(account),
      ]);
      if (!mounted.current) return;
      setConfig(latestConfig);
      if (latestConfig.paidEnabled)
        setNotice(latestConfig.depositsEnabled ? "Studio AI and AQUA deposits are ready." : "Studio AI is ready. AQUA deposits still need attention; existing USD credit can be used.");
    });
  }
  async function refreshProjects() {
    const version = ++projectListVersion.current;
    const value =
      await request<Array<Omit<StudioProject, "state">>>("/projects");
    if (mounted.current && version === projectListVersion.current) {
      const finishedElsewhere = projectsCurrent.current.some(old => old.id !== projectId.current && old.active_job && !value.find(item => item.id === old.id)?.active_job);
      setProjects(value);
      if (finishedElsewhere) void refreshAccount().catch(() => {});
    }
    return value;
  }
  function takeProject(value: StudioProject) {
    projectId.current = value.id;
    setProject(value);
    setState(value.state);
    setReview(null);
    try { sessionStorage.setItem(`aqua:studio-project:${wallet.address}`, value.id); } catch { /* Selection still works without storage. */ }
  }
  async function openProject(id: string) {
    jobsVersion.current++;
    const [value, history] = await Promise.all([
      request<StudioProject>(`/projects/${id}`),
      request<StudioJob[]>(`/projects/${id}/jobs`),
    ]);
    if (!mounted.current) return;
    takeProject(value);
    if (projectId.current === id) {
      // Historical results remain available to review, but do not reopen old popups.
      for (const job of history) if (job.status === "complete") handledResults.current.add(job.id);
      setJobs(history);
    }
  }
  useEffect(() => {
    void refreshStudioConfig().catch(fail);
  }, []);
  useEffect(() => {
    if (modal !== "credit" || configChecking || (config && !studioConfigIsTransient(config))) return;
    const timer = window.setTimeout(() => void refreshStudioConfig().catch(fail),30000);
    return () => window.clearTimeout(timer);
  }, [modal,config,configChecking]);
  useEffect(() => {
    if (!token || busy || taskLock.current) return;
    if (workspaceSession.current === token && !params.get("github")) return;
    workspaceSession.current = token;
    void task("Opening workspace", async () => {
      const result = params.get("github");
      let connectionError: unknown;
      let returning: {
        projectId?: string;
        modal?: string;
        repo?: string;
        privateRepo?: boolean;
      } | null = null;
      if (result) {
        try {
          const key = `aqua:studio-github-return:${wallet.address}`;
          returning = JSON.parse(sessionStorage.getItem(key) ?? "null");
          sessionStorage.removeItem(key);
        } catch {
          /* Reopen GitHub without a project preference. */
        }
        const oauthState = params.get("state"),
          code = params.get("code");
        setParams({}, { replace: true });
        if (result === "callback") {
          try {
            await accountRequest("/integrations/github/complete", token, {
              state: oauthState,
              code,
            });
          } catch (error) {
            connectionError = error;
          }
        }
      }
      // Account and GitHub availability must not delay the project workspace.
      void refreshAccount().catch(fail);
      const connection = refreshGithub().catch(fail);
      const list = await refreshProjects();
      let lastProject = "";
      try { lastProject = sessionStorage.getItem(`aqua:studio-project:${wallet.address}`) ?? ""; } catch { /* Use the latest project. */ }
      const selectedProject =
        list.find((item) => item.id === returning?.projectId) ?? list.find(item => item.id === lastProject) ?? list[0];
      if (selectedProject) await openProject(selectedProject.id);
      if (!mounted.current || !result) return;
      await connection;
      const returnToExport = returning?.modal === "export" && selectedProject;
      if (returnToExport && returning) {
        setRepo(
          typeof returning.repo === "string"
            ? returning.repo
            : repositoryName(selectedProject.name),
        );
        setPrivateRepo(
          typeof returning.privateRepo === "boolean"
            ? returning.privateRepo
            : true,
        );
        setGithubExports(
          await request<GithubExport[]>(
            `/projects/${selectedProject.id}/github`,
          ),
        );
      }
      if (!mounted.current) return;
      setModal(returnToExport ? "export" : "github");
      if (connectionError) fail(connectionError);
      else
        setNotice(
          result === "callback"
            ? "GitHub connected. This wallet will remember your connection."
            : result === "cancelled"
              ? "GitHub connection cancelled."
              : "GitHub could not connect. Try again.",
        );
    }).finally(() => { if (mounted.current) setProjectsLoading(false); });
  }, [token, params, busy]);
  useEffect(() => {
    if (!token) return;
    const id = project?.id;
    let disposed = false, polling = false;
    const sync = async () => {
      if (disposed || polling || document.hidden) return;
      polling = true;
      const version = jobsVersion.current;
      try {
        await Promise.all([
          refreshProjects(),
          id ? request<StudioJob[]>(`/projects/${id}/jobs`).then(rows => {
            if (disposed || !mounted.current || projectId.current !== id || version !== jobsVersion.current) return;
            const finished = jobsCurrent.current.some(old => ["queued", "running"].includes(old.status) && rows.some(row => row.id === old.id && ["complete", "failed"].includes(row.status)));
            const retry = pendingSend.current;
            if (retry?.projectId === id && rows.some(row => row.id === retry.quote.id)) {
              pendingSend.current = null;
              setPrompt(old => old === retry.prompt ? "" : old);
            }
            setJobs(rows);
            if (finished) void refreshAccount().catch(() => {});
          }) : Promise.resolve(),
        ]);
      } catch { /* A transient polling failure must not interrupt server-side work. */ }
      finally { polling = false; }
    };
    const poll = window.setInterval(() => void sync(), generationBusy ? 3000 : 12000);
    const resume = () => void sync();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearInterval(poll);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [token, project?.id, generationBusy]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const guardNavigation = (event: MouseEvent) => {
      const anchor = (
        event.target as Element | null
      )?.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        !anchor.href.startsWith(location.origin + location.pathname) ||
        anchor.hash === location.hash
      )
        return;
      if (
        !window.confirm(
          "Leave Studio and discard unsaved changes? Save first to keep them.",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (!modal) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !taskLock.current) {
        setModal(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modal]);
  async function signIn() {
    await task("Signing in", async () => {
      if (!wallet.address) {
        wallet.setModalOpen(true);
        return;
      }
      const session = await signInAccount(
        wallet.address,
        wallet.signMessage,
        () => mounted.current,
      );
      if (!mounted.current) return;
      setToken(session.token);
    });
  }
  useEffect(() => {
    if (!wallet.address || token || wallet.connecting || taskLock.current || autoSignInWallet.current === wallet.address) return;
    autoSignInWallet.current = wallet.address;
    void signIn();
  }, [wallet.address, wallet.connecting, token]);
  async function save() {
    if (!project || !state) return null;
    if (!dirty) return project;
    const saved = await request<StudioProject>(`/projects/${project.id}`, {
      revision: project.revision,
      state,
    });
    takeProject(saved);
    await refreshProjects();
    return saved;
  }
  function edit(fn: (old: StudioState) => StudioState) {
    setState((old) => (old ? fn(old) : old));
  }
  function launchField<K extends keyof StudioLaunch>(
    key: K,
    value: StudioLaunch[K],
  ) {
    edit((old) => ({ ...old, launch: { ...old.launch, [key]: value } }));
  }
  function lockField(key: keyof StudioLaunch) {
    edit((old) => ({
      ...old,
      lockedFields: old.lockedFields.includes(key)
        ? old.lockedFields.filter((k) => k !== key)
        : [...old.lockedFields, key],
    }));
  }
  async function sendMessage(retryMessage?: {prompt: string; effort?: typeof effort}) {
    const submittedPrompt = retryMessage?.prompt ?? prompt;
    if (!project || !submittedPrompt.trim() || taskLock.current || generationBusy || review) return;
    const sendingProject = project.id;
    const selectedEffort = retryMessage?.effort ?? effort;
    if (retryMessage?.effort) setEffort(retryMessage.effort);
    // Render the user's message before configuration, saving, or billing requests.
    setSending({ projectId: sendingProject, prompt: submittedPrompt });
    setPrompt("");
    let accepted = false;
    await task("Starting generation", async () => {
      try {
      const retry = pendingSend.current;
      if (retry && retry.projectId === sendingProject && retry.revision === project?.revision && retry.prompt === submittedPrompt && retry.effort === selectedEffort && !dirty) {
        accepted = await submitGeneration(retry);
        return;
      }
      const [latestConfig, latestAccount] = await Promise.all([
        refreshStudioConfig(),
        refreshAccount(),
      ]);
      if (!mounted.current) return;
      setConfig(latestConfig);
      if (!latestConfig.paidEnabled) {
        setCreditGate(null);
        setError("AI setup is incomplete. The exact missing settings are listed below.");
        return;
      }
      const saved = await save();
      if (!saved || saved.id !== sendingProject || projectId.current !== sendingProject) return;
      const estimate = await request<Quote>(`/projects/${saved.id}/quote`, {
        prompt: submittedPrompt,
        kind: "auto",
        revision: saved.revision,
        effort: selectedEffort,
      });
      if (estimate.effort !== selectedEffort)
        throw new Error("This backend does not support effort selection yet. Deploy the updated Studio backend before sending.");
      if (!mounted.current || projectId.current !== saved.id) return;
      if (!estimate.creditExempt && BigInt(latestAccount.balanceMicroUsd) < BigInt(estimate.maximumMicroUsd)) {
        setCreditGate({
          balanceMicroUsd: latestAccount.balanceMicroUsd,
          requiredMicroUsd: estimate.maximumMicroUsd,
        });
        return;
      }
      const submission = {projectId:saved.id,revision:saved.revision,prompt:submittedPrompt,effort:selectedEffort,quote:estimate,autoApply};
      pendingSend.current = submission;
      accepted = await submitGeneration(submission);
      } finally {
        if (mounted.current) {
          setSending(null);
          if (!accepted && projectId.current === sendingProject) setPrompt(submittedPrompt);
        }
      }
    });
  }
  async function submitGeneration(submission: NonNullable<typeof pendingSend.current>) {
      const id = submission.projectId, estimate = submission.quote;
      // Remember the user's choice even when the start response is lost.
      if (submission.autoApply) autoApplyJobs.current.add(estimate.id);
      try {
        await request(`/projects/${id}/jobs`, { quoteId: estimate.id });
      } catch (reason) {
        if (reason instanceof StudioApiError && reason.status < 500 && reason.status !== 429)
          pendingSend.current = null;
        if (reason instanceof StudioApiError && reason.status === 402) {
          const current = await refreshAccount();
          setCreditGate({
            balanceMicroUsd: current.balanceMicroUsd,
            requiredMicroUsd: estimate.maximumMicroUsd,
          });
          return false;
        }
        throw reason;
      }
      pendingSend.current = null;
      if (!mounted.current || projectId.current !== id) return true;
      jobsVersion.current++;
      projectListVersion.current++;
      setProjects(old => old.map(item => item.id === id ? { ...item, active_job: {id: estimate.id, status: "queued"} } : item));
      setCreditGate(null);
      setPrompt("");
      setJobs(old => old.some(job => job.id === estimate.id) ? old : [{
        id: estimate.id, project_id: id, revision: submission.revision, prompt: submission.prompt,
        kind: "auto", status: "queued", effort: submission.effort, credit_exempt: estimate.creditExempt,
        charged_raw: "0", reserved_raw: "0", charged_micro_usd: null,
        reserved_micro_usd: estimate.maximumMicroUsd, created_at: Date.now(),
      }, ...old]);
      const version = jobsVersion.current;
      void request<StudioJob[]>(`/projects/${id}/jobs`).then(rows => {
        if (mounted.current && projectId.current === id && version === jobsVersion.current) setJobs(rows);
      }).catch(() => {});
      void refreshAccount().catch(() => {});
      void refreshProjects().catch(() => {});
      return true;
  }
  async function reviewJob(job: StudioJob) {
    await task("Loading changes", async () =>
      setReview(await request<StudioJob>(`/jobs/${job.id}`)),
    );
  }
  async function applyJobChanges(job: StudioJob, automatic = false) {
    if (!project || job.project_id !== project.id) return;
    if (automatic && (!autoApplyCurrent.current || dirty || job.revision !== project.revision)) {
      setReview(job);
      setNotice("Your project changed while Atlantis was working. Review the edits before applying them.");
      return;
    }
      const saved = await save();
      if (!saved) return;
      let updated: StudioProject;
      try {
        updated = await request<StudioProject>(`/projects/${saved.id}/apply`, {
          jobId: job.id,
          revision: saved.revision,
          autoApply: automatic,
        });
      } catch (reason) {
        setReview(job);
        throw reason;
      }
      if (!mounted.current || projectId.current !== saved.id) return;
      takeProject(updated);
      jobsVersion.current++;
      setJobs(old=>old.map(item=>item.id===job.id ? {...item,applied_at:Date.now()} : item));
      if (job.kind === "code" || job.kind === "image") {
        setWorkspaceOpen(true);
        setTab(job.kind === "code" ? "preview" : "assets");
      }
      setNotice("Changes applied. Your previous version is saved in History.");
      await refreshProjects();
  }
  async function applyChanges() {
    if (review) await task("Applying changes",()=>applyJobChanges(review));
  }
  useEffect(() => {
    if (!project || !state || busy || review || modal || creditGate || taskLock.current) return;
    const candidate = [...jobs].reverse().find(job=>job.status === "complete" && !job.applied_at && job.has_changes !== false && !handledResults.current.has(job.id));
    if (!candidate) return;
    handledResults.current.add(candidate.id);
    const id = project.id;
    void task("Checking changes",async()=>{
      const completed = await request<StudioJob>(`/jobs/${candidate.id}`);
      if (!mounted.current || projectId.current !== id || completed.applied_at || !studioChangeList(state,completed.result).length) return;
      if (autoApplyCurrent.current && autoApplyJobs.current.has(completed.id)) await applyJobChanges(completed,true);
      else setReview(completed);
    });
  }, [jobs,project,state,busy,review,modal,creditGate,autoApply]);
  async function uploadFiles(list: FileList | null) {
    if (!list) return;
    await task("Adding assets", async () => {
      const files: StudioFile[] = [];
      for (const f of Array.from(list)) {
        if (f.size > 3000000)
          throw new Error("Each upload must be under 3 MB.");
        const path = `frontend/assets/${f.name.replace(/[^a-zA-Z0-9_.-]/g, "-")}`;
        if (state?.files.find((item) => item.path === path))
          throw new Error(`${path} already exists. Rename the upload first.`);
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("Could not read file."));
          reader.readAsDataURL(f);
        });
        files.push({ path, content, encoding: "base64", locked: false });
      }
      edit((old) => ({ ...old, files: [...old.files, ...files] }));
      setTab("assets");
      setWorkspaceOpen(true);
      setNotice("Assets added. Save to keep them in your project.");
    });
    if (upload.current) upload.current.value = "";
  }
  const repositoryName = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^[^a-z0-9]+/, "")
      .slice(0, 100) || "my-memecoin";
  async function refreshGithub() {
    const connection = await accountRequest<{ github: GithubConnection }>(
      "/integrations",
      token,
    );
    if (mounted.current) setGithub(connection.github);
  }
  async function connectGithub() {
    await task("Connecting GitHub", async () => {
      const saved = await save();
      if (!mounted.current) return;
      sessionStorage.setItem(
        `aqua:studio-github-return:${wallet.address}`,
        JSON.stringify({
          projectId: saved?.id,
          modal: modal === "export" ? "export" : "github",
          repo,
          privateRepo,
        }),
      );
      const { url } = await accountRequest<{ url: string }>(
        "/integrations/github/connect",
        token,
        {},
      );
      if (mounted.current) location.assign(url);
    });
  }
  async function disconnectGithub() {
    await task("Disconnecting GitHub", async () => {
      const result = await accountRequest<{ revoked: boolean }>(
        "/integrations/github",
        token,
        undefined,
        "DELETE",
      );
      if (!mounted.current) return;
      setGithub((old) =>
        old
          ? { ...old, connected: false, login: null, connectedAt: null }
          : old,
      );
      setNotice(
        result.revoked
          ? "GitHub disconnected."
          : "Disconnected from AQUA. You can also revoke AQUA in your GitHub account settings.",
      );
    });
  }
  function openModal(value: Modal) {
    setInput("");
    setExportUrl("");
    setModal(value);
    if (value === "rename") setInput(selected);
    if (value === "export" && project) setRepo(repositoryName(project.name));
    if (value === "github" || value === "export") {
      void task("Loading GitHub connection", async () => {
        await refreshGithub();
        if (value === "export" && project) {
          const exports = await request<GithubExport[]>(
            `/projects/${project.id}/github`,
          );
          if (mounted.current) setGithubExports(exports);
        }
      });
    }
    if (value === "history" && project)
      void task("Loading history", async () =>
        setVersions(
          await request<Version[]>(`/projects/${project.id}/versions`),
        ),
      );
  }
  useEffect(() => {
    if (!projectMenu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (
        event instanceof PointerEvent &&
        (event.target as Element)?.closest("[data-project-menu]")
      )
        return;
      setProjectMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [projectMenu]);
  function showProjectMenu(
    value: Omit<StudioProject, "state">,
    button: HTMLElement,
  ) {
    const rect = button.getBoundingClientRect();
    setProjectMenu((old) =>
      old?.project.id === value.id
        ? null
        : {
            project: value,
            top: Math.min(rect.bottom + 5, window.innerHeight - 100),
            left: Math.max(
              10,
              Math.min(rect.right - 170, window.innerWidth - 180),
            ),
          },
    );
  }
  function projectAction(value: "renameproject" | "remove") {
    if (!projectMenu) return;
    setModalProject(projectMenu.project);
    setInput(projectMenu.project.name);
    setModal(value);
    setProjectMenu(null);
    setError("");
  }
  async function submitModal() {
    await task("Saving", async () => {
      if (modal === "project") {
        await save();
        const value = await request<StudioProject>("/projects", {
          name: input,
        });
        takeProject(value);
        setJobs([]);
        await refreshProjects();
      } else if (modal === "renameproject" && modalProject) {
        const current =
          modalProject.id === project?.id ? await save() : modalProject;
        if (!current) return;
        const renamed = await request<StudioProject>(
          `/projects/${current.id}/rename`,
          { name: input, revision: current.revision },
        );
        if (project?.id === renamed.id) takeProject(renamed);
        await refreshProjects();
      } else if (modal === "remove" && modalProject) {
        await request(`/projects/${modalProject.id}`, undefined, "DELETE");
        const selectedProject = modalProject.id === project?.id;
        if (selectedProject) {
          setProject(null);
          setState(null);
          projectId.current = null;
          setJobs([]);
        }
        const list = await refreshProjects();
        if (selectedProject && list[0]) await openProject(list[0].id);
      } else if (state && ["file", "folder", "rename"].includes(modal ?? "")) {
        const path = input.trim();
        if (
          !path ||
          path.startsWith("/") ||
          path.includes("\\") ||
          path
            .split("/")
            .some(
              (p) =>
                !p ||
                p === ".." ||
                p === "." ||
                p === ".git" ||
                p === "node_modules" ||
                (p.startsWith(".env") && p !== ".env.example"),
            ) ||
          /[\x00-\x1f<>:"|?*]/.test(path) ||
          path === "atlantis-launch.json"
        )
          throw new Error(
            "Use a relative path such as frontend/about.html. Secret env files cannot be stored here.",
          );
        if (
          state.files.some((f) => f.path === path) ||
          state.folders.includes(path)
        )
          throw new Error("That path already exists.");
        if (modal === "file")
          edit((old) => ({
            ...old,
            files: [
              ...old.files,
              { path, content: "", encoding: "utf8", locked: false },
            ],
          }));
        if (modal === "folder")
          edit((old) => ({ ...old, folders: [...old.folders, path] }));
        if (modal === "rename")
          edit((old) => ({
            ...old,
            launch: {
              ...old.launch,
              imagePath:
                old.launch.imagePath === selected ? path : old.launch.imagePath,
            },
            files: old.files.map((f) =>
              f.path === selected ? { ...f, path } : f,
            ),
          }));
        if (modal !== "folder") {
          setSelected(path);
          setTab("code");
        }
      }
      setModal(null);
    });
  }
  function openCredit() {
    setCreditGate(null);
    setDepositQuote(null);
    setInput("");
    setError("");
    setModal("credit");
    void refreshStudioConfig().catch(fail);
  }
  function keepDeposit(value: { id: string; signature: string } | null) {
    setPendingDeposit(value);
    if (value)
      localStorage.setItem(
        `aqua:studio-deposit:${wallet.address}`,
        JSON.stringify(value),
      );
    else localStorage.removeItem(`aqua:studio-deposit:${wallet.address}`);
  }
  useEffect(() => {
    if (!pendingDeposit || !token) {setDepositChecking(false);return;}
    let cancelled=false, attempts=0;
    let timer:ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const value = pendingDeposit;
    async function check() {
      setDepositChecking(true);
      let retry = true;
      try {
        const result = await studioRequest<{credited:boolean;creditMicroUsd:string|null}>(`/deposits/${value.id}/confirm`,token,{signature:value.signature,poll:true},undefined,controller.signal);
        if (cancelled) return;
        if (result.credited) {
          // Keep the saved reference until both crediting and account refresh succeed.
          const latest = await studioRequest<Account>("/account",token,undefined,undefined,controller.signal);
          if (cancelled) return;
          setAccount(latest);
          keepDeposit(null);
          setCreditGate(null);
          setDepositQuote(null);
          setModal(current => current === "credit" ? null : current);
          setNotice(result.creditMicroUsd != null ? `${usdCredit(result.creditMicroUsd)} added to your Studio credit.` : "Your previous deposit has been recorded. Check your credit balance.");
          retry=false;
        } else {
          setDepositStatus("Waiting for Solana finalization. Checking automatically; do not send another deposit.");
        }
      } catch (reason) {
        if (cancelled) return;
        // Compatibility with a backend still deploying the pending-status response.
        const pending = reason instanceof StudioApiError && reason.status === 409 && /awaiting finalization/i.test(reason.message);
        if (pending) setDepositStatus("Waiting for Solana finalization. Checking automatically; do not send another deposit.");
        else if (reason instanceof StudioApiError && reason.status < 500 && reason.status !== 429) {
          retry=false;
          setDepositStatus(reason.message);
          if (reason.status === 401) fail(reason);
        } else setDepositStatus("Confirmation service is temporarily unavailable. Your reference is saved and we’ll keep checking. Do not send another deposit.");
      } finally {
        if (!cancelled) {
          setDepositChecking(false);
          if (retry) timer=setTimeout(() => void check(),Math.min(30000,5000 * (1+Math.floor(attempts++/6))));
        }
      }
    }
    setDepositStatus("Waiting for Solana finalization. Checking automatically; do not send another deposit.");
    void check();
    return () => {cancelled=true;clearTimeout(timer);controller.abort();};
  }, [pendingDeposit?.id,pendingDeposit?.signature,token,depositRetry]);
  async function previewDeposit() {
    await task("Getting live AQUA price", async () => {
      setDepositQuote(null);
      const latest = await refreshStudioConfig();
      setConfig(latest);
      if (!latest.depositsEnabled || latest.decimals === null) {
        const issues = latest.depositSetup?.issues ?? [];
        throw new Error(issues.length ? issues.map(issue => `${issue.title}: ${issue.detail}`).join(" ") : "The backend has not returned valid deposit configuration. Deploy the matching Studio backend and check its /studio/config response.");
      }
      const tx = await request<DepositQuote>(
        "/deposits",
        { raw: aquaRaw(input, latest.decimals) },
      );
      setDepositQuote(tx);
    });
  }
  async function topUp() {
    await task("Waiting for wallet", async () => {
      const tx = depositQuote;
      if (!tx || Date.now() >= tx.expiresAt) {
        setDepositQuote(null);
        throw new Error("The deposit quote expired. Get a fresh price before approving.");
      }
      let submitted=false;
      try {
        await wallet.sendTransaction(tx, (signature) => {
          submitted=true;
          keepDeposit({ id: tx.id, signature });
        });
      } catch (reason) {
        if (!submitted) throw reason;
        // Submission succeeded; the saved signature is checked independently of
        // wallet confirmation timeouts. Never ask the user to submit it again.
      }
    });
  }
  async function exportZip(target: "frontend" | "backend") {
    await task("Preparing ZIP", async () => {
      const saved = await save();
      if (!saved) return;
      const response = await fetch(
        `${API_URL}/studio/projects/${saved.id}/zip?target=${target}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok)
        throw new Error("Could not export this project. Please retry.");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `${saved.name.replace(/[^a-zA-Z0-9_-]/g, "-")}-${target}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }
  async function exportGithub(target: "frontend" | "backend" | "all", resume?: GithubExport) {
    await task("Exporting to GitHub", async () => {
      let id = project?.id;
      try {
        const saved = await save();
        if (!saved) return;
        id = saved.id;
        const storageKey = `aqua:github-export:${wallet.address}:${id}:${target}`;
        const name = `${repo.trim()}${target === "all" ? "" : `-${target}`}`;
        let pending: {
          requestId: string;
          name: string;
          private: boolean;
          target: "frontend" | "backend" | "all";
        } | null = null;
        try {
          pending = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        } catch {
          /* A new intent will be created. */
        }
        const input = resume
          ? { requestId: resume.id, name: resume.name, private: resume.private, target }
          : pending?.name === name && pending.private === privateRepo && pending.target === target
            ? pending
            : {
                requestId: crypto.randomUUID(),
                name,
                private: privateRepo,
                target,
              };
        localStorage.setItem(storageKey, JSON.stringify(input));
        const result = await request<{ url: string }>(
          `/projects/${saved.id}/github`,
          input,
        );
        setExportUrl(result.url);
        localStorage.removeItem(storageKey);
      } finally {
        if (id)
          setGithubExports(
            await request<GithubExport[]>(`/projects/${id}/github`).catch(
              () => [],
            ),
          );
      }
    });
  }
  async function sendToRailway() {
    await task("Exporting backend to Railway", async () => {
      if (!project) return;
      let origin: URL;
      try { origin = new URL(railwayOrigin.trim()); } catch { throw new Error("Enter your deployed frontend origin, such as https://your-user.github.io."); }
      if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
        throw new Error("Use the frontend HTTPS origin only, without a page path or repository name.");
      const variables: Record<string,string> = { FRONTEND_ORIGIN:origin.origin };
      for (const line of railwayVariables.split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) throw new Error("Use KEY=value on each line for additional variables.");
        const value = match[2].trim();
        if (match[1] === "FRONTEND_ORIGIN" || match[1] === "PORT") throw new Error("Set the frontend origin above. Railway supplies PORT automatically.");
        variables[match[1]] = /^(["']).*\1$/.test(value) ? value.slice(1,-1) : value;
      }
      const selected = railwayExportId || githubExports.find(item => item.target === "backend" && item.status === "complete")?.id;
      if (!selected) throw new Error("Export the backend to GitHub first.");
      const result = await request<{url:string}>(`/projects/${project.id}/railway`, {exportId:selected,token:railwayToken.trim(),variables});
      setRailwayUrl(result.url); setRailwayToken(""); setRailwayVariables("");
      setNotice("Backend sent to Railway. Generate a public domain there, add it as API_BASE_URL in your frontend GitHub Variables, then run Publish website again.");
    });
  }
  const actionDisabled = Boolean(busy);
  const hasBackend = Boolean(state?.files.some(file => file.path.startsWith("backend/") && /(?:\.(?:m?js|ts)|\/package\.json)$/.test(file.path)));
  const exportTargets: Array<"frontend" | "backend"> = hasBackend ? ["frontend","backend"] : ["frontend"];
  const reviewChanges = state ? studioChangeList(state,review?.result) : [];
  const effortDetails = {
    low: "Quick drafts · Lowest cost",
    medium: "Stronger ideas, code and artwork · Higher cost",
    high: "Most capable models and detailed artwork · Highest cost",
  }[effort];
  const githubControls = (
    <div className="at-github-connection">
      <Github size={24} />
      {github?.connected ? (
        <>
          <p>
            Connected as <strong>{github.login}</strong>.
          </p>
          <p className="at-muted">
            Saved to this wallet for all your Studio projects.
          </p>
          <button
            disabled={actionDisabled}
            onClick={() => void disconnectGithub()}
          >
            Disconnect GitHub
          </button>
        </>
      ) : (
        <>
          <p>
            Connect GitHub to export Studio projects to new repositories. Your
            connection is saved to this wallet.
          </p>
          <button
            disabled={actionDisabled || !github?.enabled}
            onClick={() => void connectGithub()}
          >
            Connect GitHub
            <ArrowRight size={16} />
          </button>
          {github && !github.enabled && (
            <p className="at-muted">
              GitHub connection is not enabled yet. You can still export a ZIP.
            </p>
          )}
          <p className="at-muted">
            GitHub requests repository and workflow access to create your
            repositories and include deployment files.
          </p>
        </>
      )}
    </div>
  );
  const freeAccess = Boolean(config?.promotion?.active || account.creditExempt);
  const creditLabel = freeAccess ? "Free access" : `${usdCredit(account.balanceMicroUsd)} credit`;
  const coinImage = state?.files.find(item => item.path === state.launch.imagePath && imageFile(item));
  const setupIssues =
    config && !config.paidEnabled
      ? (config.setup?.issues ?? [
          {
            code: "configuration_unavailable",
            title: "AI payment setup is incomplete",
            detail: "Deploy the latest backend to see the exact missing settings.",
            variables: [] as string[],
          },
        ])
      : [];
  const creditShortfall =
    creditGate?.requiredMicroUsd &&
    BigInt(creditGate.requiredMicroUsd) > BigInt(creditGate.balanceMicroUsd)
      ? (BigInt(creditGate.requiredMicroUsd) - BigInt(creditGate.balanceMicroUsd)).toString()
      : null;
  return (
    <main className="at-studio">
      <PageBubbles count={8} />
      <header className="at-heading">
        <div>
          <h1>
            Atlantis<span>Studio</span>
          </h1>
          <p>Your memecoin, from idea to launch.</p>
        </div>
        <div className="at-heading-actions">
          {token ? (
            <>
              <button
                disabled={actionDisabled}
                onClick={() => openModal("github")}
                aria-label="GitHub connection"
              >
                <Github size={16} />
                GitHub
              </button>
              <button className="at-credit" onClick={openCredit}>
                {creditLabel}
                <Plus size={15} />
              </button>
            </>
          ) : null}
        </div>
      </header>
      {pendingDeposit && modal !== "credit" && <div className="at-notice" role="status">
        <span>{depositStatus}</span>{" "}<button onClick={openCredit}>View deposit</button>
      </div>}
      {error && (
        <div className="at-alert" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && !modal && (
        <div className="at-notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!token ? (
        <section className="at-locked-stage" aria-label="Connect wallet to open Atlantis Studio">
          <div className="at-locked-preview" aria-hidden="true" inert>
            <div className="at-studio-shell">
              <aside className="at-sidebar">
                <div className="at-locked-new" />
                <span className="at-sidebar-label">Projects</span>
                <nav><i /><i /><i /></nav>
              </aside>
              <div className="at-projectbar"><i /><span><i /><i /><i /></span></div>
              <div className="at-workspace">
                <section className="at-conversation"><div className="at-panel-title"><i /></div><div className="at-locked-chat"><i /><i /><i /></div><div className="at-locked-compose" /></section>
                <section className="at-canvas"><div className="at-tabs"><i /><i /><i /></div><div className="at-locked-canvas"><i /><i /></div></section>
              </div>
            </div>
          </div>
          <div className="at-entry-card at-access-card">
            <div className="at-entry-card-icon" aria-hidden="true"><Wallet size={25} /></div>
            <h2>{wallet.address ? "Opening your studio" : "Open Atlantis Studio"}</h2>
            <p>{wallet.address ? "Opening your saved projects. Future visits will open automatically while this login remains valid." : "Connect your Solana wallet to access your projects, artwork and websites."}</p>
            <button className="at-primary at-entry-continue" disabled={actionDisabled || Boolean(wallet.connecting)} onClick={() => wallet.address ? void signIn() : wallet.setModalOpen(true)}>
              {busy || wallet.connecting ? <><LoaderCircle size={17} className="at-spin" /> Opening Studio</> : wallet.address ? <>Try opening again<ArrowRight size={17} /></> : <>Connect wallet<ArrowRight size={17} /></>}
            </button>
            {wallet.address && <button className="at-entry-change" disabled={actionDisabled} onClick={() => void task("Changing wallet", async () => { await wallet.disconnect(); wallet.setModalOpen(true); })}>Use a different wallet</button>}
            <small className="at-entry-note"><LockKeyhole size={13} /> Your projects stay linked to your wallet.</small>
          </div>
        </section>
      ) : (
        <div className="at-studio-shell">
          <aside className="at-sidebar" aria-label="Studio navigation">
            <button
              className="at-new-project"
              disabled={actionDisabled}
              onClick={() => openModal("project")}
            >
              <Plus size={16} />
              New project
            </button>
            <span className="at-sidebar-label">Projects</span>
            {projectsLoading && !projects.length && <div className="at-projects-loading" role="status"><LoaderCircle size={15} className="at-spin" /> Loading projects</div>}
            <nav aria-label="Your projects">
              {projects.map((p) => (
                <div className="at-project-row" key={p.id}>
                  <button
                    className={project?.id === p.id ? "selected" : ""}
                    aria-current={project?.id === p.id ? "page" : undefined}
                    disabled={actionDisabled}
                    onClick={() =>
                      void task("Opening project", async () => {
                        await save();
                        await openProject(p.id);
                        setWorkspaceOpen(false);
                      })
                    }
                  >
                    <span className="at-project-label">{p.name}</span>
                    {(p.active_job || (p.id === project?.id && active) || p.id === sending?.projectId) && <span className="at-project-activity" role="status" aria-label={`${p.name} is working`} title="Keeps working when you leave Studio"><LoaderCircle size={14} className="at-spin" aria-hidden="true" /></span>}
                  </button>
                  <button
                    className="at-project-more"
                    data-project-menu
                    aria-label={`Options for ${p.name}`}
                    aria-haspopup="menu"
                    aria-expanded={projectMenu?.project.id === p.id}
                    disabled={actionDisabled}
                    onClick={(e) => showProjectMenu(p, e.currentTarget)}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
              ))}
            </nav>
            {project && (
              <>
                <span className="at-sidebar-label">This project</span>
                <nav aria-label="Project workspace">
                  <button
                    className={!workspaceOpen ? "selected" : ""}
                    onClick={() => {
                      setWorkspaceOpen(false);
                    }}
                  >
                    <Send size={15} />
                    Chat with Atlantis
                  </button>
                  {(
                    [
                      ["preview", "Website preview"],
                      ["details", "Launch details"],
                      ["assets", "Images & assets"],
                      ["code", "Code & files"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={
                        workspaceOpen && tab === value ? "selected" : ""
                      }
                      onClick={() => {
                        setTab(value);
                        setWorkspaceOpen(true);
                      }}
                    >
                      {value === "preview" ? (
                        <Monitor size={15} />
                      ) : value === "details" ? (
                        <FilePlus2 size={15} />
                      ) : value === "assets" ? (
                        <ImagePlus size={15} />
                      ) : (
                        <Code2 size={15} />
                      )}
                      {label}
                    </button>
                  ))}
                </nav>
              </>
            )}
            <div className="at-sidebar-credit">
              <Droplets size={17} />
              <div>
                <small>Studio credit</small>
                <strong>{creditLabel}</strong>
              </div>
              <button
                onClick={() => {
                  if (config?.paidEnabled) openCredit();
                  else {
                    setWorkspaceOpen(false);
                    setError("AI setup is incomplete. Review the checklist in chat.");
                  }
                }}
              >
                {config?.paidEnabled ? "Add" : "Setup"}
              </button>
            </div>
          </aside>
          <div className="at-projectbar">
            <div>
              <strong className="at-project-name">
                {project?.name ?? "Your studio"}
              </strong>
              {project && (
                <button
                  className="at-mobile-project-menu"
                  data-project-menu
                  aria-label="Project options"
                  aria-haspopup="menu"
                  onClick={(e) => showProjectMenu(project, e.currentTarget)}
                >
                  <MoreHorizontal size={17} />
                </button>
              )}
              <select
                className="at-mobile-projects"
                aria-label="Choose project"
                value={project?.id ?? ""}
                disabled={actionDisabled}
                onChange={(e) =>
                  void task("Opening project", async () => {
                    await save();
                    await openProject(e.target.value);
                  })
                }
              >
                <option value="" disabled>
                  Your projects
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.active_job || (p.id === project?.id && active) || p.id === sending?.projectId ? " · Working" : ""}
                  </option>
                ))}
              </select>
              <button
                className="at-mobile-new"
                title="New project"
                aria-label="New project"
                disabled={actionDisabled}
                onClick={() => openModal("project")}
              >
                <Plus size={17} />
              </button>
            </div>
            {project && (
              <div>
                <span className="at-save-state">
                  {busy || (dirty ? "Unsaved changes" : "All changes saved")}
                </span>
                <button
                  title="Version history"
                  aria-label="Version history"
                  disabled={actionDisabled}
                  onClick={() => openModal("history")}
                >
                  <History size={17} />
                </button>
                <button
                  disabled={actionDisabled || !dirty}
                  onClick={() =>
                    void task("Saving", async () => {
                      await save();
                    })
                  }
                >
                  <Save size={16} />
                  <span>Save</span>
                </button>
                <button
                  disabled={actionDisabled}
                  onClick={() => openModal("export")}
                >
                  <Download size={16} />
                  <span>Export</span>
                </button>
                <button
                  className="at-primary"
                  disabled={actionDisabled}
                  onClick={() =>
                    void task("Preparing launch", async () => {
                      const saved = await save();
                      if (saved) navigate(`/create?studio=${saved.id}`);
                    })
                  }
                >
                  Review launch
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
          {project && (
            <nav className="at-mobile-tools" aria-label="Studio tools">
              <button
                className={!workspaceOpen ? "selected" : ""}
                onClick={() => setWorkspaceOpen(false)}
              >
                Chat
              </button>
              {(
                [
                  ["preview", "Website"],
                  ["details", "Launch details"],
                  ["code", "Code"],
                  ["assets", "Assets"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={workspaceOpen && tab === value ? "selected" : ""}
                  onClick={() => {
                    setTab(value);
                    setWorkspaceOpen(true);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          {!project ? (
            <div className="at-empty">
              {projectsLoading ? <div className="at-projects-loading" role="status"><LoaderCircle size={22} className="at-spin" /> Opening your studio</div> : <>
              <h2>What are you launching?</h2>
              <p>
                Start a project to work on your memecoin’s name, artwork,
                website and launch details together.
              </p>
              <button
                className="at-primary"
                disabled={actionDisabled}
                onClick={() => openModal("project")}
              >
                Create a project <Plus size={16} />
              </button>
              </>}
            </div>
          ) : (
            <div
              className={`at-workspace ${workspaceOpen ? "at-tool-only" : "at-chat-only"}`}
            >
              {!workspaceOpen && (
                <aside className="at-conversation">
                  <div className="at-panel-title">
                    <div>Atlantis</div>
                    <small>{active ? "Runs in the background" : "Memecoin studio"}</small>
                  </div>
                  {workingProject && workingProject.id !== project.id && <div className="at-other-project" role="status">
                    <LoaderCircle size={16} className="at-spin" aria-hidden="true" />
                    <span><strong>{workingProject.name}</strong> is working. You can run one project at a time.</span>
                    <button disabled={actionDisabled} onClick={() => void task("Opening project", async () => { await save(); await openProject(workingProject.id); })}>View <ArrowRight size={14} /></button>
                  </div>}
                  <div className="at-messages" ref={messages}>
                    {setupIssues.length > 0 && (
                      <StudioSetupCard
                        issues={setupIssues}
                        busy={actionDisabled}
                        onRetry={() => void checkStudioSetup()}
                      />
                    )}
                    {!jobs.length && !visibleSending && setupIssues.length === 0 && (
                      <div className="at-intro-message">
                        <h3>What’s your memecoin idea?</h3>
                        <p>
                          Start with a joke, a character, or a rough idea. We’ll
                          make it your own.
                        </p>
                        {[
                          "Help me find a memorable meme concept.",
                          "Which pair and reward mode fit my coin?",
                          "Build a website with custom artwork and animation.",
                        ].map((text) => (
                          <button
                            key={text}
                            onClick={() => {
                              setPrompt(text);
                            }}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                    {[...jobs].reverse().map((job) => (
                      <article className="at-message" key={job.id}>
                        <div className="at-user-message">{job.prompt}</div>
                        <div className="at-answer">
                          <span className="at-eyebrow">
                            ATLANTIS {job.kind === "image" ? "/ ARTWORK" : ""}
                          </span>
                          {job.status === "complete" ? (
                            <>
                              <StudioMessage
                                text={job.message ?? "Your result is ready."}
                              />
                              <div className="at-message-actions">
                                {job.has_changes !== false && !job.applied_at && <button
                                  disabled={actionDisabled}
                                  onClick={() => void reviewJob(job)}
                                >
                                  Review changes <ArrowRight size={13} />
                                </button>}
                                {job.applied_at && <small>Changes applied</small>}
                                <small>
                                  {job.charged_micro_usd != null ? `${usdCredit(job.charged_micro_usd)} used` : decimals !== null ? `${aquaAmount(job.charged_raw, decimals)} AQUA (legacy)` : "Legacy usage"}
                                </small>
                              </div>
                            </>
                          ) : job.status === "failed" ? (
                            <><p className="at-failed">{job.error}</p><div className="at-message-actions"><button disabled={actionDisabled || generationBusy || Boolean(review) || Boolean(prompt.trim())} title={prompt.trim() ? "Send or clear your current draft before retrying" : "Retry this prompt with the same effort"} onClick={() => void sendMessage({prompt:job.prompt,effort:job.effort})}><RefreshCw size={13} /> Retry request</button></div></>
                          ) : (
                            <StudioWorking label={job.progress ?? (job.status === "queued" ? "Queued" : "Thinking")} />
                          )}
                        </div>
                      </article>
                    ))}
                    {visibleSending && <article className="at-message at-pending-message">
                      <div className="at-user-message">{visibleSending.prompt}</div>
                      <div className="at-answer"><span className="at-eyebrow">ATLANTIS</span><StudioWorking label="Sending your message" /></div>
                    </article>}
                  </div>
                  <div className="at-composer-area">
                  <div className="at-compose">
                    <textarea
                      ref={composerInput}
                      aria-label="Message Atlantis"
                      placeholder="What do you want to create?"
                      value={prompt}
                      readOnly={actionDisabled}
                      maxLength={12000}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        setCreditGate(null);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key !== "Enter" ||
                          e.shiftKey ||
                          e.nativeEvent.isComposing ||
                          e.nativeEvent.keyCode === 229
                        ) return;
                        e.preventDefault();
                        if (!e.repeat) void sendMessage();
                      }}
                      rows={1}
                    />
                      <div className="at-compose-footer">
                        <div className="at-compose-settings">
                          <label className="at-effort-picker" title={effortDetails}>
                            <Gauge className="at-effort-icon" size={14} aria-hidden="true" />
                            <select aria-label="AI effort" aria-description={effortDetails} value={effort} disabled={actionDisabled || generationBusy} onChange={e=>{setEffort(e.target.value as typeof effort);setCreditGate(null);}}>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                            <ChevronDown size={13} aria-hidden="true" />
                          </label>
                          <label className="at-auto-apply" title="Apply generated project edits without asking. Never launches, publishes, or signs wallet transactions.">
                            <input type="checkbox" role="switch" aria-label="Auto-apply edits" checked={autoApply} disabled={actionDisabled} onChange={e=>setAutoApply(e.target.checked)} />
                            <span>Auto-apply</span>
                          </label>
                        </div>
                        <button
                          className="at-primary at-send-message"
                          aria-label="Send message"
                          title="Send message (Enter)"
                          disabled={
                            !prompt.trim() ||
                            actionDisabled ||
                            generationBusy
                          }
                          onClick={() => void sendMessage()}
                        >
                          <ArrowUp size={19} strokeWidth={2} />
                        </button>
                      </div>
                  </div>
                  <div className="at-composer-hint">
                    <span>Uses credits · Actual usage only</span>
                  </div>
                  </div>
                </aside>
              )}
              {workspaceOpen && (
                <section className="at-canvas">
                  <div className="at-tabs">
                    <strong className="at-tool-title">
                      {
                        {
                          preview: "Website preview",
                          details: "Launch details",
                          code: "Code & files",
                          assets: "Images & assets",
                        }[tab]
                      }
                    </strong>
                    {tab === "preview" && (
                      <div>
                        <button
                          aria-label="Desktop preview"
                          aria-pressed={!mobile}
                          onClick={() => setMobile(false)}
                        >
                          <Monitor size={16} />
                        </button>
                        <button
                          aria-label="Mobile preview"
                          aria-pressed={mobile}
                          onClick={() => setMobile(true)}
                        >
                          <Smartphone size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {tab === "preview" && (
                    <>
                      <div className={`at-preview ${mobile ? "mobile" : ""}`}>
                        {blankWebsite ? (
                          <div className="at-blank-preview">
                            <h3>Your website starts here.</h3>
                            <p>
                              Describe your memecoin and the look you want.
                              Atlantis can create the artwork and build the site
                              together.
                            </p>
                            <button
                              onClick={() => {
                                setWorkspaceOpen(false);
                              }}
                            >
                              Describe your website
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        ) : (
                          <StudioSitePreview key={project?.id} files={state?.files ?? []}/>
                        )}
                      </div>
                      <div className="at-preview-footer">
                        Static frontend preview
                        <span>
                          External requests and backend execution are disabled
                        </span>
                      </div>
                    </>
                  )}
                  {tab === "details" && state && (
                    <div className="at-details">
                      <div className="at-section-heading">
                        <span className="at-eyebrow">LAUNCH DRAFT</span>
                        <h2>The details make it yours.</h2>
                        <p>
                          Everything stays editable until you review and sign
                          your launch.
                        </p>
                      </div>
                      <div className="at-coin-identity">
                        <div className="at-coin-icon">{coinImage ? <img src={studioAssetUrl(coinImage)} alt={`${state.launch.name || "Your coin"} icon`} /> : <ImagePlus size={28} aria-hidden="true" />}</div>
                        <div><strong>{state.launch.name || "Your coin"}</strong><small>{state.launch.symbol ? `$${state.launch.symbol}` : "Add your coin name and ticker below"}</small>
                          <button onClick={() => { setTab("assets"); setWorkspaceOpen(true); }}><ImagePlus size={14} /> {coinImage ? "Change icon" : "Choose coin icon"}</button>
                        </div>
                      </div>
                      <label className="at-field">
                        Project name
                        <input
                          value={state.name}
                          maxLength={80}
                          onChange={(e) =>
                            edit((old) => ({ ...old, name: e.target.value }))
                          }
                        />
                      </label>
                      <div className="at-field-grid">
                        {(
                          [
                            ["name", "Coin name", 32],
                            ["symbol", "Ticker", 10],
                          ] as const
                        ).map(([key, label, max]) => (
                          <Field
                            key={key}
                            label={label}
                            locked={state.lockedFields.includes(key)}
                            onLock={() => lockField(key)}
                          >
                            <input
                              maxLength={max}
                              value={state.launch[key]}
                              onChange={(e) =>
                                launchField(
                                  key,
                                  key === "symbol"
                                    ? e.target.value
                                        .replace(/[^a-zA-Z0-9]/g, "")
                                        .toUpperCase()
                                    : e.target.value,
                                )
                              }
                            />
                          </Field>
                        ))}
                      </div>
                      <Field
                        label="Description"
                        locked={state.lockedFields.includes("description")}
                        onLock={() => lockField("description")}
                      >
                        <textarea
                          maxLength={500}
                          rows={3}
                          value={state.launch.description}
                          onChange={(e) =>
                            launchField("description", e.target.value)
                          }
                        />
                      </Field>
                      <div className="at-field-grid">
                        <Field
                          label="Pair asset"
                          locked={state.lockedFields.includes("stockMint")}
                          onLock={() => lockField("stockMint")}
                        >
                          <select
                            value={state.launch.stockMint}
                            onChange={(e) =>
                              launchField("stockMint", e.target.value)
                            }
                          >
                            <option value="">Choose at launch</option>
                            {config?.knowledge.pairs.map((pair) => (
                              <option key={pair.mint} value={pair.mint}>
                                {pair.symbol} · {pair.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Reward mode"
                          locked={state.lockedFields.includes("rewardMode")}
                          onLock={() => lockField("rewardMode")}
                        >
                          <select
                            value={state.launch.rewardMode}
                            onChange={(e) =>
                              launchField(
                                "rewardMode",
                                e.target.value as StudioLaunch["rewardMode"],
                              )
                            }
                          >
                            <option value="holder_rewards">
                              Holder rewards
                            </option>
                            <option
                              value="buyback_burn"
                              disabled={!config?.knowledge.burn}
                            >
                              Buyback & burn
                            </option>
                            <option
                              value="jackpot"
                              disabled={!config?.knowledge.jackpot}
                            >
                              Hourly jackpot
                            </option>
                          </select>
                        </Field>
                      </div>
                      {(
                        [
                          ["websiteUrl", "Website"],
                          ["xUrl", "X / Twitter"],
                          ["telegramUrl", "Telegram"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field
                          key={key}
                          label={label}
                          locked={state.lockedFields.includes(key)}
                          onLock={() => lockField(key)}
                        >
                          <input
                            type="url"
                            placeholder="https://"
                            maxLength={300}
                            value={state.launch[key]}
                            onChange={(e) => launchField(key, e.target.value)}
                          />
                        </Field>
                      ))}
                      {config?.knowledge.governance && (
                        <>
                          <div className="at-section-heading">
                            <span className="at-eyebrow">DEX SCREENER</span>
                            <h3>Prepare your profile.</h3>
                            <p>
                              This is a draft. AQUA’s holder vote and funding
                              process still apply.
                            </p>
                          </div>
                          <Field
                            label="DEX funding"
                            locked={state.lockedFields.includes(
                              "dexFundingEnabled",
                            )}
                            onLock={() => lockField("dexFundingEnabled")}
                          >
                            <label className="at-check">
                              <input
                                type="checkbox"
                                checked={state.launch.dexFundingEnabled}
                                onChange={(e) =>
                                  launchField(
                                    "dexFundingEnabled",
                                    e.target.checked,
                                  )
                                }
                              />
                              Enable DEX Funding Mode at launch
                            </label>
                          </Field>
                          <Field
                            label="Profile details"
                            locked={state.lockedFields.includes("dexProfile")}
                            onLock={() => lockField("dexProfile")}
                          >
                            <DexProfileFields
                              optional
                              profile={state.launch.dexProfile}
                              update={(key, value) =>
                                launchField("dexProfile", {
                                  ...state.launch.dexProfile,
                                  [key]: value,
                                })
                              }
                            />
                          </Field>
                        </>
                      )}
                    </div>
                  )}
                  {tab === "code" && state && (
                    <div className="at-code">
                      <aside className="at-files">
                        <div>
                          <small>EXPLORER</small>
                          <button
                            aria-label="New file"
                            title="New file"
                            onClick={() => openModal("file")}
                          >
                            <FilePlus2 size={15} />
                          </button>
                          <button
                            aria-label="New folder"
                            title="New folder"
                            onClick={() => openModal("folder")}
                          >
                            <FolderPlus size={15} />
                          </button>
                          <button
                            aria-label="Upload files"
                            title="Upload files"
                            onClick={() => upload.current?.click()}
                          >
                            <Upload size={15} />
                          </button>
                        </div>
                        <FileTree
                          files={state.files}
                          folders={state.folders}
                          selected={selected}
                          onSelect={setSelected}
                        />
                      </aside>
                      <section className="at-code-main">
                        {file ? (
                          <>
                            <div className="at-filebar">
                              <span title={file.path}>{file.path}</span>
                              <button
                                title={
                                  file.locked
                                    ? "Allow AI edits"
                                    : "Keep this file unchanged by AI"
                                }
                                aria-label={
                                  file.locked ? "Unlock file" : "Lock file"
                                }
                                onClick={() =>
                                  edit((old) => ({
                                    ...old,
                                    files: old.files.map((f) =>
                                      f.path === file.path
                                        ? { ...f, locked: !f.locked }
                                        : f,
                                    ),
                                  }))
                                }
                              >
                                {file.locked ? (
                                  <LockKeyhole size={14} />
                                ) : (
                                  <Unlock size={14} />
                                )}
                              </button>
                              <button onClick={() => openModal("rename")}>
                                Rename
                              </button>
                              <button
                                aria-label="Delete file"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Remove ${file.path}? Save history lets you restore it.`,
                                    )
                                  )
                                    edit((old) => ({
                                      ...old,
                                      files: old.files.filter(
                                        (f) => f.path !== file.path,
                                      ),
                                    }));
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {file.encoding === "utf8" ? (
                              <Suspense
                                fallback={
                                  <div className="at-editor-loading">
                                    Opening editor…
                                  </div>
                                }
                              >
                                <Editor
                                  file={file}
                                  onChange={(content) =>
                                    edit((old) => ({
                                      ...old,
                                      files: old.files.map((f) =>
                                        f.path === file.path
                                          ? { ...f, content }
                                          : f,
                                      ),
                                    }))
                                  }
                                />
                              </Suspense>
                            ) : (
                              <div className="at-binary">
                                {imageFile(file) ? (
                                  <img
                                    src={studioAssetUrl(file)}
                                    alt={file.path}
                                  />
                                ) : (
                                  <p>
                                    Binary asset ·{" "}
                                    {Math.round(
                                      (file.content.length * 0.75) / 1024,
                                    )}{" "}
                                    KB
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="at-empty">
                            Choose a file from the explorer.
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                  {tab === "assets" && state && (
                    <div className="at-assets">
                      <div className="at-section-heading">
                        <span className="at-eyebrow">YOUR ASSETS</span>
                        <h2>A world of your own.</h2>
                        <p>
                          Create artwork with Atlantis or upload your own files.
                          Each file can be up to 3 MB.
                        </p>
                        <button onClick={() => upload.current?.click()}>
                          <ImagePlus size={16} />
                          Upload assets
                        </button>
                      </div>
                      <div className="at-asset-grid">
                        {state.files
                          .filter(
                            (f) => f.encoding === "base64" || imageFile(f),
                          )
                          .map((f) => (
                            <article key={f.path}>
                              {imageFile(f) ? (
                                <img
                                  src={studioAssetUrl(f)}
                                  alt={f.path.split("/").pop()}
                                />
                              ) : (
                                <div className="at-asset-generic">
                                  <Code2 />
                                </div>
                              )}
                              <strong title={f.path}>
                                {f.path.split("/").pop()}
                              </strong>
                              <div>
                                {f.encoding === "base64" &&
                                  /\.(png|jpe?g|webp|gif)$/i.test(f.path) && (
                                    <button
                                      className={
                                        state.launch.imagePath === f.path
                                          ? "selected"
                                          : ""
                                      }
                                      onClick={() =>
                                        launchField("imagePath", f.path)
                                      }
                                    >
                                      {state.launch.imagePath === f.path ? (
                                        <>
                                          <Check size={13} />
                                          Coin image
                                        </>
                                      ) : (
                                        "Use as coin image"
                                      )}
                                    </button>
                                  )}
                                <button
                                  aria-label={`Open ${f.path}`}
                                  onClick={() => {
                                    setSelected(f.path);
                                    setTab("code");
                                  }}
                                >
                                  <ArrowRight size={14} />
                                </button>
                              </div>
                            </article>
                          ))}
                      </div>
                      {!state.files.some((f) => f.encoding === "base64") && (
                        <div className="at-asset-empty">
                          Ask Atlantis to create your first coin image, or drop
                          in your own with Upload assets.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
      <input
        ref={upload}
        type="file"
        multiple
        hidden
        onChange={(e) => void uploadFiles(e.target.files)}
      />
      {projectMenu && (
        <div
          className="at-project-dropdown"
          data-project-menu
          role="menu"
          aria-label="Project actions"
          style={{
            position: "fixed",
            top: projectMenu.top,
            left: projectMenu.left,
          }}
        >
          <button
            role="menuitem"
            autoFocus
            onClick={() => projectAction("renameproject")}
          >
            <Pencil size={15} aria-hidden="true" /> Rename project
          </button>
          <button
            role="menuitem"
            className="at-project-delete"
            disabled={Boolean(projects.find(item => item.id === projectMenu.project.id)?.active_job) || (projectMenu.project.id === project?.id && active)}
            onClick={() => projectAction("remove")}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete project
          </button>
        </div>
      )}
      {creditGate && !modal && !review && (
        <Dialog title="Not enough credits" className="at-credit-dialog" onClose={() => setCreditGate(null)}>
          <div className="at-credit-popup-icon" aria-hidden="true"><Droplets size={28} /></div>
          <p>Top up your Studio wallet with AQUA to continue. Your message will stay in the chat box. Send it again when you’re ready.</p>
          <dl className="at-credit-summary">
            <div><dt>Available credit</dt><dd>{usdCredit(creditGate.balanceMicroUsd)}</dd></div>
            {creditShortfall && <div><dt>Top up at least</dt><dd>{usdCredit(creditShortfall,"up")}</dd></div>}
          </dl>
          <div className="at-credit-popup-actions">
            <button onClick={() => setCreditGate(null)}>Not now</button>
            <button className="at-primary" onClick={openCredit}>Top up wallet <ArrowRight size={16} /></button>
          </div>
        </Dialog>
      )}
      {review && (
        <Dialog title="Apply these changes?" className="at-changes-dialog" onClose={() => { if (!taskLock.current) setReview(null); }}>
          <p>Atlantis has finished. {reviewChanges.length ? "Review the proposed edits below. Nothing has been changed yet." : "There are no new unlocked changes to apply."}</p>
          {error && <p className="at-review-warning">{error}</p>}
          {dirty && <p className="at-review-warning">You have unsaved edits. Applying this result can replace edits to the same files or fields.</p>}
          {review.revision !== undefined && project?.revision !== review.revision && <p className="at-review-warning">This result was created from an older project version. Check it against your latest work before applying.</p>}
          <ul className="at-change-summary">
            {reviewChanges.map(change=><li key={change.key}><strong>{change.label}</strong><span>{change.detail}</span></li>)}
          </ul>
          <details className="at-change-detail"><summary>Inspect proposed content</summary>
          {Object.keys(review.result?.launch ?? {}).length > 0 && (
            <div className="at-change-list">
              <h4>Launch details</h4>
              {Object.entries(review.result?.launch ?? {}).map(
                ([key, value]) => (
                  <div key={key}>
                    <strong>
                      {key}
                      {state?.lockedFields.includes(
                        key as keyof StudioLaunch,
                      ) && " · kept unchanged"}
                    </strong>
                    <pre>
                      {typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </pre>
                  </div>
                ),
              )}
            </div>
          )}
          {review.result?.files.map((f) => (
            <details className="at-review-file" key={f.path}>
              <summary>
                {f.path}
                {state?.files.find((old) => old.path === f.path)?.locked
                  ? " · kept unchanged"
                  : " · updated"}
              </summary>
              {f.encoding === "base64" && imageFile(f) ? (
                <img src={studioAssetUrl(f)} alt="Generated artwork" />
              ) : (
                <pre>
                  {f.encoding === "base64" ? "Binary asset" : f.content}
                </pre>
              )}
            </details>
          ))}
          {review.result?.deletePaths.map((path) => (
            <p key={path}>
              Remove: {path}
              {state?.files.find((f) => f.path === path)?.locked
                ? " (locked; will be kept)"
                : ""}
            </p>
          ))}
          </details>
          <p className="at-muted">
            Review the proposed files before applying. Locked details and files
            are preserved. History keeps your previous version.
          </p>
          <label className="at-auto-apply at-review-auto"><input type="checkbox" role="switch" checked={autoApply} disabled={actionDisabled} onChange={e=>setAutoApply(e.target.checked)} /><span>Auto-apply future edits without asking</span></label>
          <small className="at-muted">Only project edits. Launches, exports and wallet transactions still need your approval.</small>
          <div className="at-change-actions">
          <button disabled={actionDisabled} onClick={()=>setReview(null)}>Not now</button>
          <button
            className="at-primary"
            disabled={
              actionDisabled ||
              !review.result || !reviewChanges.length || Boolean(review.applied_at)
            }
            onClick={() => void applyChanges()}
          >
            Apply changes
            <Check size={16} />
          </button>
          </div>
        </Dialog>
      )}
      {modal && (
        <Dialog
          title={
            {
              credit: "Your Studio credit",
              export: "Take your project with you",
              github: "GitHub connection",
              history: "Project history",
              project: "Create a project",
              file: "Add a file",
              folder: "Add a folder",
              rename: "Rename file",
              renameproject: "Rename project",
              remove: "Delete project",
            }[modal]
          }
          onClose={() => {
            if (!busy) {
              setModal(null);
            }
          }}
        >
          {error && (
            <p className="at-modal-error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <p role="status" className="at-muted">
              {busy}…
            </p>
          )}
          {notice && (modal === "github" || modal === "export") && (
            <p className="at-notice" role="status">
              {notice}
            </p>
          )}
          {modal === "github" ? (
            githubControls
          ) : modal === "credit" ? (
            <>
              <div className="at-balance">
                <small>AVAILABLE TO SPEND</small>
                <strong>{creditLabel}</strong>
              </div>
              <p className="at-muted">
                AQUA is valued in USD at deposit time. That value becomes prepaid
                Studio credit and stays fixed when AQUA’s price changes. AI requests
                deduct their USD usage cost. Credit is not withdrawable.
              </p>
              {account.legacyBalanceNotice && <p role="status" className="at-muted">{account.legacyBalanceNotice}</p>}
              {(configChecking && !config?.depositsEnabled) ? (
                <p className="at-muted" role="status">Checking AQUA deposits and live price…</p>
              ) : config?.depositsEnabled ? (
                <>
                  <label className="at-field">
                    AQUA to deposit
                    <input
                      inputMode="decimal"
                      value={input}
                      placeholder="0.00"
                      onChange={(e) => {setInput(e.target.value);setDepositQuote(null);}}
                    />
                  </label>
                  <button
                    className="at-primary"
                    disabled={actionDisabled || Boolean(pendingDeposit)}
                    onClick={() => void previewDeposit()}
                  >
                    {depositQuote ? "Refresh price" : "Preview USD credit"}
                    <ArrowRight size={16} />
                  </button>
                  {depositQuote && <div className="at-pending" role="status">
                    <strong>Up to {usdCredit(depositQuote.maximumCreditMicroUsd)} of credit</strong>
                    <p>1 AQUA = ${depositQuote.price.usdPrice}. Any token transfer fee reduces the amount credited. The final credit uses the AQUA actually received.</p>
                    <small>This live price is locked for this transaction only. Approve promptly; expired transactions need a new quote.</small>
                    <button className="at-primary" disabled={actionDisabled || Boolean(pendingDeposit)} onClick={() => void topUp()}>Confirm deposit in wallet</button>
                  </div>}
                  <p className="at-muted">
                    Your wallet will show the transfer and SOL network fee
                    before you approve.
                  </p>
                </>
              ) : (
                <StudioSetupCard
                  compact
                  deposits
                  issues={config?.depositSetup?.issues ?? (setupIssues.length ? setupIssues : [{code:"deposit_config_unavailable",title:"Deposit settings could not be loaded",detail:error || "Check the backend connection and try again.",variables:["VITE_API_URL"]}])}
                  busy={actionDisabled}
                  onRetry={() => void checkStudioSetup()}
                />
              )}
              {pendingDeposit && (
                <div className="at-pending" role="status">
                  <strong>Deposit submitted</strong>
                  <p>{depositStatus}</p>
                  <code>{pendingDeposit.signature}</code>
                  <button
                    disabled={actionDisabled || depositChecking || !token}
                    onClick={() => setDepositRetry(value => value+1)}
                  >
                    {depositChecking ? "Checking confirmation…" : "Check now"}
                  </button>
                </div>
              )}
              <h4>Recent activity</h4>
              <div className="at-ledger">
                {account.ledger.map((row) => (
                  <div key={row.id}>
                    <span>
                      {{deposit:"Deposit",reserve:"Reserved for AI",settlement:"Unused credit returned",refund:"Reservation refunded",legacy_conversion:"Previous credit converted"}[row.kind] ?? row.kind}
                      <small>
                        {new Date(Number(row.created_at)).toLocaleString()}
                      </small>
                    </span>
                    <strong>{row.amount_micro_usd != null ? usdCredit(row.amount_micro_usd) : `${aquaAmount(row.amount_raw, decimals)} AQUA (legacy)`}</strong>
                  </div>
                ))}
                {!account.ledger.length && (
                  <p className="at-muted">
                    Your deposits and usage will appear here.
                  </p>
                )}
              </div>
            </>
          ) : modal === "export" ? (
            <>
              <p>
                {hasBackend ? "Export your website and backend as separate projects." : "This website runs entirely on the frontend."} Each download includes its setup steps.
              </p>
              <div className="at-export-actions">
                <button disabled={actionDisabled} onClick={() => void exportZip("frontend")}><Download size={16} /> Frontend ZIP</button>
                {hasBackend && <button disabled={actionDisabled} onClick={() => void exportZip("backend")}><Download size={16} /> Backend ZIP</button>}
              </div>
              <details className="at-export-setup" open>
                <summary>GitHub setup and frontend variables</summary>
                <StudioMessage text={state?.files.find(file => file.path === "frontend/README.md")?.content.split("## Local or ZIP setup")[0].replace(/^# Publish your website\s*/, "") ?? "1. Export the frontend to GitHub.\n2. Choose GitHub Actions in Settings → Pages.\n3. Run Actions → Publish website.\n\nAsk Atlantis to add TOKEN_CA as a frontend variable if this older project does not have public-env.json and scripts/configure.mjs yet."} />
              </details>
              {hasBackend && <details className="at-export-setup">
                <summary>Backend setup</summary>
                <StudioMessage text={state?.files.find(file => file.path === "backend/README.md")?.content ?? "Open backend/.env.example for your project's variables. Set FRONTEND_ORIGIN to your frontend HTTPS origin. Railway supplies PORT. Ask Atlantis to update this older project's backend setup guide for any additional variables."} />
              </details>}
              <hr />
              <h3>Export to GitHub</h3>
              {github?.connected ? (
                <div className="at-export-connection">
                  <span><Github size={18} /> Connected as <strong>{github.login}</strong></span>
                  <button disabled={actionDisabled} onClick={() => void disconnectGithub()}>Disconnect</button>
                </div>
              ) : githubControls}
              {github?.connected && (
                <>
                  <p className="at-muted">
                    {hasBackend ? "Create one repository for each component." : "Create a repository for your website."} Follow the setup steps above to publish it.
                  </p>
                  <label className="at-field">
                    Project name
                    <input
                      placeholder="my-memecoin"
                      maxLength={90}
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                    />
                  </label>
                  <label className="at-field">
                    Visibility
                    <select
                      value={privateRepo ? "private" : "public"}
                      onChange={(e) =>
                        setPrivateRepo(e.target.value === "private")
                      }
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </label>
                  <p className="at-muted">
                    {privateRepo
                      ? "Only you and people you grant access can see this repository. GitHub Pages from a private repository may require a paid GitHub plan."
                      : "Anyone will be able to view the exported files. Public repositories can use GitHub Pages on GitHub Free."}
                  </p>
                  <p className="at-muted">{exportTargets.map(target => `${repo || "my-memecoin"}-${target}`).join(" · ")}</p>
                  <div className="at-export-actions">
                    {exportTargets.map(target => (
                      <button key={target} disabled={actionDisabled || !repo.trim() || githubExports.some(item => item.status === "running")} onClick={() => void exportGithub(target)}>
                        <Github size={16} /> Export {target}
                      </button>
                    ))}
                  </div>
                  {githubExports.length > 0 && (
                    <div className="at-github-exports">
                      {githubExports.map((item) => (
                        <div key={item.id}>
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {item.status === "complete"
                                ? "Export complete"
                                : item.status === "running"
                                  ? "Export in progress"
                                  : (item.error ?? "Export interrupted")}
                            </small>
                          </span>
                          {item.status === "failed" ? (
                            <button
                              disabled={actionDisabled}
                              onClick={() => void exportGithub(item.target ?? "all", item)}
                            >
                              Resume export
                            </button>
                          ) : item.status === "complete" && item.full_name ? (
                            <a
                              href={`https://github.com/${item.full_name}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open repository ↗
                            </a>
                          ) : (
                            <button
                              disabled={actionDisabled}
                              onClick={() =>
                                void task("Checking export", async () => {
                                  if (project)
                                    setGithubExports(
                                      await request<GithubExport[]>(
                                        `/projects/${project.id}/github`,
                                      ),
                                    );
                                })
                              }
                            >
                              Check status
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {exportUrl && (
                <a
                  className="at-export-link"
                  href={exportUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open your GitHub export ↗
                </a>
              )}
              {hasBackend && <>
              <hr />
              <h3>Send backend to Railway</h3>
              <p className="at-muted">Create a service in an existing Railway project's production environment. Railway must have GitHub access to your backend repository. Hosting uses your Railway plan.</p>
              {githubExports.some(item => item.target === "backend" && item.status === "complete") ? (
                <div className="at-railway-export">
                  <label className="at-field">Backend repository
                    <select value={railwayExportId || githubExports.find(item => item.target === "backend" && item.status === "complete")?.id || ""} onChange={e => setRailwayExportId(e.target.value)}>
                      {githubExports.filter(item => item.target === "backend" && item.status === "complete").map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                    </select>
                  </label>
                  <label className="at-field">Railway production project token
                    <input type="password" autoComplete="off" value={railwayToken} onChange={e => setRailwayToken(e.target.value)} placeholder="From Railway project Settings → Tokens" />
                  </label>
                  <p className="at-muted">Choose the production environment when creating this token. It is used for this request and is never saved by AQUA. <a href="https://docs.railway.com/integrations/api#project-token" target="_blank" rel="noreferrer">Token instructions ↗</a></p>
                  <label className="at-field">Frontend origin
                    <input type="url" value={railwayOrigin} onChange={e => setRailwayOrigin(e.target.value)} placeholder="https://your-user.github.io" />
                  </label>
                  <details>
                    <summary>Additional backend variables</summary>
                    <p className="at-muted">Use the selected backend repository's README and .env.example. Enter any required custom variables here. PORT is automatic.</p>
                    <label className="at-field">One KEY=value per line
                      <textarea rows={4} value={railwayVariables} onChange={e => setRailwayVariables(e.target.value)} autoComplete="off" spellCheck={false} />
                    </label>
                  </details>
                  <button className="at-primary" disabled={actionDisabled || !railwayToken.trim() || !railwayOrigin.trim()} onClick={() => void sendToRailway()}>Export backend to Railway <ArrowRight size={16} /></button>
                  {railwayUrl && <a href={railwayUrl} target="_blank" rel="noreferrer">Open Railway project ↗</a>}
                </div>
              ) : <p className="at-muted">Export your backend to GitHub above to enable direct Railway export. You can also deploy the backend ZIP using the included setup guide.</p>}
              </>}
            </>
          ) : modal === "history" ? (
            <>
              <p className="at-muted">
                The eight most recent saved versions are available. Restoring
                creates a new version.
              </p>
              {versions.map((version) => (
                <div className="at-version" key={version.id}>
                  <div>
                    <strong>Version {version.revision}</strong>
                    <small>
                      {version.label} ·{" "}
                      {new Date(Number(version.created_at)).toLocaleString()}
                    </small>
                  </div>
                  <button
                    disabled={actionDisabled}
                    onClick={() =>
                      void task("Restoring", async () => {
                        if (!project) return;
                        if (
                          dirty &&
                          !window.confirm(
                            "Replace your unsaved changes with this snapshot?",
                          )
                        )
                          return;
                        takeProject(
                          await request<StudioProject>(
                            `/projects/${project.id}/restore`,
                            {
                              versionId: version.id,
                              revision: project.revision,
                            },
                          ),
                        );
                        setModal(null);
                        setNotice("Snapshot restored.");
                      })
                    }
                  >
                    Restore
                  </button>
                </div>
              ))}
              {!versions.length && (
                <p>Save a change to create your first snapshot.</p>
              )}
            </>
          ) : modal === "remove" ? (
            <>
              <p>
                Delete {modalProject?.name} and its files, conversation and
                snapshots? Export a copy first if you want to keep it. Your Studio
                credit balance is retained.
              </p>
              <button
                className="at-danger"
                disabled={
                  actionDisabled || Boolean(projects.find(item => item.id === modalProject?.id)?.active_job) || (modalProject?.id === project?.id && active)
                }
                onClick={() => void submitModal()}
              >
                <Trash2 size={16} /> Delete project
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitModal();
              }}
            >
              <label className="at-field">
                {modal === "project" || modal === "renameproject"
                  ? "Project name"
                  : "Relative path"}
                <input
                  autoFocus
                  value={input}
                  maxLength={
                    modal === "project" || modal === "renameproject" ? 80 : 180
                  }
                  placeholder={
                    modal === "project" || modal === "renameproject"
                      ? "My next idea"
                      : modal === "folder"
                        ? "frontend/assets"
                        : "frontend/about.html"
                  }
                  onChange={(e) => setInput(e.target.value)}
                />
              </label>
              <button
                className="at-primary"
                disabled={actionDisabled || !input.trim()}
                type="submit"
              >
                {modal === "rename" || modal === "renameproject"
                  ? "Rename"
                  : "Create"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </Dialog>
      )}
    </main>
  );
}
function StudioWorking({label}: {label: string}) {
  return <div className="at-thinking" role="status" aria-live="polite">
    <span className="at-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
    <span>{label}</span>
  </div>;
}
function StudioSetupCard({
  issues,
  onRetry,
  busy,
  compact = false,
  deposits = false,
}: {
  issues: StudioConfig["setup"]["issues"];
  onRetry: () => void;
  busy: boolean;
  compact?: boolean;
  deposits?: boolean;
}) {
  return (
    <section
      className={`at-setup-card ${compact ? "compact" : ""}`}
      aria-label={deposits ? "AQUA deposit setup" : "Studio AI setup"}
    >
      <header>
        <span><CircleAlert size={18} /></span>
        <div>
          <strong>{deposits ? "AQUA deposits unavailable" : "AI setup incomplete"}</strong>
          <small>{deposits ? "Existing USD credit is unaffected." : "Editing and exports still work."}</small>
        </div>
      </header>
      <div className="at-setup-list">
        {issues.map((issue) => (
          <div key={issue.code}>
            <span aria-hidden="true" />
            <div>
              <strong>{issue.title}</strong>
              <p>{issue.detail}</p>
              {issue.variables.length > 0 && (
                <div className="at-variable-list">
                  {issue.variables.map((variable) => (
                    <code key={variable}>{variable}</code>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button disabled={busy} onClick={onRetry}>
        <RefreshCw size={14} />
        Check again
      </button>
    </section>
  );
}
function Field({
  label,
  locked,
  onLock,
  children,
}: {
  label: string;
  locked: boolean;
  onLock: () => void;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="at-field">
      <div className="at-field-label">
        <span id={labelId}>{label}</span>
        <button
          type="button"
          title={
            locked
              ? "Atlantis will keep this unchanged"
              : "Keep this unchanged when Atlantis makes edits"
          }
          aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
          aria-pressed={locked}
          onClick={onLock}
        >
          {locked ? <LockKeyhole size={13} /> : <Unlock size={13} />}
          <span>{locked ? "Keep this" : ""}</span>
        </button>
      </div>
      {Children.map(children, (child) =>
        isValidElement<Record<string, unknown>>(child) &&
        typeof child.type === "string" &&
        ["input", "select", "textarea"].includes(child.type)
          ? cloneElement(child, { "aria-labelledby": labelId })
          : child,
      )}
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,textarea,select,a[href],summary,[tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="at-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`at-dialog ${className}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function FileTree({
  files,
  folders,
  selected,
  onSelect,
  prefix = "",
}: {
  files: StudioFile[];
  folders: string[];
  selected: string;
  onSelect: (path: string) => void;
  prefix?: string;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  const all = [...files.map((f) => f.path), ...folders.map((f) => f + "/")];
  const children = [
    ...new Set(
      all
        .filter((p) => p.startsWith(prefix))
        .map((p) => p.slice(prefix.length).split("/")[0])
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      Number(files.some((f) => f.path === prefix + a)) -
        Number(files.some((f) => f.path === prefix + b)) || a.localeCompare(b),
  );
  return (
    <div className="at-tree">
      {children.map((name) => {
        const path = prefix + name,
          file = files.find((f) => f.path === path),
          collapsed = closed.includes(path);
        return file ? (
          <button
            className={selected === path ? "selected" : ""}
            key={path}
            onClick={() => onSelect(path)}
            title={path}
          >
            <span className="at-file-dot" />
            {name}
            {file.locked && <LockKeyhole size={11} />}
          </button>
        ) : (
          <div key={path}>
            <button
              onClick={() =>
                setClosed((old) =>
                  collapsed ? old.filter((p) => p !== path) : [...old, path],
                )
              }
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
              <strong>{name}</strong>
            </button>
            {!collapsed && (
              <FileTree
                files={files}
                folders={folders}
                selected={selected}
                onSelect={onSelect}
                prefix={path + "/"}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
