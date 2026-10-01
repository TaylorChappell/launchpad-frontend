import { WalletIdentity } from "../components/WalletIdentity";
import "./how-it-works.css";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  Gift,
  Gamepad2,
  Globe2,
  Image as ImageIcon,
  Landmark,
  Layers3,
  LockKeyhole,
  PanelsTopLeft,
  RefreshCw,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageBubbles } from "../components/PageBubbles";
import { DexScreenerIcon } from "../components/DexScreenerIcon";
import { RewardModeIcon } from "../components/RewardModeIcon";
import { useRuntime } from "../context";
import { usePromotion } from "../usePromotion";
import { AQUA_PUBLIC_API_ORIGIN } from "../api-origin";

const navigation = [
  {
    label: "The protocol",
    items: [
      ["what-is-aqua", "What AQUA is"],
      ["onchain", "What is on chain"],
      ["wallets", "Connecting your wallet"],
      ["connected-accounts", "X and GitHub connections"],
      ["appearance", "Light and dark mode"],
    ],
  },
  {
    label: "Launching",
    items: [
      ["launch-flow", "What a launch creates"],
      ["launch-recovery", "Interrupted launches"],
      ["liquidity", "How liquidity works"],
      ["launch-cost", "What launching costs"],
      ["pair-choice", "Pairs and first buys"],
    ],
  },
  {
    label: "Atlantis Studio",
    items: [
      ["atlantis-studio", "Building with Atlantis"],
      ["website-publishing", "Publishing and variables"],
    ],
  },
  {
    label: "Fees and rewards",
    items: [
      ["trading-fees", "Coin trading fees"],
      ["settlement", "How fees are settled"],
      ["reward-modes", "The four reward modes"],
      ["fee-redirect", "Fee Redirect and claim links"],
      ["holder-rewards", "How rewards are calculated"],
      ["claiming", "Claiming rewards"],
      ["auto-rewards", "Automatic payouts"],
      ["address-claims", "Claim without connecting"],
      ["ripple-rewards", "Ripple Rewards"],
    ],
  },
  {
    label: "Market governance",
    items: [
      ["dex-funding", "DEX Funding Mode"],
      ["market-proposals", "Proposals and voting"],
      ["community-boost", "Community Boost"],
      ["dex-boosts", "DEX boost polls"],
      ["automatic-funds", "Automatic momentum funds"],
      ["community-takeovers", "Community takeovers"],
    ],
  },
  {
    label: "Community",
    items: [["community", "Chat, updates and polls"]],
  },
  {
    label: "Creators",
    items: [
      ["creator-locks", "Creator locks"],
      ["creator-share", "Fee-share formula"],
      ["creator-dashboard", "Managing your coin"],
    ],
  },
  {
    label: "Reference",
    items: [
      ["public-api", "Building with the API"],
      ["numbers", "The fixed numbers"],
      ["accounts", "Programs and accounts"],
      ["risks", "Limits and risks"],
    ],
  },
] as const;

const formatBps = (bps: number) => (bps / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 }) + "%";
const durationLabel = (seconds: number) => {
  if (seconds < 3_600) return Math.round(seconds / 60) + " minutes";
  const hours = Math.round(seconds / 3_600);
  if (hours < 48) return hours + " hours";
  return Math.round(hours / 24) + " days";
};
const solscanAccount = (address: string, useTestnet: boolean) =>
  "https://solscan.io/account/" + address + (useTestnet ? "?cluster=devnet" : "");

