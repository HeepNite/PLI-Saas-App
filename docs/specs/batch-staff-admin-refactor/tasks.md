# Tasks: batch-staff-admin-refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,800–2,900 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1→PR2→PR3→PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Container boundary + rooms seam hardening | PR1 | Base = feature branch |
| 2 | Profile/settings + catalog shell extraction | PR2 | Base = PR1 branch |
| 3 | Compat re-export migration + brittle tests | PR3 | Base = PR2 branch |
| 4 | Final cleanup/evidence/doc pass | PR4 | Base = PR3 branch |

## Phase 1: Baseline + Boundary Lock
- [x] 1.1 Record completed slices baseline in spec artifacts and keep behavior-preserving scope explicit.
- [x] 1.2 Define target `StaffUsersAdminClient` shell boundary and expected domain hook/presentational splits in docs.
- [x] 1.3 Validation (docs-only): `npx markdownlint "docs/specs/batch-staff-admin-refactor/*.md"` (or repo-equivalent markdown check).

## Phase 2: Batch Roadmap Authoring
- [x] 2.1 Create `roadmap.md` with 4 executable batches; each batch includes objective, modules, line budget, validation, rollback, and commit-message suggestions.
- [x] 2.2 Include explicit cleanup policy and delete-vs-report rule in roadmap/design/tasks alignment.
- [x] 2.3 Include logic-simplification policy (early returns, typed field updaters, no mega-utils).

## Phase 3: Tasks Realignment for Apply
- [x] 3.1 Rewrite task checklist into larger coherent batches (2–5 slices), not micro-steps.
- [x] 3.2 Ensure every batch has local-first validations and explicit rollback boundary.
- [x] 3.3 Ensure chain boundaries are explicit for feature-branch-chain bases.

## Phase 4: Persistence + Handoff
- [x] 4.1 Persist updated spec/design/tasks/roadmap summaries to Engram topics for this change.
- [x] 4.2 Handoff next apply batch recommendation with workload/risk forecast.

## Apply Execution Progress

### Batch 1 — Container Boundary + Rooms Domain Hardening
- [x] B1.1 Extract current/upcoming reservation rows into a presentational component (`StaffRoomReservationList.tsx`) while preserving copy/classes/actions.
- [x] B1.2 Keep reservation API, validation, permission, and container state ownership in `StaffUsersAdminClient.tsx`; tighten list props to render-only concerns.
- [x] B1.3 Stabilize rooms lifecycle source-contract assumptions by asserting reservation form/list source markers in extracted modules and endpoint/callback wiring in container.
- [ ] B1.4 Remove stale room-specific code only with conclusive unused evidence (deferred in this batch).

### Batch 2 — Profile/Settings + Catalog Presentational Split
- [x] B2.1 Extract profile payment section shell into `StaffProfilePaymentSection.tsx` while preserving payment form behavior/copy/classes and submission flow ownership in container.
- [x] B2.2 Extract profile request layout boundary into `StaffProfileRequestsSection.tsx` while preserving create/history request behavior and aria-visible structure.
- [x] B2.3 Extract school/catalog header+KPI shell into `StaffCatalogSection.tsx` and keep wizard/content internals owned by `StaffUsersAdminClient.tsx`.
- [x] B2.4 Keep no-touch guard for consecutive-course-link internals (no behavior/logic changes in consecutive-link flows).

### Batch 3 — Compat Re-export Migration + Test Contract Cleanup
- [x] B3.1 Migrate helper test imports from `StaffUsersAdminClient.tsx` compatibility seams to dedicated helper modules (`paymentState`, `paymentTimelineTransforms`, `studentPaymentCardFormatters`, `staffRoomCatalogHelpers`) where safe.
- [x] B3.2 Remove temporary compatibility re-exports from `StaffUsersAdminClient.tsx` only after proving no remaining named imports rely on them.
- [x] B3.3 Keep brittle source-string tests unchanged unless directly required for this import-path migration (no broad test strategy rewrite).

### Batch 4 — Final Evidence-Gated Cleanup + Architecture Lock
- [x] B4.1 Remove only proven stale imports/exports/types/constants in staff refactor modules with objective evidence from lint/search.
- [x] B4.2 Confirm architecture lock guardrails in design/roadmap/tasks and keep behavior-preserving boundaries explicit.
- [x] B4.3 Run local validation set (eslint changed files, staff/admin focused tests including rooms lifecycle/fetch-cache, full `tsc`) and report baseline vs new failures.

### Batch 5 — Payments Domain Hook Extraction
- [x] B5.1 Extract payments-admin bounded context into `components/front/staff/useStaffPaymentsAdmin.ts`: payments list/monthly summary/loading state, payment + history filters, selected payments + bulk-busy + checkout-menu state, payment/attendance/audit popover anchors, user-history payments, plus `fetchPayments`, `fetchPaymentsMonthlySummary`, history-mode debounced search effect, history-class-key reset effect, user-history popover effect, and `handlePaymentCategoryChange`. Compatibility seam: `studentSearchQuery` remains owned by container and is passed in.
- [x] B5.2 Container `StaffUsersAdminClient.tsx` invokes the hook and destructures its surface; bulk settlement request/selection state moved into the hook while the container keeps only the cross-domain success callback that refreshes terminal alerts and global-search results.
- [x] B5.3 No-touch boundaries respected: CourseLink / consecutive-course-link internals unchanged; payroll fetches (`/api/staff/payroll/payment-models`, `/api/staff/payroll/change-requests`) remain in container to honour `tests/front/staff-users-admin-client-fetch-cache.test.tsx` source-string assertions.
- [x] B5.4 Add behavior tests in `components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx` covering: initial state, `handlePaymentCategoryChange` history-filter clearing, history-class-key reset when option disappears, `fetchPayments` happy path, `fetchPayments` auth-failure routing, `fetchPayments` history-mode no-range short-circuit, `fetchPaymentsMonthlySummary` totals update, payment selection actions, bulk settlement success, and 350 ms debounced history search.
- [x] B5.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 86 tests; `npx tsc --noEmit` exit 0.

### Batch 6 — Payments Board Controls Presentational Split
- [x] B6.1 Extract the payments-board summary cards, category/search/status controls, history filter panel, history metric cards, select-visible toolbar, and sticky cash bulk toolbar into `components/front/staff/StaffPaymentsBoardControls.tsx`.
- [x] B6.2 Preserve container ownership for derived payment cards, card rendering, pagination, global-search wiring, and cross-domain settlement success refresh while passing a typed control surface into the presentational component.
- [x] B6.3 Validation: `npm run test -- components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 86 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffPaymentsBoardControls.tsx components/front/staff/useStaffPaymentsAdmin.ts components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx` clean; `npx tsc --noEmit` exit 0.

### Batch 7 — Payments Card Pure Presentation Helpers
- [x] B7.1 Move payment/student-card pure presentation helpers from `StaffUsersAdminClient.tsx` into `components/front/staff/staffPaymentCardPresentation.ts` instead of leaving helper logic buried in the container.
- [x] B7.2 Preserve compatibility re-exports for existing `StaffUsersAdminClient.test.ts` imports while the test suite is still coupled to the legacy container seam.
- [x] B7.3 Validation: focused staff payments/client tests passed 3 files / 86 tests; eslint clean on changed files; `npx tsc --noEmit` exit 0.

### Batch 8 — Requests and Approvals Hook Extraction
- [x] B8.1 Move staff request/payment-change-request state, loading/busy state, fetches, status updates, and approvals summary/feed memos into `components/front/staff/useStaffRequestsAdmin.ts`.
- [x] B8.2 Move approvals pure helpers/labels into `components/front/staff/staffApprovals.ts` with compatibility re-exports from `StaffUsersAdminClient.tsx` for existing helper tests.
- [x] B8.3 Update `tests/front/staff-users-admin-client-fetch-cache.test.tsx` to scan both the container and the new requests hook so the `/api/staff/payroll/change-requests` no-store invariant remains covered after extraction.
- [x] B8.4 Validation: focused staff/client tests passed 3 files / 86 tests; eslint clean on changed files; `npx tsc --noEmit` exit 0.

### Batch 9 — Self Profile and Profile Requests Hook Extraction
- [x] B9.1 Move self-profile loading/snapshot, payment-form state, self-profile request form/submission state, derived self-profile metrics, and profile payment summaries into `components/front/staff/useStaffSelfProfileAdmin.ts`.
- [x] B9.2 Move `fetchSelfProfile`, `saveProfilePaymentInfo`, and `submitProfileRequest` into the hook while keeping container-owned `profileForm` as the shared user/profile modal form boundary.
- [x] B9.3 Remove stale helper logic from `StaffUsersAdminClient.tsx` after migration; eslint/typecheck confirmed no dead local imports or unused helpers remained in the touched files.
- [x] B9.4 Validation: focused staff/client tests passed 3 files / 86 tests; eslint clean on changed files; `npx tsc --noEmit` exit 0.

### Batch 10 — Extracted Module Audit Cleanup
- [x] B10.1 Run a fresh logic-quality audit over `useStaffPaymentsAdmin.ts`, `useStaffRequestsAdmin.ts`, `useStaffSelfProfileAdmin.ts`, `staffApprovals.ts`, `staffPaymentCardPresentation.ts`, and `StaffPaymentsBoardControls.tsx` before continuing with more cuts.
- [x] B10.2 Reduce `useStaffPaymentsAdmin`'s return surface by removing unused raw setters and keeping only the state/actions consumed by the container and behavior tests.
- [x] B10.3 Restore the payment-history popover effect dependency behavior so open popovers do not refetch only because history filters/mode changed; the effect now reads the latest filter context through a ref while retaining the original trigger surface.
- [x] B10.4 Remove the dead double-normalization in `useStaffSelfProfileAdmin.fetchSelfProfile` by reusing the already normalized `nextCategory`.
- [x] B10.5 Validation: focused staff/client tests passed 3 files / 86 tests; eslint clean on touched files; `npx tsc --noEmit` exit 0.

