# Spec: QR Web Self Check-in

## Requirements

### R1: Client phone QR check-in API

**R1.1** The system SHALL expose `POST /api/checkin/qr/client-phone` that accepts `{ courseSlug, date, time, durationMinutes? }`.

**R1.2** The endpoint SHALL require Clerk authentication. Unauthenticated requests receive 401.

**R1.3** The endpoint SHALL validate the check-in window using `isQrCheckInWindowOpen()`. Requests outside the window receive `{ status: "window_closed" }`.

**R1.4** When the user has a Purchase with `status ∈ SUCCESSFUL_PURCHASE_STATUSES` for the matching (courseSlug, date), the system SHALL upsert an Attendance with `status: "checked_in"` and return `{ status: "checked_in" }`.

**R1.5** When the user has a Purchase with `status: "pending"` AND `metadata.paymentChannel: "cash"`, the system SHALL upsert an Attendance with `status: "checked_in"` and return `{ status: "checked_in", cashPending: true, cashAmount }`.

**R1.6** When the user has no Purchase but has an active PackagePurchase with credits (or unlimited) for the course, the system SHALL consume one credit, create Attendance, and return `{ status: "checked_in", package: { ... } }`.

**R1.7** When the user has an existing Attendance already in `checked_in` status, the system SHALL return `{ status: "already_checked_in" }` without creating a duplicate.

**R1.8** When no Purchase and no usable PackagePurchase exist, the system SHALL return `{ status: "rejected", message: "No booking found for this class" }`.

**R1.9** On successful check-in, the system SHALL award points via `awardPointsFromRule()`.

**R1.10** On successful check-in of a web-cash purchase, the system SHALL record `metadata.checkinSource: "qr_client_phone"` on the Attendance for staff polling.

### R2: Client UI — QR scan result page

**R2.1** When a signed-in client visits `/checkin/qr?courseSlug=X&date=Y&time=Z` without kiosk parameters, the system SHALL render the client-phone check-in flow.

**R2.2** The UI SHALL show a loading state while calling the API.

**R2.3** On `status: "checked_in"` (Stripe paid), the UI SHALL show: "You're checked in! Enjoy your class." with class details.

**R2.4** On `status: "checked_in"` with `cashPending: true`, the UI SHALL show: "Checked in — please pay $X at the front desk." in a warning style.

**R2.5** On `status: "checked_in"` with `package`, the UI SHALL show: "Checked in — 1 credit used. X remaining." with package info.

**R2.6** On `status: "rejected"`, the UI SHALL show the rejection message and a "Book now" link to `/courses`.

**R2.7** On `status: "already_checked_in"`, the UI SHALL show: "You're already checked in for this class."

**R2.8** On `status: "window_closed"`, the UI SHALL show: "Check-in is not open yet" or "Check-in has closed."

**R2.9** When the user is NOT signed in, the UI SHALL show a "Sign in to check in" prompt with redirect back to the QR URL after sign-in.

### R3: Staff board — Web source badge + real-time cash alert

**R3.1** The checkout routes SHALL add `purchaseSource: "web"` to Purchase metadata when the purchase originates from the web profile flow (not kiosk terminal).

**R3.2** The staff board SHALL display a "Web" or "Kiosk" badge on each student payment card, derived from `metadata.purchaseSource`.

**R3.3** The system SHALL expose `GET /api/staff/checkin/web-cash-arrivals?since=<ISO>` returning students who checked in via QR client-phone with cash pending since the given timestamp.

**R3.4** The staff board SHALL poll the web-cash-arrivals endpoint every 10 seconds while visible.

**R3.5** When a new web-cash arrival is detected, the board SHALL show a toast notification: "[Name] checked in — $X cash due".

**R3.6** The web-cash-arrivals endpoint SHALL require staff authentication (role: owner, admin, or front_desk).

## Scenarios

### S1: Happy path — Stripe-paid client scans QR
1. Client bought Salsa class for June 11 20:00 via Stripe (paid).
2. Client arrives, scans studio QR with phone.
3. Phone opens `/checkin/qr?courseSlug=salsa-night&date=2026-06-11&time=20:00`.
4. Client is signed in via Clerk.
5. API finds Purchase (status: "paid", paymentChannel: "card").
6. API creates Attendance, awards points.
7. UI shows: "✅ You're checked in! Enjoy Salsa Night."

### S2: Cash-pending client scans QR
1. Client bought Salsa class via cash online (status: "pending", paymentChannel: "cash").
2. Scans QR → API finds Purchase with cash pending.
3. API creates Attendance with `checkinSource: "qr_client_phone"`.
4. UI shows: "⚠️ Checked in — please pay $20 at the front desk."
5. Staff board receives polling update → toast: "Ana Diaz checked in — $20 cash due".

### S3: Package holder scans QR
1. Client has an active package for Salsa (5 credits remaining).
2. No Purchase for today's class.
3. Scans QR → API finds PackagePurchase → consumes 1 credit → creates Attendance.
4. UI shows: "✅ Checked in — 1 credit used. 4 remaining."

### S4: No booking — rejection
1. Client has no Purchase and no usable package for today's class.
2. Scans QR → API returns rejected.
3. UI shows: "❌ No booking found for this class. [Book now →]"

### S5: Already checked in
1. Client scans QR twice.
2. Second call → API finds existing Attendance in checked_in status.
3. UI shows: "You're already checked in for this class."

### S6: Window closed
1. Client scans QR 4 hours before class starts (outside 2hr window).
2. API returns window_closed.
3. UI shows: "Check-in opens 2 hours before your class."

### S7: Not signed in
1. Visitor scans QR but is not signed into Clerk.
2. Page shows "Sign in to check in" with redirect.
3. After sign-in → redirects back → auto-triggers check-in.

### S8: Anti-fraud — no purchase
1. Person scans QR, is signed in, but never purchased.
2. API checks Purchase → none. Checks PackagePurchase → none.
3. Returns `{ status: "rejected" }`. No Attendance created.

## Security

- Clerk auth required for all client-phone check-in requests.
- Staff auth (owner/admin/front_desk) required for web-cash-arrivals endpoint.
- Rate limiting: 30 requests/minute per IP (same as existing check-in routes).
- `@@unique([userId, sessionId])` on Attendance prevents duplicate check-ins at DB level.
- Package credit deduction wrapped in Prisma transaction to prevent race conditions.
