# Terminal QR phone checkout repair — requirements

## Status

`PLANNED` — documentation and implementation plan are complete; source and test changes require the next work unit.

## Objective

Preserve the established terminal-to-phone Stripe Checkout journey and remove one duplicate terminal heading without changing payment, identity, or kiosk behavior.

## In scope

1. Characterize the phone checkout contract reached from the existing terminal QR.
2. Remove the duplicated outer `Current Course` heading only when `CourseCardPanel` renders compact terminal content with past courses.
3. Add focused regression coverage for the hosted-checkout payload, redirect, and single-heading rendering contract.

## Required behavior

| Area | Requirement |
| --- | --- |
| Terminal QR | `/staff/terminal` continues to create the existing `/checkin` QR URL with `courseSlug`, `date`, `time`, `durationMinutes`, and `fromQr=1`; the class context is unchanged. |
| Phone journey | The existing signed-out and signed-in journey, account/identity handling, product selection, amount, fulfillment, webhook completion, and `/api/checkout/session` route remain unchanged. |
| Hosted checkout | A non-terminal check-in card submission sends the established payload with `photoContext: "qr_phone"` and `checkInBooking: true`, accepts a returned non-empty Stripe URL, and navigates to it. |
| Payment methods | Stripe Checkout retains `payment_method_types: ["card"]` unless focused analysis during implementation proves a necessary change. Card wallets are provider, device, browser, and account eligibility outcomes—not a UI guarantee. |
| Terminal heading | In CourseCardPanel's compact-with-past-courses branch, the rendered output contains exactly one `Current Course` heading. |

## Out of scope

- A new QR payload, a direct-payment shortcut, or a checkout UX redesign.
- A PaymentIntent migration.
- Changes to kiosk-generated hosted-checkout QR, tablet embedded fallback, or native M2.
- Changes to production configuration or deployment.

## Constraints

- Preserve authentication, authorization, validation, audit, Stripe webhook, and fulfillment boundaries.
- Keep the implementation and focused tests within 400 changed lines.
- Production deployment and provider eligibility verification require separate authorization.

## Acceptance criteria

- [ ] A focused regression test proves the QR-phone check-in submission uses `/api/checkout/session`, sends `photoContext: "qr_phone"` and `checkInBooking: true`, does not use `/api/checkout/intent`, and redirects to the returned Stripe URL.
- [ ] A focused rendering test proves compact CourseCardPanel content with past courses has one `Current Course` heading.
- [ ] The source change removes only the outer duplicate heading; the inner CourseCardContent heading remains.
- [ ] Existing terminal QR class-context URL generation and all excluded payment surfaces remain unchanged.
- [ ] Focused tests and documentation structural/diff checks pass; deployment is not performed.

## Open questions

None for the authorized local repair. Provider wallet availability and production revision/deployment state are separate verification concerns.