### Batch 11 — Profile Edit Modal Admin Hook Extraction
- [x] B11.1 Move profile edit modal ownership into `components/front/staff/useStaffProfileModalAdmin.ts`: `profileModalOpen`, `profileTarget`, `profileLoading`, `profileSaving`, `profileError`, `profileSuccess`, `profileHasPin`, `profileCanEditRole`, `profileAvatarUploading`, `profileAvatarError`, `profileGalleryUploading`, and `profileForm` state, plus `openProfileModal`, `closeProfileModal`, `saveProfileModal`, `uploadProfileAvatar`, and `uploadProfileGalleryImages`.
- [x] B11.2 Expose typed field actions (`updateProfileField`, `updateProfileRole`, `clearProfileGallery`, `removeProfileGalleryImage`, `updateProfilePin`, `updateProfileClearPin`) so JSX no longer threads inline `setProfileForm` updates. `setProfileForm` is still returned for `useStaffSelfProfileAdmin` interop but is not consumed by JSX.
- [x] B11.3 Cross-domain refresh callbacks (`refreshRows`, `refreshSelfProfile`, `updateRowAvatar`) flow through container-owned refs so the hook stays decoupled from row list and self-profile ownership and the container retains responsibility for cross-domain side effects.
- [x] B11.4 No-touch boundaries respected: API contracts (`/api/staff/users/:id/profile`, `/api/staff/users/:id/avatar`, `/api/staff/users/:id/gallery-upload`), UI copy/classes, validation, and auth flow are preserved. CourseLink / consecutive-course-link internals are untouched.
- [x] B11.5 Add behavior tests in `components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx` covering: initial state, profile-load hydration including non-string gallery filtering, owner-role category normalization, `updateProfileRole` normalization, PIN sanitization to 4 digits, `updateProfileClearPin` toggle, `clearProfileGallery`/`removeProfileGalleryImage`, `saveProfileModal` PATCH + refresh callbacks + close, `saveProfileModal` skipping cross-domain refreshes when not applicable, `saveProfileModal` non-OK failure without refresh/close, `uploadProfileAvatar` calling `updateRowAvatar`, gallery upload dedupe + 6-image cap, and `closeProfileModal` reset semantics without clearing the form.
- [x] B11.6 Validation: `npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx` passed 4 files / 97 tests; eslint clean on touched files with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B11.7 Fresh review follow-up: moved role/category guards to `lib/security`, strengthened close-modal form-preservation coverage, added save-failure coverage, and added gallery upload dedupe/cap coverage.

### Batch 12 — Profile Modal Presentational Extraction
- [x] B12.1 Move the profile edit modal JSX from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffProfileModal.tsx` after Batch 11 already moved state/behavior ownership into `useStaffProfileModalAdmin`.
- [x] B12.2 Keep the new component render-only: no local state, effects, fetches, or behavior changes; preserve UI copy, classes, aria labels, form field names, and event semantics.
- [x] B12.3 Replace the in-container modal subtree with `<StaffProfileModal {...profileModalAdmin} />` and remove stale modal-specific destructuring/imports from the container.
- [x] B12.4 Add render smoke tests in `components/front/staff/__tests__/StaffProfileModal.test.tsx` for closed/null, open modal shell rendering, and preserving the container-provided assignable role list.
- [x] B12.5 Validation: focused staff/client tests passed 5 files / 102 tests; eslint clean on profile modal touched files; `npx tsc --noEmit` exit 0.
- [x] B12.6 Fresh review follow-up: restored the original `assignableRoles` permission boundary by passing it into `StaffProfileModal` instead of hardcoding owner/admin/staff in the presentational component.

### Batch 13 — Staff Approvals Panel Presentational Extraction
- [x] B13.1 Move the staff requests / notifications and approvals JSX into `components/front/staff/StaffApprovalsPanel.tsx` while keeping request/payment-change ownership in `useStaffRequestsAdmin`.
- [x] B13.2 Preserve UI copy, status filter behavior, summary cards, loading/empty states, request action buttons, payment-change details, and masked account-number display.
- [x] B13.3 Replace the in-container approvals subtree with `<StaffApprovalsPanel />` props and remove stale payment-change formatting imports from `StaffUsersAdminClient.tsx`.
- [x] B13.4 Add render smoke tests in `components/front/staff/__tests__/StaffApprovalsPanel.test.tsx` for hidden state and mixed staff/payment-change approval rows.
- [x] B13.5 Validation: focused staff/client tests passed 6 files / 104 tests; eslint clean on approvals touched files; `npx tsc --noEmit` exit 0.

### Batch 14 — Team Calendar Panel Presentational Extraction
- [x] B14.1 Move the team calendar JSX into `components/front/staff/StaffTeamCalendarPanel.tsx` while keeping schedule state/fetch ownership in the container.
- [x] B14.2 Preserve calendar copy, month navigation behavior, weekday labels, loading skeletons, event pills, hover details, and overflow count rendering.
- [x] B14.3 Replace the in-container calendar subtree with `<StaffTeamCalendarPanel />` props and keep `setScheduleMonth` as the container-owned state transition.
- [x] B14.4 Add render smoke tests in `components/front/staff/__tests__/StaffTeamCalendarPanel.test.tsx` for hidden state, event rendering, and month navigation callbacks.
- [x] B14.5 Validation: focused staff/client calendar tests passed; eslint clean on calendar touched files; `npx tsc --noEmit` exit 0.

### Batch 15 — Performance Metrics Panel Presentational Extraction
- [x] B15.1 Move the performance metrics JSX into `components/front/staff/StaffPerformanceMetricsPanel.tsx` while keeping teacher metrics state, derived values, and save behavior in the container.
- [x] B15.2 Preserve metrics copy, selected-teacher control, rating stars, AI recommendations, bar metrics, distribution view, review-cycle select, save button, success/error messages, and donut legend rendering.
- [x] B15.3 Replace the in-container metrics subtree with `<StaffPerformanceMetricsPanel />` props and keep `setTeacherUserId`, `setMetricsView`, `setTeacherReviewCycleDays`, and `saveTeacherReviewCycle` as container-owned transitions/actions.
- [x] B15.4 Add render smoke tests in `components/front/staff/__tests__/StaffPerformanceMetricsPanel.test.tsx` for hidden state, teacher metrics rendering, recommendations, control callback wiring, review-cycle changes, and save callback wiring.
- [x] B15.5 Validation: `npm run test -- components/front/staff/__tests__/StaffPerformanceMetricsPanel.test.tsx` passed 1 file / 3 tests; eslint clean on metrics touched files; `npx tsc --noEmit` exit 0.

### Batch 16 — Staff Profile View Panel Presentational Extraction
- [x] B16.1 Move the employee/self-profile dashboard JSX into `components/front/staff/StaffProfileViewPanel.tsx` while keeping self-profile state/actions in `useStaffSelfProfileAdmin`, profile modal ownership in `useStaffProfileModalAdmin`, and cross-domain derived schedule/request values in the container.
- [x] B16.2 Preserve profile header, performance/payroll/review cards, payment information section, monthly calendar links/grid, request creation form, request history filters/list, recommendations, UI copy/classes, aria labels, and form event semantics.
- [x] B16.3 Replace the in-container profile subtree with `<StaffProfileViewPanel />` props and remove only verified stale imports from the container.
- [x] B16.4 Add render/callback tests in `components/front/staff/__tests__/StaffProfileViewPanel.test.tsx` covering hidden state, profile shell rendering, edit profile callback, schedule navigation, request submission, payment expand/reset behavior, payment form submission, loading skeletons, and empty request history.
- [x] B16.5 Fresh review: no behavior/security regression found; normalized payment error/success setter prop types to full `React.Dispatch<React.SetStateAction<string | null>>` for consistency.
- [x] B16.6 Validation: `npm run test -- components/front/staff/__tests__/StaffProfileViewPanel.test.tsx` passed 1 file / 9 tests; eslint clean on profile-view touched files; `npx tsc --noEmit` exit 0.
- [ ] B16.7 Follow-up debt: profile payment header/summary duplication between `StaffProfilePaymentSection` and its children is pre-existing and preserved for parity; clean it in a separate scoped batch.

### Batch 17a — Reports Analytics Hook Extraction
- [x] B17a.1 Move reports analytics state, derived payment aggregations, chart metadata, local/remote AI suggestion state, suggestion filtering, expanded-suggestion sync, and CSV/PDF export callbacks into `components/front/staff/useStaffReportsAdmin.ts`.
- [x] B17a.2 Keep the reports JSX in `StaffUsersAdminClient.tsx` for this batch so the diff moves ownership first and defers the render panel split.
- [x] B17a.3 Preserve date-range filtering, swapped-date behavior, KPI calculations, cohort retention calculations, AI suggestion fetch/fallback behavior, CSV export, PDF popup-blocked banner behavior, and existing suggestion interactions.
- [x] B17a.4 Add hook tests in `components/front/staff/__tests__/useStaffReportsAdmin.test.tsx` covering date filtering, report aggregation, local suggestion filtering/expanded sync, remote suggestion success/fallback, PDF popup-blocked error routing, and CSV export smoke behavior.
- [x] B17a.5 Fresh review: no behavior/security regression found; tightened CSV export test mocks so `document.createElement` only intercepts anchors and `URL` is restored via `vi.stubGlobal`/`vi.unstubAllGlobals`.
- [x] B17a.6 Validation: `npm run test -- components/front/staff/__tests__/useStaffReportsAdmin.test.tsx` passed 1 file / 7 tests; eslint clean on reports hook touched files; `npx tsc --noEmit` exit 0.

### Batch 17b — Reports Panel and Pure Logic Cleanup
- [x] B17b.1 Move the reports JSX into `components/front/staff/StaffReportsPanel.tsx` while preserving copy, classes, date controls, charts, tables, objective filters, suggestion interactions, and export buttons.
- [x] B17b.2 Split pure reports aggregations/date helpers/suggestion builders into `components/front/staff/staffReportsAggregations.ts` so `useStaffReportsAdmin.ts` owns state and lifecycle rather than large aggregation loops.
- [x] B17b.3 Split pure CSV/PDF string builders into `components/front/staff/staffReportsExports.ts`; keep browser side effects (Blob, anchor click, popup print, shared `setError`) in the hook.
- [x] B17b.4 Replace the inline reports block in `StaffUsersAdminClient.tsx` with `<StaffReportsPanel isReportsView={isReportsView} reports={reportsAdmin} formatMoney={formatMoney} setError={setError} />`.
- [x] B17b.5 Add render/callback tests in `components/front/staff/__tests__/StaffReportsPanel.test.tsx` covering hidden state, KPI/table rendering, date setter/clear/export wiring, objective/refresh/expand/done actions, and copy-AI-brief error routing.
- [x] B17b.6 Validation: `npm run test -- components/front/staff/__tests__/useStaffReportsAdmin.test.tsx components/front/staff/__tests__/StaffReportsPanel.test.tsx` passed 2 files / 12 tests; eslint clean on reports touched files; `npx tsc --noEmit` exit 0.

### Batch 18 — Students Payments Board Panel Presentational Extraction
- [x] B18.1 Move the `{isStudentsView ? ... : null}` Students Payments Board article (header, Clerk sync banner, terminal PIN alerts strip, `<StaffPaymentsBoardControls />` usage, payments grid/card rendering, pagination footer) into `components/front/staff/StaffStudentsBoardPanel.tsx`.
- [x] B18.2 Group props into named cohesive objects (`loadingStatus`, `clerkSync`, `terminalAlerts`, `controls`, `cards`, `pagination`) to keep the panel surface human-readable instead of a 50-prop flat component. Internal sub-components `ClerkSyncBanner`, `TerminalPinAlertsStrip`, `StudentCardsGrid`, `ProfileStudentCard`, and `PaymentStudentCard` live inside the same file to keep top-down readability.
- [x] B18.3 Move the panel-private `formatTerminalAlertDateTime` and `formatTerminalAlertRelative` helpers out of `StaffUsersAdminClient.tsx` into the new panel (they had no other callers); use a small `ClerkSyncContext` to share Clerk sync data with nested card components without threading every prop.
- [x] B18.4 No-touch boundaries respected: CourseLink / consecutive-course-link internals unchanged; endpoints/auth/security/cache preserved; host-owned effects/listeners/memos remain in the container (results/callbacks are passed through props).
- [x] B18.5 Remove stale container imports (`buildHistoryStudentPaidEntries`, `resolveHistoryStudentCardAmountPaidCents`, `ClerkSyncMismatchBanner`, `checkInStateTone`, `resolveStudentPinTone`, `formatIsoDateLong`, `formatStudentPaymentCardDateTimeLabel`, `formatStudentPaymentCardSlotLabel`, `paymentStateTone`, `PROFILE_CARD_BADGE_CLASS`, `resolveProfileCardBadges`, `resolveProfileCardDetailRows`, `resolveProfileSettlementControl`, `StaffPaymentsBoardControls`) and the now-unused `formatTerminalAlertDateTime`/`formatTerminalAlertRelative` helpers, validated by eslint and tsc.
- [x] B18.6 Add render/callback tests in `components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx` covering: returns null when hidden, header + refresh button wiring, Clerk sync banner condition + Sync users repair callback, Clerk sync banner hidden when nothing wrong, terminal PIN alerts strip appearance gating, pagination Previous/Next callbacks + boundary disabled state, pagination hidden when only one page, and `StaffPaymentsBoardControls` passthrough via the Card filter button.
- [x] B18.7 Validation: `npm run test -- components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 4 files / 87 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffStudentsBoardPanel.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B18.8 Evidence: `StaffUsersAdminClient.tsx` shrank from 7,872 → 7,176 LOC (-696). New `StaffStudentsBoardPanel.tsx` = 1,181 LOC (panel ownership), `__tests__/StaffStudentsBoardPanel.test.tsx` = 348 LOC.
- [x] B18.9 Fresh-review cleanup: moved `ClerkSyncContext` before first provider usage, replaced `searchResultCards!` and Clerk mismatch non-null assertions with defensive lookups, removed unnecessary local context re-export, then re-ran `StaffStudentsBoardPanel.test.tsx` (8/8), touched-file ESLint, and `npx tsc --noEmit` successfully.

