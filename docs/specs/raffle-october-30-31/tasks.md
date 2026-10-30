# October 30–31 Raffle Tasks

## Phase 1 - Analysis

- [x] Inspect current raffle routes, seed tooling, schema, and original migration.
- [x] Reconcile the stale migration-repair premise against current `origin/codex/develop`.
- [x] Identify the independent registration-close and draw-time boundaries.

## Phase 2 - Resolution

- [x] Record two independent slugs, titles, tablet entrances, and keys.
- [x] Resolve midnight instants in America/New_York.
- [x] Mark prize data as temporary instead of inventing final prizes.
- [x] Exclude the legacy repair migration from this feature.

## Phase 3 - Plan

- [x] Define the minimal allowlisted route and configuration surfaces.
- [x] Define RED tests for both paths, cross-event isolation, invalid days, and timezone config.
- [x] Preserve existing `/rifa` with a regression test.

## Phase 4 - Implementation

- [x] Add failing route/config/visibility tests. RED: missing page/config modules plus four visibility assertions failed.
- [x] Implement the allowlisted event map and dynamic tablet route.
- [x] Add the two temporary DEV seed configs.
- [x] Extend exact raffle floating-chrome suppression to both new entrances.

## Phase 5 - Validation

- [x] Run focused tests: 3 files and 41 tests passed after the expected RED failures.
- [x] Run the relevant suite and static checks: independent relevant suite 18 files/163 tests passed; TypeScript passed after Prisma generation; full lint passed with 112 existing warnings and zero errors. A broader local run passed 198 assertions but reported two unavailable Prisma-client suites before generation; it was not used as passing evidence.
- [x] Run independent verification for the high-risk data and shared-route surfaces: READY for S2–S6 code, with S3 and live keys explicitly pending T4.
- [x] Commit the reviewable work unit: `117a689b` (`feat(raffle): prepare October event entrances`). Native assessment: high after explicit Risk item 1 escalation, independent verifier required and completed; native review not due because the 229-line candidate is under budget.
- [x] Preflight exact DEV environment and migration/schema state. Vercel CLI could not pull the encrypted branch `DATABASE_URL`; the established local DEV binding was instead identified by its sanitized fingerprint, known Latino Night data, and complete 3-table/27-column/6-index/3-FK raffle schema. Both target slugs were absent. No migration was run.
- [x] Seed and verify both independent DEV events without exposing keys. Both events were created in one transaction with zero entries, one temporary open draw each, distinct token hashes, and exact midnight instants. Raw keys were captured directly to separate macOS Keychain items and independently hash-verified.
- [x] Publish the committed route work to `codex/develop`, verify `/rifa/30` and `/rifa/31`, and record residual final-prize work. Contract PR #683 and behavior PR #684 merged with green checks; post-merge CI and CodeQL passed on `1c952535`. Deployment `dpl_8F73iNoUo3CPRMviE9MNqUtjWncr` is Ready and aliases `dev.palladiumlatin.art`.

## Phase 6 - Rehearsal Amendments

- [x] Reproduce the placeholder-video defect on the day-30 iPad rehearsal and restore the event to its official empty/open state.
- [x] Add a RED config assertion for explicit empty `videoUrl`, preserve omitted-video behavior, update both repeatable configs, and set both DEV events to the existing no-video animation. Focused result: 3 files/41 tests passed after the expected two RED assertions.
- [x] Resolve the winner attendance contract: `Showed up` confirms the pending winner; `Draw again` audits the no-show, excludes them event-wide, and reruns the same prize.
- [x] Add RED domain, route, screen-state, and tablet tests for pending confirmation, refresh recovery, idempotent exact-attempt actions, no-show audit retention, and event-wide exclusion. RED: missing attendance domain; GREEN: focused attendance/draw/UI set passed 8 files/90 tests after correction.
- [x] Add the `RaffleDrawAttempt` model and additive migration, guarded attendance domain/route, and draw integration. The new migration was applied surgically to DEV and marked through Prisma without replaying the historical raffle migration.
- [x] Add refresh-safe `Showed up` / `Draw again` tablet controls and replay the animation for a reroll.
- [x] Run focused checks, relevant suite, typecheck, lint, differential checks for omitted/explicit video config, and independent high-risk verification. Relevant raffle suite passed 17 files/181 tests; TypeScript passed; full lint had zero errors and 114 warnings, followed by clean focused ESLint. Independent verification found legacy replay and pending-winner exclusion regressions; both were corrected and pinned with focused tests. Prisma validate passed with the DEV environment.
- [x] Deploy to DEV, rehearse both days visibly, and restore exact official state. Day 30 and day 31 each proved audited no-show/confirmation behavior; the final S12 contract intentionally restores clean draws to `draft` rather than `open`.

