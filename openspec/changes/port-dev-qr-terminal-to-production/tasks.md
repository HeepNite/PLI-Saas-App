# Tasks: Port Dev QR Terminal to Production

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 560-780 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker/integration → PR1 auth resume → PR2 required journey hardening → PR3 gateway-only (conditional) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Feature Branch Chain

```text
main
└─ tracker/integration PR (draft, no-merge) target: main
   └─ PR1 auth resume 📍 current apply slice target: tracker/integration branch
      └─ PR2 required journey hardening target: PR1 branch
         └─ PR3 gateway-only (optional) target: PR2 branch
```

- Retain/create a tracker branch targeting `main`; keep its PR draft/no-merge until all child slices integrate.
- Only the fully integrated tracker branch ultimately merges to `main`.
- `sdd-apply` implements ONLY PR1 next; do not batch PR2 into the same apply run.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary | Completion evidence |
|------|------|-----------|----------------------|-----------------|-------------------|---------------------|
| 1 | Safe QR auth resume parity | PR1 (~120-180) base: tracker branch | `npx vitest run tests/checkin/checkin-bootstrap-context.test.ts` | Preview/Playwright QR sign-in resume walkthrough; no prod env files | `app/(auth)/sign-in/page.tsx`, QR resume helper/tests | Signed-out QR returns to same `/checkin?...`; unsafe redirects fall back to profile |
| 2 | Required local-fallback journey parity | PR2 (~280-360) base: PR1 branch | `npx vitest run tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-client-phone.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts tests/api/checkin-terminal-consecutive-offer.test.ts` | Vitest mocked route harness + preview terminal walkthrough | `app/api/checkin/qr/**`, `app/api/checkin/terminal/consecutive-offer/route.ts`, `lib/checkin/qr-decision.ts`, tests | Three journeys, PR #226 atomicity, duplicate/idempotency, windows, offers, failures all proven locally |
| 3 | Optional gateway delegation without blocking parity | PR3 (~160-240) base: PR2 branch | `npx vitest run tests/api/checkin-terminal-today-classes.test.ts tests/api/checkin-qr-bootstrap.test.ts` | Preview walkthrough with `NEST_GATEWAY_*` off and mocked failure mode | `app/api/checkin/terminal/today-classes/route.ts`, `lib/nest-gateway/*`, gateway tests | Gateway off/unhealthy still passes local fallback; gateway on only changes delegated branch |

## Phase 1: Auth Resume Foundation

- [x] 1.1 RED `tests/checkin/checkin-bootstrap-context.test.ts` for safe `/checkin` resume, external/protocol-relative rejection, and malformed QR params. (~40-60)
- [x] 1.2 GREEN `app/(auth)/sign-in/page.tsx` and `components/front/checkin/CheckInPageRouter.tsx` to sanitize `redirect_url` and preserve QR context. (~40-70)
- [x] 1.3 REFACTOR extract `resolveSafeQrRedirect` into `lib/checkin/qr-auth-resume.ts` and reuse it in auth tests. (~20-40)

## Phase 2: Required Journey Hardening

- [x] 2.1 RED `tests/api/checkin-qr-bootstrap.test.ts` + `tests/api/checkin-qr-client-phone.test.ts` for new user, package holder, non-package client, auth resume, unknown course, package eligibility, and fallback failure. (~70-100)
- [x] 2.2 GREEN `app/api/checkin/qr/bootstrap/route.ts` + `lib/checkin/qr-decision.ts` for local decision parity, Clerk fallback, terminal payload, and PR #226 unknown-course rejection reuse. (~90-130)
- [ ] 2.3 RED `tests/api/checkin-qr-package.test.ts`, `tests/api/checkin-qr-dropin.test.ts`, and consecutive companions for duplicate/idempotency, atomic reservation, card/cash/payment failures, and closed windows. (~90-130)
- [ ] 2.4 GREEN `app/api/checkin/qr/package/route.ts` + `app/api/checkin/qr/dropin/route.ts` reusing PR #226 atomic reservation/duplicate contracts and preserving purchase validation. (~110-150)
- [ ] 2.5 RED `tests/api/checkin-terminal-consecutive-offer.test.ts` for throttling and same-day/not-ended/not-consumed/wrong-time offer filtering. (~40-70)
- [ ] 2.6 GREEN `app/api/checkin/terminal/consecutive-offer/route.ts` with mandatory rate limiting/filtering in the required local-fallback slice. (~40-70)
- [ ] 2.7 REFACTOR `lib/checkin/qr-decision.ts` and shared helpers to remove duplicated branch logic without changing contracts. (~20-40)

## Phase 3: Conditional Gateway Slice

- [ ] 3.1 RED `tests/api/checkin-terminal-today-classes.test.ts` and bootstrap gateway cases for disabled, missing, and unhealthy gateway fallback. (~40-70)
- [ ] 3.2 GREEN `app/api/checkin/terminal/today-classes/route.ts`, `lib/nest-gateway/config.ts`, and `lib/nest-gateway/client.ts` behind config-gated delegation only. (~70-110)
- [ ] 3.3 REFACTOR isolate gateway adapter seams so PR3 reverts cleanly without touching PR1/PR2 parity. (~20-30)

## Phase 4: Verification

- [ ] 4.1 Run focused API/component/E2E matrix, including `node scripts/run-playwright.mjs e2e/checkin.spec.ts`, and capture exact pass/fail evidence per work unit. (~0)
- [ ] 4.2 Run directed `npm run lint`, `npm run typecheck`, and `npm run build`; record safe preview walkthrough evidence and rollback notes for each PR slice. (~0)
