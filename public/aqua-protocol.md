# AQUA protocol overview

Last updated: 23 September 2026

AQUA is a non-custodial Solana token launchpad. It prepares wallet-approved transactions that create a Token-2022 mint, an Orca Whirlpool, opening concentrated liquidity and a permanent lock over the liquidity position. AQUA has no bonding curve and no separate escrow or reserve wallet holding launch supply.

## Launch model

A launch has a fixed supply of 1,000,000,000 tokens with six decimals under the current default configuration. The full launch allocation is committed to the opening Orca liquidity plan. The creator may choose SOL, a supported tokenized-stock pair or an eligible custom token when enabled. The selected reward asset is recorded independently and is immutable for that market.

AQUA shows the platform launch fee separately from estimated Solana network fees and account rent. Network and rent estimates are not quotes; the wallet and confirmed transaction are authoritative. An optional first buy is separate from the launch cost.

The launch sequence is:

1. Upload artwork and create permanent metadata.
2. Create and initialise the Token-2022 mint.
3. Create the Orca Whirlpool.
4. For an optional dev buy, prepare the empty position and fund the selected pair asset before opening trading.
5. Activate the full planned liquidity and execute the dev buy in the same transaction. A failed buy rolls back activation. Launches without a dev buy add liquidity normally.
6. Verify that the position is active and permanently lock it.

A permanent position lock prevents the position NFT from being used to withdraw the opening liquidity through the normal owner path. It does not prevent trading, eliminate volatility or guarantee market depth.

## Trading and market cap

Trades execute in the market's Orca Whirlpool. Pool balances change when people buy and sell. USD price and market-cap lines use AQUA pool snapshots. Separately labelled OHLC candles use indexed trade amounts in the pair asset; sparse snapshots are not presented as trade candles. Index data can lag the chain.

## Transfer fees and settlement

The current default fee is 2%: 1% for the platform stream and 1% for the holder-reward stream. AQUA settles the collected value in SOL before routing treasury, buyback and creator allocations. The holder allocation is then converted from SOL into the market's selected reward asset when required.

Keeper settlement is operational and is not guaranteed to run at a precise time. A failed or delayed keeper cycle can delay treasury, buyback, creator and holder-reward accounting without changing the signed trade.

## Holder rewards

Holder rewards are time-weighted. During each 20-minute target epoch, an eligible wallet's balance contributes weight for the time it remains held. A simplified expression is token balance multiplied by seconds held. There is no application-level minimum amount before AQUA attempts an allocation; dust that cannot be swapped or represented at the reward asset's precision remains available for a later cycle. AQUA builds an epoch distribution and publishes its Merkle root.

The Rewards page combines eligible allocations or jackpot winnings into a cumulative amount per wallet and market. Claims require a value above the configured minimum after estimated Solana and account-creation costs. Outstanding allocations for a market can be collected through one wallet approval using the cumulative distributor. Values are displayed in US dollars; claims deliver the actual reward asset.

Opening liquidity and excluded protocol accounts are not ordinary holder positions. Rewards only become redeemable after fees are collected, converted, the epoch is finalised, the root is published, and a valid proof exists. Market and coin pages show both lifetime accumulated reward value and the amount currently redeemable by holders.

## Creator fees and locks

Creators do not automatically receive an unlimited fee share. They may lock tokens they acquired after launch. The active quote combines:

- an amount component, capped at the configured target percentage of total supply; and
- a duration component, capped at the configured maximum duration.

Use /api/config for current creatorLocks.targetSupplyBps, maximumSeconds and maximumFeeShareBps, and fees.platformBps. Do not hard-code a creator share from this document. The backend configuration and quote endpoint are authoritative. Locking a tiny amount for 1,000 years does not produce a large share: the duration is capped and the small amount remains a small amount score.

When a lock is active, accrued creator fees can be claimed through a creator-wallet transaction. Locked tokens can only be released after maturity.

## Wallets and interrupted launches

Connect Phantom, MetaMask or Solflare using the Solana account that holds your tokens. Mobile Phantom can open its app to complete the connection. A saved launch resumes only when you press Resume launch. Existing on-chain progress is checked before preparing remaining steps; a refresh does not restart or sign a launch.

