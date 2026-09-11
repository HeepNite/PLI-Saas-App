# Archive Report: Fast Pay Duplicate Pending Guard

**Change**: fast-pay-duplicate-pending-guard  
**Project**: pli-saas-app  
**Archive Date**: 2026-09-10  
**Archive Location**: `openspec/changes/archive/2026-09-10-fast-pay-duplicate-pending-guard/`

---

## Change Summary

The change implements a slot-identity resolver for staff Fast Pay (`POST /api/staff/students/fast-class-action`) and its consecutive-promo path (`createPromoCash`) to guard against duplicate `Purchase` creation. The resolver:

- Matches slot identity as `(userId, courseSlug, metadata.date, metadata.time)` OR by `metadata.attendanceId`, independent of payment channel
- Prioritizes: existing paid purchase (any channel) → block with 409 `completed_purchase`; existing cash-processable pending → reuse and backfill `attendanceId`; card-in-flight and terminal statuses (`failed`, `refunded`, `expired`) → ignored
- Runs twice (pre-check, then inside serializable transaction) to catch races where a concurrent customer checkout completes during Fast Pay
- Backfills `metadata.attendanceId` on reused rows so they can participate in board slot dedup

This change closes issue #443 (type: bug, status: approved) and was delivered via two stacked PRs: #444 (resolver + main POST path, 309 changed lines) and #445 (createPromoCash path, 146 changed lines).

---

## Final State at Archive (Per Orchestrator-Provided Facts)

### Implementation Delivery

**Code delivered on branch**: `fix/fast-pay-duplicate-pending-guard`  
**Commits**:
- `577af43`: Resolver + pre-check + main POST path (225+/84-)
- `21144c6`: `createPromoCash` path (93+/53-)

**GitHub PRs** (both open, not yet merged at archive time):
- PR #444: `fix/fast-pay-duplicate-pending-guard` → `main` (Work Unit 1, 309 changed lines)
- PR #445: `fix/fast-pay-duplicate-pending-guard-promo` → `fix/fast-pay-duplicate-pending-guard` (Work Unit 2, 146 changed lines)

### Verification Outcome

**Report observation**: `verify-report.md` (dated 2026-09-10, 15:44 UTC)

| Metric | Result |
|--------|--------|
| Verdict | `pass_with_warnings` |
| Blockers | 0 |
| Critical findings | 0 |
| Requirements met | 7/7 |
| Scenarios passed | 12/12 |
| Test suite (focused) | 20/20 ✅ |
| Regression suite (wide) | 997/997 ✅ |
| Build (`npx tsc --noEmit`) | ✅ Clean |
| Linter (`eslint`) | 0 errors, 3 pre-existing warnings |
| Coverage (changed file) | 96.8% lines / 75% branch |

**Spec compliance**: All 11 requirements fully COMPLIANT at runtime; 1/12 scenarios PARTIAL (test passes but only proves the `findMany` where-clause shape because a mocked unit test cannot simulate DB-level filtering of excluded statuses — this is legitimate; enforcement is exercised in live Postgres, out of scope for unit tests). Reported as WARNING, not CRITICAL.

**Review approval**: Candidate reviewed under lineage `review-345856245df9b50e`, lens `review-reliability`, outcome `approved`, acknowledgement burned (`gentle-ai.review-acknowledged/v1`).

### Task Completion

Per final-state facts, all implementation work is complete:

| Phase | Tasks | Status | Notes |
|-------|-------|--------|-------|
| Phase 1: Shared Slot Resolver | 1.1–1.3 | ✅ Complete | Helpers imported, compiled, not yet wired |
| Phase 2: Main POST Path | 2.1–2.7 | ✅ Complete | Resolver wired, block/reuse/create logic tested |
| Phase 3: `createPromoCash` Path | 3.1–3.4 | ✅ Complete | Same resolver wired to promo path, tests green |
| Phase 4.1–4.4: Delivery (Commits & PRs 1-2) | 4.1–4.4 | ✅ Complete | Two commits on branch; PR #444 and #445 open |
| Phase 4.5: Propagation to `codex/develop` | 4.5 | ⏸️ **Pending** | Will be done by orchestrator after archive closes; carries combined route.ts/test change + openspec folder per `openspec/config.yaml` `persistence.target_branch` |
| Phase 4.6: Verify on `codex/develop` | 4.6 | ⏸️ **Blocked** | Depends on 4.5 completion |

All implementation tasks (1.1–3.4) are marked `[x]` in the archived `tasks.md`. Delivery tasks 4.1–4.4 are marked `[x]` per the final-state facts. Task 4.5 is marked `[ ]` with a note that it is pending propagation by the orchestrator.

### Production Data Repair

Per final-state facts: Production data for the two affected students (Richmond, Christian) was manually repaired on 2026-09-08 before this change landed. The change closes the creation path that exposed the bug but does not apply retroactive fixes; the repair was performed as a one-time correction outside of SDD.

---

## Spec Sync

### Delta Spec Integration

