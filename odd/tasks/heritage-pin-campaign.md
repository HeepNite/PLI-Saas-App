# Heritage Pin Campaign

> **Contract correction (2026-10-01):** Historical entries below that connect delivered Heritage pins to US$15 pricing are superseded. Physical pin state has no pricing authority. The active correction is tracked in `odd/tasks/public-booking-package-routing.md`.

## Status

IN PROGRESS

## Goal

Run a configurable Latin Heritage campaign that awards one country pin after a qualifying paid online purchase, lets staff confirm physical delivery, and applies a $15 class price to eligible Sunday/Monday bookings for delivered pin holders, while preserving cash only for trusted in-studio kiosk flows.

## Resolved Contract

- Any student may earn the benefit once.
- The acquisition window initially uses October 2026 in `America/New_York`; start/end dates must be centralized so the end can be extended (for example through the first week of November) without rewriting campaign logic.
- A qualifying purchase must be completed by card/wallet during the active acquisition window and must carry the selected country.
- A successful purchase creates a `pending` country-pin entitlement tied to the user and source purchase.
- Staff must explicitly mark the physical pin `delivered`; only then is the recurring price benefit active.
- A delivered pin holder pays $15 for eligible Sunday/Monday classes during the active benefit window.
- The campaign discount does not stack with another discount.
- Remote personal web booking does not offer or accept pay-on-site/cash.
- Trusted in-studio kiosk flows retain cash because their terminal/session context is server-verifiable.
- Staff profile cards show country-pin status and country without conflating it with the existing authentication PIN.
- The public booking handoff must not flash the general course/home experience and must retain PLI branding plus selected class details throughout the form.

## Tasks

- [x] 1. Specify the campaign contract and architecture boundaries.
  - Created requirements, analysis, resolve, design, and execution tasks under `docs/specs/heritage-pin-campaign/`.
  - Recorded eligibility, dates, pricing, entitlement lifecycle, payment-channel boundaries, UI copy, and non-goals.
  - Evidence: commit `6f9b18f9b2b7ad568d524761d16f5612d2ae194c`; `git diff --check` passed and all five spec files were present.
- [x] 2. Build the country-pin entitlement lifecycle and staff delivery control.
  - Persisted structured country-pin intent and entitlement metadata on the source purchase without a schema migration.
  - Serialized entitlement award by user, derived pending/delivered state, and enforced one-pin semantics.
  - Added staff aggregation, distinct country-pin badges, and an authorized, audited, idempotent delivery action.
  - Evidence: commits `15814400f17933fbeda26c470518bb647537489a`, `2ba1f7ecfd4268f0371d1d29c0994b971039e972`, and `83ff395c5e077b1f62c4bc379f9ef3707e0ea39f`; 166 focused tests passed, `npm run typecheck` passed, scoped ESLint passed, and `git diff --check` passed.
- [x] 3. Refine the branded campaign booking journey.
  - Replaced the dense photo banner with a compact image-free heading using only `¡Feliz Mes de la Herencia Latina!` and `Your country. Your community.`.
  - Moved the richer promotion into a concise flag-collage dialog shown after ten seconds at most once per session, without interrupting country selection.
  - Preserved selected country/occurrence context, deterministic graphite-ring flag-pin BOOK controls, and the branded no-flash handoff.
  - Evidence: commits `9fb20d5b`, `c07f020e`, `153cac72`, and `329375f9`; the compact heading now has real transparent Argentina/Mexico pin cutouts plus a reduced-motion-safe light sweep. Latest checks: 12 focused tests, typecheck, scoped ESLint, and refreshed mobile/header screenshots passed inspection.
- [x] 4. Enforce payment and promotional pricing rules.
  - Derived delivered entitlement from persisted identity/purchase data and normalized eligible Stripe and kiosk cash checkouts to exactly US$15.
  - Excluded pending pins, ineligible dates, multiple participants, packages, coupons, add-ons, new-student pricing, and consecutive offers.
  - Removed onsite payment from remote QR/public booking and rejected direct cash requests unless server-verified terminal authority succeeds.
  - Preserved card/cash choices and campaign pricing for validated in-studio kiosk sessions.
  - Evidence: commits `ece7638` and `ae9cf07`; 100 focused tests and `npm run typecheck` passed; scoped ESLint had no errors.
