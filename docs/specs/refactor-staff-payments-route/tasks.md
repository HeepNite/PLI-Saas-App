# Refactor Staff Payments Route Tasks

## Phase 1 — Request model gate

- [x] Create active spec for the refactor.
- [x] Split pure query parsing from temporal calculation.
- [x] Model request parsing as a discriminated union.
- [x] Add direct unit tests for request parsing:
  - [x] today mode
  - [x] valid history mode
  - [x] history without from/to/date
  - [x] invalid from/to format
  - [x] from after to
  - [x] userHistory mode
- [x] Remove `historyRange!` from the route.
- [x] Run focused staff payments tests.
- [x] Run `npx tsc --noEmit`.

## Phase 2 — Next candidate slices

- [x] Evaluate query-building extraction.
- [x] Extract purchase `where/orderBy/take` construction into `payments-query.ts`.
- [x] Add direct unit tests for the payments query builder:
  - [x] today mode NY window scoping
  - [x] today mode text search + date scoping
  - [x] history mode metadata date range + truncation fetch limit
  - [x] user history user/date scoping
- [x] Run focused staff payments tests.
- [x] Run `npx tsc --noEmit`.
- [x] Remove inline non-null assertions for today session bounds.
- [x] Add direct tests for staff payments time helpers.
- [x] Evaluate response-row mapping extraction.
- [x] Extract visible payment row mapping into `payments-row.ts`.
- [x] Add direct tests for response row mapping:
  - [x] default visible payment fields and student PIN fallback
  - [x] cash outstanding balance settlement status
  - [x] completed card settlement status
  - [x] package-credit attendance inference guard
  - [x] history package class number from linked attendance
- [x] Confirm the slice reduces responsibility and cognitive load.