## Phase 8 - October 31 Waiting/Ready Background Video

- [x] Document the approved October 31-only waiting/ready background, preserving all other phases and events.
- [x] Add the supplied MP4 without modifying the source; render a muted inline autoplay loop behind the dark readability overlay.
- [x] Observe focused RED (3 expected failures, 31 passing), then GREEN (34 passing) across branding and screen tests.
- [x] Verify the relevant raffle suite (101 passing across 8 files), shared-screen differential behavior (12 October 30/other-event phase renders byte-identical to HEAD), typecheck (exit 0), and scoped lint (exit 0; one pre-existing unused-argument warning). `git diff --check` passed. The copied MP4 SHA-256 matches the original.
- [x] Resolve the publication decision: the user authorized DEV publication (“Dale, mételo entonces”) to enable a real-tablet check after publication; no additional feature work or production change was requested.
- [x] Normalize the review candidate as `3da3ba85`, based on current `codex/develop` (`b2fd0dc0`). Native assessment succeeded for the committed 96-line change: native medium, explicit shared-render Risk item 3, review not due because under budget. The independent verifier remained unavailable; the user authorized DEV publication after disclosure, and no independent verdict is claimed.
- [x] Publish through PR #759, merged to `codex/develop` as `cd91992275c31a518d080873fdee7a5a4268886a`. All PR and merge CI/CodeQL checks passed. The automatic Vercel preview `pli-saas-o00pbcgqs-heepnites-projects.vercel.app` is Ready and aliased to `dev.palladiumlatin.art`.
- [x] Verify both live tablet entrances return 200 and the matching access page. The live MP4 returns 200 `video/mp4`, 29,318,557 bytes, and SHA-256 `c0cb14b1ee60fb0527fe37631524a7b68a4f541145bfaf40d1ee3f5f47752054` (identical to the supplied original); a 1024-byte range returns 206 with the exact content range. No authentication, raffle state, or production mutations were performed.
- Real-device autoplay, playback smoothness, and visual legibility remain for the owner's tablet inspection. The video appears only in waiting/ready, not in prize setup. These public delivery checks are not browser-playback proof.

### Supplied video replacement

- User requested “hay que cambiar el video a este” and supplied the updated `TAPVILLE_HALLOWEEN_TABLET_1920x1080.mp4` at the same source path. Replace only the served media; retain waiting/ready-only behavior and DEV-only delivery.
- The new source is H.264, 1920×1080, 30 fps, 32 seconds, no audio, 38,971,176 bytes; SHA-256 `6f522fae73fd8d62784ebebd4c8e34d4c8abdaab5a145fd4fae9a6d0bbd79748`. Pre-replacement byte comparison failed as expected (exit 1); after copying, equality passed (exit 0). Delivered through PR #760, merged as `1ef49b6c88b6f3046f25fb85ff918f93c6ddb6c8`. PR and merge CI/CodeQL passed. Preview `pli-saas-6yq1j7a12-heepnites-projects.vercel.app` is Ready and assigned to `dev.palladiumlatin.art`. Live checks passed: both tablet entrances return 200 with the correct access page; updated media returns 200 `video/mp4`, exactly 38,971,176 bytes and the new source SHA-256; range `0-1023` returns 206 with exactly 1024 bytes and the new total size. No production, authentication, or raffle-state mutations. Actual tablet playback/visual legibility remains unverified.

## Phase 9 - October 30 Waiting/Ready Background Video

