# Staff Board History Cash Settlement Tasks

## Approval gate

Implementation is blocked until this spec and plan are explicitly approved. No application code, test, configuration, dependency, Git, or deployment change is part of this planning work.

## Implementation plan

1. **Add focused regression tests first**
    - Cover History cash eligibility, card/Stripe non-selectability, History selection retention, and refresh/reconciliation.
    - Cover bulk API classification, deterministic skips, no side effects for skipped records, and unchanged eligible cash behavior.
    - Cover summary-card mappings: Students to all, Paid/Pending to status, and Packages/Drop-in to category.
    - Cover Collected as an independent ordering action: no filter transition; descending accumulated in-scope spend; composition with every summary filter; stable ties; retained zero-spend students; and independent filter/ordering active states.

2. **Localize board client behavior**
    - Update the payment-card and board-derived selection inputs to use exact-record unresolved-cash eligibility.
    - Remove aggregate outstanding balance as a selection condition.
    - Restrict History-mode bulk controls to cash completion.
    - Wire Students, Paid, Pending, Packages, and Drop-in to existing all/status/category filter callbacks.
    - Add the localized Collected ordering state and apply it only after the existing filters produce the visible board scope; do not create a Collected filter, query contract, endpoint, or payment-state transition.

3. **Enforce the boundary in the existing bulk API**
   - Classify submitted purchases before the transaction.
   - Update and run downstream settlement effects only for eligible unresolved cash records.
   - Return actual updates and deterministic skips.

4. **Refresh and reconcile**
   - Use the existing board refresh callback after a successful response.
   - Reconcile selection against refreshed eligible History records; remove submitted settled and skipped IDs.

5. **Validate the slice**
    - Run the focused tests identified in the repository for the card, payment-board hook/state, and bulk route.
    - Verify the acceptance checklist in `requirements.md`, including a mixed cash/card history case, stale already-settled cash case, all five existing summary-filter mappings, and Collected ordering with filter composition, ties, zero spend, and active states.

## Completion checklist

- [ ] The implementation plan remains localized to the existing payment-board components/hook and bulk route.
- [ ] Tests fail before the behavior change and pass after it.
- [ ] No card or Stripe record can be mutated by the bulk settlement route.
- [ ] History refresh and selection reconciliation are verified.
- [ ] Summary-card filters reuse existing all/status/category state; Collected remains an ordering action rather than a filter.
- [ ] Collected ordering uses only the current visible scope, sorts descending by accumulated spend, preserves ties and zero-spend students, and has an independent active state.
- [ ] No unrelated files or payment-provider behavior changed.
