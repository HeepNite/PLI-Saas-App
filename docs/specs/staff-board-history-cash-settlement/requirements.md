# Staff Board History Cash Settlement Requirements

## Outcome

In payment-board History mode, authorized staff can complete a displayed unresolved cash payment. Card and Stripe-backed payments remain visible for history, but cannot be selected or mutated by this settlement flow. In the staff payment-board summary, the count and category cards apply their confirmed existing-board filters; Collected activates a descending accumulated-spend ordering within the current board scope without applying a filter.

## Scope

| In scope | Out of scope |
| --- | --- |
| History-mode eligibility, selection, bulk settlement validation, refresh, and tests | Stripe/Card collection, reconciliation, webhooks, schema changes, and unrelated payment-board refactors |
| Exact purchase-record settlement state | User-level outstanding-balance settlement |
| Summary-card filtering for Students, Paid, Pending, Packages, and Drop-in; Collected ordering | A Collected filter, changes outside this board, or unrelated dashboard behavior |

## Requirements

### R1 — History selection exposes only eligible settlement records

History mode MUST offer selection only when the displayed purchase record is both cash-channel and unresolved, or when the displayed row is an unresolved synthetic attendance debt. A card, Stripe-backed, or ordinary unknown-channel purchase row MUST not render a settlement selection control, even when the student has an outstanding balance.

#### Scenario: Displayed unresolved cash payment
- GIVEN History mode displays a cash purchase whose settlement state is unresolved
- WHEN authorized staff selects it and requests completion
- THEN the exact displayed purchase ID is retained through the bulk-settlement request.

#### Scenario: Displayed card payment
- GIVEN History mode displays a card or Stripe-backed purchase, regardless of its balance or displayed status
- WHEN staff views the card
- THEN no settlement selection control is available for that record and the board does not submit its ID for settlement.

### R2 — Eligibility is exact-record based

The board and API MUST determine eligibility from the exact submitted record, not from a student-level outstanding balance, aggregate card state, or another purchase belonging to the same user. A synthetic `att-<attendanceId>` row is a distinct attendance-only debt input and MUST NOT make an ordinary unknown-channel purchase eligible.

#### Scenario: Student has mixed payment history
- GIVEN a student has an unresolved cash purchase and a separate card purchase
- WHEN staff completes the cash purchase from History mode
- THEN only the selected cash purchase is eligible for mutation; the card purchase remains unchanged.

### R3 — Server settlement boundary protects non-cash and settled records

The existing bulk settlement endpoint MUST separate synthetic attendance IDs from purchase IDs and independently load and validate each input. It MUST mutate only persisted purchases that are cash-channel and unresolved for a completion request. On `mark_paid`, a valid attendance-only debt MAY create a settled cash purchase and link it to the attendance atomically.

For a request containing missing, non-cash, Stripe-backed, or already-settled records, the endpoint MUST deterministically skip those records and report the result using the bulk response. A skipped record MUST not affect the update count or receive another settlement mutation. Missing, non-cash, and Stripe-backed records MUST NOT run downstream settlement work. An already-settled cash retry MAY rerun the existing idempotent attendance, package-sync, and credit side effects to recover from a prior partial failure, but MUST preserve the original settlement audit metadata.

#### Scenario: Forged or stale card ID
- GIVEN a staff-authorized request includes a card or Stripe-backed purchase ID
- WHEN the endpoint processes the request
- THEN that purchase's status, amount, metadata, Stripe references, package state, and attendance state remain unchanged.

#### Scenario: Already-settled cash ID
- GIVEN a cash purchase was settled after the History board was loaded
- WHEN staff submits its stale ID as a completion request
- THEN the endpoint skips another settlement mutation and update count, while existing idempotent attendance, package-sync, and credit side effects may run to repair a prior partial failure without rewriting settlement audit metadata.

#### Scenario: Attendance-only debt
- GIVEN History displays an unresolved synthetic `att-<attendanceId>` row with no linked settled purchase
- WHEN staff completes that exact row
- THEN the endpoint creates and links one settled cash purchase using the class drop-in price; a failure is isolated to that attendance and reported as `settlement_failed`.

#### Scenario: Ordinary unknown-channel purchase
- GIVEN History displays an unresolved purchase whose channel is unknown, such as `web-unpaid`
- WHEN settlement eligibility is evaluated
- THEN the row is not selectable and the endpoint does not convert or mutate it as cash.

### R4 — Completion refreshes the History board

