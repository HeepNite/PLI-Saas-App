# Design: Port Dev QR Terminal to Production

## Technical Approach

Use a targeted vertical port from `origin/codex/develop` onto `origin/main`. Preserve main’s existing `/staff/terminal`, `/checkin`, PR #226 atomic reservation/unknown-course protections, payment, points, terminal reset, and local fallback paths while porting only the missing contracts required by the finalized auth-resume, customer-journey, and completion/offer specs.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Port strategy | Re-apply specific dev contracts in three review slices | Cherry-pick all terminal commits | Dev diffs mix redirect, gateway, auth hardening, payload shape, and tests; targeted slices keep review and rollback controlled. |
| Auth resume | Sanitize `redirect_url` and pass only internal `/checkin` URLs to Clerk `forceRedirectUrl` | Keep only `fallbackRedirectUrl`; accept raw relative paths | Required for signed-out QR resume without open redirects or profile fallback. |
| Mandatory PR2 parity | Put bootstrap/package/drop-in hardening and terminal consecutive-offer rate limiting/filtering in PR2 | Make rate limiting optional or defer to gateway PR3 | Specs require rate-limit and offer-validity parity without requiring gateway activation. |
| Gateway | PR3 is config-gated gateway delegation only, conditional on `NEST_GATEWAY_*` readiness | Require gateway for acceptance | Proposal requires local fallback acceptance; gateway can only enhance bootstrap/today-classes when safely enabled. |
| Data safety | Preserve existing transaction/idempotency seams | Rewrite package/drop-in flows | Existing reservation, attendance uniqueness, payment lookup, points, duplicate, and PR #226 protections are production-critical. |

## Data Flow

```text
/staff/terminal QR -> /checkin?courseSlug&date&time&fromQr=1
  unauthenticated -> /sign-in?redirect_url=<encoded /checkin...>
  sign-in -> safe /checkin Clerk forceRedirectUrl -> CheckInPageRouter
  new user -> booking/onboarding -> drop-in completion -> offer/reset
  package holder -> bootstrap -> package check-in -> valid consecutive offer/reset
  no package -> purchase choices -> drop-in check-in -> valid consecutive offer/reset
```

## File Changes

| File | Action | Description |
|---|---|---|
| `app/(auth)/sign-in/page.tsx` | Modify | PR1: server-read and sanitize `redirect_url`; force only internal `/checkin` resume. |
| `components/front/checkin/CheckInPageRouter.tsx` | Modify | PR1 only if needed to centralize QR sign-in URL generation. |
| `app/api/checkin/qr/bootstrap/route.ts` | Modify | PR2: Clerk fallback, local decision builder, terminal-safe payload, journey routing. |
| `lib/checkin/qr-decision.ts` | Modify | PR2: align local day/time, usable-package, quick-repeat/consecutive fields if missing. |
| `app/api/checkin/qr/package/route.ts` | Modify | PR2: Clerk fallback; split normal check-in and consecutive add-on windows. |
| `app/api/checkin/qr/dropin/route.ts` | Modify | PR2: terminal window/constants parity while preserving payment verification. |
| `app/api/checkin/terminal/consecutive-offer/route.ts` | Modify | PR2 mandatory: add route rate limiting plus same-day/not-ended/not-consumed filtering. |
| `app/api/checkin/terminal/today-classes/route.ts` | Modify | PR3 conditional: config-gated gateway delegation with local fallback only. |
| `lib/nest-gateway/config.ts`, `lib/nest-gateway/client.ts` | Modify | PR3 conditional: reuse existing gateway config/client; no required acceptance dependency. |
| `tests/**` | Modify/Create | Focused coverage for auth resume, three journeys, atomicity, idempotency, security, PR #226 compatibility, local fallback, rate limits, and optional gateway fallback. |

## Interfaces / Contracts

```ts
function resolveSafeQrRedirect(raw: unknown): string | undefined
// Accept only relative URLs whose parsed pathname is exactly "/checkin".
// Reject empty, arrays, absolute, protocol-relative, and non-checkin paths.
```

No schema or migration changes. Preserve existing `Purchase`, `PackagePurchase`, `Attendance`, `ClassSession`, `CourseLink`, `StaffTerminal`, and `StaffTerminalSession` contracts.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit/component | Sanitizer, Clerk handoff, QR URL generation | RED tests for accepted `/checkin?...` and rejected external/protocol-relative/profile paths. |
| API | New user, package holder, no-package client | Deterministic QR bootstrap/package/drop-in/client-phone fixtures. |
| API safety | Rate limits, offer validity, duplicates, atomics, points, invalid classes, PR #226 | Preserve existing regressions; add expired/wrong-day/already-consumed and throttled offer cases. |
| E2E | QR -> sign-in -> `/checkin` resume | One focused Playwright flow or component fallback if Clerk E2E is unavailable. |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification | None | None |
| Git repository selection | N/A: no VCS automation | None | None |
| Commit state | N/A: no commit automation | None | None |
| Push state | N/A: no push automation | None | None |
| PR commands | N/A: no PR command composition | None | None |

Web routing boundary: applicable outside the matrix rows. Safe behavior is same-origin internal `/checkin` resume only; failure behavior is ignored candidate plus `/client-profile` fallback. RED tests cover external, protocol-relative, and path-confused redirects.

## Migration / Rollout

No migration required and no data rollback is required because there are no schema/migration changes. Chained rollback sequence is exact reverse order: if PR3 shipped, disable gateway config first (`NEST_GATEWAY_*` off) and verify local fallback, then revert PR3; revert PR2; revert PR1. Slice rollback: PR1 revert sign-in/QR URL tests; PR2 revert local journey/rate-limit route and tests; PR3 config-disable then revert gateway delegation/config tests.

## Open Questions

- [ ] None blocking. Verify production Clerk allowed redirect settings permit sanitized relative `/checkin` returns.
