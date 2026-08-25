# Apply Progress: Nest Backend Integration

## Slice

- Delivery mode: force-chained
- Chain strategy: feature-branch-chain
- Current slice: PR 3 / Customer QR Identity Decision

## Completed Tasks

- [x] 1.1 Added backend and gateway health tests for contract, timeout, flag-off fallback, and auth headers.
- [x] 1.2 Added the minimal backend skeleton and internal health gateway client.
- [x] 1.3 Extracted shared gateway config, auth, fallback, route-flag, and fallback observability helpers.
- [x] 1.4 Documented the kiosk Stripe Terminal bridge feasibility gate and native fallback policy.
- [x] 2.1 Extended `tests/api/checkin-terminal-today-classes.test.ts` with Nest-on, route-flag-off, and Nest-unavailable parity coverage.
- [x] 2.2 Added backend `today-classes` controller/service wiring and delegated the existing Next route through the Nest gateway client.
- [x] 2.3 Extracted shared `today-classes` DTO and error mapping contract helpers for both Next and backend paths.
- [x] 3.1 Extended `tests/api/checkin-qr-bootstrap.test.ts` with stale QR, authenticated identity delegation, package-vs-drop-in, and fallback parity coverage.
- [x] 3.2 Added backend `qr-decision` controller/service wiring and delegated the existing Next QR bootstrap route through the Nest gateway client.
- [x] 3.3 Kept `useCheckInBootstrap` unchanged because the Nest response matched the existing public payload without client normalization.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/backend/internal-health.contract.test.ts`, `tests/api/nest-gateway-health.test.ts` | Integration + Unit | ✅ 13/13 baseline tests | ✅ Added fallback observability assertions before changing gateway code | ✅ `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (15/15) | ✅ Route seam, 401/403, 5xx, malformed payload, network rejection, timeout, and flag-off/missing-config observability | ✅ Kept the request seam minimal while expanding failure evidence |
| 1.2 | `tests/backend/internal-health.contract.test.ts`, `tests/api/nest-gateway-health.test.ts` | Integration + Unit | ✅ 13/13 baseline tests | ✅ Existing slice RED already recorded; follow-up RED added first for runtime hardening gaps | ✅ `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (15/15) | ✅ Health route still proves success path while gateway hardening preserves current foundation scope | ✅ Backend scaffold remains intentionally minimal; no PR2 delegation leaked in |
| 1.3 | `tests/api/nest-gateway-health.test.ts` | Unit | ✅ 13/13 baseline tests | ✅ Added route-flag and reporter assertions before touching config/client code | ✅ `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (15/15) | ✅ Added `today-classes` flag defaults, internal-health flag override, expected fallback classification, timeout/status metadata | ✅ Extracted a dedicated observability seam instead of bloating the client |
| 1.4 | `apps/kiosk-native/spikes/terminal-bridge.md` | Documentation spike | N/A (new) | ✅ Written | ➖ Not executable code | ➖ Single decision artifact | ✅ Clean |
| 2.1 | `tests/api/checkin-terminal-today-classes.test.ts` | Integration | ✅ 6/6 baseline tests | ✅ Added Nest-on and Nest-unavailable assertions first; both failed before route delegation existed | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts` (9/9) | ✅ Covered Nest success, route-flag-off fallback, and upstream-unavailable fallback while preserving status/body parity | ✅ Added request/env helpers and silenced expected observability noise without changing production behavior |
| 2.2 | `tests/backend/today-classes.contract.test.ts`, `tests/backend/internal-health.contract.test.ts`, `tests/api/checkin-terminal-today-classes.test.ts` | Integration + Unit | ✅ 21/21 baseline tests (`today-classes`, health gateway, backend health) | ✅ Added backend contract test for the new internal route before creating controller/service files | ✅ `npm test -- tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts tests/api/checkin-terminal-today-classes.test.ts` (26/26) | ✅ Proved backend service mapping plus public route delegation and fallback through the shared gateway client | ✅ Kept the backend slice read-only and reused PR1 rollback seams |
| 2.3 | `tests/backend/today-classes.contract.test.ts`, `tests/api/checkin-terminal-today-classes.test.ts` | Unit + Integration | ✅ 26/26 from 2.2 green state | ✅ Contract parser/builder expectations were exercised before extracting the shared DTO mapper | ✅ `npm test -- tests/backend/today-classes.contract.test.ts tests/api/checkin-terminal-today-classes.test.ts` (11/11) | ✅ Shared DTO validation rejects malformed upstream payloads by falling back to Next while both runtimes share the same success/error envelope | ✅ Centralized response/error mapping removed duplication from the Next route |

## Corrective Work

- PR2 blocker follow-up hardened the public `today-classes` gateway contract by stripping unexpected upstream fields before returning the response to clients.
- PR2 blocker follow-up added backend-side shared-secret verification for `/internal/checkin/today-classes` and `/internal/health`, rejecting missing or invalid secrets before serving internal responses.
- Expected gateway fallbacks (`disabled`, `missing_config`) now log at info level, while unexpected fallbacks still log at warn level.
- Replaced the implementation-centric backend health assertion with a request-level seam that proves `GET /internal/health` is registered and returns the required payload.
- Added gateway fallback coverage for unauthorized responses, generic upstream failures, malformed success payloads, fetch/network rejection, and trailing-slash base URLs.
- Reconciled `tasks.md` delivery metadata so the chained delivery decision matches the recorded Slice 1 execution path.
- Added a lightweight fallback reporter seam that records route name, reason, timeout, request correlation id, expected-vs-unexpected fallback, and status class when the upstream returned an HTTP status.
- Added route-specific gateway flag scaffolding in PR1 so future PR2 work can enable `today-classes` independently while the global kill switch still short-circuits all routes.
- Reused the PR1 `today-classes` route flag and fallback reporter seam instead of introducing route-local delegation logic.
- Added a shared `checkin-today-classes` contract module so the backend service, gateway client, and legacy Next fallback all produce the same public envelope.
- Kept the Next route read-only: Nest success returns the existing public shape, while disabled/misconfigured/unavailable/error states still run the unchanged local implementation.

## Review Strategy

- Implementation reviewer focus: `apps/backend/src/**`, `lib/nest-gateway/**`, `tests/backend/internal-health.contract.test.ts`, `tests/api/nest-gateway-health.test.ts`, and `apps/kiosk-native/spikes/terminal-bridge.md`.
- OpenSpec artifacts remain in PR1 because this repo uses them as source of truth, but reviewers should treat them as supporting/planning diff separate from the implementation review budget.
- If the PR description needs extra guidance, call out two counts: the implementation/test/spike slice (foundation + hardening) versus the OpenSpec artifact diff, and explicitly state that PR2 starts at `today-classes` route delegation.
- PR2 reviewer focus should stay on `app/api/checkin/terminal/today-classes/route.ts`, `apps/backend/src/checkin/**`, `lib/nest-gateway/client.ts`, `lib/nest-gateway/contracts/checkin-today-classes.ts`, and the focused route/backend contract tests.

## PR2 Blocker Follow-Up — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR2-Reliability | `tests/api/checkin-terminal-today-classes.test.ts` | Integration | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (26/26 baseline) | ✅ Added extra-field sanitization and malformed-success fallback assertions before changing gateway parsing | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (32/32) | ✅ Covered exact-shape success plus malformed upstream payload fallback to prove both the happy path and alternate path | ✅ Extracted a response parser that rebuilds the exact public DTO instead of returning raw upstream objects |
| PR2-Security | `tests/backend/internal-health.contract.test.ts`, `tests/backend/today-classes.contract.test.ts` | Integration | ✅ 26/26 baseline included the internal request seam before auth changes | ✅ Added missing/invalid secret rejection tests for both internal routes before touching the backend handler | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (32/32) | ✅ Covered authorized success plus missing/invalid shared-secret failures across `/internal/health` and `/internal/checkin/today-classes` | ✅ Centralized the internal auth gate at the request-handler boundary instead of duplicating checks per route |
| PR2-Observability | `tests/api/nest-gateway-health.test.ts` | Unit | ✅ 26/26 baseline included existing fallback reporter coverage | ✅ Added logger-level split assertion before changing the console reporter | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (32/32) | ✅ Covered expected (`disabled`) and unexpected (`timeout`) fallback levels so both branches execute | ✅ Kept the existing reporter seam and only changed level selection |

## PR2 Blocker Follow-Up — Test Summary

- **Total tests written**: 6
- **Total tests passing**: 32 in the focused blocker suite
- **Layers used**: Unit (1 file), Integration (3 files)
- **Approval tests**: None — behavior changed intentionally for contract hardening and internal auth enforcement
- **Pure functions created**: 2 (`createCheckinTodayClassesClassDto`, `parseCheckinTodayClassesResponse`)

## PR2 Polish Follow-Up — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR2-Timeout-Parity | `tests/api/checkin-terminal-today-classes.test.ts` | Integration | ✅ 32/32 PR2 suite baseline | ✅ Added a direct public-route timeout fallback parity test before touching gateway code | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/api/nest-gateway-health.test.ts` (29/29 in the focused polish suite) | ✅ Proved the public `today-classes` route preserves the Next fallback contract for timeout failures, not just network rejection | ✅ Reused the existing gateway timeout seam; no route-specific production logic added |
| PR2-Route-Secret | `tests/backend/today-classes.contract.test.ts` | Integration | ✅ 32/32 PR2 suite baseline | ✅ Added a route-specific invalid-secret rejection test before changing any auth behavior | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/api/nest-gateway-health.test.ts` (29/29 in the focused polish suite) | ✅ Complements the missing-secret coverage so `/internal/checkin/today-classes` now proves both unauthenticated and wrong-secret paths | ✅ No production auth change required because the existing request gate already enforced it |
| PR2-Malformed-200-Observability | `tests/api/nest-gateway-health.test.ts` | Unit | ✅ 32/32 PR2 suite baseline | ✅ Added malformed-200 fallback metadata assertions before updating the gateway reporter payload | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/api/nest-gateway-health.test.ts` (29/29 in the focused polish suite) | ✅ Captured both HTTP `status: 200` and `statusClass: 2xx` for malformed-success fallbacks without changing fallback behavior | ✅ Kept the change generic in shared observability helpers so later routes inherit it automatically |

## PR2 Polish Follow-Up

- Added a direct timeout parity test for the public `today-classes` route so timeout failures prove the same fallback contract already covered for network-unavailable cases.
- Added route-specific invalid-secret coverage for `/internal/checkin/today-classes` to complement the existing missing-secret guard test.
- Gateway observability now includes `status: 200` and `statusClass: 2xx` when a malformed success payload triggers fallback, preserving more debugging context without changing public behavior.

## PR2 Verification Gap Follow-Up — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR2-Unauthorized-NonOk-Parity | `tests/api/checkin-terminal-today-classes.test.ts` | Integration | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts` (12/12 baseline) | ✅ Added route-level fallback parity assertions for upstream 401/403 and 502 responses before touching any production files | ✅ `npm test -- tests/api/checkin-terminal-today-classes.test.ts` (15/15) | ✅ Covered both unauthorized variants (401, 403) plus a non-OK 502 payload to prove the public route preserves legacy status/body and strips upstream details | ➖ None needed — existing production fallback already satisfied the contract; only verification coverage changed |

## PR2 Verification Gap Follow-Up

- Added route-specific public `today-classes` parity coverage for upstream 401/403 responses, asserting the route returns the legacy Next 200 payload instead of leaking Nest error details.
- Added route-specific public `today-classes` parity coverage for upstream 502/non-OK responses, asserting the route falls back to the legacy Next payload and ignores upstream error bodies.
- No production files changed in this follow-up because the public route already honored the required fallback contract; the gap was verification-only evidence.

## Tests Run

- `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts`
- `npm test -- tests/api/nest-gateway-health.test.ts` (RED → GREEN cycle for the hardening follow-up)
- `npm run typecheck`
- `npm run lint -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts apps/backend/src/main.ts lib/nest-gateway/client.ts lib/nest-gateway/config.ts lib/nest-gateway/auth.ts lib/nest-gateway/fallback.ts lib/nest-gateway/observability.ts`
- `npm install` was required first because the isolated worktree did not have `node_modules`, causing initial `vitest` and `tsc` command-not-found failures.
- `npm test -- tests/api/checkin-terminal-today-classes.test.ts` (RED: 7/9 after new delegation tests, GREEN: 9/9)
- `npm test -- tests/backend/today-classes.contract.test.ts` (RED: missing controller/service files, GREEN after backend route wiring)
- `npm test -- tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts tests/api/checkin-terminal-today-classes.test.ts`
- `npm run typecheck`
- `npm run lint -- app/api/checkin/terminal/today-classes/route.ts apps/backend/src/app.module.ts apps/backend/src/main.ts apps/backend/src/checkin/today-classes.controller.ts apps/backend/src/checkin/today-classes.service.ts lib/nest-gateway/client.ts lib/nest-gateway/contracts/checkin-today-classes.ts tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts`
- `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (RED: 27/32 after new blocker tests, GREEN: 32/32 after gateway sanitization, internal auth gate, and logger-level split)
- `npm run typecheck`
- `npm run lint -- app/api/checkin/terminal/today-classes/route.ts apps/backend/src/main.ts lib/nest-gateway/client.ts lib/nest-gateway/contracts/checkin-today-classes.ts lib/nest-gateway/observability.ts tests/api/checkin-terminal-today-classes.test.ts tests/api/nest-gateway-health.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts`
- `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/api/nest-gateway-health.test.ts` (RED: malformed-200 metadata missing on fallback event, GREEN: 29/29 after status metadata plumbing)
- `npm run typecheck`
- `npm run lint -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/api/nest-gateway-health.test.ts lib/nest-gateway/client.ts lib/nest-gateway/observability.ts`
- `npm test -- tests/api/checkin-terminal-today-classes.test.ts` (baseline safety net: 12/12, follow-up green: 15/15)
- `npm test -- tests/api/checkin-terminal-today-classes.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (37/37)
- `npm run typecheck`
- `npm run lint -- app/api/checkin/terminal/today-classes/route.ts apps/backend/src/app.module.ts apps/backend/src/main.ts apps/backend/src/checkin/today-classes.controller.ts apps/backend/src/checkin/today-classes.service.ts lib/nest-gateway/client.ts lib/nest-gateway/contracts/checkin-today-classes.ts lib/nest-gateway/observability.ts tests/api/checkin-terminal-today-classes.test.ts tests/api/nest-gateway-health.test.ts tests/backend/today-classes.contract.test.ts tests/backend/internal-health.contract.test.ts`

## Risks

- The backend files are still a minimal TypeScript scaffold rather than a real Nest runtime bootstrap; the new request seam proves route registration behavior for PR1, but full Nest package wiring remains deferred.
- Only the read-only `today-classes` route is delegated in PR2; later QR and payment routes must stay in their own slices to preserve the chained review budget.
- The reporter now splits expected fallbacks to info and unexpected ones to warn; if operations later need structured sinks, wire the same seam instead of coupling PR2+ routes directly to a vendor SDK.
- The backend still uses the lightweight request-handler seam rather than a real Nest HTTP runtime, so later slices should continue reusing this seam or replace it in one bounded step instead of partially mixing both models.
- `today-classes` success responses now validate the upstream DTO shape before returning it publicly; malformed upstream payloads intentionally fall back to Next instead of leaking backend mistakes to clients.

## PR3 — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `tests/api/checkin-qr-bootstrap.test.ts`, `tests/backend/qr-decision.contract.test.ts` | Integration | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/backend/internal-health.contract.test.ts tests/backend/today-classes.contract.test.ts` (19/19 baseline) | ✅ Added route-level delegation/fallback assertions and backend contract coverage before creating QR gateway code | ✅ `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts` (16/16) | ✅ Covered authenticated identity delegation, stale-window parity, package-present vs drop-in decisions, sanitized success, and upstream fallback parity | ✅ Extracted decision reads into a shared helper while keeping prepared checkout writes in Next |
| 3.2 | `tests/backend/qr-decision.contract.test.ts`, `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ 19/19 baseline included the existing QR route behavior before backend delegation | ✅ Backend POST contract and public-route Nest delegation tests were written first | ✅ `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts` (16/16) | ✅ Proved internal shared-secret path plus public success/fallback behavior across distinct route outcomes | ✅ Added a route-specific flag, POST gateway support, and a sanitized QR contract parser without changing the public DTO |
| 3.3 | `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ 16/16 PR3 green suite baseline | ✅ Existing response-parity assertions proved whether client normalization was needed before touching the hook | ✅ `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts` (16/16) | ✅ Terminal and non-terminal payload assertions exercised both branches, proving the client shape stayed stable | ➖ No hook change needed — response parity held |

## PR3 Notes

- The Nest slice owns only the QR decision reads. Prepared checkout context creation remains in the Next route after the decision response returns.
- Added route-specific flag `NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED` defaulting to off, preserving the global kill switch and shared fallback observability seam.
- The public QR bootstrap route now sanitizes Nest success payloads through a dedicated QR contract parser before returning them to clients.
- Terminal-safe QR bootstrap responses now use an explicit whitelist so `hasPreviousPurchase` is not exposed on the public kiosk terminal payload while package/history data remain hidden.
- `lib/checkin/qr-decision.ts` now uses named business-rule constants for participant clamp bounds, query limits, quick-repeat threshold, and cents conversion without changing behavior.
- QR gateway contract names now reflect the internal Nest gateway boundary (`CheckinQrDecisionGatewayRequest/Response`) instead of reading like direct frontend public DTO ownership.
- `components/front/checkin/hooks/useCheckInBootstrap.ts` did not need a code change because the public response stayed shape-compatible.

## PR3 Test Summary

- **Total tests written**: 6
- **Total tests passing**: 16 in the focused PR3 suite
- **Layers used**: Integration (2 files)
- **Approval tests**: None — this slice changes behavior intentionally through a new internal gateway path
- **Read-only decision helpers created**: 1 (`buildQrBootstrapDecisionResponse`)

## PR3 Tests Run

- `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/backend/internal-health.contract.test.ts tests/backend/today-classes.contract.test.ts` (safety net baseline: 19/19)
- `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts` (RED → GREEN: 16/16)
- `npm run typecheck` *(passes after dependency refresh; the earlier blocked note is stale)*
- `npm run lint -- app/api/checkin/qr/bootstrap/route.ts apps/backend/src/app.module.ts apps/backend/src/main.ts apps/backend/src/checkin/qr-decision.controller.ts apps/backend/src/checkin/qr-decision.service.ts lib/checkin/qr-decision.ts lib/nest-gateway/client.ts lib/nest-gateway/config.ts lib/nest-gateway/contracts/checkin-qr-decision.ts tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts`

## PR3 Risks

- PR3 touches the large QR bootstrap route, so the implementation diff exceeded the ideal 400-line review target even though the functional scope stayed bounded to QR decision reads.

## PR3 Review Follow-Up — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR3-Security-Regression | `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ Existing PR3 terminal bootstrap coverage baseline | ✅ Added terminal-flow assertions that `hasPreviousPurchase` stays out of the public slim payload before changing the route | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts` (15/15) | ✅ Covered both local fallback/bootstrap and Nest-backed terminal responses so the public route preserves terminal-safe parity | ✅ Replaced spread-based terminal shaping with an explicit response whitelist |
| PR3-Type-Naming | `tests/backend/qr-decision.contract.test.ts`, `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ PR3 route/backend contract suite already green | ✅ Renamed gateway request/response types only after the route/backend contract tests existed | ✅ `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts` (17/17) | ✅ Proved the internal contract rename did not change request handling or public response parsing | ✅ Narrowed internal contract naming without introducing a larger DTO split |

## PR3 Review Follow-Up

- Fixed the terminal QR bootstrap leak by removing `hasPreviousPurchase` from the terminal-safe public response instead of forwarding the full bootstrap object.
- Refreshed the stale progress note: `npm run typecheck` now passes in this worktree.
- Extracted named constants in `lib/checkin/qr-decision.ts` for participant clamping, active/recent query limits, quick-repeat eligibility, and cents conversion.
- Clarified the Nest gateway contract intent with request/response type names scoped to the internal QR decision boundary.

## PR3 Review Follow-Up — Tests Run

- `npm test -- tests/api/checkin-qr-bootstrap.test.ts`
- `npm test -- tests/backend/qr-decision.contract.test.ts`
- `npm run typecheck`
- `npm run lint -- app/api/checkin/qr/bootstrap/route.ts apps/backend/src/main.ts apps/backend/src/checkin/qr-decision.controller.ts apps/backend/src/checkin/qr-decision.service.ts lib/checkin/qr-decision.ts lib/nest-gateway/client.ts lib/nest-gateway/contracts/checkin-qr-decision.ts tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts`

## PR3 Blocking Review Fix — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR3-Terminal-Safe-Purchase-State | `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ Existing PR3 terminal-safe coverage already exercised local and Nest-backed terminal responses | ✅ Tightened both terminal-safe assertions first so `hasAnyCompletedPurchase` had to be `undefined` alongside `hasPreviousPurchase`, `packages`, and `purchaseHistory` | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts` (16/16) | ✅ Covered local fallback/bootstrap and Nest-backed terminal responses to prove the boolean no longer leaks in either path | ✅ Removed the field from the explicit terminal-safe whitelist instead of layering another response mutation |
| PR3-Unknown-Course-404-Parity | `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ Existing QR fallback suite already covered Nest-unavailable fallback behavior | ✅ Added a focused unknown-course fallback assertion first, requiring legacy `{ error: "Course not found" }` with status `404` | ✅ `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts` (18/18) | ✅ Proved Nest fallback still delegates to the local QR decision path while preserving the legacy not-found response contract | ✅ Introduced a typed QR decision error so known route errors map cleanly without broad catch-all branching |

## PR3 Blocking Review Fix

- Removed `hasAnyCompletedPurchase` from the public terminal-safe QR bootstrap payload so terminal responses now hide it together with `hasPreviousPurchase`, `packages`, and `purchaseHistory`.
- Restored the legacy unknown-course fallback contract by returning `{ error: "Course not found" }` with status `404` when the local QR decision builder detects an unknown course.
- Kept the change scoped to PR3 QR decision extraction: no payment/check-in writes, no Prisma changes, and no PR4 work mixed in.

## PR3 Blocking Review Fix — Tests Run

- `npm test -- tests/api/checkin-qr-bootstrap.test.ts`
- `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap.test.ts`
- `npm run typecheck`
- `npm run lint -- app/api/checkin/qr/bootstrap/route.ts lib/checkin/qr-decision.ts tests/api/checkin-qr-bootstrap.test.ts`

## PR3 Terminal-Safe Risk Follow-Up

- Tightened the terminal-safe QR bootstrap whitelist again so terminal responses now return only `context`, `customer`, and `consecutiveOffer`, removing package, purchase, session-purchase, active-package, quick-checkout, and quick-repeat-derived fields from both legacy and Nest-backed terminal paths.
- Removed the terminal-only quick-repeat debug log so purchase-derived state is no longer emitted to application logs during kiosk bootstrap.
- Added regression assertions for both the legacy/local terminal path and the Nest-backed terminal path to prove the stripped fields stay absent.

## PR3 Terminal-Safe Risk Follow-Up — Tests Run

- `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts`
- `npm run typecheck`
- `npm run lint -- app/api/checkin/qr/bootstrap/route.ts tests/api/checkin-qr-bootstrap.test.ts`

## PR3 Final Blocker Fix — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR3-Log-Sanitization | `tests/api/checkin-qr-bootstrap.test.ts` | Integration | ✅ Focused QR bootstrap suite baseline exposed the current latency log payload | ✅ Tightened the latency assertion first so the bootstrap log must no longer include `hasQuickCheckout` | ✅ `npx vitest run tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts` (24/24) | ✅ Existing terminal and non-terminal bootstrap assertions still exercised both sanitized and standard response paths | ✅ Removed the purchase-derived log field without changing the surrounding latency event shape |
| PR3-Consecutive-Compatibility | `tests/api/checkin-qr-bootstrap-consecutive.test.ts` | Integration | ✅ Consecutive bootstrap suite started red (4/6) with `courseCatalog.findMany` undefined in the extracted QR decision path | ✅ Kept the failing consecutive route assertions as the RED proof before touching the helper | ✅ `npx vitest run tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts` (24/24) | ✅ Covered offer-present, purchased-class suppression, missing-link, missing-source, and day-specific scheduling paths in the legacy terminal bootstrap flow | ✅ Added a compatibility fallback in `resolveConsecutiveOffer` so extracted QR decisions preserve legacy behavior across older Prisma mock shapes |

## PR3 Final Blocker Fix

- Removed the purchase-derived `hasQuickCheckout` field from the staff terminal bootstrap latency log while keeping the existing operational timing event.
- Restored legacy consecutive-offer bootstrap compatibility by letting `resolveConsecutiveOffer` fall back when `prisma.courseCatalog.findMany` is unavailable and by preserving the "already purchased Class B today" suppression path.
- Kept the scope inside PR3 QR decision extraction only: no payment/check-in writes, no schema work, and no PR4 slice leakage.

## PR3 Final Blocker Fix — Tests Run

- `npm run typecheck`
- `npx vitest run tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts`
- `npm run lint -- app/api/checkin/qr/bootstrap/route.ts lib/checkin/consecutive-offer.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts`

## PR3 Hardening Pass — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR3-Missing-Secret-Coverage | `tests/backend/qr-decision.contract.test.ts` | Integration | ✅ Existing QR backend contract suite already proved success and invalid-secret behavior | ✅ Added direct missing-secret coverage for `/internal/checkin/qr/decision` before touching supporting tests | ✅ `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/nest-gateway-qr-decision.test.ts` (7/7) | ✅ Covered success, missing secret, invalid secret, service delegation, controller delegation, and direct gateway POST request wiring | ✅ Kept production scope unchanged; hardening stayed test-only |

## PR3 Hardening Pass

- Added direct missing-secret coverage for `/internal/checkin/qr/decision`.
- Added focused QR gateway client coverage for route-flag defaults plus POST auth/body wiring.
- Added thin-file delegation coverage for `QrDecisionController` and `QrDecisionService` without expanding production scope.

## PR3 Hardening Pass — Tests Run

- `npm test -- tests/backend/qr-decision.contract.test.ts tests/api/nest-gateway-qr-decision.test.ts`
- `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts tests/api/nest-gateway-qr-decision.test.ts`
- `npm run typecheck`
- `npm run lint -- tests/backend/qr-decision.contract.test.ts tests/api/nest-gateway-qr-decision.test.ts tests/api/checkin-qr-bootstrap.test.ts apps/backend/src/checkin/qr-decision.controller.ts apps/backend/src/checkin/qr-decision.service.ts lib/checkin/qr-decision.ts lib/nest-gateway/client.ts`
- `npx vitest run tests/api/checkin-qr-bootstrap.test.ts tests/backend/qr-decision.contract.test.ts tests/api/nest-gateway-qr-decision.test.ts --coverage`

## PR3 Resilience Follow-Up — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR3-Consecutive-Optional-Failure | `tests/api/checkin-qr-bootstrap-consecutive.test.ts` | Integration | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts tests/api/nest-gateway-qr-decision.test.ts tests/backend/qr-decision.contract.test.ts` (29/29 baseline) | ✅ Added a failing terminal bootstrap assertion for a thrown promo lookup before touching QR decision code | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts tests/api/nest-gateway-qr-decision.test.ts tests/backend/qr-decision.contract.test.ts` (33/33) | ✅ Kept existing offer-present and offer-absent cases alongside the new thrown-lookup case so both success and degraded paths execute | ✅ Wrapped only the optional consecutive-offer read so core bootstrap data still fails loudly when required reads break |
| PR3-Gateway-Response-Correlation | `tests/api/nest-gateway-qr-decision.test.ts`, `tests/api/checkin-qr-bootstrap.test.ts` | Unit + Integration | ✅ Same 29/29 baseline suite before gateway/parser changes | ✅ Added mismatched success-payload tests first at the gateway layer and public-route layer | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts tests/api/nest-gateway-qr-decision.test.ts tests/backend/qr-decision.contract.test.ts` (33/33) | ✅ Covered both direct gateway rejection and public-route legacy fallback when course slot or customer identity do not match the request | ✅ Kept the validation at the shared QR gateway contract seam so later callers inherit it automatically |
| PR3-Backend-Malformed-Body | `tests/backend/qr-decision.contract.test.ts` | Integration | ✅ Same 29/29 baseline suite before backend handler changes | ✅ Added malformed JSON coverage for `/internal/checkin/qr/decision` before changing the request handler | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts tests/api/nest-gateway-qr-decision.test.ts tests/backend/qr-decision.contract.test.ts` (33/33) | ✅ Complements existing success/missing-secret/invalid-secret coverage with a bad-body path | ✅ Kept the backend handler response small and local: invalid JSON now returns a bounded 400 instead of bubbling a parser exception |

## PR3 Resilience Follow-Up

- Optional consecutive-offer lookups now degrade to `consecutiveOffer: null` instead of aborting the entire QR bootstrap flow.
- The shared QR gateway parser now rejects Nest 200 responses whose `context.courseSlug`, `context.date`, `context.time`, or `customer.userId` do not match the original request, forcing the public route back to the legacy Next decision path.
- `/internal/checkin/qr/decision` now returns a bounded `400 { error: "Invalid JSON body" }` response for malformed JSON instead of leaking a raw parser failure.

## PR3 Resilience Follow-Up — Tests Run

- `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-bootstrap-consecutive.test.ts tests/api/nest-gateway-qr-decision.test.ts tests/backend/qr-decision.contract.test.ts` (baseline 29/29, green 33/33)

## PR3 Final Risk Warning Follow-Up — TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR3-Duration-Correlation | `tests/api/nest-gateway-qr-decision.test.ts`, `tests/api/checkin-qr-bootstrap.test.ts` | Unit + Integration | ✅ `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/nest-gateway-qr-decision.test.ts` (20/20 baseline) | ✅ Added duration-mismatch rejection tests first at the gateway layer and public fallback layer | ✅ `npm test -- tests/api/nest-gateway-qr-decision.test.ts tests/api/checkin-qr-bootstrap.test.ts` (22/22) | ✅ Existing matching-duration success coverage plus new mismatched-duration fallback coverage now exercise both branches | ✅ Kept the fix in the shared QR correlation matcher so all callers inherit it automatically |

## PR3 Final Risk Warning Follow-Up

- The shared QR gateway correlation matcher now rejects Nest 200 responses when `context.durationMinutes` disagrees with the original request, even if `courseSlug`, `date`, `time`, and `customer.userId` still match.
- Added focused regression coverage at both the shared gateway client layer and the public QR bootstrap fallback layer so mismatched duration responses fall back to the legacy Next decision path.

## PR3 Final Risk Warning Follow-Up — Tests Run

- `npm test -- tests/api/checkin-qr-bootstrap.test.ts tests/api/nest-gateway-qr-decision.test.ts` (baseline 20/20, RED: 20/22, GREEN: 22/22)
- `npm run typecheck`
- `npm run lint -- lib/nest-gateway/contracts/checkin-qr-decision.ts tests/api/nest-gateway-qr-decision.test.ts tests/api/checkin-qr-bootstrap.test.ts`

## Next Slice

- Phase 4 / PR 4: implement the kiosk platform gate and terminal connection-token slice without mixing PaymentIntent orchestration or authoritative purchase/attendance writes.
- Reuse the shared QR/today-classes fallback seams and route-specific flag pattern for the connection-token route.
