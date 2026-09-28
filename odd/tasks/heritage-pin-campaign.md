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
- [ ] 3. Build the branded campaign booking journey.
  - Add the campaign announcement/country step for qualifying booking attempts.
  - Preserve the selected occurrence, PLI logo, campaign summary, and class details.
  - Remove the intermediate course/home flash on the booking handoff.
  - Evidence: pending.
- [ ] 4. Enforce payment and promotional pricing rules.
  - Require card/wallet for remote personal web booking.
  - Retain cash only for trusted kiosk terminal/session flows.
  - Apply the non-stackable $15 price for delivered pin holders on eligible Sunday/Monday dates.
  - Enforce rules server-side as well as in UI.
  - Evidence: pending.
- [ ] 5. Verify campaign behavior and regressions.
  - Cover date boundaries, extension configuration, one-pin semantics, pending/delivered transitions, country persistence, pricing, non-stacking, payment-channel gating, branding, and no-flash behavior.
  - Run focused tests, typecheck, lint, and relevant E2E/browser checks.
  - Evidence: pending.

## Constraints

- No duplicate auth, registration, checkout, or user identity flow.
- No trust in client-only flags for pricing, cash access, or entitlement.
- No schema migration unless implementation evidence proves purchase metadata cannot satisfy the contract.
- Do not change unrelated kiosk behavior.
- Keep campaign configuration and logic centralized and removable after the campaign.

## Notes

- The existing `StudentPinCredential` is an authentication PIN and must remain semantically separate from the physical Heritage country pin.
- Subagent registration for alternate worktrees is unavailable in this session; work is routed inline with focused reads and independent verification where possible.
