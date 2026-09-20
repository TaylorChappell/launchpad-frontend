# AQUA launchpad overhaul

Baseline: frontend staging `d17a195`, backend staging `07abb319`.
Implementation branch: `codex/launchpad-overhaul`. Release target: frontend and backend `staging` branches.
Backend snapshot files were verified against GitHub blob hashes before editing.

## Implemented in source

- [x] Trading: 1% default slippage, acknowledgement above 5%, minimum output, wallet balance, sell percentages, available price impact, quote age, explicit conversion recovery, persisted transaction reference/status.
- [x] Live data: merge paginated history, chain-time ordering and cursor pagination, transaction links, runtime configuration retries, honest price freshness, backend-selected history ranges.
- [x] Discovery: server pagination/search/creator queries, ORCA and reward filters, visible sorts, URL state, local watchlist, table/cards, explicit featured and boost labels, stable rankings between manual refreshes.
- [x] Trading workspace: actual indexed-trade OHLC/volume, quote-asset labeling, interval/range/zoom/paging controls, own-trade markers, price/cap snapshot switching, information tabs.
- [x] Design foundation: restrained ocean palette, solid financial surfaces, shared tokens, optional navy theme, responsive rules, removed opening/wallet delays.
- [x] Accessibility: shared dialog focus trap/return, keyboard handling, route error recovery and 404.
- [x] Holders: indexed positions/value, claimable/pending, grouped receipts and lifetime totals, allocation definitions, governance funding/withdrawal evidence, creator lock dates, periodic/manual refresh.
- [x] Creator: three-step wizard, optional advanced section, local draft restore/save, early cost visibility, permanent-choice review, visible execution stages, pending launch recovery, dedicated creator dashboard and post-launch actions.
- [x] Studio: token-to-project handoff, public working examples, extracted controls, route CSS, existing GitHub/backend setup instructions, disposable page/control smoke checks with network isolation preserved.
- [x] Promotion: common server-time countdown, disclosed $5 allowance, remaining allowance and paid-credit fallback.
- [x] Public content: canonical domain, backend-rendered token social pages, current guide wording, newcomer overview, analytics history/definitions/claims, status/support, Studio privacy coverage.
- [x] Backend: authenticated wallet ownership for uploads/webhooks, upload quotas and decoded-image validation, source-slot reference prices, paginated routes, optional worker roles, serialized migration startup, release identifier and observed health metrics.
- [x] Engineering: shared bounded read cache/retries, cancellation, post-write invalidation, auth reads excluded from cache, page-scoped Studio/developer/protocol CSS.
- [x] Quality: dummy-config test setup, new regression/API/ownership/artwork tests, frontend tests in CI, eight authored desktop/mobile browser cases and deployment test gates.

## Verified locally

- Frontend TypeScript: passed.
- Frontend utility tests: **18 passed**.
- Frontend production build: passed.
- Backend TypeScript: passed.
- Backend tests: **383 passed**, 54 files.
- Browser suite discovery: eight cases found; **not executed**.
- Main CSS: about **398 KB / 80 KB gzip**, down from the audited **472 KB / 95 KB gzip**.
- Studio editor remains lazy-loaded at about 2.65 MB / 685 KB gzip.

## Not complete / release gates

- [ ] Visual and real-browser QA. The available browser blocked the localhost preview. Light/navy contrast, responsive layouts and interaction tests must run on staging.
- [ ] Actual mobile-wallet transactions, production-like load and receipt reconciliation.
- [ ] Complete cleanup of superseded legacy CSS, guided by visual regression coverage. Route extraction is implemented; source-wide deletion is not.
- [ ] Further Studio orchestration decomposition and a source-wide single-source-of-truth migration for every financial constant. Existing on-chain/economic constants are unchanged.
- [ ] Per-metric index observations beyond the shared activity/liquidity/holder timestamp, richer notification subscriptions and external deployment-health polling.
- [ ] Generated-site semantic correctness, all controls beyond the bounded smoke-test limits, backend-dependent behavior and real publication checks. The preview does not execute unrestricted network/backend code.
- [ ] Operator deployment of worker services, alert thresholds and the public-domain social-share proxy. The backend share URL works once this backend is deployed; pretty frontend-domain links require the proxy first.
- [ ] Verified migration/recreation of legacy IP-owned webhook endpoints. They are not assigned to an arbitrary wallet.
- [ ] Independent deployed-program and signer-custody assessment, session-storage hardening review, and claim-floor economics review.
- [x] Verify frontend Cloudflare and backend Railway staging deployment against the published implementation commits. Production promotion requires a separate release decision.

See RELEASE_VALIDATION.md and the backend OPERATIONS_OVERHAUL.md before publishing.
