# Refactor Staff Payments Route Analysis

## Route structure

`app/api/staff/payments/route.ts` currently performs these responsibilities in one handler:

1. Rate limiting and staff authorization.
2. Request/query parsing and mode selection.
3. History range validation.
4. Today NY window calculation.
5. Initial purchase query.
6. Consecutive purchase normalization and deduplication.
7. Today attendance-only row synthesis.
8. Supplemental data loading for points, packages, locations, attendances, users, pins, and Clerk.
9. Response row mapping.
10. Summary/meta response shaping.

## First safe seam

Request parsing is the safest first seam because it can be tested directly without Prisma or Clerk and has clear domain language: today, history, and user history payments views.

## Gate finding

The first attempted extraction mixed query parsing and temporal calculation. This violated SRP because pure request parsing should not compute NY day boundaries.

## Decision

Fix the request model before further implementation:

- parser module for query/mode/range only
- time module for today window
- discriminated union to remove non-null assertions
