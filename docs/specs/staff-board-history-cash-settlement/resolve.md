# Staff Board History Cash Settlement Resolution

## Resolved decisions

| Topic | Decision |
| --- | --- |
| Active spec | `docs/specs/staff-board-history-cash-settlement/` is the sole source of truth for this bug fix. |
| Eligible record | A displayed purchase is eligible only when its persisted channel resolves to cash and its persisted settlement state is unresolved. |
| Unit of settlement | The purchase record ID, never a user ID, aggregate balance, or all payments on a student card. |
| History UI | Render and retain selection only for eligible cash purchase IDs. Do not use `outstandingBalance` to expose a control. |
| Card/Stripe boundary | Card and Stripe-backed purchases are never selected, updated, amount-corrected, metadata-updated, package-synchronized, or attendance-processed by this endpoint. |
| Invalid/stale IDs | Deterministically skip missing, non-cash, Stripe-backed, and already-settled records. Return only actual update counts plus skipped IDs/reasons using the existing bulk response shape extended minimally as needed. |
| Completion action | History mode sends only an eligible unresolved cash ID for `mark_paid`; it does not expose a History-mode reversal action. |
| Refresh | On a successful response, reload the active History query and clear/reconcile submitted selections after the refresh. |
| Compatibility | Preserve current authorized cash settlement behavior outside this localized History eligibility correction. |
| Students summary card | Set the existing board filters to all students/payments. |
| Paid and Pending summary cards | Set the existing payment-status filter to `paid` or `pending`, respectively. |
| Packages and Drop-in summary cards | Set the existing purchase-category filter to `packages` or `dropin`, respectively. |
| Collected summary card | Activates accumulated-spend ordering within the current board scope. It has no filter transition and does not change query scope, selection, or payment state. |

## Collected ordering contract

1. Existing filter state determines the current board scope first: Students/all, Paid/paid, Pending/pending, Packages/packages, and Drop-in/dropin retain their current meanings.
2. Collected then orders only the students visible in that scope by their accumulated in-scope spend, descending.
3. The accumulated amount uses the board's established money representation and only payment rows included in the active scope; it does not reach outside that scope or infer settlement eligibility.
4. A zero-spend student remains in the result when the active filter includes that student and sorts after positive-spend students.
5. Ties preserve the existing board order, making the ordering stable and deterministic.
6. Filter and ordering are independent active states. Collected remains active when a summary filter changes; the new filtered result is then ordered by accumulated spend. The active filter card and active Collected card must remain independently identifiable.
7. Re-clicking active Collected is idempotent and does not change filter, query scope, selection, or payment state.

## API response rule

The bulk response MUST distinguish processed records from skipped records. It MUST NOT count skipped records as updated or run cash settlement side effects for them. Reasons should be stable, non-sensitive categories such as `not_found`, `not_cash`, or `already_settled`; no additional record data is required.

## Explicit non-goals

- Do not settle a card/Stripe record manually from the staff board.
- Do not infer eligibility from money owed by the user.
- Do not alter Stripe payment state, references, or reconciliation.
- Do not change database schema, authorization, or payment-provider integrations.
- Do not introduce a Collected filter, change current board scope, or change unrelated dashboard summary behavior.
