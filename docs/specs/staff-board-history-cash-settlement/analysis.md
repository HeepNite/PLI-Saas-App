# Staff Board History Cash Settlement Analysis

## Confirmed defect

History mode renders a settlement checkbox for a card whenever its student has an outstanding balance, but the selection-pruning path retains IDs only for the cash category. Because History mode uses the `history` category, the selected IDs are removed before bulk completion runs.

## Evidence

| Area | Observed behavior | Consequence |
| --- | --- | --- |
| `components/front/staff/cards/PaymentStudentCard.tsx` | The checkbox condition includes cash-channel rows **or** a positive `outstandingBalance`; selectable IDs can therefore include non-cash rows. | Card rows can appear selectable. |
| Payment-board selection flow | Selection pruning retains only IDs in the current eligible/visible set; History category does not currently supply the cash selection set. | A History selection is cleared before bulk settlement. |
| `app/api/staff/payments/bulk/route.ts` | The endpoint loads requested purchases, writes settlement metadata for every loaded record, and only limits the status field to cash records. | A submitted non-cash ID can still have metadata, and in some cases amount, mutated. |
| Bulk settlement side effects | Package synchronization and attendance work already guard on the cash-channel helper. | Validation must occur before the transaction so skipped records cannot enter any update or side-effect loop. |
| Staff payment-board summary | Existing board filter state already distinguishes status (`all`, `paid`, `pending`) and category (`all`, `packages`, `dropin`). | Summary-card clicks can reuse those states without a new query, endpoint, or dashboard filter model. |
| Collected summary card | The card represents a monetary aggregate rather than a result category. | It must activate an ordering over the already-visible board scope, not a filter that changes that scope. |

## Existing constraints to preserve

- Reuse `POST /api/staff/payments/bulk`; no new endpoint is needed.
- Preserve the existing staff guard, authorization, rate limiting, cash settlement metadata, package synchronization, and attendance-credit flow for eligible records.
- The history query is already owned by `useStaffPaymentsAdmin`; its established refresh callback is the localized refresh integration point.
- `outstandingBalance` is presentation data and is not a safe settlement authorization signal.
- Summary-card filtering must reuse the current board's all/status/category controls and must remain independent from settlement eligibility.

## Root cause

The UI has two incompatible concepts of eligibility:

1. Checkbox rendering permits a row based on either cash channel or a student-level outstanding balance.
2. Selection pruning permits only cash-category IDs, while History mode is categorized as `history`.

The API compounds the boundary problem by treating every fetched ID as updateable metadata before checking whether it is cash.

## Confirmed summary-card behavior

Students resets the board to all results. Paid and Pending select the existing payment-status states. Packages and Drop-in select the existing purchase-category states. Collected does not receive a filter action: it activates descending accumulated-spend ordering for the students already visible in the current board scope.

The calculation uses only payment rows included by the current board scope and the board's established money representation. It retains zero-spend students, preserves existing board order for equal accumulated amounts, and recomputes after a filter changes the scope. The active Collected state is independent from the active filter state.

This behavior is presentation-level filtering and ordering only. It neither changes the History query semantics nor broadens the cash-only, exact-record settlement boundary.

## Risk boundaries

| Risk | Required control |
| --- | --- |
| A stale or manipulated client submits a card ID | Server-side exact-record validation and deterministic skip before mutation. |
| A record settles between render and request | Re-check unresolved state in the endpoint; skip it to avoid repeated side effects. |
| A mixed student history is mistaken for one debt | Carry and validate purchase IDs only; never settle by user or aggregate balance. |
| Refresh leaves stale selected IDs | Reload active History results, then prune/reconcile against refreshed eligible IDs. |
| Summary-card action changes settlement eligibility | Keep summary filtering separate from exact-record cash eligibility and retain server-side validation. |
| Collected is treated as a result category | Provide no filter transition; apply ordering only after the existing filters establish the visible scope. |
| Equal spend produces unstable card order | Preserve the pre-order board sequence for equal accumulated-spend values. |
| Zero spend is removed by ordering | Retain every student included by the active filters and place zero-spend students after positive-spend students. |

## Open questions

None. The deterministic-skip response contract is specified in `resolve.md` so mixed or stale bulk IDs do not broaden the payment boundary.