## Reward modes

Creators choose a permanent reward mode: time-weighted holder rewards, buyback and burn of the launched coin, or an hourly jackpot. The jackpot selects five distinct eligible holders for 50%, 20%, 20%, 5% and 5% of the pot, with committed holding scores and verifiable draw data. Trading activity and successfully settled fees are required for any mode.

## DEX profile funding and governance

Holders with at least 0.5% of supply can create eligible proposals once proposals unlock. Voting requires 0.1% current and time-weighted holdings. Approved DEX profile funding reserves 80% of incoming market rewards toward the $300 initial profile target. Update Dex and Community Takeover have separate votes. Governance approval, funding and external fulfillment are distinct stages.

## DEX boost polls

A paid DEX profile is required. Holders choose 5%, 10%, 20% or No; the winning approved percentage funds a one-hour campaign from incoming market rewards. At closing, the largest affordable boost is selected and surplus SOL returns to holder rewards. Configured packs are 10× for $99 (12 hours), 30× for $249 (12 hours), 50× for $399 (12 hours), 100× for $899 (24 hours), and 500× for $3,999 (24 hours). Affordability is checked again before purchase.

## Automatic momentum funds

Sustained, verified volume and trader activity can start a mini fund. Unpaid profiles reserve 10% toward DEX funding for up to 24 hours; an unmet target returns funds to holders. Paid profiles can reserve 5% for a mini boost lasting up to one hour, closing earlier after five minutes of insufficient activity. Mini boosts under $100 return all funds; at $100 or more they select the largest affordable pack and return excess. Successful holder votes inherit accumulated funds and change the percentage; an inherited boost keeps its original deadline. All eligible coins, including AQUA, can have mini boosts. AQUA has no ordinary market proposals or automatic profile fund. Team AQUA can prepare missing profile details for a successful automatic profile fund; later changes go through Update Dex.

## Community chat, updates and polls

Each coin has Community chat with pictures, replies and counted reactions, plus separate creator Updates and Polls feeds. Updates support formatted text and images, with reactions but no replies. Polls show their closing time and can require at least 0.1% holdings to vote. Community polls do not authorize spending. Unread indicators and locally remembered tabs help you follow activity. Reports go to AQUA admins through the moderation system and Discord webhook; creators have no special moderation rights.

## Atlantis Studio

Build websites, artwork and community tools in one workspace. Tailored multiple-choice surveys clarify uncertain creative details and include custom answers; Skip survey lets Atlantis proceed from the brief. Review proposed edits or enable Auto apply. When free access is enabled, each wallet receives a $10 total AI budget across projects. Usage does not reset on project deletion, and unused generation reservations are released. Editing and exporting remain available after the budget is spent.

## Website publishing and variables

Publish a project to an available name on aquafamily.fun. Draft edits stay private and failed publishes preserve the previous version. The separate Variables menu stores public CA, custom backend URL and other frontend values. Automatic CA filling requires explicit consent. When enabled, a confirmed launch fills connected fields and trading links and queues the hosted update. Hardcoded legacy fields must first be connected. Custom backends are exported and deployed separately; never put secrets in frontend variables.

## Public AQUA API

Use https://aquafamily.fun/v1 for public markets, trades, charts, rewards, buybacks, burns, jackpots, governance and events. The previous production Railway API address remains supported. Public data reads work from third-party websites without an API key, with a limit of 60 requests per minute per IP. Webhook management requires a wallet session. Atlantis uses this canonical API for AQUA data and keeps it separate from a generated project’s own backend URL.

## Risks

Cryptoassets can lose all value. Direct Orca markets can have low liquidity, high slippage and sharp price changes. Smart contracts, Solana, Orca, wallets, RPC services, indexers, metadata storage and tokenized-asset providers can fail or change.

Tokenized stocks are third-party blockchain assets. Availability, transferability and redemption can depend on jurisdiction and provider rules. A ticker or logo does not mean the issuer or AQUA endorses a launched token.

This document is an explanatory summary. The live configuration, program code, onchain accounts and signed transactions are authoritative.
