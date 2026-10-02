# Native M2 LIVE internal-purchase preparation

## Objective and authority

The user has superseded the USD 1 Stripe-only/no-benefit flow. The proposed flow sells exactly one finite general class credit to one existing student selected and immutably bound before payment creation. It reuses a pending `Purchase` and stable idempotency identity; paid fulfillment uses `syncPackagePurchaseFromPaidPurchase` to create one finite-credit `PackagePurchase`, while Stripe/server status remains payment authority. Behavior belongs to [requirements](../../docs/specs/native-m2-live-preparation/requirements.md) and [resolution](../../docs/specs/native-m2-live-preparation/resolve.md).

The user accepted the reconciled implementation order after fixing the recipient-selection contract: the operator selects Elvira Gutierrez at runtime by her existing complete phone identity, without hardcoding personal data; the charge is exactly USD 1.00 for one general class credit. B1, B2, N5, and N6 are complete and independently verified. The bounded delivery commits and PR chain are authorized and published. The user subsequently authorized T7b deployment preparation, production migration, device installation, and exactly one controlled LIVE USD 1 charge. Payment creation remains OFF until deployment and readiness checks pass; this authorization permits no additional charge or refund.

Branch: `feat/native-m2-live-preparation`; base: `87563a6ce50ae8af584f4fa842a96e7f84158983`.

## Execution and verification policy

- Route: delegated direct, one writer; multi-file preparation/writer trigger. No child workers or SDD route.
- Completed backend and N1–N4 work is retained as historical evidence for the former no-benefit contract. The user accepted the superseding ordered B1/B2/N5 implementation units; execute each through strict TDD and independent verification.
- Native unit 1 forecast: 650–900 authored lines, advisory rather than a test-omission or code-compression limit. No extra line-count scope prompt; no commits authorized.
- TDD enabled by explicit parent instruction/SOLID. Native runner: `native-kiosk/gradlew --no-daemon -p native-kiosk :androidApp:testDebugUnitTest`.
- APK checks: same wrapper with `:androidApp:assembleDebug :androidApp:assembleDebugAndroidTest`. No connected/install task or root production build.
- Only pinned public dependencies through declared Gradle repositories; reuse local SDK/toolchain without global changes. Preserve root package/lock/Prisma and approved backend bytes.
- Mirror: full document at Engram topic `odd/native-m2-live-internal-purchase/tasks`; synchronized after N4 verification.

## Accepted reconciled execution order

1. **B1 — Backend binding and fulfillment (complete):** narrow staff-terminal canonical-phone student lookup/selection; immutable selected-student and one-general-credit binding before payment creation; reusable pending `Purchase` and stable idempotency identity; explicit paid internal-webhook fulfillment through `syncPackagePurchaseFromPaidPurchase` to one finite-credit `PackagePurchase`. Strict TDD and independent verification passed seven suites / 192 tests, full TypeScript, touched-file lint and diff checks. Real PostgreSQL concurrency remains unexecuted.
2. **B2 — Backend reversal (complete):** an additive local-only `StripeWebhookEvent` purchase binding and durable resolution reason support terminal `manual_resolution`. Ordinary refunds/disputes are classified before provider retrieval. Guarded Purchase tombstones block later paid fulfillment/regrant; every relevant package-credit consumption and attendance-undo path requires the linked Purchase to remain paid; only a demonstrably unused credit is revoked. A default-OFF behavior gate provides rollback/activation control. Independent verification passed Prisma validation, nine suites / 227 tests, TypeScript, lint with five retained warnings, and diff checks. The migration was not applied; real PostgreSQL concurrency remains unexecuted.
3. **N5 — Native student selection and operator integration (complete):** integrated only minimum-data existing-student selection and immutable binding under the staff-terminal boundary while retaining disabled-collection, adapter, BLE/lifecycle, and server-authority protections. It grants no broad staff-portal access.
4. **N6 — Android production collection composition (complete):** locally verified Stripe Terminal 5.6.0 APIs are composed behind fail-closed blank-origin/default-OFF build gates with original-session login/token transport, runtime Bluetooth permission, one-time SDK initialization, ticket-first explicit physical reader discovery/selection/connection, strict reader validation, durable same-ID PaymentIntent sequencing, transient client secret, retrieve/collect/confirm, 90-second cancellation, lifecycle invalidation, stale-callback teardown and server-only Paid recovery. Final corrected verification passed 81 JVM/Robolectric tests, both debug APK assemblies and diff checks.
5. **T7b — Physical M2 activation and validation:** uses the separately authorized credentials/assignments, deployment, activation, and exactly one controlled LIVE USD 1 validation. It does not authorize merging tracker #497 to `main`.

