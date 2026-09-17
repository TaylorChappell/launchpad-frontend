import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Check, Crown, ExternalLink, FilePenLine, Gavel, Loader2, Plus, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { useRuntime, useWallet } from "../context";
import type { Launch, MarketGovernanceResponse, MarketProposal, MarketProposalType } from "../types";

const labels: Record<MarketProposalType, { title: string; copy: string }> = {
  dex_payment: { title: "Fund DEX profile", copy: "After a successful vote, 80% of incoming market rewards funds the verified $300 DEX payment. The other 20% continues to holders." },
  dex_update: { title: "Update DEX profile", copy: "Vote on an exact description, banner and link update before AQUA submits it." },
  cto: { title: "Community takeover", copy: "Nominate a community lead and public multisig. Rejected CTO votes enter a seven-day cooldown." },
};

function countdown(at: number, now: number) {
  const seconds = Math.max(0, at - now);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function ProposalIcon({ type }: { type: MarketProposalType }) {
  return <span className={`proposal-icon ${type}`}>{type === "dex_payment" ? <BadgeDollarSign/> : type === "dex_update" ? <FilePenLine/> : <Crown/>}</span>;
}

function ProposalCard({ proposal, vote, now, busy, onVote, onDetails, onChallenge, network }: {
  proposal: MarketProposal;
  vote?: "yes" | "no";
  now: number;
  busy: boolean;
  onVote: (proposal: MarketProposal, choice: "yes" | "no") => void;
  onDetails: (proposal: MarketProposal) => void;
  onChallenge: (proposal: MarketProposal) => void;
  network: string;
}) {
  const yes = BigInt(proposal.yesPowerRaw || "0");
  const no = BigInt(proposal.noPowerRaw || "0");
  const total = yes + no;
  const yesPercent = total ? Number(yes * 10_000n / total) / 100 : 0;
  const voting = proposal.status === "voting";
  const detailsSubmitted = Boolean(proposal.payload.detailsSubmittedAt);
  return <article className={`market-proposal-card ${proposal.type} ${proposal.status}`}>
    <header><ProposalIcon type={proposal.type}/><div><b>{labels[proposal.type].title}</b><span>{proposal.status.replaceAll("_", " ")}</span></div>{voting && <time>{countdown(proposal.endsAt, now)}</time>}</header>
    <p>{String(proposal.payload.reason ?? labels[proposal.type].copy)}</p>
    {voting && <><div className="proposal-vote-bar"><i style={{ width: `${yesPercent}%` }}/></div><div className="proposal-vote-totals"><span>Yes {yesPercent.toFixed(0)}%</span><span>{proposal.eligibleVoters} eligible voter{proposal.eligibleVoters === 1 ? "" : "s"}</span><span>No {(100 - yesPercent).toFixed(0)}%</span></div><div className="proposal-actions"><button className={vote === "yes" ? "selected yes" : "yes"} disabled={busy} onClick={() => onVote(proposal, "yes")}><Check/>Yes</button><button className={vote === "no" ? "selected no" : "no"} disabled={busy} onClick={() => onVote(proposal, "no")}><X/>No</button></div></>}
    {proposal.type === "dex_payment" && proposal.status === "funding" && <div className="dex-fund-progress"><div><span>DEX fund</span><b>${proposal.fundedUsd.toFixed(2)} / ${proposal.targetUsd.toFixed(0)}</b></div><progress value={proposal.fundedUsd} max={proposal.targetUsd}/><small>80% to DEX · 20% to holder rewards</small></div>}
    {proposal.type === "dex_payment" && ["voting", "funding"].includes(proposal.status) && !detailsSubmitted && proposal.detailsDeadlineAt && <button className="proposal-detail-button" onClick={() => onDetails(proposal)}>Creator: submit DEX details · {countdown(proposal.detailsDeadlineAt, now)}</button>}
    {["funding", "approved", "ready"].includes(proposal.status) && <button className="proposal-challenge-button" onClick={() => onChallenge(proposal)}><ShieldAlert/>Challenge evidence {proposal.openChallenges ? `(${proposal.openChallenges})` : ""}</button>}
    {proposal.withdrawalSignature && <a className="proposal-proof" href={`https://solscan.io/tx/${proposal.withdrawalSignature}${network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer">Withdrawal proof <ExternalLink/></a>}
  </article>;
}

export function MarketProposals({ launch }: { launch: Launch }) {
  const wallet = useWallet();
  const { config } = useRuntime();
  const [data, setData] = useState<MarketGovernanceResponse | null>(null);
  const [open, setOpen] = useState<"create" | "details" | "challenge" | null>(null);
  const [selected, setSelected] = useState<MarketProposal | null>(null);
  const [type, setType] = useState<MarketProposalType>("dex_payment");
  const [form, setForm] = useState({ reason: "", description: "", bannerUrl: "", websiteUrl: "", xUrl: "", telegramUrl: "", communityLead: "", multisig: "" });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));

  const load = useCallback(() => api.marketGovernance(launch.id, wallet.address).then(setData).catch((error) => toast.error(error instanceof Error ? error.message : "Proposals could not be loaded.")), [launch.id, wallet.address]);
  useEffect(() => { void load(); const poll = window.setInterval(load, 20_000); return () => window.clearInterval(poll); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1_000)), 1_000); return () => window.clearInterval(timer); }, []);
  const active = useMemo(() => data?.proposals.find((proposal) => ["voting", "funding", "approved", "ready", "withdrawing", "withdrawn"].includes(proposal.status)), [data]);

  const ensureWallet = () => {
    if (wallet.address) return wallet.address;
    wallet.setModalOpen(true);
    return null;
  };

  async function signed(action: "create" | "vote" | "details" | "challenge", proposalId: string | undefined, content: unknown) {
    const address = ensureWallet();
    if (!address) throw new Error("Connect a wallet first.");
    const challenge = await api.marketProposalChallenge(launch.id, { action, wallet: address, proposalId, content });
    const signature = await wallet.signMessage(challenge.message);
    return { wallet: address, challenge: challenge.challenge, ...signature };
  }

  async function createProposal() {
    const payload: Record<string, unknown> = { reason: form.reason.trim() };
    if (type === "dex_update") Object.assign(payload, { description: form.description, bannerUrl: form.bannerUrl, websiteUrl: form.websiteUrl, xUrl: form.xUrl, telegramUrl: form.telegramUrl });
    if (type === "cto") Object.assign(payload, { communityLead: form.communityLead, multisig: form.multisig, description: form.description, websiteUrl: form.websiteUrl, xUrl: form.xUrl });
    if (form.reason.trim().length < 20) return toast.error("Add a clear reason of at least 20 characters.");
    setBusy(true);
    try {
      const approval = await signed("create", undefined, { type, payload });
      setData(await api.createMarketProposal(launch.id, { ...approval, type, payload }));
      setOpen(null); toast.success("Proposal opened");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Proposal could not be created."); }
    finally { setBusy(false); }
  }

  async function vote(proposal: MarketProposal, choice: "yes" | "no") {
    setBusy(true);
    try {
      const approval = await signed("vote", proposal.id, { choice });
      setData(await api.voteMarketProposal(launch.id, proposal.id, { ...approval, choice }));
      toast.success(`Vote recorded: ${choice}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Vote could not be recorded."); }
    finally { setBusy(false); }
  }

  async function submitDetails() {
    if (!selected) return;
    const details = { description: form.description, bannerUrl: form.bannerUrl, websiteUrl: form.websiteUrl, xUrl: form.xUrl, telegramUrl: form.telegramUrl };
    if (!form.description.trim() || !form.bannerUrl.trim()) return toast.error("Add the DEX description and banner URL.");
    setBusy(true);
    try {
      const approval = await signed("details", selected.id, details);
      setData(await api.submitDexDetails(launch.id, selected.id, { ...approval, details }));
      setOpen(null); toast.success("DEX details submitted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Details could not be submitted."); }
    finally { setBusy(false); }
  }

  async function submitChallenge() {
    if (!selected || form.reason.trim().length < 20) return toast.error("Explain the challenge in at least 20 characters.");
    const content = { reason: form.reason.trim() };
    setBusy(true);
    try {
      const approval = await signed("challenge", selected.id, content);
      setData(await api.challengeMarketProposal(launch.id, selected.id, { ...approval, ...content }));
      setOpen(null); toast.success("Challenge submitted for admin review");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Challenge could not be submitted."); }
    finally { setBusy(false); }
  }

  function showDetails(proposal: MarketProposal) { setSelected(proposal); setForm((current) => ({ ...current, reason: "" })); setOpen("details"); }
  function showChallenge(proposal: MarketProposal) { setSelected(proposal); setForm((current) => ({ ...current, reason: "" })); setOpen("challenge"); }

  if (!data) return <section className="market-proposals loading"><Loader2 className="spin"/>Loading community proposals</section>;
  if (!data.enabled) return <section className="market-proposals disabled"><Gavel/><div><b>AQUA market governance</b><span>{data.disabledReason}</span></div></section>;
  return <>
    <section className="market-proposals">
      <header><div><Gavel/><span><b>Community proposals</b><small>Holder-governed DEX and CTO actions</small></span></div>{!active && <button disabled={Boolean(wallet.address) && !data.createPower?.eligible} onClick={() => ensureWallet() && setOpen("create")}><Plus/>Create proposal</button>}</header>
      {!active && <div className="proposal-empty"><span>No active vote</span><p>Eligible holders can open a DEX payment, DEX update or community takeover proposal.</p>{wallet.address && !data.createPower?.eligible && <small>Creation requires 0.5% current and time-weighted holdings.</small>}</div>}
      {active && <ProposalCard proposal={active} vote={data.votes[active.id]} now={now} busy={busy} onVote={(proposal, choice) => void vote(proposal, choice)} onDetails={showDetails} onChallenge={showChallenge} network={config.network}/>} 
      {data.proposals.filter((proposal) => proposal.id !== active?.id).length > 0 && <details className="proposal-history"><summary>Previous proposals ({data.proposals.length - (active ? 1 : 0)})</summary>{data.proposals.filter((proposal) => proposal.id !== active?.id).slice(0, 8).map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} vote={data.votes[proposal.id]} now={now} busy={busy} onVote={(item, choice) => void vote(item, choice)} onDetails={showDetails} onChallenge={showChallenge} network={config.network}/>)}</details>}
    </section>
    {open && <div className="proposal-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(null)}><section className="proposal-modal"><button className="proposal-modal-close" onClick={() => setOpen(null)}><X/></button>
      {open === "create" && <><small>MARKET GOVERNANCE</small><h2>Create a proposal</h2><div className="proposal-type-grid">{(Object.keys(labels) as MarketProposalType[]).map((item) => <button key={item} className={type === item ? `selected ${item}` : item} disabled={item === "dex_payment" && data.dexPaid} onClick={() => setType(item)}><ProposalIcon type={item}/><b>{labels[item].title}</b><span>{item === "dex_payment" && data.dexPaid ? "Already paid" : labels[item].copy}</span></button>)}</div><label>Why should holders approve this?<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Give holders the facts they need to decide."/></label>{type === "dex_update" && <ProfileFields form={form} setForm={setForm}/>} {type === "cto" && <><label>Proposed community lead<input value={form.communityLead} onChange={(event) => setForm({ ...form, communityLead: event.target.value })} placeholder="Name or wallet"/></label><label>Community multisig<input value={form.multisig} onChange={(event) => setForm({ ...form, multisig: event.target.value })} placeholder="Solana address"/></label><ProfileFields form={form} setForm={setForm}/></>}<button className="primary full" disabled={busy} onClick={() => void createProposal()}>{busy ? <Loader2 className="spin"/> : <Gavel/>}Open vote</button></>}
      {open === "details" && <><small>CREATOR ACTION</small><h2>Submit the DEX profile</h2><p>These exact details stay attached to the approved proposal for the AQUA admin to use.</p><ProfileFields form={form} setForm={setForm}/><button className="primary full" disabled={busy} onClick={() => void submitDetails()}>{busy ? <Loader2 className="spin"/> : <Check/>}Submit details</button></>}
      {open === "challenge" && <><small>HOLDER CHALLENGE</small><h2>Challenge this proposal</h2><p>Identify incorrect details, impersonation, unsafe links or other verifiable evidence. Funding cannot be withdrawn while the challenge is open.</p><label>Evidence or reason<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Be specific. Include public evidence links where possible."/></label><button className="primary full" disabled={busy} onClick={() => void submitChallenge()}>{busy ? <Loader2 className="spin"/> : <ShieldAlert/>}Submit challenge</button></>}
    </section></div>}
  </>;
}

type Form = { reason: string; description: string; bannerUrl: string; websiteUrl: string; xUrl: string; telegramUrl: string; communityLead: string; multisig: string };
function ProfileFields({ form, setForm }: { form: Form; setForm: (value: Form) => void }) {
  return <div className="proposal-profile-fields"><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="The exact DEX profile description"/></label><label>Banner URL<input value={form.bannerUrl} onChange={(event) => setForm({ ...form, bannerUrl: event.target.value })} placeholder="https://…"/></label><label>Website<input value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://…"/></label><label>X profile<input value={form.xUrl} onChange={(event) => setForm({ ...form, xUrl: event.target.value })} placeholder="https://x.com/…"/></label><label>Telegram<input value={form.telegramUrl} onChange={(event) => setForm({ ...form, telegramUrl: event.target.value })} placeholder="https://t.me/…"/></label></div>;
}