**Domain**: `staff-fast-class-payment`  
**Spec location**: `openspec/specs/staff-fast-class-payment/spec.md`  
**Source**: Delta spec copied from `openspec/changes/archive/2026-09-10-fast-pay-duplicate-pending-guard/specs/staff-fast-class-payment/spec.md`  
**Action**: New capability (main spec did not exist; spec is a full specification, not a delta)  
**Composition**: Mechanical copy (shell `cp -R`, verified with `diff -r`, empty diff = byte-identical)

**Spec contents** (7 requirements, 12 scenarios):
1. **Slot Identity Resolution** — Match on `(userId, courseSlug, metadata.date, metadata.time)` or `attendanceId`, independent of channel
2. **Reuse Existing Pending Purchase** — Cash-processable open rows reused with `attendanceId` backfill; card-in-flight ignored
3. **Block on Existing Paid Purchase** — Any paid row (any channel) returns 409 `completed_purchase`
4. **Ignore Terminal Failed Purchases** — `failed`, `refunded`, `expired` excluded from reuse and block
5. **Transactional Concurrency Safety** — Re-read inside serializable transaction to catch mid-flight state changes
6. **Preview and Fast Sign-In Modes Unaffected** — `previewOnly` short-circuits; `fast_sign_in` uses package-credit unaffected
7. **Security Boundary Unchanged** — `withStaffGuard` runs first, no new endpoint

All requirements implemented and verified.

---

## Archive Contents

✅ **Complete archive package**:
- `proposal.md` — Business intent, scope, risks, rollback plan
- `exploration.md` — Code investigation and context-setting
- `specs/staff-fast-class-payment/spec.md` — Full specification (7 requirements, 12 scenarios)
- `design.md` — Technical approach, architecture decisions, data flow, file changes
- `tasks.md` — Phase-by-phase breakdown, completion status updated per final-state facts
- `apply-progress.md` — Intermediate snapshot of apply phase (TDD evidence, test counts, deviations, imports)
- `verify-report.md` — Verification report with test results, spec compliance matrix, coverage, regressions

**No missing artifacts.**

---

## Deferred Follow-Up

**Issue #410** — Board-side outstanding-balance dedup (out of scope for this change)

The `buildOutstandingBalanceByUser` query sums raw purchases while `dedupEnrichedPurchasesBySlot` hides same-slot duplicates in the rendered board. With this change, duplicates are prevented at creation time (except for card-in-flight, which is deliberately allowed), but the board-side summing logic remains unchanged. A future change should:
- Verify that `buildOutstandingBalanceByUser` queries only non-ignored statuses
- Consider whether to filter by `paymentChannel` to exclude card-in-flight from balance summing
- Test that reused purchases (with backfilled `attendanceId`) now collapse correctly in `dedupEnrichedPurchasesBySlot`

This is logged as a follow-up, not a blocker.

---

## Source of Truth Updated

The following specs now form the source of truth for this capability:

| File | Status |
|------|--------|
| `openspec/specs/staff-fast-class-payment/spec.md` | ✅ New (copied from delta) |

The specification is the authority for all future implementations or propagations to other branches.

---

## SDD Cycle Summary

| Phase | Outcome | Artifact Location |
|-------|---------|-------------------|
| **Propose** | ✅ Done | `proposal.md` |
| **Explore** | ✅ Done | `exploration.md` |
| **Spec** | ✅ Done | `specs/staff-fast-class-payment/spec.md` (now in main) |
| **Design** | ✅ Done | `design.md` |
| **Tasks** | ✅ Done | `tasks.md` (completion marked per final-state facts) |
| **Apply** | ✅ Done | Two commits, two PRs open (4.1–4.4 complete) |
| **Verify** | ✅ Done | `verify-report.md` (pass_with_warnings, no blockers) |
| **Archive** | ✅ Done | Archived to `openspec/changes/archive/2026-09-10-fast-pay-duplicate-pending-guard/` |

**Status**: The change is fully planned, implemented, verified, and archived. Ready for the next change.

---

## Archive Readiness Checklist

- [x] Main specs synced (new capability, spec copied mechanically)
- [x] Change folder moved to archive with ISO date prefix
- [x] All artifacts present (proposal, specs, design, tasks, apply-progress, verify-report)
- [x] Source folder removed (no double-tracking)
- [x] Archive diff verified empty (byte-identical to source)
- [x] Implementation tasks marked complete (4.1–4.4 via final-state facts)
- [x] Delivery tasks updated (4.5 marked pending with note, 4.6 marked blocked)
- [x] No CRITICAL issues in verify-report
- [x] No unchecked implementation tasks
- [x] Final-state facts incorporated (two commits, PRs #444/#445, review approved, data repaired)
- [x] Deferred follow-up documented (issue #410)

---

## Archive Audit Trail

**Archive composed by**: sdd-archive executor  
**Archive date**: 2026-09-10  
**Archive location**: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-worktrees/fast-pay-duplicate-pending-guard/openspec/changes/archive/2026-09-10-fast-pay-duplicate-pending-guard/`  
**Artifact store mode**: openspec (specs + change folder filesystem operations)  
**Persistence**: Archive report saved to Engram topic `sdd/fast-pay-duplicate-pending-guard/archive-report`

This archive report is the terminal record of the cycle. It describes the state of the change at close, not at intermediate points. Future readers consulting the archive will find the exact scope, implementation, verification, and reasoning as they stood at completion.
