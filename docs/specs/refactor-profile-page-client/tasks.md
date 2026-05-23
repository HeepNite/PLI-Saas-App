# Tasks: Refactor Profile Page Client (Behavior-Preserving Slices)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines (remaining) | 1,050–1,550 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR-A cards → PR-B right rail → PR-C modals → PR-D orchestrator/audit |
| Delivery strategy | ask-on-risk (preflight: ask-always) |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| A | Center cards extraction | PR-A | Base: tracker/main per orchestrator choice |
| B | `ProfileRightRail` extraction | PR-B | Depends on A wiring shape |
| C | Modal extractions | PR-C | Depends on A+B prop/callback boundaries |
| D | Final orchestrator cleanup + validation/audit | PR-D | Last mile, no behavior drift |

## Completed Baseline (Preserve as Done)

- [x] Slice 1 completed (`460c0cd`).
- [x] Slice 2 completed (`5349187`).
- [x] Slice 3 completed (`e0a8266`, `38dd358`, `59be4db`, `4c1b97a`, `98f100e`, `c9af131`, `8da2889`).
- [x] Simple presentational cards completed (`c7d769f`).
- [x] `ProfileLeftRail` completed (`3dfe4c7`).

## Phase 1: Center Cards (Unit A)

- [ ] 1.1 Create `sections/ProfileFormCard.tsx`; move profile form card JSX/copy only; keep handlers from `useProfileForm` passed as props.
- [ ] 1.2 Create `sections/StudentPinCard.tsx`; move PIN/recovery JSX; keep `useStudentPinForm` ownership unchanged.
- [ ] 1.3 Create `sections/AnalyticsCard.tsx`; move tabs/chart/donut JSX; keep active/hover state callbacks from orchestrator.
- [ ] 1.4 Create `sections/AgendaCard.tsx`; move agenda month/day UI; keep `useAgendaCalendar` derivations as input props.
- [ ] 1.5 Create `sections/AssignClassesCard.tsx`; move assign UI; keep add/remove/submit callbacks from `useAssignClassesFlow`.
- [ ] 1.6 Update `ProfilePageClient.tsx` imports/render for cards only; no rail/modal extraction yet.
- [ ] 1.7 Validate (slice): `npx tsc --noEmit` + `npx eslint components/front/profile/`.
- [ ] 1.8 Rollback boundary: revert Unit A commit only. Commit msg: `refactor(profile): extract center cards from ProfilePageClient`.

## Phase 2: Right Rail (Unit B)

- [ ] 2.1 Create `sections/ProfileRightRail.tsx`; move book/change/check-in/suspend-cancel/recent-requests UI without behavior changes.
- [ ] 2.2 Keep right-rail actions as callback props (open picker, open request modal, reschedule open, check-in submit).
- [ ] 2.3 Update `ProfilePageClient.tsx` to render `ProfileRightRail` and keep existing state/hook ownership.
- [ ] 2.4 Validate (slice): `npx tsc --noEmit` + `npx eslint components/front/profile/`.
- [ ] 2.5 Rollback boundary: revert Unit B commit only. Commit msg: `refactor(profile): extract ProfileRightRail section`.

## Phase 3: Modals (Unit C)

- [ ] 3.1 Create `modals/RescheduleModal.tsx`; move 3-step tree unchanged.
- [ ] 3.2 Create `modals/ActionRequestModal.tsx`; move suspend/cancel/reassign tree unchanged.
- [ ] 3.3 Create `modals/CoursePickerModal.tsx`; move preferred-first picker + `EnrollModal` handoff unchanged.
- [ ] 3.4 Wire modal components in `ProfilePageClient.tsx`; pass typed props/callbacks only.
- [ ] 3.5 Validate (slice): `npx tsc --noEmit` + `npx eslint components/front/profile/`.
- [ ] 3.6 Rollback boundary: revert Unit C commit only. Commit msg: `refactor(profile): extract reschedule/request/course-picker modals`.

## Phase 4: Orchestrator Cleanup + Validation/Audit (Unit D)

- [ ] 4.1 Remove now-dead inline JSX/helpers from `ProfilePageClient.tsx`; keep behavior/copy/contracts/security identical.
- [ ] 4.2 Verify thin orchestrator target (~250–400 LOC practical), with hooks still owning durable state.
- [ ] 4.3 Validation commands from `validation.md`: `npx tsc --noEmit`; `npx eslint components/front/profile/`; `npx vitest run`; `node scripts/run-playwright.mjs e2e/profile.spec.ts`.
- [ ] 4.4 Record pass/fail/blocked with first actionable error; note known repo-level Playwright blocker is outside `e2e/profile.spec.ts`.
- [ ] 4.5 Rollback boundary: revert Unit D commit only. Commit msg: `chore(profile): finalize ProfilePageClient orchestrator cleanup and validation audit`.