### Batch 19 — Team Board + Teacher-Course Assignment Panel Presentational Extraction
- [x] B19.1 Move the `showStaffOps` Team board article (header, category filter pills + mobile select, search/refresh form, loading skeletons, empty state, staff cards grid with payroll-model select, presence menu, lock/ban/remove actions) into `components/front/staff/StaffTeamBoardPanel.tsx`. Render-only; no state/effects/fetches inside.
- [x] B19.2 Move the `showStaffOps` Teacher-course assignment article (teacher select, assigned-teacher select, recurrence unit + interval, program-courses toggle grid, summary line, Save assignment button, success/error banners) into `components/front/staff/StaffTeacherAssignmentPanel.tsx`. Render-only; container retains `selectedTeacher`/`assignedTeacher` memos, hydration effect, `toggleTeacherCourse` callback, and `saveTeacherPerformance` async action.
- [x] B19.3 Group props into cohesive named objects to avoid wide flat surfaces. `StaffTeamBoardPanel`: `filters`, `search`, `data`, `permissions`, `payrollModels`, `presence`, `actions`. `StaffTeacherAssignmentPanel`: `selection`, `recurrence`, `courses`, `status`, plus `onSave`.
- [x] B19.4 Move panel-private helpers (`statusLabel`, `getStatusTone`, `formatDate`) into `StaffTeamBoardPanel.tsx`; they had no other callers in the container. Container teacher hydration helpers (`normalizeTeacherAssignmentCourseSlugs`, `buildTeacherAssignmentFormState`, `areTeacherAssignmentStatesEqual`) stayed in the container because container memos still depend on them.
- [x] B19.5 No-touch boundaries respected: CourseLink / consecutive-course-link internals unchanged; `isSchoolView` / school courses / packages / points untouched; API contracts (`/api/staff/users/:id`, `/api/staff/users/:id/performance`, payroll model endpoints) preserved; UI copy, classes, aria labels, form names, and button labels copied verbatim; permission gating (`canManageTarget`, `currentUserId === row.id` disable on Remove, owner/admin error message) preserved.
- [x] B19.6 Stale imports removed from `StaffUsersAdminClient.tsx` after eslint/tsc verification: `CheckCircle2`, `ChevronDown`, `Loader2`, `Mail`, `MapPin`, `MoreHorizontal`, `Phone`, `RefreshCw` from `lucide-react`, plus `ROLE_LABELS` from `./staffAdminConstants`.
- [x] B19.7 Add render/callback tests in `components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx` covering: hidden state, loading skeletons, empty state, search submit + refresh callback wiring, category-pill filter callback, profile open on row click for manageable rows, permission-denied path when `canManageTarget` returns false, lock/ban via `runAction` and remove via `revokeStaff`, Remove disabled for current user, and payroll-model select firing `updateModel`.
- [x] B19.8 Add render/callback tests in `components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx` covering: hidden state, no-teachers empty state, selected-teacher select change, course toggle button click, Save button success/disabled/saving/no-selected states, dirty indicator, recurrence helper text, success banner, and error banner.
- [x] B19.9 Validation: `npm run test -- components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 100 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamBoardPanel.tsx components/front/staff/StaffTeacherAssignmentPanel.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B19.10 Evidence: `StaffUsersAdminClient.tsx` shrank from 7,176 → 6,701 LOC (-475). New `StaffTeamBoardPanel.tsx` = 473 LOC, `StaffTeacherAssignmentPanel.tsx` = 276 LOC, `__tests__/StaffTeamBoardPanel.test.tsx` = 369 LOC, `__tests__/StaffTeacherAssignmentPanel.test.tsx` = 314 LOC.

### Batch 20 — Post-extraction Cleanups on Staff Panels
- [x] B20.1 `StaffTeacherAssignmentPanel.tsx`: extracted the inline recurrence interval clamp from the JSX `onChange` into a named helper `normalizeRecurrenceIntervalInput(value: string): number` exported from the same file. Implementation preserves exact behavior: `Math.max(1, Math.min(12, Number(value) || 1))`. Updated the `<input type="number">` `onChange` to call the helper.
- [x] B20.2 `__tests__/StaffTeacherAssignmentPanel.test.tsx`: added a focused `describe("normalizeRecurrenceIntervalInput", ...)` block (4 tests) covering above-12 clamp, below-1 clamp, empty / non-numeric fallback to 1, and pass-through for in-range values.
- [x] B20.3 `StaffTeamBoardPanel.tsx`: extracted the staff row card subtree from the `.map()` body into an internal `StaffTeamCard` component in the same file. Preserved all `event.stopPropagation()` calls (More-options button, role pill, presence pill, presence menu logout, payroll-model card wrapper, payroll-model select `onClick`/`onChange`), permission gating (`canManageTarget` → `onPermissionDenied` path, current-user remove disable), callback semantics (`openProfile`, `openDelayDetails`, `runAction`, `revokeStaff`, `updateStaffPayrollModel`, `setPresenceMenuUserId`), and class strings. Panel-private helpers `statusLabel`, `getStatusTone`, and `formatDate` remain local at the top of the file — not moved.
- [x] B20.4 `StaffProfileViewPanel.tsx`: deduplicated the 4 repeated calendar-link anchors (Google/Outlook/Yahoo/Apple) into a single inline IIFE that maps a typed `calendarLinks` list. Preserved exact hrefs (Google uses `selfCalendarGoogleHref`, others use `selfCalendarIcsDataUri`), exact `download` filename pattern (`pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics`), Google's `target="_blank" rel="noreferrer"`, ARIA-free labels, the conditional `linkClass` (active vs `pointer-events-none` for empty schedules), and the same icon mapping (`ExternalLink`, `CalendarPlus`, `Download`, `Download`). No new exports; data-driven loop lives inside the section.
- [x] B20.5 `StaffStudentsBoardPanel.tsx`: unified `ProfileClerkBanner` and `PaymentClerkBanner` to delegate to a single internal `ClerkSyncUserBanner` keyed by `userId` (accepts `string | null` to allow `payment.userId ?? null`). The `ClerkSyncContext` pattern was preserved verbatim (no provider/consumer unwound). Banner behavior is preserved exactly: returns null when context absent, when `canManageClerkSync` false, when no mismatch entry exists for the user, or when the mismatch lookup is undefined; passes `busy={clerkSyncUserBusyId === userId}` and `onSync={() => onSyncClerkUser(userId)}` to `ClerkSyncMismatchBanner`. `ProfileClerkBanner({ student })` and `PaymentClerkBanner({ payment })` remain as the outer call-site wrappers so external behavior (and `<ProfileClerkBanner student={student} />` / `<PaymentClerkBanner payment={payment} />` JSX) is identical.
- [x] B20.6 No-touch boundaries respected: CourseLink / consecutive-course-link / `isSchoolView` school internals not touched; no API contracts, auth/permission checks, UI copy, CSS classes, aria labels, form names, or callback semantics changed; no new exports across module boundaries (helper is local; cards/banners are file-internal).
- [x] B20.7 Validation: `npm run test -- components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 7 files / 121 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamBoardPanel.tsx components/front/staff/StaffTeacherAssignmentPanel.tsx components/front/staff/StaffProfileViewPanel.tsx components/front/staff/StaffStudentsBoardPanel.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B20.8 LOC impact: `StaffTeacherAssignmentPanel.tsx` 276 → 284 (+8, helper + docstring); `StaffTeamBoardPanel.tsx` 473 → 548 (+75, prop pass-through on `StaffTeamCard`; the card body is now an SRP unit); `StaffProfileViewPanel.tsx` 831 → 834 (+3, 4× duplication collapsed to a single render); `StaffStudentsBoardPanel.tsx` 1,181 → 1,178 (-3, banner dedup); test file +23 LOC (4 new helper tests). `StaffUsersAdminClient.tsx` unchanged.
- [x] B20.9 Follow-up debt: B20.3's `StaffTeamCard` carries 20 props because the panel chose a flat surface for readability; a future cleanup could pass `payrollModels`/`presence`/`actions` groups straight through. The card lives inside `StaffTeamBoardPanel.tsx` per scope; if another caller needs it later, it can be promoted to its own module. The calendar-link list in `StaffProfileViewPanel.tsx` is held in an IIFE rather than a top-level helper to keep the access to in-scope closures (`selfCalendarGoogleHref`, `selfCalendarIcsDataUri`, `selfScheduleEntries.length`, `profileScheduleMonth`) explicit without lifting state.

