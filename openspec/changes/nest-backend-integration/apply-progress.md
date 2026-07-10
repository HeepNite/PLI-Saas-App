# Apply Progress: Nest Backend Integration

## Slice

- Delivery mode: force-chained
- Chain strategy: feature-branch-chain
- Current slice: PR 2 / Low-Risk Gateway Proof

## Completed Tasks

- [x] 1.1 Added backend and gateway health tests for contract, timeout, flag-off fallback, and auth headers.
- [x] 1.2 Added the minimal backend skeleton and internal health gateway client.
- [x] 1.3 Extracted shared gateway config, auth, fallback, route-flag, and fallback observability helpers.
- [x] 1.4 Documented the kiosk Stripe Terminal bridge feasibility gate and native fallback policy.
- [x] 2.1 Extended `tests/api/checkin-terminal-today-classes.test.ts` with Nest-on, route-flag-off, and Nest-unavailable parity coverage.
- [x] 2.2 Added backend `today-classes` controller/service wiring and delegated the existing Next route through the Nest gateway client.
- [x] 2.3 Extracted shared `today-classes` DTO and error mapping contract helpers for both Next and backend paths.

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

## Next Slice

- Phase 3 / PR 3: extract QR bootstrap decision logic behind the same Next-as-BFF delegation pattern while keeping authoritative writes in Next.
- Reuse the shared gateway fallback + DTO pattern for QR responses instead of duplicating route-specific contract mapping.
