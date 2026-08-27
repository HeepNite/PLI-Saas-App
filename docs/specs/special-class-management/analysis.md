# Special Classes Management — Analysis

## Existing reusable contracts

| Area | Evidence | Reuse decision |
|---|---|---|
| Canonical session | `ClassSession` has unique `(courseSlug, startsAt)`, capacity, location, room, and `Attendance[]` | Reuse as the only operational session and capacity owner. |
| Attendance | `Attendance` is unique on `(userId, sessionId)` | Reuse for paid reservation fulfillment and kiosk check-in. |
| Payments | `Purchase` already has status, amount, currency, Stripe IDs, idempotency key, metadata, and participant count | Reuse as the reservation/hold record; do not add a payment system. |
| Capacity precedent | `lib/checkout/special-class-reservation.ts` uses serializable transactions and bounded `P2002`/`P2034` retry | Generalize/revise this policy; replace its Salsa-only time-based `createdAt` hold with explicit three-minute expiry. |
| Public checkout | `POST /api/checkout/session` already has a special-class discriminator and Stripe integration | Extend through a generic special-class discriminator/identifier while preserving ordinary checkout. |
| Webhook | `app/api/stripe/webhook/route.ts` owns signed, idempotent fulfillment | Extend its existing special reservation branch; it remains fulfillment authority. |
| Staff authorization | `authorizeStaffPortalRequest`, `authorizeStaffPortalSectionRequest`, `StaffRole`, `isStaffAdminRole` | Create a section-specific policy with owner/admin write and owner/admin/staff roster scopes. |
| Staff UI | Existing `/api/staff/*` guarded routes and staff panels | Add one bounded Special Classes section; do not expose it in student/teacher surfaces. |
| Kiosk | Kiosk selects/checks in `ClassSession` and uses existing attendance uniqueness | No special kiosk flow; ensure the canonical session satisfies selection criteria. |

## Current gaps and conflicts

1. The implemented Salsa flow is fixed in `SPECIAL_SALSA_CLASS`, uses a 30-minute hold, and derives availability from `Purchase.courseSlug`; it cannot manage arbitrary staff-created special classes.
2. `ClassSession` has no direct relationship to a special-class definition. A safe reusable module needs an explicit one-to-one link rather than inferred metadata or duplicated capacity.
3. `Purchase` has no explicit `sessionId` or `holdExpiresAt`. Encoding expiry in JSON metadata and `createdAt` is insufficient for precise three-minute holds, indexed cleanup, auditability, or reusable capacity queries.
4. Existing attendance supports the canonical roster/check-in relation but does not express reservation/payment lifecycle independently. `Purchase` remains the correct source for that lifecycle.
5. Existing staff roles are `owner`, `admin`, and `staff`; product language maps front desk to `staff`. Teachers/students are not staff roles and must be denied by server authorization.

## Constraints

- The existing special Salsa path is already operational. Its active purchases/session/attendances must be preserved and brought under the generic module without capacity duplication.
- A paid historical Salsa purchase may have no explicit special-class record or `holdExpiresAt`; migration/backfill must be deterministic and idempotent.
- Stripe network calls must remain outside the serializable database transaction. The transaction admits/reuses the hold; Stripe creation then uses the same idempotency key; failures transition the hold safely.
- Public endpoints must not leak attendee contact information, internal IDs, or account existence.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Overselling under concurrent checkout | Serializable admission, bounded retry, active-hold expiry predicate, real PostgreSQL concurrency test. |
| Capacity disagreement between web and kiosk | One `ClassSession`, session-linked purchases, and derived summary queries only. |
| Webhook retries duplicate attendance | Existing Stripe-event idempotency plus `Attendance(userId, sessionId)` uniqueness. |
| Delayed expiry job holds spots too long | Admission/read path expires stale holds synchronously; scheduled cleanup is only a timely optimization. |
| Staff data exposure | Section-specific server authorization and roster response minimization. |
| Salsa migration alters historical money/attendance | Backfill only additive links/metadata; never recalculate amount, status, or attendance. |

## Recommended model direction

Introduce a generic `SpecialClass` aggregate that owns public/commercial/lifecycle metadata and references one `ClassSession`. Link reservation purchases to the same special class and session, with an indexed explicit hold expiry. Keep `ClassSession.capacity` authoritative and keep `Attendance` unchanged as the attendance/check-in record.

This is a required schema evolution, not a new payment system.