export function HowItWorks() {
  const { config } = useRuntime();
  const { promotion, active: freeStudio } = usePromotion();
  const launch = config.launchEconomics;
  const reward = config.rewardDistribution;
  const maximumAllocation = config.fees.platformAllocationAtMaximumCreatorScore ?? {
    treasuryBps: 0,
    buybackBps: 5_000,
    creatorBps: 5_000,
  };
  const totalSupply = Number(launch?.tokenSupply ?? 1_000_000_000).toLocaleString("en-GB");
  const tokenDecimals = launch?.tokenDecimals ?? 6;
  const liquiditySupplyBps = launch?.liquiditySupplyBps ?? 10_000;
  const startMarketCap = launch?.startMarketCapUsd ?? 2_000;
  const targetSupplyBps = config.creatorLocks.targetSupplyBps ?? 500;
  const maximumCreatorShareBps = config.creatorLocks.maximumFeeShareBps;
  const minimumLock = durationLabel(config.creatorLocks.minimumSeconds);
  const maximumLock = durationLabel(config.creatorLocks.maximumSeconds);
  const epochLength = durationLabel(reward?.epochSeconds ?? 1_200);
  const minimumClaim = ((reward?.minimumClaimUsdCents ?? 500) / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
  });
  const launchFeeEnabled = Boolean(config.launchCost && config.launchCost.platformFeeLamports !== "0");

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <main className="how-story-page aqua-docs-page">
    <PageBubbles count={4}/>

    <section className="aqua-docs-hero" id="protocol-reference">
      <h1>Help with <span>AQUA.</span></h1>
      <p>Launch a coin, build with Atlantis, earn rewards or redirect fees to someone else. Find the steps for wallets, claims and community features below.</p>
      <div className="aqua-docs-actions">
        <Link className="primary" to="/create">Launch a coin <ArrowRight size={17}/></Link>
        <button className="secondary-button" onClick={() => scrollTo("launch-flow")}>Read the launch flow</button>
      </div>
      <details className="aqua-docs-basics"><summary>Protocol at a glance</summary><div className="aqua-docs-summary" aria-label="AQUA protocol summary">
        <SummaryStat value={totalSupply} label="Fixed token supply"/>
        <SummaryStat value={formatBps(liquiditySupplyBps)} label="Committed to liquidity"/>
        <SummaryStat value="2–5%" label="Token fee · 2% default"/>
        <SummaryStat value="None" label="AQUA supply reserve"/>
      </div></details>
    </section>

    <section className="help-quick-answers" aria-label="Common questions"><h2>What do you need help with?</h2>
      <details><summary>Why can’t I claim rewards?</summary><p>Open Portfolio → Rewards or Ripple. Rewards must be settled and meet the claim minimum after estimated costs. Keep some SOL for wallet-approved claims. The card shows whether your balance is ready, pending or below the minimum.</p><Link to="/portfolio?tab=rewards">Open rewards</Link></details>
      <details><summary>Someone redirected fees to me. Where do I claim?</summary><p>Open their claim link, connect your wallet and verify the exact X or GitHub account shown if needed. Your coin also appears in Portfolio → Rewards with a Redirected fees badge. You do not need to hold it.</p><button className="text-button" onClick={()=>scrollTo("fee-redirect")}>Read the recipient steps</button></details>
      <details><summary>Where is my Ripple post?</summary><p>Use the X account linked to your wallet, keep your AQUA sign-in active, and hold the coin before posting and at allocation. Include its contract address, AQUA market link or explicit $ticker. For a shared ticker, use the address or market link.</p><Link to="/portfolio?tab=ripple">Check my Ripple posts</Link></details>
      <details><summary>My launch was interrupted. What next?</summary><p>Return to Launch with the original wallet and use Resume launch. AQUA checks completed steps before continuing. Check a submitted transaction before approving another attempt.</p><Link to="/create">Resume launch</Link></details>
      <details><summary>Why didn’t my website publish?</summary><p>Open Publish in Atlantis Studio. Complete missing Variables & Secrets, save changes and retry. Your draft and published version have separate states. A deployment error shows the next action.</p><Link to="/studio">Open Studio</Link></details>
      <details><summary>How do I verify a wallet transaction?</summary><p>Compare the program and accounts with AQUA’s reference before signing. AQUA never needs your seed phrase.</p><button className="text-button" onClick={()=>scrollTo("accounts")}>View official program and accounts</button></details>
    </section>
    <div className="aqua-docs-shell">
      <aside className="aqua-docs-sidebar">
        <div className="aqua-docs-sidebar-inner">
          <span className="aqua-docs-sidebar-title">How it works</span>
          <nav aria-label="How AQUA works sections">
            {navigation.map((group) => <div className="aqua-docs-nav-group" key={group.label}>
              <small>{group.label}</small>
              {group.items.map(([id, label]) => <button key={id} onClick={() => scrollTo(id)}>{label}</button>)}
            </div>)}
          </nav>
        </div>
      </aside>

      <article className="aqua-docs-content">
        <DocSection id="what-is-aqua" eyebrow="THE PROTOCOL" title="What AQUA is">
          <p className="lead">AQUA is a token launchpad built around direct Orca Whirlpool markets. A creator launches a fixed-supply coin, chooses its pair and selects Holder Rewards, Fee Redirect, Buyback & Burn or Hourly Jackpot. Token rewards use the selected pair asset.</p>
          <p>There is no AQUA bonding curve, virtual reserve or off-chain sale inventory. Trading starts in a real Orca pool. The AQUA program validates the launch settings, records the market and controls fee allocation, while Orca executes swaps and holds the pool vaults.</p>
          <div className="aqua-docs-principles">
            <Principle icon={<Waves/>} title="Direct market" text="The coin launches into an Orca Whirlpool instead of moving through a separate AQUA curve."/>
            <Principle icon={<ShieldCheck/>} title="No reserve wallet" text="AQUA does not retain a percentage of the fixed token supply for later sale."/>
            <Principle icon={<Gift/>} title="Holder utility" text="The reward fee funds the coin’s chosen mode. At the default fee, this is half of collected token fees before operating and community allocations."/>
          </div>
          <Callout title="What holder-first means">
            Trading activity funds rewards in the selected pair asset. It does not mean returns are guaranteed. Rewards depend on actual volume, collected fees, conversion conditions and eligible holder weight.
          </Callout>
        </DocSection>

        <DocSection id="onchain" eyebrow="THE PROTOCOL" title="What is on chain">
          <p>The launch mint, metadata reference, Orca pool, pool vaults, permanent position lock, AQUA market account, fee vault, creator lock and published reward epochs are all represented by Solana accounts or transactions.</p>
          <p>The backend prepares transactions and runs the settlement keeper, but your wallet signs launch, trade, lock and claim transactions. The backend cannot spend from a connected wallet without a wallet signature.</p>
          <div className="aqua-docs-checklist">
            <CheckItem>Token supply and mint authority are verifiable.</CheckItem>
            <CheckItem>The Whirlpool address and permanent lock are public.</CheckItem>
            <CheckItem>Fee harvests, allocation withdrawals and reward funding produce transactions.</CheckItem>
            <CheckItem>Every reward epoch publishes its Merkle root and funded amount on chain.</CheckItem>
          </div>
        </DocSection>

        <DocSection id="wallets" eyebrow="THE PROTOCOL" title="Connect the wallet that holds your coins">
          <p>Choose Phantom, MetaMask, Solflare or Jupiter. Use the Solana account that holds your tokens or receives your redirected fees; balances belong to that wallet. Connecting lets AQUA read your public address. Signing in proves ownership, and transactions need a separate wallet approval.</p>
          <p>On a phone, the Phantom connection can open its app to complete the connection. Return to AQUA when prompted. Keep some SOL in the connected account for transaction fees and any account rent, even when your rewards are another token.</p>
        </DocSection>

        <DocSection id="connected-accounts" eyebrow="THE PROTOCOL" title="Connect X and GitHub to your wallet">
          <p>After connecting a wallet, open <strong>Connect accounts</strong> near the wallet button. Choose X, GitHub or both. X supports your public identity, Ripple and redirected rewards. GitHub verifies your identity for redirected rewards.</p>
          <p>Your verified GitHub identity is saved to your AQUA wallet account and survives signing out or changing browsers. Reconnect the same wallet and sign in to use it. Profile verification does not grant repository access; Atlantis asks for the permissions it needs separately when you export.</p>
        </DocSection>

        <DocSection id="appearance" eyebrow="THE PROTOCOL" title="Choose light or dark mode">
          <p>Use the sun or moon button to the right of search. Light mode is the default; dark mode uses deeper ocean blues with matching text, controls and water animations. Your choice is saved in this browser and restored when you return.</p>
        </DocSection>

        <DocSection id="launch-flow" eyebrow="LAUNCHING" title="What a launch creates">
          <p>The launch wizard prepares the required transactions and asks your wallet to approve them. They create the mint and fixed Token-2022 fee, write metadata, register the AQUA market, fund the Orca position and permanently lock liquidity. The number of approvals can vary with the pair, wallet and optional first buy.</p>
          <div className="aqua-docs-timeline">
            <TimelineStep number="01" title="Create the asset" text={"A " + totalSupply + " token supply with " + tokenDecimals + " decimals is created. The mint authority is removed after minting."}/>
            <TimelineStep number="02" title="Register the market" text="The AQUA program validates the pair, fee settings and Orca configuration, then creates the market and fee vault PDAs."/>
            <TimelineStep number="03" title="Fund Orca" text="The full launch allocation is transferred into the one-sided concentrated-liquidity position."/>
            <TimelineStep number="04" title="Lock the position" text="The Orca position is permanently locked. AQUA marks the coin live only after the lock is verified."/>
          </div>
          <Callout title="Why the creator wallet may briefly show the supply">
            The launch uses multiple signed transactions. The newly minted inventory can temporarily sit in the creator’s token account between approvals before it is moved into Orca. That temporary hand-off is not a creator allocation. If the flow is interrupted, AQUA keeps the launch pending instead of presenting it as live.
          </Callout>
        </DocSection>

        <DocSection id="launch-recovery" eyebrow="LAUNCHING" title="If a launch is interrupted">
          <p>Loading a saved draft does not submit or resume a launch. Press <strong>Resume launch</strong> when you want AQUA to check the existing on-chain progress and prepare the remaining steps. Refreshing the page does not approve transactions. Use the X on the resume panel to hide it for that launch in this browser. Hiding the panel does not cancel transactions already submitted.</p>
          <p>A partial launch can already have a mint, so starting over is not an automatic rollback. AQUA keeps it pending until the required launch and lock checks pass. If confirmation is delayed, check the transaction status before retrying.</p>
        </DocSection>

        <DocSection id="liquidity" eyebrow="LAUNCHING" title="How the 100% liquidity model works">
          <p><strong>{formatBps(liquiditySupplyBps)} liquidity</strong> means the full fixed launch supply is committed to the permanent Orca position. It does not mean a block explorer will always show the pool owning 100% after trading begins.</p>
          <div className="aqua-docs-flow">
            <FlowCard icon={<Coins/>} label="At launch" title="The pool starts with launch tokens" text={"The opening market targets roughly a $" + startMarketCap.toLocaleString("en-GB") + " market cap and begins on the launch-token side of the pair."}/>
            <ArrowRight className="aqua-docs-flow-arrow"/>
            <FlowCard icon={<RefreshCw/>} label="When buyers trade" title="Tokens leave the pool" text="Buyers receive launch tokens and the pool receives the selected pair asset. The pool’s token percentage falls naturally."/>
            <ArrowRight className="aqua-docs-flow-arrow"/>
            <FlowCard icon={<Waves/>} label="When sellers trade" title="Tokens return" text="Sellers send launch tokens back into the pool and receive the pair asset. The balance moves in the opposite direction."/>
          </div>
          <div className="aqua-docs-definition">
            <div><b>No AQUA escrow</b><span>There is no separate wallet holding an unsold launch allocation.</span></div>
            <div><b>No removable LP</b><span>The creator cannot withdraw the permanently locked Orca position.</span></div>
            <div><b>Normal AMM movement</b><span>The vault balances change whenever people buy and sell.</span></div>
          </div>
        </DocSection>

        <DocSection id="launch-cost" eyebrow="LAUNCHING" title="What launching costs">
          {launchFeeEnabled ? <>
            <p>AQUA charges a fixed <strong>{config.launchCost!.platformFeeSol.toFixed(2)} SOL launch fee</strong>. It funds keeper operations that harvest fees, route allocations, purchase reward assets and publish claimable reward rounds.</p>
            <div className="aqua-docs-cost-card">
              <CostRow label="AQUA launch fee" value={config.launchCost!.platformFeeSol.toFixed(2) + " SOL"} note="Fixed protocol charge"/>
              <CostRow label="Estimated network and account costs" value={config.launchCost!.estimatedNetworkAndRentSol.minimum.toFixed(2) + "–" + config.launchCost!.estimatedNetworkAndRentSol.maximum.toFixed(2) + " SOL"} note="Solana and Orca accounts"/>
              <CostRow label="Estimated total before first buy" value={config.launchCost!.estimatedTotalSol.minimum.toFixed(2) + "–" + config.launchCost!.estimatedTotalSol.maximum.toFixed(2) + " SOL"} note="The wallet simulation is authoritative"/>
            </div>
          </> : <>
            <p>The program launch fee is currently disabled for the deployed program version. The creator still pays Solana transaction fees and the rent required to create the mint, token accounts, AQUA accounts, Whirlpool and position accounts.</p>
            <Callout title="The wallet is the final quote">
              Account rent and network conditions vary. AQUA simulates each transaction before asking for approval, and the connected wallet shows the authoritative SOL change.
            </Callout>
          </>}
          <p>An optional first buy is separate from the launch cost. Whatever amount the creator chooses for that buy is added on top. Some account rent can be reclaimed if an account is later closed, but permanently locked liquidity infrastructure is not withdrawable by the creator.</p>
        </DocSection>

        <DocSection id="pair-choice" eyebrow="LAUNCHING" title="Pairs, rewards and first buys">
          <p>The creator chooses SOL, a supported xStock or an eligible custom pair when custom pairs are enabled. That selection has two permanent jobs: it is the asset the coin trades against in Orca, and it is the asset holder rewards are funded in.</p>
          <table className="aqua-docs-table">
            <thead><tr><th>Choice</th><th>What the market trades against</th><th>What holders earn</th></tr></thead>
            <tbody>
              <tr><td>SOL</td><td>The launch token trades against wrapped SOL inside Orca.</td><td>The SOL pair asset.</td></tr>
              <tr><td>Supported xStock</td><td>The launch token trades directly against that approved tokenized stock.</td><td>The same selected xStock.</td></tr>
              <tr><td>Eligible custom pair</td><td>A token accepted by the custom-pair lookup and launch checks.</td><td>The selected pair token, subject to its transfer rules.</td></tr>
            </tbody>
          </table>
          <p>xStocks must have a live, supported Orca market and the required Orca TokenBadge. The eligibility checks reduce broken launches, but they do not remove market, issuer, liquidity or transfer restrictions.</p>
          <Callout title="Optional creator first buy">
            The creator funds an optional first buy with SOL and approves it before trading opens. Liquidity activation and the buy execute in one transaction, so another purchase cannot land between them. For other pairs, SOL is converted to the pair asset first. The buy follows the same price-impact and transfer-fee rules as other purchases.
          </Callout>
        </DocSection>

        <DocSection id="atlantis-studio" eyebrow="ATLANTIS STUDIO" title="Build the experience around your token">
          <p>Atlantis Studio is Aqua&apos;s creation workspace for turning a token idea into a complete community experience. It keeps the conversation, project files, artwork and live website preview together, so creators do not need to move between separate AI, design and coding tools.</p>
          <div className="aqua-docs-principles">
            <Principle icon={<Globe2/>} title="Websites" text="Create and refine a responsive token website, then preview it directly inside the Studio."/>
            <Principle icon={<Gamepad2/>} title="Apps and mini-games" text="Build interactive community tools, lightweight games and meme generators when the idea calls for them."/>
            <Principle icon={<ImageIcon/>} title="Artwork and assets" text="Develop the token identity, imagery and shareable assets in the same project as the code."/>
          </div>
          <h3>A short survey, tailored to your idea</h3>
          <p>For websites and artwork, Atlantis can ask a few multiple-choice questions about unresolved details such as style, animation or how a feature should work. Each question includes a custom answer. Turn on <strong>Skip survey</strong> to let it work from your brief, or skip a single survey. Clear requests can proceed without questions.</p>
          <h3>Your builder budget</h3>
          {freeStudio ? <p>Atlantis is currently free with a <strong>${promotion?.allowanceUsd ?? 10} total AI budget per wallet</strong>, shared across projects. Actual generation usage reduces the balance; unused reservations are released. This is not a daily allowance, and deleting a project does not reset it. You can still edit and export after the budget is used.</p> : <p>When free builder access is enabled, each wallet has a $10 total AI budget shared across its projects. Check the current budget or credit balance in Studio before generating; availability follows the service’s current billing settings.</p>}
          <p>Connect GitHub in Atlantis to export to a new repository. That repository connection is separate from the profile-only verification used for redirected fees.</p>
          <p>Atlantis adds a backend only when the project needs one. When it does, the Studio provides separate frontend and backend exports with short setup steps and the required environment variables. Simpler details such as a token address stay in the frontend configuration.</p>
          <Callout title="You remain in control of edits">
            Atlantis can list proposed file changes before applying them, or you can enable automatic application for the current project. Every project remains linked to the wallet that created it and can be exported for independent hosting.
          </Callout>
          <div className="aqua-docs-actions atlantis-docs-action">
            <Link className="primary" to="/studio">Open Atlantis Studio <PanelsTopLeft size={17}/></Link>
          </div>
        </DocSection>

        <DocSection id="website-publishing" eyebrow="ATLANTIS STUDIO" title="Publish when your website is ready">
          <p>Use <strong>Publish</strong> to choose an available website address on aquafamily.fun. Edits stay private until published. If a publish fails, the previous published version stays in place. Frontend and backend exports are also available for independent hosting.</p>
          <div className="aqua-docs-definition">
            <div><b>Variables &amp; Secrets</b><span>Open Variables & Secrets. Frontend values are public; Backend values and secrets are private to your app. Add provider API keys under Backend. Publish saved changes to apply them.</span></div>
            <div><b>Fill on launch</b><span>This is an explicit per-project choice. When enabled, a confirmed launch from that project fills connected CA fields and trading links and queues the hosted website update. Without consent, the manual CA stays under your control.</span></div>
            <div><b>Connected fields</b><span>Older hardcoded addresses need to be connected in Atlantis first. A failed website update can be retried through Publish; launching a coin and publishing a website have separate statuses.</span></div>
          </div>
          <p>Atlantis can prepare public settings, required secret fields and generated app secrets. Supported hosted APIs publish with your website. Larger external backends need their deployed URL configured before they can serve requests. AQUA market-data integrations use the public AQUA API and do not require your own backend.</p>
        </DocSection>

        <DocSection id="trading-fees" eyebrow="FEES AND REWARDS" title="Each coin chooses its reward fee">
          <p>Eligible trades and transfers produce the configured fee. AQUA settles the collected value in SOL before dividing it between holder rewards, buybacks, treasury and any earned creator allocation.</p>
          <p>Launch settings set a 1–4% reward fee (1% by default), plus AQUA’s fixed 1% platform fee. The token fee is therefore 2–5%, fixed at launch. Orca charges its pool fee separately; Coin settings shows the configured breakdown. Custom reward rates are available after this network’s fee upgrade. At the default rate, the split is:</p>
          <table className="aqua-docs-table fee-table">
            <thead><tr><th>Stream</th><th>Of trade value</th><th>Of collected fees</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td><span className="fee-dot reward"/>Selected reward mode</td><td>1%</td><td>50%</td><td>Funds Holder Rewards, Fee Redirect, Buyback & Burn or Hourly Jackpot, as selected at launch.</td></tr>
              <tr><td><span className="fee-dot platform"/>Platform</td><td>{formatBps(config.fees.platformBps)}</td><td>50%</td><td>Funds treasury, buybacks and any earned creator share.</td></tr>
            </tbody>
          </table>
          <p>The reward stream is a gross allocation. A base operating reserve takes 1% of that stream, equivalent to 0.01% of trade value at the default reward fee. Applicable settlement costs, operating recovery, Ripple and community funding are accounted for before the remaining reward pool reaches the selected mode. Fee Redirect splits that remaining pool, not the full trade fee.</p>
          <h3>Inside the platform share</h3>
          <p>Half of the platform stream always funds the buyback wallet. The other half belongs to the treasury/creator stream. An active token lock can redirect between 0% and {formatBps(maximumCreatorShareBps)} of the platform stream from treasury to the creator; it never reduces holder rewards or buyback funding.</p>
          <div className="aqua-docs-allocation">
            <Allocation value={formatBps(maximumAllocation.treasuryBps)} label="Treasury" className="treasury"/>
            <Allocation value={formatBps(maximumAllocation.buybackBps)} label="Buyback" className="buyback"/>
            <Allocation value={formatBps(maximumAllocation.creatorBps)} label="Creator" className="creator-share"/>
          </div>
          <p className="fine-print">These percentages describe the 1% platform stream. At the default reward fee with no creator lock, 1% goes to the reward stream, 0.5% to buyback and 0.5% to treasury. A higher reward fee only increases the reward stream. At maximum score, that treasury 0.5% moves to the creator.</p>
        </DocSection>

        <DocSection id="settlement" eyebrow="FEES AND REWARDS" title="How fees are harvested and settled">
          <p>The Token-2022 program initially records withheld value during transfers. The AQUA keeper periodically finds those balances, moves them into the market’s program-controlled fee vault, swaps through the launch’s own Orca pool and settles the proceeds in SOL before any split is paid. New launch tokens therefore do not need to be indexed by Jupiter before SOL settlement can begin.</p>
          <div className="aqua-docs-timeline compact">
            <TimelineStep number="01" title="Fees accrue" text="Trades and transfers withhold launch tokens at the Token-2022 level."/>
            <TimelineStep number="02" title="Keeper harvests" text="The dedicated fee-keeper signer collects eligible withheld balances in controlled batches, converts them to SOL and divides the proceeds."/>
            <TimelineStep number="03" title="Program allocates" text="The on-chain market records reward, treasury, buyback and creator amounts."/>
            <TimelineStep number="04" title="SOL is routed" text="Creator, buyback and treasury proceeds are sent to their fixed wallets. The reward share is routed for the selected mode, including conversion and claim funding where applicable."/>
          </div>
          <Callout title="Settlement is not every trade">
            Fees accrue continuously, but harvesting is a scheduled operation. The normal keeper checks roughly every minute. Failed work is logged and retried on a later cycle; a fee remaining unharvested does not mean it disappeared.
          </Callout>
        </DocSection>

        <DocSection id="reward-modes" eyebrow="FEES AND REWARDS" title="Four reward modes, chosen at launch">
          <p>Choose how the remaining reward pool is used. The mode and any redirect recipient are fixed at launch. Available options follow the current network configuration.</p>
          <div className="reward-mode-docs">
            <article><span><RewardModeIcon mode="holder_rewards"/></span><small>MODE 01</small><h3>Holder Rewards</h3><p>The selected pair asset is allocated to eligible holders by balance × time held. Outstanding allocations are combined into one claim per coin.</p></article>
            <article><span><RewardModeIcon mode="fee_redirect"/></span><small>MODE 02</small><h3>Fee Redirect</h3><p>50% of the net reward pool goes to a fixed wallet, X account or personal GitHub account. The other 50% goes to eligible holders by balance × time held.</p><button className="text-button" onClick={()=>scrollTo("fee-redirect")}>How recipients claim <ArrowRight size={14}/></button></article>
            <article><span><RewardModeIcon mode="buyback_burn"/></span><small>MODE 03</small><h3>Buyback &amp; Burn</h3><p>The reward pool buys the launched coin through its live market and permanently burns the purchased tokens. Buy and burn transactions are public; this mode does not pay holder claims.</p></article>
            <article><span><RewardModeIcon mode="jackpot"/></span><small>MODE 04</small><h3>Hourly Jackpot</h3><p>Five distinct eligible holders receive 50%, 20%, 20%, 5% and 5% of each qualifying pot. Winnings appear in the normal reward claim list.</p></article>
          </div>
          <Callout title="How the jackpot draw works">
            Holding balance earns score over the hour. New purchases mature over 15 minutes; selling or transferring out removes the corresponding share of earned score. Wallets with no outbound movement receive a 10% consistency multiplier. Scores are committed before a future finalized Solana block supplies draw randomness. Winners are drawn without replacement.
          </Callout>
          <p>If the pot is below $10 or fewer than five eligible wallets exist, it rolls forward. The coin page shows the countdown, prize places and previous winners. No mode guarantees a payout.</p>
        </DocSection>

        <DocSection id="fee-redirect" eyebrow="FEES AND REWARDS" title="Redirect fees and share a claim link">
          <p>Choose <strong>Fee Redirect</strong>, the second reward option in the launch wizard. Its settings panel accepts a Solana wallet, X handle or personal GitHub account. Check and save the recipient to select the mode. Closing the panel without accepted settings keeps your previous selection.</p>
          <div className="aqua-docs-definition">
            <div><b>50% to the recipient</b><span>The recipient earns the selected pair asset without needing to hold the coin. Their share stays reserved until the correct payout wallet is ready.</span></div>
            <div><b>50% to holders</b><span>Eligible holders keep earning by balance × time held. The split applies after operating costs, Ripple and community funding.</span></div>
            <div><b>Fixed recipient</b><span>The launch recipient cannot be changed. An X or GitHub recipient explicitly activates one permanent payout wallet for that account’s redirected rewards across AQUA.</span></div>
          </div>
          <h3>Send the recipient their link</h3>
          <p>Use <strong>Copy claim link</strong> after launch or in the coin’s Rewards panel. Anyone can share the link, but only the recipient can claim the funds.</p>
          <div className="aqua-docs-timeline compact">
            <TimelineStep number="01" title="Choose your device" text="Open the link and choose desktop or mobile. The page includes a short Phantom setup guide if you do not have a wallet."/>
            <TimelineStep number="02" title="Connect your wallet" text="Connect and sign in. Direct wallet recipients must use the exact address selected at launch."/>
            <TimelineStep number="03" title="Verify the named account" text="For X or GitHub, connect the exact account shown and confirm your permanent payout wallet. Already activated recipients use that wallet."/>
            <TimelineStep number="04" title="Claim your rewards" text="Once the balance is settled and eligible, press Claim and approve the wallet prompt. Keep a little SOL for the transaction costs."/>
          </div>
          <p>In <strong>Portfolio → Rewards</strong>, these coins use the same cards and Claim buttons as other rewards, with a <strong>Redirected fees</strong> badge. Holder and redirected allocations for the same coin share one claim. A <strong>Recipient claimed</strong> badge appears publicly on the coin only after a confirmed recipient payout.</p>
          <Link className="aqua-docs-inline-link" to="/portfolio?tab=rewards">Open your rewards <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="holder-rewards" eyebrow="FEES AND REWARDS" title="How holder rewards are calculated">
          <p>Reward rounds use <strong>balance multiplied by time held</strong>. Holding twice as many tokens for the same period creates twice the weight. Holding the same balance for twice as long also creates twice the weight. Buying immediately before a round does not earn the same share as holding throughout it.</p>
          <div className="aqua-docs-formula">
            <span>Wallet balance</span><b>×</b><span>Seconds held</span><b>=</b><strong>Reward weight</strong>
          </div>
          <p>Every {epochLength}, AQUA attempts to allocate whatever holder-reward value has been collected; there is no application-level minimum funding amount. The dedicated reward wallet converts reserved reward SOL into the market’s selected pair asset when required. SOL-paired markets keep SOL as the reward asset. AQUA then builds a Merkle tree from eligible wallet weights, funds an on-chain reward vault and publishes the root. If an amount is too small for a swap or on-chain precision, it remains available for a later cycle.</p>
          <h3>Who is excluded</h3>
          <p>The creator wallet, the Whirlpool and position accounts, AQUA PDAs, the fee vault, permanent lock accounts, fee keeper, treasury, reward wallet and buyback wallet are excluded. Those accounts hold tokens for infrastructure or protocol operations rather than as ordinary holders. Excluding them prevents rewards from being sent back into inactive vaults.</p>
          <div className="aqua-docs-benefits">
            <Principle icon={<Clock3/>} title="Time matters" text="The calculation rewards sustained ownership instead of a last-second snapshot."/>
            <Principle icon={<Layers3/>} title="Proportional" text="Each eligible wallet receives its weight as a fraction of total eligible weight."/>
            <Principle icon={<ShieldCheck/>} title="Reconciled" text="Purchased reward assets must match the funded epoch before claims become available."/>
          </div>
        </DocSection>

        <DocSection id="claiming" eyebrow="FEES AND REWARDS" title="Claim rewards from your portfolio">
          <p>Open <strong>Portfolio → Rewards</strong> with the eligible wallet. Each coin shows its available amount and a Claim button. Holder allocations, redirected fees and jackpot winnings use this list; Ripple has its own tab.</p>
          <p>Claims unlock when the settled balance is worth more than {minimumClaim} after estimated Solana costs. Amounts are displayed in dollars, but you receive the coin’s selected reward asset. Pending allocations must settle first. Keep SOL in the wallet for transaction and account-creation costs.</p>
          <div className="aqua-docs-checklist">
            <CheckItem>Claim combines outstanding allocations for one coin into one wallet approval.</CheckItem>
            <CheckItem>Claim all processes eligible coins in sequence. Approve each coin in your wallet.</CheckItem>
            <CheckItem>A submitted claim keeps its receipt across refreshes. Use Check confirmation before trying another transaction.</CheckItem>
            <CheckItem>A failed or expired transaction can be retried once its status is checked.</CheckItem>
            <CheckItem>Confirmed claims appear in Activity. You can share a claim from its success message.</CheckItem>
          </div>
          <Link className="aqua-docs-inline-link" to="/portfolio?tab=rewards">Open rewards <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="auto-rewards" eyebrow="FEES AND REWARDS" title="Receive eligible rewards automatically">
          <p>Turn on <strong>Auto rewards</strong> in Portfolio. When the service is running, it checks every three hours for newly earned, funded rewards after you opted in. Each coin needs more than $5 in new claimable rewards and more than $5 of that coin held in the wallet, using a current price.</p>
          <p>Smaller balances carry forward. Rewards earned before opt-in remain available for manual claiming, and Ripple claims stay separate. Redirect recipients who do not hold the coin can use the normal Claim button.</p>
          <p>You can also enable auto rewards by entering your wallet address and completing the verification on the auto rewards page. The page shows whether payouts are running or awaiting activation.</p>
          <Link className="aqua-docs-inline-link" to="/auto-rewards">Set up auto rewards <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="address-claims" eyebrow="FEES AND REWARDS" title="Claim without connecting a wallet app">
          <p>Use <strong>Claim with your address</strong> to find supported rewards and creator fees using a Solana address. Follow the ownership-verification prompt from that same wallet, then claim to it. You do not need to export a private key into another wallet app.</p>
          <p>Verification currently accepts at least 0.001 SOL or 0.01 USDC sent to the displayed destination within the request’s payment window. This is a separate, non-refundable payment. AQUA watches for it automatically; the prompt also lets you check the transaction.</p>
          <Link className="aqua-docs-inline-link" to="/claim-by-address">Claim with your address <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="ripple-rewards" eyebrow="FEES AND REWARDS" title="Earn Ripple Rewards for posts about your coin">
          <p>Sign in, connect X and hold the coin before posting. Include its contract address, AQUA market link or explicit $TICKER. If a ticker is shared, use the contract address or market link. Keep holding through allocation. Eligible original posts and replies are discovered automatically.</p>
          <p>Under the reach-based scoring policy, a post needs at least 100 recorded views and verified engagement from two other established accounts. Views set a dollar target; verified engagement and followers can add limited bonuses. Only growth in the target earns new credit, so previous engagement is not paid twice. The small-post boost is shared across the author’s daily posts.</p>
          <p>Posts are checked through an eight-hour tracking window. Each recorded check can wait up to 72 hours for settlement funding. A target is not yet a claimable balance. Open <strong>Portfolio → Ripple</strong> to see tracking, pending funding, exclusions and available SOL rewards.</p>
          <Callout title="Where Ripple funding comes from">
            When active, the coin’s chosen 3–30% share, 15% by default, comes from newly settled reward funding after existing operating and campaign allocations. Another 10% of Community Boost goes to Ripple. This adds no extra token fee. Direct creator top-ups are unchanged, and unused Ripple funding carries forward.
          </Callout>
          <Link className="aqua-docs-inline-link" to="/portfolio?tab=ripple">Open Ripple <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="dex-funding" eyebrow="MARKET GOVERNANCE" title="How DEX Funding Mode works">
          <p className="lead">DEX Funding Mode lets a market pay for its DEX Screener profile from incoming market rewards instead of depending on one community member to cover the full cost.</p>
          <p>A creator can enable the mode during launch and optionally prefill the description, banner and social links. Five minutes after launch, AQUA prepares the market’s default funding vote beneath the trading panel. Existing markets can also start a Fund Dex proposal after normal proposals unlock 15 minutes after launch.</p>
          <div className="aqua-docs-timeline compact">
            <TimelineStep number="01" title="Submit the exact profile" text="The proposal includes the description, banner, website, X and Telegram details holders are being asked to approve."/>
            <TimelineStep number="02" title="Holders vote" text="Eligible holders vote yes or no from the market page. Approval applies only to the exact details displayed in that vote."/>
            <TimelineStep number="03" title="The market funds it" text="After approval, 80% of incoming market rewards is reserved for the DEX target while the remaining 20% continues to holder rewards."/>
            <TimelineStep number="04" title="AQUA submits it" text="Once the target is reached and checks are complete, AQUA uses the approved information for the external DEX Screener submission."/>
          </div>
          <div className="aqua-docs-definition">
            <div><b>$300 initial target</b><span>The normal funding target for a market’s first paid DEX Screener token profile.</span></div>
            <div><b>80% reserved</b><span>The funding share is held for the approved DEX action and is not marked spent before withdrawal and fulfillment.</span></div>
            <div><b>20% continues</b><span>The remaining incoming holder-reward share continues through the market’s selected reward mode while funding is active.</span></div>
          </div>
          <Callout title="Funding approval is not profile approval in the abstract">
            Holders see and approve the exact public profile. AQUA does not treat a vote as permission to publish different links or a different banner later. Any material replacement goes through another Update Dex vote.
          </Callout>
        </DocSection>

        <DocSection id="market-proposals" eyebrow="MARKET GOVERNANCE" title="Who can propose, vote and update DEX details">
          <p>Every holder-created proposal requires the connected wallet to currently own at least <strong>0.5% of that coin’s total supply</strong>. This applies to Fund Dex, DEX Boost, Update Dex and Community Takeover proposals, including proposals created by the original developer. The button stays disabled below the threshold and shows the wallet’s current percentage.</p>
          <p>Voting uses a separate eligibility check. A wallet needs at least 0.1% in both current and time-weighted holdings, preventing a brief last-second balance from carrying the same influence as a sustained holder.</p>
          <table className="aqua-docs-table">
            <thead><tr><th>Proposal</th><th>What holders approve</th><th>Normal vote rules</th></tr></thead>
            <tbody>
              <tr><td>Fund Dex</td><td>The funding campaign and exact first profile details.</td><td>15 minutes · More than 50% of voting power cast</td></tr>
              <tr><td>DEX Boost</td><td>5%, 10%, 20% of incoming market rewards, or No.</td><td>15 minutes · Highest eligible voting weight wins</td></tr>
              <tr><td>Update Dex</td><td>A replacement description, banner and set of public links.</td><td>15 minutes · More than 50% of voting power cast</td></tr>
              <tr><td>Community Takeover</td><td>A named community lead, new developer wallet, evidence and transition plan.</td><td>24 hours · More than 50% of voting power cast</td></tr>
            </tbody>
          </table>
          <p>All proposal votes use the eligible voting power actually cast, weighted by holdings and held time. There is no minimum turnout or supply participation requirement. Voting stays open for the full period. Yes/no ties and no turnout do not pass. Boost polls use the option with the highest weight: a tied No wins, otherwise the lower tied funding percentage wins.</p>
          <h3>What an approved Update Dex proposal does</h3>
          <div className="aqua-docs-flow">
            <FlowCard icon={<DexScreenerIcon/>} label="Funding in progress" title="Replace the campaign details" text="The SOL already raised remains reserved. Spending pauses during the vote, then the approved profile replaces the prior details without restarting funding."/>
            <ArrowRight className="aqua-docs-flow-arrow"/>
            <FlowCard icon={<DexScreenerIcon/>} label="AQUA-managed profile" title="Submit an approved update" text="If AQUA already controls the paid profile, an approved update does not need another DEX funding target."/>
            <ArrowRight className="aqua-docs-flow-arrow"/>
            <FlowCard icon={<DexScreenerIcon/>} label="Externally controlled" title="Fund a profile takeover" text="If the profile is paid but AQUA cannot edit it, the approved change opens a $200 DEX Screener community-takeover funding route."/>
          </div>
          <p>Fund Dex, Update Dex and Community Takeover are separate proposal types, so different types can be active at the same time. A market cannot open a duplicate active Fund Dex or Update Dex proposal while one of the same type is already being processed.</p>
        </DocSection>

        <DocSection id="community-boost" eyebrow="MARKET GOVERNANCE" title="Back a coin in the daily Community Boost">
          <p>Eligible AQUA holders vote for one live market to receive the configured share of AQUA platform fees for the following 24 hours. Voting runs daily and closes at 00:00 UTC. Weight reflects average AQUA holdings during the round, capped by the current balance. The main AQUA coin cannot be nominated.</p>
          <p>The Community Boost page shows the live leaderboard, today’s boosted coin and your current choice. Vote directly from a ranked coin or search by name, ticker or contract address. You can change or remove your vote before the round closes.</p>
          <Link className="aqua-docs-inline-link" to="/boost">Open Community Boost <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="dex-boosts" eyebrow="MARKET GOVERNANCE" title="Fund a DEX boost together">
          <p>A paid DEX profile is required before a boost can be funded. Eligible holders choose <strong>5%, 10%, 20% or No</strong>. An approved campaign reserves that percentage of incoming market rewards for one hour; the remaining share continues through the selected reward mode. Reaching $100, $250, $400, $900 or $4,000 adds 20 minutes per milestone, once each.</p>
          <p>At the end, AQUA selects the largest pack the reserve can afford and releases unused SOL to holder rewards. If no pack is affordable, the whole reserve returns to holders. A funded campaign still needs external purchase and fulfillment; it is not marked delivered just because funding ended.</p>
          <table className="aqua-docs-table">
            <thead><tr><th>Boost pack</th><th>Configured price</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td>10×</td><td>$99</td><td>12 hours</td></tr>
              <tr><td>30×</td><td>$249</td><td>12 hours</td></tr>
              <tr><td>50×</td><td>$399</td><td>12 hours</td></tr>
              <tr><td>100×</td><td>$899</td><td>24 hours</td></tr>
              <tr><td>500×</td><td>$3,999</td><td>24 hours</td></tr>
            </tbody>
          </table>
          <p>The reserve is held in SOL, so its dollar value can change. Before spending, AQUA checks affordability again and can reduce the pack instead of taking extra rewards. The campaign tracks funding, purchase and completion separately.</p>
        </DocSection>

        <DocSection id="automatic-funds" eyebrow="MARKET GOVERNANCE" title="Use market momentum to fund visibility">
          <p>When verified trading activity picks up, AQUA can start a small automatic fund. The signal checks recent volume, distinct traders, sustained activity and fresh indexed data against the earlier baseline. A single trade is not enough.</p>
          <div className="aqua-docs-definition">
            <div><b>DEX profile unpaid: 10%</b><span>A mini DEX profile fund reserves 10% of incoming market rewards toward the $300 target. It continues collecting while open, even if activity slows. It expires after 24 hours and returns the reserve to holders if the target is not met.</span></div>
            <div><b>DEX profile paid: 10%</b><span>A mini boost fund collects continuously while open. It starts with 90 minutes and gains 20 minutes at each boost milestone. It closes early after 30 minutes without a qualifying market trade. Under $100 at closing, all funds return to holders; from $100, it selects the largest affordable pack and returns the excess.</span></div>
            <div><b>Holder votes still matter</b><span>A successful DEX funding vote carries the saved amount into the 80% campaign. A successful boost poll carries the mini fund’s balance, remaining time and milestone progress into the chosen percentage. An explicit winning No stops the unspent automatic fund and releases its reserve.</span></div>
          </div>
          <p>Automatic mini boosts are available to all eligible coins, including AQUA itself. They appear as funding activity, not as holder-created proposals in proposal history. AQUA does not have the regular holder-created market proposals or an automatic DEX profile fund. A boost always requires a verified paid DEX profile.</p>
          <p>If an automatic profile fund reaches its goal without submitted details, Team AQUA can prepare the profile. Later changes use the Update Dex process. Cooldowns and activity checks limit repeated campaigns; profile funding takes priority over boost funding.</p>
        </DocSection>

        <DocSection id="community-takeovers" eyebrow="MARKET GOVERNANCE" title="How community takeovers work">
          <p>A Community Takeover proposal is for changing the recognised developer wallet when the original team has abandoned the market. The proposal identifies the person taking responsibility, their Solana wallet, public evidence and a transition plan. The wallet is the takeover developer’s wallet, not a community treasury.</p>
          <div className="aqua-docs-checklist">
            <CheckItem>Multiple takeover candidates may run at the same time.</CheckItem>
            <CheckItem>The first candidate to secure an approved result becomes the winning mandate.</CheckItem>
            <CheckItem>An approved takeover wallet can receive existing and future creator fees and create future developer locks after verified execution.</CheckItem>
            <CheckItem>A seven-day protection period follows a rejected attempt only when the current developer submitted public evidence of active work during the vote.</CheckItem>
          </div>
          <Callout title="A vote records the mandate; execution changes authority">
            Approval does not silently rewrite a wallet address in the database. AQUA records the holder decision, then wallet authority and fee destinations change only after the required on-chain execution is verified.
          </Callout>
          <p>Rejected DEX proposals are removed from the active market interface instead of leaving a permanent rejected panel. Completed DEX funding is shown with the green DEX badge on the market.</p>
        </DocSection>

        <DocSection id="community" eyebrow="COMMUNITY" title="One home for the coin’s community">
          <div className="aqua-docs-principles">
            <Principle icon={<Globe2/>} title="Chat" text="Send messages and pictures, reply to a message and add reactions. Use the three-dot menu or right-click for message actions. Reactions accumulate into counts."/>
            <Principle icon={<PanelsTopLeft/>} title="Updates" text="Creators publish full-width announcements with the coin’s ticker and image, formatted text and attachments. Anyone signed in can react; updates do not have replies or appear in chat."/>
            <Principle icon={<CheckCircle2/>} title="Polls" text="Creators ask multiple-choice questions with a clear end time. They can restrict voting to holders with at least 0.1% of supply. Polls stay in their own feed."/>
          </div>
          <p>New activity indicators help you find unread chat, updates and polls. Markets can show an announcement bell during the first hour of a new update. Your last opened tab is remembered in this browser across refreshes and coin pages.</p>
          <p>Community polls collect opinions; they do not authorize DEX spending or change protocol rules. Those actions use the separate holder-governance proposals. Reports go to AQUA admins and the moderation Discord webhook. Coin creators do not gain message deletion or report-review permissions simply by owning the coin.</p>
        </DocSection>

        <DocSection id="creator-locks" eyebrow="CREATORS" title="Creator locks">
          <p>Creators do not receive a free reserved allocation. They can buy their own coin through the live market, then voluntarily lock purchased tokens in an AQUA creator-lock PDA. A verified active lock can earn a share of the platform fee stream.</p>
          <p>The minimum lock is {minimumLock} and the maximum scoring duration is {maximumLock}. Tokens cannot be released before the recorded unlock time. Once a lock expires, its fee-share benefit stops and the creator can submit a release transaction.</p>
          <Callout title="A creator lock is separate from liquidity">
            Permanently locked Orca liquidity belongs to the market position. A creator lock contains tokens the creator bought and voluntarily committed. Locking creator tokens does not remove or replace the pool lock.
          </Callout>
        </DocSection>

        <DocSection id="creator-share" eyebrow="CREATORS" title="How the creator fee share is scored">
          <p>The score multiplies two factors: the percentage of total supply locked and the selected duration. Locking {formatBps(targetSupplyBps)} of supply for {maximumLock} reaches the {formatBps(maximumCreatorShareBps)} cap. Smaller or shorter locks scale down proportionally.</p>
          <div className="aqua-docs-score-grid">
            <ScoreCard supply={formatBps(targetSupplyBps)} duration={maximumLock} result={formatBps(maximumCreatorShareBps)}/>
            <ScoreCard supply={formatBps(targetSupplyBps / 2)} duration={maximumLock} result={formatBps(maximumCreatorShareBps / 2)}/>
            <ScoreCard supply={formatBps(targetSupplyBps)} duration={durationLabel(config.creatorLocks.maximumSeconds / 2)} result={formatBps(maximumCreatorShareBps / 2)}/>
            <ScoreCard supply={formatBps(targetSupplyBps / 2)} duration={durationLabel(config.creatorLocks.maximumSeconds / 2)} result={formatBps(maximumCreatorShareBps / 4)}/>
          </div>
          <div className="aqua-docs-formula creator-formula">
            <span>Supply score</span><b>×</b><span>Duration score</span><b>×</b><strong>{formatBps(maximumCreatorShareBps)} cap</strong>
          </div>
          <p className="fine-print">The fee share applies only while the lock is active. Values shown are simplified examples; the program calculates integer basis points from the exact token amount and duration.</p>
        </DocSection>

        <DocSection id="creator-dashboard" eyebrow="CREATORS" title="Manage your coin after launch">
          <p>Open <strong>Portfolio → Created</strong> to find your live coins and choose <strong>Manage coin</strong>. Coins without an active lock show <strong>Set up creator fees</strong>. You can add to an existing creator lock; review the combined amount, fee share and unlock date before approval.</p>
          <p>Creator fees are paid in SOL. Claim an available balance manually; balances over $50 are paid automatically when payouts are running. These fees are separate from holder and redirected rewards.</p>
          <p>Use <strong>Deposit SOL</strong> to top up the coin’s reward funding. Review the destination, any conversion and the costs shown before signing. Deposits cannot be withdrawn. Creator announcements and polls live in the coin’s Community section, and Atlantis remains available for its website and other tools.</p>
        </DocSection>

        <DocSection id="public-api" eyebrow="REFERENCE" title="Use AQUA data in your own tools">
          <p>The public API lives at <code>{AQUA_PUBLIC_API_ORIGIN}/v1</code>. Read markets, trades, charts, rewards, buybacks, burns, jackpots, governance and events without an API key. Atlantis uses the same domain when building AQUA integrations.</p>
          <p>Public reads allow 60 requests per minute per IP. Webhook management requires a signed-in wallet session. The previous Railway API address remains supported for existing integrations.</p>
          <Link className="aqua-docs-inline-link" to="/developers">Read the API documentation <ArrowRight size={15}/></Link>
        </DocSection>

        <DocSection id="numbers" eyebrow="REFERENCE" title="The fixed numbers">
          <table className="aqua-docs-table reference-table">
            <tbody>
              <ReferenceRow label="Token supply" value={totalSupply}/>
              <ReferenceRow label="Token decimals" value={String(tokenDecimals)}/>
              <ReferenceRow label="Supply committed to liquidity" value={formatBps(liquiditySupplyBps)}/>
              <ReferenceRow label="Separate AQUA supply reserve" value="None"/>
              <ReferenceRow label="Starting market cap target" value={"$" + startMarketCap.toLocaleString("en-GB")}/>
              <ReferenceRow label="Token transfer fee" value="2–5% · default 2% · Orca fee additional"/>
              <ReferenceRow label="Reward fee" value="1–4% of transfer value · default 1%"/>
              <ReferenceRow label="Platform stream" value={formatBps(config.fees.platformBps) + " of transfer value"}/>
              <ReferenceRow label="Maximum creator share" value={formatBps(maximumCreatorShareBps) + " of platform stream"}/>
              <ReferenceRow label="Permanent liquidity lock" value="Required"/>
              <ReferenceRow label="Reward epoch target" value={epochLength}/>
              <ReferenceRow label="Minimum reward conversion value" value="None at application level"/>
              <ReferenceRow label="Fee Redirect split" value="50% recipient · 50% holders, from the net reward pool"/>
              <ReferenceRow label="Auto rewards" value="Every 3 hours when running · over $5 in new rewards and holdings per coin"/>
              <ReferenceRow label="Minimum claim value" value={`More than ${minimumClaim} after estimated Solana costs`}/>
              <ReferenceRow label="Proposal creation requirement" value="0.5% of the market supply"/>
              <ReferenceRow label="Proposal voting requirement" value="0.1% current and time-weighted holdings"/>
              <ReferenceRow label="Initial DEX profile target" value="$300"/>
              <ReferenceRow label="DEX profile takeover target" value="$200"/>
              <ReferenceRow label="Launch fee" value={launchFeeEnabled ? config.launchCost!.platformFeeSol.toFixed(2) + " SOL" : "Not enabled on current program"}/>
            </tbody>
          </table>
        </DocSection>

        <DocSection id="accounts" eyebrow="REFERENCE" title="Programs and accounts">
          <p>These are the network-level addresses returned by the live AQUA backend. Individual markets also have their own mint, market PDA, fee vault, Whirlpool, position and lock addresses on each coin page.</p>
          <div className="aqua-docs-accounts">
            <AccountRow label="AQUA program" address={config.aquaProgramId} useTestnet={config.useTestnet}/>
            <AccountRow label="Orca Whirlpools program" address={config.whirlpools.programId} useTestnet={config.useTestnet}/>
            <AccountRow label="Orca configuration" address={config.whirlpools.config} useTestnet={config.useTestnet}/>
          </div>
        </DocSection>

        <DocSection id="risks" eyebrow="REFERENCE" title="Limits and risks">
          <div className="aqua-docs-risk-grid">
            <Risk title="No guaranteed return">Fees and rewards require trading activity. A quiet market may generate little or nothing.</Risk>
            <Risk title="Automation can pause">Harvesting and reward publication depend on the keeper, RPC access and successful on-chain transactions. Failed cycles can be retried.</Risk>
            <Risk title="Market risk remains">Permanent liquidity does not guarantee price, volume, solvency, value or an available buyer.</Risk>
            <Risk title="Transfer fees are broad">The Token-2022 fee can apply to ordinary token transfers, not only trades shown in AQUA.</Risk>
            <Risk title="No five-second tax">AQUA does not advertise a short-lived anti-sniper tax because Token-2022 fee changes do not activate instantly and cannot safely enforce that promise.</Risk>
          </div>
          <p className="aqua-docs-disclaimer">AQUA provides launch and reward infrastructure. Tokenized stocks, crypto assets and newly launched coins can lose value and may be subject to jurisdictional or issuer restrictions. Nothing on this page is a promise of profit.</p>
        </DocSection>
      </article>
    </div>
  </main>;
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function DocSection({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return <section className="aqua-docs-section" id={id}>
    <div className="aqua-docs-section-heading"><small>{eyebrow}</small><h2>{title}</h2></div>
    {children}
  </section>;
}

function Principle({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="aqua-docs-principle"><span>{icon}</span><div><h3>{title}</h3><p>{text}</p></div></div>;
}

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="aqua-docs-callout"><ShieldCheck/><div><b>{title}</b><p>{children}</p></div></aside>;
}

function CheckItem({ children }: { children: ReactNode }) {
  return <div><CheckCircle2/><span>{children}</span></div>;
}

function TimelineStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="aqua-docs-timeline-step"><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>;
}