- [ ] 5. Verify campaign behavior and regressions.
  - Covered date boundaries, extension configuration, one-pin semantics, pending/delivered transitions, country persistence, pricing, non-stacking, payment-channel gating, branding, and the no-flash handoff.
  - Available checks passed: 3,485 non-integration tests across 373 files, `npm run typecheck`, full ESLint with 0 errors (114 repository warnings), isolated-port Playwright, and desktop/390px browser inspection.
  - Blocked check: seven unrelated PostgreSQL integration suites require a missing `DATABASE_URL`; the full run otherwise recorded 3,506 passing tests and 41 skips.
  - The campaign was rebuilt from the current `origin/codex/develop` as a tracker plus nine ordered child branches. Every child is within the 400-line review budget (208–391 lines), and all 38 feature paths match the accepted feature tree exactly.
  - Slice verification passed: 6 domain tests, 11 metadata tests, 42 entitlement/webhook tests, 7 staff tests, 5 booking-UI tests, 72 booking-flow tests, and 112 final focused tests; final typecheck and `git diff --check` passed.
  - Native review was not started because inspect selected an unrelated historical base scope instead of the immediate chain parent; review must be bound to each PR slice after publication.
  - Evidence: pending database-backed integration run, remote PR checks, and slice-bound review.

- [x] 6. Improve decorative flag variety and desktop pin composition.
  - Guarantee varied flag assignments across visible booking rows instead of repeated country collisions.
  - Render each flag action with a fuller enamel-pin face while preserving first-click booking, accessibility, and reduced motion.
  - Add non-interactive side rails of varied flag pins in otherwise empty wide-screen space without affecting mobile or the booking list.
  - Make the public booking handoff continuously campaign-branded: no generic course skeleton, announcement, navigation, footer, or home chrome before/during the enrollment process; retain the PLI logo and Heritage heading above the process.
  - Evidence: 14 focused Vitest checks passed; isolated Playwright booking journey passed; typecheck and diff check passed; scoped ESLint has only six pre-existing `EnrollModal` warnings; desktop/mobile screenshots verified varied filtered-row flag pins, campaign-window-only side rails, hidden chrome, logo + Heritage heading, and a centered dark process card; direct and delayed-SPA handoffs showed no generic course/home content. Final candidate is 333 changed lines and native review approved it. Work-unit commit: `27a33177420c4dc14b867a3f1d1a43acb40e0547`.

- [x] 7. Polish compact booking navigation and reconcile demo test phones.
  - Keep exactly two footer actions: `Cancel | Continue` on the first step and `Back | Continue` afterward.
  - Accept Clerk's reserved `+1 555-555-0100…0199` test range only in the `codex/develop` preview/demo environment; production MUST continue rejecting it.
  - Reconcile only the authorized Clerk test instance and Railway demo database after a read-only dry-run and local backup, aborting if either environment guard fails.
  - Cover production rejection, demo acceptance, footer behavior, and exact identity lookup with focused tests.
  - Evidence: UI and guarded parser delivered by PR #561 and merge `7cebb29367c8fd87ae025e5aa65cf855b5d1dafb`; 85 focused tests, typecheck, diff check, PR size, CI, CodeQL, and native reliability review `review-f39d20aa608184b8` passed. A transient CodeQL alert in a test helper was fixed by `75027726b96fb589e27c294f257b9e127db66d16`. `Postgres-g1Qy` was proven as the intended 8-course demo and the `codex/develop`-only Vercel `DATABASE_URL` override was switched to it, with rollback material at `/tmp/pli-vercel-db-switch-20260929T225120Z.json`. After mode-0600 backup `/tmp/pli-g1qy-clerk-links-2026-09-29T22-50-32-053Z.json`, stale `0101`/`0123` rows were relinked transactionally; all six selected Clerk test phones now match Railway, while DB-only `0115`/`0119`/`0121`/`0124`/`0133` remain untouched. Git-source deployment `dpl_JD5SHTT7b1L4YT3JtC9QYXmFj2U2` is READY at `dev.palladiumlatin.art`: `/booking` and all six phone verification requests returned 200, the catalog exactly matches the 8-course g1Qy digest, and browser readback verified `Cancel | Continue`, then `Back | Continue`, plus Clerk recognition for `0101`. The historical 7-course database retained 224 users, 647 purchases, and its orphan `0102` row byte-for-byte unchanged.

- [ ] 8. Activate Heritage pin acquisition early in the codex demo only.
  - Keep production defaults and the US$15 benefit window starting on 2026-10-01.
  - Add a browser-safe acquisition-start override and set both server/client branch-scoped preview values to 2026-09-29.
  - Redeploy `codex/develop` and verify country selection, successful-payment entitlement visibility, and staff delivery controls without changing production configuration.
  - Evidence: shared config reads browser-safe acquisition overrides with private server values taking precedence; 39 focused campaign/checkout tests, typecheck, diff check, and scoped ESLint passed. Both `HERITAGE_PIN_ACQUISITION_START` and `NEXT_PUBLIC_HERITAGE_PIN_ACQUISITION_START` are set to `2026-09-29` only for the `codex/develop` preview. Production defaults and the `2026-10-01` benefit start remain unchanged. Delivery, redeploy, country-dialog readback, and paid entitlement/staff lifecycle evidence are pending.

