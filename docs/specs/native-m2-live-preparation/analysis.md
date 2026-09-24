# Native M2 LIVE readiness: preparation analysis

> Historical baseline analysis below. The subsequent Stripe-only ledger decision and both local backend units are recorded in [resolve.md](resolve.md). Current execution evidence is in [the task document](../../../odd/tasks/native-m2-live-internal-purchase.md); pending-ledger and no-implementation statements below describe the earlier baseline only. Runtime activation and physical LIVE validation remain unapproved and unperformed.

Prepare LIVE from MAIN while preserving TEST. The separate internal-use USD 1 one-time Product/Price is created and parent-verified; see [requirements.md](requirements.md) and [resolve.md](resolve.md). No production code is implemented. Catalog setup does not approve application implementation, release, or LIVE testing with real payment details.

## Baseline and authority

- Working branch: `feat/native-m2-live-preparation`.
- Base: MAIN commit `87563a6ce50ae8af584f4fa842a96e7f84158983`.
- The new worktree was clean at that commit before this document was created. MAIN and the prototype must remain untouched.
- MAIN source findings below were verified against exact Git objects. The new worktree has no CodeGraph index; no index was initialized.
- This folder is the active location for LIVE preparation analysis. This is not selection of an SDD workflow, creation of implementation tasks, or authorization to bypass repository approval gates.

## What MAIN already provides

All citations in this section refer to the base commit above, not the prototype or deployed configuration.

| Capability | Source and integration boundary |
| --- | --- |
| Staff-authenticated Terminal connection tokens | `app/api/kiosk/terminal/connection-token/route.ts:54-85` enforces rate limiting and staff terminal session authorization before gateway delegation or local Stripe creation. It is not a native reader bearer endpoint. |
| Server-side Stripe Terminal primitives | `apps/backend/src/terminal/connection-token.service.ts:14-23` creates connection tokens. `apps/backend/src/terminal/payment-intents.service.ts:37-46` creates `card_present` PaymentIntents with idempotency. |
| Prepared checkout and price validation | `app/api/checkout/intent/route.ts:160,196,238-292` validates and prepares checkout, then conditionally delegates Terminal creation. `lib/checkout/validation.ts:234-236` rejects an amount that differs from the expected price. Preserve this real product/identity context. |
| Existing financial records and webhook authority | `prisma/schema.prisma:84,360` defines `Purchase` and `Attendance`. `app/api/stripe/webhook/route.ts:680-706` verifies Stripe signatures and claims events before handling payment success. |
| Internal gateway boundary | `apps/backend/src/main.ts:48-55,77-110` protects internal routes with shared-secret authorization. `lib/nest-gateway/config.ts:30-59` defaults Terminal delegation flags to off; this does not establish current production settings. |

MAIN has no `native-kiosk/`, `app/terminal/native/`, native reader/reservation/job services, native/anonymous ledger models, native migrations, or `lib/native-tap/` finalizer. Those are prototype additions, not merged production capabilities. `next.config.ts` has no native route rewrite; `.github/workflows/ci.yml:5-7` targets `codex/develop`, not proof of a MAIN deployment pipeline.

The prototype's reservation recovery namespace mismatch and missing preflight invocation in its reservation controller are prototype-only findings. If those components are selected, correct and composition-test them before use. Do not promote the prototype wholesale: the exact MAIN-to-prototype comparison also deletes the unrelated `prisma/migrations/20260811120000_add_recovery_code_namespace/migration.sql`.

## LIVE readiness evidence supplied by the parent

These operational results were reported by the parent; this documentation task made no remote calls or credential reads.

| Item | Reported state |
| --- | --- |
| Intended merchant | Palladium Latin Art, `acct_1PWRzcRtYdjwed35`, independently verified by the parent-authorized LIVE account read. This is not the PLI sandbox account. |
| Read-only capability check | Charges and card payments active; country US; currency USD. |
| LIVE school location | `tml_GqQ6wPY5rSAhAt`, display name `PLI—Escuela`, `livemode: true`. One user-authorized idempotent creation succeeded and retrieval was verified through the known account-read session. The earlier inventory contained zero locations. |
| Setup permissions | The initial CLI location attempt was denied and created nothing. A separate restricted LIVE Agent key resolved that blocker with Terminal Locations Write; the user subsequently added Products Write and Prices Write through the Dashboard and confirmed. Its storage path and the default CLI configuration remain unchanged. No runtime payment/token authority is implied. |
| Verified school address | 54 Coles St, Jersey City, NJ 07302, US. |
| Retained setup evidence | Non-secret location metadata is stored at `~/.local/share/pli-saas-app/native-reader-live/stripe-location.json` with mode `0600`; the setup manifest is completed, as reported by the parent. |
| LIVE internal catalog | Product `prod_VJV0rf6b1sjK9x`, `PLI — Internal Purchase USD 1`; Price `price_1UIs02RtYdjwed35ZB3jho1F`, lookup `pli_internal_usd1_live`, amount 100, currency `usd`, type `one_time`, active and LIVE. One Product and one Price were created idempotently, then verified by GETs under `acct_1PWRzcRtYdjwed35`. No paid-class or attendance benefits. |
| Catalog evidence | Completed non-secret manifest `~/.local/share/pli-saas-app/native-reader-live/product-usd1.json`, mode `0600`, reported by the parent. |