### Batch 21 — Resolve Batch 20 Follow-up Debt
- [x] B21.1 `StaffTeamBoardPanel.tsx`: reduced `StaffTeamCard`'s prop surface by passing the existing grouped `permissions`, `payrollModels`, `presence`, and `actions` objects directly into the card. The card now derives `rowBusy`, `canManageRow`, and `payrollModelState` internally from those groups, preserving behavior while removing the 20-prop flat pass-through debt.
- [x] B21.2 `StaffTeacherAssignmentPanel.tsx`: removed the test-only helper export by moving `normalizeRecurrenceIntervalInput(value: string): number` into `components/front/staff/staffTeacherAssignmentHelpers.ts`. The panel and tests now import from the helper module; behavior remains `Math.max(1, Math.min(12, Number(value) || 1))`.
- [x] B21.3 Validation: `npm run test -- components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 104 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamBoardPanel.tsx components/front/staff/StaffTeacherAssignmentPanel.tsx components/front/staff/staffTeacherAssignmentHelpers.ts components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B21.4 LOC impact: `StaffTeamBoardPanel.tsx` 548 → 510 (-38); `StaffTeacherAssignmentPanel.tsx` 284 → 277 (-7); new `staffTeacherAssignmentHelpers.ts` = 5 LOC; `__tests__/StaffTeacherAssignmentPanel.test.tsx` 337 → 336 (-1). `StaffUsersAdminClient.tsx` unchanged.

### Batch 22 — Payroll Control Panel Presentational Extraction
- [x] B22.1 Move the `showStaffOps` Payroll / Staff payment control article from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffPayrollControlPanel.tsx`. Render-only; payroll row derivation, payroll summary derivation, pending-payment navigation, delay modal state, live-session calculation, and `runAction` remain container-owned.
- [x] B22.2 Preserve UI copy, classes, summary cards, empty state, status/delay callbacks, force-logout behavior, owner-only `StaffPaymentMethodConfigPanel`, and existing `formatMoney` / `formatMinutesLabel` behavior by passing them as props.
- [x] B22.3 Add render/callback tests in `components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx` covering hidden state, empty payroll rows, stored+live hours rendering, status/delay callback wiring, summary Pay callback, force logout action, and owner-only payment-method config rendering.
- [x] B22.4 Validation: `npm run test -- components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 83 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffPayrollControlPanel.tsx components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.

### Batch 23 — Staff Access Create Panel Presentational Extraction
- [x] B23.1 Move the `showStaffOps` Staff access / Invite or promote user article from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffAccessCreatePanel.tsx`. Render-only; form state and `createStaff` submit behavior remain container-owned.
- [x] B23.2 Preserve UI copy, form names/placeholders, assignable role options, fixed-category disabling, role-change category normalization, PIN sanitization (`replace(/\D/g, "").slice(0, 4)`), busy label, success message, and error message behavior.
- [x] B23.3 Add render/callback tests in `components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx` covering hidden state, form fields/options, role-change normalization, PIN sanitization, submit handler wiring, busy/success/error states, and fixed-role category lock.
- [x] B23.4 Validation: `npm run test -- components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 83 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAccessCreatePanel.tsx components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B23.5 LOC impact: `StaffUsersAdminClient.tsx` 6,515 → 6,434 (-81); new `StaffAccessCreatePanel.tsx` = 148 LOC; new `__tests__/StaffAccessCreatePanel.test.tsx` = 167 LOC.

### Batch 24 — School Packages + Points Panel Extraction
- [x] B24.1 Move the residual school packages/points render block from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffSchoolPackagesPointsPanel.tsx`. Render-only; package/points form state, fetch/save/lifecycle actions, and wizard state remain container-owned.
- [x] B24.2 Preserve package builder steps, course assignment cards, pricing/validity controls, package catalog filters/actions, points rule builder, points manual assignment, points catalog, and wizard footer behavior through explicit props.
- [x] B24.3 Cleanup: remove the production non-null default-room lookup in the course main-info block by using optional access for `roomById[courseForm.defaultRoomId]`.
- [x] B24.4 Add render/callback tests in `components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx` covering packages render/course toggle, points render/saved rules, and null rendering outside packages/points.
- [x] B24.5 Validation: `npm run test -- components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 79 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffSchoolPackagesPointsPanel.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B24.6 LOC impact: `StaffUsersAdminClient.tsx` 6,434 → 5,847 (-587); new `StaffSchoolPackagesPointsPanel.tsx` = 545 LOC; new `__tests__/StaffSchoolPackagesPointsPanel.test.tsx` = 140 LOC.

### Batch 25 — School Rooms Management Panel Extraction
- [x] B25.1 Move the `schoolWizard.activeEntity === "rooms" && step === 0` room management article from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffSchoolRoomsPanel.tsx`. Render-only; room form state, room lifecycle actions, filters, and wizard state remain container-owned.
- [x] B25.2 Preserve room form fields, validation messages, room search/status filtering controls, active/inactive badges, edit/activate/disable/reassign/safe-delete actions, row action errors, and wizard footer behavior through explicit props.
- [x] B25.3 Add render/callback tests in `components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx` covering hidden state, form/list rendering, submit/search/action wiring.
- [x] B25.4 Validation: `npm run test -- components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 79 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffSchoolRoomsPanel.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B25.5 LOC impact: `StaffUsersAdminClient.tsx` 5,847 → 5,674 (-173); new `StaffSchoolRoomsPanel.tsx` = 225 LOC; new `__tests__/StaffSchoolRoomsPanel.test.tsx` = 121 LOC.

### Batch 26 — Terminal, Assistant, and Settings Utility Panels Extraction
- [x] B26.1 Move the terminal-access, assistant-config, and settings render blocks from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffAdminUtilityPanels.tsx`. Render-only; assistant config state and submit behavior remain container-owned.
- [x] B26.2 Preserve terminal manager vs limited-user branch, assistant select/checkbox controls, assistant success message, and settings cards through explicit grouped props.
- [x] B26.3 Add render/callback tests in `components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx` covering terminal setup/fallback rendering, assistant submit/change wiring, and settings rendering.
- [x] B26.4 Validation: `npm run test -- components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx` passed 1 file / 3 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAdminUtilityPanels.tsx components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B26.5 LOC impact: `StaffUsersAdminClient.tsx` 5,674 → 5,523 (-151); new `StaffAdminUtilityPanels.tsx` = 120 LOC; new `__tests__/StaffAdminUtilityPanels.test.tsx` = 89 LOC.

### Batch 27 — Room Reservations Panel Boundary
- [x] B27.1 Move the `rooms` step-1 private reservations article from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffRoomReservationsPanel.tsx`. Render-only; room reservation state/actions remain owned by `useStaffRoomsAdmin` and the container.
- [x] B27.2 Preserve reservation form/list composition, current/upcoming list, cancel callback, assigned-staff label resolver, and wizard Previous/Next controls through grouped `wizard`, `form`, and `list` props.
- [x] B27.3 Add render/callback tests in `components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx` covering hidden state, form/list rendering, range callback, submit, cancel, and wizard navigation.
- [x] B27.4 Validation: `npm run test -- components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 79 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffRoomReservationsPanel.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B27.5 LOC impact: `StaffUsersAdminClient.tsx` 5,523 → 5,516 (-7); new `StaffRoomReservationsPanel.tsx` = 71 LOC; new `__tests__/StaffRoomReservationsPanel.test.tsx` = 130 LOC. The small raw LOC reduction is expected because source-contract markers remain in the container for brittle tests.