## T7b activation checklist

- [x] A1 — Provision exact M2 serial `STRM2D533025669` at `tml_GqQ6wPY5rSAhAt`; SDK assigned `tmr_GrudQifObHAVgT`. Disposable APK was uninstalled and token secrets deleted; no payment was created.
- [x] A2 — Configure Vercel Production fail-closed runtime values for the approved terminal/reader and fresh attempt-signing secret. `INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED=false` and `INTERNAL_PURCHASE_CREDIT_REVERSAL_ENABLED=false` remain explicit kill switches.
- [x] A3 — Correct LIVE Product `prod_VJV0rf6b1sjK9x` description and metadata to the one-general-credit entitlement; no transaction was created.
- [x] A4 — Apply only migration `20260923230000_add_internal_credit_reversal_resolution` to Railway `Postgres-g1Qy` in an explicit transaction, mark it applied, verify the target fields/relation/index, and confirm Prisma reports the schema up to date. Migration SHA-256: `62a9ad49ba3f99a01e29c8cb6a2240ec50e2f6f63556a9a1a75dbb371b501061`. Raffle tables were not touched.
- [ ] A5 — Sync the tracker with the current production `main`, pass CI, deploy the collection runtime with payment creation still OFF, and verify fail-closed preflight.
  - [x] A5a — Correct the physical-test login contract: Android now calls the existing `/api/staff/terminal/session` route, not nonexistent `/api/staff/terminal/login`. Evidence: physical login rejection against the missing route; focused RED 1/6 then 87/87 GREEN; both APK assemblies and `git diff --check`; commit/review/PR recorded after creation. Physical PIN acceptance remains part of A5 readiness.
- [ ] A6 — Build/install the final Android collection APK with the approved production origin and exact reader assignment; verify readiness without creating a PaymentIntent.
- [ ] A7 — Enable payment creation only for the controlled validation, execute exactly one USD 1 charge, and verify the same PaymentIntent, signed webhook, bound Purchase `Paid`, and exactly one general credit.
- [ ] A8 — Disable payment creation again after evidence capture. Preserve unresolved identity and use recovery rather than replacement if any outcome is uncertain.

## Retained checklist evidence

