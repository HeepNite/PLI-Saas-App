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
- [ ] Evaluate response-row mapping extraction.
- [ ] Continue only if the slice reduces responsibility and cognitive load.
