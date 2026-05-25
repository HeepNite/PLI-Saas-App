# Refactor Staff Payments Route Requirements

## Goal

Reduce the cognitive load of `app/api/staff/payments/route.ts` without changing the staff payments API contract.

## Scope

This refactor covers only the staff payments GET route and directly related tests/helpers.

In scope:

- Request/query parsing for staff payments.
- History range validation.
- Today-mode date window calculation only as a separate responsibility from parsing.
- Future slices for query building and response mapping after the request model is clean.

Out of scope:

- Staff admin component refactor.
- Enroll modal refactor.
- Payment behavior changes.
- Schema changes.
- Auth/rate-limit changes.

## Requirements

### R1 — Preserve API behavior

The staff payments GET route MUST preserve the current response shape, status codes, query parameters, and filtering behavior.

#### Acceptance criteria

- Existing staff payments API tests continue to pass.
- Invalid history ranges still return HTTP 400 with the existing error messages.
- Today, history, and user history modes resolve as before.

### R2 — Use a single request model

The route MUST parse request/query state into a named, typed request model before loading data.

#### Acceptance criteria

- Query parsing is testable without Prisma, Clerk, rate limiting, or date/time helpers.
- Mode-specific fields are represented by a discriminated union.
- History-only fields are only available on the history request variant.

### R3 — Keep parsing separate from temporal calculation

The query parser MUST NOT compute `todayNY`, `startOfTodayNY`, or `endOfTodayNY`.

#### Acceptance criteria

- Temporal calculation lives in a separate function/module.
- Unit tests for request parsing do not need to mock `@/lib/class-schedule`.

### R4 — Remove unsafe non-null assertions

The route MUST NOT use `historyRange!` or equivalent non-null assertions for mode-specific request state.

#### Acceptance criteria

- Type narrowing or explicit mode variables provide access to history range values.
- `npx tsc --noEmit` passes.

### R5 — Refactor for understanding, not line movement

Every extraction MUST name a real responsibility and reduce cognitive load in the route handler.

#### Acceptance criteria

- No generic `helpers` dumping ground is introduced.
- Each new module has a single clear responsibility.
- Future slices continue only after the active spec is updated.
