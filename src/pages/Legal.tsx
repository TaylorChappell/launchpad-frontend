import { Link } from "react-router-dom";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

const terms: LegalSection[] = [
  {
    title: "Using AQUA",
    paragraphs: [
      "AQUA provides software for creating and interacting with blockchain tokens, liquidity pools, reward programs, and related market data. You are responsible for confirming that your use of AQUA is lawful where you live.",
      "You must be legally able to enter into these terms and must not use AQUA for fraud, market manipulation, sanctions evasion, money laundering, or any other unlawful activity.",
    ],
  },
  {
    title: "Wallets and transactions",
    paragraphs: [
      "AQUA is non-custodial. You control your wallet, private keys, approvals, and signed transactions. AQUA cannot recover lost keys or reverse a confirmed blockchain transaction.",
      "Always review the network, token address, amounts, fees, slippage, and destination before signing. Blockchain transactions can fail, be delayed, or cost more than expected.",
    ],
  },
  {
    title: "Tokens and rewards",
    paragraphs: [
      "Tokens launched through AQUA can be highly volatile and may lose all value. Creator locks, reward rates, buybacks, liquidity conditions, and distribution rules must be verified onchain before relying on them.",
      "Tokenized stock products and stock-linked rewards may be regulated, geographically restricted, unavailable, suspended, or non-redeemable for some users. Eligibility is determined by the relevant provider and applicable law.",
    ],
  },
  {
    title: "Third-party services",
    paragraphs: [
      "AQUA may connect to wallets, Solana, Orca, data providers, tokenized asset providers, and other third-party services. Those services have their own terms, fees, risks, and availability. AQUA does not control them.",
    ],
  },
  {
    title: "No financial advice",
    paragraphs: [
      "Nothing on AQUA is financial, investment, legal, or tax advice. Market data may be delayed or inaccurate. You are responsible for your own research and decisions.",
    ],
  },
  {
    title: "Availability and liability",
    paragraphs: [
      "AQUA is provided as available without a guarantee of uninterrupted operation, profitability, token value, reward delivery, liquidity, or smart contract security. To the fullest extent allowed by law, AQUA is not liable for indirect loss, lost profits, wallet compromise, third-party failures, or blockchain events outside its control.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "AQUA may update these terms as the product, providers, or legal requirements change. Continued use after an update means you accept the revised terms.",
    ],
  },
];

const privacy: LegalSection[] = [
  {
    title: "Information AQUA processes",
    paragraphs: [
      "AQUA may process public wallet addresses, signed authentication messages, transaction identifiers, token activity, reward eligibility, device and browser information, IP-derived security data, and information you submit when launching a token.",
      "AQUA does not need your wallet seed phrase or private key. Never provide either one to AQUA or to anyone claiming to represent AQUA.",
    ],
  },
  {
    title: "How information is used",
    paragraphs: [
      "Information is used to operate wallet sessions, display markets, prepare transactions, calculate rewards, prevent abuse, diagnose failures, support users, and meet legal obligations.",
    ],
  },
  {
    title: "Public blockchain data",
    paragraphs: [
      "Blockchain transactions are public and permanent. Wallet addresses and activity can be viewed, copied, and analysed by anyone. AQUA cannot delete information recorded on a public blockchain.",
    ],
  },
  {
    title: "Service providers",
    paragraphs: [
      "AQUA may use hosting, analytics, blockchain infrastructure, wallet, liquidity, security, and tokenized asset providers. Information is shared only as needed to operate those services, protect the platform, or comply with law.",
    ],
  },
  {
    title: "Retention and security",
    paragraphs: [
      "Information is retained only as long as needed for the purposes described here, subject to legal and security requirements. Reasonable safeguards are used, but no online or blockchain system can be guaranteed completely secure.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: [
      "You can disconnect your wallet at any time. Depending on your location, you may have rights to access, correct, delete, restrict, or export personal information that AQUA controls. These rights do not apply to immutable public blockchain records.",
    ],
  },
  {
    title: "Updates",
    paragraphs: [
      "This policy may be updated when AQUA changes its services, providers, or legal obligations. The date on this page shows the latest revision.",
    ],
  },
];

export function Terms() {
  return <LegalPage title="Terms of Service" intro="These terms govern access to and use of AQUA." sections={terms}/>;
}

export function Privacy() {
  return <LegalPage title="Privacy Policy" intro="This policy explains what AQUA processes and how that information is used." sections={privacy}/>;
}

function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return <main className="page legal-page">
    <header>
      <Link to="/">AQUA</Link>
      <h1>{title}</h1>
      <p>{intro}</p>
      <small>Last updated 11 September 2026</small>
    </header>
    <div className="legal-content">
      {sections.map((section) => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
    </div>
  </main>;
}