- [x] 9. Restrict Heritage pin countries to Hispanic America and Spain.
  - Update the requirements to define the exact campaign geography: the 18 sovereign Spanish-speaking American countries, Puerto Rico, and Spain.
  - Centralize the allowlist so both the country selector and server-side normalization reject every other ISO country code.
  - Add focused coverage proving included boundary examples and excluding unrelated countries such as Albania and Algeria.
  - Evidence: `HERITAGE_PIN_COUNTRY_CODES` is the shared selector/server allowlist; 13 focused campaign tests pass and explicitly reject Albania, Algeria, Brazil, and Equatorial Guinea while accepting Colombia, Puerto Rico, and Spain.

- [x] 10. Normalize country-dialog scrolling.
  - Lock document scrolling while the modal is open and prevent wheel/touch scroll chaining to the booking page.
  - Keep the dialog header, search, confirmation action, and explanatory copy fixed; only the country list may scroll.
  - Replace competing native scrollbars with one narrow rounded thumb that appears during list scrolling and fades afterward.
  - Verify desktop and compact viewport behavior against the Docker-backed local booking flow.
  - Evidence: the dialog uses one bounded `overscroll-contain` country list, fixed document locking, explicit wheel containment, and a transient six-pixel campaign thumb. Local Chromium confirmed list scroll `0 → 211`, page scroll remained `0`, the thumb activated during input and faded after 700 ms; 29 focused tests, typecheck, diff check, and scoped ESLint pass.

- [x] 11. Preserve Heritage context behind phone verification.
  - Keep the PLI logo, Heritage campaign heading/tagline, and selected class visible while SMS access is requested.
  - Present the phone dialog above a translucent near-black overlay with restrained blur instead of replacing the viewport with opaque black.
  - Preserve kiosk behavior and the existing verification authority; this is presentation-only.
  - Verify the public campaign SMS state locally without sending a code.
  - Evidence: `HeritageVerificationBackdrop` renders the PLI logo, campaign heading/tagline, selected class, and country beneath a 55% near-black two-pixel blur overlay only for public Heritage QR bookings; kiosk fallback styling is unchanged. Docker-backed local Chromium reached Phone access for `+1 555-555-0103`, confirmed all branded context and `Send code` visibility, and sent no SMS. 33 focused tests, typecheck, diff check, and scoped ESLint pass (six pre-existing EnrollModal warnings only).

- [x] 12. Preserve the public booking information step for signed-in customers.
  - Never let a signed-in public Heritage booking skip directly from class selection to packages or payment.
  - Keep trusted profile and non-public QR flows eligible for their established contact-step shortcut.
  - Cover the routing decision with focused regression tests and verify the live signed-in handoff after deployment.
  - Evidence: `shouldSkipQrBookingContactStep` now rejects the shortcut for `public_booking` while preserving signed-in non-public QR behavior. The regression test failed before implementation and then passed; 25 focused tests, typecheck, scoped ESLint, and diff check pass. Live signed-in verification remains pending deployment.

## Delivery Strategy

- Strategy: Feature Branch Chain, because the campaign must integrate atomically and the complete diff exceeds the 400-line review budget.
- Tracker: `feat/heritage-pin-campaign-tracker` targets `codex/develop` and remains draft/no-merge until every child is integrated.
- Child order:
  1. `feat/heritage-pin-campaign-01-contract` — requirements, analysis, and resolved contract.
  2. `feat/heritage-pin-campaign-02-design` — design and implementation tasks.
  3. `feat/heritage-pin-campaign-03-domain` — campaign dates, country validation, and pricing policy with tests.
  4. `feat/heritage-pin-campaign-04-metadata` — entitlement metadata parsing/building with tests.
  5. `feat/heritage-pin-campaign-05-entitlement` — serialized award lookup, Stripe settlement, and tests.
  6. `feat/heritage-pin-campaign-06-staff` — staff status, presentation, and delivery action with tests.
  7. `feat/heritage-pin-campaign-07-booking-ui` — country selection, promotional UI, flag pins, assets, and tests.
  8. `feat/heritage-pin-campaign-08-booking-flow` — branded handoff, hosted checkout intent/pricing, and tests.
  9. `feat/heritage-pin-campaign-09-payment-channels` — remote cash rejection, trusted kiosk cash, and tests.
- Every child targets its immediate predecessor. Push, PR creation, and merge remain separate delivery actions.

## Constraints

- No duplicate auth, registration, checkout, or user identity flow.
- No trust in client-only flags for pricing, cash access, or entitlement.
- No schema migration unless implementation evidence proves purchase metadata cannot satisfy the contract.
- Do not change unrelated kiosk behavior.
- Keep campaign configuration and logic centralized and removable after the campaign.

## Notes

- The existing `StudentPinCredential` is an authentication PIN and must remain semantically separate from the physical Heritage country pin.
- Subagent registration for alternate worktrees is unavailable in this session; work is routed inline with focused reads and independent verification where possible.
