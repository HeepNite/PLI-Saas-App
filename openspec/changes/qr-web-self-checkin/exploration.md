# Exploration: QR Web Self Check-in

## Problem Statement

Clients who purchase classes online (from profile/phone/home) currently must wait at the front desk to validate their purchase before attending class. This creates three problems:

1. **Friction for paid clients**: A client who already paid with Stripe must stand in line just to confirm their booking — broken experience.
2. **Cash payment tracking**: A client who chose "cash" online shows up and may avoid paying. Staff need visibility into who owes cash.
3. **Anti-fraud**: Someone who didn't purchase could claim they "bought online" — the system must reject check-in attempts without a valid booking.

## Ideal Flow

```
Client buys online (Stripe or cash) → arrives at studio → scans studio QR with their phone
    ↓
System validates: has a Purchase for today's class?
    ↓
YES + Stripe paid     → auto check-in → staff board shows ✅ "Web — Paid"
YES + Cash pending    → auto check-in → staff board shows ⚠️ "Web — Cash due"  
NO                    → reject: "No booking found for this class"
```

## Existing Infrastructure

### Purchase Model (`prisma/schema.prisma`)
- `Purchase.status`: `"paid"`, `"pending"`, `"succeeded"`, `"completed"`
- `Purchase.metadata`: JSON with `paymentMethod` (`"stripe"` | `"onsite"`), `paymentChannel` (`"card"` | `"cash"` | `"package_credit"` | `"consecutive_addon"`), `settlementStatus` (`"paid"` | `"pending"`), `date`, `time`, `courseSlug`
- Already distinguishes card-paid vs cash-pending via `status` + `metadata.paymentChannel` + `metadata.settlementStatus`

### Attendance Model
- `Attendance.status`: `"checked_in"`, `"checked_in_no_package"`, etc.
- `Attendance.metadata`: JSON — can store check-in source/channel
- `Attendance.qrToken`: exists but currently unused in most flows

### QR Check-in Infrastructure (`lib/checkin/qr.ts`)
- `parseQrCheckInContext()`: parses `courseSlug`, `date`, `time`, `durationMinutes` from input
- `isQrCheckInWindowOpen()`: validates 2hr-before to 2hr-after-end window
- `QrCheckInContext` type: complete context for a class session

### QR Bootstrap API (`/api/checkin/qr/bootstrap`)
- **Currently kiosk-only**: requires `flowContext: "kiosk_terminal"` or a `kioskSessionToken`
- Returns 401 for unauthenticated client-phone requests
- Contains rich logic: user resolution, purchase lookup, package detection, consecutive offers
- ~605 lines — complex but well-structured

### Profile Self Check-in (`/api/profile/bookings/checkin`)
- Requires Clerk auth (`auth()`)
- Takes `attendanceId` — checks in an existing Attendance record
- Validates check-in window (2hr before, 2hr after end)
- Awards points and milestone bonuses
- **Key limitation**: requires an `attendanceId` that already exists — no purchase-to-attendance bridge

### Cash Checkout (`/api/checkout/cash`)
- Creates Purchase with `status: "pending"`, `paymentChannel: "cash"`, `settlementStatus: "pending"`
- Creates Attendance record immediately (even for pending cash)
- This means cash purchases already have an Attendance record

### Staff Board (`useStaffStudentsBoardAdmin` + `StaffStudentsBoardPanel`)
- Reads from payments API which returns `PaymentRow[]`
- Each row has `paymentChannel` and settlement status
- Already shows cash pending vs paid cards
- Board filters: `"all"` | `"pending"` | `"paid"`
- **Missing**: no distinction between "purchased at kiosk" vs "purchased online from web"

### Purchase Status Constants (`lib/purchase-status.ts`)
- `SUCCESSFUL_PURCHASE_STATUSES`: `["paid", "succeeded", "completed"]`
- Cash purchases stay `"pending"` until staff marks them paid

## Key Findings

### 1. QR Bootstrap is the right entry point — but needs a new flow context

The `/api/checkin/qr/bootstrap` already does 90% of what we need:
- Resolves user from Clerk auth
- Finds existing purchases for the class
- Detects packages
- Handles check-in window validation

What's missing: a `flowContext: "client_phone"` path that:
- Uses Clerk auth directly (no kiosk session token)
- Looks up existing Purchase for this user + class
- If found with Stripe paid → creates/confirms Attendance → returns success
- If found with cash pending → creates/confirms Attendance → returns success + `cashPending: true` flag
- If not found → returns rejection message

### 2. Cash purchases already create Attendance records

The cash checkout route creates an Attendance record immediately. So for cash buyers, the check-in might just be a status confirmation, not a new record creation.

For Stripe buyers, the webhook creates a Purchase but does NOT automatically create an Attendance. The profile bookings API creates Attendance records when the user assigns classes. So Stripe buyers who booked a class should already have an Attendance via the assign flow.

### 3. Staff board already has the filtering infrastructure

The board uses `paymentChannel` to distinguish card/cash/package_credit. Adding a `purchaseSource` field (or using existing metadata like `source: "stripe_webhook_checkout"` vs presence of `kioskSessionToken`) would let us show "Web" vs "Kiosk" origin.

### 4. The QR URL structure encodes class context

The studio QR likely encodes: `courseSlug`, `date`, `time`, `durationMinutes`. The client's phone would hit a URL like:
```
/checkin/qr?courseSlug=salsa-night&date=2026-06-11&time=20:00&durationMinutes=60
```
This page would detect "am I on a phone browser?" and use Clerk auth to run the self-check-in flow.

## Recommended Approach

### Slice 1: API — Client phone QR check-in endpoint
- New route or extend `/api/checkin/qr/bootstrap` with `flowContext: "client_phone"`
- Auth: Clerk `auth()` — reject if not signed in
- Logic: find Purchase for (userId, courseSlug, date) → validate window → upsert Attendance → return result
- Include `cashPending` flag in response for cash purchases

### Slice 2: Client UI — QR scan landing page
- Extend or create `/checkin/qr` page to detect client-phone context
- Show: "Checking you in..." → success/failure result
- If cash pending: "Checked in — please pay $X at the front desk"
- If no booking: "No booking found — would you like to book now?"

### Slice 3: Staff board — Web purchase source indicator
- Add `purchaseSource` to payment metadata or derive from existing fields
- Show badge on student cards: "Web" | "Kiosk" | "Front desk"
- Filter option: "Web cash pending" for staff to quickly find who owes

## Risks and Open Questions

1. **QR URL security**: The QR encodes class info but not user info. Anyone with the URL could try to check in. Clerk auth is the gate — only signed-in users with a matching Purchase succeed.
2. **Duplicate check-in prevention**: Need to handle the case where a client scans twice. The `@@unique([userId, sessionId])` on Attendance prevents duplicates.
3. **Cash collection timing**: Should staff be notified in real-time when a web-cash client checks in? Or is the board filter enough?
4. **Offline/slow connection**: What if the client's phone has poor signal in the studio? The check-in should be fast and show clear feedback.
5. **Package holders**: A client with an active package who scans QR — should they auto-check-in using package credit without going through purchase flow?
