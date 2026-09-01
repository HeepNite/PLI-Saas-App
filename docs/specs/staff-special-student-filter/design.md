# Design

## Data flow

1. The auxiliary catalog lookup selects `slug`, existing pricing fields, and `scheduleRules`.
2. The loader parses each rule set and stores `isSpecialEvent` by slug.
3. The row builder combines canonical `Purchase.specialClassId` linkage with the catalog boolean and projects only `isSpecialEvent` to the client.
4. Shared row predicates enforce Today and History filtering.

## UI state

- Today uses the existing mutually exclusive category state.
- History owns an independent `all | special` reducer field and select control.
- Search fallback receives an explicit permission flag so Special cannot escape its category boundary.

## Verification

Use a focused row regression proving SpecialClass linkage works without a catalog match while preserving catalog-special and ordinary-row coverage, then relevant suites, typecheck, lint, and diff checks.
