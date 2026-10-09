# Quality assurance

## Executed successfully

- TypeScript strict checking: `npm run typecheck`.
- ESLint: `npm run lint`.
- Vitest: 159 tests across domain (95), detailed rooms and object movement (17), IndexedDB repository (14), binary backups/storage (21), React journeys (9), HTTP-compatible identifiers (3).
- Vite production build, service worker and precache generation for `/cleanquest/`.
- Additional root-path build for `/` in a separate temporary output directory, with manifest/start/scope/icon/asset assertions for both paths.
- Playwright mobile Chromium and WebKit production journeys: onboarding and configured appliances; object-bound custom recurring task; focus completion and persistence; weekly reward/independent bonus; bounded extras; redemption/undo correction; problem to Mega project; export/reset/import; cached offline launch and local completion.
- Automated axe WCAG A/AA checks of the mobile dashboard. No horizontal overflow at 375, 390 or 430 CSS pixels. Mobile and desktop screenshots inspected visually.

The visual-household milestone also tests mixed flooring, dimensions, window area without invented panels, textile generation, saved object positions, preserved target references, legacy database/backup compatibility, accessible room forms/maps, direct room navigation and a fully visible focus completion button. Dark and light maps/forms were checked with axe.

Latest checks after the iPhone LAN fix, 2026-10-09: **24/24 Playwright tests passed** (twelve journeys per engine), including light-mode/mobile and desktop axe checks. **159/159** Vitest tests passed; typecheck, lint, production build and automated asset/PWA validation succeeded. There are no remaining failing automated checks. Physical iPhone checks below remain manual. See [release audit](RELEASE_READINESS.md).

The reported iPhone “Vytvoriť môj domov” failure was reproduced before the fix on a real insecure HTTP origin routed to the isolated test server. WebKit exposed `getRandomValues` but omitted `randomUUID`, producing an uncaught TypeError for both onboarding paths. Loopback is browser-trusted and the earlier tests had missed this distinction. UUID v4 generation now falls back to cryptographic random bytes; preparation and rejected-save errors are caught, announced in Slovak, and permit retry without losing settings. Four new browser tests check custom/prepared homes at 30 minutes/gentle/Sunday rest, first completion/DA and exact state persistence after refresh in both engines. Unit tests cover native/fallback identifiers, unavailable randomness, preparation errors, quota errors and retry. This verifies WebKit behavior under the relevant origin restrictions, not the user's physical iPhone itself. API constraints: [Web Crypto specification](https://w3c.github.io/webcrypto/#crypto-interface).

Release regression tests reproduced old unfinished weekly snapshots blocking task replacement and offered extra-energy tasks. Both now use the relevant week's reservations while preserving old obligations and reward accounting. The new browser journey runs on a strict static host with no SPA rewrites, verifies `/cleanquest/profile` correctly returns 404, and checks all five hash routes online/offline after refresh. It verifies service-worker script URL/scope, manifest/icons, saved completion and DA after closing/reopening a page. Both `/cleanquest/` and a separate root `/` build pass `scripts/verify-build.mjs` (seven linked assets, twelve unique precache entries, actual PNG dimensions and Workbox runtime).

The object movement journey exercises a real touch drag in Chromium and a pointer drag in WebKit, arrow buttons and keyboard movement, explicit save, persistence after reload, cancelling an automatic-layout draft, moving into another room with its tasks, and editing the object's room back again. Axe passes for the layout editor; save controls remain fully in the mobile viewport. Domain tests cover linked problems, preserved obligations/rewards/history, undo after a move, foreign/missing destinations and atomic rejection of stale drafts.

The local data-safety milestone adds complete versioned ZIP exports, binary photos, SHA-256 manifest/payload validation, invalid/missing-photo rejection, legacy JSON import, transactional restore verification/rollback, quota-failure preservation, archived accounting/recurrence, persistent revisions and reminder preferences. Tests distinguish prepared exports from explicitly confirmed saved files and reject confirmation of an incorrect export identity. Real migration tests cover Dexie versions 1, 3 and 4 into version 5.

The full browser backup journey creates a fifteenth room in a family home, adds an object-bound seven-day task, uploads four image attachments, resizes a 3,000 × 1,800 image to 1,600 × 960 JPEG, completes three required tasks and partially redeems the reward. It checks all ZIP file hashes, refuses a tampered photo without altering the household, offers a current-data export before replacement, resets only the isolated test database, and restores all records/assets. Complete canonical state equality verifies 15 rooms, 393 tasks, history, 30 DA, 17.65 EUR, wishlist, achievements, recurrence, settings and partial Mega progress. Repeating restoration issues no duplicate rewards. Export, validation and restoration also run with network access disabled in both engines.

