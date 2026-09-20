# Release validation

This release is prepared for the frontend and backend staging branches. Check GitHub Actions and the hosting provider for the deployment status of the published commits; the local checks below do not establish deployment success.

## Automated checks

- Frontend: TypeScript passed, 18 utility tests passed, production build passed.
- Backend: TypeScript passed, 383 tests across 54 files passed. vitest.config.ts supplies dummy local secrets, not production credentials.
- Browser journeys: npm run test:e2e. Eight cases cover desktop/mobile discovery, filter URLs, wallet focus recovery, missing routes and truthful disconnected holdings.
- CI now runs utility tests and browser journeys before frontend deployment, with checks on main and staging.

The production build caught an invalid CSS import left by component extraction; it was corrected and the build rerun.

## Still required before release

The available browser refused the localhost preview (ERR_BLOCKED_BY_CLIENT), so browser tests and visual review were not executed here. Test listing is not a browser-test pass.

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
