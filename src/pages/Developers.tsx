import { useMemo, useState } from "react";
import { Check, ChevronRight, Clipboard, Code2, ExternalLink, Radio, ShieldCheck, Webhook } from "lucide-react";
import { API_URL } from "../api";
import { AquaMark } from "../components/AquaMark";

const endpoints = [
  ["GET", "/v1/markets", "List and filter live markets"],
  ["GET", "/v1/markets/:id", "Retrieve a market by ID or mint"],
  ["GET", "/v1/markets/:id/trades", "Indexed market trades"],
  ["GET", "/v1/markets/:id/chart", "Price, market cap, TVL and volume series"],
  ["GET", "/v1/markets/:id/buybacks", "Recorded token buybacks"],
  ["GET", "/v1/markets/:id/burns", "Buyback-and-burn settlements"],
  ["GET", "/v1/markets/:id/jackpots", "Jackpot rounds and winners"],
  ["GET", "/v1/markets/:id/rewards", "Holder reward epochs"],
  ["GET", "/v1/governance", "Current AQUA market vote"],
  ["GET", "/v1/analytics", "Protocol-level totals"],
  ["GET", "/v1/events", "Replay events from a cursor"],
  ["GET", "/v1/webhooks", "List webhook endpoints"],
  ["POST", "/v1/webhooks", "Create a signed webhook"],
  ["POST", "/v1/webhooks/:id/test", "Send a test delivery"],
  ["GET", "/v1/webhooks/:id/deliveries", "Inspect delivery attempts"],
  ["DELETE", "/v1/webhooks/:id", "Disable a webhook"],
] as const;

const eventGroups = [
  { title: "Markets", tone: "blue", events: [["market.created", "A launch record is created."], ["market.live", "A market becomes tradable."], ["market.trade", "An indexed buy or sell is confirmed."], ["market.updated", "Indexed price and liquidity metrics change."]] },
  { title: "Rewards & fees", tone: "aqua", events: [["fees.settled", "Collected fees are settled."], ["reward.funded", "A reward epoch is funded."], ["reward.claimable", "Rewards become claimable."], ["reward.claimed", "A holder completes a claim."]] },
  { title: "Buybacks", tone: "red", events: [["buyback.executed", "A tracked buyback confirms."], ["burn.executed", "Bought tokens are permanently burned."]] },
  { title: "Jackpots", tone: "gold", events: [["jackpot.committed", "A draw is committed with its snapshot."], ["jackpot.drawn", "Entropy selects the winners."], ["jackpot.published", "The final result is published."]] },
  { title: "Governance & locks", tone: "violet", events: [["governance.vote_cast", "A vote is created or changed."], ["governance.round_finalized", "The next boosted market is finalized."], ["lock.created", "Creator tokens enter a lock vault."], ["lock.released", "An eligible creator lock is released."]] },
] as const;

const curlExample = `curl ${API_URL}/v1/markets?reward_mode=jackpot \\
  -H "Accept: application/json"`;

const webhookExample = `const expected = createHmac("sha256", secret)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex");

timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(\`v1=\${expected}\`)
);`;

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="dev-copy" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} aria-label={`Copy ${label}`}>
    {copied ? <Check/> : <Clipboard/>}<span>{copied ? "Copied" : label}</span>
  </button>;
}

