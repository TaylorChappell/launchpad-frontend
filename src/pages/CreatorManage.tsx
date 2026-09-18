import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { TokenMark } from "../components/TokenCard";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { CreatorLock, CreatorLockTransactionEnvelope, Launch } from "../types";
import { solscanAccountUrl } from "../creator-lock";
import { creatorLockShareText, openXComposer } from "../share";

function formatRaw(raw: string | undefined, decimals: number) {
  const value = String(raw ?? "0").replace(/^0+/, "") || "0";
  if (!decimals) return value;
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, 6);
  return fraction ? whole + "." + fraction : whole;
}

export function CreatorManage() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const { config } = useRuntime();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [lock, setLock] = useState<CreatorLock | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState("");
  const [availableRaw, setAvailableRaw] = useState<string | null>(null);
  const maximumDays = Math.max(1, Math.floor(config.creatorLocks.maximumSeconds / 86_400));
  const minimumDays = Math.max(1, Math.ceil(config.creatorLocks.minimumSeconds / 86_400));
  const [days, setDays] = useState(String(maximumDays));
  const [quoteBps, setQuoteBps] = useState(0);
  const [busy, setBusy] = useState<"lock" | "release" | null>(null);

  async function refresh() {
    const result = await api.launch(id);
    setLaunch(result.launch);
    setLock(result.creatorLock);
  }

  useEffect(() => {
    let active = true;
    api.launch(id).then((result) => { if (active) { setLaunch(result.launch); setLock(result.creatorLock); } }).catch(() => undefined).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => setDays(String(maximumDays)), [maximumDays]);

  const enteredDays = Number(days || "0");
  const effectiveDays = Math.min(maximumDays, Math.max(minimumDays, Number.isFinite(enteredDays) ? Math.round(enteredDays) : minimumDays));
  const isCapped = enteredDays > maximumDays;
  const isOwner = Boolean(launch && wallet.address === launch.creatorWallet);
  const amountRaw = useMemo(() => { try { return launch && amount ? decimalToRaw(amount, launch.tokenDecimals) : "0"; } catch { return "0"; } }, [amount, launch]);
  const exceedsAvailable = availableRaw !== null && BigInt(amountRaw || "0") > BigInt(availableRaw);
  const amountPercent = launch && Number(launch.totalSupplyRaw) > 0 ? Number(amountRaw) / Number(launch.totalSupplyRaw) * 100 : 0;
  const targetPercent = (config.creatorLocks.targetSupplyBps ?? 500) / 100;
  const amountProgress = Math.min(100, amountPercent / targetPercent * 100);
  const timeProgress = Math.min(100, effectiveDays / maximumDays * 100);
  const effectiveTradeShare = config.fees.platformBps / 100 * quoteBps / 10_000;
  const activeTradeShare = config.fees.platformBps / 100 * (lock?.feeShareBps ?? 0) / 10_000;

  useEffect(() => {
    let active = true;
    if (!launch || !isOwner || lock?.status === "active") { setAvailableRaw(null); return () => { active = false; }; }
    setAvailableRaw(null);
    api.creatorLockBalance(launch.id, launch.creatorWallet)
      .then((balance) => { if (active) setAvailableRaw(balance.availableRaw); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Could not read the creator token balance."); });
    return () => { active = false; };
  }, [isOwner, launch, lock?.status]);

  useEffect(() => {
    if (!launch || !isOwner || BigInt(amountRaw || "0") <= 0n || exceedsAvailable) { setQuoteBps(0); return; }
    const timer = window.setTimeout(() => { api.creatorFeeQuote(amountRaw, launch.totalSupplyRaw, effectiveDays * 86_400).then((quote) => setQuoteBps(quote.feeShareBps)).catch(() => setQuoteBps(0)); }, 220);
    return () => window.clearTimeout(timer);
  }, [amountRaw, effectiveDays, exceedsAvailable, isOwner, launch]);

  async function act(action: "lock" | "release") {
    if (!launch || !wallet.address || !isOwner) return;
    if (action === "lock" && availableRaw !== null && BigInt(amountRaw || "0") > BigInt(availableRaw)) {
      toast.error(`You only have ${formatRaw(availableRaw, launch.tokenDecimals)} ${launch.symbol} available to lock.`);
      return;
    }
    setBusy(action);
    try {
      const envelope = action === "lock"
        ? await api.creatorLockTransaction(launch.id, wallet.address, amountRaw, effectiveDays * 86_400)
        : await api.creatorLockReleaseTransaction(launch.id, wallet.address);
      const lockEnvelope = action === "lock" ? envelope as CreatorLockTransactionEnvelope : null;
      const estimatedLockedRaw = lockEnvelope?.estimatedLockedRaw ?? null;
      const issuedVaultTokenAccount = lockEnvelope?.vaultTokenAccount ?? null;
      const signature = await wallet.sendTransaction(envelope);
      let indexed = false;
      let confirmedLock: CreatorLock | null = null;
      try {
        const confirmation = await api.confirmCreatorLock(launch.id, wallet.address, signature);
        setLock(confirmation.creatorLock);
        confirmedLock = confirmation.creatorLock;
        indexed = true;
      } catch {
        // The background on-chain scanner will recover a confirmed transaction if RPC indexing lags.
      }
      const successMessage = (action === "lock" ? "Creator lock confirmed" : "Creator tokens released") + " · " + signature.slice(0, 7) + "…" + signature.slice(-6);
      const vaultTokenAccount = confirmedLock?.vaultTokenAccount ?? issuedVaultTokenAccount;
      if (action === "lock" && vaultTokenAccount) {
        const lockUrl = solscanAccountUrl(vaultTokenAccount, config.network);
        const lockedRaw = confirmedLock?.amountRaw ?? estimatedLockedRaw ?? amountRaw;
        const shareText = creatorLockShareText({ amount: formatRaw(lockedRaw, launch.tokenDecimals), symbol: launch.symbol, lockUrl });
        toast.success(successMessage, {
          description: "Share your verified creator lock on X.",
          duration: 12_000,
          action: { label: "Post on X", onClick: () => openXComposer(shareText) },
        });
      } else {
        toast.success(successMessage);
      }
      if (!indexed) {
        toast.info("The on-chain lock is confirmed and will appear after the next index pass.");
        await refresh();
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Creator action failed."); }
    finally { setBusy(null); }
  }

  if (!launch && loaded) return <main className="page empty-state"><h2>Coin not found</h2><Link className="primary" to="/">Back to markets</Link></main>;
  if (!launch) return <main className="page"><div className="page-loading">Opening creator manager…</div></main>;

  if (!wallet.address) return <main className="page manage-page"><Link className="back" to={"/token/" + launch.id}><ArrowLeft/>Back to {launch.symbol}</Link><section className="manage-gate"><h1>Connect the creator wallet</h1><p>Connect {launch.creatorWallet.slice(0, 6)}…{launch.creatorWallet.slice(-6)} to manage this coin.</p><button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button></section></main>;
  if (!isOwner) return <main className="page manage-page"><Link className="back" to={"/token/" + launch.id}><ArrowLeft/>Back to {launch.symbol}</Link><section className="manage-gate"><h1>This wallet is not the creator</h1><p>Switch to the wallet that launched {"$" + launch.symbol} to manage its creator lock and fees.</p></section></main>;

  return <main className="page manage-page">
    <Link className="back" to={"/token/" + launch.id}><ArrowLeft/>Back to market</Link>
    <section className="manage-hero">
      <div className="manage-hero-identity"><TokenMark launch={launch} large/><span><h1>Manage {"$" + launch.symbol}</h1><p>Lock tokens to earn creator fees, paid automatically in SOL.</p></span></div>
      <span className="manage-owner-badge">Creator verified</span>
    </section>

    <section className="manage-overview" aria-label="Market management overview">
      <article><small>Creator wallet</small><a href={solscanAccountUrl(launch.creatorWallet, config.network)} target="_blank" rel="noreferrer">{launch.creatorWallet.slice(0, 6)}…{launch.creatorWallet.slice(-6)} <ExternalLink/></a></article>
      <article><small>Trading pair</small><strong>{launch.symbol} / {launch.pairSymbol}</strong></article>
      <article><small>Lock status</small><strong className={lock?.status === "active" ? "status-active" : "status-open"}>{lock?.status === "active" ? "Active" : "No active lock"}</strong></article>
    </section>

    {lock?.status === "active" ? <section className="manage-active-lock">
      <header><h2>Your active lock</h2><strong>{activeTradeShare.toFixed(3)}% per eligible transfer</strong></header>
      <div><span><small>Tokens locked</small><b>{formatRaw(lock.amountRaw, launch.tokenDecimals)} {launch.symbol}</b></span><span><small>Unlock date</small><b>{new Date(lock.unlockAt * 1_000).toLocaleDateString()}</b></span><span><small>Fee settlement</small><b>Paid automatically in SOL</b></span></div>
      <footer><a className="creator-lock-view" href={solscanAccountUrl(lock.vaultTokenAccount, config.network)} target="_blank" rel="noreferrer">View lock on Solscan <ExternalLink/></a><button className="secondary-button" disabled={busy !== null || Math.floor(Date.now()/1_000) < lock.unlockAt} onClick={() => void act("release")}>{busy === "release" && <Loader2 className="spin"/>}Release tokens</button></footer>
    </section> : <div className="manage-grid">
      <section className="manage-builder">
        <header><div><h2>Set up a lock</h2><p>Locking more supply for longer increases your share of the platform fee.</p></div></header>
        <label><span>Creator tokens to lock</span><div className={`manage-input ${exceedsAvailable ? "invalid" : ""}`}><input value={amount} inputMode="decimal" placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>{launch.symbol}</b></div><small className={`creator-lock-balance ${exceedsAvailable ? "cap-warning" : ""}`}><span>{availableRaw === null ? "Reading wallet balance…" : `${formatRaw(availableRaw, launch.tokenDecimals)} ${launch.symbol} available · ${amountPercent.toFixed(amountPercent < .01 ? 4 : 2)}% of supply`}</span>{availableRaw !== null && BigInt(availableRaw) > 0n && <button type="button" onClick={() => setAmount(formatRaw(availableRaw, launch.tokenDecimals))}>Max</button>}</small></label>
        <label><span>Lock duration</span><div className="manage-input"><input value={days} inputMode="numeric" onChange={(event) => setDays(event.target.value.replace(/[^0-9]/g, ""))}/><b>days</b></div><small className={isCapped ? "cap-warning" : ""}>{isCapped ? `Using the maximum ${maximumDays}-day score` : `${minimumDays} to ${maximumDays} days`}</small></label>
        <div className="duration-presets">{[30,90,180,maximumDays].filter((value,index,array) => value >= minimumDays && array.indexOf(value) === index).map((value) => <button key={value} className={effectiveDays === value ? "active" : ""} onClick={() => setDays(String(value))}>{value === maximumDays ? "Max · " + value + "d" : value + " days"}</button>)}</div>
        <div className="score-bars"><div><span><b>Locked supply</b><small>{amountPercent.toFixed(amountPercent < .01 ? 4 : 2)}% / {targetPercent}% target</small></span><i><b style={{width: amountProgress + "%"}}/></i></div><div><span><b>Lock duration</b><small>{effectiveDays} / {maximumDays} days</small></span><i><b style={{width: timeProgress + "%"}}/></i></div></div>
        <p className="manage-security-note">You can release your tokens after the lock expires.</p>
      </section>
      <aside className="manage-quote">
        <h2>Your creator fee</h2><strong>{effectiveTradeShare.toFixed(3)}%</strong><p>of each eligible transfer while your creator lock is active.</p>
        <dl><div><dt>Locked supply</dt><dd>{amountPercent.toFixed(amountPercent < .01 ? 4 : 2)}%</dd></div><div><dt>Duration</dt><dd>{effectiveDays} days</dd></div><div><dt>Settlement</dt><dd>Automatic · SOL</dd></div></dl>
        <button className="primary full" disabled={busy !== null || availableRaw === null || BigInt(amountRaw || "0") <= 0n || exceedsAvailable} onClick={() => void act("lock")}>{busy === "lock" && <Loader2 className="spin"/>}Review lock in wallet</button>
      </aside>
    </div>}
  </main>;
}
