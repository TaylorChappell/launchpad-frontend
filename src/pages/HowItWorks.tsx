import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  Flame,
  Gift,
  Landmark,
  Layers3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Waves,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageBubbles } from "../components/PageBubbles";
import { useRuntime } from "../context";

const navigation = [
  {
    label: "The protocol",
    items: [
      ["what-is-aqua", "What AQUA is"],
      ["onchain", "What is on chain"],
    ],
  },
  {
    label: "Launching",
    items: [
      ["launch-flow", "What a launch creates"],
      ["liquidity", "How liquidity works"],
      ["launch-cost", "What launching costs"],
      ["pair-choice", "Pairs and first buys"],
    ],
  },
  {
    label: "Fees and rewards",
    items: [
      ["trading-fees", "The 2% trading fee"],
      ["settlement", "How fees are settled"],
      ["reward-modes", "The three reward modes"],
      ["holder-rewards", "How rewards are calculated"],
      ["claiming", "Claiming rewards"],
    ],
  },
  {
    label: "Creators",
    items: [
      ["creator-locks", "Creator locks"],
      ["creator-share", "Fee-share formula"],
    ],
  },
  {
    label: "Reference",
    items: [
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
    <PageBubbles count={24}/>

    <section className="aqua-docs-hero">
      <h1>How AQUA<br/><span>actually works.</span></h1>
      <p>A detailed guide to launching, liquidity, trading fees, holder rewards and creator incentives. AQUA creates markets directly on Orca without a bonding curve or a separate token reserve.</p>
      <div className="aqua-docs-actions">
        <Link className="primary" to="/create">Launch a coin <ArrowRight size={17}/></Link>
        <button className="secondary-button" onClick={() => scrollTo("launch-flow")}>Read the launch flow</button>
      </div>
      <div className="aqua-docs-summary" aria-label="AQUA protocol summary">
        <SummaryStat value={totalSupply} label="Fixed token supply"/>
        <SummaryStat value={formatBps(liquiditySupplyBps)} label="Committed to liquidity"/>
        <SummaryStat value={formatBps(config.fees.transferFeeBps)} label="Token transfer fee"/>
        <SummaryStat value="None" label="AQUA supply reserve"/>
      </div>
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
          <p className="lead">AQUA is a holder-first token launchpad built around direct Orca Whirlpool markets. A creator launches a fixed-supply Token-2022 coin, chooses SOL or an approved tokenized stock as its pair, and that same pair asset becomes the holder reward.</p>
          <p>There is no AQUA bonding curve, virtual reserve or off-chain sale inventory. Trading starts in a real Orca pool. The AQUA program validates the launch settings, records the market and controls fee allocation, while Orca executes swaps and holds the pool vaults.</p>
          <div className="aqua-docs-principles">
            <Principle icon={<Waves/>} title="Direct market" text="The coin launches into an Orca Whirlpool instead of moving through a separate AQUA curve."/>
            <Principle icon={<ShieldCheck/>} title="No reserve wallet" text="AQUA does not retain a percentage of the fixed token supply for later sale."/>
            <Principle icon={<Gift/>} title="Holder utility" text="Half of the collected transfer-fee stream is reserved for holders of the launched coin."/>
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

        <DocSection id="launch-flow" eyebrow="LAUNCHING" title="What a launch creates">
          <p>A launch is completed in two wallet approvals. The first transaction creates the mint, installs the fixed Token-2022 transfer fee, writes metadata, creates the AQUA market accounts and mints the fixed supply. The second approval creates and funds the Orca position, then permanently locks it.</p>
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

        <DocSection id="liquidity" eyebrow="LAUNCHING" title="How the 100% liquidity model works">
          <p><strong>{formatBps(liquiditySupplyBps)} liquidity</strong> means the full fixed launch supply is committed to the permanent Orca position. It does not mean a block explorer will always show the pool owning 100% after trading begins.</p>
          <div className="aqua-docs-flow">
            <FlowCard icon={<Coins/>} label="At launch" title="The pool starts with launch tokens" text={"The opening market targets roughly a $" + startMarketCap.toLocaleString("en-GB") + " market cap and begins on the launch-token side of the pair."}/>
            <ArrowRight className="aqua-docs-flow-arrow"/>
            <FlowCard icon={<RefreshCw/>} label="When buyers trade" title="Tokens leave the pool" text="Buyers receive launch tokens and the pool receives SOL or the selected xStock. The pool’s token percentage falls naturally."/>
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
          <p>The creator chooses either SOL or a supported xStock. That selection has two permanent jobs: it is the asset the coin trades against in Orca, and it is the asset holder rewards are funded in.</p>
          <table className="aqua-docs-table">
            <thead><tr><th>Choice</th><th>What the market trades against</th><th>What holders earn</th></tr></thead>
            <tbody>
              <tr><td>SOL</td><td>The launch token trades against wrapped SOL inside Orca.</td><td>The SOL pair asset.</td></tr>
              <tr><td>Supported xStock</td><td>The launch token trades directly against that approved tokenized stock.</td><td>The same selected xStock.</td></tr>
            </tbody>
          </table>
          <p>xStocks must have a live, supported Orca market and the required Orca TokenBadge. The eligibility checks reduce broken launches, but they do not remove market, issuer, liquidity or transfer restrictions.</p>
          <Callout title="Optional creator first buy">
            A first buy is a normal market purchase after the pool exists. It is not a free allocation. The creator provides SOL or USDC, receives the quoted launch tokens and accepts the same price impact and transfer-fee rules as other buyers.
          </Callout>
        </DocSection>

        <DocSection id="trading-fees" eyebrow="FEES AND REWARDS" title={"The " + formatBps(config.fees.transferFeeBps) + " SOL-settled fee"}>
          <p>Eligible trades and transfers produce the configured fee. AQUA settles the collected value in SOL before dividing it between holder rewards, buybacks, treasury and any earned creator allocation.</p>
          <p>The total stream is divided evenly between holder rewards and platform revenue:</p>
          <table className="aqua-docs-table fee-table">
            <thead><tr><th>Stream</th><th>Of trade value</th><th>Of collected fees</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td><span className="fee-dot reward"/>Selected reward mode</td><td>{formatBps(config.fees.stockRewardsBps)}</td><td>50%</td><td>Used for holder distributions, market buybacks and burns, or the hourly jackpot selected permanently at launch.</td></tr>
              <tr><td><span className="fee-dot platform"/>Platform</td><td>{formatBps(config.fees.platformBps)}</td><td>50%</td><td>Funds treasury, buybacks and any earned creator share.</td></tr>
            </tbody>
          </table>
          <h3>Inside the platform half</h3>
          <p>Half of the platform stream always funds the buyback wallet. The other half belongs to the treasury/creator stream. An active token lock can redirect between 0% and {formatBps(maximumCreatorShareBps)} of the platform stream from treasury to the creator; it never reduces holder rewards or buyback funding.</p>
          <div className="aqua-docs-allocation">
            <Allocation value={formatBps(maximumAllocation.treasuryBps)} label="Treasury" className="treasury"/>
            <Allocation value={formatBps(maximumAllocation.buybackBps)} label="Buyback" className="buyback"/>
            <Allocation value={formatBps(maximumAllocation.creatorBps)} label="Creator" className="creator-share"/>
          </div>
          <p className="fine-print">These percentages describe the 1% platform stream. With no creator lock, the full trade routes 1% to rewards, 0.5% to buyback and 0.5% to treasury. At maximum score, that treasury 0.5% moves to the creator.</p>
        </DocSection>

        <DocSection id="settlement" eyebrow="FEES AND REWARDS" title="How fees are harvested and settled">
          <p>The Token-2022 program initially records withheld value during transfers. The AQUA keeper periodically finds those balances, moves them into the market’s program-controlled fee vault, swaps through the launch’s own Orca pool and settles the proceeds in SOL before any split is paid. New launch tokens therefore do not need to be indexed by Jupiter before SOL settlement can begin.</p>
          <div className="aqua-docs-timeline compact">
            <TimelineStep number="01" title="Fees accrue" text="Trades and transfers withhold launch tokens at the Token-2022 level."/>
            <TimelineStep number="02" title="Keeper harvests" text="The dedicated fee-keeper signer collects eligible withheld balances in controlled batches, converts them to SOL and divides the proceeds."/>
            <TimelineStep number="03" title="Program allocates" text="The on-chain market records reward, treasury, buyback and creator amounts."/>
            <TimelineStep number="04" title="SOL is routed" text="Creator, buyback and treasury proceeds are sent to their fixed wallets. The holder share is sent only to the separate reward wallet for conversion and epoch funding."/>
          </div>
          <Callout title="Settlement is not every trade">
            Fees accrue continuously, but harvesting is a scheduled operation. The normal keeper checks roughly every minute. Failed work is logged and retried on a later cycle; a fee remaining unharvested does not mean it disappeared.
          </Callout>
        </DocSection>

        <DocSection id="reward-modes" eyebrow="FEES AND REWARDS" title="Three permanent ways to use the reward share">
          <p>Every creator chooses one reward mode in the launch wizard. The choice is written to a separate on-chain market-policy account and is immutable, so the creator or AQUA operator cannot quietly redirect a successful coin later.</p>
          <div className="reward-mode-docs">
            <article><span><Gift/></span><small>MODE 01</small><h3>Holder Rewards</h3><p>The full reward share buys the selected pair asset and allocates it proportionally by balance × time held. Cumulative Merkle checkpoints let each wallet collect its outstanding market rewards in one claim.</p><b>Fairness</b><p>Continuous balance history replaces a single snapshot. Infrastructure accounts and the creator wallet are excluded.</p></article>
            <article><span><Flame/></span><small>MODE 02</small><h3>Buyback &amp; Burn</h3><p>The reward share is settled into SOL, swapped back through the live market for that launch token, and the purchased tokens are permanently burned.</p><b>Fairness</b><p>The buy and burn use public Solana transactions. AQUA records the SOL spent, token amount bought, buy signature and burn signature.</p></article>
            <article><span><Trophy/></span><small>MODE 03</small><h3>Hourly Jackpot</h3><p>Each eligible pot goes to five distinct holders: 50%, 20%, 20%, 5% and 5%. Winnings accumulate through the same one-claim reward distributor.</p><b>Fairness</b><p>Scores are committed before randomness is known. A future finalized Solana block supplies draw entropy, and the snapshot hash, blockhash, scores and winners remain auditable.</p></article>
          </div>
          <Callout title="Jackpot scoring rewards behaviour across the whole hour">
            Balance earns score over time. New purchases mature into full scoring weight over 15 minutes, so buying immediately before the close has little effect. Any outbound transfer is treated like a sale and removes the same proportion of score already earned. Wallets with no outbound movement receive a modest 10% consistency multiplier. Winners are drawn without replacement, so one wallet cannot take two places in the same hour.
          </Callout>
          <p>If the jackpot is worth less than $10 or fewer than five eligible wallets exist, the value rolls forward instead of producing a tiny or invalid draw. Chance-based rewards can be regulated differently by jurisdiction, so Jackpot remains controlled by an environment flag and requires the applicable product and legal checks before mainnet activation.</p>
        </DocSection>

        <DocSection id="holder-rewards" eyebrow="FEES AND REWARDS" title="How holder rewards are calculated">
          <p>Reward rounds use <strong>balance multiplied by time held</strong>. Holding twice as many tokens for the same period creates twice the weight. Holding the same balance for twice as long also creates twice the weight. Buying immediately before a round does not earn the same share as holding throughout it.</p>
          <div className="aqua-docs-formula">
            <span>Wallet balance</span><b>×</b><span>Seconds held</span><b>=</b><strong>Reward weight</strong>
          </div>
          <p>Every {epochLength}, AQUA attempts to allocate whatever holder-reward value has been collected; there is no application-level minimum funding amount. The dedicated reward wallet converts reserved reward SOL into the market’s selected tokenized stock. SOL-paired markets keep SOL as the reward asset. AQUA then builds a Merkle tree from eligible wallet weights, funds an on-chain reward vault and publishes the root. If an amount is too small for a swap or on-chain precision, it remains available for a later cycle.</p>
          <h3>Who is excluded</h3>
          <p>The creator wallet, the Whirlpool and position accounts, AQUA PDAs, the fee vault, permanent lock accounts, fee keeper, treasury, reward wallet and buyback wallet are excluded. Those accounts hold tokens for infrastructure or protocol operations rather than as ordinary holders. Excluding them prevents rewards from being sent back into inactive vaults.</p>
          <div className="aqua-docs-benefits">
            <Principle icon={<Clock3/>} title="Time matters" text="The calculation rewards sustained ownership instead of a last-second snapshot."/>
            <Principle icon={<Layers3/>} title="Proportional" text="Each eligible wallet receives its weight as a fraction of total eligible weight."/>
            <Principle icon={<ShieldCheck/>} title="Reconciled" text="Purchased reward assets must match the funded epoch before claims become available."/>
          </div>
        </DocSection>

        <DocSection id="claiming" eyebrow="FEES AND REWARDS" title="Claiming rewards">
          <p>Connect the eligible wallet on the Rewards page. AQUA combines that wallet’s holder allocations or jackpot winnings into one cumulative amount per market and estimates the Solana transaction and account-creation costs. Claiming unlocks only when the reward remaining after those estimated costs is worth more than {minimumClaim}. The displayed values stay in dollars; the successful claim delivers the market’s reward asset.</p>
          <div className="aqua-docs-checklist">
            <CheckItem>One cumulative claim record is maintained per wallet, per market.</CheckItem>
            <CheckItem>The program rejects an amount or proof that does not match the published root.</CheckItem>
            <CheckItem>Unclaimed funds stay in the program-controlled epoch vault.</CheckItem>
            <CheckItem>The claimant pays the claim transaction, claim-account rent and any missing reward token-account rent.</CheckItem>
            <CheckItem>All outstanding epochs for that market are collected with one wallet approval.</CheckItem>
          </div>
          <Link className="aqua-docs-inline-link" to="/rewards">Open holder rewards <ArrowRight size={15}/></Link>
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
            <ScoreCard supply={formatBps(targetSupplyBps)} duration="About 6 months" result={formatBps(maximumCreatorShareBps / 2)}/>
            <ScoreCard supply={formatBps(targetSupplyBps / 2)} duration="About 6 months" result={formatBps(maximumCreatorShareBps / 4)}/>
          </div>
          <div className="aqua-docs-formula creator-formula">
            <span>Supply score</span><b>×</b><span>Duration score</span><b>×</b><strong>{formatBps(maximumCreatorShareBps)} cap</strong>
          </div>
          <p className="fine-print">The fee share applies only while the lock is active. Values shown are simplified examples; the program calculates integer basis points from the exact token amount and duration.</p>
        </DocSection>

        <DocSection id="numbers" eyebrow="REFERENCE" title="The fixed numbers">
          <table className="aqua-docs-table reference-table">
            <tbody>
              <ReferenceRow label="Token supply" value={totalSupply}/>
              <ReferenceRow label="Token decimals" value={String(tokenDecimals)}/>
              <ReferenceRow label="Supply committed to liquidity" value={formatBps(liquiditySupplyBps)}/>
              <ReferenceRow label="Separate AQUA supply reserve" value="None"/>
              <ReferenceRow label="Starting market cap target" value={"$" + startMarketCap.toLocaleString("en-GB")}/>
              <ReferenceRow label="Token transfer fee" value={formatBps(config.fees.transferFeeBps)}/>
              <ReferenceRow label="Holder reward stream" value={formatBps(config.fees.stockRewardsBps) + " of transfer value"}/>
              <ReferenceRow label="Platform stream" value={formatBps(config.fees.platformBps) + " of transfer value"}/>
              <ReferenceRow label="Maximum creator share" value={formatBps(maximumCreatorShareBps) + " of platform stream"}/>
              <ReferenceRow label="Permanent liquidity lock" value="Required"/>
              <ReferenceRow label="Reward epoch target" value={epochLength}/>
              <ReferenceRow label="Minimum reward conversion value" value="None at application level"/>
              <ReferenceRow label="Minimum claim value" value={`More than ${minimumClaim} after estimated Solana costs`}/>
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
    <span><Landmark/><b>{label}</b></span><code>{address.slice(0, 8)}…{address.slice(-8)}</code><ExternalLink/>
  </a>;
}

function Risk({ title, children }: { title: string; children: ReactNode }) {
  return <div><BadgeDollarSign/><h3>{title}</h3><p>{children}</p></div>;
}