- [x] T1 — Record Stripe-only ledger, staff-session boundary and MAIN reuse limits (superseded for behavior; retained as history).
- [x] T2 — Accept two coherent backend units and isolated dependency setup.
- [x] T3 — Backend unit 1 RED: 56 tests failed on missing route (initial syntax error excluded).
- [x] T4 — Backend preflight/token implemented; 58 focused tests passed.
- [x] T5 — Backend unit 1 normalized and checked: six suites / 126 tests, full TypeScript and touched-file lint passed.
- [x] T6 — Backend payment/recovery/webhook unit verified: RED 28 failed / 83 passed; final six suites / 169 passed, full TypeScript, nine-file lint and whitespace checks passed.
- [x] T7a — Parent subsequently reviewed backend: `review-bb5cc43875de1535` approved and exact acknowledgement burned authority on tree `3603beea22f9e7181d1019dc52addbb3f560fd52`, target `sha256:4da742356bed4958ee30cc89fb956cdc408f833414c659b020df102ec9b5dc2a`. Parent-supplied historical fact; do not reopen review.
- [x] N1 — Read active contracts and selectively inspect prototype scaffold; record native requirements/resolution before source writes. No target CodeGraph index; targeted reads, no lifecycle command.
- [x] N2 — Android-only scaffold and observed RED for strict transport/durable coordinator.
- [x] N3 — Implement encrypted state, legitimate cookie transport, serialized recovery and reader policy; collection disabled. GREEN against mock/local harness.
- [x] N4 — Normalize, run unit/APK checks, prove untouched backend/prototype/MAIN, record limitations and mirror readback.
- [x] B2 — Implement the accepted reversal correction with strict-TDD RED/GREEN and independent verification.
  - [x] B2.1 — Additive `StripeWebhookEvent` purchase binding and durable resolution-reason persistence preserve existing-row compatibility.
  - [x] B2.2 — Ordinary refund/dispute classification occurs before provider retrieval; only proven internal events enter reversal.
  - [x] B2.3 — Guarded unused-credit reversal/tombstone plus terminal manual resolution preserve history and prevent retry reclaim.
  - [x] B2.4 — Duplicate and ordered/concurrent paid/reversal tests prove tombstones/manual states prevent fulfillment, regrant, repeat revocation, or reopening under mocked scheduling.
  - [x] B2.5 — Relevant package-credit consumption and attendance-undo paths use shared paid-Purchase guards and cannot mutate tombstoned credit.
  - [x] B2.6 — Additive local migration generated and validated but not applied; default-OFF reversal behavior gate provides rollback/activation control. Real PostgreSQL concurrency remains unproven.
- [x] N5 — Native minimum-data student selection and operator integration completed; collection remains hard-disabled until T7b.
  - [x] N5.1 — Narrow Terminal adapter and fake implementation isolate SDK access from operator/coordinator.
  - [x] N5.2 — Android operator surface shows exactly USD 1.00 / one general credit, requires confirmed unique student selection, and exposes no collect/confirm/create action.
  - [x] N5.3 — Reader disconnect, app background, session/reader change and expiry invalidate context; manual BLE reconnect remains required.
  - [x] N5.4 — Reconnect/resume requires fresh server-authorized context and current reader/session validation; known-attempt recovery remains read-only and server-authoritative.
  - [x] N5.5 — Strict TDD and independent verification passed 33 JVM/Robolectric tests, both debug APK assemblies and diff checks; no physical/device/provider execution ran.
- [x] N6 — Android production collection composition implemented through strict TDD and independent verification; T7b stays external.
  - [x] N6.1 — Fail-closed origin/flag, one-time Terminal initialization, original-session rejection, Bluetooth permission, physical discovery and explicit no-auto-reconnect connection are covered.
  - [x] N6.2 — Only an explicitly selected reader matching provisioned LIVE ID, serial `STRM2D533025669`, M2 type and approved location can proceed.
  - [x] N6.3 — Ticket is durable before reader work; PaymentIntent ID is durable before transient-secret SDK retrieve → collect → confirm.
  - [x] N6.4 — Fresh same-ID server recovery is the sole Paid authority; SDK/UI callbacks cannot establish payment completion.
  - [x] N6.5 — Scheduled 90-second timeout, explicit cancel, permission/lifecycle/session/reader invalidation, terminal cancellation callbacks and late noncancellable callback cleanup are covered.
  - [x] N6.6 — Cancellation/recovery never clears unresolved state, creates a replacement intent, auto-reconnects or substitutes a reader.
  - [x] N6.7 — Final corrected verification passed 81 tests, both debug APK assemblies and clean diff checks after closing all operator/runtime/callback blockers.
  - [x] N6.8 — Rollback disables only the separate native collection build flag while retaining encrypted original-session association, durable unresolved identity and server recovery.
