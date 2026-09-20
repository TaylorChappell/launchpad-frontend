import { Link } from "react-router-dom";

type LegalSection = { title: string; paragraphs: string[] };

const terms: LegalSection[] = [
  { title: "Agreement and eligibility", paragraphs: [
    "These Terms of Service are an agreement between you and the operator of AQUA. By accessing AQUA, connecting a wallet, launching a token, trading, locking tokens, or claiming rewards or fees, you confirm that you have read and agree to these terms.",
    "You must be at least 18 years old, have legal capacity to enter this agreement, and be permitted to use blockchain and cryptoasset services in your location. Do not use AQUA if local law, sanctions, or a provider restriction prohibits it."
  ]},
  { title: "What AQUA provides", paragraphs: [
    "AQUA provides non-custodial software that helps users prepare transactions for Solana tokens, direct Orca Whirlpools, permanent liquidity locks, transfer-fee routing, holder rewards, and optional creator locks. AQUA is not a bank, broker, exchange, investment adviser, or custodian.",
    "Your wallet controls your keys and approvals. AQUA cannot recover a seed phrase, restore a wallet, cancel a signed transaction, or reverse a confirmed blockchain action."
  ]},
  { title: "Launching a coin", paragraphs: [
    "A launcher is responsible for the token name, symbol, artwork, description, links, wallet, pair, initial buy, and every submitted transaction. You represent that your submitted content is accurate, lawful, and does not infringe another person's intellectual property or impersonate another project.",
    "You must not launch or promote a token as a way to deceive users, manipulate a market, evade law, misstate ownership, promise guaranteed profit, or offer a regulated product without all required permissions."
  ]},
  { title: "Onchain mechanics and permanence", paragraphs: [
    "AQUA launch transactions create immutable or difficult-to-change onchain state. The opening token supply is committed to the configured Orca liquidity position and the position is intended to be locked permanently. There is no AQUA escrow allocation for unsold supply.",
    "Smart contracts, Token-2022, Solana, Orca, wallets, RPC providers, indexers, and tokenized-asset providers can contain bugs, fail, change, or become unavailable. Verify mint, program, pool, lock, token-program and destination accounts before signing."
  ]},
  { title: "Fees, rewards, and creator locks", paragraphs: [
    "Before launch, AQUA shows an estimated platform fee and estimated network and account-rent costs. The wallet approval and final onchain execution are authoritative; estimates can change with network conditions and optional actions.",
    "Transfer fees, platform allocations, holder rewards, buybacks, and creator fee shares depend on successful onchain collection and offchain keeper operations. They are not guaranteed income. Creator lock scoring is capped by both the amount target and maximum duration shown by the live backend; extra amount or extreme duration does not create unlimited fee share."
  ]},
  { title: "Trading and cryptoasset risk", paragraphs: [
    "Cryptoassets are high risk and can lose all value. Liquidity may be thin, market-cap data may be delayed, prices may move sharply, slippage can be substantial, and a position may be impossible to exit. Do not use money you cannot afford to lose.",
    "Nothing on AQUA is financial, investment, legal, accounting, or tax advice. Charts, rankings, market caps, projected rewards, and creator quotes are informational and may be incomplete or inaccurate."
  ]},
  { title: "Tokenized stocks and third parties", paragraphs: [
    "Tokenized stocks and stock-linked rewards are third-party blockchain assets, not shares held through AQUA. They may be geographically restricted, suspended, frozen, non-redeemable, or subject to provider eligibility rules. A ticker or logo does not mean AQUA or the issuer endorses a launched token.",
    "AQUA may link to or depend on Solana, Orca, wallets, RPC services, metadata storage, indexers, tokenized-asset issuers, and swap providers. Their separate terms, fees, privacy practices, and availability apply."
  ]},
  { title: "Prohibited use", paragraphs: [
    "You may not use AQUA for fraud, theft, money laundering, sanctions evasion, unlawful financial promotion, wash trading, market manipulation, malware, denial-of-service activity, unauthorised access, or any activity that violates law or another person's rights.",
    "AQUA may restrict the website or transaction-building service when reasonably necessary for security, compliance, maintenance, abuse prevention, or protection of users. Existing onchain programs and transactions may remain accessible independently."
  ]},
  { title: "Content and intellectual property", paragraphs: [
    "You retain rights in content you submit. You grant AQUA a worldwide, non-exclusive licence to host, reproduce, cache, and display that content as needed to operate, index, and describe the token and service.",
    "The AQUA interface, branding, and original site content are protected by applicable intellectual-property law. You may not misrepresent an unauthorised copy as the official AQUA service."
  ]},
  { title: "Disclaimers and liability", paragraphs: [
    "AQUA is provided on an as-available basis without promises of uninterrupted access, profitability, reward delivery, liquidity, accurate indexing, smart-contract security, or fitness for a particular purpose.",
    "To the fullest extent permitted by law, AQUA is not liable for indirect or consequential loss, lost profits, loss of tokens or keys, wallet compromise, third-party failure, price movement, failed transactions, tax consequences, or blockchain events outside its reasonable control. Nothing in these terms excludes liability that cannot legally be excluded."
  ]},
  { title: "Changes and governing law", paragraphs: [
    "AQUA may update the service and these terms. Material updates will be identified by the revision date. Continued use after an update means you accept the revised terms.",
    "Unless mandatory local law requires otherwise, these terms and non-contractual disputes are governed by the laws of England and Wales, and the courts of England and Wales have jurisdiction."
  ]}
];