Another browser journey confirms reminders disappear during focus mode, postponement survives reload without changing the content revision, and frequency preferences persist. Axe A/AA passes for the backup profile and restore preview. A failed-restore React test verifies the error is accessible inside the still-open preview. Screenshot review covered the backup card and restore preview. The local in-app browser accepted the application update and displayed the new backup section while retaining the existing 14-room household and its 30-minute/gentle preferences. `npm audit --audit-level=moderate` reports zero vulnerabilities after updating fflate and Vitest.

Build output contains nonblocking Rollup annotations warnings from upstream Zod comments; generated application bundles and PWA files are valid.

## Earlier failures fixed

The first type-check uncovered overly recursive Dexie subclass inference; a factory now creates a typed Dexie instance. Initial test-fixture failures were corrected (fixed clock, equal-priority room rotation, reopening an explicitly closed DB and unambiguous selectors). Browser tests identified label wrappers around segmented controls and select options; fields now have explicit label associations and segment groups use fieldsets. Initial service-worker activation now claims clients, fixing offline launch of already-open pages. Light-mode testing identified reading DOM values inside an asynchronous command; appearance/haptics values are now captured before the IndexedDB transaction begins.

## Visual-household milestone fixes

The new room browser test initially matched background Profile save buttons; it now targets the open dialog. A visual review led to a scrollable instructions/diagram region with completion controls outside it. A subsequent accessibility test caught a temporary contrast drop while button backgrounds animated during a theme change. Button backgrounds now switch immediately, retaining only the restrained press movement. The final full mobile suite passes in both engines.

## Backup milestone fixes

The first checks exposed cross-realm typed-array assertions, object/row ordering in round-trip comparisons and DOMException cancellation detection; these were corrected with canonical comparison and a name-based cancellation check. The first full browser run passed 16/18 tests; two new reminder tests referenced the post-completion pause button before completing a task. The selector now uses the existing **Skončiť** action. The final full run passes 18/18. Prepared-export closure now returns focus to its trigger, and the preview distinguishes attachment counts from deduplicated ZIP photo files.

## Manual iPhone acceptance checklist

Use a production HTTPS build after deployment approval, or a trusted HTTPS local test host.

- [ ] Safari → Share → Add to Home Screen installs the correct name and icon.
- [ ] Standalone launch fits the notch and home indicator, including open dialogs and bottom navigation.
- [ ] Force-close/reopen retains household, task completion, DA and wallet data.
- [ ] After the offline-ready message, airplane mode permits relaunch, completion and later online return.
- [ ] Publish a newer approved version, confirm the update prompt, accept while no save is pending, and verify local data remains intact.
- [ ] In Safari and installed-PWA mode, prepare a ZIP, cancel native sharing and check it does not confirm a saved file.
- [ ] Save via Files/iCloud Drive and via the download fallback; locate the actual ZIP before confirming its saved status.
- [ ] Import with preview, reject a malformed ZIP and one missing a photo, and restore a separate test installation including photos/DA/wallet.
- [ ] Check storage estimate/persistence availability and denied access; app status must not claim a grant when unavailable.
- [ ] VoiceOver, large text, reduced motion and light/system appearance remain usable.
- [ ] Background/foreground a washer cycle and check the next step; no closed-app alarm is promised.
- [ ] Drag objects with a finger in the room editor, scroll outside the canvas, save/cancel and confirm positions after relaunch.

## Deployment status

Published with explicit user approval on 2026-10-09 at https://patus112.github.io/cleanquest/ from commit `0f3111f`. Repository: `patus112/cleanquest`, Pages source: GitHub Actions, HTTPS enforced, `VITE_BASE_PATH=/cleanquest/`. The [successful remote workflow](https://github.com/patus112/cleanquest/actions/runs/37917411857) passed typecheck, lint, 159 tests, build/PWA validation, 24 mobile tests and deployment.

The first remote attempt passed 22 mobile tests but failed the prepared-home assertion in both engines at its five-second polling deadline. Failure snapshots showed the successfully created dashboard. The assertion now allows 20 seconds for the larger transactional initialization while still checking page errors, configured records, DA, completion and reload persistence. All four targeted local scenarios and the complete subsequent remote suite passed.

After publication, two additional isolated mobile Chromium/WebKit tests ran `e2e/release.spec.ts` against the real HTTPS address using a temporary ignored config: **2/2 passed**. They verified a saved completion and 10 DA, five hash routes with online/offline refresh, exact service-worker scope, manifest/icons and reopening with preserved data. Disposable Playwright contexts were separate from the user's browser profile. An independent HTTP check confirmed the page, seven linked HTML assets, manifest, icons and service worker returned 200 with the expected `/cleanquest/` paths. The application was also opened in the in-app browser without creating or replacing a household.

`CLEANQUEST_DEPLOY_APPROVED=false` was restored after the first release. The live site remains published; another deployment requires approval. Physical iPhone installation, native backup sharing, local-home migration and storage acceptance remain on the manual checklist above.