- [x] R1 — Review backend and Android foundation/durable-state work-unit slices; integrate bounded corrections.
  - [x] Backend recipient binding and fulfillment/reversal slices approved and acknowledged; correction commit `05732df` closes reversal-before-binding TOCTOU.
  - [x] Android secure-foundation slice approved and acknowledged; correction commit `c82d0cd` uses the AndroidKeyStore provider-generated AES-GCM IV.
  - [x] Android durable-state slice `17c269f` approved and acknowledged; correction commit `0d1202d` permits expired-session replacement only for login while preserving retained-attempt and missing-session blocking.
  - [x] Reader lifecycle `48604e1` approved and acknowledged in lineage `review-49f718f8830e0e85` after correction commit `67ac42c`: invalidation during recovery no longer strands `CANCELLING`, and overlapping recovery callbacks are generation-bound so only the latest request can decide status. Focused TDD observed 2 RED failures then 8/8 GREEN; synthetic-slice Gradle remained blocked only by its intentionally absent manifest.
  - [x] Stripe Terminal integration `59fa1b6` approved and acknowledged in lineage `review-b4441cfd283e76e4` after correction commit `c4e72261`: network completion and final state notifications use the UI dispatcher; fresh server-Paid-only rollover clears the completed local context, requires a new student selection, and needs no front-desk per-sale enablement. Focused tests passed.
  - [x] Guarded operator flow `9455e4e` approved and acknowledged in lineage `review-007e8948e35a46d7` after correction commit `059f924`: lookup requests are serialized, prior confirmation is cleared immediately, and stale callbacks cannot restore an obsolete student. The focused `OperatorRuntimeTest` suite passed. Informational follow-ups remain for discovery gating, duplicate async actions, legacy BLE permission declaration, and defensive lookup exception handling.
  - [x] Android app composition PR #534 approved and acknowledged in lineage `review-b8e69438235c3060` after bounded correction `abb83a2f`: encrypted-state startup failures retry three times with backoff, remain fail-closed, and cannot escape `Application.onCreate` into a crash loop.
- [x] R2 — Cumulative corrected feature tree passed 81/81 JVM/Robolectric tests, `assembleDebug`, `assembleDebugAndroidTest`, and `git diff --check`; no device, BLE, install, provider, database, deployment, or LIVE operation ran.
- [ ] R3 — Publish the approved issue #427 feature-branch chain without deploying or merging.
  - [x] Draft/no-merge tracker PR #497 targets `main`.
  - [x] Oversized child PRs #498–#505 were closed after establishing 400 changed lines as a hard per-PR cap; `size:exception` is not permitted for this delivery.
  - [x] The replacement chain was rebuilt as 24 ordered, bounded source/test/documentation slices; every immediate-parent diff is at most 400 changed lines.
  - [x] The reconstructed replacement tree preserves all committed feature behavior and keeps code/tests uncompressed.
  - [x] Replacement child PRs #512–#535 were published under tracker #497 with exact immediate-parent topology, approved issue #427 linkage, one `type:*` label each, no `size:exception` labels, and final observed budgets from 116 to 390 changed lines.
  - [x] GitHub checks passed across PRs #512–#535: JavaScript/TypeScript analysis, CodeQL, Vercel, and Vercel Preview Comments all succeeded with no pending or failed checks at verification time.
- [ ] T7b — Later explicit approvals: runtime credentials/assignments, deployment, activation and physical validation. No payment readiness claim.

## Retained backend verification history

Isolated lockfile installation used `npm ci --ignore-scripts --no-audit --no-fund` (664 packages); Prisma 6.19.3 generated unchanged MAIN schema for mocked tests/typechecking only, engine=none. No production env or DB access. A blocked engine download was avoided with command-scoped `/dev/null` engine paths; no toolchain upgrade. Prisma package.json configuration deprecation was advisory.

Backend commands used sanitized environment, isolated test HOME and dummy offline DATABASE_URL for tests:

