# Staff Board History Cash Settlement Design

## Minimal implementation boundary

Use the current payment-board state hook, card presentation component, and `POST /api/staff/payments/bulk` route. Do not introduce a new payment abstraction, endpoint, or schema change.

## Client design

1. Define one local eligibility predicate for a History payment: persisted cash channel and unresolved settlement state.
2. Use that predicate for checkbox rendering, selected IDs, visible-ID selection, selected count, and selection pruning.
3. Remove the outstanding-balance fallback from settlement-control eligibility.
4. In History mode, offer only the completion action for selected eligible cash records.
5. After a successful response, invoke the existing active-query refresh path before selection reconciliation; use the refreshed records to remove settled or skipped IDs.

## Summary-card filter and ordering design

1. Reuse the existing board filter state and callbacks; do not add a parallel summary-filter state, endpoint, or query contract.
2. Map Students to the existing all state, Paid and Pending to the existing status states, and Packages and Drop-in to the existing category states.
3. Represent Collected as board ordering state, independent of the existing filter state. Clicking it must not update any filter, query scope, selection, or payment state.
4. Apply the existing filters first. When Collected ordering is active, derive each visible student's accumulated spend from the payment rows included in that filtered scope, then perform a stable descending sort by the established money value.
5. Preserve pre-sort board order for equal accumulated amounts and retain zero-spend students when the active filter includes them. The Collected active style and active filter style must be independently observable.
6. Keep summary filtering and ordering separate from History settlement eligibility: every completion path still derives eligibility from the exact persisted unresolved cash record and the API validates it again.

## API design

1. Retain request parsing, staff guard, authorization, rate limit, and the 500-ID limit.
2. Load the submitted purchases by ID, then classify each exact record from persisted channel and settlement state.
3. Build the transaction update list from eligible cash records only. Do not create an update for any skipped record.
4. Limit zero-amount adjustment, package synchronization, attendance creation, and credit reservation to the same eligible-record list.
5. Return actual updated count plus deterministic skip information so the client can refresh and reconcile without treating skipped records as settled.

## Test design

| Layer | Coverage |
| --- | --- |
| Client unit/component | History renders a selectable control for an unresolved cash row; it does not render one for card/Stripe rows with an outstanding balance; selection survives History pruning only for eligible cash IDs. |
| Client integration/hook | Completing an eligible History selection posts only its purchase ID, refreshes the active History query on success, and clears/reconciles the selection. |
| Client summary controls | Students sets all; Paid and Pending set the existing status filters; Packages and Drop-in set the existing category filters. Collected changes no filter or selection and activates descending accumulated-spend ordering. |
| Client ordering | Collected orders only the current filtered visible scope; filter changes recompute the ordering. Equal spend preserves pre-sort order, zero-spend students remain visible after positive-spend students, and filter/Collected active styles remain independent. |
| API route | Eligible unresolved cash records are updated and retain existing cash side effects. |
| API route safety | Missing, card, Stripe-backed, and already-settled IDs are skipped; they receive no status, metadata, amount, package, or attendance mutation; response counts and skip reasons are deterministic. |
| Regression | A mixed batch updates only eligible cash records and does not use a user's outstanding balance to select or mutate a different record. |

## Verification constraints

- Run only focused existing client and API tests for the changed payment-board and bulk-settlement surfaces.
- Confirm no test expects a card/Stripe record to be manually settled by this route.
- Confirm summary-card coverage uses existing filter values, creates no Collected filter, and verifies the independent Collected ordering state.
- Do not run deployment, migration, dependency, or Stripe integration changes for this work unit.
