# Course Promotions Booking Price Fix

## Goal

Make ordinary public booking show and charge the server-authoritative reusable course promotion price after audience-appropriate identity and entitlement validation, without creating Stripe or payment state during quoting.

## Confirmed Defect

- The `/booking` payment summary shows the client-derived regular price.
- Ordinary card checkout uses `/api/checkout/intent`, while promotion pricing is currently integrated only in `/api/checkout/session`.
- The demo identity used for reproduction has one valid delivered Heritage entitlement and no email/phone identity conflict.
- Remote public cash must not become a bypass; trusted kiosk cash behavior remains unchanged.

## Contract

- Public labels may appear before eligibility validation, but restricted prices may not.
- `everyone` promotions may quote anonymously; restricted audiences require only the optional authenticated Clerk user ID, never submitted email or phone.
- The server owns identity, entitlement, channel, date, package precedence, and final amount.
- Only ordinary public booking receives the payment-free quote; profile retains its existing authenticated authoritative checkout-session path.
- A quote creates no Stripe object, purchase, reservation, or payment state.
- Final checkout re-evaluates current authoritative state; if entitlement, promotion, date, package, or booking shape changes after a quote, the fresh result wins and the client cannot submit a quoted amount as authority.
- Applicable packages continue to take precedence and promotions do not stack with packages, coupons, add-ons, multi-participant bookings, or consecutive offers.
- Ordinary remote public booking hides cash and offers card only; its server path rejects cash attempts, while trusted kiosk cash remains available.

## Tasks

- [x] 1. Reconcile the active course-promotions spec with the confirmed intent-path and quote requirements.
  - Status: complete
  - Checks: contract consistency and `git diff --check` (observed passing after correction)
  - Commit: `5e6d3701`
- [x] 2. Add a payment-free authoritative promotion quote and fresh promotion revalidation in ordinary card intent creation.
  - Status: complete
  - Method: test-first (RED → GREEN → refactor)
  - Checks: independent verification passed 56/56 focused tests, typecheck, and `git diff --check`
  - Commits: `a23d79a2`, `13cfa664`, `6207c74d`, `231f69a6`
  - Work unit 2a: checkout-session promotion orchestration extracted to `lib/checkout/course-promotion-pricing.ts`; `npm test -- tests/api/checkout-session.test.ts` passed (20/20).
  - Work unit 2b: public PaymentIntent promotion revalidation is limited to the server-owned `/api/public/checkout/intent` wrapper. RED: the eligible delivered-Heritage request expected 1500 and promotion metadata but received 2000 without metadata. GREEN: focused intent tests passed (13/13), checkout-session regression passed (20/20), `npm run typecheck`, and `git diff --check` passed. Quote/UI/cash remain pending.
  - Work unit 2c: `bookingSource=public_booking` can no longer establish checkout-session promotion authority. RED: a direct request with spoofed body/query source received the 1500 promotion, and the public session wrapper was absent. GREEN: direct spoofing stayed at 2000 while the new server-owned public wrapper received 1500; focused session/profile/public tests passed (23/23), `npm run typecheck`, and `git diff --check` passed. Task remains pending.
  - Work unit 2d: promotion evaluation now refreshes checkout validation after identity preparation and derives its rules, regular drop-in price, and class occurrence from that final course. RED: an in-window but unscheduled public-intent occurrence received 1500, and changed final course/promotion state was ignored by both public intent and session. GREEN: the four focused checkout suites passed (37/37), `npm run typecheck`, and `git diff --check` passed.
  - Work unit 2e: the ordinary-public quote validates the checkout shape, resolves `public_booking` against the Clerk session identity only when present, and returns only canonical amount/currency plus an applied public label. RED: the new quote suite could not import the absent route (7/7 failed). GREEN: quote (7/7), public intent (4/4), intent (12/12), public session (2/2), and session (20/20) suites passed; `npm run typecheck` and `git diff --check` passed. The payment-free quote and independently revalidated final intent create no payment, account, Purchase, reservation, package-consumption, or prepared-context write during quote.
  - Work unit 2f: independently verified identity-boundary correction without reopening completed task 2: `everyone` quotes accept anonymous callers; anonymous Heritage and submitted contact details return only the canonical regular quote; authenticated eligible Heritage still applies. RED: the three new anonymous/contact tests received the prior generic 401. GREEN: the focused quote suite passed 11/11; quote identity is `{ clerkId }` only when authenticated and `{}` otherwise.
  - Verifier correction: reusable public-booking policy now rejects forged currency, invalid calendar date/time, and refreshed unscheduled occurrences before quote response or Stripe creation, canonicalizing USD to `usd`; focused RED/GREEN evidence is recorded for independent verification. Explicit package selection remains with the existing package reservation flow, without ownership probing or automatic paid-route diversion.
