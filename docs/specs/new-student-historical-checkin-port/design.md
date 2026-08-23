# New Student Historical Check-in Production Port - Design

## Intent

Extend the existing New Student modal and `/api/staff/students` contract with one optional persisted-class assignment. The change is a localized production slice, not a Staff Board or attendance-override refactor.

## Component Boundaries

| Area | File | Responsibility |
|---|---|---|
| Board entry and render | `components/front/staff/StaffStudentsBoardPanel.tsx` | Keep the existing `+ New student` trigger and modal placement. |
| Modal controls | `components/front/staff/CreateStudentModal.tsx` | Add optional New York date and persisted-session selection UI. |
| Client state and requests | `components/front/staff/useStaffCreateStudentAdmin.ts` | Fetch selectable sessions for the chosen date, include optional assignment data in the existing create request, surface failures, and refresh only after success. |
| Access composition | `components/front/staff/buildStaffStudentsBoardPanelProps.ts` | Preserve the existing `canOperateStudentEdits` visibility gate and refresh injection. |
| Server contracts | `app/api/staff/students/sessions/route.ts`, `app/api/staff/students/route.ts` | Port the constrained session-selection read, then perform identity/create-or-reuse plus optional assignment under the existing student-operational authorization. |
| Local identity outcome | `lib/users.ts` | Provide the caller a local-create versus reuse outcome without changing persisted data. |
| Existing primitives | `lib/packages.ts`, `lib/audit/student-data-audit.ts`, Prisma models | Reserve package credit in transaction and record immutable, separate profile/attendance events. |

## Request Flow

1. An owner, admin, or front-desk user opens the existing modal.
2. The modal optionally selects a New York date in the inclusive 14-day historical window and fetches only persisted sessions for that date.
3. The submission retains the existing create payload and adds date plus `sessionId` only when assignment is enabled.
4. The server rate-limits, authorizes, validates the payload, resolves or creates the Clerk and local identity, then resolves the submitted `ClassSession`.
5. In one database transaction, the server rejects duplicate attendance, creates attendance with `checkedInAt: session.startsAt`, reserves an eligible package credit at `session.startsAt` when applicable, and writes the attendance audit.
6. The server writes `profile.created` only when the local identity was actually created. It writes the attendance event separately, so each event preserves its own actor even when the same staff member performs both actions.
7. On success, the existing hook invokes `refreshPaymentsBoard`.

## Validation Rules

- Dates are parsed and compared as `America/New_York` calendar dates. The inclusive range is `[today - 14 calendar days, today]`.
- The client date control is advisory. The server validates the date, the `sessionId`, the resolved session's New York date, and the persisted `ClassSession.startsAt`.
- Requests without an optional assignment preserve the current no-check-in behavior.
- The server never accepts an operation timestamp for historical attendance.
- `_staff_registration` remains solely the positive-amount registration-deposit purchase contract.

## Constraints

- Do not reuse or alter `/api/staff/students/[userId]/attendance`, `/api/staff/students/[userId]/sessions`, or `fast-class-action` for this slice.
- Do not add a database model, migration, dependency, or broad board refactor.
- Do not invent an audit store. `StudentDataAudit` is sufficient, provided local creation is identified correctly.
