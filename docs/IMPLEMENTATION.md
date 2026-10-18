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

CleanQuest is published at https://patus112.github.io/cleanquest/. The public repository is patus112/cleanquest. Further deployment stays behind the manual `CLEANQUEST_DEPLOY_APPROVED` gate, which was returned to false after the first approved release. The current automated suite is 170 Vitest tests and 26 mobile Chromium/WebKit tests. Physical iPhone Safari/Home Screen sharing and storage acceptance remain manual. See [release audit](RELEASE_READINESS.md), [deployment procedure](RELEASE.md) and [iPhone checklist](IPHONE_TESTING.md).

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
- [x] User approval for first source upload and publishing
- [x] Correct-account source upload, local Git history, Pages configuration and successful remote Actions run
- [ ] Physical iPhone installation, native backup sharing, offline relaunch and application update acceptance

## iPhone LAN onboarding fix — 2026-10-09

- [x] Reproduce both creation failures in WebKit over a non-loopback HTTP origin
- [x] UUID v4 fallback through crypto.getRandomValues when randomUUID is unavailable
- [x] Catch preparation/save failures, show Slovak errors, preserve inputs and allow retry
- [x] Show saving state and disable duplicate submission/back navigation during creation
- [x] Regression coverage for HTTP household creation, first completion/DA and persistence in both engines
- [x] Full checks: 159 unit/integration/UI tests, 24 browser journeys, typecheck, lint and production build
- [ ] User retest on the physical iPhone at the same local address after refreshing

## First approved GitHub Pages release — 2026-10-09

- [x] Upload all 72 project files through the confirmed patus112 connection
- [x] Verify local/remote file equality and preserve local working files
- [x] Configure GitHub Actions as the Pages source and enforce HTTPS
- [x] Correct the prepared-household CI polling deadline; four targeted local scenarios pass
- [x] Full remote QA and deployment: 159 tests + 24 mobile journeys, both jobs successful
- [x] Public HTTPS page, HTML assets, manifest, icons and service-worker verification
- [x] Two additional isolated live-site Chromium/WebKit offline/DA/persistence tests pass
- [x] Restore deployment approval gate to false after the approved release
- [ ] Physical iPhone installation, native ZIP save/restore, offline relaunch and future update acceptance

## Editable onboarding numbers — 2026-10-11

- [x] Reproduce the reported inability to delete the default floor/resident count in a failing React regression test
- [x] Preserve empty numeric drafts while editing; validate floor/resident ranges only when continuing
- [x] Numeric iPhone keyboard hints for counts, decimal keyboard hint and fractional area support
- [x] Preserve edited values across Back/Continue and persist the chosen floors, residents and area
- [x] Typecheck, lint, 170 Vitest tests, production build/PWA asset validation and all 26 mobile Chromium/WebKit journeys passed
- [x] User approved publishing this correction on 2026-10-11
- [ ] Publish and verify the approved correction on GitHub Pages
- [ ] Retest deletion and replacement on the physical iPhone after the approved update