function FlowCard({ icon, label, title, text }: { icon: ReactNode; label: string; title: string; text: string }) {
  return <div className="aqua-docs-flow-card"><span>{icon}</span><small>{label}</small><h3>{title}</h3><p>{text}</p></div>;
}

function CostRow({ label, value, note }: { label: string; value: string; note: string }) {
  return <div><span><b>{label}</b><small>{note}</small></span><strong>{value}</strong></div>;
}

function Allocation({ value, label, className }: { value: string; label: string; className: string }) {
  return <div className={className}><strong>{value}</strong><span>{label}</span></div>;
}

function ScoreCard({ supply, duration, result }: { supply: string; duration: string; result: string }) {
  return <div><span><LockKeyhole/><small>Supply locked</small><b>{supply}</b></span><span><Clock3/><small>Duration</small><b>{duration}</b></span><strong>{result}<small>platform share</small></strong></div>;
}

function ReferenceRow({ label, value }: { label: string; value: string }) {
  return <tr><th>{label}</th><td>{value}</td></tr>;
}

function AccountRow({ label, address, useTestnet }: { label: string; address: string | null; useTestnet: boolean }) {
  if (!address) return <div><span><Landmark/><b>{label}</b></span><em>Not configured</em></div>;
  return <a href={solscanAccount(address, useTestnet)} target="_blank" rel="noreferrer">
    <span><Landmark/><b>{label}</b></span><WalletIdentity wallet={address} link={false}/><ExternalLink/>
  </a>;
}

function Risk({ title, children }: { title: string; children: ReactNode }) {
  return <div><BadgeDollarSign/><h3>{title}</h3><p>{children}</p></div>;
}