const privacy: LegalSection[] = [
  {title:"Atlantis Studio and integrations",paragraphs:["Studio stores prompts, generated files, project versions and usage records linked to your wallet. Relevant project context and requested artwork are sent to the configured AI providers to fulfil generation requests. Do not put credentials or private keys in prompts or generated frontend code.","Connecting GitHub allows repository and workflow export. Integration tokens are encrypted by the backend. Railway project tokens supplied for direct export are used for that request rather than stored as a reusable connection. Exported repositories and published websites are also subject to the visibility and retention settings of the hosting provider.","Theme preferences, watchlists and draft launch files are saved on your device. Signing out revokes the current wallet session. Clearing browser storage removes local preferences and drafts, but does not remove stored Studio projects or public blockchain records."]},
  { title: "Information AQUA processes", paragraphs: [
    "AQUA may process public wallet addresses, signed authentication messages, transaction identifiers, token activity, reward eligibility, device and browser information, IP-derived security data, and information submitted during a token launch.",
    "AQUA does not need your wallet seed phrase or private key. Never provide either to AQUA or to anyone claiming to represent AQUA."
  ]},
  { title: "Purposes and lawful use", paragraphs: [
    "Information is used to operate wallet sessions, display and index markets, prepare transactions, calculate rewards and creator fees, prevent abuse, diagnose failures, secure the service, support users, and meet legal obligations.",
    "Where data-protection law applies, processing may rely on providing the requested service, legitimate interests in operating and securing AQUA, consent where requested, and compliance with legal obligations."
  ]},
  { title: "Public blockchain data", paragraphs: [
    "Blockchain transactions are public and generally permanent. Wallet addresses and activity can be viewed, copied, and analysed by anyone. AQUA cannot erase information recorded on Solana."
  ]},
  { title: "Service providers and transfers", paragraphs: [
    "AQUA may use hosting, analytics, blockchain infrastructure, RPC, wallet, liquidity, security, metadata, and tokenized-asset providers. Data is shared as needed to operate those services, protect AQUA and users, or comply with law. Providers may process data in other countries under their own safeguards."
  ]},
  { title: "Retention and security", paragraphs: [
    "Offchain information is retained only as long as reasonably needed for the purposes described here, subject to legal, fraud-prevention, backup, and security requirements. Reasonable safeguards are used, but no online or blockchain system is completely secure."
  ]},
  { title: "Your choices and rights", paragraphs: [
    "You can disconnect your wallet and avoid submitting optional information. Depending on your location, you may have rights to access, correct, delete, restrict, object to, or export personal information controlled by AQUA. These rights do not apply to immutable public blockchain records or data controlled by another provider."
  ]},
  { title: "Updates", paragraphs: [
    "This policy may be updated when AQUA changes its services, providers, or legal obligations. The revision date below identifies the latest version."
  ]}
];

export function Terms() { return <LegalPage title="Terms of Service" intro="These terms govern every use of AQUA, including wallet connection, launches, trades, creator locks, fees and rewards." sections={terms} warning/>; }
export function Privacy() { return <LegalPage title="Privacy Policy" intro="This policy explains the data AQUA processes, why it is used and the choices available to you." sections={privacy}/>; }

function LegalPage({ title, intro, sections, warning = false }: { title: string; intro: string; sections: LegalSection[]; warning?: boolean }) {
  return <main className="page legal-page">
    <header><Link to="/">AQUA</Link><h1>{title}</h1><p>{intro}</p><small>Last updated 20 September 2026</small></header>
    {warning && <div className="legal-risk-warning"><b>Cryptoasset risk warning</b><span>Cryptoassets are high risk. You could lose all the money you invest and may not be protected if something goes wrong.</span></div>}
    <div className="legal-content">{sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</div>
  </main>;
}
