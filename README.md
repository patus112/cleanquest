# CleanQuest

A local-first, Slovak household cleaning PWA. Small concrete tasks, stable plans, and an optional virtual personal reward budget. User-facing points are **DA ⚡** (the domain uses `xp` as its storage field).

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/cleanquest/`. The empty installation opens a four-step onboarding wizard. Choose a custom home and explicitly select furniture, or the editable two-floor family home. The 14 m² glazing note does not imply a panel count; add each panel or an explicit quantity yourself.

```sh
npm run check                 # typecheck, lint, 159 tests, build + asset/PWA validation
npx playwright install chromium webkit
npm run e2e                   # 24 mobile Chromium/WebKit journeys, static test host :4174
npm run preview               # http://localhost:4173/cleanquest/
```

PWA behavior is enabled in the production build. The development server does not install a service worker. Production output is `dist/`.

For temporary Wi-Fi testing, use `npm run dev -- --host 0.0.0.0` and open the computer's LAN address with port 5173 and `/cleanquest/` on the phone. Household creation and task recording support HTTP LAN access through a cryptographically random UUID fallback. PWA service workers and ZIP checksum operations require a secure context (HTTPS or loopback); LAN HTTP testing does not verify those features. The iPhone guide describes the HTTPS release checks.

First test release: [readiness audit](docs/RELEASE_READINESS.md), [exact GitHub Pages setup](docs/RELEASE.md), [iPhone installation and backup precautions](docs/IPHONE_TESTING.md). The 2026-10-09 checks passed. The approved public repository [patus112/cleanquest](https://github.com/patus112/cleanquest) is created and connected as `origin`; its base path is configured and deployment remains disabled. No source code has been pushed or deployed.

## Included functionality

- Five Slovak sections: Domov, Úlohy, Odmeny, Nápady, Profil.
- Responsive dark/light/system appearance, restrained champagne headings/icons, green progress, safe areas, reduced motion, keyboard focus, native modal dialogs.
- Short onboarding, household preferences, floors, room categories/materials/zones/photos, room duplication and reordering, explicit object/appliance inventory.
- Room area and dimensions, mixed floor surfaces with optional areas, total window area, curtains/blinds, object dimensions/areas/photos and editable schematic positions. Drag objects with a finger or mouse, nudge with accessible arrow controls, save or cancel a layout draft, and move objects between rooms together with their linked tasks and problems. Configured flooring/textiles add appropriate objects and small tasks without inventing window panels.
- Offline SVG room illustrations, floor-by-floor household map, and room/object highlighting in focus mode and task location dialogs. Green identifies the room; muted red marks the saved task object, with text labels.
- 224 unique templates for small tasks; only configured safe objects produce tasks. Individual panels get independent glass, frame and track tasks.
- Unlimited custom task CRUD, object association, pause, duplicate and splitting. Normal tasks require 1–10 minutes; explicit exceptions are supported.
- Date-only day/week/month/year/custom-interval recurrence, completion/calendar strategies, anchored month-end handling, stored household timezone.
- Stable Monday–Sunday plans, hygiene/overdue priority, bounded duration, room rotation, energy settings and planned rest. One-task focus, skipping, postponing, replacement, history and undo.
- DA, levels, achievements, rest-aware streaks. Eligible manual completions are bounded by the daily budget. Occurrence IDs and same-day task guards prevent duplicate points.
- At most two extras, each at most five minutes and ten minutes total; no DA, achievements, money or weekly progress.
- Main virtual reward up to €20 for all required occurrences, independent optional bonus up to €5 and 100 DA. Source-ledger reconciliation makes repeated actions idempotent; undo appends corrective entries, including after partial redemption.
- Virtual wallet, carry-forward balance, wishlist, partial redemption and ledger history.
- Household problem capture, editable deterministic solution rules, statuses, photos, solved history. Select one problem as a monthly 3–7-step project for 500 DA, including undo, budget, materials and before/after photos.
- Washer cycle follow-ups created only after actual completion, only one per completion, with dryer routing only for configured safe dryers. Pending follow-ups appear in Pranie and an in-app notice when due.
- Dexie IndexedDB tables, repository interface, household relationship validation and transactions. Schema versions 1–5 and migration tests.
- Complete ZIP backups with separate binary photos, versioned manifests and SHA-256 checksums; staged validation, preview, explicit confirmation, atomic restore and read-back verification. Recovery import is available before onboarding. Native file sharing where supported, download fallback, confirmed-save tracking, discreet backup reminders and browser storage estimates/persistence requests.
- Installable PWA, original 192/512/maskable/Apple icons, precached shell, explicit update prompt, cleanup of old caches, hash navigation.

## Room setup and visual guidance

Open Úlohy → Miestnosti, choose a room and use Rozloha, okná a povrchy. Add individual furniture, fixtures and window panels under Predmety a spotrebiče. Each object can have independent task durations and recurrence; frequencies appear beside tasks. Poloha v náhľade places an object in one of nine approximate room regions. Photos may be attached to rooms and objects.

The household map is a schematic grouped by floor, not an inferred architectural plan. Room scenes show only configured objects, with an automatic arrangement unless an explicit position is saved. Open a room and select **Presúvať predmety** to edit its layout. Dragging and arrow controls change a draft until **Uložiť rozloženie**; **Zrušiť** discards it. The arrows beside each inventory item move it to another room. Dimensions influence the approximate room proportions; furniture drawings are symbolic and not to scale. A total glass area never implies a panel count. Measured room adjacency and furniture footprints remain future work. Removing a configured textile pauses its library tasks while preserving already-agreed weekly obligations.

## Plan semantics

Weekly task titles, durations, occurrence identities, rest days and reward values are snapshotted. Editing, pausing or deleting library records does not remove agreed occurrences. Replacement is an explicit equivalent small task using the same required occurrence identity.

New tasks and preference changes affect the next ungenerated week. New due tasks may be completed directly from the library within the rewarded daily time limit. Today's time selector limits a short focus block without silently changing the agreed weekly plan. A five-minute block can be one three-minute task; remaining tasks can wait for another block or a larger selection. Each recurring action can be recorded once per household day. Previous weeks are retained as history; their unfinished snapshots do not flood today's plan. Due underlying tasks are spread into the new week within its budget. A missed week's full reward is not granted automatically.

Skipping or postponing does not count as completion. The weekly reward requires all agreed occurrences. Empty weeks never earn a main reward. A bonus remains independent. Extra tasks cannot pre-complete tasks reserved for the week. Undo recalculates points and grants; if already-redeemed money exceeds revised earnings the wallet shows a negative balance, blocking further redemption until it recovers.

## Backup and local data

Open **Profil → Zálohovanie a obnova**. **Exportovať zálohu** prepares `cleanquest-backup-YYYY-MM-DD-HHMM.zip`, including every household table, preferences and raster attachments in `photos/`. Choose native **Zdieľať / uložiť súbor** where available, or **Stiahnuť ZIP**. Only select **Zálohu mám bezpečne uloženú** after actually saving the file. Preparation and delivery attempts alone never mark it as a confirmed backup or claim iCloud storage.

Imports verify ZIP structure, format/schema versions, manifest/file SHA-256 checksums, required fields, household relationships, duplicate identities and integer cents. A preview offers export of the current household before explicit replacement. Restoration writes records and photos and verifies them inside one IndexedDB transaction; a failed write, quota error or verification abort retains the old data. Legacy JSON backup versions 1 and 2 remain importable, with an explicit notice that checksums are unavailable.

Database version 5 moves existing raster data URLs to binary records. New photos are optimized to JPEG with a maximum 1,600-pixel long edge; input PNG/JPEG/WebP files may be up to 20 MB, with a 60-million-pixel safety bound. Backup limits are 40 MB compressed/expanded, 1,000 unique photos, 2 MB per photo, and 30 MB for the validated logical household including display photo URLs. Identical attachments share one ZIP asset while all room/object/problem/project references survive. See [backup format and recovery details](docs/BACKUPS.md).

Reminders default to seven days when data changed since the last confirmed backup; choose 3, 7, 14, 30 days or none. Dismissal/postponement persists locally and never interrupts focus mode. Browser storage persistence is requested where supported; a grant is not assumed. Estimates include the origin's offline cache and data. Service worker updates clean application caches, never IndexedDB.

Data stays on this browser/origin. Another phone has its own home. Clearing browser data or losing a device requires a previously saved backup. There is no automatic cloud backup or cross-device synchronization. Native sharing and installed-PWA behavior still require manual checks on a physical iPhone.

## GitHub Pages preparation — approval required

No remote repository was created, no code was pushed and no deployment was performed.

The workflow `.github/workflows/pages.yml` checks, tests and builds on pushes to `main` or a manual run. **Deployment is disabled until the repository variable `CLEANQUEST_DEPLOY_APPROVED=true` is explicitly configured after user approval.** A required reviewer on the `github-pages` environment is also recommended for ongoing approval control.

After approval:

1. Create/select the intended repository and push this source, including `package-lock.json`.
2. Set Settings → Pages → Source to GitHub Actions.
3. Keep `VITE_BASE_PATH=/cleanquest/` for `USERNAME.github.io/cleanquest/`. For a different repository set the repository variable `VITE_BASE_PATH` to `/<repository>/`.
4. For a custom domain or a user/organization root site, set `VITE_BASE_PATH=/`, configure the domain and DNS yourself, and use HTTPS.
5. Set the approval variable and run the workflow. It publishes only this repository's `dist/`. Leaving the variable enabled also permits subsequent automatic deployments on pushes to `main`; use environment approval or disable it between separately approved releases.

Follow [RELEASE.md](docs/RELEASE.md) for the exact settings, approval boundary, safe transfer of the existing local household, and post-deployment checks. Install from Safari using [IPHONE_TESTING.md](docs/IPHONE_TESTING.md).

The manifest start URL/scope, Vite assets and service worker all share the configured base. Hash routes survive static-host refreshes. Changing origin/domain does not migrate local data automatically: export before changing and import on the new origin.

Reference: [Vite GitHub Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages), [Vite PWA prompt updates](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html), [Dexie transactions](<https://dexie.org/docs/Dexie/Dexie.transaction()>).

## Known limitations and manual checks

- Playwright WebKit provides engine testing; a physical iPhone Home Screen installation, safe areas in standalone mode, OS storage eviction and app update acceptance still need manual testing. See `docs/QA.md`.
- Laundry notices run while the app is open. There are no background push notifications or guaranteed OS alarms.
- Special cleaning needs are stored and editable notes; the MVP does not infer allergies/material chemistry from free text. Select safe inventories, supplies and instructions yourself.
- Monetary settings intentionally cannot exceed €20 + €5 per week. The wallet is a personal tracking ledger, with no payments or purchases.
- A monthly project is created by selecting a captured problem. There is no paid AI or automatic technical repair advice.
- Photos are stored as binary IndexedDB records and included separately in ZIP backups. There is no cloud media storage. Very large local histories may eventually need repository writes optimized to per-record updates; the current implementation transactionally rewrites this one household's records.
- Editing household dates/settings is supported, but the app does not protect against intentional developer-tools manipulation of local storage.
- Floor names, additions and deletion are supported. Deleting a floor moves its rooms to the first remaining floor after confirmation. Removing a room asks for confirmation and preserves required snapshots and history.
