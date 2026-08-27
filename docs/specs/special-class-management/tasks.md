# Special Classes Management — Implementation Plan

## Execution rules

Execute in order. Each work unit follows red-green-refactor, keeps changes scoped, runs its gate before proceeding, and preserves the stated rollback boundary. No application changes are authorized by this documentation alone until the plan is accepted.

## Work Unit 1 — Domain policy and migration foundation

### Deliver

- Add `SpecialClass`, explicit purchase links/hold expiry, audit storage, relations, indexes, and a backward-compatible migration.
- Implement pure lifecycle/capacity/hold-expiry/authorization policy with focused unit tests.
- Implement dry-run, idempotent Salsa backfill/reconciliation tooling.

### Gates

- Migration applies to an empty database and a representative populated clone, including unique/check constraints and conflicting-link rejection.
- Unit tests prove three-minute boundary and all lifecycle transitions.
- Backfill reconciliation proves no change to Salsa purchase amounts/statuses, Stripe IDs, sessions, or attendance counts.

### Rollback

Keep new columns nullable and stop after migration/backfill tooling. No public or staff mutation path is enabled.

## Work Unit 2 — Reservation admission and payment synchronization

### Deliver

- Generalize the Salsa-only reservation service to resolve a published `SpecialClass` and canonical session.
- Add serializable admission, explicit internal hold expiry, manual-capture Stripe Session recovery, and safe release without sending the three-minute lease as Stripe `expires_at`.
- Extend webhook fulfillment to transactionally re-admit capacity, validate immutable Purchase money/session links, create/reuse canonical attendance, and capture or cancel authorization exactly once without premature event completion.

### Gates

- Real PostgreSQL test: two simultaneous final-spot requests produce one admitted hold and one `SOLD_OUT`.
- Tests prove same-attempt reuse, stale hold release, duplicate customer rejection, Stripe expiry constraints, delayed authorization with/without capacity, capture/cancel failure retries, webhook replay, and no premature event completion.
- Existing checkout/webhook/attendance suites remain green.

### Rollback

Disable only generic `checkoutKind: special-class` admission. Keep webhook recognition until all open sessions/holds are terminal.

## Work Unit 3 — Staff API, audit, and read model

### Deliver

- Implement guarded Special Classes list/detail/create/update/publish/close/cancel/roster/action endpoints.
- Implement derived capacity and attendance summaries from the canonical tables.
- Record required audit entries and redacted metrics.

### Gates

- API tests prove the authorization matrix, forbidden teacher/student access, transition validation, roster privacy, action idempotency, server-owned audit IDs, full mutation snapshots, and serialized published-capacity edits.
- Query tests prove remaining/hold/paid/checked-in values agree with source records and cancelled sessions cannot be checked in or selected by kiosk.

### Rollback

Disable new staff routes/navigation. Preserve audit records and no-op schema fields.

## Work Unit 4 — Staff panel experience

### Deliver

- Add Special Classes staff navigation, operational list, detail/edit/publish controls, and roster operations.
- Reuse existing staff UI patterns and present status, capacity/remaining/holds, paid/pending/checked-in counts, warnings, and authorized actions.

### Gates

- Component/E2E coverage verifies owner/admin controls, front-desk read/attendance scope, and denied teacher/student access.
- Accessibility checks cover table/list semantics, action confirmation/reason handling, keyboard operation, and state messaging.

### Rollback

Remove the staff panel entry/components while retaining APIs only if operationally required; otherwise disable both as one unit.

## Work Unit 5 — Public generic special-class experience

### Deliver

- Add published-class discovery/detail routes and use the existing checkout route with the resolved generic special-class request.
- Preserve the Salsa route during transition, then migrate it to the generic public model only after parity evidence.

### Gates

- Public API/component/E2E tests cover publication visibility, sold-out state, three-minute hold messaging, safe checkout responses, and no PII/account disclosure.
- Salsa regression suite and generic special-class suite pass together.

### Rollback

Disable generic public routes/admission while leaving paid webhooks and the established Salsa route intact.

## Work Unit 6 — Kiosk parity and release verification

### Deliver

- Verify canonical special sessions meet existing kiosk selection constraints without adding a special kiosk branch.
- Add targeted kiosk regression tests and a controlled end-to-end operational rehearsal.

### Gates

- A paid web reservation is visible in staff roster and kiosk through the same `ClassSession`/`Attendance` IDs.
- Kiosk check-in updates the same attendance observed by the roster.
- Full focused regression: checkout, webhook, staff, kiosk, attendance, migration/backfill, typecheck/lint, and schema validation.

### Rollback

Do not roll back durable data. If parity fails, disable new public sales and staff publication, keep existing class sessions/attendances readable, and resolve the invariant failure before re-enabling.

## Final release checklist

- [ ] Migration and backfill reconciliation approved.
- [ ] Owner/admin/front-desk authorization and teacher/student denial verified in a deployed environment.
- [ ] Final-spot concurrency and expiry verified against PostgreSQL.
- [ ] Webhook replay and failure handling verified with safe test fixtures.
- [ ] Kiosk/web/staff session identity parity verified.
- [ ] Dashboards/logs contain redacted operational outcomes and no PII/secrets.
