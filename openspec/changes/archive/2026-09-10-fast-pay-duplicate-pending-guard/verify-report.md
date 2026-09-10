```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2712511cce964503ff2b8bdd70badb7ac3d094b49099837796609787d4fb323a
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 12/12
test_command: npx vitest run tests/api/staff-fast-class-action.test.ts
test_exit_code: 0
test_output_hash: sha256:735112615cdb932bd40d04a8f2b336f0c7346b42f1c4bccae43e15507ef92018
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: fast-pay-duplicate-pending-guard
**Version**: N/A (unversioned openspec change)
**Mode**: Strict TDD

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (Phase 1-3, in scope) | 17 |
| Tasks complete | 17 |
| Tasks incomplete (Phase 4, delivery — explicitly out of scope for this apply batch) | 6 |

Phase 4 (4.1–4.6, delivery/PRs/propagation) is intentionally unchecked; apply-progress.md and the orchestrator scope both state Phase 4 is out of scope for this apply batch. This is not flagged as a failure per the orchestrator's explicit instruction.

### Build & Tests Execution
**Build**: ✅ Passed
```text
$ npx tsc --noEmit
(no output, exit 0)
```

**Tests**: ✅ 20 passed / 0 failed / 0 skipped (focused) — ✅ 997 passed / 0 failed / 0 skipped (wide regression pass)
```text
$ npx vitest run tests/api/staff-fast-class-action.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)

$ npx vitest run tests/api components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx
 Test Files  99 passed (99)
      Tests  997 passed (997)