- [x] 3. Display the validated quote in ordinary public booking and close the remote cash bypass while preserving trusted kiosk cash.
  - Status: complete
  - Method: test-first (RED → GREEN → refactor)
  - Checks: focused enrollment/cash tests, typecheck, `git diff --check`
  - Commits: `30ea1ab6`, `24886af0`, `8c6eec87`
  - Work unit 3a: added constrained public quote/intent/session API adapters while retaining default and profile session targets. RED: focused adapter tests failed because the quote adapter was absent and intent ignored the requested public endpoint (3 failures, 16 passing). GREEN: focused adapter tests passed (19/19), `npm run typecheck` passed, and `git diff --check` passed. Task remains pending.
  - Work unit 3b: ordinary `public_booking` card submission now uses `/api/public/checkout/intent`, while public mobile/check-in hosted checkout uses `/api/public/checkout/session`; default, profile, and kiosk routes retain their existing endpoint precedence. Retries retain the endpoint selected for the original attempt; payloads retain the regular client amount and use `bookingSource` as context only. RED: focused action tests failed in 4 endpoint-selection/retry cases (52 passing), each still reaching the default endpoint. GREEN: focused action tests passed (56/56), adapter tests passed (19/19), and `npm run typecheck` passed. Quote UI, cash, commits, and network remain out of scope; task remains pending.
  - Work unit 3c: the enrollment payment-actions hook now requests and exposes the payment-step public quote using the regular checkout payload, refreshes an optional Clerk token only when signed in, clears/reloads on payload or auth changes, and ignores stale or unmounted completions. It keeps the quote distinct from `total`; ordinary public Stripe intent/session submission now fails closed until a quote succeeds, while package, profile, kiosk, cash, and non-public flows retain their paths. RED: the five new quote contract cases failed because the hook exposed no quote state or request (the pending loading-submit case timed out after entering the unguarded path). GREEN: focused action tests passed (62/62), adapter tests passed (19/19), and `npm run typecheck` passed. Task remains pending.
  - Work unit 3d: the payment summary now threads public-quote display state through the modal and router without changing payload or pricing state. Ordinary public booking says `Updating price` while checking, `Price unavailable` when missing or failed, and otherwise shows the canonical quote as `Final total`; an applied public promotion label and display-only `Promotion adjustment`/`You save` line appear for lower quotes. Profile, kiosk, legacy, and other non-public summaries retain their local total. RED: the new direct quote suite failed 4/5 because the summary showed the local `$20.00` instead of quote state. GREEN: quote tests passed (5/5), channels/actions passed (64/64), `npm run typecheck` passed, and `git diff --check` passed. Task remains pending.
  - Work unit 3e: ordinary public booking now receives explicit payment-step context that hides onsite cash and resets a stale onsite selection to Stripe; trusted kiosk, profile, and legacy non-public flows retain cash. The cash route normalizes `photoContext` then rejects every non-kiosk context with a generic terminal-only 403 before validation, identity/account preparation, writes, or special-class admission; kiosk requests still require terminal-session authorization. RED: channels and cash tests failed in four new public-hide/reset and early-rejection cases (the public request reached special-class handling and remote claims created a purchase). GREEN: channels/cash passed (23/23), quote display passed (5/5), payment actions passed (62/62), `npm run typecheck` passed, and `git diff --check` passed.
- [x] 4. Run regression verification and prepare the bounded review/delivery candidate.
  - Status: complete
  - Checks: 176/176 focused tests; typecheck; scoped ESLint with 0 errors and 9 pre-existing warnings; production build; `git diff --check`; all eight clean detached commit states independently verified
  - Commit boundary: `8c6eec87`
  - Native review: all seven source-mutating slices approved, acknowledged, and burned: `review-3efb8eae02ddaa89`, `review-d7706021faac412f`, `review-fdd4ce0a2f91c98d`, `review-f8aca6b146e07a64`, `review-5d95da5e672a5602`, `review-02d81e2e6c2ab2e9`, and `review-ab8043728269fff0`.
  - Review advisories: non-blocking follow-ups only—trusted public channel proof, final validation snapshot consistency, test environment isolation, canonical regular quote proof, invalid quote response validation/retry, quote-summary reconciliation, and explicit cash-contract rollout.
  - Delivery note: eight sequential work-unit commits were independently verified at 77, 284, 152, 383, 258, 147, 354, and 349 changed lines; every prospective slice remains below the 400-line PR budget.

## Constraints

- Base: `origin/codex/develop` at `483f0d9e1d0d6da6c39e0189bb46fe2de9d369ec`.
- Branch: `fix/course-promotions-public-booking-pricing`.
- Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/course-promotions-booking-price-fix`.
- Keep every prospective PR below 400 changed lines, link `#539`, and use exactly one `type:*` label.
- No push, PR, merge, deploy, Stripe creation, payment completion, catalog mutation, or database mutation without separate authorization.
- `Postgres-g1Qy` remains the only demo database if a later read-only live check is required; the other `Postgres` service is forbidden.

## Evidence

- User screenshots: eligible October class showed promotion label but US$20 through the payment summary.
- Read-only demo verification: exactly one matching user, one valid delivered Heritage entitlement, no email/phone conflict.
- Code trace: normal public card uses checkout intent; promotion evaluation exists only in checkout session; UI total is client-derived.
