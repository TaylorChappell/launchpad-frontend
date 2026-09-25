import { RecentUpdateBell } from "./RecentUpdateBell";
import { WalletIdentity } from "./WalletIdentity";
import { DexStatusBadge } from "./DexStatusBadge";
import { dexBadgeState } from "../dex-status";
import { ensureAccountSession } from "../account-api";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, ImagePlus, Loader2, X } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { DexProfile, Launch, MarketGovernanceResponse, MarketProposal, MarketProposalChoice, MarketProposalType } from "../types";
import { DexScreenerIcon } from "./DexScreenerIcon";
import { holdingPercent, MarketActionHint } from "./MarketActionHint";

const labels: Record<MarketProposalType, string> = { dex_payment: "Fund Dex", dex_update: "Update Dex", dex_boost: "Fund DEX boost", cto: "Community Takeover" };
const descriptions: Record<MarketProposalType, string> = {
  dex_boost: "Vote to fund a DEX Screener boost with 5%, 10% or 20% of incoming market rewards. Funding starts at one hour and gains 20 minutes per milestone. Unspent funds return to holders.",
  dex_payment: "Ask holders to fund this coin’s DEX Screener profile from incoming market rewards.",
  dex_update: "Propose the exact description, banner and links for holders to vote on. You can replace details during funding or request changes after payment. Existing funds stay with the campaign; DEX spending pauses during the vote.",
  cto: "Nominate a new developer wallet and put a clear handover plan to a holder vote.",
};
const liveStatuses = ["voting", "funding", "approved", "ready", "withdrawing", "withdrawn"];
const isFinishedMiniBoost = (proposal: MarketProposal) => proposal.isAutomatic && proposal.type === "dex_boost" && !liveStatuses.includes(proposal.status);
const blankProfile: DexProfile = { description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "" };
type Dialog = { kind: "create"; type: MarketProposalType } | { kind: "details" | "challenge" | "activity"; proposal: MarketProposal };
type GovernanceContextValue = {
  launch: Launch; data: MarketGovernanceResponse | null; now: number; busy: boolean; error: string;
  refresh: () => Promise<void>; open: (dialog: Dialog) => void;
  vote: (proposal: MarketProposal, choice: MarketProposalChoice) => Promise<void>;
};
const GovernanceContext = createContext<GovernanceContextValue | null>(null);
function useProposals() { const value = useContext(GovernanceContext); if (!value) throw new Error("Missing market governance provider."); return value; }
export function MarketDexStatusBadge() {
  const { launch, data } = useProposals();
  return <DexStatusBadge state={dexBadgeState(launch, data)}/>;
}
export function MarketInformationTabs({section,onChange,newComments=false,latestProjectUpdateAt}:{section:string;onChange:(value:string)=>void;newComments?:boolean;latestProjectUpdateAt?:number|null}){
  const {data}=useProposals();
  const activeCount = (data?.enabled || data?.automaticFundingEnabled) ? data.proposals.filter(proposal => liveStatuses.includes(proposal.status)).length : 0;
  const hasGovernance=Boolean((data?.enabled||data?.automaticFundingEnabled)&&data.proposals.some(p=>!isFinishedMiniBoost(p)&&(p.isDefault?!["rejected","cancelled"].includes(p.status):(p.type==="cto"||p.type==="dex_boost")||!["rejected","cancelled"].includes(p.status))));
  useEffect(()=>{if(section==="Governance"&&data&&!hasGovernance)onChange("Transactions");},[section,data,hasGovernance,onChange]);
  return <div className="workspace-tabs market-information-tabs" aria-label="Market information">{["Transactions","Community","Holders","Rewards","Project",...(hasGovernance?["Governance"]:[])].map(label=><button key={label} aria-pressed={section===label} onClick={()=>onChange(label)}>{label}{label === "Community" && newComments && <span className="market-unread-dot" aria-label="New community posts" title="New community posts"/>}{label === "Community" && <RecentUpdateBell at={latestProjectUpdateAt}/>} {label === "Governance" && activeCount > 0 && <span className="governance-tab-count" aria-label={`${activeCount} active proposals`} title={`${activeCount} active proposals`}><Bell size={12} aria-hidden="true"/><b>{activeCount}</b></span>}</button>)}</div>;
}
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
    if (!config.marketGovernanceEnabled && !launch.showcase) return;
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
    if (launch.showcase) throw new Error("Staging previews are read-only.");
    if (!wallet.address) throw new Error("Connect a wallet first.");
    const address = wallet.address;
    const approval = await api.marketProposalChallenge(launch.id, { action, wallet: address, proposalId, content });
    const signature = await wallet.signMessage(approval.message);
    if (currentIdentity.current !== identity) throw new Error("Wallet changed. Please try again.");
    return { wallet: address, challenge: approval.challenge, ...signature };
  }
  async function vote(proposal: MarketProposal, choice: MarketProposalChoice) {
    if (busy || (!data?.testingMode && !data?.votePower?.eligible) || proposal.status !== "voting") return;
    setBusy(true);
    try {
      const approval = await sign("vote", proposal.id, { choice });
      const result = await api.voteMarketProposal(launch.id, proposal.id, { ...approval, choice });
      if (currentIdentity.current === identity) setData(result);
      toast.success((choice === "yes" ? "Yes" : choice === "no" ? "No" : choice + "%") + " vote recorded");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not record vote."); }
    finally { setBusy(false); }
  }
  async function submit(content: Record<string, unknown>) {
    if (!dialog || busy) return;
    setBusy(true);
    try {
      let result: MarketGovernanceResponse;
      if (dialog.kind === "create") {
        if (!data?.createPower?.eligible) throw new Error("Creating a proposal requires at least 0.5% of the supply.");
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
  const currentProfile = data?.proposals.find(item => item.type === "dex_payment" && item.payload.dexDetails)?.payload.dexDetails
    ?? data?.proposals.filter(item => item.type === "dex_update" && ["approved", "completed"].includes(item.status)).sort((a,b) => b.createdAt - a.createdAt)[0]?.payload;
  const surveyDraft = dialog?.kind === "create" && dialog.type === "dex_update" && currentProfile ? currentProfile as Partial<DexProfile> : data?.dexProfileDraft ?? {};
  return <GovernanceContext.Provider value={{ launch, data, now, busy, error, refresh, open: setDialog, vote }}>
    {children}
    {dialog && <ProposalSurvey dialog={dialog} draft={surveyDraft} launch={launch} busy={busy} close={() => { if (!busy) setDialog(null); }} submit={submit}/>}
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
  const eligible = Boolean(data?.enabled && wallet.address && data.createPower?.eligible && unlocked);
  const hint = !data ? error || "Checking proposal eligibility…" : !data.enabled ? data.disabledReason ?? "Unavailable."
    : !wallet.address ? "Connect a wallet. Creating a proposal requires 0.50% of " + launch.symbol + "."
    : !unlocked ? "Proposals unlock in " + countdown(data.proposalsOpenAt ?? now, now) + ", 15 minutes after launch."
    : !data.createPower?.eligible ? "You hold " + holdingPercent(data.createPower?.currentRaw, data.totalSupplyRaw) + " of " + launch.symbol + ". You need 0.50% to create a proposal."
    : "Start a holder vote to fund DEX Screener, update the DEX profile or propose a community takeover.";
  if (data && !data.enabled) return null;
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

function AutomaticProfileCard({ proposal: p }: { proposal: MarketProposal }) {
  const { now } = useProposals();
  const funding = p.status === "funding";
  return <article className="proposal-vote-card automatic-funding-card">
    <header><div><DexScreenerIcon/><h3>DEX profile</h3></div><span className="proposal-state">{funding ? p.collectionPaused ? "Paused" : "Auto funding" : p.status === "ready" ? "Ready to purchase" : p.status}</span></header>
    <div className="proposal-funded"><div><span>{funding ? "10% of incoming rewards" : "Profile fund"}</span><b>${p.fundedUsd.toFixed(2)} / $300</b></div><progress value={p.fundedUsd} max={300}/></div>
    {funding && <p className="proposal-detail-note">{p.collectionPaused ? "Waiting for trading activity. " : ""}Expires in {countdown(p.fundingEndsAt ?? now, now)}.</p>}
    {p.outcome === "funding_expired" && <p className="proposal-detail-note">The target was not reached within 24 hours. All funds returned to holders.</p>}
    {BigInt(p.returnedLamports ?? "0") > 0n && <p className="proposal-detail-note">{(Number(p.returnedLamports)/1e9).toLocaleString(undefined,{maximumFractionDigits:9})} SOL returned to holders.</p>}
    {p.outcome === "holder_no" && <p className="proposal-detail-note">Holders voted No. Automatic funding is paused for 24 hours.</p>}
    <details className="proposal-public-details"><summary>How automatic funding works</summary><p>Sustained trading activity sets aside 10% of incoming market rewards. Collection pauses when activity slows; the 24-hour deadline continues. A successful Fund DEX vote carries this balance into 80% funding. If the target is not met, the reserve returns to holders.</p><p>Team AQUA can prepare missing profile details. An approved Update DEX proposal replaces them.</p>{p.payload.dexDetails && typeof p.payload.dexDetails === "object" ? <p>{String((p.payload.dexDetails as Record<string, unknown>).description ?? "")}</p> : null}</details>
  </article>;
}

function ProposalCard({ proposal, compact = false }: { proposal: MarketProposal; compact?: boolean }) {
  const { data, launch, now, busy, vote, open } = useProposals();
  const wallet = useWallet();
  const { config } = useRuntime();
  if (!data) return null;
  if (proposal.isAutomatic && proposal.type === "dex_payment") return <AutomaticProfileCard proposal={proposal}/>;
  if (proposal.type === "dex_boost") return <BoostProposalCard proposal={proposal}/>;
  const yes = BigInt(proposal.yesPowerRaw || "0"), no = BigInt(proposal.noPowerRaw || "0"), total = yes + no;
  const percent = total ? Number(yes * 10_000n / total) / 100 : 0;
  const voting = proposal.status === "voting" && now >= proposal.startsAt && now < proposal.endsAt;
  const canVote = voting && Boolean(wallet.address && (data.testingMode || data.votePower?.eligible)) && !busy;
  const creator = wallet.address === data.creatorWallet;
  const detailsSubmitted = Boolean(proposal.payload.detailsSubmittedAt);
  const developerActivity = proposal.payload.developerActivity as { summary?: string; evidenceUrl?: string; wallet?: string } | undefined;
  const canSubmitDetails = Boolean(data.enabled && wallet.address && data.createPower?.eligible && (data.testingMode || (data.proposalsOpenAt && now >= data.proposalsOpenAt))) && proposal.type === "dex_payment" && ["voting", "funding", "ready"].includes(proposal.status) && !detailsSubmitted && !proposal.payload.proposedProfile && Boolean(proposal.detailsDeadlineAt && now <= proposal.detailsDeadlineAt);
  const canSubmitActivity = creator && proposal.type === "cto" && proposal.status === "voting" && !developerActivity;
  const profile = (proposal.type === "dex_update" ? proposal.payload : (proposal.status === "voting" ? proposal.payload.proposedProfile ?? proposal.payload.dexDetails : proposal.payload.dexDetails ?? proposal.payload.proposedProfile)) as Partial<DexProfile> | undefined;
  const voteHint = !wallet.address ? "Connect a wallet to vote. Requires 0.10% of " + launch.symbol + "."
    : "Current: " + holdingPercent(data.votePower?.currentRaw, data.totalSupplyRaw) + " · Time-weighted: " + holdingPercent(data.votePower?.averageRaw, data.totalSupplyRaw) + " · Both must reach 0.10%.";
  return <article className={"proposal-vote-card " + (compact ? "is-compact" : "")}>
    <header><div>{proposal.type !== "cto" && <DexScreenerIcon/>}<h3>{proposal.isDefault ? "DEX Screener" : labels[proposal.type]}</h3></div><span className={"proposal-state " + proposal.status}>{proposal.status === "voting" ? voting ? "Voting open" : "Finalizing" : proposal.status.replaceAll("_", " ")}</span></header>
    {proposal.isDefault && <h4>Fund the token profile</h4>}
    <p className="proposal-reason">{String(proposal.payload.reason ?? descriptions[proposal.type])}</p>
    {proposal.type === "dex_payment" && <div className="proposal-funding-terms"><span>Funding target <b>${proposal.targetUsd.toFixed(0)}</b></span><span>From incoming rewards <b>80%</b></span></div>}
    {proposal.type === "cto" && <details className="proposal-public-details"><summary>Read the takeover plan</summary><dl><dt>Proposed lead</dt><dd>{String(proposal.payload.communityLead ?? "")}</dd><dt>Community takeover wallet</dt><dd><WalletIdentity wallet={String(proposal.payload.communityTakeoverWallet ?? proposal.payload.developerWallet ?? proposal.payload.multisig ?? "")}/></dd><dt>Transition plan</dt><dd>{String(proposal.payload.plan ?? "")}</dd></dl>{validUrl(String(proposal.payload.evidenceUrl ?? "")) && <a href={String(proposal.payload.evidenceUrl)} target="_blank" rel="noreferrer">Community evidence <ExternalLink/></a>}</details>}
    {developerActivity && <details className="proposal-public-details developer-activity-proof" open><summary>Current developer activity evidence</summary><p>{developerActivity.summary}</p>{validUrl(String(developerActivity.evidenceUrl ?? "")) && <a href={developerActivity.evidenceUrl} target="_blank" rel="noreferrer">View public evidence <ExternalLink/></a>}</details>}
    {profile && <details className="proposal-public-details"><summary>Review DEX profile details</summary><p>{profile.description}</p>{(["bannerUrl", "websiteUrl", "xUrl", "telegramUrl"] as const).map((key) => profile[key] && validUrl(profile[key]!) ? <a key={key} href={profile[key]} target="_blank" rel="noreferrer">{{ bannerUrl: "Banner", websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram" }[key]} <ExternalLink/></a> : proposal.type === "dex_update" ? <p key={key}>{{ bannerUrl: "Banner", websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram" }[key]}: not provided / remove existing</p> : null)}</details>}
    {proposal.status === "voting" && <>
      <div className="proposal-vote-meta"><span>{proposal.eligibleVoters} eligible vote{proposal.eligibleVoters === 1 ? "" : "s"}</span><time>{countdown(proposal.endsAt, now)} left</time></div>
      <div className="proposal-tally"><span>Yes <b>{Math.round(percent)}%</b></span><span>No <b>{total ? 100 - Math.round(percent) : 0}%</b></span></div>
      <div className={"proposal-water-votes " + (total ? "" : "empty")}><i style={{ width: percent + "%" }}/></div>
      <div className="proposal-vote-buttons">{(["yes", "no"] as const).map((choice) => <button key={choice} className={choice + (data.votes[proposal.id] === choice ? " chosen" : "")} disabled={!canVote || data.votes[proposal.id] === choice} onClick={() => void vote(proposal, choice)}>{busy ? <Loader2 className="spin"/> : data.votes[proposal.id] === choice ? <Check/> : null}{choice === "yes" ? "Yes" : "No"}</button>)}</div>
      {(!wallet.address || (!data.testingMode && !data.votePower?.eligible)) && <p className="proposal-eligibility">{voteHint}</p>}
      <details className="proposal-vote-rules"><summary>How this vote passes</summary><p>{proposal.type === "cto" ? "24-hour vote." : "15-minute vote."} Passes when Yes has more than 50% of the eligible voting power cast at the end. Votes are weighted by holdings and held time. No minimum turnout is required. Ties and no votes do not pass.</p></details>
    </>}
    {(proposal.type === "dex_payment" || proposal.payload.dexService === "community_takeover") && ["funding", "ready", "withdrawing", "withdrawn", "completed"].includes(proposal.status) && <div className="proposal-funded"><div><span>Profile funding</span><b>${proposal.fundedUsd.toFixed(2)} / ${proposal.targetUsd.toFixed(0)}</b></div><progress value={proposal.fundedUsd} max={proposal.targetUsd}/></div>}
    {proposal.spendingPaused && <p className="proposal-detail-note">Holders are voting on replacement DEX details. Funding continues and existing SOL stays reserved; spending is paused until the vote resolves.</p>}
    {proposal.payload.dexService === "community_takeover" && <p className="proposal-detail-note">DEX profile takeover · $200 funding target from market fees. AQUA will submit the approved details after funding; DEX Screener reviews the request.</p>}
    {proposal.type === "dex_update" && <p className="proposal-detail-note">{proposal.payload.targetFundingProposalId ? proposal.status === "completed" ? "Holder-approved details have been applied to the existing funding campaign. Funds raised are unchanged." : "This vote replaces the profile on the existing funding campaign. It does not transfer developer ownership or fees." : proposal.status === "approved" ? "Approved by holders. Awaiting submission to DEX Screener." : "Approval authorizes these exact details for submission to DEX Screener."}</p>}
    {canSubmitDetails && <button className="proposal-creator-action" disabled={busy} onClick={() => open({ kind: "create", type: "dex_update" })}><DexScreenerIcon/>Propose DEX details <ArrowRight/></button>}
    {canSubmitActivity && <button className="proposal-creator-action" disabled={busy} onClick={() => open({ kind: "activity", proposal })}>Show active development <ArrowRight/></button>}
    {proposal.type === "dex_payment" && !detailsSubmitted && !proposal.payload.proposedProfile && ["voting", "funding", "ready"].includes(proposal.status) && <p className="proposal-detail-note">{creator ? "Propose your profile through Update Dex for holders to approve." : "An eligible holder can propose profile details through Update Dex."}{proposal.detailsDeadlineAt && <> Due in {countdown(proposal.detailsDeadlineAt, now)}.</>}</p>}
    {["rejected", "cancelled"].includes(proposal.status) && <p className="proposal-detail-note">{proposal.outcome === "no_votes" ? "No eligible votes were cast." : proposal.outcome === "tie" ? "The vote was tied, so the proposal did not pass." : proposal.outcome === "no_quorum" ? "This vote did not meet the previous participation requirement." : proposal.outcome === "details_expired" ? "The creator did not submit profile details before the deadline." : proposal.outcome === "paid_externally" ? "This profile was paid for externally." : proposal.status === "rejected" ? "Holders did not approve this proposal." : "This proposal was cancelled."}</p>}
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
  if (data?.dexPaid || defaultProposal || !(data?.dexFundingEnabled ?? launch.dexFundingEnabled)) return null;
  return <section className="default-dex-vote dex-vote-pending">
    <header><span>{!opensAt ? "Available after launch" : now < opensAt ? "DEX vote opens in" : "Preparing DEX vote"}</span>{opensAt && now < opensAt && <time>{countdown(opensAt, now)}</time>}</header>
    <div className="dex-vote-preview" aria-hidden="true"><div><DexScreenerIcon/><b>Fund DEX Screener</b></div><p>Fund the profile together.</p><div className="proposal-water-votes"><i/></div><div className="proposal-vote-buttons"><span>Yes</span><span>No</span></div></div>
    <p>{error ? "The vote could not be loaded." : "Holder voting opens five minutes after launch."}</p>
    {error && <button className="proposal-text-action" onClick={() => void refresh()}>Retry</button>}
  </section>;
}


const boostChoices = ["5", "10", "20", "no"] as const;
const fallbackBoostPacks = [{ boosts: 10, cents: 9900, hours: 12 }, { boosts: 30, cents: 24900, hours: 12 }, { boosts: 50, cents: 39900, hours: 12 }, { boosts: 100, cents: 89900, hours: 24 }, { boosts: 500, cents: 399900, hours: 24 }];
function BoostPackPrices({ packs = fallbackBoostPacks }: { packs?: typeof fallbackBoostPacks }) {
  return <div className="boost-pack-prices">{packs.map(pack => <span key={pack.boosts}><b>{pack.boosts}x</b><span>${(pack.cents / 100).toLocaleString()}</span><small>{pack.hours} hours</small></span>)}</div>;
}
function BoostProposalCard({ proposal: p }: { proposal: MarketProposal }) {
  const { data, now, busy, vote, open } = useProposals();
  const wallet = useWallet();
  if (!data) return null;
  const packs = p.boostPacks ?? fallbackBoostPacks;
  const powers = p.pollPowerRaw ?? { "5": "0", "10": "0", "20": "0", no: "0" };
  const total = boostChoices.reduce((sum, choice) => sum + BigInt(powers[choice]), 0n);
  const voting = p.status === "voting";
  const canVote = voting && now >= p.startsAt && now < p.endsAt && Boolean(wallet.address && (data.testingMode || data.votePower?.eligible)) && !busy;
  const nextPack = packs.find(pack => pack.cents > p.fundedUsd * 100);
  const affordable = [...packs].reverse().find(pack => pack.cents <= p.fundedUsd * 100);
  const minimum = p.isAutomatic ? 100 : 99;
  const fundingPeriod = p.fundingStartsAt && p.fundingEndsAt ? `${Math.round((p.fundingEndsAt - p.fundingStartsAt) / 60)} minutes` : p.isAutomatic ? "90 minutes" : "60 minutes";
  const title = voting ? "Choose the funding rate" : p.status === "approved" ? "Waiting for DEX funding" : p.status === "funding" ? "Funding a DEX boost" : p.outcome === "below_minimum" ? "Funds returned to holders" : p.status === "rejected" ? "Boost not approved" : p.status === "cancelled" ? "Boost cancelled" : p.status === "completed" ? `${p.boostPack}x boost purchased` : `${p.boostPack}x boost funded`;
  return <article className="proposal-vote-card boost-proposal-card">
    <header><div><DexScreenerIcon/><h3>{p.isAutomatic ? "Mini DEX boost" : "DEX boost"}</h3></div><span className={"proposal-state " + p.status}>{p.isAutomatic && p.status === "funding" ? "Auto funding" : p.status === "approved" ? "Queued" : p.status === "ready" ? "Ready to purchase" : p.status === "withdrawn" ? "Purchase pending" : p.status}</span></header>
    {!p.isAutomatic && <h4>{title}</h4>}{!p.isAutomatic && <p className="proposal-reason">{String(p.payload.reason ?? "")}</p>}
    {voting ? <><div className="proposal-vote-meta"><span>{p.eligibleVoters} eligible voters</span><time>{countdown(p.endsAt, now)} left</time></div>
      <div className="boost-poll-options">{boostChoices.map(choice => {
        const share = total ? Number(BigInt(powers[choice]) * 10000n / total) / 100 : 0;
        const chosen = data.votes[p.id] === choice;
        return <button key={choice} aria-pressed={chosen} disabled={!canVote || chosen} onClick={() => void vote(p, choice)} className={chosen ? "chosen" : ""}>
          <span className="boost-poll-fill" style={{ width: share + "%" }}/><span>{choice === "no" ? "No boost" : choice + "%"}{chosen && <Check size={15}/>}</span><b>{share.toFixed(1)}%</b>
        </button>;
      })}</div><small className="proposal-detail-note">Share of future market rewards. Funding starts at one hour; each milestone adds 20 minutes.</small>
      {!wallet.address && <p className="proposal-eligibility">Connect your wallet to vote.</p>}
      {wallet.address && !data.testingMode && !data.votePower?.eligible && <p className="proposal-eligibility">Voting requires a current and time-weighted holding of at least 0.1%.</p>}
      <details className="proposal-vote-rules"><summary>Voting rules</summary><p>15-minute vote, weighted by holdings and held time. Most voting power wins. Ties favour No, then the lower percentage. No votes means no boost.</p></details></> : <>
      {p.fundingPercent && <div className="proposal-funding-terms"><span>Reward allocation <b>{p.fundingPercent}%</b></span><span>{p.status === "funding" ? "Funding ends in" : "Funding period"}<b>{p.status === "funding" && p.fundingEndsAt ? countdown(p.fundingEndsAt, now) : fundingPeriod}</b></span></div>}
      {p.status === "funding" && <div className="proposal-funded"><div><span>{affordable && p.fundedUsd >= minimum ? `${affordable.boosts}x affordable` : `$${minimum} minimum`}</span><b>${p.fundedUsd.toFixed(2)}</b></div><progress aria-label="Boost funding" value={p.fundedUsd} max={p.fundedUsd < minimum ? minimum : nextPack ? nextPack.cents / 100 : 3999}/><small>{p.isAutomatic && p.fundedUsd < minimum ? "$100 starts a 10x purchase; the pack costs $99." : nextPack ? `$${(nextPack.cents / 100).toLocaleString()} unlocks ${nextPack.boosts}x` : "Largest pack funded. Surplus returns to holders."}</small></div>}
      {p.isAutomatic && p.status === "funding" && <p className="proposal-detail-note">Starts at 90 minutes, plus 20 minutes per milestone. Closes after 30 minutes without a market trade.</p>}
      {Boolean(p.payload.inheritedAutomaticFund) && <p className="proposal-detail-note">Carries the mini fund’s time and milestone progress into this vote.</p>}
      {p.status === "approved" && <p className="proposal-detail-note">Funding starts after the DEX profile is paid and open challenges are resolved.</p>}
      {p.boostPack && <div className="boost-selected-pack"><b>{p.boostPack}x · {p.boostHours} hours</b><span>${p.targetUsd.toFixed(0)}</span></div>}
      {p.outcome === "below_minimum" && <p className="proposal-detail-note">The available reserve was below ${minimum}. All remaining funds returned to holder rewards.</p>}
      {BigInt(p.returnedLamports ?? "0") > 0n && <p className="proposal-detail-note">{(Number(p.returnedLamports) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL returned to holders.</p>}
      {p.status === "rejected" && <p className="proposal-detail-note">{p.outcome === "no_votes" ? "No eligible votes were cast." : "No won the poll."}</p>}
      {p.dexOrderReference && <p className="proposal-detail-note">Purchase reference: {p.dexOrderReference}</p>}
    </>}
    <details className="proposal-public-details"><summary>Boost packs & funding</summary><BoostPackPrices packs={packs}/><p>At $100, $250, $400, $900 and $4,000, funding gains 20 minutes once per milestone. The largest affordable pack is selected when funding closes. Any remainder returns to holders.</p></details>
    {Boolean(p.openChallenges) && <p className="proposal-detail-note">Purchase paused while a holder challenge is reviewed.</p>}
    {["approved", "funding", "ready"].includes(p.status) && data.enabled && wallet.address && data.votePower?.eligible && <button className="proposal-text-action" disabled={busy} onClick={() => open({ kind: "challenge", proposal: p })}>Challenge proposal</button>}
  </article>;
}

export function CommunityProposalVotes() {
  const { data } = useProposals();
  if (!data?.enabled && !data?.automaticFundingEnabled) return null;
  const proposals = data.proposals.filter((item) => !item.isDefault && !isFinishedMiniBoost(item) && item.outcome !== "transferred_to_vote" && !(!item.isAutomatic && !["cto", "dex_boost"].includes(item.type) && ["rejected", "cancelled"].includes(item.status)));
  const active = proposals.filter((item) => liveStatuses.includes(item.status));
  const history = proposals.filter((item) => !liveStatuses.includes(item.status));
  if (!proposals.length) return null;
  return <section className="community-proposals"><header><div><small>{data.enabled ? "HOLDER GOVERNANCE" : "MARKET ACTIVITY"}</small><h2>{data.enabled ? "Community proposals" : "Automatic boost funding"}</h2></div><span>{active.length} active</span></header><div className="community-proposal-grid">{active.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal}/>)}</div>{history.length > 0 && <details className="community-proposal-history"><summary>Past proposals · {history.length}</summary>{history.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal}/>)}</details>}</section>;
}

function ProposalSurvey({ dialog, draft, launch, busy, close, submit }: { dialog: Dialog; draft: Partial<DexProfile>; launch: Launch; busy: boolean; close: () => void; submit: (content: Record<string, unknown>) => Promise<void> }) {
  const { data } = useProposals();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({ ...blankProfile, ...draft, reason: "", communityLead: "", communityTakeoverWallet: "", plan: "", evidenceUrl: "" });
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(close); closeRef.current = close;
  const kind = dialog.kind;
  const type = dialog.kind === "create" ? dialog.type : dialog.proposal.type;
  const title = kind === "details" ? "DEX profile details" : kind === "challenge" ? "Challenge this proposal" : kind === "activity" ? "Show active development" : labels[type];
  const profileFields = kind === "details" || (kind === "create" && (type === "dex_update" || type === "dex_payment"));
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
    if (kind === "challenge") return { reason: form.reason.trim() };
    if (type === "dex_boost") return { reason: form.reason.trim() };
    if (type === "dex_payment") return { reason: form.reason.trim(), proposedProfile: profile };
    if (type === "dex_update") return { reason: form.reason.trim(), ...profile };
    return { reason: form.reason.trim(), communityLead: form.communityLead.trim(), communityTakeoverWallet: form.communityTakeoverWallet.trim(), plan: form.plan.trim(), evidenceUrl: form.evidenceUrl.trim() };
  }
  function review() {
    if (kind !== "details" && form.reason.trim().length < 20) return setError("Explain your proposal in at least 20 characters.");
    if (profileFields) {
      if (form.description.trim().length < 20 || !form.bannerUrl.trim()) return setError("Add a description of at least 20 characters and a banner URL.");
      if ([form.bannerUrl, form.websiteUrl, form.xUrl, form.telegramUrl].some((value) => value.trim() && !validUrl(value.trim()))) return setError("Use full https:// URLs for your banner and links.");
    }
    if (kind === "create" && type === "cto") {
      if (form.communityLead.trim().length < 2 || form.plan.trim().length < 40 || !validUrl(form.evidenceUrl)) return setError("Add a community lead, a transition plan of at least 40 characters and a public evidence URL.");
      try { new PublicKey(form.communityTakeoverWallet); } catch { return setError("Enter the takeover developer's valid Solana wallet address."); }
    }
    if (kind === "activity" && !validUrl(form.evidenceUrl)) return setError("Add a public link showing the active development work.");
    setError(""); setStep(1); dialogRef.current?.scrollTo({ top: 0 });
  }
  const reviewLabels: Record<string, string> = { reason: "Reason", summary: "Active work", description: "Description", bannerUrl: "Banner URL", websiteUrl: "Website", xUrl: "X profile", telegramUrl: "Telegram", communityLead: "Proposed lead", communityTakeoverWallet: "Community takeover wallet", plan: "Transition plan", evidenceUrl: "Public evidence" };
  return createPortal(<div className="aqua-survey-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><section className="aqua-survey" role="dialog" aria-modal="true" aria-labelledby="proposal-survey-title" ref={dialogRef} tabIndex={-1}>
    <header><span className="survey-market">{type !== "cto" && <DexScreenerIcon/>}${launch.symbol} · {kind === "details" || kind === "activity" ? "Creator submission" : "Community governance"}</span><button aria-label="Close survey" disabled={busy} onClick={close}><X/></button><h2 id="proposal-survey-title">{title}</h2><p>{kind === "details" ? "Review the profile that AQUA will submit to DEX Screener. Only the creator can approve these details." : kind === "activity" ? "Share public evidence that you are still actively developing this coin. If holders reject the takeover, this enables a seven-day protection period." : kind === "challenge" ? "Provide verifiable evidence. Funding stays reserved while an open challenge is reviewed." : descriptions[type]}</p><div className="survey-steps"><span className={step === 0 ? "active" : "done"}>01 · Details</span><span className={step === 1 ? "active" : ""}>02 · Review & sign</span></div></header>
    <form onSubmit={(event) => { event.preventDefault(); if (!step) review(); else if (accepted && !busy) void submit(content()); }}>
      {!step ? <div className="survey-fields">
        {kind !== "details" && <label>{kind === "challenge" ? "What should be investigated?" : kind === "activity" ? "What are you actively working on?" : "Why should holders support this?"}<textarea required minLength={20} maxLength={1000} value={form.reason} onChange={(event) => set("reason", event.target.value)} placeholder={kind === "activity" ? "Describe recent work, current progress and what you are shipping next." : type === "dex_payment" ? "Explain how a DEX profile will help this coin and its holders." : "Describe the change, its purpose and the benefit to holders."}/><small>Be specific. This explanation will be visible on the market page.</small></label>}
        {kind === "activity" && <label>Public proof of work<input type="url" required maxLength={500} value={form.evidenceUrl} onChange={(event) => set("evidenceUrl", event.target.value)} placeholder="https://github.com/… or https://x.com/…"/><small>Link to recent, verifiable work or project updates.</small></label>}
        {kind === "create" && type === "dex_update" && <div className="survey-funding-summary"><b>{!data?.dexPaid ? "Replace the existing campaign’s details" : data.dexManagedByAqua ? "Update a profile managed by AQUA" : "Fund a DEX profile takeover · $200"}</b><p>{!data?.dexPaid ? "Raised SOL stays in the campaign. Spending pauses during this vote and the approved details replace the current profile." : data.dexManagedByAqua ? "Once holders approve, AQUA submits these exact details using its existing profile access." : "After approval, 80% of incoming market rewards accumulates toward the $200 target. The remaining 20% continues to holder rewards. AQUA then submits the takeover request for DEX Screener review."}</p></div>}
        {kind === "create" && type === "dex_boost" && <div className="survey-funding-summary"><b>5% · 10% · 20% · No</b><p>Holders have 15 minutes to choose. Funding starts at one hour and gains 20 minutes at each milestone. AQUA buys the largest affordable pack and returns the remainder. An existing mini fund carries its time and balance into the vote.</p><BoostPackPrices/></div>}
        {profileFields && <DexProfileFields profile={form} update={(key, value) => set(key, value)}/>} 
        {kind === "create" && type === "cto" && <><div className="survey-field-row"><label>Proposed community lead<input required minLength={2} maxLength={100} value={form.communityLead} onChange={(event) => set("communityLead", event.target.value)} placeholder="Name or public handle"/></label><label>Public evidence / community URL<input type="url" required maxLength={500} value={form.evidenceUrl} onChange={(event) => set("evidenceUrl", event.target.value)} placeholder="https://…"/></label></div><label>Community takeover wallet address<input required value={form.communityTakeoverWallet} onChange={(event) => set("communityTakeoverWallet", event.target.value)} placeholder="Takeover developer's Solana wallet"/><small>This is the wallet of the person taking over development. After an approved vote is executed on-chain, it receives existing and future creator fees and can create future developer locks. It is not a community treasury.</small></label><label>Transition plan<textarea required minLength={40} maxLength={2000} value={form.plan} onChange={(event) => set("plan", event.target.value)} placeholder="Who takes responsibility, what changes, and how will holders stay informed?"/></label></>}
      </div> : <div className="survey-review"><small>CHECK BEFORE SIGNING</small><dl>{Object.entries(content()).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{reviewLabels[key] ?? key}</dt><dd>{key === "communityTakeoverWallet" ? <WalletIdentity wallet={String(value)}/> : String(value)}</dd></div>)}</dl><label className="survey-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>I have checked these details and approve their publication for this market.</span></label><p>Your wallet signs a message. This approval does not spend funds.</p></div>}
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
    if (!wallet.address) { wallet.setModalOpen(true); toast.error("Connect your wallet before uploading a banner."); return; }
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.error("Use a PNG or JPG banner."); return; }
    if (file.size > 3_000_000) { toast.error("Banner images must be 3 MB or smaller."); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.set("file", file); body.set("creatorWallet", wallet.address); body.set("clientRequestId", crypto.randomUUID());
      const result = await api.upload(body, await ensureAccountSession(wallet.address!,wallet.signMessage));
      update("bannerUrl", result.imageUrl);
      toast.success("Banner uploaded");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "The banner could not be uploaded."); }
    finally { setUploading(false); }
  }
  return <div className="dex-profile-fields"><label>Profile description{optional && <small>Optional</small>}<textarea required={!optional} minLength={optional ? undefined : 20} maxLength={1000} value={profile.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the project for visitors on DEX Screener."/></label><div className="dex-banner-field"><label>Banner image URL{optional && <small>Optional</small>}<input type="url" required={!optional} maxLength={500} value={profile.bannerUrl} onChange={(event) => update("bannerUrl", event.target.value)} placeholder="https://…/banner.png"/></label><div className="dex-banner-upload"><label className={uploading ? "busy" : ""}><ImagePlus/>{uploading ? "Uploading…" : "Upload PNG or JPG"}<input type="file" accept="image/png,image/jpeg" disabled={uploading} onChange={(event) => { void uploadBanner(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>{profile.bannerUrl && validUrl(profile.bannerUrl) && <img src={profile.bannerUrl} alt="Banner preview"/>}</div><small>Use a public URL or upload a PNG/JPG up to 3 MB. The coin artwork remains its icon.</small></div><div className="survey-field-row">{(["websiteUrl", "xUrl", "telegramUrl"] as const).map((key) => <label key={key}>{{ websiteUrl: "Website", xUrl: "X", telegramUrl: "Telegram" }[key]}<input type="url" maxLength={500} value={profile[key]} onChange={(event) => update(key, event.target.value)} placeholder="https://…"/></label>)}</div></div>;
}
