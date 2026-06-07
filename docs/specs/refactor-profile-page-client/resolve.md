# Resolve: Spec/Code Alignment for Remaining Profile Refactor

## Resolved Drift and Naming

1. **Bookings hook canonical name is `useProfileBookings`**.
   - Earlier design/task notes referencing `useBookings`/`useProfileBookings` drift are resolved in favor of the actual current module:
   - `components/front/profile/hooks/useProfileBookings.ts`
2. Existing extracted hook names are source-of-truth for remaining decomposition; no hook renames are required in this phase.

## Extraction Boundaries (Locked)

1. `ProfilePageClient.tsx` remains the **composition root**:
   - owns cross-card orchestration state,
   - wires hooks together,
   - passes typed props/actions to section/modal components.
2. New section/modal components are **UI composition units**, not new state containers.
3. Hook ownership remains unchanged:
   - form state in `useProfileForm`
   - bookings/check-in in `useProfileBookings`
   - reschedule flow in `useRescheduleFlow`
   - assign flow in `useAssignClassesFlow`
   - suspend/cancel request flow in `useActionRequestModal`
   - agenda derivations in `useAgendaCalendar`
   - analytics derivations in `useAnalyticsChartData`

## Modal and Right-Rail Behavior Decisions

1. **No behavior changes for right rail actions**:
   - Book opens course picker modal.
   - Change opens reschedule flow with same availability/step logic.
   - Check-in keeps window gating (`CHECK_IN_OPEN_WINDOW_*`) and same submit path.
   - Suspend/Cancel opens existing request modal and keeps validation/branching logic.
2. **No behavior changes for modal flows**:
   - Reschedule remains 3-step (reassignment → confirmation → assign pending).
   - Action request modal keeps SUSPEND/CANCEL branches and optional reassign path.
   - Course picker keeps preferred-first ordering and existing handoff to `EnrollModal`.
3. Existing UX copy strings are frozen; extraction may relocate markup only.

## Security/Contract Guardrails (Locked)

1. No endpoint changes (`/api/profile*` contracts remain intact).
2. No auth flow changes (`canLoadProtectedData` and `e2eAuthBypass` semantics stay intact).
3. No schema/data model changes.
4. No staff module or staff API touches.

## Completion Definition for This Refactor Track

- Remaining blocks are extracted into `sections/` and `modals/` with unchanged behavior and copy.
- `ProfilePageClient.tsx` is reduced to orchestrator-level responsibilities only.
- Validation status is tracked in `validation.md` and executed in validate phase.
