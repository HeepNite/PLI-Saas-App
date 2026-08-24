## Exploration: port-dev-qr-terminal-to-production

### Current State
`origin/main` already contains the base `/staff/terminal` shell, `/checkin` QR router, client-phone check-in UI, package/drop-in check-in APIs, consecutive-offer UI, and the package/consecutive state machine. The production gap is not "build the subsystem from scratch"; it is "finish porting the dev branch contracts that make the full terminal QR journey resilient and production-correct."

The confirmed journey-2 failure is real on `origin/main`: `app/(auth)/sign-in/page.tsx` still uses only `fallbackRedirectUrl="/client-profile"`, while `origin/codex/develop` also applies `forceRedirectUrl` from `redirect_url`. That means signed-out existing clients can lose the scanned QR return URL and fall back to `/client-profile` instead of resuming `/checkin?...`.

Beyond that visible bug, dev also carries subsystem-level deltas that are not fully on main: hardened Clerk identity fallback in QR bootstrap/package routes, stricter consecutive-offer timing and rate limiting, optional Nest gateway delegation/fallback for bootstrap and today-classes, and updated tests around those contracts. No schema or migration delta was found for this port; the flows still depend on existing `Purchase`, `PackagePurchase`, `Attendance`, `ClassSession`, `CourseLink`, `StaffTerminal`, and `StaffTerminalSession` models.

### Affected Areas
- `app/(auth)/sign-in/page.tsx` — missing forced QR return redirect; this is the direct cause of journey 2 falling to `/client-profile`.
- `app/api/checkin/qr/bootstrap/route.ts` — dev rewires bootstrap through `lib/checkin/qr-decision` and optional Nest gateway fallback; also trims terminal payload shape.
- `app/api/checkin/qr/package/route.ts` — dev adds safer Clerk lookup fallback and separate time-window handling for normal check-in vs consecutive add-on purchase.
- `app/api/checkin/qr/dropin/route.ts` — dev aligns terminal-only window rules and constant usage for paid/cash drop-in completion.
- `app/api/checkin/terminal/consecutive-offer/route.ts` — dev adds rate limiting and time/date-safe filtering so expired or wrong-day offers are not surfaced.
- `app/api/checkin/terminal/today-classes/route.ts` — dev optionally delegates class resolution to Nest gateway with local fallback.
- `lib/checkin/qr-decision.ts` — shared bootstrap decision builder used by the dev bootstrap route fallback path.
- `lib/nest-gateway/config.ts`, `lib/nest-gateway/client.ts` — existing infra that dev actually uses for terminal bootstrap/today-classes behavior.
- `components/front/staff/StaffTerminalShell.tsx` — minor dev wiring for deploy refresh/origin handling, but the shell is mostly already present on main.
- `tests/api/checkin-qr-bootstrap.test.ts`, `tests/api/checkin-qr-client-phone.test.ts`, `tests/api/checkin-qr-package.test.ts`, `tests/api/checkin-qr-dropin.test.ts`, `tests/api/checkin-terminal-consecutive-offer.test.ts`, `tests/api/checkin-terminal-today-classes.test.ts` — these lock the missing contracts and show the real blast radius.

### Approaches
1. **Cherry-pick the dev QR/terminal commits wholesale** — move the whole remaining subsystem diff from `origin/codex/develop` to production.
   - Pros: fastest path to dev parity on paper; preserves the exact dev route behavior.
   - Cons: unsafe blast radius; bootstrap changes are intertwined with optional Nest gateway usage, Clerk migration hardening, and large test rewrites; likely exceeds one reviewable PR.
   - Effort: High

2. **Targeted vertical port from dev onto main** — port only the contracts still missing on main, in small slices, while reusing the production baseline that already has most of the subsystem.
   - Pros: aligns with current production architecture; isolates the journey-2 auth fix from the heavier bootstrap/gateway work; safer rollback; easier to chain under review budget.
   - Cons: requires careful contract mapping instead of blind commit replay; some dev commits cannot be cherry-picked cleanly and must be re-applied selectively.
   - Effort: Medium

### Recommendation
Use **targeted vertical port**.

Smallest safe slices:
1. **QR return-auth slice** — port the `forceRedirectUrl` behavior from dev into `app/(auth)/sign-in/page.tsx` and add focused coverage for signed-out existing-client resume.
2. **QR contract-hardening slice** — port the remaining production-critical API deltas from dev: bootstrap identity fallback, package/drop-in time-window parity, and terminal consecutive-offer filtering/rate limiting, with the corresponding API tests.
3. **Gateway-backed terminal parity slice (conditional)** — only if production env is ready for `NEST_GATEWAY_*`, port the dev bootstrap/today-classes gateway delegation path; otherwise keep the local fallback path and defer gateway activation behind config.

Direct cherry-picking is only clearly safe for the sign-in redirect fix. The larger bootstrap/API changes are NOT safe as a blind cherry-pick because they bundle gateway integration, payload-shape changes, and auth hardening into the same route files.

Forecast: this port is **over the 400-line review budget** if done as one PR. Expect roughly **40-80 lines** for slice 1, **250-450 lines** for slice 2 depending on test scope, and **180-320 lines** for slice 3 if gateway parity is included. Chained PRs are recommended.

### Risks
- Clerk redirect behavior is partly config-sensitive: without the dev `forceRedirectUrl` handling, signed-out QR resume falls back to `/client-profile`; production Clerk domain/allowed redirect settings still need verification during proposal/verify.
- The dev bootstrap route assumes optional Nest gateway infra and a terminal-safe bootstrap payload; porting that blindly can change terminal behavior and observability at once.
- Consecutive add-on timing rules differ between main and dev; incorrect porting can reopen already-ended offers or wrongly block valid add-ons.
- Terminal bootstrap response shape differs between web/phone and kiosk contexts; exposing the wrong payload to the terminal can reintroduce stale purchase/package branches.

### Ready for Proposal
Yes — but the proposal must explicitly preserve the three end-to-end journeys (new user, existing client with usable package, existing client without usable package), treat the sign-in resume bug as only one symptom, and decide whether Nest gateway parity ships now or stays behind existing fallback/config.