- [x] User supplied `INKA_HALLOWEEN_TABLET_1920x1080.mp4` for October 30. Keep the October 31 background and the existing dark/gold draw animation; only the October 30 waiting/ready tablet uses `/raffle/inka-halloween-background.mp4`. No Excel, raffle-state, production, or public-page changes.
- [x] Amend requirement 20 and the resolved design before implementation. Branding and container tests observed RED: four October 30 waiting/ready failures (32 passing); after implementation and one ready-phase test timing correction, focused GREEN: 2 files/36 tests. Existing public/generic, day-31, non-waiting/ready, and setup assertions remain covered.
- [x] Copy the user-supplied MP4 without changing the original. Source and served copy share SHA-256 `e2a1b049cc38327b160a2a21102113da1e91f85b608d282be11b43b041723b3b` (27,110,094 bytes). The day-31 served MP4 retains SHA-256 `6f522fae73fd8d62784ebebd4c8e34d4c8abdaab5a145fd4fae9a6d0bbd79748`.
- [x] Verify the relevant screen suite: 9 files/122 tests passed; scoped ESLint exited 0 with one existing unused-argument warning; `git diff --check` passed. Initial typecheck failed on stale local Prisma-client properties in unrelated payment modules; the parent regenerated only the local client from the unchanged repository schema, then typecheck passed (exit 0). No database access or migrations occurred. Twelve day-31/generic phase renders are byte-identical to the base implementation (differential passed, no stderr, exit 0).
- [x] Independent verification passed for source commit `1f43d6ee`: 36 focused tests, 98 component-suite tests, and 8 independent/differential tests; 52 unaffected renders preserved, typecheck/lint passed, both media hashes correct, October 31 byte-identical to base. Actual tablet playback and visual legibility are not claimed.
- [x] Publish through PR #761, merged into `codex/develop` as `ad81c3c88987b362e30fb9324d66713464b25cd2`. All PR and merge CI/CodeQL checks passed. Automatic preview `pli-saas-elkjd0033-heepnites-projects.vercel.app` is Ready and assigned to `dev.palladiumlatin.art`.
- [x] Live verification passed: both `/rifa/30` and `/rifa/31` return 200 with the matching access page. Inka returns 200 `video/mp4`, 27,110,094 bytes and SHA-256 `e2a1b049cc38327b160a2a21102113da1e91f85b608d282be11b43b041723b3b`; Tapville remains 38,971,176 bytes and SHA-256 `6f522fae73fd8d62784ebebd4c8e34d4c8abdaab5a145fd4fae9a6d0bbd79748`. Both 1024-byte range checks return 206 with exact total sizes. No authentication, raffle-state, or production mutations. Real-device playback remains the owner's tablet inspection.

## Phase 10 - Lighter Video Overlay

- [x] User accepted a 40% black overlay on both October tablet videos instead of the existing 70%; preserve the static backdrop and all event/phase behavior.
- [x] Observe RED: branding waiting/ready tests fail on the missing `bg-black/40` class (2 failed, 11 passed).
- [x] Replace only the decorative video shade class. GREEN: 13 branding tests and 122 relevant tests pass; typecheck, scoped lint, and diff check exit 0. Differential rendering preserves 14 unaffected surfaces and changes only the requested opacity class in the four October waiting/ready cases.
- [x] Publish through PR #762, merged into `codex/develop` as `b9d35b200a8d6d69f5f67ec910f89ae9a50e63db`. All PR and merge CI/CodeQL checks passed; reporting-only lint emitted existing unused-symbol warnings. Preview `pli-saas-32kzi5bne-heepnites-projects.vercel.app` is Ready and assigned to `dev.palladiumlatin.art`.
- [x] Verify both tablet access pages return 200 with the matching title/password form; the private screen remains 404 without authentication. Seven publicly available client chunks did not expose the shade component, so no deployed-DOM or real-tablet visual proof is claimed. The 40% class is verified in source/component tests; visual inspection remains for the owner after reloading the tablet. No authentication, raffle-state, media, or production changes.

## Phase 7 - Tablet Prize Authoring

- [x] Resolve the product contract: prizes are authored independently on each tablet before live drawing, and an explicit `Start raffle` action permanently locks the list.
- [x] Add RED domain and API tests for add/edit/remove/reorder persistence, revision conflicts, start locking, malformed input, authorization, and unchanged registrations/schedules on rejection. RED: missing domain/route; GREEN: 2 files/18 tests.
- [x] Implement all-draft `RaffleDraw` replacement and atomic draft-to-open start without another migration. Delivered through PRs #701 and #705.
- [x] Add RED screen-state, reducer, and tablet tests for refresh-safe editing, ordering controls, explicit start confirmation, post-start lock, and existing live-screen behavior. Expected RED failures were observed for setup payload, setup phase, editor wiring, polling preservation, and ordered server progression.
- [x] Implement the tablet prize editor and setup phase, then run focused checks, the relevant suite, TypeScript, lint, and independent high-risk verification. Delivered through PRs #706 and #708. Relevant raffle suite passed 19 files/199 tests; TypeScript and focused ESLint passed. Independent verification found polling overwrite and missing ordered progression; both were corrected and independently validated.
- [x] Convert both clean October DEV placeholder draws to `draft`, deploy through reviewable PR slices, author multiple prizes visibly, start, draw in order, and restore exact official state. Day 31 visibly persisted three ordered prizes and completed one audited `no_show` plus three `confirmed` attempts across all three prizes. Guarded cleanup restored both events to one clean editable draft at the official schedule; independent verification returned READY.

