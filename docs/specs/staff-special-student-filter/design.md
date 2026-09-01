# Design

## Data flow

1. The auxiliary catalog lookup selects `slug`, existing pricing fields, and `scheduleRules`.
2. The loader parses each rule set and stores `isSpecialEvent` by slug.
3. The row builder projects that semantic boolean to the client.
4. Shared row predicates enforce Today and History filtering.

## UI state

- Today uses the existing mutually exclusive category state.
- History owns an independent `all | special` reducer field and select control.
- Search fallback receives an explicit permission flag so Special cannot escape its category boundary.

## Verification

Use focused API row/loader and staff filter/hook tests, then relevant suites, typecheck, lint, and diff checks.
