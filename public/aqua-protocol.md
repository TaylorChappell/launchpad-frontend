# AQUA protocol overview

Last updated: 15 September 2026

AQUA is a non-custodial Solana token launchpad. It prepares wallet-approved transactions that create a Token-2022 mint, an Orca Whirlpool, opening concentrated liquidity and a permanent lock over the liquidity position. AQUA has no bonding curve and no separate escrow or reserve wallet holding launch supply.

## Launch model

A launch has a fixed supply of 1,000,000,000 tokens with six decimals under the current default configuration. The full launch allocation is committed to the opening Orca liquidity plan. The creator may choose a SOL pair or a supported tokenized-stock pair. The selected reward asset is recorded independently and is immutable for that market.

AQUA shows the platform launch fee separately from estimated Solana network fees and account rent. Network and rent estimates are not quotes; the wallet and confirmed transaction are authoritative. An optional first buy is separate from the launch cost.

The launch sequence is:

1. Upload artwork and create permanent metadata.
2. Create and initialise the Token-2022 mint.
3. Create the Orca Whirlpool.
4. add the full planned token liquidity in the configured range.
5. Verify that the position is active.
6. Permanently lock the liquidity position.
7. Optionally perform a first buy.

A permanent position lock prevents the position NFT from being used to withdraw the opening liquidity through the normal owner path. It does not prevent trading, eliminate volatility or guarantee that price remains inside the concentrated-liquidity range.

## Trading and market cap

Trades execute in the market's Orca Whirlpool. Pool balances change when people buy and sell. The market-cap chart is built from AQUA index snapshots and displayed as open, high, low and close candles. It is based on indexed market capitalisation rather than the raw token price. Index data can lag the chain.

## Transfer fees and settlement

The current default Token-2022 transfer fee is 2%: 1% for the platform stream and 1% for the holder-reward stream. Fees are withheld in Token-2022 accounts and require the keeper to discover accounts, harvest withheld tokens, route platform allocations and convert the reward allocation into the market's selected reward asset.

Keeper settlement is operational and is not guaranteed to run at a precise time. A failed or delayed keeper cycle can delay treasury, buyback, creator and holder-reward accounting without changing the signed trade.

## Holder rewards

Holder rewards are time-weighted. During each 20-minute target epoch, an eligible wallet's balance contributes weight for the time it remains held. A simplified expression is token balance multiplied by seconds held. There is no application-level minimum amount before AQUA attempts an allocation; dust that cannot be swapped or represented at the reward asset's precision remains available for a later cycle. AQUA builds an epoch distribution and publishes its Merkle root.

The Rewards page groups a wallet's unclaimed epochs by AQUA market. A claim unlocks only when the combined reward is worth more than $5 after estimated Solana transaction and account-creation costs. Each epoch remains independently verified onchain, so a grouped claim can require multiple wallet approvals. Interface reward amounts are displayed in US dollars, while a successful claim transfers the selected tokenized stock or SOL reward asset.

Opening liquidity and excluded protocol accounts are not ordinary holder positions. Rewards only become redeemable after fees are collected, converted, the epoch is finalised, the root is published, and a valid proof exists. Market and coin pages show both lifetime accumulated reward value and the amount currently redeemable by holders.

## Creator fees and locks

Creators do not automatically receive an unlimited fee share. They may lock tokens they acquired after launch. The active quote combines:

- an amount component, capped at the configured target percentage of total supply; and
- a duration component, capped at the configured maximum duration.

The live default target is 5% of total supply, the maximum scoring duration is 365 days, and the maximum creator share is 25% of the 1% platform stream. The backend configuration and quote endpoint are authoritative. Locking a tiny amount for 1,000 years does not produce a large share: the duration is capped and the small amount remains a small amount score.

When a lock is active, accrued creator fees can be claimed through a creator-wallet transaction. Locked tokens can only be released after maturity.

## Risks

Cryptoassets can lose all value. Direct Orca markets can have low liquidity, high slippage, sharp price changes and out-of-range concentrated liquidity. Smart contracts, Solana, Orca, wallets, RPC services, indexers, metadata storage and tokenized-asset providers can fail or change.

Tokenized stocks are third-party blockchain assets. Availability, transferability and redemption can depend on jurisdiction and provider rules. A ticker or logo does not mean the issuer or AQUA endorses a launched token.

This document is an explanatory summary. The live configuration, program code, onchain accounts and signed transactions are authoritative.