## Operational Evidence

- DEV database fingerprint: `f50dcba1162d9a0efe1624c4a6d147e1dd326f1d7cf57f46704d3e43ed5d8aee` (sanitized; no connection details stored).
- Existing DEV identity signal: Latino Night present with 22 entries and 5 draws at preflight.
- October 30 event: `2026-10-30T04:00:00.000Z`, draw `2026-10-31T04:00:00.000Z`, zero entries, one open temporary draw.
- October 31 event: `2026-10-31T04:00:00.000Z`, draw `2026-11-01T04:00:00.000Z`, zero entries, one open temporary draw.
- Keychain services: `pli-dev-raffle-october-30-2026` and `pli-dev-raffle-october-31-2026`; both readable, distinct, and matched the stored hashes without exposing raw values.
- Live generic routes: both `/raffle/<slug>` pages returned 200 with the exact title and entry form; both unauthenticated screen-state requests returned 404.
- Live tablet entrances: `/rifa/30` and `/rifa/31` each returned 200 with the correct title and password form. Each Keychain token completed the existing exchange, issued only its slug-scoped Secure cookie, reached the clean staff screen, and loaded screen-state 200 with zero entries, one open draw, and the exact midnight instant.
- Isolation: the October 30 token against the October 31 exchange returned 404. Raw keys were not printed, committed, or stored in evidence.
- Delivery: issue #682 is approved; PR #683 (265 lines) and PR #684 (262 lines) passed size, tests, typecheck, lint, secret scan, CodeQL, and Vercel checks and merged to `codex/develop`. Post-merge CI also passed.
- Residual product input: final prize names remain unknown, but the accepted tablet authoring workflow will let the operator add and order them before each raffle starts.
- Day-30 rehearsal: QR registration, live entry count, countdown, draw, and winner reveal succeeded with four authorized synthetic entries. The yellow placeholder MP4 was rejected; cleanup restored zero entries, the official schedule, open status, and no winner.
- Animation correction: both repeatable configs and both DEV rows now use explicit empty `videoUrl`, selecting the existing dark/gold `Sorteando` animation. Omitted-video behavior remains unchanged by differential check.
- Attendance schema: additive `RaffleDrawAttempt` table is present in DEV with six columns, two foreign keys, three indexes, zero rows, and a finished Prisma ledger entry. The historical raffle migration was not replayed.
- Prize authoring delivery: PRs #699, #701, #705, #706, and #708 passed CI and merged to `codex/develop`; DEV deployment `pli-saas-hkte69939-heepnites-projects.vercel.app` is explicitly aliased to `dev.palladiumlatin.art` and both tablet routes return 200.
- Deployment incident: an accidental Vercel project was removed with explicit authorization; an unintended production deployment was no longer active when rollback was attempted, and production remained on its prior deployment. DEV deployment now requires a preview with complete `codex/develop` Git metadata before aliasing.
- Final independent verification: both October events are distinct, have zero entries/attempts, one `draft` placeholder, no winner/timestamps, exact official schedules, explicit empty `videoUrl`, and eligible tablet setup state.

## Phase 11 - Tablet Video Fit And October QR Correction