### Batch 28 — Course Main Information Step Extraction
- [x] B28.1 Move the course-builder step 0 “Course main information” block from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseMainInfoStep.tsx`. Render-only; course form state/actions remain container/hook-owned.
- [x] B28.2 Preserve slug conflict banner/actions, slug/title/description/kind/category/level/duration/location/default-room fields, room inactive labels, and selected-room details through typed props.
- [x] B28.3 Avoid CourseLink / consecutive-link internals; only course step 0 was touched.
- [x] B28.4 Add render/callback tests in `components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx` covering hidden state, field rendering, room details, field update callback, and slug conflict actions.
- [x] B28.5 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseMainInfoStep.tsx components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B28.6 LOC impact: `StaffUsersAdminClient.tsx` 5,516 → 5,396 (-120); new `StaffCourseMainInfoStep.tsx` = 205 LOC; new `__tests__/StaffCourseMainInfoStep.test.tsx` = 108 LOC.

### Batch 29 — Course Pricing Step Extraction
- [x] B29.1 Move the course-builder step 1 “Prices and special discounts” block from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffCoursePricingStep.tsx`. Render-only; course form state/actions remain container/hook-owned.
- [x] B29.2 Preserve create-first fallback, drop-in / first-class price fields, special discount type handling, discount price disabling, custom discount label visibility, and custom-label clearing behavior for non-custom discounts.
- [x] B29.3 Avoid CourseLink / consecutive-link and schedule-builder internals; only course step 1 was touched.
- [x] B29.4 Add render/callback tests in `components/front/staff/__tests__/StaffCoursePricingStep.test.tsx` covering hidden state, create-first fallback, price rendering, disabled discount price, custom label rendering, and discount-type callback.
- [x] B29.5 Validation: `npm run test -- components/front/staff/__tests__/StaffCoursePricingStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCoursePricingStep.tsx components/front/staff/__tests__/StaffCoursePricingStep.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B29.6 LOC impact: `StaffUsersAdminClient.tsx` 5,396 → 5,331 (-65); new `StaffCoursePricingStep.tsx` = 92 LOC; new `__tests__/StaffCoursePricingStep.test.tsx` = 99 LOC.

### Batch 30 — Course Media Assets Step Extraction
- [x] B30.1 Move the course-builder step 2 “Media assets” block from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseMediaStep.tsx`. Render-only; file input refs and upload handlers remain container-owned.
- [x] B30.2 Preserve create-first fallback, video/image URL fields, upload button labels, disabled uploading state, local filename labels, and media-upload callbacks through typed props.
- [x] B30.3 Avoid CourseLink / consecutive-link and schedule-builder internals; only course step 2 was touched.
- [x] B30.4 Add render/callback tests in `components/front/staff/__tests__/StaffCourseMediaStep.test.tsx` covering hidden state, create-first fallback, media URL/local labels, uploading label, disabled upload buttons, and disabled-click behavior.
- [x] B30.5 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseMediaStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseMediaStep.tsx components/front/staff/__tests__/StaffCourseMediaStep.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B30.6 LOC impact: `StaffUsersAdminClient.tsx` 5,331 → 5,294 (-37); new `StaffCourseMediaStep.tsx` = 114 LOC; new `__tests__/StaffCourseMediaStep.test.tsx` = 105 LOC.

### Batch 31 — Course Publish Step Extraction
- [x] B31.1 Move the course-builder step 6 social publish + reset/save controls from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffCoursePublishStep.tsx`. Render-only; sharing/copy/reset/save behavior remains container/hook-owned.
- [x] B31.2 Preserve create-first fallback, social buttons, disabled public-link state, reset/save disabled state, and saving label through typed props.
- [x] B31.3 Avoid CourseLink / consecutive-link and schedule-builder internals; only course step 6 publish controls were touched.
- [x] B31.4 Add render/callback tests in `components/front/staff/__tests__/StaffCoursePublishStep.test.tsx` covering hidden state, create-first fallback, copy/share/reset callbacks, disabled social actions, and saving state.
- [x] B31.5 Validation: `npm run test -- components/front/staff/__tests__/StaffCoursePublishStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCoursePublishStep.tsx components/front/staff/__tests__/StaffCoursePublishStep.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B31.6 LOC impact: `StaffUsersAdminClient.tsx` 5,294 → 5,221 (-73); new `StaffCoursePublishStep.tsx` = 90 LOC; new `__tests__/StaffCoursePublishStep.test.tsx` = 83 LOC.

### Batch 32 — Course Preview Step Extraction
- [x] B32.1 Move the course-builder step 5 preview/review/calendar block from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffCoursePreviewStep.tsx`. Render-only; hover state and schedule tooltip/tone callbacks remain container/hook-owned.
- [x] B32.2 Preserve home/single preview cards, media image/video behavior, edit links, course summary, discount/publication/default-room/times copy, review variants, loading skeleton, and locked calendar rendering.
- [x] B32.3 Avoid CourseLink / consecutive-link internals; only preview step 5 was touched.
- [x] B32.4 Add render/callback tests in `components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx` covering hidden state, summary/reviews/calendar rendering, hover callback wiring, and loading skeleton.
- [x] B32.5 Validation: `npm run test -- components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCoursePreviewStep.tsx components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B32.6 LOC impact: `StaffUsersAdminClient.tsx` 5,221 → 5,030 (-191); new `StaffCoursePreviewStep.tsx` = 321 LOC; new `__tests__/StaffCoursePreviewStep.test.tsx` = 124 LOC.

### Batch 33 — Course Schedule Step Extraction
- [x] B33.1 Stabilize the timed-out partial schedule-builder extraction by fixing the extra JSX wrapper that broke `StaffUsersAdminClient.tsx` parsing.
- [x] B33.2 Move the course-builder step 3 schedule builder into `components/front/staff/StaffCourseScheduleStep.tsx`. Render-only; schedule state/actions, recurrence state, and course form ownership remain container/hook-owned.
- [x] B33.3 Preserve weekly weekday toggles, mirror-day controls, special-event date entry, quick time chips/editing, add/remove slot controls, recurrence settings, publication controls, and schedule warnings through typed props.
- [x] B33.4 Avoid CourseLink / consecutive-link internals; the existing step 4 block stayed in the container.
- [x] B33.5 Add render/callback tests in `components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx` covering hidden state, weekly schedule rendering/actions, special-event date handling, and launch-date publication rendering.
- [x] B33.6 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseScheduleStep.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx --max-warnings=0` clean; `npx tsc --noEmit` exit 0.
- [x] B33.7 LOC impact: `StaffUsersAdminClient.tsx` 5,030 → 4,623 (-407); new `StaffCourseScheduleStep.tsx` = 549 LOC; new `__tests__/StaffCourseScheduleStep.test.tsx` = 156 LOC.

### Batch 34 — Hidden Saved-Courses Cleanup
- [x] B34.1 Audit the post-B33 course studio area for the hidden saved-courses block and confirm it was statically unreachable via `style={{ display: "none" }}`.
- [x] B34.2 Confirm the visible saved-courses catalog remains as the active course catalog surface (`Course catalog` / `saved-course-ext-*` block) before deleting the hidden duplicate block.
- [x] B34.3 Remove only the hidden duplicate block (`course-row-*` markup) and keep the active saved-courses catalog and CourseLink step 4 block intact.
- [x] B34.4 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 4 files / 84 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B34.5 LOC impact: `StaffUsersAdminClient.tsx` 4,623 → 4,540 (-83); no new files.

### Batch 35 — CourseLink Step Presentational Extraction
- [x] B35.1 Move the course-builder step 4 Consecutive Classes / CourseLink render block into `components/front/staff/StaffCourseLinksStep.tsx`. Render-only; CourseLink form state, API actions, and link mutation handlers remain container-owned.
- [x] B35.2 Preserve create-first fallback, error/success banners, active-course selector, active toggle, price inputs, add/update/cancel controls, before/after link lists, active/inactive toggles, edit/remove actions, and empty state through typed props.
- [x] B35.3 Keep CourseLink business logic untouched: no handler, endpoint, pricing, link derivation, or mutation semantics changed.
- [x] B35.4 Add render/callback tests in `components/front/staff/__tests__/StaffCourseLinksStep.test.tsx` covering hidden state, create-first fallback, form/feedback/list rendering, callback wiring, and empty state.
- [x] B35.5 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseLinksStep.test.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 89 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B35.6 LOC impact: `StaffUsersAdminClient.tsx` 4,540 → 4,389 (-151); new `StaffCourseLinksStep.tsx` = 256 LOC; new `__tests__/StaffCourseLinksStep.test.tsx` = 161 LOC.

### Batch 36 — Recent Course Step Cleanup Pass
- [x] B36.1 Audit recent course-step extractions for obvious garbage and simplify only high-confidence code paths.
- [x] B36.2 `StaffCourseLinksStep.tsx`: extract course option formatting, linked-course label resolution, and CourseLink price-label formatting into named helpers; group repeated link-list action/price callback props into local typed objects.
- [x] B36.3 `StaffCourseScheduleStep.tsx`: remove the redundant fragment wrapper so the component returns the single existing root directly.
- [x] B36.4 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseLinksStep.test.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 4 files / 85 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B36.5 LOC impact: `StaffCourseLinksStep.tsx` 256 → 304 (+48, named helpers replacing inline logic); `StaffCourseScheduleStep.tsx` 549 → 547 (-2); `StaffUsersAdminClient.tsx` unchanged at 4,389.

### Batch 37 — Course Field Class Cleanup Pass
- [x] B37.1 Audit earlier course-step components (`StaffCourseMainInfoStep`, `StaffCoursePricingStep`, `StaffCourseMediaStep`) for repeated styling and low-risk simplification targets.
- [x] B37.2 Replace repeated course field Tailwind class strings with file-local constants in each component; keep all copy, names, values, callbacks, and disabled behavior unchanged.
- [x] B37.3 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx components/front/staff/__tests__/StaffCoursePricingStep.test.tsx components/front/staff/__tests__/StaffCourseMediaStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 88 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B37.4 LOC impact: `StaffCourseMainInfoStep.tsx` 205 → 208 (+3); `StaffCoursePricingStep.tsx` 92 → 95 (+3); `StaffCourseMediaStep.tsx` 114 → 116 (+2). The small LOC increase centralizes repeated class strings and reduces JSX noise.

### Batch 38 — Course Catalog Panel Extraction
- [x] B38.1 Move the visible saved-courses Course catalog article into `components/front/staff/StaffCourseCatalogPanel.tsx`. Render-only; catalog search/filter state and course actions remain container-owned.
- [x] B38.2 Preserve loading skeleton, no-course/no-filter empty states, active/inactive filters, course cards, preview media, schedule labels, CourseLink pills, edit/hold/activate/delete actions, and owner-only delete visibility.
- [x] B38.3 Add render/callback tests in `components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx` covering hidden state, card rendering/link pills, search/filter/action callbacks, and filtered empty state.
- [x] B38.4 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B38.5 LOC impact: `StaffUsersAdminClient.tsx` 4,389 → 4,273 (-116); new `StaffCourseCatalogPanel.tsx` = 234 LOC; new `__tests__/StaffCourseCatalogPanel.test.tsx` = 134 LOC.

### Batch 39 — Course Studio Wrapper Extraction
- [x] B39.1 Move the Course studio article wrapper, step title/description, hidden file inputs, step composition, create-first fallback, and wizard Previous/Next navigation into `components/front/staff/StaffCourseStudioPanel.tsx`.
- [x] B39.2 Keep all course state, refs, handlers, upload behavior, submit behavior, share/copy/reset behavior, CourseLink actions, schedule actions, and preview derivations container-owned and passed through grouped props.
- [x] B39.3 Add smoke/navigation tests in `components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx` covering hidden non-course state, step title rendering, step count, and navigation callbacks.
- [x] B39.4 Validation: `npm run test -- components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 78 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B39.5 LOC impact: `StaffUsersAdminClient.tsx` 4,273 → 4,198 (-75); new `StaffCourseStudioPanel.tsx` = 144 LOC; new `__tests__/StaffCourseStudioPanel.test.tsx` = 213 LOC.

