# CleanQuest implementation checklist

The repository was empty at start. No existing files or remote projects were changed.

- [x] A–B: Typed domain, repository boundary, versioned Dexie tables, transactional operations
- [x] C–D: Slovak responsive design, onboarding, editable family template, household builder
- [x] E: 180+ micro-task templates, recurrence, stable weekly/daily snapshots, task CRUD
- [x] F–G: DA, achievements, rest-aware streaks, bounded extras, rewards, wallet, wishlist, undo
- [x] H–I: Problem backlog, deterministic solutions, monthly project, weekly bonus, laundry follow-ups
- [x] J: Validated transactional backup/restore, PWA, update prompt, GitHub Pages workflow
- [x] K: Typecheck, lint, unit/integration tests, build, browser/offline verification

## Implementation plan

1. Implement pure calendar and scheduling rules before UI.
2. Use immutable occurrence snapshots and completion/reward ledgers so editing/deleting cannot erase obligations.
3. Serialize commands within IndexedDB transactions; render only committed state.
4. Build all five navigation sections and short onboarding over the same command API.
5. Verify boundary cases with real IndexedDB integration and mobile production browser tests.
6. Document actual results and manual iPhone checks. Deployment remains approval-gated.

## Current status

The local MVP is prepared for the first approved mobile test release. Latest typecheck, lint, 159 Vitest tests, production build/asset validation and all 24 Chromium/WebKit journeys pass. The dependency audit reports zero vulnerabilities. Physical iPhone Safari/Home Screen sharing and storage acceptance remain manual; desktop WebKit does not verify an actual iPhone. See [release audit](RELEASE_READINESS.md), [deployment procedure](RELEASE.md) and [iPhone checklist](IPHONE_TESTING.md). Nothing was pushed or deployed.

## Visual household milestone — 2026-10-09

- [x] Restrained champagne typography/icons with accessible dark/light colors
- [x] Room dimensions, mixed flooring, window area, curtain/blind presence
- [x] Configured surfaces/textiles produce relevant small tasks; panel counts remain explicit
- [x] SVG room artwork, optional photos, household floor map, editable object positions
- [x] Original room/object targets highlighted in focus and task-location views
- [x] Focus actions stay separate from the scrollable instructions/map
- [x] Dexie v4 migration and backup v2, with legacy backup compatibility
- [x] Domain, persistence, UI and mobile browser verification

Further refinements: measured floor adjacency/layout editing and physical iPhone acceptance. The current map is deliberately schematic.

## Object movement milestone — 2026-10-09

- [x] Finger/mouse dragging in the room layout editor, keyboard and touch-friendly arrow controls
- [x] Explicit layout save/cancel, automatic arrangement reset, always-visible save controls
- [x] Move inventory between rooms with linked tasks and household problems
- [x] Preserve required occurrence identities, recurrence, DA/rewards and completed history
- [x] Restore current location when undoing a completion after an object move
- [x] Transactional draft validation and backup-compatible saved positions
- [x] 130 Vitest tests and 14 mobile Chromium/WebKit journeys pass, including real Chromium touch input

## Local data safety and backups — 2026-10-09

- [x] Dexie v5 binary photos and local safety metadata; legacy photo migration
- [x] Input photo optimization and complete ZIP exports with manifest/checksums
- [x] Native share/save availability detection, download fallback, explicit saved confirmation
- [x] Staged ZIP/legacy JSON validation, preview and current-data export option
- [x] Transactional restore with read-back verification and rollback
- [x] Revision-aware reminders, persistent snooze/dismiss and configurable frequency
- [x] Browser storage estimates, persistence requests and quota failure messages
- [x] Profile backup section and empty-install recovery
- [x] Unit/integration tests for photos, corruption, migration, rollback, quota and accounting
- [x] Final typecheck/lint/build and complete Chromium/WebKit suite: 152 + 18 tests passed
- [ ] Physical iPhone Safari/Home Screen share-to-Files, restore and storage checks

## GitHub Pages release preparation — 2026-10-09

- [x] Actual feature audit with implemented, limited and missing capabilities
- [x] Fix historical-week reservation errors for extras and replacements; two regression tests
- [x] Explicit service-worker scope and automated build/manifest/icon/precache validation
- [x] Separate strict static E2E server and online/offline hash-route refresh/reopening tests
- [x] Full fresh QA: typecheck, lint, 154 unit/integration/UI tests, 20 browser tests, dependency audit
- [x] Production builds verified under `/cleanquest/` and `/`
- [x] Pages workflow: current checkout/setup actions, deployment gate, timeouts and failure evidence
- [x] Release report, exact repository settings, iPhone installation and storage/backup documentation
- [x] Approved public repository patus112/cleanquest created and linked as local origin
- [x] Repository variables: VITE_BASE_PATH=/cleanquest/, CLEANQUEST_DEPLOY_APPROVED=false
- [ ] User approval for source push and publishing
- [ ] Correct push authentication, first commit/push, Pages configuration and successful remote Actions run
- [ ] Physical iPhone installation, native backup sharing, offline relaunch and application update acceptance

## iPhone LAN onboarding fix — 2026-10-09

- [x] Reproduce both creation failures in WebKit over a non-loopback HTTP origin
- [x] UUID v4 fallback through crypto.getRandomValues when randomUUID is unavailable
- [x] Catch preparation/save failures, show Slovak errors, preserve inputs and allow retry
- [x] Show saving state and disable duplicate submission/back navigation during creation
- [x] Regression coverage for HTTP household creation, first completion/DA and persistence in both engines
- [x] Full checks: 159 unit/integration/UI tests, 24 browser journeys, typecheck, lint and production build
- [ ] User retest on the physical iPhone at the same local address after refreshing
