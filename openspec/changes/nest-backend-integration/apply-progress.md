# Apply Progress: Nest Backend Integration

## Slice

- Delivery mode: force-chained
- Chain strategy: feature-branch-chain
- Current slice: PR 1 / Foundation

## Completed Tasks

- [x] 1.1 Added backend and gateway health tests for contract, timeout, flag-off fallback, and auth headers.
- [x] 1.2 Added the minimal backend skeleton and internal health gateway client.
- [x] 1.3 Extracted shared gateway config, auth, fallback, route-flag, and fallback observability helpers.
- [x] 1.4 Documented the kiosk Stripe Terminal bridge feasibility gate and native fallback policy.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/backend/internal-health.contract.test.ts`, `tests/api/nest-gateway-health.test.ts` | Integration + Unit | ✅ 13/13 baseline tests | ✅ Added fallback observability assertions before changing gateway code | ✅ `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (15/15) | ✅ Route seam, 401/403, 5xx, malformed payload, network rejection, timeout, and flag-off/missing-config observability | ✅ Kept the request seam minimal while expanding failure evidence |
| 1.2 | `tests/backend/internal-health.contract.test.ts`, `tests/api/nest-gateway-health.test.ts` | Integration + Unit | ✅ 13/13 baseline tests | ✅ Existing slice RED already recorded; follow-up RED added first for runtime hardening gaps | ✅ `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (15/15) | ✅ Health route still proves success path while gateway hardening preserves current foundation scope | ✅ Backend scaffold remains intentionally minimal; no PR2 delegation leaked in |
| 1.3 | `tests/api/nest-gateway-health.test.ts` | Unit | ✅ 13/13 baseline tests | ✅ Added route-flag and reporter assertions before touching config/client code | ✅ `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts` (15/15) | ✅ Added `today-classes` flag defaults, internal-health flag override, expected fallback classification, timeout/status metadata | ✅ Extracted a dedicated observability seam instead of bloating the client |
| 1.4 | `apps/kiosk-native/spikes/terminal-bridge.md` | Documentation spike | N/A (new) | ✅ Written | ➖ Not executable code | ➖ Single decision artifact | ✅ Clean |

## Corrective Work

- Replaced the implementation-centric backend health assertion with a request-level seam that proves `GET /internal/health` is registered and returns the required payload.
- Added gateway fallback coverage for unauthorized responses, generic upstream failures, malformed success payloads, fetch/network rejection, and trailing-slash base URLs.
- Reconciled `tasks.md` delivery metadata so the chained delivery decision matches the recorded Slice 1 execution path.
- Added a lightweight fallback reporter seam that records route name, reason, timeout, request correlation id, expected-vs-unexpected fallback, and status class when the upstream returned an HTTP status.
- Added route-specific gateway flag scaffolding in PR1 so future PR2 work can enable `today-classes` independently while the global kill switch still short-circuits all routes.

## Review Strategy

- Implementation reviewer focus: `apps/backend/src/**`, `lib/nest-gateway/**`, `tests/backend/internal-health.contract.test.ts`, `tests/api/nest-gateway-health.test.ts`, and `apps/kiosk-native/spikes/terminal-bridge.md`.
- OpenSpec artifacts remain in PR1 because this repo uses them as source of truth, but reviewers should treat them as supporting/planning diff separate from the implementation review budget.
- If the PR description needs extra guidance, call out two counts: the implementation/test/spike slice (foundation + hardening) versus the OpenSpec artifact diff, and explicitly state that PR2 starts at `today-classes` route delegation.

## Tests Run

- `npm test -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts`
- `npm test -- tests/api/nest-gateway-health.test.ts` (RED → GREEN cycle for the hardening follow-up)
- `npm run typecheck`
- `npm run lint -- tests/backend/internal-health.contract.test.ts tests/api/nest-gateway-health.test.ts apps/backend/src/main.ts lib/nest-gateway/client.ts lib/nest-gateway/config.ts lib/nest-gateway/auth.ts lib/nest-gateway/fallback.ts lib/nest-gateway/observability.ts`
- `npm install` was required first because the isolated worktree did not have `node_modules`, causing initial `vitest` and `tsc` command-not-found failures.

## Risks

- The backend files are still a minimal TypeScript scaffold rather than a real Nest runtime bootstrap; the new request seam proves route registration behavior for PR1, but full Nest package wiring remains deferred.
- Route-level gateway integration is intentionally deferred to Phase 2 to keep this slice within the review budget and preserve current public behavior.
- The new reporter currently defaults to lightweight console warning output; if operations later need structured sinks, wire the same seam instead of coupling PR2+ routes directly to a vendor SDK.

## Next Slice

- Phase 2 / PR 2: gate `app/api/checkin/terminal/today-classes/route.ts` through the gateway client while preserving the existing contract.
- Before PR2 expands delegation, reuse the PR1 route-flag and reporter seams rather than creating route-specific logging logic inside the delegated handler.