Location and catalog setup are complete, not application readiness or a Stripe policy exception. The restricted key remains securely outside repositories for setup only, not backend payments or connection tokens. No key value is recorded here. No charge, Checkout Session, card operation, reader registration, deployment, database or schema change occurred. This documentation update neither reads credentials/evidence files nor repeats remote verification.

## Proposed first local slice — collection disabled

1. On this MAIN-derived branch, define the narrow compatibility boundary for strict device authentication and identity/assignment preflight, reusing MAIN's Stripe primitives without weakening its staff-session or internal-gateway boundaries.
2. Resolve the approved internal Product/Price server-side (LIVE, active, USD 100 cents, one-time), without client overrides or changes to existing class pricing. Approve a non-class ledger and caller/customer mapping before choosing an adapter; do not substitute the prototype's anonymous class-sale ledger.
3. Add focused contract/composition coverage when implementation is separately authorized: unauthorized or mismatched devices fail closed, existing web checkout is unchanged, amount policy cannot be overridden, and selected reservation/recovery components preserve one PaymentIntent across retries.

Keep native collection disabled until the complete authorized payment, reconciliation, ledger, and release requirements are satisfied. No application changes or tests have been performed by this preparation task.

## Boundaries and outstanding decisions

- Preserve TEST credentials, IDs, assignments, preview configuration, and external sandbox bundle. Copy none into LIVE. The temporary TEST CLI key is not a production secret-management plan.
- The separate USD 1 catalog object is created, but no forced transaction, artificial class, donation, or invented purchase is permitted. Catalog creation does not waive Stripe's LIVE testing prohibition or authorize charges/refunds.
- No production database inspection or mutation, schema application, environment/secret changes, deployment, account/key changes, or device installation is authorized here. No commits or staging are included.
- The owner must identify the authoritative production ledger and separately authorize any schema inspection, migration proposal/application, and credential/session use by destination and operation. DEMO cannot be the production financial ledger.
- Product/Price IDs and terms are verified: internal use, 100 cents USD, one-time. Non-class ledger and authenticated caller/customer mapping remain pending. MAIN Purchase requires a user and course (`prisma/schema.prisma:84-104`); do not fabricate either. Account/location/catalog verification does not authorize collection.
- Selecting native/anonymous foundation components would introduce dependencies absent from MAIN and requires an explicit ledger decision. This analysis does not resolve it for the owner.

## Acceptance status — setup evidence recorded, implementation checks pending

- [x] Confirm the intended LIVE account ID through the authorized LIVE account read.
- [x] Confirm the user-authorized LIVE school location ID and retrieved LIVE address through parent-supplied evidence.
- [x] Record internal USD 1 one-time Product/Price IDs and parent-supplied same-account creation/retrieval verification.
- [ ] Approve the non-class ledger, caller/customer mapping, and narrowly scoped implementation plan.
- [ ] Prove strict authentication/preflight and existing checkout price policy through local isolated tests.
- [ ] Prove selected recovery composition uses the same PaymentIntent and does not duplicate financial effects.
- [ ] Confirm native collection remains disabled and existing web/QR checkout remains unchanged.
- [ ] Obtain separate infrastructure, schema, credentials, deployment, and release permissions before their respective actions.

## Rollback and next decision

Preparation rollback affects only this folder's documents on the isolated branch. For any future enabled payment flow, stop new collections while retaining reconciliation, unresolved payment identities, financial records, and audit evidence; never erase history or replace an unknown payment with a new attempt. Leave the TEST sandbox and existing web/QR flow intact.

Next consolidated decision: approve the internal product's non-class ledger, durable attempt ownership, and authenticated caller/customer mapping together, then the bounded implementation plan in resolve.md. Account, location and catalog setup evidence are recorded; runtime access, deployment and charges remain separate pending boundaries.