### Batch 40 — Admin Modal Overlay Extraction
- [x] B40.1 Move the lower render modal overlays from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffAdminModalOverlays.tsx`: room safe delete, room reassignment, reservation cancel, delay details, and student PIN.
- [x] B40.2 Keep all modal state, async actions, clipboard error routing, formatters, room options, and domain ownership container-owned; the new component is render-only and callback-driven.
- [x] B40.3 Add render/callback tests in `components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx` covering closed state, room safe delete, room reassignment, delay details, student PIN reveal/copy, and callback wiring.
- [x] B40.4 Validation: `npm run test -- components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 80 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B40.5 LOC impact: `StaffUsersAdminClient.tsx` 4,198 → 3,834 (-364); new `StaffAdminModalOverlays.tsx` = 582 LOC; new `__tests__/StaffAdminModalOverlays.test.tsx` = 167 LOC.

### Batch 41 — Admin History Overlay Extraction
- [x] B41.1 Move the payment history, attendance history, audit history, and student data override overlay composition from `StaffUsersAdminClient.tsx` into `components/front/staff/StaffAdminHistoryOverlays.tsx`.
- [x] B41.2 Keep payment/history state, anchor state, override modal state, audit-entry updates, refresh behavior, and date formatter ownership container-owned through explicit callbacks and props.
- [x] B41.3 Add focused tests in `components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx` covering closed popovers, open close callbacks, audit props, and override success student-id routing.
- [x] B41.4 Validation: `npm run test -- components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 3 files / 79 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B41.5 LOC impact: `StaffUsersAdminClient.tsx` 3,834 → 3,777 (-57); new `StaffAdminHistoryOverlays.tsx` = 136 LOC; new `__tests__/StaffAdminHistoryOverlays.test.tsx` = 161 LOC.

### Batch 42 — Assistant Admin Cluster Extraction
- [x] B42.1 Move assistant config state, config message timeout, chat messages/input, rail collapse state, chat submit, config save, and responsive rail collapse effect into `components/front/staff/useStaffAssistantAdmin.ts`.
- [x] B42.2 Move the right-rail assistant chat/render content into `components/front/staff/StaffAssistantRailContent.tsx` while keeping nav selection ownership in the container.
- [x] B42.3 Keep existing assistant config panel integration through `StaffAdminUtilityPanels`; it now receives state/actions from the new assistant hook instead of container-local state.
- [x] B42.4 Add focused tests in `components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx` and `components/front/staff/__tests__/StaffAssistantRailContent.test.tsx` covering hook initialization, chat send, config save timeout, render, placeholder, and callback wiring.
- [x] B42.5 Validation: `npm run test -- components/front/staff/__tests__/StaffAssistantRailContent.test.tsx components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 84 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B42.6 LOC impact: `StaffUsersAdminClient.tsx` 3,777 → 3,662 (-115); new `StaffAssistantRailContent.tsx` = 95 LOC; new `useStaffAssistantAdmin.ts` = 106 LOC; new tests total 169 LOC.

