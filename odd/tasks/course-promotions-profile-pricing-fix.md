# Course Promotions Profile Pricing Fix

## Goal

Make authenticated `/client-profile` booking display the server-authoritative reusable course promotion price on the selected Drop-in option, Summary, and Payment surfaces before checkout, while keeping the final trusted profile checkout session independently authoritative.

## Confirmed Defect

- The eligible Heritage user sees `$20` on the Bachata Beginners Drop-in card and Summary for the 2026-10-08 9:10 PM occurrence.
- `dev.palladiumlatin.art` serves the landed `codex/develop@ebae0121`; this is not a stale deployment.
- The profile modal derives display totals from local regular prices and requests no promotion quote.
- The trusted profile checkout-session handler can apply the promotion later, but the pre-payment UI remains wrong and misleading.

## Contract

- Profile quote requires authenticated Clerk identity; submitted email or phone never establishes eligibility.
- Quote validates the authoritative course occurrence and checkout shape and creates no Stripe, Purchase, reservation, package-consumption, or payment state.
- Eligible Drop-in shows the quoted amount separately in Package, Summary, and Payment UI.
- Package options and underlying enrollment pricing remain unchanged; selecting a package suppresses the Drop-in promotion quote.
- Quote is display-only. Final `/api/profile/checkout/session` pricing independently revalidates current course, occurrence, identity, entitlement, package precedence, and promotion state.
- Public booking, kiosk, package, coupon, add-on, multi-participant, consecutive-offer, and hosted profile checkout behavior must not regress.

## Tasks

- [x] 1. Reconcile the active course-promotions spec with authenticated profile quote/display requirements.
  - Status: complete
  - Verification: independent contract review and `git diff --check` passed; no stale profile-no-quote assertions remain.
  - Evidence: profile quote is Clerk-authenticated, payment-free, occurrence/shape/entitlement authoritative, separate from payment authority, suppressed by explicit package selection, and independently revalidated by final profile session.
- [x] 2. Add a payment-free authenticated profile quote route with authoritative occurrence and entitlement validation.
  - Status: complete
  - Method: test-first (RED → GREEN → refactor)
  - Commit: `5ed7c7c7`
  - RED: focused route tests failed because `/api/profile/checkout/quote` did not exist.
  - GREEN: profile quote, public quote, and profile checkout-session suites passed (16/16); typecheck and `git diff --check` passed.
  - Independent verification: auth, Clerk-only identity, trusted profile channel, authoritative occurrence, minimal response, no payment/write path, and exclusions approved; route/test slice is 169 lines.
  - Native review: approved, acknowledged, and burned as `review-c0d5f0cb8cae2267`; invalid-input and pricing-handoff coverage were informational advisories only.
- [x] 3. Request and retain profile quote state without making it payment authority.
  - Status: complete
  - Method: test-first (RED → GREEN → refactor)
  - Commit: `68bf06f7`
  - RED: the profile adapter was absent and the hook exposed no profile quote request/state.
  - GREEN: adapter tests passed 20/20 and payment-action tests passed 67/67; typecheck and `git diff --check` passed.
  - Evidence: profile quote loads on the Packages step with a fresh Clerk token, clears for package/ineligible shapes, re-requests on Drop-in, ignores stale/unmounted completions, and never enters the profile session payload.
  - Native review: approved, acknowledged, and burned as `review-8b911f70d14a3bc5` with no advisory findings.
- [x] 4. Display the profile Drop-in quote in Package, Summary, and Payment while preserving package precedence.
  - Status: complete
  - Method: test-first (RED → GREEN → refactor)
  - Commit: `7caa1b09`
  - RED: seven focused cases failed because the profile eligibility/display state was not threaded to Package, Summary, or Payment.
  - GREEN: five focused UI/action suites passed 105/105; typecheck and `git diff --check` passed.
  - Evidence: required profile quote renders the authoritative amount on Drop-in, Summary, and Payment; loading/error suppress local `$20`; package selection retains package prices; public and profile session payload behavior remains unchanged.
  - Native review: approved, acknowledged, and burned as `review-854b643e26864d10`; special-flow Drop-in precedence was an informational advisory only.
- [ ] 5. Run final regression, native review for source slices, and prepare bounded delivery candidates.
  - Status: in progress
  - Verification: focused suites, typecheck, scoped lint, production build, `git diff --check`

## Constraints

- Base: `origin/codex/develop@ebae0121650a59e39e638649fdc3e4e8ba54d6d7`.
- Branch: `fix/course-promotions-profile-pricing`.
- Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/course-promotions-profile-pricing-fix`.
- Keep every work unit and prospective PR below 400 changed lines, link approved issue `#539`, and use exactly one `type:*` label.
- No push, PR, merge, manual deploy, Stripe creation, payment completion, catalog mutation, or database mutation without separate authorization.
- `Postgres-g1Qy` is the only permitted demo database for any later read-only check; the other `Postgres` service is forbidden.

## Evidence

- User screenshot: `/client-profile` Booking modal shows Bachata Beginners Drop-in and Summary as `$20.00` for 2026-10-08 9:10 PM.
- Deployment verification: `dev.palladiumlatin.art` resolves to Vercel deployment `dpl_8qZLohFMoXbzEac9tKqZ3qpXqBca` for `codex/develop@ebae0121`.
- Code trace: profile quote is explicitly excluded in `useEnrollPaymentActions`; package and summary prices are client-derived, while trusted profile session pricing occurs only at final checkout-session creation.