export function Developers() {
  const baseHost = useMemo(() => { try { return new URL(API_URL).host; } catch { return API_URL; } }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return <main className="dev-page">
    <section className="dev-hero">
      <div className="dev-hero-mark"><AquaMark/></div>
      <div><h1>Build with live market data.</h1><p>One predictable API for AQUA markets, rewards, buybacks, burns, jackpots, governance and signed webhooks.</p></div>
    </section>

    <div className="dev-shell">
      <aside className="dev-sidebar">
        <span>GET STARTED</span>
        <button onClick={() => scrollTo("overview")}>Overview</button><button onClick={() => scrollTo("limits")}>Rate limits</button>
        <span>REFERENCE</span>
        <button onClick={() => scrollTo("endpoints")}>Endpoints</button><button onClick={() => scrollTo("events")}>Events</button><button onClick={() => scrollTo("webhooks")}>Webhooks</button><button onClick={() => scrollTo("errors")}>Errors</button>
        <a className="dev-base" href={`${API_URL}/v1`} target="_blank" rel="noreferrer"><small>BASE URL</small><b>{baseHost}</b><ExternalLink/></a>
      </aside>

      <article className="dev-docs">
        <section id="overview" className="dev-section">
          <span className="dev-kicker"><Code2/>QUICKSTART</span><h2>A stable, indexed API</h2>
          <p>The AQUA API serves normalized data from AQUA’s indexers. Responses use JSON, event <code>created</code> timestamps are Unix milliseconds, scheduled round boundaries are Unix seconds, raw token quantities are strings, and monetary values are returned in human-readable units.</p>
          <div className="dev-code"><header><span>Request</span><CopyButton value={curlExample}/></header><pre><code>{curlExample}</code></pre></div>
          <div className="dev-callout"><ShieldCheck/><div><b>Read-only by design</b><span>The public API does not expose keeper, admin or transaction-signing routes. No account or API key is required.</span></div></div>
        </section>

        <section id="limits" className="dev-section">
          <span className="dev-kicker"><Radio/>RATE LIMITS</span><h2>No API key required</h2>
          <div className="dev-limit-grid two"><div className="featured"><b>60</b><span>requests / minute</span><small>Per IP address</small></div><div><b>10</b><span>webhook endpoints</span><small>Per IP address</small></div></div>
          <p>AQUA identifies callers by IP and uses a one-minute request bucket. Check <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code>. A <code>429</code> also includes <code>Retry-After</code>.</p>
        </section>

        <section id="endpoints" className="dev-section">
          <span className="dev-kicker"><Code2/>REST API</span><h2>Endpoints</h2><p>Collection routes support <code>limit</code> and <code>cursor</code>. Market IDs may be replaced with the market token mint where noted.</p>
          <div className="dev-endpoints">{endpoints.map(([method, path, description]) => <div key={`${method}:${path}`}><span className={`dev-method ${method.toLowerCase()}`}>{method}</span><code>{path}</code><p>{description}</p><ChevronRight/></div>)}</div>
        </section>

        <section id="events" className="dev-section">
          <span className="dev-kicker"><Radio/>EVENT CATALOG</span><h2>Replayable events</h2>
          <p>Every event has a durable ascending <code>sequence</code>. Save the last sequence you processed and pass it back as <code>?cursor=1234</code>. Filter with comma-separated <code>types</code> or <code>market_id</code>.</p>
          <div className="dev-event-groups">{eventGroups.map((group) => <div key={group.title}><header><i className={group.tone}/><b>{group.title}</b></header>{group.events.map(([name, description]) => <p key={name}><code>{name}</code><span>{description}</span></p>)}</div>)}</div>
          <div className="dev-event-shape"><div><small>EVENT ENVELOPE</small><code>id</code><code>sequence</code><code>type</code><code>apiVersion</code><code>marketId</code><code>transactionSignature</code><code>created</code><code>data</code></div><pre>{`{
  "id": "a468…",
  "object": "event",
  "sequence": 1842,
  "type": "buyback.executed",
  "apiVersion": "2026-09-16",
  "marketId": "aqua-8beb3d1c",
  "created": 1789589200000,
  "data": { "amountSol": 0.28 }
}`}</pre></div>
        </section>

        <section id="webhooks" className="dev-section">
          <span className="dev-kicker"><Webhook/>WEBHOOKS</span><h2>Signed delivery, with retries</h2>
          <p>Create an endpoint directly from your server and choose exact event types or <code>*</code>. AQUA associates it with the originating IP, attempts delivery immediately, then retries after 30 seconds, 2 minutes, 10 minutes, 1 hour and 6 hours.</p>
          <div className="dev-steps"><div><b>1</b><span><strong>Create</strong><small><code>POST /v1/webhooks</code> with an HTTPS URL and event types.</small></span></div><div><b>2</b><span><strong>Verify</strong><small>Use the raw request body and the signing secret returned once.</small></span></div><div><b>3</b><span><strong>Acknowledge</strong><small>Return any <code>2xx</code> response within eight seconds.</small></span></div></div>
          <div className="dev-code"><header><span>Node.js signature verification</span><CopyButton value={webhookExample}/></header><pre><code>{webhookExample}</code></pre></div>
          <div className="dev-header-list"><p><code>X-Aqua-Event</code><span>Event type</span></p><p><code>X-Aqua-Event-Id</code><span>Idempotency key</span></p><p><code>X-Aqua-Timestamp</code><span>Signature timestamp</span></p><p><code>X-Aqua-Signature</code><span><code>v1=&lt;hex digest&gt;</code></span></p></div>
        </section>

        <section id="errors" className="dev-section">
          <span className="dev-kicker"><ShieldCheck/>ERRORS</span><h2>Consistent error responses</h2>
          <p>Errors return a machine-readable code and a human-readable message. Build retry behavior around the HTTP status, not the message text.</p>
          <div className="dev-error-grid"><p><b>400</b><span>Invalid request</span></p><p><b>404</b><span>Resource not found</span></p><p><b>409</b><span>Resource limit</span></p><p><b>429</b><span>Rate limited</span></p><p><b>500</b><span>Server error</span></p></div>
        </section>
      </article>
    </div>
  </main>;
}