### Batch 43 — Staff Directory Ownership Hook Extraction
- [x] B43.1 Move staff directory ownership into `components/front/staff/useStaffDirectoryAdmin.ts`: rows, loading, query/category filters, busy state, payroll model options/actions, presence menu state, Clerk sync health/repair/single-user sync, fetch backoff refs, user refresh loop, and presence click-away effect.
- [x] B43.2 Keep shared global error state in the container so existing cross-domain error routing (`handleStaffAuthFailure`, reports, payments, create staff) remains unchanged; the new hook receives `setError`.
- [x] B43.3 Preserve profile modal interop by wiring `refreshRowsRef` to the hook `fetchRows` and `updateRowAvatarRef` to the hook `updateRowAvatar`.
- [x] B43.4 Update the source-level payroll cache regression test to scan `useStaffDirectoryAdmin.ts` now that `/api/staff/payroll/payment-models` moved out of the container.
- [x] B43.5 Add focused hook tests in `components/front/staff/__tests__/useStaffDirectoryAdmin.test.tsx` covering initial staff/payroll loading with no-store fetches, row avatar update, and inaccessible-users-nav clearing/no-fetch behavior.
- [x] B43.6 Validation: `npm run test -- components/front/staff/__tests__/useStaffDirectoryAdmin.test.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 97 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B43.7 LOC impact: `StaffUsersAdminClient.tsx` 3,662 → 3,298 (-364); new `useStaffDirectoryAdmin.ts` = 454 LOC; new `__tests__/useStaffDirectoryAdmin.test.tsx` = 112 LOC.

### Batch 44 — Teacher Performance Ownership Hook Extraction
- [x] B44.1 Move teacher assignment/performance ownership into `components/front/staff/useStaffTeacherAdmin.ts`: selected teacher state, assigned teacher state, recurrence/course assignment draft, dirty detection, hydration from selected teacher, metrics view, review cycle state, derived teacher metrics, AI tips, assignment save, and review-cycle save.
- [x] B44.2 Keep staff directory refresh ownership in `useStaffDirectoryAdmin`; teacher hook receives a `refreshRows` callback so save actions preserve the existing post-save refresh behavior without owning directory filters.
- [x] B44.3 Replace container-owned teacher state/derived calculations/actions with the hook surface used by `StaffTeacherAssignmentPanel` and `StaffPerformanceMetricsPanel`.
- [x] B44.4 Add focused hook tests in `components/front/staff/__tests__/useStaffTeacherAdmin.test.tsx` covering teacher selection/metrics derivation, course toggle dirty state, and assignment save refresh behavior.
- [x] B44.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffTeacherAdmin.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffPerformanceMetricsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 4 files / 94 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B44.6 LOC impact: `StaffUsersAdminClient.tsx` 3,298 → 3,045 (-253); new `useStaffTeacherAdmin.ts` = 320 LOC; new `__tests__/useStaffTeacherAdmin.test.tsx` = 109 LOC.

### Batch 45 — Team Schedule Ownership Hook Extraction
- [x] B45.1 Move team schedule/calendar ownership into `components/front/staff/useStaffScheduleAdmin.ts`: schedule month state, loading state, events-by-day state, schedule fetch, calendar cells, month label, and month navigation callbacks.
- [x] B45.2 Keep terminal alert refresh and staff directory critical-window logic consuming `scheduleEventsByDay` from the schedule hook without moving those unrelated domains.
- [x] B45.3 Replace container-owned schedule state/derived values/actions with the hook surface used by `StaffTeamCalendarPanel`.
- [x] B45.4 Add focused hook tests in `components/front/staff/__tests__/useStaffScheduleAdmin.test.tsx` covering schedule fetch, inaccessible school nav no-fetch behavior, and month navigation.
- [x] B45.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffScheduleAdmin.test.tsx components/front/staff/__tests__/StaffTeamCalendarPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 3 files / 78 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B45.6 LOC impact: `StaffUsersAdminClient.tsx` 3,045 → 3,017 (-28); new `useStaffScheduleAdmin.ts` = 78 LOC; new `__tests__/useStaffScheduleAdmin.test.tsx` = 81 LOC.

### Batch 46 — Terminal Alerts + Student PIN Ownership Hook Extraction
- [x] B46.1 Move terminal PIN alert ownership and student PIN recovery workflow into `components/front/staff/useStaffPinAdmin.ts`: terminal alert state/fetch/sort/refresh cadence, payment-board refresh composition, student PIN modal state, open/close flows, reason/custom PIN validation, provisional PIN submit, reveal/error state.
- [x] B46.2 Keep payment fetching ownership in `useStaffPaymentsAdmin`; the PIN hook composes `fetchPayments` and `fetchPaymentsMonthlySummary` via injected callbacks.
- [x] B46.3 Replace container-owned terminal/student PIN state/actions with the hook surface used by `StaffStudentsBoardPanel` and `StaffAdminModalOverlays`.
- [x] B46.4 Add focused hook tests in `components/front/staff/__tests__/useStaffPinAdmin.test.tsx` covering terminal alert prioritization, opening PIN modal + validation, and provisional PIN submit.
- [x] B46.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffPinAdmin.test.tsx components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 4 files / 88 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B46.6 LOC impact: `StaffUsersAdminClient.tsx` 3,017 → 2,828 (-189); new `useStaffPinAdmin.ts` = 242 LOC; new `__tests__/useStaffPinAdmin.test.tsx` = 116 LOC.

### Batch 47 — School Catalog Ownership Hook Extraction
- [x] B47.1 Move school catalog/package/points ownership into `components/front/staff/useStaffSchoolCatalogAdmin.ts`: school fetch lifecycle, catalog stores, package filters/form/actions, points rule/assignment forms/actions, school-view fetch effect, staff-ops assignment-course fallback, default package-course assignment, and points template sync.
- [x] B47.2 Preserve CourseLink ownership in the container: CourseLink form/actions/state and `allCourseLinksMap` remain outside the hook; `fetchSchoolData` forwards loaded course-link maps via an injected callback.
- [x] B47.3 Replace container-owned school catalog/package/points state/actions with the hook surface used by `useStaffCoursesAdmin`, `useStaffRoomsAdmin`, `StaffSchoolPackagesPointsPanel`, `StaffSchoolRoomsPanel`, and course catalog/studio panels.
- [x] B47.4 Add focused hook tests in `components/front/staff/__tests__/useStaffSchoolCatalogAdmin.test.tsx` covering catalog fetch + CourseLink map forwarding, auth failure routing, package validation/save/delete confirm, points rule save, and staff-ops assignment-course fallback.
- [x] B47.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffSchoolCatalogAdmin.test.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 8 files / 101 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B47.6 LOC impact: `StaffUsersAdminClient.tsx` 2,828 → 2,498 (-330); new `useStaffSchoolCatalogAdmin.ts` = 450 LOC; new `__tests__/useStaffSchoolCatalogAdmin.test.tsx` = 199 LOC.

### Batch 48 — CourseLink Ownership Hook Extraction
- [x] B48.1 Move CourseLink ownership into `components/front/staff/useStaffCourseLinksAdmin.ts`: link lists, form state, editing id, saving/error/success state, all-course link map, stats, load/clear/reset, save/edit/delete/toggle actions.
- [x] B48.2 Preserve the current `courseEditingSlug` boundary by keeping small container wrapper callbacks that pass the current course slug into hook actions.
- [x] B48.3 Keep CourseLink endpoints, validation copy, pricing conversion, silent optional-link loading failure, and CourseLink map forwarding behavior unchanged.
- [x] B48.4 Add focused hook tests in `components/front/staff/__tests__/useStaffCourseLinksAdmin.test.tsx` covering load failure reset, save validation, successful save + refresh, edit form loading, delete edited link reset, and unique stats derivation.
- [x] B48.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffCourseLinksAdmin.test.tsx components/front/staff/__tests__/StaffCourseLinksStep.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 6 files / 96 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B48.6 LOC impact: `StaffUsersAdminClient.tsx` 2,498 → 2,335 (-163); new `useStaffCourseLinksAdmin.ts` = 227 LOC; new `__tests__/useStaffCourseLinksAdmin.test.tsx` = 155 LOC.

### Batch 49 — Self Profile Schedule Ownership Hook Extraction
- [x] B49.1 Move self-profile schedule/calendar ownership into `components/front/staff/useStaffProfileScheduleAdmin.ts`: profile schedule month state, calendar cells, month label, course-title map, self schedule entries, entries-by-day map, Google calendar URL, and ICS data URI.
- [x] B49.2 Keep self profile data ownership in `useStaffSelfProfileAdmin`; the schedule hook receives `resolvedSelfProfile` and course options as inputs only.
- [x] B49.3 Replace container-owned profile schedule memos/state with the hook surface passed into `StaffProfileViewPanel`.
- [x] B49.4 Add focused hook tests in `components/front/staff/__tests__/useStaffProfileScheduleAdmin.test.tsx` covering schedule entry generation, missing end-time fallback, disabled export links for incomplete schedules, and Google/ICS export generation.
- [x] B49.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffProfileScheduleAdmin.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 3 files / 86 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B49.6 LOC impact: `StaffUsersAdminClient.tsx` 2,335 → 2,221 (-114); new `useStaffProfileScheduleAdmin.ts` = 155 LOC; new `__tests__/useStaffProfileScheduleAdmin.test.tsx` = 123 LOC.

### Batch 50 — Staff Create/Invite Ownership Hook Extraction
- [x] B50.1 Move staff create/invite/promote ownership into `components/front/staff/useStaffCreateAdmin.ts`: create form state, busy/message state, submit handler, POST body construction, success/error handling, form reset, and post-create staff directory refresh.
- [x] B50.2 Keep shared global error banner in `StaffUsersAdminClient.tsx`; create hook receives `setError` and uses the existing messages.
- [x] B50.3 Replace container-owned create form state/actions with hook values passed to `StaffAccessCreatePanel`.
- [x] B50.4 Add focused hook tests in `components/front/staff/__tests__/useStaffCreateAdmin.test.tsx` covering normalized category/PIN body, invited message, API error, and network error routing.
- [x] B50.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffCreateAdmin.test.tsx components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 3 files / 83 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B50.6 LOC impact: `StaffUsersAdminClient.tsx` 2,221 → 2,188 (-33); new `useStaffCreateAdmin.ts` = 87 LOC; new `__tests__/useStaffCreateAdmin.test.tsx` = 114 LOC.

### Batch 51 — Payroll + Presence Derived Ownership Hook Extraction
- [x] B51.1 Move payroll/presence derived ownership into `components/front/staff/useStaffPayrollAdmin.ts`: delay modal state, row-by-id map, live session minutes helper, self online/minutes fallback, payroll rows, payroll summary, and delay modal open/close actions.
- [x] B51.2 Keep staff directory ownership in `useStaffDirectoryAdmin`; payroll hook receives rows, current timestamp, current user id, and resolved self profile as inputs.
- [x] B51.3 Replace container-owned payroll/presence/delay derived state/actions with hook values passed into `StaffProfileViewPanel`, `StaffTeamBoardPanel`, `StaffPayrollControlPanel`, and `StaffAdminModalOverlays`.
- [x] B51.4 Add focused hook tests in `components/front/staff/__tests__/useStaffPayrollAdmin.test.tsx` covering payroll row/summary derivation, live session minutes, and delay modal open/close totals.
- [x] B51.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffPayrollAdmin.test.tsx components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 5 files / 102 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B51.6 LOC impact: `StaffUsersAdminClient.tsx` 2,188 → 2,088 (-100); new `useStaffPayrollAdmin.ts` = 140 LOC; new `__tests__/useStaffPayrollAdmin.test.tsx` = 155 LOC.

### Batch 52 — Student Board Derived Ownership Hook Extraction
- [x] B52.1 Move student-board derived ownership into `components/front/staff/useStaffStudentsBoardAdmin.ts`: student/history card aggregation, filtered board/search cards, global student search bridge, settlement bulk refresh composition, visible/filtered payment IDs, pagination state/effects, audit-entry discovery effect, history stats, monthly/current summaries, today/date-range labels, and card context/variant resolution.
- [x] B52.2 Keep payment fetching/filter ownership in `useStaffPaymentsAdmin`; the new hook receives payments, filters, selected payment IDs, summary API data, and injected settlement/refresh/auth callbacks only.
- [x] B52.3 Replace container-owned student-board derived memos/effects/actions with the hook surface passed into `StaffStudentsBoardPanel` and `StaffAdminHistoryOverlays`.
- [x] B52.4 Add focused hook tests in `components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx` covering daily cash board derivation/selection pruning/audit lookup, pagination reset on filter changes, and history context/stat/summary/date-range derivation.
- [x] B52.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 3 files / 84 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B52.6 LOC impact: `StaffUsersAdminClient.tsx` 2,088 → 1,858 (-230); new `useStaffStudentsBoardAdmin.ts` = 387 LOC; new `__tests__/useStaffStudentsBoardAdmin.test.tsx` = 220 LOC.

### Batch 53 — Student Audit + Override Ownership Hook Extraction
- [x] B53.1 Move student audit/override ownership into `components/front/staff/useStaffStudentAuditAdmin.ts`: override modal student state, override open/close actions, users-with-audit set, audit-entry marking, and current-month audit lookup.
- [x] B53.2 Keep student-board display ownership in `useStaffStudentsBoardAdmin`; the audit hook provides the audit set and lookup callback consumed by the board hook/panel and history overlays.
- [x] B53.3 Replace container-owned audit/override state and callbacks with hook values passed into `StaffStudentsBoardPanel` and `StaffAdminHistoryOverlays`.
- [x] B53.4 Add focused hook tests in `components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx` covering override modal open/close, current-month audit marking, and silent lookup failure behavior.
- [x] B53.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 5 files / 90 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B53.6 LOC impact: `StaffUsersAdminClient.tsx` 1,858 → 1,835 (-23); new `useStaffStudentAuditAdmin.ts` = 58 LOC; new `__tests__/useStaffStudentAuditAdmin.test.tsx` = 90 LOC.

### Batch 54 — School Workspace Composition Extraction
- [x] B54.1 Move the school workspace composition wrapper into `components/front/staff/StaffSchoolWorkspacePanel.tsx`: school visibility guard, catalog shell composition, wizard save gating, source-contract markers, and the ordered child panel composition for reservations, rooms, course studio, course catalog, packages, and points.
- [x] B54.2 Keep school/course/rooms/package ownership in existing hooks and panels; this batch is render-composition only and keeps the container building existing prop groups.
- [x] B54.3 Replace the in-container school workspace subtree with `<StaffSchoolWorkspacePanel />` while preserving wizard submit behavior for courses/packages final steps.
- [x] B54.4 Add focused render tests in `components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx` covering hidden state, visible composition, and wizard-save enable/disable gating.
- [x] B54.5 Validation: `npm run test -- components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 7 files / 91 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B54.6 LOC impact: `StaffUsersAdminClient.tsx` 1,835 → 1,804 (-31); new `StaffSchoolWorkspacePanel.tsx` = 83 LOC; new `__tests__/StaffSchoolWorkspacePanel.test.tsx` = 149 LOC.

### Batch 55 — Portal Shell + Access Lifecycle Hook Extraction
- [x] B55.1 Move portal shell/access lifecycle ownership into `components/front/staff/useStaffPortalShellAdmin.ts`: current time ticker, active nav state, allowed/visible nav derivation, section visibility booleans, access booleans, nav label, nav selection/assistant expansion bridge, assignable roles, target-management guard, minimum loading delay, auth-failure redirect handling, and query-param nav hydration.
- [x] B55.2 Keep assistant chat/config ownership in `useStaffAssistantAdmin`; the shell hook receives an injected assistant-rail expansion callback and returns the active nav label used by assistant messages.
- [x] B55.3 Replace container-owned shell/access state/effects/memos/callbacks with hook values used by existing panels and hooks.
- [x] B55.4 Add focused hook tests in `components/front/staff/__tests__/useStaffPortalShellAdmin.test.tsx` covering nav/role derivation, query-param nav selection, assistant rail expansion, and auth failure handling.
- [x] B55.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffPortalShellAdmin.test.tsx components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 3 files / 79 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B55.6 LOC impact: `StaffUsersAdminClient.tsx` 1,804 → 1,735 (-69); new `useStaffPortalShellAdmin.ts` = 176 LOC; new `__tests__/useStaffPortalShellAdmin.test.tsx` = 104 LOC.