```sh
npm test -- tests/api/kiosk-internal-purchase.test.ts tests/api/kiosk-terminal-connection-token.test.ts tests/backend/terminal.contract.test.ts tests/lib/prepared-checkout-context.test.ts tests/api/checkout-intent.test.ts tests/api/stripe-webhook-checkout-session.test.ts --silent
npm run typecheck -- --incremental false
npm run lint -- app/api/kiosk/terminal/internal-purchase/route.ts app/api/stripe/webhook/route.ts apps/backend/src/terminal/internal-purchase.service.ts apps/backend/src/terminal/payment-intents.service.ts apps/backend/src/terminal/connection-token.service.ts lib/stripe/internal-purchase.ts tests/api/kiosk-internal-purchase.test.ts tests/api/stripe-webhook-checkout-session.test.ts tests/lib/prepared-checkout-context.test.ts
```

Final backend counts: 91 internal route, 4 token route, 23 backend, 8 auth/prepared-context, 10 checkout, 33 webhook = 169 tests. Unit 2 fixed array action coercion after an added RED; optional receipt email changed only the internal helper. Default adapters initialize lazily. Ordinary gateway/auth/checkout contracts remained covered. Unit 2 footprint: 764 source/test additions plus deletions, 394 more than unit 1. No commits were created. Previous next-step wording requesting parent review is superseded by the supplied acknowledged review above, not a new review action.

## Native evidence and next step

Native unit 1 is implemented under `native-kiosk/`. Strict TDD observed missing-symbol RED, an interim overlapping-start failure, and GREEN after implementing the coordinator and making concurrency proof deterministic. Final offline verification ran 17 tests freshly with zero failures and assembled both debug APKs successfully. `git diff --check` passed. The implementation retains AES-256-GCM state in no-backup storage, syncs file and parent directory around atomic replacement, uses fixed HTTPS cookie-only staff-session transport with redirects disabled, serializes start/recovery, enforces terminal/reader identity policy, and keeps collection disabled.

Protected root package/lock/Prisma surfaces were untouched by the native unit; backend bytes matched the previously reviewed tree. MAIN remained clean. No device, instrumentation, physical M2/BLE, real login, provider, database, deployment, installation, activation, staging or commit operation ran. APK/mock checks do not establish LIVE readiness. Source inspection still only shows middleware permits the cookie-only kiosk route; no deployed route-composition/login test has run. Actual login replaces terminal sessions, so unresolved state prohibits reauthentication.

The former next step is superseded by the acceptance-pending order above: B1 binding/fulfillment, B2 reversal, then N5 native student selection/operator integration. The retained N5 safety criteria keep actual LIVE collection hard-disabled; T7b remains the separate later activation and physical-validation gate.

## Retained N5 safety acceptance criteria (before source implementation)

1. The Android operator surface visibly remains collection-disabled and has no path that can create, confirm, or collect a payment.
2. The already-present Stripe Terminal SDK is reachable only through a narrow adapter that has a fake/simulation implementation for tests.
3. Reader disconnect requires an explicit manual BLE reconnect; automatic reconnect and reuse of stale reader authority are forbidden.
4. Reader disconnect, app backgrounding, session change, reader change, and context expiry invalidate collection context without deleting the durable unresolved attempt.
5. Reconnect or resume cannot restore collection authority until fresh server authorization and current session/reader validation succeed. Cached tickets, client secrets, preflight, SDK state, and UI state are insufficient.
6. Known unresolved attempts remain recoverable through the existing durable/server-authoritative flow; no replacement PaymentIntent is created and only fresh server/Stripe status can establish Paid.
7. Tests use fakes/simulation only. No device, BLE, provider, operational network, staging, installation, activation, or LIVE charge execution is part of N5.

## Rollback and limits

Native unit 1 rollback: remove only new `native-kiosk/` and its native documentation additions; approved backend stays intact. Never erase unresolved durable state in an activated runtime. Backend rollback before activation may remove its route/service/proof/tests and restore shared primitives; after activation retain historical webhook exclusion, signing keys and reconciliation. N6 rollback is narrower: disable the separate native collection build flag and retain encrypted original-session association, durable unresolved PaymentIntent identity, and server recovery; never clear state, infer Paid, issue cancellation/refund, relax the blank fail-closed HTTPS-origin default, or treat T7b as met. No external financial resources changed. Neither mocks nor APK builds prove hardware, real credentials or LIVE readiness.
