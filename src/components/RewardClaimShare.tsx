import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Download, Loader2, Share2, X } from "lucide-react";
import { api } from "../api";
import { openXComposer, rewardClaimShareText } from "../share";
import "./reward-claim-share.css";

export type SharedRewardClaim = {
  wallet: string;
  network: "devnet" | "mainnet-beta";
  receipts: { name: string; signature: string; amount?: string }[];
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const shortWallet = (wallet: string) => `${wallet.slice(0, 5)}…${wallet.slice(-5)}`;
type History = Awaited<ReturnType<typeof api.claimHistory>>;
function verifiedAmounts(history: History, claim: SharedRewardClaim) {
  const signatures = new Set(claim.receipts.map(receipt => receipt.signature));
  const matched = history.claims.filter(receipt => signatures.has(receipt.signature));
  if (new Set(matched.map(receipt => receipt.signature)).size !== signatures.size || !/^\d+$/.test(history.lifetimeUsdCents ?? "")
    || matched.some(receipt => !/^\d+$/.test(receipt.usd_cents ?? ""))) return null;
  const claimed = matched.reduce((sum, receipt) => sum + BigInt(receipt.usd_cents!), 0n);
  const total = BigInt(history.lifetimeUsdCents!);
  if (claimed <= 0n || total < claimed || claimed > BigInt(Number.MAX_SAFE_INTEGER) || total > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { claimed: Number(claimed), total: Number(total) };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

async function drawCard(claim: SharedRewardClaim, amounts: {claimed:number;total:number}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 675;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const bg = ctx.createLinearGradient(0, 0, 1200, 675);
  bg.addColorStop(0, "#061c35"); bg.addColorStop(.6, "#073c57"); bg.addColorStop(1, "#087790");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1200, 675);
  ctx.strokeStyle = "#38dce833"; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(1050, 580, 120 + i * 95, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke(); }
  for (const [x, y, r] of [[1010, 110, 8], [980, 190, 5], [1080, 315, 14], [850, 290, 6], [1130, 465, 7]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = "#b4faff55"; ctx.fill();
  }
  rounded(ctx, 38, 38, 1124, 599, 36); ctx.fillStyle = "#ffffff0d"; ctx.fill(); ctx.strokeStyle = "#b1f6ff33"; ctx.stroke();
  try {
    const logo = new Image(); logo.src = `${import.meta.env.BASE_URL}aqua-logo.png`;
    await new Promise<void>((resolve, reject) => { logo.onload = () => resolve(); logo.onerror = () => reject(); });
    ctx.save(); rounded(ctx, 84, 76, 64, 64, 16); ctx.clip(); ctx.drawImage(logo, 84, 76, 64, 64); ctx.restore();
  } catch { ctx.beginPath(); ctx.arc(116, 108, 32, 0, Math.PI * 2); ctx.fillStyle = "#40d8e7"; ctx.fill(); }
  ctx.fillStyle = "#efffff"; ctx.font = "800 36px Arial, sans-serif"; ctx.fillText("AQUA", 166, 120);
  ctx.fillStyle = "#8fe1eb"; ctx.font = "700 19px Arial, sans-serif"; ctx.fillText("HOLDER REWARDS · USD VALUE WHEN ALLOCATED", 85, 211);
  ctx.fillStyle = "#ffffff"; ctx.font = "800 51px Arial, sans-serif"; ctx.fillText("Rewards received", 82, 273);
  ctx.fillStyle = "#7ee8de"; ctx.font = "800 112px Arial, sans-serif"; ctx.fillText(money(amounts.claimed), 76, 396);
  ctx.fillStyle = "#b8d9e4"; ctx.font = "22px Arial, sans-serif";
  const title = claim.receipts.length === 1 ? claim.receipts[0].name : `${claim.receipts.length} reward claims`;
  ctx.fillText(`${title.slice(0, 42)}  ·  ${shortWallet(claim.wallet)}`, 85, 447);
  if (claim.receipts.length === 1 && claim.receipts[0].amount) {
    ctx.fillStyle = "#e1f9f8"; ctx.font = "700 20px Arial, sans-serif";
    ctx.fillText(`${claim.receipts[0].amount} paid to your wallet`.slice(0, 75), 85, 478);
  }
  ctx.fillStyle = "#81d0dc"; ctx.font = "700 19px Arial, sans-serif"; ctx.fillText("TOTAL REWARDS CLAIMED", 85, 512);
  ctx.fillStyle = "#ffffff"; ctx.font = "800 45px Arial, sans-serif"; ctx.fillText(money(amounts.total), 85, 559);
  ctx.fillStyle = "#accbd7"; ctx.font = "18px Arial, sans-serif";
  ctx.fillText("aquafamily.fun", 85, 606);
  ctx.textAlign = "right"; ctx.fillText(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), 1115, 606);
  return canvas.toDataURL("image/png");
}

export function RewardClaimShare({ claim, onClose }: { claim: SharedRewardClaim; onClose: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [amounts,setAmounts]=useState<{claimed:number;total:number}|null>(null);
  const [retry,setRetry]=useState(0);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const receiptIds=claim.receipts.map(receipt=>receipt.signature).join(":");
  useEffect(() => {
    let active = true;
    setError("");setImage(null);setAmounts(null);
    api.claimHistory(claim.wallet).then(history => {
      const confirmed=verifiedAmounts(history,claim);
      if(!confirmed)throw new Error(history.lifetimeUsdCents===null
        ? "Some past rewards have no recorded dollar value yet. An accurate lifetime total is unavailable."
        : "Claim totals are still syncing. Try again in a moment.");
      if(active)setAmounts(confirmed);
      return drawCard(claim,confirmed);
    })
      .then(url => { if (active) setImage(url); })
      .catch(e => { if (active) setError(e instanceof Error?e.message:"Could not load your rewards. Try again."); });
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", escape);
    return () => { active = false; document.removeEventListener("keydown", escape); };
  }, [claim.wallet, receiptIds, retry]);
  const receipt = claim.receipts[claim.receipts.length - 1];
  return createPortal(<div className="reward-share-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="reward-share-dialog" role="dialog" aria-modal="true" aria-label="Share your reward">
      <button className="reward-share-close" onClick={onClose} aria-label="Close"><X size={20}/></button>
      <span className="reward-share-eyebrow">CLAIM CONFIRMED</span>
      <h2>Share your rewards</h2>
      <div className="reward-share-preview">{image ? <img src={image} alt={`AQUA rewards received: ${money(amounts!.claimed)}; all-time rewards: ${money(amounts!.total)}`}/> : error ? <p role="alert">{error} <button className="soft-button" onClick={()=>setRetry(n=>n+1)}>Refresh totals</button></p> : <Loader2 className="spin" aria-label="Loading confirmed rewards"/>}</div>
      <p>{amounts?"Post on X, then attach your saved image.":"Loading your confirmed reward totals…"}</p>
      <div className="reward-share-actions">
        <button className="primary" disabled={!amounts} onClick={() => { if(amounts)openXComposer(rewardClaimShareText(money(amounts.claimed),money(amounts.total))); }}><Share2 size={17}/> Post on X</button>
        <a className="soft-button" href={image ?? undefined} download="aqua-rewards.png" aria-disabled={!image} onClick={e => { if (!image) e.preventDefault(); }}><Download size={17}/> Save image</a>
      </div>
      <a className="reward-share-receipt" href={`https://solscan.io/tx/${receipt.signature}${claim.network === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={14}/></a>
    </section>
  </div>, document.body);
}