### Batch 56 — Portal Data Lifecycle Hook Extraction
- [x] B56.1 Move portal data lifecycle effects into `components/front/staff/useStaffPortalDataLifecycle.ts`: checkout-menu outside-click closing, staff request fetch trigger, payment-change request fetch trigger, self-profile fetch trigger, and profile-scope request fetch trigger.
- [x] B56.2 Keep request/profile ownership in `useStaffRequestsAdmin` and `useStaffSelfProfileAdmin`; the lifecycle hook receives existing fetch callbacks and view/access flags only.
- [x] B56.3 Replace container-owned data lifecycle effects with a single hook call.
- [x] B56.4 Add focused hook tests in `components/front/staff/__tests__/useStaffPortalDataLifecycle.test.tsx` covering staff-ops request fetching, profile request/profile fetching, and checkout-menu outside click closing.
- [x] B56.5 Validation: `npm run test -- components/front/staff/__tests__/useStaffPortalDataLifecycle.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/useStaffRequestsAdmin.test.tsx components/front/staff/__tests__/useStaffSelfProfileAdmin.test.tsx` passed focused tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0.
- [x] B56.6 LOC impact: `StaffUsersAdminClient.tsx` 1,735 → 1,718 (-17); new `useStaffPortalDataLifecycle.ts` = 66 LOC; new `__tests__/useStaffPortalDataLifecycle.test.tsx` = 97 LOC.

### Batch 57 — School Workspace Prop Assembly Extraction
- [x] B57.1 Move the large school workspace prop assembly out of `StaffUsersAdminClient.tsx` into `components/front/staff/buildStaffSchoolWorkspaceProps.ts`, including catalog, room reservation, rooms, course studio, course catalog, packages, and points prop groups.
- [x] B57.2 Keep existing school/course/rooms/package ownership hooks unchanged; the builder consumes existing admin hook surfaces and formatters, then returns the exact `StaffSchoolWorkspacePanel` props.
- [x] B57.3 Replace the in-container 250+ line school workspace prop tree with `const schoolWorkspaceProps = buildStaffSchoolWorkspaceProps(...)` and `<StaffSchoolWorkspacePanel {...schoolWorkspaceProps} />`.
- [x] B57.4 Remove now-stale container destructuring for school/course/room/course-link values that are consumed only by the builder.
- [x] B57.5 Validation: `npm run test -- components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 7 files / 91 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0; `git diff --check` clean.
- [x] B57.6 LOC impact: `StaffUsersAdminClient.tsx` 1,718 → 1,314 (-404); new `buildStaffSchoolWorkspaceProps.ts` = 451 LOC.

### Batch 58 — Students Board Prop Assembly Extraction
- [x] B58.1 Move the large `StaffStudentsBoardPanel` prop assembly out of `StaffUsersAdminClient.tsx` into `components/front/staff/buildStaffStudentsBoardPanelProps.ts`, including loading status, Clerk sync, terminal alerts, controls, card, and pagination prop groups.
- [x] B58.2 Keep existing ownership hooks unchanged: payment/filter state remains in `useStaffPaymentsAdmin`, terminal PIN state/actions in `useStaffPinAdmin`, directory/Clerk sync in `useStaffDirectoryAdmin`, student-board derivation in `useStaffStudentsBoardAdmin`, and audit/override ownership in `useStaffStudentAuditAdmin`.
- [x] B58.3 Replace the in-container `<StaffStudentsBoardPanel ...>` prop tree with `const studentsBoardPanelProps = buildStaffStudentsBoardPanelProps(...)` and `<StaffStudentsBoardPanel {...studentsBoardPanelProps} />`.
- [x] B58.4 Remove now-stale container destructuring for portal shell, directory, payments, PIN, audit, and student-board values consumed only by the builder.
- [x] B58.5 Validation: `npm run test -- components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts` passed 4 files / 87 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0; `git diff --check` clean.
- [x] B58.6 LOC impact: `StaffUsersAdminClient.tsx` 1,314 → 1,180 (-134); new `buildStaffStudentsBoardPanelProps.ts` = 232 LOC.

### Batch 59 — Staff Users Admin View Shell Extraction (Planned)

#### Batch 59 Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 540–860 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 View shell extraction → PR2 follow-up touch-ups |
| Delivery strategy | ask-on-risk (interactive / ask-always) |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

#### Suggested Work Units (Batch 59 only)

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Create render-only `StaffUsersAdminView` and move final JSX composition into it | PR1 | Base = feature/tracker branch; no behavior/effect/state moves |
| 2 | Replace container return with grouped view props object + parity cleanups | PR2 | Base = PR1 branch if chained; keep same UI copy/classes/handlers |

- [x] B59.1 Create `components/front/staff/StaffUsersAdminView.tsx` as a **render-only** shell that receives grouped props and renders the current final JSX composition from `StaffUsersAdminClient.tsx` without changing behavior.
- [x] B59.2 Define grouped prop contracts (avoid 80+ flat props) in `StaffUsersAdminView.tsx` and `StaffUsersAdminClient.tsx` using cohesive objects (recommended groups: `shell`, `boards`, `modals`, `assistant`, `statusBanners`, `actions`, `formatters`).
- [x] B59.3 In `components/front/staff/StaffUsersAdminClient.tsx`, replace the current container `return (...)` with `const staffUsersAdminViewProps = { ...groupedProps }` and `return <StaffUsersAdminView {...staffUsersAdminViewProps} />`.
- [x] B59.4 Keep ownership boundaries unchanged: **no** state/effects/fetches/hooks moved; `StaffUsersAdminClient.tsx` remains orchestration owner, and `StaffUsersAdminView.tsx` remains presentational only.
- [x] B59.5 Preserve source-contract guard markers and no-touch boundaries (`CourseLink` / `consecutive-course-link` internals, auth/permissions, endpoint contracts, copy/classes/ARIA, existing callback semantics).
- [x] B59.6 Add/update focused render wiring tests in `components/front/staff/__tests__/StaffUsersAdminView.test.tsx` and update container tests in `components/front/staff/__tests__/StaffUsersAdminClient.test.ts` only for new view-entry wiring assertions (no behavior expectation changes).
- [x] B59.7 Post-implementation validation commands (do not run in planning phase): `npm run test -- components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx && npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffUsersAdminView.tsx components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0 && npx tsc --noEmit && git diff --check`.
- [x] B59.8 Rollback boundary: if parity drifts or source-contract tests fail, revert `StaffUsersAdminView.tsx` and restore the prior in-container `return` block in `StaffUsersAdminClient.tsx`; keep hooks/domain ownership files untouched so rollback stays isolated to this view-shell slice.

Batch 59 Slice 1 evidence:
- `npm run test -- components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 89 tests.
- `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffUsersAdminView.tsx components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0` clean.
- `npx tsc --noEmit` exit 0.
- `git diff --check` clean.

Batch 59 Slice 2 evidence:
- Extracted `staffUsersAdminViewProps` composition into `components/front/staff/buildStaffUsersAdminViewProps.ts` and replaced container assembly with `buildStaffUsersAdminViewProps(...)` call.
- `npm run test -- components/front/staff/__tests__/buildStaffUsersAdminViewProps.test.ts` passed 1 file / 1 test.
- `npm run test -- components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 5 files / 89 tests.
- `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffUsersAdminView.tsx components/front/staff/buildStaffUsersAdminViewProps.ts components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0` clean.
- `npx tsc --noEmit` exit 0.
- `git diff --check` clean.
- LOC impact: `StaffUsersAdminClient.tsx` 1,120 → 928 (-192); new `buildStaffUsersAdminViewProps.ts` = 153 LOC.

### Batch 60 — Staff Users Admin Composition Hook Extraction (Planned)

#### Batch 60 Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 260–420 total |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 composition hook + PR2 call-site cleanup (if needed) |
| Delivery strategy | ask-on-risk (interactive / ask-always) |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

#### Suggested Work Units (Batch 60 only)

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Introduce `useStaffUsersAdminComposition.ts` and move orchestration/composition glue out of container | PR1 | Base = feature/tracker branch; no domain hook internals moved |
| 2 | Tighten container to hook invocation + view builder handoff + parity tests | PR2 | Base = PR1 branch if chained; no fetch/state ownership migration except safe ref/callback bridges |

- [x] B60.1 Create `components/front/staff/useStaffUsersAdminComposition.ts` as a composition hook that receives existing domain hook surfaces and assembles the view props without changing domain hook internals.
- [x] B60.2 In `useStaffUsersAdminComposition.ts`, group outputs for the existing view/builder handoff and centralize school workspace, students board, and top-level view prop composition.
- [x] B60.3 Scope guard: all fetch/effect/state internals stayed inside existing domain hooks; no endpoint/auth/permission/copy/class/ARIA contracts changed.
- [x] B60.4 Update `components/front/staff/StaffUsersAdminClient.tsx` to become a thinner container: local refs/state, domain hook invocations, lifecycle hook, `useStaffUsersAdminComposition(...)`, and `<StaffUsersAdminView {...staffUsersAdminViewProps} />`.
- [x] B60.5 No separate composition types module was needed; the composition input type stays colocated with the hook.
- [x] B60.6 Focused composition behavior remained covered through the existing `buildStaffUsersAdminViewProps.test.ts` callback/adaptor test plus `StaffUsersAdminView` and container integration tests; no new hook test was added because the hook is assembly-only and the view-builder contract remains the behavior seam.
- [x] B60.7 Existing `StaffUsersAdminClient.test.ts`, `buildStaffUsersAdminViewProps.test.ts`, and `StaffUsersAdminView.test.tsx` stayed green with no behavior expectation changes.
- [x] B60.8 Validation: `npm run test -- components/front/staff/__tests__/buildStaffUsersAdminViewProps.test.ts components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx` passed 4 files / 79 tests; touched-file ESLint clean with `--max-warnings=0`; `npx tsc --noEmit` exit 0; `git diff --check` clean.
- [x] B60.9 Rollback boundary: revert `useStaffUsersAdminComposition.ts` and restore pre-B60 composition in `StaffUsersAdminClient.tsx`; domain hooks and presentational modules remain untouched.

Batch 60 evidence:
- Extracted top-level view composition into `components/front/staff/useStaffUsersAdminComposition.ts`.
- `StaffUsersAdminClient.tsx` now invokes `useStaffUsersAdminComposition(...)` and renders `<StaffUsersAdminView {...staffUsersAdminViewProps} />`.
- LOC impact: `StaffUsersAdminClient.tsx` 928 → 602 (-326); new `useStaffUsersAdminComposition.ts` = 244 LOC.
