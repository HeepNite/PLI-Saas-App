# Staff Board History Cash Settlement Resolution

## Resolved decisions

| Topic | Decision |
| --- | --- |
| Active spec | `docs/specs/staff-board-history-cash-settlement/` is the sole source of truth for this bug fix. |
| Eligible record | A displayed purchase is eligible only when its persisted channel resolves to cash and its persisted settlement state is unresolved. An unresolved synthetic `att-<attendanceId>` row is a separate eligible attendance-only debt class; ordinary unknown-channel purchases remain ineligible. |
| Unit of settlement | The exact purchase record ID or synthetic attendance ID, never a user ID, aggregate balance, or all payments on a student card. |
| History UI | Render and retain selection only for eligible cash purchase IDs and unresolved synthetic attendance IDs. Do not use `outstandingBalance` to expose a control. |
| Card/Stripe boundary | Card and Stripe-backed purchases are never selected, updated, amount-corrected, metadata-updated, package-synchronized, or attendance-processed by this endpoint. |
| Invalid/stale IDs | Deterministically skip missing, non-cash, Stripe-backed, and already-settled records from settlement mutation and update counts. Missing, non-cash, and Stripe-backed records run no downstream work. Already-settled cash retries may rerun existing idempotent fix-forward side effects without rewriting settlement audit metadata. Return only actual update counts plus skipped IDs/reasons using the existing bulk response shape extended minimally as needed. |
| Completion action | History mode sends only an eligible unresolved cash purchase ID or synthetic attendance ID for `mark_paid`; it does not expose a History-mode reversal action. |
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

The bulk response MUST distinguish processed records from skipped records and MUST NOT count skipped records as updated. Missing, non-cash, and Stripe-backed purchase records MUST NOT run cash settlement side effects. Already-settled cash retries may run the existing idempotent attendance, package-sync, and credit side effects solely as fix-forward work, without rewriting settlement audit metadata. Synthetic attendance settlement remains isolated per attendance and may report `settlement_failed`. Reasons remain stable, non-sensitive categories such as `not_found`, `not_cash`, `already_settled`, or `settlement_failed`; no additional record data is required.

## Explicit non-goals

- Do not settle a card/Stripe record manually from the staff board.
- Do not infer eligibility from money owed by the user.
- Do not alter Stripe payment state, references, or reconciliation.
- Do not change database schema, authorization, or payment-provider integrations.
- Do not introduce a Collected filter, change current board scope, or change unrelated dashboard summary behavior.
