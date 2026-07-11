# Tasks: Nest Backend Integration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,100-2,700 total; target 220-390 per PR |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 → PR6 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No — resolved as feature-branch-chain for Slice/PR 1 onward.
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Nest skeleton + gateway + rollback flags | PR 1 | Includes fallback observability seam and route-specific flag scaffolding; no public route delegation |
| 2 | Read-only contract proof (`today-classes`) | PR 2 | Safe migration pattern; no writes |
| 3 | QR identity decision extraction | PR 3 | Bootstrap/account decision only; no payment writes |
| 4 | Kiosk platform gate + connection token | PR 4 | KMP spike must pass or fall back to separate native iOS + Android apps |
| 5 | Anonymous Tap to Pay intent orchestration | PR 5 | Prepare/reader flow only; Next still owns writes |
| 6 | Single-writer payment/check-in cutover | PR 6 | Move confirmation + webhook + Purchase/Attendance together |

## Phase 1: Foundation / Feasibility

- [x] 1.1 RED: add `tests/backend/internal-health.contract.test.ts` and `tests/api/nest-gateway-health.test.ts` for health, timeout, flag-off fallback, and auth-header rules.
- [x] 1.2 GREEN: create `apps/backend/src/main.ts`, `apps/backend/src/app.module.ts`, `apps/backend/src/health/health.controller.ts`, and `lib/nest-gateway/client.ts`.
- [x] 1.3 REFACTOR: add `lib/nest-gateway/config.ts`, `lib/nest-gateway/auth.ts`, `lib/nest-gateway/fallback.ts`, and lightweight fallback observability/route-flag seams for shared timeout/rollback policy.
- [x] 1.4 Blocker: prove Stripe bridge in `apps/kiosk-native/spikes/terminal-bridge.md`; if unsafe, record separate native iOS + Android fallback before PR4.

### Reviewer Focus Guidance

- PR 1 review should focus first on implementation files under `apps/backend/src/**`, `lib/nest-gateway/**`, `tests/backend/**`, `tests/api/nest-gateway-health.test.ts`, and `apps/kiosk-native/spikes/terminal-bridge.md`.
- OpenSpec artifacts MAY travel with PR 1 if the repo workflow requires them, but reviewers should treat them as planning/supporting context separate from the implementation budget.
- PR 2 begins at public route delegation for `today-classes`; that route remains out of scope for PR 1 even after the hardening follow-up.

## Phase 2: Low-Risk Gateway Proof

- [ ] 2.1 RED: add `tests/api/checkin-terminal-today-classes.test.ts` cases for unchanged response/status with Nest on, off, and unavailable.
- [ ] 2.2 GREEN: create `apps/backend/src/checkin/today-classes.controller.ts` + service, then gate `app/api/checkin/terminal/today-classes/route.ts` through `lib/nest-gateway/client.ts`.
- [ ] 2.3 REFACTOR: add shared DTO/error mapping in `lib/nest-gateway/contracts/checkin-today-classes.ts`.

## Phase 3: Customer QR Identity (No Authoritative Writes Yet)

- [ ] 3.1 RED: extend `tests/api/checkin-qr-bootstrap.test.ts` for stale QR, authenticated identity, package-vs-drop-in decision, and fallback parity.
- [ ] 3.2 GREEN: create `apps/backend/src/checkin/qr-decision.controller.ts` + service; delegate decision-only logic from `app/api/checkin/qr/bootstrap/route.ts`.
- [ ] 3.3 REFACTOR: update `components/front/checkin/hooks/useCheckInBootstrap.ts` only if response parity requires client normalization.

## Phase 4: Kiosk Payment Pre-Cutover

- [ ] 4.1 RED: add `tests/api/kiosk-terminal-connection-token.test.ts` and `tests/api/checkout-intent.test.ts` for kiosk auth, idempotency, and class-context metadata.
- [ ] 4.2 GREEN: create `apps/backend/src/terminal/connection-token.controller.ts`, `payment-intents.controller.ts`, and BFF routes `app/api/kiosk/terminal/connection-token/route.ts` + `app/api/checkout/intent/route.ts` delegation.
- [ ] 4.3 REFACTOR: keep Next as writer; block `apps/backend/**` from creating `Purchase`/`Attendance` before PR6.

## Phase 5: Single-Writer Cutover / Rollback

- [ ] 5.1 RED: add `tests/api/kiosk-terminal-payment.test.ts`, `tests/api/checkin-qr-client-phone.test.ts`, and `tests/api/stripe-webhook-checkout-session.test.ts` for success, cancel, rollback, and dual-writer prevention.
- [ ] 5.2 GREEN: move authoritative payment/check-in writes together into `apps/backend/src/payments/payment-cutover.service.ts`; delegate from `app/api/checkout/finalize/route.ts` and `app/api/stripe/webhook/route.ts` in the same PR.
- [ ] 5.3 REFACTOR: add rollback switches in `lib/nest-gateway/config.ts` and rollout notes in `docs/system/nest-gateway-rollout.md`.
