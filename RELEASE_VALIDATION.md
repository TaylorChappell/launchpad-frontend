# Release validation

Staging deployment verified on 2026-09-20: frontend implementation 6d2c866930533335f1e52862341e63b31b00daab on Cloudflare, backend 97b5b7e45621dff8ffc29bb092d771a621cb7ffa on Railway. Backend /health and /api/status report the expected release. Follow-up frontend commits correct the browser-test locator and record validation. Production has not been promoted.

## Automated checks

- Frontend: TypeScript passed, 18 utility tests passed, production build passed.
- Backend: TypeScript passed, 383 tests across 54 files passed. vitest.config.ts supplies dummy local secrets, not production credentials.
- Browser journeys: npm run test:e2e. Eight cases cover desktop/mobile discovery, filter URLs, wallet focus recovery, missing routes and truthful disconnected holdings.
- CI runs utility tests and browser journeys on main and staging. The GitHub Pages production workflow gates deployment on these checks; Cloudflare staging builds independently.

The production build caught an invalid CSS import left by component extraction; it was corrected and the build rerun.

## Still required before release

The browser refused the localhost preview (ERR_BLOCKED_BY_CLIENT). After staging deployment, the live browser verified discovery, the ORCA filter and wallet dialog close/focus recovery. The first CI browser run passed six cases and caught an overly exact label selector in the two market-filter cases; the selector now targets the accessible combobox role. Check the latest staging CI run for the complete desktop/mobile suite result.

Check 390px, 768px, 1280px and wide desktop in light/navy themes. Include wallet dialogs, token trading, long names, empty/error data, the three-step launch wizard, reward claims, Studio sidebar/composer and exported websites.

Use actual Phantom and MetaMask on mobile and desktop. Verify signed submission, confirmation timeout, conversion success followed by purchase failure, launch recovery and claim idempotency. No live funds were used for local verification.

Generated-site checks run in disposable opaque-origin iframes with network access still blocked. They smoke-test at most 20 pages at two widths and 50 controls per page, detect script/image/overflow issues and flag controls without visible responses. They do not prove semantic correctness, backend behavior, downloads, payments or wallet integration.

## Rollout and compatibility

Deploy the matching backend first. New discovery, holdings, candles, promotion and status APIs are required. Authenticated artwork upload is a deliberate breaking change for older frontends. Review backend OPERATIONS_OVERHAUL.md for webhook ownership migration and worker configuration.

VITE_SHARE_ORIGIN is optional. Leave unset until the domain's /token/* reverse-proxy rule exists; sharing then uses the backend's working token-share URL. Do not enable a pretty URL that still returns 404.

## Remaining follow-through

- Visual QA must guide the final removal of overlapping legacy CSS; deleting unverified rules now could break secondary screens.
- Studio controls and preview checking are extracted, but further decomposition of the large orchestration component remains useful.
- External deployment health is linked, not probed by the network-isolated preview.
- No source-wide financial constants migration, economics change, independent security assessment or isolated backend-preview infrastructure is represented as completed.
