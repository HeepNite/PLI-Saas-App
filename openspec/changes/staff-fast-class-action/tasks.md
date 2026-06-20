# Tasks: Staff Fast Class Action

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550-850 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 helper + API, PR 2 UI wiring |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared current-class helper + staff fast-action endpoint/tests | PR 1 | No UI dependency beyond API contract. |
| 2 | Staff card adaptive button + promo modal/tests | PR 2 | Depends on PR 1 API response. |

## Phase 1: Foundation / RED Tests

- [x] 1.1 Add failing tests for terminal current-class resolver in `tests/checkin/terminal-current-class.test.ts`.
- [ ] 1.2 Add failing API tests for Fast Pay, Fast Sign-in, promo accept, idempotency, and unauthorized calls.
- [ ] 1.3 Add failing UI tests for `Fast Pay` / `Fast Sign-in` labels and `Prov PIN` label.

## Phase 2: Current-Class Helper

- [x] 2.1 Create `lib/checkin/terminal-current-class.ts` with today-class loading and current-class selection.
- [x] 2.2 Update `app/api/checkin/terminal/today-classes/route.ts` to reuse the shared helper.
- [ ] 2.3 Align `StaffTerminalShell.tsx` current-class behavior with the shared resolver.

## Phase 3: Staff Fast Action API

- [x] 3.1 Create `app/api/staff/students/fast-class-action/route.ts` with `authorizeStudentOperationalRequest()` and rate limiting.
- [x] 3.2 Implement Fast Pay transaction: session, attendance, pending cash purchase, duplicate guard.
- [x] 3.3 Implement Fast Sign-in transaction: session, attendance, package reservation, package-credit purchase, duplicate guard.
- [x] 3.4 Implement promo offer lookup and promo acceptance transaction.

## Phase 4: Staff Card UI

- [ ] 4.1 Add the adaptive action button to both student-card render paths in `StaffStudentsBoardPanel.tsx`.
- [ ] 4.2 Add promo confirmation modal with `Staying for the next class?` copy.
- [ ] 4.3 Rename visible `Provisional PIN` button labels to `Prov PIN`.
- [ ] 4.4 Refresh the staff board after successful actions so balances/classes/packages update.

## Phase 5: Verification / Cleanup

- [ ] 5.1 Run focused API/helper/UI Vitest suites.
- [x] 5.2 Run changed-file ESLint, `npx tsc --noEmit`, and `git diff --check`.
- [ ] 5.3 Review diff size and split commits by work unit before push.
