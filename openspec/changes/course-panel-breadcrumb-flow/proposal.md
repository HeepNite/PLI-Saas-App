# Proposal: Course Panel Breadcrumb Flow

## Intent

Reorganize the School/Courses area into one coherent in-panel process flow so staff can navigate course operations without losing context. Keep the change minimal/localized and preserve all existing APIs, payloads, and validations.

## Scope

### In Scope
- Add an internal breadcrumb/process flow inside the existing `nav=schedule` School panel.
- Group existing course-related blocks into a clear sequence (overview → courses → packages → points → reservations/rooms).
- Preserve current deep-link behavior with existing query params (`nav`, `course`) while improving in-panel orientation.

### Out of Scope
- New backend endpoints, schema changes, or API contract changes.
- Full route migration to nested School subpages.

## Capabilities

### New Capabilities
- `school-course-panel-flow`: Defines breadcrumb-driven in-panel navigation and section sequencing for course management in the School panel.

### Modified Capabilities
- None

## Approach

Use in-page orchestration on top of current School rendering: introduce a lightweight flow state model and breadcrumb UI in `StaffUsersAdminClient`, map flow steps to existing sections, and extract minimal presentational wrappers only where needed to reduce coupling. Keep route/query semantics backward compatible.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/staff/StaffUsersAdminClient.tsx` | Modified | Add breadcrumb/process state and section grouping in current School panel. |
| `app/staff/school/course/[slug]/page.tsx` | Modified | Keep redirect behavior compatible while aligning with new in-panel flow entry. |
| `app/staff/portal/page.tsx` | Modified | Ensure portal query handling remains compatible with School flow state. |
| `app/api/staff/school/courses/route.ts` | Modified | No contract change; verify unchanged usage from UI flow. |
| `app/api/staff/school/course-links/route.ts` | Modified | No contract change; verify course-link metrics continuity. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UI regressions from large component coupling | Med | Extract thin subcomponents for flow presentation only; avoid logic rewrites. |
| Breadcrumb state desync with scroll/section visibility | Med | Define single source of truth for active step and deterministic step mapping. |
| Query param conflicts with existing deep links | Low | Reuse current params first; avoid introducing new required params. |

## Rollback Plan

Revert breadcrumb/process wrapper changes in `StaffUsersAdminClient` and restore prior section rendering order. Since APIs and schemas remain unchanged, rollback is UI-only and low risk.

## Dependencies

- Existing School panel contracts and current query-param navigation behavior.

## Success Criteria

- [ ] Staff can complete course-management tasks from one coherent section with visible step context.
- [ ] Existing links using `nav=schedule` and `course=<slug>` continue to work without behavioral break.
- [ ] No API contract, validation, or schema changes are required.
