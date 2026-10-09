# Local data safety and recovery

CleanQuest has one independent household per browser installation. IndexedDB is authoritative; React state is a mirror, and the service worker only caches the application shell. No backend, automatic cloud backup, authentication or synchronization is used.

## Saving a backup

In **Profil → Zálohovanie a obnova**, select **Exportovať zálohu**, then a native share/save destination or **Stiahnuť ZIP**. The prepared file includes every table below and all photo attachments. Only confirm **Zálohu mám bezpečne uloženú** after locating the saved file. The app records your explicit confirmation; it cannot verify a Files/iCloud destination or detect subsequent deletion of that file. Cancelling native sharing does not enable saved confirmation. A failed share can fall back to a download.

Preparation captures a consistent household/revision snapshot. If data changes while the file is being prepared or before confirmation, confirming that file retains the older snapshot revision and the UI reports remaining changes. The file contains the safety history that existed when captured; it cannot include a confirmation given after that same file was created.

## ZIP format

Filename: `cleanquest-backup-YYYY-MM-DD-HHMM.zip`, using the exporting device's local date/time.

| Entry | Contents |
| --- | --- |
| `manifest.json` | `format: cleanquest-zip`, format version 1, data schema 2, database version 5, application version, UTC creation time, household ID, current revision, counts, photo descriptors, checksums and manifest hash |
| `data.json` | `format: cleanquest-data`, schema 2, all household tables, reminder preference and safety metadata |
| `photos/0001.jpg` etc. | PNG/JPEG/WebP raster bytes; numbered filenames, no executable content or filesystem paths |

Household tables: profiles, households, floors, rooms, objects, tasks, completions, dailyPlans, weeks, bonuses, megas, problems, rewards, achievements, wishes and settings. DA/levels and wallet balance are derived from their preserved ledgers and flags, with integer cents unchanged. Template definitions ship with the application; every instantiated task carries its title/instructions/recurrence and is exported.

All room/object/problem/Mega before/after references are included. Identical raster bytes and MIME types share one ZIP file; attachment references remain separate. The manifest photo count measures unique files; the restore preview reports actual attached references.

Every data/photo file has a SHA-256 checksum. The manifest hash covers the JSON serialization of the normalized manifest fields excluding that hash itself. Checksums detect integrity errors; they are not a cryptographic signature or encryption. The archive remains readable by the person holding it.

Supported import paths are dispatched explicitly by format/version. Legacy `cleanquest` JSON envelopes 1 and 2 are validated and converted to the current model; they display that checksums are unavailable. Unsupported future versions fail clearly. Database migration versions and backup format versions are independent.

## Limits and photos

- Upload PNG/JPEG/WebP files up to 20 MB and 60 million pixels. A decoded image is resized to a maximum 1,600-pixel long edge and encoded as JPEG, lowering quality if required to fit storage. Existing legacy photos retain their original raster bytes during migration.
- Binary IndexedDB assets use `Uint8Array`, MIME and stable attachment ID. Domain/UI display URLs are hydrated from those records; important photos are not kept exclusively in component state.
- ZIP files and declared expansion are bounded to 40 MB, data payload to 30 MB, manifest to 500 kB, each photo to 2 MB, and unique photo count to 1,000. Logical hydrated household validation is also bounded to 30 MB. Extremely large households must reduce attachments before export; the exporter never silently excludes photos.
- Only the two required JSON entries and numbered photo paths are accepted. Duplicate paths, unexpected paths, duplicate records, malformed JSON/ZIP, missing assets, incorrect MIME/signatures, invalid ownership and mismatched checksums are rejected before replacement.

## Restoration and failure behavior

1. Parse and verify the complete archive in memory, without changing the active database.
2. Preview household, room/task/history counts, photo attachments, DA, balance and date.
3. Offer an export of current data, then require **Potvrdiť nahradenie**.
4. Validate the staged model and write all records/photos inside one Dexie read/write transaction.
5. Read back and compare canonical record/attachment contents before commit.
6. Publish the verified committed household or show an error. Exceptions, interrupted writes, quota failures and verification failures abort the transaction, retaining prior records, assets, DA, money and safety metadata.

Opening, validating, cancelling or rejecting an import never deletes current data. Empty installations expose the same import/preview workflow before onboarding. Re-importing an archive replaces records; it does not replay completion commands or issue duplicate grants. Current-date scheduling can add a new day's plan after a successful restore if the archive is old, preserving historical snapshots and ledgers.

## Revision, reminders and storage

A successful content-changing command advances the persisted revision atomically with household data. Unchanged reloads, export preparation, confirmation and snoozing do not change that content revision. A preference change does. Default reminders appear after seven days only when data differs from the last explicitly confirmed saved snapshot; choose 3/7/14/30 days or disable them. A dismissal snoozes one day, **O týždeň** snoozes seven. The reminder never appears over focus mode or another dialog.

`navigator.storage.persist()` is requested where supported, with explicit granted/denied/unavailable status. `estimate()` is optional; its origin-level usage includes the offline cache. A measured usage of at least 85% triggers a discreet warning. Quota errors retain previously committed records and suggest exporting a backup. Service worker updates remove obsolete application caches and never delete or reset IndexedDB.

## Verification boundary

Automated integration tests use fake IndexedDB for migration/rollback/error cases. Production browser journeys use actual Chromium/WebKit IndexedDB and offline caching, a 15-room household with 393 tasks and four photo attachments, resizing, full ZIP checksum checks, rejection of a corrupted photo, optional export before replacement, reset/restore, recurrence/history/DA/wallet equality and repeated restoration.

Desktop WebKit with an iPhone viewport is not a physical iPhone. Native Files/iCloud sharing, installed Safari PWA storage policies, force-close recovery, OS eviction and standalone safe areas remain physical-device checks in QA.md. No push or deployment has occurred.
