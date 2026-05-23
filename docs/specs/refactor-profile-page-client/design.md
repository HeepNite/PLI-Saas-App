# Design: ProfilePageClient Remaining Decomposition

## Current Architecture Snapshot

`components/front/profile/ProfilePageClient.tsx` is still the client composition root (**2125 LOC**) and already consumes extracted profile-only modules. Foundation concerns live in `profile-types.ts`, `profile-constants.ts`, `profile-formatters.ts`, `profile-utils.ts`, and `mock-profile.ts`. Behavior/state is already split across hooks: `useProfileForm`, `useProfilePackages`, `usePointsHistory`, `useActionRequests`, `useStudentPinForm`, `useProfileBookings`, `useRescheduleFlow`, `useAssignClassesFlow`, `useActionRequestModal`, `useAgendaCalendar`, `useAnalyticsChartData`, and layout/cache hooks.

Extracted presentational sections already exist for `ProfileLeftRail`, `StudentMomentsCard`, `PliCoinsCard`, `PointsHistoryCard`, `MedalsCard`, and `GearCard`. Remaining JSX in `ProfilePageClient.tsx` is the center cards, right rail, and modal trees listed below.

## Target File Structure

```text
components/front/profile/
  ProfilePageClient.tsx              # orchestrates hooks, derived props, modal open state
  sections/
    ProfileLeftRail.tsx              # existing
    StudentMomentsCard.tsx           # existing
    PliCoinsCard.tsx                 # existing
    PointsHistoryCard.tsx            # existing
    MedalsCard.tsx                   # existing
    GearCard.tsx                     # existing
    ProfileFormCard.tsx              # move profile form card markup
    StudentPinCard.tsx               # move PIN management markup
    AnalyticsCard.tsx                # move metric tabs/chart/donut markup
    AgendaCard.tsx                   # move calendar/month/day markup
    AssignClassesCard.tsx            # move assign-to-package markup
    ProfileRightRail.tsx             # move book/change/check-in/request/recent requests rail
  modals/
    RescheduleModal.tsx              # move 3-step reschedule tree
    ActionRequestModal.tsx           # move suspend/cancel request tree
    CoursePickerModal.tsx            # move course picker tree
```

No staff paths, API contracts, schemas, auth gates, or UI copy are changed.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Composition root | Keep `ProfilePageClient.tsx` as orchestrator. | It already wires Clerk, catalog courses, hooks, derived collections, and modal open state; moving orchestration into sections would create hidden behavior changes. |
| State ownership | Hooks own behavior; sections/modals render props and call callbacks. | `resolve.md` locks current hook ownership and prevents new state containers. |
| Component role | New files are presentational/composition units with typed props. | Extraction should reduce file size without introducing new data fetching or domain decisions. |
| Naming | Use actual `useProfileBookings`; do not introduce `useBookings`. | Aligns with resolved drift and current exports. |
| Scope | Profile-only files under `components/front/profile/**`. | Preserves the no-staff/no-contract guardrails from requirements. |

## Data and State Flow

```text
Clerk/catalog/profile APIs
        ↓
ProfilePageClient
  ├─ calls existing hooks
  ├─ derives small view props and grouped prop objects
  ├─ owns cross-section modal visibility/handoffs
  └─ renders sections/modals
          ↓
   presentational component calls typed callbacks only
```

Sections and modals must not call profile endpoints, mutate shared flow state directly, or decide product behavior. They may keep only DOM-local refs or event-local values when unavoidable; durable UI state stays in the existing hook/orchestrator owner.

## Prop Contract Strategy

Use local `type <ComponentName>Props` in each extracted component. Prefer cohesive prop groups that mirror existing hook outputs and view models (`profileForm`, `studentPin`, `analytics`, `agenda`, `assignClasses`, `rightRailActions`, `modalState`) instead of long unrelated parameter lists. The orchestrator should build those objects close to hook calls so callbacks remain traceable. Do not create a global “profile context” or new shared store unless a later spec explicitly changes state ownership.

## File Change Plan

| File | Action | Description |
|---|---|---|
| `ProfilePageClient.tsx` | Modify | Replace remaining card/rail/modal JSX with extracted components; keep hook wiring and callback composition. |
| `sections/ProfileFormCard.tsx` | Create | Existing profile details form card. |
| `sections/StudentPinCard.tsx` | Create | Existing PIN and recovery UI. |
| `sections/AnalyticsCard.tsx` | Create | Existing analytics tabs/chart/donut UI. |
| `sections/AgendaCard.tsx` | Create | Existing agenda calendar UI. |
| `sections/AssignClassesCard.tsx` | Create | Existing assign classes UI. |
| `sections/ProfileRightRail.tsx` | Create | Existing right rail actions and recent requests. |
| `modals/RescheduleModal.tsx` | Create | Existing reschedule modal flow. |
| `modals/ActionRequestModal.tsx` | Create | Existing suspend/cancel modal flow. |
| `modals/CoursePickerModal.tsx` | Create | Existing course picker before `EnrollModal`. |

## Validation Strategy

Validation is defined in `docs/specs/refactor-profile-page-client/validation.md`. Apply slices should use that matrix and, during validate phase only, run `npx tsc --noEmit`, `npx eslint components/front/profile/`, `npx vitest run`, and `node scripts/run-playwright.mjs e2e/profile.spec.ts`. Any failure after extraction is a refactor regression unless proven pre-existing.

## Review Budget and Slice Boundaries

The remaining extractions will likely exceed the **400 changed-line** review budget if implemented as one batch. Apply should proceed in small, reviewable slices: center cards first, then right rail, then modals, with validation evidence per slice. Chained PRs or sequential small PRs are recommended before apply starts.

## Open Questions

- None blocking. Behavior, names, scope, and validation ownership are resolved by `requirements.md`, `analysis.md`, `resolve.md`, and `validation.md`.