- User correction: “Estoy viendo lo que hiciste. ¿Por qué me agrandaste toda la pantalla? Sí, necesito que le saltes el overlay negro ese que tiene, pero que no me agrandes la pantalla. O sea que no me agrandes el background. El background tiene que coincidir con la app.”
- User clarification: “El video no estaba así. Se veía bien, sí, estaba armado. El video está armado para que entre dentro del iPad. No está pensado para aumentarle el tamaño así que no le aumentes el tamaño. Volviendo a lo del QR code, tiene que ser un poquito más grande y quiero que le saques la URL de abajo que dice: thepalladium.art # octubre 30 # 2026. Eso sacácelo.”
- Sequence: “Primero veamos de implementar los ajustes antes de borrar cualquier cosa o antes de volver a lo que sea, porque quiero ver cómo queda y de ahí reseteamos todo. No pasa nada si perdemos esta información de los premios y todo eso porque son todos de prueba así que no hay ningún problema con eso.”
- [x] Pin shade removal and full-frame fit assertions on both waiting/ready videos, plus 160→192 QR and hidden URL text on both October waiting/ready and setup. Focused RED: 3 files, 7 failed and 28 passed; shade and QR size failures were observed, while shade assertion order masked the separate fit and URL-label failures until GREEN. Existing generic/default QR and local fallback tests remained passing.
- [x] Change only bounded tablet visuals: remove video shade, use `object-contain` at the original full backdrop dimensions, size October QR image/canvas/placeholder consistently, hide only the October text label, preserve encoded entry URLs. Focused GREEN: 3 files/35 tests; relevant component suite: 7 files/104 tests; TypeScript (`--incremental false`), scoped lint, and `git diff --check` exit 0. No database, reset, media, shell-dimension, or URL changes. Parent final relevant suite: 9 files/128 tests, typecheck/scoped lint/diff check exit 0. Independent per-rule public render probes against the base observed all eight expected failures (shade, fit, QR size, hidden URL for both days; exit 1), then all eight passed on the candidate (exit 0). Twenty-eight unaffected generic/non-waiting phase renders are byte-identical to the base, including default QR placeholder markup. Independent verification passed for S20/S21: 13 independent tests, 128 relevant tests, typecheck/lint exit 0, 116 unaffected renders byte-identical and 18 requested render changes. No browser/iPad playback or physical geometry proof is claimed. Native assessment was unavailable (`package-local-binary-missing`) and was not retried; named shared-render Risk item 3 received the independent verification.
- [x] Publish through PR #769, merged as `e1aa5e99efcd012645af5a4a8ffcdded3c8aad78`. CodeQL initially flagged a substring URL assertion in a test; correction `b7ddedbe` uses exact paragraph-label equality without suppressing alerts. All PR checks and merge CI (`41099472014`)/CodeQL (`41099472032`) completed successfully. Preview `pli-saas-hj4gwg5lt-heepnites-projects.vercel.app` is Ready and assigned to `dev.palladiumlatin.art`.
- [x] Verify both live entrances, successful 302 session exchanges, screen-state 200 and authenticated screen HTML 200. Both SSR pages contain the correct video with `object-contain`, no video shade, 192px QR placeholder, and no visible entry-URL label. Both events still have zero entries and open test prizes; no prizes, entries, draws, schedules or reset state were mutated. Two GitHub `/jobs` HTTP 502 errors interrupted monitoring, not CI execution; direct workflow metadata confirmed final success.
- Deferred by the user's explicit sequence: inspect actual iPad presentation before any separate reset/deletion. This delivery does not authorize or perform that reset.

## Phase 13 - Apply User-Demonstrated Object Fill

- Latest request: “listo usa en object cover usa fill”; the supplied DevTools screenshot shows `object-fit: fill` applied to the background video. Change only the video utility to `object-fill`, not the global `object-cover` rule.
- [x] Observe RED: waiting/ready branding assertions fail before the fix (2 failed, 13 passed).
- [x] Apply only `h-full w-full object-fill` to both videos, preserving absent overlay, shell dimensions, QR, MP4 files and data. GREEN: 15 branding and 128 relevant tests; typecheck/scoped lint/diff check exit 0. Differential: 28 unaffected renders identical, eight requested renders differ only in `object-cover`→`object-fill`. MP4 assets unchanged.
- [ ] Publish DEV and verify both authenticated screens plus the generated `object-fit: fill` CSS. No reset or data changes.

## Phase 12 - Restore Original Edge-To-Edge Video Framing

- Latest correction: “Lo único que te pedi es que saques el overlay no que modifiques nada mas” and “El video tiene que abarcar de arriba a abajo y de lateral a lateral.”
- [x] Reproduce the incorrect `object-contain` selection: updated original-framing assertions fail in waiting/ready (2 failed, 13 passed).
- [x] Restore only the original background-video `object-cover` class, keeping the shade absent and preserving shell, media, QR and data. GREEN: 15 branding tests and 128 relevant tests; typecheck, scoped lint and diff check exit 0. Differential: 28 unaffected renders byte-identical; eight requested renders differ only in `object-contain`→`object-cover`. MP4 assets unchanged.
- [x] Publish through PR #771, merged into `codex/develop` as `812c6f33af224fb66f9b179d99a0ef60cef94029`. PR checks and merge CI (`41108906736`)/CodeQL (`41108906675`) succeeded. Preview `pli-saas-4ib4mmfj1-heepnites-projects.vercel.app` is Ready and assigned to `dev.palladiumlatin.art`.
- [x] Authenticated live SSR verification passed for both days: session exchange 302, state/screen 200; original `h-full w-full object-cover`, no `object-contain`, no video shade, original video paths, QR192 and hidden URL label preserved. Both events still have zero entries and open test prizes. No media, QR, app-shell, prize, entry, draw, schedule, reset, or production mutation. Actual iPad appearance remains owner inspection.
