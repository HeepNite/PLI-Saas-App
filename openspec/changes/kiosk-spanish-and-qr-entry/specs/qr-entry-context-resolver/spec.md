# qr-entry-context-resolver Specification

## Purpose

Derives the current class context (classId, date, time, promotion eligibility) at QR scan time before any user interaction occurs. Replaces the prior static QR behavior where class context was ambient/assumed.

---

## Requirements

### Requirement: QR Context Endpoint

The system MUST expose `GET /api/checkin/qr/context` that returns the active class context for the current moment.

The endpoint MUST return `{ classId: string, courseSlug: string, date: string, time: string, promotionEligible: boolean }` when a matching scheduled class is found.

The endpoint MUST return `{ status: "no-active-class" }` when no class is scheduled at the current day/date/time.

The endpoint MUST NOT require authentication.

Rate limiting rules applicable to other unauthenticated checkin endpoints MUST apply.

#### Scenario: Active class found for current date and time

- GIVEN the studio schedule has a class active at the current day/date/time
- WHEN `GET /api/checkin/qr/context` is called without authentication
- THEN the response is HTTP 200 with `{ classId, courseSlug, date, time, promotionEligible }`
- AND `promotionEligible` reflects whether a consecutive course link is active for the resolved class today

#### Scenario: No class scheduled at current time

- GIVEN no scheduled class is active at the current day/date/time
- WHEN `GET /api/checkin/qr/context` is called
- THEN the response is HTTP 200 with `{ status: "no-active-class" }`
- AND no error or 4xx/5xx status is returned

#### Scenario: Schedule gap between classes

- GIVEN two classes are scheduled today but the current time falls between them
- WHEN `GET /api/checkin/qr/context` is called
- THEN the response is `{ status: "no-active-class" }`

#### Scenario: Response uses kiosk active-class window

- GIVEN the shared kiosk active-class resolver identifies class X as active at the current time
- WHEN `GET /api/checkin/qr/context` is called at the same moment
- THEN the returned `courseSlug` MUST match class X
- AND the resolver MUST NOT fall back to the next or nearest class outside the active window

---

### Requirement: QR Landing Page Context Resolution

The QR landing page MUST call `GET /api/checkin/qr/context` on mount, before displaying any interactive element to the user.

The page MUST display an informative "no active class" message when the resolver returns `{ status: "no-active-class" }`.

The page MUST NOT allow the user to proceed to check-in routing until context is resolved.

#### Scenario: Context resolved — user sees class info before interaction

- GIVEN the QR landing page loads
- AND `GET /api/checkin/qr/context` returns a valid class context
- WHEN context resolution completes
- THEN the resolved class (name, date, time) is visible before any action is requested
- AND the user is ready to proceed to identity routing

#### Scenario: No active class — informative message shown

- GIVEN the QR landing page loads
- AND `GET /api/checkin/qr/context` returns `{ status: "no-active-class" }`
- WHEN the page renders
- THEN a human-readable "no active class" message is displayed
- AND no check-in CTA or identity prompt is shown

#### Scenario: Context resolution fails (network/server error)

- GIVEN `GET /api/checkin/qr/context` returns a 5xx error or network timeout
- WHEN the page renders
- THEN an error state with a retry option is displayed
- AND the page does NOT silently proceed with undefined class context

---

### Requirement: Promotion Eligibility in Context

The `promotionEligible` field MUST be `true` if and only if an active `CourseLink` exists for the resolved class today and the linked class is scheduled later the same day.

This field is informational at resolve time; final promotion evaluation MUST still occur during check-in routing using the student's actual attendance record.

#### Scenario: Promotion flag set when consecutive link exists

- GIVEN the resolved class has an active CourseLink and the linked course runs later today
- WHEN `GET /api/checkin/qr/context` returns
- THEN `promotionEligible` is `true`

#### Scenario: Promotion flag false when no link or linked class not today

- GIVEN the resolved class has no active CourseLink, or the linked class is not scheduled today
- WHEN `GET /api/checkin/qr/context` returns
- THEN `promotionEligible` is `false`
