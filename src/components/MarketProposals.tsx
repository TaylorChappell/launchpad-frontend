import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, ImagePlus, Loader2, X } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { DexProfile, Launch, MarketGovernanceResponse, MarketProposal, MarketProposalType } from "../types";
import { DexScreenerIcon } from "./DexScreenerIcon";
import { holdingPercent, MarketActionHint } from "./MarketActionHint";

const labels: Record<MarketProposalType, string> = { dex_payment: "Fund Dex", dex_update: "Update Dex", cto: "Community Takeover" };
const descriptions: Record<MarketProposalType, string> = {
  dex_payment: "Ask holders to fund this coin’s DEX Screener profile from incoming market rewards.",
  dex_update: "Propose the exact description, banner and links for the coin’s DEX Screener profile.",
  cto: "Nominate a new developer wallet and put a clear handover plan to a holder vote.",
};
const liveStatuses = ["voting", "funding", "approved", "ready", "withdrawing", "withdrawn"];
const blankProfile: DexProfile = { description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" };
type Dialog = { kind: "create"; type: MarketProposalType } | { kind: "details" | "challenge" | "activity"; proposal: MarketProposal };
type GovernanceContextValue = {
  launch: Launch; data: MarketGovernanceResponse | null; now: number; busy: boolean; error: string;
  refresh: () => Promise<void>; open: (dialog: Dialog) => void;
  vote: (proposal: MarketProposal, choice: "yes" | "no") => Promise<void>;
};
const GovernanceContext = createContext<GovernanceContextValue | null>(null);
function useProposals() { const value = useContext(GovernanceContext); if (!value) throw new Error("Missing market governance provider."); return value; }
function countdown(at: number, now: number) {
  const seconds = Math.max(0, at - now);
  const hours = Math.floor(seconds / 3600);
  return hours ? hours + "h " + Math.floor(seconds % 3600 / 60) + "m" : Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
function validUrl(value: string) { try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; } }

export function MarketGovernanceProvider({ launch, children }: { launch: Launch; children: ReactNode }) {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [data, setData] = useState<MarketGovernanceResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const identity = launch.id + ":" + (wallet.address ?? "");
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const refresh = useCallback(async () => {
    if (!config.marketGovernanceEnabled) return;
    try {
      const result = await api.marketGovernance(launch.id, wallet.address);
      if (currentIdentity.current === identity) { setData(result); setError(""); }
    } catch (cause) { if (currentIdentity.current === identity) setError(cause instanceof Error ? cause.message : "Could not load proposals."); }
  }, [launch.id, wallet.address, identity, config.marketGovernanceEnabled]);
  useEffect(() => {
    setData(null); setDialog(null); void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    return () => window.clearInterval(poll);
  }, [refresh]);
  useEffect(() => { const clock = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => window.clearInterval(clock); }, []);

  async function sign(action: "create" | "vote" | "details" | "challenge" | "activity", proposalId: string | undefined, content: unknown) {
    if (!wallet.address) throw new Error("Connect a wallet first.");
    const address = wallet.address;
    const approval = await api.marketProposalChallenge(launch.id, { action, wallet: address, proposalId, content });
    const signature = await wallet.signMessage(approval.message);
    if (currentIdentity.current !== identity) throw new Error("Wallet changed. Please try again.");
    return { wallet: address, challenge: approval.challenge, ...signature };
  }
  async function vote(proposal: MarketProposal, choice: "yes" | "no") {
    if (busy || !data?.votePower?.eligible || proposal.status !== "voting") return;
    setBusy(true);
    try {
      const approval = await sign("vote", proposal.id, { choice });
      const result = await api.voteMarketProposal(launch.id, proposal.id, { ...approval, choice });
      if (currentIdentity.current === identity) setData(result);
      toast.success((choice === "yes" ? "Yes" : "No") + " vote recorded");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not record vote."); }
    finally { setBusy(false); }
  }
  async function submit(content: Record<string, unknown>) {
    if (!dialog || busy) return;
    setBusy(true);
    try {
      let result: MarketGovernanceResponse;
      if (dialog.kind === "create") {
        const approval = await sign("create", undefined, { type: dialog.type, payload: content });
        result = await api.createMarketProposal(launch.id, { ...approval, type: dialog.type, payload: content });
      } else if (dialog.kind === "details") {
        const approval = await sign("details", dialog.proposal.id, content);
        result = await api.submitDexDetails(launch.id, dialog.proposal.id, { ...approval, details: content });
      } else if (dialog.kind === "challenge") {
        const reason = String(content.reason);
        const approval = await sign("challenge", dialog.proposal.id, { reason });
        result = await api.challengeMarketProposal(launch.id, dialog.proposal.id, { ...approval, reason });
      } else {
        const approval = await sign("activity", dialog.proposal.id, content);
        result = await api.submitDeveloperActivity(launch.id, dialog.proposal.id, { ...approval, activity: content });
      }
      if (currentIdentity.current === identity) { setData(result); setDialog(null); }
      toast.success(dialog.kind === "create" ? "Proposal is live. Holders can vote on the market page." : "Submitted successfully");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not submit proposal."); }
    finally { setBusy(false); }
  }
  return <GovernanceContext.Provider value={{ launch, data, now, busy, error, refresh, open: setDialog, vote }}>
    {children}
    {dialog && <ProposalSurvey dialog={dialog} draft={data?.dexProfileDraft ?? {}} launch={launch} busy={busy} close={() => { if (!busy) setDialog(null); }} submit={submit}/>}
  </GovernanceContext.Provider>;
}

export function MarketProposals() {
  const { launch, data, now, open, error } = useProposals();
  const wallet = useWallet();
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setExpanded(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const unlocked = Boolean(data?.testingMode || (data?.proposalsOpenAt && now >= data.proposalsOpenAt));
  const eligible = Boolean(data?.enabled && wallet.address && (data.testingMode || data.createPower?.eligible) && unlocked);
  const hint = !data ? error || "Checking proposal eligibility…" : !data.enabled ? data.disabledReason ?? "Unavailable."
    : !wallet.address ? "Connect a wallet. Creating a proposal requires 0.50% of " + launch.symbol + "."
    : !unlocked ? "Proposals unlock in " + countdown(data.proposalsOpenAt ?? now, now) + ", 15 minutes after launch."
    : !data.createPower?.eligible ? "You hold " + holdingPercent(data.createPower?.currentRaw, data.totalSupplyRaw) + " of " + launch.symbol + ". Time-weighted: " + holdingPercent(data.createPower?.averageRaw, data.totalSupplyRaw) + ". Both must reach 0.50% to create a proposal."
    : "Start a holder vote to fund DEX Screener, update the DEX profile or propose a community takeover.";
  return <div className="market-proposal-menu" ref={root}>
    <MarketActionHint text={hint} disabled={!eligible}><button className="market-corner-action proposal" disabled={!eligible} aria-expanded={eligible && expanded} aria-controls="market-proposal-options" onClick={() => setExpanded(!expanded)}>Proposals <ChevronDown/></button></MarketActionHint>
    {eligible && expanded && <div className="proposal-dropdown" id="market-proposal-options" aria-label="Proposal options">
      <small>Start a proposal</small>
      {(Object.keys(labels) as MarketProposalType[]).map((type) => {
        const option = data?.options?.[type];
        return <button key={type} disabled={!option?.available} onClick={() => { setExpanded(false); open({ kind: "create", type }); }}>
          {type !== "cto" ? <DexScreenerIcon/> : <span className="proposal-community-mark">C</span>}
          <span><b>{labels[type]}</b>{option?.reason && <small>{option.reason}</small>}</span>{option?.completed ? <Check/> : <ArrowRight/>}
        </button>;
      })}
    </div>}
  </div>;
}

function ProposalCard({ proposal, compact = false }: { proposal: MarketProposal; compact?: boolean }) {
  const { data, launch, now, busy, vote, open } = useProposals();
  const wallet = useWallet();
  const { config } = useRuntime();
  if (!data) return null;
  const yes = BigInt(proposal.yesPowerRaw || "0"), no = BigInt(proposal.noPowerRaw || "0"), total = yes + no;
  const percent = total ? Number(yes * 10_000n / total) / 100 : 0;
  const voting = proposal.status === "voting" && now >= proposal.startsAt && now < proposal.endsAt;
  const canVote = voting && Boolean(wallet.address && (data.testingMode || data.votePower?.eligible)) && !busy;
  const creator = wallet.address === data.creatorWallet;
  const detailsSubmitted = Boolean(proposal.payload.detailsSubmittedAt);
  const developerActivity = proposal.payload.developerActivity as { summary?: string; evidenceUrl?: string; wallet?: string } | undefined;
  const canSubmitDetails = creator && proposal.type === "dex_payment" && ["voting", "funding", "ready"].includes(proposal.status) && !detailsSubmitted && Boolean(proposal.detailsDeadlineAt && now <= proposal.detailsDeadlineAt);
  const canSubmitActivity = creator && proposal.type === "cto" && proposal.status === "voting" && !developerActivity;
  const profile = (proposal.type === "dex_update" ? proposal.payload : proposal.payload.dexDetails) as Partial<DexProfile> | undefined;
  const voteHint = !wallet.address ? "Connect a wallet to vote. Requires 0.10% of " + launch.symbol + "."
    : "Current: " + holdingPercent(data.votePower?.currentRaw, data.totalSupplyRaw) + " · Time-weighted: " + holdingPercent(data.votePower?.averageRaw, data.totalSupplyRaw) + " · Both must reach 0.10%.";
  return <article className={"proposal-vote-card " + (compact ? "is-compact" : "")}>
    <header><div>{proposal.type !== "cto" && <DexScreenerIcon/>}<h3>{proposal.isDefault ? "DEX Screener" : labels[proposal.type]}</h3></div><span className={"proposal-state " + proposal.status}>{proposal.status === "voting" ? voting ? "Voting open" : "Finalizing" : proposal.status.replaceAll("_", " ")}</span></header>
    {proposal.isDefault && <h4>Fund the token profile</h4>}
    <p className="proposal-reason">{String(proposal.payload.reason ?? descriptions[proposal.type])}</p>
    {proposal.type === "dex_payment" && <div className="proposal-funding-terms"><span>Funding target <b>${proposal.targetUsd.toFixed(0)}</b></span><span>From incoming rewards <b>80%</b></span></div>}
    {proposal.type === "cto" && <details className="proposal-public-details"><summary>Read the takeover plan</summary><dl><dt>Proposed lead</dt><dd>{String(proposal.payload.communityLead ?? "")}</dd><dt>New developer wallet</dt><dd>{String(proposal.payload.developerWallet ?? proposal.payload.multisig ?? "")}</dd><dt>Transition plan</dt><dd>{String(proposal.payload.plan ?? "")}</dd></dl>{validUrl(String(proposal.payload.evidenceUrl ?? "")) && <a href={String(proposal.payload.evidenceUrl)} target="_blank" rel="noreferrer">Community evidence <ExternalLink/></a>}</details>}
    {developerActivity && <details className="proposal-public-details developer-activity-proof" open><summary>Current developer activity evidence</summary><p>{developerActivity.summary}</p>{validUrl(String(developerActivity.evidenceUrl ?? "")) && <a href={developerActivity.evidenceUrl} target="_blank" rel="noreferrer">View public evidence <ExternalLink/></a>}</details>}
    {profile && <details className="proposal-public-details"><summary>Review DEX profile details</summary><p>{profile.description}</p>{(["bannerUrl", "websiteUrl", "xUrl", "telegramUrl"] as const).map((key) => profile[key] && validUrl(profile[key]!) ? <a key={key} href={profile[key]} target="_blank" rel="noreferrer">{{ bannerUrl: "Banner", websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram" }[key]} <ExternalLink/></a> : null)}</details>}
    {proposal.status === "voting" && <>
      <div className="proposal-vote-meta"><span>{proposal.eligibleVoters} eligible vote{proposal.eligibleVoters === 1 ? "" : "s"}</span><time>{countdown(proposal.endsAt, now)} left</time></div>
      <div className="proposal-tally"><span>Yes <b>{Math.round(percent)}%</b></span><span>No <b>{total ? 100 - Math.round(percent) : 0}%</b></span></div>
      <div className={"proposal-water-votes " + (total ? "" : "empty")}><i style={{ width: percent + "%" }}/></div>
      <div className="proposal-vote-buttons">{(["yes", "no"] as const).map((choice) => <button key={choice} className={choice + (data.votes[proposal.id] === choice ? " chosen" : "")} disabled={!canVote || data.votes[proposal.id] === choice} onClick={() => void vote(proposal, choice)}>{busy ? <Loader2 className="spin"/> : data.votes[proposal.id] === choice ? <Check/> : null}{choice === "yes" ? "Yes" : "No"}</button>)}</div>
      {(!wallet.address || (!data.testingMode && !data.votePower?.eligible)) && <p className="proposal-eligibility">{voteHint}</p>}
      <details className="proposal-vote-rules"><summary>How this vote passes</summary><p>{proposal.type === "cto" ? "24-hour vote. Requires 20% of supply in eligible voting power and two-thirds approval. An early result needs 25% of supply on one side, 80% of votes and at least 3 eligible voters after 15 minutes." : "15-minute vote. Requires 5% of supply in eligible voting power and 60% approval. An early result needs 10% of supply on one side, 75% of votes and at least 3 eligible voters after 3 minutes."}</p></details>
    </>}
    {proposal.type === "dex_payment" && ["funding", "ready", "withdrawing", "withdrawn", "completed"].includes(proposal.status) && <div className="proposal-funded"><div><span>Profile funding</span><b>${proposal.fundedUsd.toFixed(2)} / ${proposal.targetUsd.toFixed(0)}</b></div><progress value={proposal.fundedUsd} max={proposal.targetUsd}/></div>}
    {canSubmitDetails && <button className="proposal-creator-action" disabled={busy} onClick={() => open({ kind: "details", proposal })}><DexScreenerIcon/>Submit DEX details <ArrowRight/></button>}
    {canSubmitActivity && <button className="proposal-creator-action" disabled={busy} onClick={() => open({ kind: "activity", proposal })}>Show active development <ArrowRight/></button>}
    {proposal.type === "dex_payment" && !detailsSubmitted && ["voting", "funding", "ready"].includes(proposal.status) && <p className="proposal-detail-note">{creator ? "Only you can submit the profile." : "Waiting for the creator’s DEX profile."}{proposal.detailsDeadlineAt && <> Due in {countdown(proposal.detailsDeadlineAt, now)}.</>}</p>}
    {["rejected", "cancelled"].includes(proposal.status) && <p className="proposal-detail-note">{proposal.outcome === "no_quorum" ? "The vote did not reach the required participation." : proposal.outcome === "details_expired" ? "The creator did not submit profile details before the deadline." : proposal.outcome === "paid_externally" ? "This profile was paid for externally." : proposal.status === "rejected" ? "Holders did not approve this proposal." : "This proposal was cancelled."}</p>}
    {["funding", "approved", "ready"].includes(proposal.status) && (data.testingMode || data.votePower?.eligible) && <button className="proposal-text-action" disabled={busy} onClick={() => open({ kind: "challenge", proposal })}>Challenge this proposal{proposal.openChallenges ? " (" + proposal.openChallenges + " open)" : ""}</button>}
    {proposal.withdrawalSignature && <a className="proposal-text-action" href={"https://solscan.io/tx/" + proposal.withdrawalSignature + (config.network === "devnet" ? "?cluster=devnet" : "")} target="_blank" rel="noreferrer">View funding transaction <ExternalLink/></a>}
  </article>;
}

export function DexFundingVote() {
  const { data, now, launch, error, refresh } = useProposals();
  const { config } = useRuntime();
  if (!config.marketGovernanceEnabled || (data && !data.enabled)) return null;
  const defaultProposal = data?.proposals.find((item) => item.isDefault);
  const proposal = defaultProposal && !["rejected", "cancelled"].includes(defaultProposal.status) ? defaultProposal : null;
  const opensAt = data?.defaultDexOpensAt ?? (launch.launchedAt ? launch.launchedAt + 300 : null);
  if (proposal) return <div className="default-dex-vote"><ProposalCard proposal={proposal} compact/></div>;
  if (data?.dexPaid || defaultProposal) return null;
  return <section className="default-dex-vote dex-vote-pending">
    <header><span>{!opensAt ? "Available after launch" : now < opensAt ? "DEX vote opens in" : "Preparing DEX vote"}</span>{opensAt && now < opensAt && <time>{countdown(opensAt, now)}</time>}</header>
    <div className="dex-vote-preview" aria-hidden="true"><div><DexScreenerIcon/><b>Fund DEX Screener</b></div><p>Fund the profile together.</p><div className="proposal-water-votes"><i/></div><div className="proposal-vote-buttons"><span>Yes</span><span>No</span></div></div>
    <p>{error ? "The vote could not be loaded." : "Holder voting opens five minutes after launch."}</p>
    {error && <button className="proposal-text-action" onClick={() => void refresh()}>Retry</button>}
  </section>;
}

export function CommunityProposalVotes() {
  const { data } = useProposals();
  if (!data?.enabled) return null;
  const proposals = data.proposals.filter((item) => !item.isDefault && !(item.type !== "cto" && ["rejected", "cancelled"].includes(item.status)));
  const active = proposals.filter((item) => liveStatuses.includes(item.status));
  const history = proposals.filter((item) => !liveStatuses.includes(item.status));
  if (!proposals.length) return null;
  return <section className="community-proposals"><header><div><small>HOLDER GOVERNANCE</small><h2>Community proposals</h2></div><span>{active.length} active</span></header><div className="community-proposal-grid">{active.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal}/>)}</div>{history.length > 0 && <details className="community-proposal-history"><summary>Past proposals · {history.length}</summary>{history.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal}/>)}</details>}</section>;
}

function ProposalSurvey({ dialog, draft, launch, busy, close, submit }: { dialog: Dialog; draft: Partial<DexProfile>; launch: Launch; busy: boolean; close: () => void; submit: (content: Record<string, unknown>) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({ ...blankProfile, ...draft, reason: "", communityLead: "", developerWallet: "", plan: "", evidenceUrl: "" });
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(close); closeRef.current = close;
  const kind = dialog.kind;
  const type = dialog.kind === "create" ? dialog.type : dialog.proposal.type;
  const title = kind === "details" ? "DEX profile details" : kind === "challenge" ? "Challenge this proposal" : kind === "activity" ? "Show active development" : labels[type];
  const profileFields = kind === "details" || (kind === "create" && type === "dex_update");
  const set = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, a[href], [tabindex="0"]') ?? []);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keys); previousFocus?.focus(); };
  }, []);
  function content(): Record<string, unknown> {
    const profile = Object.fromEntries(Object.keys(blankProfile).map((key) => [key, form[key as keyof DexProfile].trim()]));
    if (kind === "details") return profile;
    if (kind === "activity") return { summary: form.reason.trim(), evidenceUrl: form.evidenceUrl.trim() };
    if (kind === "challenge" || type === "dex_payment") return { reason: form.reason.trim() };
    if (type === "dex_update") return { reason: form.reason.trim(), ...profile };
    return { reason: form.reason.trim(), communityLead: form.communityLead.trim(), developerWallet: form.developerWallet.trim(), plan: form.plan.trim(), evidenceUrl: form.evidenceUrl.trim() };
  }
  function review() {
    if (kind !== "details" && form.reason.trim().length < 20) return setError("Explain your proposal in at least 20 characters.");
    if (profileFields) {
      if (form.description.trim().length < 20 || !form.bannerUrl.trim()) return setError("Add a description of at least 20 characters and a banner URL.");
      if ([form.bannerUrl, form.websiteUrl, form.xUrl, form.telegramUrl].some((value) => value.trim() && !validUrl(value.trim()))) return setError("Use full https:// URLs for your banner and links.");
    }
    if (kind === "create" && type === "cto") {
      if (form.communityLead.trim().length < 2 || form.plan.trim().length < 40 || !validUrl(form.evidenceUrl)) return setError("Add a community lead, a transition plan of at least 40 characters and a public evidence URL.");
      try { new PublicKey(form.developerWallet); } catch { return setError("Enter a valid new Solana developer wallet."); }
    }
    if (kind === "activity" && !validUrl(form.evidenceUrl)) return setError("Add a public link showing the active development work.");
    setError(""); setStep(1); dialogRef.current?.scrollTo({ top: 0 });
  }
  const reviewLabels: Record<string, string> = { reason: "Reason", summary: "Active work", description: "Description", bannerUrl: "Banner URL", websiteUrl: "Website", xUrl: "X profile", telegramUrl: "Telegram", communityLead: "Proposed lead", developerWallet: "New developer wallet", plan: "Transition plan", evidenceUrl: "Public evidence" };
  return createPortal(<div className="aqua-survey-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><section className="aqua-survey" role="dialog" aria-modal="true" aria-labelledby="proposal-survey-title" ref={dialogRef} tabIndex={-1}>
    <header><span className="survey-market">{type !== "cto" && <DexScreenerIcon/>}${launch.symbol} · {kind === "details" || kind === "activity" ? "Creator submission" : "Community governance"}</span><button aria-label="Close survey" disabled={busy} onClick={close}><X/></button><h2 id="proposal-survey-title">{title}</h2><p>{kind === "details" ? "Review the profile that AQUA will submit to DEX Screener. Only the creator can approve these details." : kind === "activity" ? "Share public evidence that you are still actively developing this coin. If holders reject the takeover, this enables a seven-day protection period." : kind === "challenge" ? "Provide verifiable evidence. Funding stays reserved while an open challenge is reviewed." : descriptions[type]}</p><div className="survey-steps"><span className={step === 0 ? "active" : "done"}>01 · Details</span><span className={step === 1 ? "active" : ""}>02 · Review & sign</span></div></header>
    <form onSubmit={(event) => { event.preventDefault(); if (!step) review(); else if (accepted && !busy) void submit(content()); }}>
      {!step ? <div className="survey-fields">
        {kind !== "details" && <label>{kind === "challenge" ? "What should be investigated?" : kind === "activity" ? "What are you actively working on?" : "Why should holders support this?"}<textarea required minLength={20} maxLength={1000} value={form.reason} onChange={(event) => set("reason", event.target.value)} placeholder={kind === "activity" ? "Describe recent work, current progress and what you are shipping next." : type === "dex_payment" ? "Explain how a DEX profile will help this coin and its holders." : "Describe the change, its purpose and the benefit to holders."}/><small>Be specific. This explanation will be visible on the market page.</small></label>}
        {kind === "activity" && <label>Public proof of work<input type="url" required maxLength={500} value={form.evidenceUrl} onChange={(event) => set("evidenceUrl", event.target.value)} placeholder="https://github.com/… or https://x.com/…"/><small>Link to recent, verifiable work or project updates.</small></label>}
        {kind === "create" && type === "dex_payment" && <div className="survey-funding-summary"><b>A $300 profile, funded by the market</b><p>If holders approve, 80% of incoming market rewards is reserved until the target is met. The remaining 20% continues to holder rewards. Only the creator submits the DEX profile details.</p><span>15-minute vote · 5% quorum · 60% approval</span></div>}
        {profileFields && <DexProfileFields profile={form} update={(key, value) => set(key, value)}/>} 
        {kind === "create" && type === "cto" && <><div className="survey-field-row"><label>Proposed community lead<input required minLength={2} maxLength={100} value={form.communityLead} onChange={(event) => set("communityLead", event.target.value)} placeholder="Name or public handle"/></label><label>Public evidence / community URL<input type="url" required maxLength={500} value={form.evidenceUrl} onChange={(event) => set("evidenceUrl", event.target.value)} placeholder="https://…"/></label></div><label>New developer wallet<input required value={form.developerWallet} onChange={(event) => set("developerWallet", event.target.value)} placeholder="Solana wallet address"/><small>The wallet proposed to receive future creator fees and manage additional developer locks after the handover is executed on-chain.</small></label><label>Transition plan<textarea required minLength={40} maxLength={2000} value={form.plan} onChange={(event) => set("plan", event.target.value)} placeholder="Who takes responsibility, what changes, and how will holders stay informed?"/></label><div className="survey-funding-summary"><p>24-hour vote · 20% quorum · two-thirds approval. Multiple takeover candidates may run at once; the first approved vote becomes the winner. A seven-day protection period only follows a rejected attempt when the current developer has submitted public activity evidence. Approval records the mandate; wallet authority changes only after verified on-chain execution.</p></div></>}
      </div> : <div className="survey-review"><small>CHECK BEFORE SIGNING</small><dl>{Object.entries(content()).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{reviewLabels[key] ?? key}</dt><dd>{String(value)}</dd></div>)}</dl><label className="survey-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>I have checked these details and approve their publication for this market.</span></label><p>Your wallet signs a message. This approval does not spend funds.</p></div>}
      {error && <p className="survey-error" role="alert">{error}</p>}
      <footer><button type="button" className="survey-back" disabled={busy} onClick={() => { if (step) { setStep(0); setAccepted(false); } else close(); }}><ArrowLeft/>{step ? "Edit details" : "Cancel"}</button><button className="survey-submit" disabled={busy || (step === 1 && !accepted)}>{busy ? <Loader2 className="spin"/> : null}{!step ? "Review proposal" : kind === "create" ? "Sign & open vote" : "Sign & submit"}{!busy && <ArrowRight/>}</button></footer>
    </form>
  </section></div>, document.body);
}

export function DexProfileFields({ profile, update, optional = false }: { profile: DexProfile; update: (key: keyof DexProfile, value: string) => void; optional?: boolean }) {
  const wallet = useWallet();
  const [uploading, setUploading] = useState(false);
  async function uploadBanner(file: File | undefined) {
    if (!file) return;
    if (!wallet.address) { wallet.setModalOpen(true); toast.error("Connect the creator wallet before uploading a banner."); return; }
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.error("Use a PNG or JPG banner."); return; }
    if (file.size > 3_000_000) { toast.error("Banner images must be 3 MB or smaller."); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.set("file", file); body.set("creatorWallet", wallet.address); body.set("clientRequestId", crypto.randomUUID());
      const result = await api.upload(body);
      update("bannerUrl", result.imageUrl);
      toast.success("Banner uploaded");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "The banner could not be uploaded."); }
    finally { setUploading(false); }
  }
  return <div className="dex-profile-fields"><label>Profile description{optional && <small>Optional</small>}<textarea required={!optional} minLength={optional ? undefined : 20} maxLength={1000} value={profile.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the project for visitors on DEX Screener."/></label><div className="dex-banner-field"><label>Banner image URL{optional && <small>Optional</small>}<input type="url" required={!optional} maxLength={500} value={profile.bannerUrl} onChange={(event) => update("bannerUrl", event.target.value)} placeholder="https://…/banner.png"/></label><div className="dex-banner-upload"><label className={uploading ? "busy" : ""}><ImagePlus/>{uploading ? "Uploading…" : "Upload PNG or JPG"}<input type="file" accept="image/png,image/jpeg" disabled={uploading} onChange={(event) => { void uploadBanner(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>{profile.bannerUrl && validUrl(profile.bannerUrl) && <img src={profile.bannerUrl} alt="Banner preview"/>}</div><small>Use a public URL or upload a PNG/JPG up to 3 MB. The coin artwork remains its icon.</small></div><div className="survey-field-row">{(["websiteUrl", "xUrl", "telegramUrl"] as const).map((key) => <label key={key}>{{ websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram" }[key]}<input type="url" maxLength={500} value={profile[key]} onChange={(event) => update(key, event.target.value)} placeholder="https://…"/></label>)}</div></div>;
}
