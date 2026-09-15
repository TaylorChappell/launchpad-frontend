import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { TokenMark } from "../components/TokenCard";
import { useRuntime, useWallet } from "../context";
import { decimalToRaw } from "../launch";
import type { CreatorLock, Launch } from "../types";

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
  const maximumDays = Math.max(1, Math.floor(config.creatorLocks.maximumSeconds / 86_400));
  const minimumDays = Math.max(1, Math.ceil(config.creatorLocks.minimumSeconds / 86_400));
  const [days, setDays] = useState(String(maximumDays));
  const [quoteBps, setQuoteBps] = useState(0);
  const [busy, setBusy] = useState<"lock" | "release" | "claim" | null>(null);

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
  const amountPercent = launch && Number(launch.totalSupplyRaw) > 0 ? Number(amountRaw) / Number(launch.totalSupplyRaw) * 100 : 0;
  const targetPercent = (config.creatorLocks.targetSupplyBps ?? 500) / 100;
  const amountProgress = Math.min(100, amountPercent / targetPercent * 100);
  const timeProgress = Math.min(100, effectiveDays / maximumDays * 100);
  const effectiveTradeShare = config.fees.platformBps / 100 * quoteBps / 10_000;
  const activeTradeShare = config.fees.platformBps / 100 * (lock?.feeShareBps ?? 0) / 10_000;

  useEffect(() => {
    if (!launch || !isOwner || BigInt(amountRaw || "0") <= 0n) { setQuoteBps(0); return; }
    const timer = window.setTimeout(() => { api.creatorFeeQuote(amountRaw, launch.totalSupplyRaw, effectiveDays * 86_400).then((quote) => setQuoteBps(quote.feeShareBps)).catch(() => setQuoteBps(0)); }, 220);
    return () => window.clearTimeout(timer);
  }, [amountRaw, effectiveDays, isOwner, launch]);

  async function act(action: "lock" | "release" | "claim") {
    if (!launch || !wallet.address || !isOwner) return;
    setBusy(action);
    try {
      const envelope = action === "lock"
        ? await api.creatorLockTransaction(launch.id, wallet.address, amountRaw, effectiveDays * 86_400)
        : action === "release" ? await api.creatorLockReleaseTransaction(launch.id, wallet.address) : await api.creatorFeesClaimTransaction(launch.id, wallet.address);
      const signature = await wallet.sendTransaction(envelope);
      toast.success((action === "lock" ? "Creator lock confirmed" : action === "release" ? "Creator tokens released" : "Creator fees claimed") + " · " + signature.slice(0, 7) + "…" + signature.slice(-6));
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Creator action failed."); }
    finally { setBusy(null); }
  }

  if (!launch && loaded) return <main className="page empty-state"><h2>Coin not found</h2><Link className="primary" to="/">Back to markets</Link></main>;
  if (!launch) return <main className="page"><div className="page-loading">Opening creator manager…</div></main>;

  if (!wallet.address) return <main className="page manage-page"><Link className="back" to={"/token/" + launch.id}><ArrowLeft/>Back to {launch.symbol}</Link><section className="manage-gate"><WalletCards/><h1>Connect the creator wallet</h1><p>Connect {launch.creatorWallet.slice(0, 6)}…{launch.creatorWallet.slice(-6)} to manage this coin.</p><button className="primary" onClick={() => wallet.setModalOpen(true)}>Connect wallet</button></section></main>;
  if (!isOwner) return <main className="page manage-page"><Link className="back" to={"/token/" + launch.id}><ArrowLeft/>Back to {launch.symbol}</Link><section className="manage-gate"><ShieldCheck/><h1>This wallet is not the creator</h1><p>Switch to the wallet that launched {"$" + launch.symbol} to manage its creator lock and fees.</p></section></main>;

  return <main className="page manage-page">
    <Link className="back" to={"/token/" + launch.id}><ArrowLeft/>Back to market</Link>
    <section className="manage-hero"><div><TokenMark launch={launch} large/><span><small>CREATOR MANAGER</small><h1>Manage {"$" + launch.symbol}</h1><p>Set up a transparent creator lock, preview the fee share, and claim accrued creator fees.</p></span></div><div className="manage-status"><i/><span><b>{launch.status === "live" ? "Market live" : "Launch in progress"}</b><small>{launch.pairSymbol} pair · {launch.stockSymbol} rewards</small></span></div></section>

    <div className="manage-steps"><span className={lock?.status === "active" ? "done" : "active"}><i>{lock?.status === "active" ? <Check/> : "1"}</i><b>1. Configure lock</b></span><span className={lock?.status === "active" ? "active" : ""}><i>2</i><b>2. Earn & claim</b></span></div>

    {lock?.status === "active" ? <section className="manage-active-lock">
      <header><span><LockKeyhole/><small>ACTIVE CREATOR LOCK</small></span><strong>{activeTradeShare.toFixed(3)}% per eligible transfer</strong></header>
      <div><span><small>Tokens locked</small><b>{formatRaw(lock.amountRaw, launch.tokenDecimals)} {launch.symbol}</b></span><span><small>Unlock date</small><b>{new Date(lock.unlockAt * 1_000).toLocaleDateString()}</b></span><span><small>Current creator fees</small><b>{formatRaw(launch.creatorFeesAccruedRaw, 9)} SOL</b></span></div>
      <footer><button className="secondary-button" disabled={busy !== null || Math.floor(Date.now()/1_000) < lock.unlockAt} onClick={() => void act("release")}>{busy === "release" && <Loader2 className="spin"/>}Release after maturity</button><button className="primary" disabled={busy !== null || BigInt(launch.creatorFeesAccruedRaw || "0") === 0n} onClick={() => void act("claim")}>{busy === "claim" && <Loader2 className="spin"/>}Claim creator fees</button></footer>
    </section> : <div className="manage-grid">
      <section className="manage-builder">
        <header><small>STEP 1</small><h2>Build your creator lock</h2><p>Choose the token amount and lock duration.</p></header>
        <label><span>Creator tokens to lock</span><div className="manage-input"><input value={amount} inputMode="decimal" placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}/><b>{launch.symbol}</b></div><small>{amountPercent.toFixed(amountPercent < .01 ? 4 : 2)}% of total supply</small></label>
        <label><span>Lock duration</span><div className="manage-input"><input value={days} inputMode="numeric" onChange={(event) => setDays(event.target.value.replace(/[^0-9]/g, ""))}/><b>days</b></div><small className={isCapped ? "cap-warning" : ""}>{isCapped ? `Using the maximum ${maximumDays}-day score` : `${minimumDays} to ${maximumDays} days`}</small></label>
        <div className="duration-presets">{[30,90,180,maximumDays].filter((value,index,array) => value >= minimumDays && array.indexOf(value) === index).map((value) => <button key={value} className={effectiveDays === value ? "active" : ""} onClick={() => setDays(String(value))}>{value === maximumDays ? "Max · " + value + "d" : value + " days"}</button>)}</div>
        <div className="score-bars"><div><span><b>Amount score</b></span><i><b style={{width: amountProgress + "%"}}/></i></div><div><span><b>Time score</b></span><i><b style={{width: timeProgress + "%"}}/></i></div></div>
      </section>
      <aside className="manage-quote">
        <small>ESTIMATED FEE PER TRANSFER</small><strong>{effectiveTradeShare.toFixed(3)}%</strong><p>of each eligible transfer while the lock is active.</p>
        <button className="primary full" disabled={busy !== null || BigInt(amountRaw || "0") <= 0n} onClick={() => void act("lock")}>{busy === "lock" && <Loader2 className="spin"/>}Review lock in wallet</button>
      </aside>
    </div>}
  </main>;
}
