# Heritage Pin Campaign

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

- [ ] 7. Polish compact booking navigation and reconcile demo test phones.
  - Keep exactly two footer actions: `Cancel | Continue` on the first step and `Back | Continue` afterward.
  - Accept Clerk's reserved `+1 555-555-0100…0199` test range only in the `codex/develop` preview/demo environment; production MUST continue rejecting it.
  - Reconcile only the authorized Clerk test instance and Railway demo database after a read-only dry-run and local backup, aborting if either environment guard fails.
  - Cover production rejection, demo acceptance, footer behavior, and exact identity lookup with focused tests.
  - Evidence: UI and guarded parser implemented; 85 focused tests, typecheck, diff check, and scoped ESLint (six pre-existing `EnrollModal` warnings only) passed. Existing Playwright journey passed before the new footer assertions; local browser readback is currently blocked because locally retrievable environment files do not expose the branch deployment's populated catalog/complete sensitive configuration. Read-only reconciliation dry-run found six Clerk test identities requiring DB mirrors and one orphaned DB `0102` row, created a mode-0600 `/tmp` backup, and performed zero writes. Vercel CLI redacts current sensitive DB values while a historical production env references the same Railway endpoint, so the user-authorized demo-only reconciliation remains fail-closed until database isolation is independently proven.

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
