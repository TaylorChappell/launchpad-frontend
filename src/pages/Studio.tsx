import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
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
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  FilePlus2,
  FolderPlus,
  History,
  ImagePlus,
  LockKeyhole,
  Monitor,
  MoreHorizontal,
  Github,
  Plus,
  Save,
  Send,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { useWallet } from "../context";
import { API_URL } from "../api";
import {
  aquaAmount,
  aquaRaw,
  studioAssetUrl,
  studioRequest,
  studioSession,
  studioSessionKey,
  StudioApiError,
  type StudioConfig,
  type StudioFile,
  type StudioJob,
  type StudioLaunch,
  type StudioProject,
  type StudioState,
} from "../studio-api";
import { studioPreview } from "../studio-preview";
import type { TransactionEnvelope } from "../types";
import "./studio.css";
const Editor = lazy(() => import("../components/StudioEditor"));
type Account = {
  balanceRaw: string;
  ledger: Array<{
    id: string;
    kind: string;
    amount_raw: string;
    created_at: number;
    details: { chargedRaw?: string };
  }>;
};
type Quote = {
  id: string;
  maximumRaw: string;
  expiresAt: number;
  pricing: string;
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
  const [token, setToken] = useState(() =>
    wallet.address ? studioSession(wallet.address) : "",
  );
  const [config, setConfig] = useState<StudioConfig | null>(null),
    [account, setAccount] = useState<Account>({ balanceRaw: "0", ledger: [] });
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
    [quote, setQuote] = useState<Quote | null>(null);
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
    taskLock = useRef(false);
  const dirty = Boolean(
    state && project && JSON.stringify(state) !== JSON.stringify(project.state),
  );
  const active = jobs.some((job) => ["queued", "running"].includes(job.status));
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
  }, [jobs.length, jobs[0]?.status, project?.id, workspaceOpen]);
  const file = state?.files.find((f) => f.path === selected),
    decimals = config?.decimals ?? null;
  const preview = useMemo(
    () => (state ? studioPreview(state.files) : ""),
    [state?.files],
  );
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
      if (wallet.address)
        sessionStorage.removeItem(studioSessionKey(wallet.address));
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
  }
  async function refreshProjects() {
    const value =
      await request<Array<Omit<StudioProject, "state">>>("/projects");
    if (mounted.current) setProjects(value);
    return value;
  }
  function takeProject(value: StudioProject) {
    projectId.current = value.id;
    setProject(value);
    setState(value.state);
    setQuote(null);
    setReview(null);
  }
  async function openProject(id: string) {
    const value = await request<StudioProject>(`/projects/${id}`);
    if (!mounted.current) return;
    takeProject(value);
    setJobs([]);
    const history = await request<StudioJob[]>(`/projects/${id}/jobs`);
    if (projectId.current === id) setJobs(history);
  }
  useEffect(() => {
    void studioRequest<StudioConfig>("/config")
      .then((value) => {
        if (mounted.current) setConfig(value);
      })
      .catch(fail);
  }, []);
  useEffect(() => {
    if (!token) return;
    void task("Opening workspace", async () => {
      await refreshAccount();
      const list = await refreshProjects();
      if (list[0]) await openProject(list[0].id);
    });
  }, [token]);
  useEffect(() => {
    if (!token || !project) return;
    const id = project.id;
    const poll = window.setInterval(() => {
      void request<StudioJob[]>(`/projects/${id}/jobs`)
        .then((rows) => {
          if (mounted.current && projectId.current === id) {
            setJobs(rows);
            void refreshAccount().catch(() => {});
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(poll);
  }, [token, project?.id]);
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
    setQuote(null);
  }, [prompt, state]);
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
    setQuote(null);
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
  async function generateQuote() {
    await task("Estimating", async () => {
      const saved = await save();
      if (saved)
        setQuote(
          await request<Quote>(`/projects/${saved.id}/quote`, {
            prompt,
            kind: "auto",
            revision: saved.revision,
          }),
        );
    });
  }
  async function generate() {
    if (!quote || !project) return;
    await task("Starting generation", async () => {
      const id = project.id;
      await request(`/projects/${id}/jobs`, { quoteId: quote.id });
      setQuote(null);
      setPrompt("");
      setJobs(await request(`/projects/${id}/jobs`));
      await refreshAccount();
    });
  }
  async function reviewJob(job: StudioJob) {
    await task("Loading changes", async () =>
      setReview(await request<StudioJob>(`/jobs/${job.id}`)),
    );
  }
  async function applyChanges() {
    if (!review || !project) return;
    const jobId = review.id,
      jobKind = review.kind;
    await task("Applying changes", async () => {
      const saved = await save();
      if (!saved) return;
      takeProject(
        await request<StudioProject>(`/projects/${saved.id}/apply`, {
          jobId,
          revision: saved.revision,
        }),
      );
      if (jobKind === "code" || jobKind === "image") {
        setWorkspaceOpen(true);
        setTab(jobKind === "code" ? "preview" : "assets");
      }
      setNotice("Changes applied. Your previous version is saved in History.");
      await refreshProjects();
    });
  }
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
  function openModal(value: Modal) {
    setInput("");
    setExportUrl("");
    setModal(value);
    if (value === "rename") setInput(selected);
    if (value === "export" && project) {
      setRepo(
        project.name
          .toLowerCase()
          .replace(/[^a-z0-9_.-]+/g, "-")
          .replace(/^[^a-z0-9]+/, "")
          .slice(0, 100) || "my-memecoin",
      );
      void task("Loading GitHub connection", async () => {
        const [connections, exports] = await Promise.all([
          accountRequest<{ github: GithubConnection }>("/integrations", token),
          request<GithubExport[]>(`/projects/${project.id}/github`),
        ]);
        if (mounted.current) {
          setGithub(connections.github);
          setGithubExports(exports);
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
  function keepDeposit(value: { id: string; signature: string } | null) {
    setPendingDeposit(value);
    if (value)
      localStorage.setItem(
        `aqua:studio-deposit:${wallet.address}`,
        JSON.stringify(value),
      );
    else localStorage.removeItem(`aqua:studio-deposit:${wallet.address}`);
  }
  async function confirmDeposit(value: { id: string; signature: string }) {
    await request(`/deposits/${value.id}/confirm`, {
      signature: value.signature,
    });
    keepDeposit(null);
    await refreshAccount();
    setNotice("Your AQUA credit is ready.");
  }
  async function topUp() {
    await task("Waiting for wallet", async () => {
      if (decimals === null) throw new Error("AQUA deposits are unavailable.");
      const tx = await request<TransactionEnvelope & { id: string }>(
        "/deposits",
        { raw: aquaRaw(input, decimals) },
      );
      const signature = await wallet.sendTransaction(tx, (signature) =>
        keepDeposit({ id: tx.id, signature }),
      );
      const value = { id: tx.id, signature };
      keepDeposit(value);
      setBusy("Confirming deposit");
      await confirmDeposit(value);
    });
  }
  async function exportZip() {
    await task("Preparing ZIP", async () => {
      const saved = await save();
      if (!saved) return;
      const response = await fetch(
        `${API_URL}/studio/projects/${saved.id}/zip`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok)
        throw new Error("Could not export this project. Please retry.");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `${saved.name.replace(/[^a-zA-Z0-9_-]/g, "-")}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }
  async function exportGithub(resume?: GithubExport) {
    await task("Exporting to GitHub", async () => {
      let id = project?.id;
      try {
        const saved = await save();
        if (!saved) return;
        id = saved.id;
        const storageKey = `aqua:github-export:${wallet.address}:${id}`;
        let pending: {
          requestId: string;
          name: string;
          private: boolean;
        } | null = null;
        try {
          pending = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        } catch {
          /* A new intent will be created. */
        }
        const input = resume
          ? { requestId: resume.id, name: resume.name, private: resume.private }
          : pending?.name === repo.trim() && pending.private === privateRepo
            ? pending
            : {
                requestId: crypto.randomUUID(),
                name: repo.trim(),
                private: privateRepo,
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
  const actionDisabled = Boolean(busy);
  const creditLabel =
    decimals === null
      ? "AQUA credit"
      : `${aquaAmount(account.balanceRaw, decimals)} AQUA`;
  return (
    <main className="at-studio">
      <header className="at-heading">
        <div>
          <h1>
            Atlantis<span>Studio</span>
          </h1>
          <p>Your memecoin, from idea to launch.</p>
        </div>
        <div className="at-heading-actions">
          {token ? (
            <button className="at-credit" onClick={() => openModal("credit")}>
              {creditLabel}
              <Plus size={15} />
            </button>
          ) : (
            <button
              className="at-primary"
              disabled={actionDisabled}
              onClick={() => void signIn()}
            >
              {wallet.address ? "Sign in to AQUA" : "Connect wallet"}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="at-alert" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="at-notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!token ? (
        <section className="at-welcome">
          <div>
            <h2>What’s your memecoin idea?</h2>
            <p>
              Work through your concept with Atlantis. Create the artwork and
              website, then bring everything into your AQUA launch.
            </p>
            <button
              className="at-primary"
              disabled={actionDisabled}
              onClick={() => void signIn()}
            >
              Enter the studio <ArrowRight size={17} />
            </button>
            <small>Sign in with your wallet · Pay for AI with AQUA</small>
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
                    {p.name}
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
                      {label}
                    </button>
                  ))}
                </nav>
              </>
            )}
            <div className="at-sidebar-bottom">
              <span>Built for AQUA</span>
              <p>
                Plan, create and launch.
                <br />
                Your work stays yours.
              </p>
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
                    {p.name}
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
            </div>
          ) : (
            <div
              className={`at-workspace ${workspaceOpen ? "at-tool-only" : "at-chat-only"}`}
            >
              {!workspaceOpen && (
                <aside className="at-conversation">
                  <div className="at-panel-title">
                    <div>Atlantis</div>
                    <small>{active ? "Working" : "Memecoin studio"}</small>
                  </div>
                  <div className="at-messages" ref={messages}>
                    {!jobs.length && (
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
                                <button
                                  disabled={actionDisabled}
                                  onClick={() => void reviewJob(job)}
                                >
                                  Review result <ArrowRight size={13} />
                                </button>
                                <small>
                                  {decimals !== null &&
                                    `${aquaAmount(job.charged_raw, decimals)} AQUA`}
                                </small>
                              </div>
                            </>
                          ) : job.status === "failed" ? (
                            <p className="at-failed">{job.error}</p>
                          ) : (
                            <p className="at-working">
                              {job.status === "queued"
                                ? "Waiting to start…"
                                : (job.progress ?? "Working on your project…")}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="at-compose">
                    {!config?.paidEnabled && (
                      <p className="at-muted">
                        AI is awaiting configuration. You can edit, save and
                        export your project.
                      </p>
                    )}
                    <textarea
                      aria-label="Message Atlantis"
                      placeholder="Ask Atlantis anything about your memecoin, artwork or website…"
                      value={prompt}
                      maxLength={12000}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing &&
                          prompt.trim() &&
                          config?.paidEnabled &&
                          !actionDisabled &&
                          !active &&
                          !quote
                        ) {
                          e.preventDefault();
                          void generateQuote();
                        }
                      }}
                      rows={4}
                    />
                    {quote ? (
                      <div className="at-quote">
                        <strong>
                          Up to {aquaAmount(quote.maximumRaw, decimals)} AQUA
                        </strong>
                        <small>
                          {quote.pricing}. Quote expires in 2 minutes.
                        </small>
                        <button
                          className="at-primary"
                          disabled={actionDisabled || active}
                          onClick={() => void generate()}
                        >
                          Confirm & generate
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="at-compose-footer">
                        <small>
                          {active
                            ? "Generation in progress"
                            : "Review the price before spending"}
                        </small>
                        <button
                          className="at-primary"
                          aria-label="Estimate generation cost"
                          disabled={
                            !prompt.trim() ||
                            !config?.paidEnabled ||
                            actionDisabled ||
                            active
                          }
                          onClick={() => void generateQuote()}
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    )}
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
                          <iframe
                            title="Isolated website preview"
                            sandbox="allow-scripts"
                            referrerPolicy="no-referrer"
                            srcDoc={preview}
                          />
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
            Rename project
          </button>
          <button
            role="menuitem"
            className="at-danger-link"
            onClick={() => projectAction("remove")}
          >
            Delete project
          </button>
        </div>
      )}
      {review && (
        <Dialog title="Review Atlantis changes" onClose={() => setReview(null)}>
          <StudioMessage text={review.result?.message ?? ""} />
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
          <p className="at-muted">
            Review the proposed files before applying. Locked details and files
            are preserved. History keeps your previous version.
          </p>
          <button
            className="at-primary"
            disabled={
              actionDisabled ||
              !review.result ||
              (!review.result.files.length &&
                !review.result.deletePaths.length &&
                !Object.keys(review.result.launch ?? {}).length)
            }
            onClick={() => void applyChanges()}
          >
            Apply changes
            <Check size={16} />
          </button>
        </Dialog>
      )}
      {modal && (
        <Dialog
          title={
            {
              credit: "Your AQUA credit",
              export: "Take your project with you",
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
          {modal === "credit" ? (
            <>
              <div className="at-balance">
                <small>AVAILABLE TO SPEND</small>
                <strong>{creditLabel}</strong>
              </div>
              <p className="at-muted">
                Deposited AQUA buys prepaid Studio usage. It is not a
                withdrawable wallet balance. Any token transfer fee is deducted
                before credit is added. Each AI request shows a spending limit
                first.
              </p>
              {config?.paidEnabled ? (
                <>
                  <label className="at-field">
                    AQUA to deposit
                    <input
                      inputMode="decimal"
                      value={input}
                      placeholder="0.00"
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </label>
                  <button
                    className="at-primary"
                    disabled={actionDisabled || Boolean(pendingDeposit)}
                    onClick={() => void topUp()}
                  >
                    Deposit AQUA
                    <ArrowRight size={16} />
                  </button>
                  <p className="at-muted">
                    Your wallet will show the transfer and SOL network fee
                    before you approve.
                  </p>
                </>
              ) : (
                <p>
                  AI payments are awaiting operator configuration. Editing and
                  exports are available.
                </p>
              )}
              {pendingDeposit && (
                <div className="at-pending">
                  <strong>Deposit awaiting confirmation</strong>
                  <code>{pendingDeposit.signature}</code>
                  <button
                    disabled={actionDisabled}
                    onClick={() =>
                      void task("Confirming deposit", () =>
                        confirmDeposit(pendingDeposit),
                      )
                    }
                  >
                    Check confirmation
                  </button>
                </div>
              )}
              <h4>Recent activity</h4>
              <div className="at-ledger">
                {account.ledger.map((row) => (
                  <div key={row.id}>
                    <span>
                      {row.kind}
                      <small>
                        {new Date(Number(row.created_at)).toLocaleString()}
                      </small>
                    </span>
                    <strong>{aquaAmount(row.amount_raw, decimals)} AQUA</strong>
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
                Your project contains a static frontend for GitHub Pages, a Node
                backend for Railway, and deployment instructions. The included
                Pages workflow is run manually from your GitHub account.
              </p>
              <button
                className="at-primary"
                disabled={actionDisabled}
                onClick={() => void exportZip()}
              >
                <Download size={16} />
                Download ZIP
              </button>
              <hr />
              <h3>Export to GitHub</h3>
              {!github?.connected ? (
                <div className="at-github-connection">
                  <Github size={24} />
                  <p>
                    Connect GitHub to your AQUA account, then export this
                    project to a new repository.
                  </p>
                  <button
                    disabled={actionDisabled}
                    onClick={() =>
                      void task("Opening integrations", async () => {
                        await save();
                        navigate("/settings/integrations");
                      })
                    }
                  >
                    Connect in Settings
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="at-muted">
                    Connected as <strong>{github.login}</strong>. Atlantis will
                    create a new repository containing your frontend, backend
                    and deployment files.
                  </p>
                  <label className="at-field">
                    Repository name
                    <input
                      placeholder="my-memecoin"
                      maxLength={100}
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
                  <button
                    className="at-primary"
                    disabled={
                      actionDisabled ||
                      !repo.trim() ||
                      githubExports.some((item) => item.status === "running")
                    }
                    onClick={() => void exportGithub()}
                  >
                    <Github size={16} />
                    Create new repository
                  </button>
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
                              onClick={() => void exportGithub(item)}
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
                snapshots? Export a copy first if you want to keep it. Your AQUA
                balance is retained.
              </p>
              <button
                className="at-danger"
                disabled={
                  actionDisabled || (modalProject?.id === project?.id && active)
                }
                onClick={() => void submitModal()}
              >
                Delete project
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
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const trap = (e: KeyboardEvent) => {
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
      old?.focus();
    };
  }, []);
  return (
    <div
      className="at-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="at-dialog"
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
    </div>
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