After a successful bulk response, the client MUST refresh the active History query and reconcile selection with the refreshed eligible records. Settled or skipped IDs MUST not remain selected. A failed request MUST preserve the existing error behavior and MUST NOT present a successful completion state.

### R5 — Preserve existing security and payment boundaries

The change MUST retain the existing staff authorization, rate limiting, audit metadata, cash package synchronization, and attendance-credit behavior for eligible cash settlement. It MUST NOT add an endpoint, dependency, schema migration, or Stripe mutation.

### R6 — Summary cards apply confirmed filters and Collected ordering

The staff payment-board summary cards MUST apply the existing board filter state as follows:

| Summary card | Resulting board behavior |
| --- | --- |
| Students | All students/payments |
| Paid | Paid |
| Pending | Pending |
| Packages | Packages |
| Drop-in | Drop-in |
| Collected | Activate accumulated-spend ordering; do not apply or change a filter |

Students, Paid, Pending, Packages, and Drop-in MUST preserve the board's existing filter semantics. Collected MUST NOT apply or change a filter, query scope, selection, or payment state. It MUST order the students already visible in the current board scope by accumulated spend, highest first.

#### Collected calculation and ordering rules

- The current board scope is established by the existing board filters, including Students/all, Paid/paid, Pending/pending, Packages/packages, and Drop-in/dropin, plus any existing scope controls already applied by the board.
- For each visible student, accumulated spend is the monetary amount accumulated from the payment rows included in that current board scope. The calculation MUST use the board's existing money representation and MUST NOT include payment rows outside the active scope.
- Collected sorts those visible students by accumulated spend in descending order. It does not add, remove, or reclassify students or payments.
- Students with zero accumulated spend remain visible when they match the active filters and sort after every student with a positive accumulated spend.
- Equal accumulated-spend values MUST retain the existing pre-Collected board order, providing stable and deterministic ties.
- Filter and ordering are independent board controls: activating Collected keeps its ordering active when an existing summary filter is clicked, and clicking a summary filter recalculates the visible scope before applying the active ordering.
- The Collected card MUST expose the active ordering state distinctly from the active filter card. It is active exactly while accumulated-spend ordering is active; the active filter card continues to represent the current filter independently.

Clicking Collected when it is already active is idempotent: it keeps the same ordering and does not alter filter, query, selection, or payment state. The ordering MUST NOT alter the cash-only History settlement eligibility contract.

#### Scenario: Staff filters through an actionable summary card
- GIVEN the staff payment board displays its summary cards
- WHEN staff clicks Students, Paid, Pending, Packages, or Drop-in
- THEN the board shows results using the corresponding existing all, status, or category filter.

#### Scenario: Staff orders the current board by Collected
- GIVEN the staff payment board shows students in its current filtered scope
- WHEN staff clicks Collected
- THEN no board filter is applied or changed and the visible students are ordered by accumulated spend descending.

#### Scenario: Collected composes with an existing summary filter
- GIVEN Collected ordering is active
- WHEN staff clicks Paid, Pending, Packages, Drop-in, or Students
- THEN the board first applies that existing filter and then orders its resulting visible students by accumulated spend descending.

#### Scenario: Equal or zero accumulated spend
- GIVEN two visible students have equal accumulated spend and another visible student has zero accumulated spend
- WHEN Collected ordering is active
- THEN the equal-spend students retain their existing relative board order and the zero-spend student remains visible after students with positive accumulated spend.

## Acceptance checklist

- [ ] History mode can select and complete a displayed unresolved cash purchase.
- [ ] History mode can select and complete an unresolved synthetic attendance debt without making ordinary unknown-channel purchases eligible.
- [ ] Card/Stripe records never display settlement selection controls.
- [ ] Eligibility uses the submitted purchase record, not the user's aggregate balance.
- [ ] Non-cash and missing records are deterministically skipped without mutation or side effects; already-settled cash retries preserve settlement audit metadata while allowing existing idempotent fix-forward side effects.
- [ ] The active History results refresh and selections reconcile after the request.
- [ ] Existing authorized cash settlement behavior remains covered by tests.
- [ ] Students, Paid, Pending, Packages, and Drop-in apply their confirmed existing board filters.
- [ ] Collected applies no filter and orders the current visible scope by accumulated spend descending.
- [ ] Collected ordering composes with every existing summary filter, preserves stable ties, retains zero-spend students, and exposes an independent active state.