```

**Coverage** (changed file, `route.ts`, v8 provider): 96.8% lines / threshold not configured → ✅ Above informal 80% bar for lines; ⚠️ branch coverage 75% is below the 80% acceptable bar (see Changed File Coverage below).

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Slot Identity Resolution | Web cash pending purchase matches without an attendanceId | `staff-fast-class-action.test.ts:209` `reuses a web cash-pending purchase and backfills attendanceId` | ✅ COMPLIANT |
| Reuse Existing Pending Purchase | Repeat Fast Pay press reuses instead of blocking | `staff-fast-class-action.test.ts:132,289` | ✅ COMPLIANT |
| Reuse Existing Pending Purchase | Web cash pending purchase is reused and backfilled | `staff-fast-class-action.test.ts:209` | ✅ COMPLIANT |
| Reuse Existing Pending Purchase | Promo add-on reuses its pending purchase | `staff-fast-class-action.test.ts:506` `does not duplicate promo attendance or charge when accepted promo is repeated` | ✅ COMPLIANT |
| Reuse Existing Pending Purchase | Card payment still in flight is ignored | `staff-fast-class-action.test.ts:235,583` | ✅ COMPLIANT |
| Block on Existing Paid Purchase | Stripe-paid slot blocks Fast Pay | `staff-fast-class-action.test.ts:155` | ✅ COMPLIANT |
| Block on Existing Paid Purchase | Package-credit-paid slot blocks Fast Pay | `staff-fast-class-action.test.ts:173` | ✅ COMPLIANT |
| Ignore Terminal Failed Purchases | Terminal purchase neither blocks nor is reused | `staff-fast-class-action.test.ts:250` `excludes failed, refunded, and expired purchases ... via the findMany where clause` | ⚠️ PARTIAL — see note below |
| Transactional Concurrency Safety | Concurrent self-checkout completes during Fast Pay | `staff-fast-class-action.test.ts:311` `blocks Fast Pay via a mid-transaction race when the purchase becomes paid before commit` | ✅ COMPLIANT |
| Preview and Fast Sign-In Modes Unaffected | previewOnly short-circuits before any write | `staff-fast-class-action.test.ts:155,439` | ✅ COMPLIANT |
| Preview and Fast Sign-In Modes Unaffected | Fast Sign-In bypasses the purchase guard | `staff-fast-class-action.test.ts:262` `consumes package credit for Fast Sign` | ✅ COMPLIANT |
| Security Boundary Unchanged | Unauthenticated request is rejected before classification | `staff-fast-class-action.test.ts:101` `rejects unauthorized staff before mutating` | ✅ COMPLIANT |

**Compliance summary**: 11/12 scenarios fully COMPLIANT at runtime, 1/12 PARTIAL (test passes but proves the enforcement mechanism, not the full end-to-end row-level outcome — see WARNING below).

**Note on the PARTIAL scenario**: the "excludes failed, refunded, and expired purchases" scenario is proven only by asserting the `findMany` `where.status.notIn` clause shape (route.ts:46). This is disclosed by apply-progress.md as an intentional deviation: `isPendingProcessablePurchase` does not itself exclude these statuses in JS — exclusion is enforced entirely by the Prisma-level `notIn` filter, which mocked `findMany` does not apply. A mocked unit test therefore cannot honestly simulate "row present in DB, excluded by query" without asserting the query shape. This is a legitimate unit-test-layer limitation (the real enforcement is exercised only against a live Postgres instance, out of scope for this test file), not a missing test. It is reported as a WARNING, not CRITICAL, because a passing runtime test does exist and does prove the exact mechanism that produces the required behavior.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Slot Identity Resolution | ✅ Implemented | `buildSlotPurchaseWhere` (route.ts:43-54) matches on `userId`+`courseSlug`+date/time OR `attendanceId`, independent of `paymentChannel` |
| Reuse Existing Pending Purchase | ✅ Implemented | `resolveSlotPurchase` (route.ts:61-71) + `backfillAttendanceId` (route.ts:73-80), wired at all 3 call sites |
| Block on Existing Paid Purchase | ✅ Implemented | `isSettledPurchase` (route.ts:57-59) checked before reuse in `resolveSlotPurchase`; precedence paid → reuse → create |
| Ignore Terminal Failed Purchases | ✅ Implemented | `IGNORED_PURCHASE_STATUSES` (route.ts:23-24) applied via `status: { notIn: ... }` (route.ts:46) |
| Transactional Concurrency Safety | ✅ Implemented | `resolveSlotPurchase(tx, ...)` re-run inside `runSerializableTransaction` (route.ts:302-303, 210-211) |
| Preview and Fast Sign-In Modes Unaffected | ✅ Implemented | Pre-check (route.ts:273-276) runs before `previewOnly` short-circuit (route.ts:278-280); `fast_sign_in` branch (route.ts:295-300) never calls `resolveSlotPurchase` |
| Security Boundary Unchanged | ✅ Implemented | `withStaffGuard` (route.ts:238-243) unchanged; guard runs first, no new endpoint |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Resolver placement: module-local in `route.ts` | ✅ Yes | No new `lib/` module added |
| Query shape: `findMany` + reduce in JS | ✅ Yes | route.ts:61-71 |
| Paid classification: status OR `settlementStatus`, any channel | ✅ Yes | route.ts:57-59 |
| Reuse eligibility: `isPendingProcessablePurchase` from `payments/shared.ts` | ✅ Yes | route.ts:12,69 — reuses the board's own definition, not a bespoke one |
| Ignored statuses: `failed`, `refunded`, `expired` | ✅ Yes | route.ts:24 |
| `"expired"` as local literal with comment (not added to `PURCHASE_STATUS`) | ✅ Yes | route.ts:23-24 |
| Mid-transaction abort via `throw new Error(COMPLETED_PURCHASE_ERROR)` | ✅ Yes | route.ts:303/311-316 (POST), 211/228-233 (`createPromoCash`) |
| `pending_payment` code no longer emitted; `PENDING_PAYMENT_MESSAGE` deleted | ✅ Yes | No `PENDING_PAYMENT_MESSAGE`/`pending_payment` reference remains in route.ts; only surviving references are the pre-existing `string`-widened type in `studentsBoardTypes.ts:19` and an unrelated board-panel test fixture — neither is a route consumer of the removed code path |
| Backfill write pattern matches existing `metadata` spread idiom | ✅ Yes | route.ts:73-80 |
| All 3 call sites share one `resolveSlotPurchase` | ✅ Yes | `resolveExistingClassPurchaseBlock` (149), `POST` tx (302), `createPromoCash` tx (210) |

**Design deviations** (both disclosed in apply-progress.md, neither breaks a spec requirement):
1. Import source correction: `isCompletedPaymentStatus`/`normalizeSettlementStatus` come from `@/app/api/staff/payments/shared`, not `@/lib/payment-constants` as tasks.md worded it — confirmed correct against actual module locations (`lib/payment-constants.ts` holds only constants).
2. "Refunded/expired ignored" scenario folded into the where-clause assertion test rather than a standalone behavioral case, for the reason explained in the Spec Compliance Matrix note above.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Found in apply-progress.md "TDD Cycle Evidence" table |
| All tasks have tests | ✅ | 3/3 task groups (1.1-1.3, 2.1-2.6, 3.1-3.3) map to `tests/api/staff-fast-class-action.test.ts` |
| RED confirmed (tests exist) | ✅ | Test file exists at the reported path; 13 new/rewritten cases verified present in the file read directly |
| GREEN confirmed (tests pass) | ✅ | 20/20 pass on independent re-execution |
| Triangulation adequate | ✅ | WU1: 8 new/rewritten cases (paid×3 channels, reuse+backfill, already-linked, card-ignore, where-clause, mid-tx race); WU2: 3 cases (reuse, block, card-ignore) |
| Safety Net for modified files | ✅ | Reported progression 14/14 → 19/19 → 20/20 baseline counts is consistent with the final 20/20 total |

**TDD Compliance**: 6/6 checks passed

---

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 20 | 1 | vitest, `vi.mock` (Prisma client mocked; no render/HTTP/browser) |
| Integration | 0 | 0 | not applicable — route unit tests exercise the transaction path directly |
| E2E | 0 | 0 | not installed for this route |
| **Total** | **20** | **1** | |

---

### Changed File Coverage
| File | Line % | Branch % | Func % | Uncovered Lines | Rating |
|------|--------|----------|--------|-----------------|--------|
| `app/api/staff/students/fast-class-action/route.ts` | 96.8% | 75% | 100% | L95, L102, L232, L315 | ⚠️ Acceptable (branch below 80%) |

**Average changed file coverage**: 96.8% lines / 75% branch
Uncovered lines are defensive/unreachable fallbacks: L95 (`runSerializableTransaction`'s final-attempt throw, unreachable because the retry loop never exhausts in tests), L102 (`parseBody`'s JSON-parse-failure catch), L232 (`createPromoCash`'s non-`COMPLETED_PURCHASE_ERROR` rethrow), L315 (`POST`'s non-`COMPLETED_PURCHASE_ERROR` rethrow). None of these four lines belong to the reuse/block/create logic this change introduces — all are pre-existing error-handling scaffolding not exercised by design.

---

### Assertion Quality
**Assertion quality**: ✅ All assertions verify real behavior — no tautologies, ghost loops, empty-collection-only checks, or CSS/implementation-detail assertions found. Every reuse/block/create test asserts on response status, response body shape, and specific mock call arguments (`purchase.create`/`purchase.update` called-or-not, with expected `data`/`where` shape) — all behavioral, not structural.

---

### Quality Metrics
**Linter**: ⚠️ 3 pre-existing warnings, 0 errors — `buildRateLimitKey`, `getClientIp`, `staffAuth` unused (present before this change per apply-progress.md; unrelated to the reuse/block/create logic)
**Type Checker**: ✅ No errors (`npx tsc --noEmit` clean)

### Regression Sniff
- `resolveExistingClassPurchaseBlock` and `createPromoCash` are module-local (unexported) to `route.ts`; no external callers found in `app/`, `components/`, `lib/`, or `tests/`.
- No remaining `purchase.findFirst` call sites in `route.ts` or its test file — all three call sites fully migrated to `resolveSlotPurchase`/`findMany`.
- No remaining runtime emission of `pending_payment`/`PENDING_PAYMENT_MESSAGE` in `route.ts`. The only surviving references are `components/front/staff/studentsBoardTypes.ts:19` (a pre-existing `code?: "pending_payment" | "completed_purchase" | string` union — widened type, not a runtime dependency) and a board-panel test fixture (`StaffStudentsBoardPanel.test.tsx:760`) that exercises the board's own rendering of an arbitrary `code` string, not this route. Both pass unchanged in the 997-test regression run.
- `git diff origin/main..HEAD --stat`: 2 files changed, 316 insertions(+), 135 deletions(-) — matches apply-progress.md's reported combined diff.

### Issues Found
**CRITICAL**: None

**WARNING**:
1. Spec scenario "Terminal purchase neither blocks nor is reused" is proven only at the query-shape level (asserting the `findMany` where-clause), not with a full behavioral row-level test, because mocked Prisma does not apply `notIn` filtering. This is disclosed and intentional (apply-progress.md deviation #2); consider a real-DB integration test as a follow-up if this path is ever suspected to regress.
2. Branch coverage on the changed file is 75%, below the informal 80% acceptable bar (line coverage is 96.8%). The four uncovered branches are pre-existing defensive/unreachable error paths, not new reuse/block/create logic.
3. 3 pre-existing ESLint unused-variable warnings on `route.ts` (`buildRateLimitKey`, `getClientIp`, `staffAuth`) — present before this change, not introduced by it, and not remediated.

**SUGGESTION**:
1. `IGNORED_PURCHASE_STATUSES`'s `"expired"` string literal (route.ts:23-24) duplicates knowledge that `PURCHASE_STATUS` doesn't yet encode; design.md's own Open Questions section already flags this as a deferred follow-up (adding `EXPIRED` to `PURCHASE_STATUS`), not a defect in this change.
2. design.md's Open Questions also flag that a card-pending row is deliberately left un-deduplicated against a newly-created cash-pending row on the same slot — an accepted tradeoff, not an implementation gap.

### Verdict
PASS WITH WARNINGS
All 12 spec scenarios have a passing runtime test (11 fully behavioral, 1 proven at the query-enforcement level per a disclosed unit-test-layer limitation); build, focused tests, and the 997-test wide regression pass all pass; 3 WARNING-level issues are informational only and block nothing.
