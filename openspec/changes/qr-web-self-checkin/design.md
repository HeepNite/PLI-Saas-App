# Design: QR Web Self Check-in

## Technical Approach

New `POST /api/checkin/qr/client-phone` route using Clerk auth to find the user's Purchase or PackagePurchase for the scanned class, upsert Attendance, and return a typed result. The existing `/checkin` page gains a client-phone detection branch that renders a new `ClientPhoneCheckIn.tsx` component. Staff board gets a `purchaseSource` badge and a polling endpoint for web-cash arrivals.

All three slices reuse existing infrastructure: `parseQrCheckInContext`, `isQrCheckInWindowOpen`, `upsertUserByIdentifiers`, `reservePackageCreditForAttendanceTx`, `awardPointsFromRule`, and the Prisma `@@unique([userId, sessionId])` constraint for idempotency.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| New route vs extend bootstrap | New `client-phone/route.ts` | Add `flowContext: "client_phone"` to 605-line bootstrap | Bootstrap is kiosk-specific (session tokens, pricing templates, prepared checkout). Client-phone is auth→find→checkin — fundamentally simpler. Avoids conditional pollution. |
| Client detection on `/checkin` page | Check `useAuth().isSignedIn` + absence of kiosk query params | Separate `/checkin/phone` route | Reuses existing page URL (QR codes already point here). Kiosk detection: presence of `kioskSessionToken` or `flowContext=kiosk_terminal` in bootstrap. If neither → client-phone branch. |
| Package credit deduction | Reuse `reservePackageCreditForAttendanceTx` + `ensureAttendancePackagePurchase` from `qr/package/route.ts` | Inline deduction | Exact same pattern already battle-tested. Extract nothing — call the same libs. |
| Staff notification | Polling `GET /api/staff/checkin/web-cash-arrivals?since=<ts>` every 10s | WebSocket/SSE | No WS infrastructure exists. Polling is simple, staff board already refreshes. Acceptable for MVP. |
| Purchase source tracking | Add `purchaseSource` field to Purchase `metadata` JSON at checkout time | Derive from existing `source` field | Existing `source` values are implementation-specific (e.g. `"stripe_webhook_checkout"`, `"cash_checkout"`). A clean `purchaseSource: "web" | "kiosk"` is user-facing semantics. |

## Data Flow

```
Client Phone                          Server                           DB
─────────────                         ──────                          ──
Scan QR → /checkin?courseSlug&date&time
  │
  ├─ Clerk signed in? ──NO──→ Show "Sign in" redirect
  │
  └─ YES → POST /api/checkin/qr/client-phone
              │
              ├─ auth() → clerkUserId
              ├─ parseQrCheckInContext()
              ├─ isQrCheckInWindowOpen()
              ├─ upsertUserByIdentifiers() ──────────→ User
              ├─ Find Purchase(userId, courseSlug, date)─→ Purchase
              │    ├─ Stripe paid → upsert Attendance ──→ Attendance
              │    └─ Cash pending → upsert Attendance ──→ Attendance (cashPending)
              ├─ If no Purchase → find PackagePurchase ─→ PackagePurchase
              │    └─ reservePackageCreditForAttendanceTx → Attendance + Ledger
              ├─ If nothing → reject
              ├─ awardPointsFromRule() ──────────────→ PointsLedger
              └─ Return { status, attendance, package?, cashPending?, points }

Staff Board (web-cash only):
  GET /api/staff/checkin/web-cash-arrivals?since=<ts>
    → Attendance JOIN Purchase WHERE source="qr_client_phone"
      AND paymentChannel="cash" AND settlementStatus="pending"
      AND checkedInAt > since
    → Toast: "Ana Diaz checked in — $20 cash due"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/api/checkin/qr/client-phone/route.ts` | Create | Main endpoint — Clerk auth, purchase/package lookup, attendance upsert, points |
| `components/front/checkin/ClientPhoneCheckIn.tsx` | Create | Mobile-first result UI: success/cash-pending/package/rejected/already-checked-in states |
| `components/front/checkin/hooks/useClientPhoneCheckIn.ts` | Create | Hook: call API, manage loading/result state |
| `app/checkin/page.tsx` | Modify | Add client-phone detection: if signed in + no kiosk params → render `ClientPhoneCheckIn` |
| `app/api/staff/checkin/web-cash-arrivals/route.ts` | Create | Staff polling endpoint — returns recent web-cash check-ins since timestamp |
| `components/front/staff/StaffStudentsBoardPanel.tsx` | Modify | Add "Web"/"Kiosk" badge next to payment method chip |
| `components/front/staff/staffAdminTypes.ts` | Modify | Add `purchaseSource?: "web" \| "kiosk" \| "front_desk"` to `PaymentRow` |
| `app/api/checkout/cash/route.ts` | Modify | Add `purchaseSource: "web"` to metadata (~2 lines) |

## Interfaces / Contracts

```typescript
// POST /api/checkin/qr/client-phone — Request
type ClientPhoneCheckInRequest = {
  courseSlug: string
  date: string       // "2026-06-11"
  time: string       // "20:00"
  durationMinutes?: number
}

// POST /api/checkin/qr/client-phone — Response
type ClientPhoneCheckInResponse = {
  status: "checked_in" | "already_checked_in" | "rejected" | "window_closed"
  attendance?: {
    id: string; status: string; checkedInAt: string
    courseSlug: string; courseTitle: string; startsAt: string
  }
  cashPending?: boolean
  cashAmount?: number
  package?: {
    id: string; packageLabel: string | null
    isUnlimited: boolean; remainingCredits: number | null
  } | null
  points?: { awarded: number; milestone: number | null; attendanceCount: number }
  message?: string  // user-facing rejection message
}

// GET /api/staff/checkin/web-cash-arrivals?since=<ISO>
type WebCashArrival = {
  attendanceId: string
  userName: string
  courseTitle: string
  cashAmountCents: number
  checkedInAt: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `parseQrCheckInContext`, window validation | Already tested — no new tests needed |
| Integration | `POST /api/checkin/qr/client-phone` — all 5 result paths | API route test with mocked Prisma: stripe-paid, cash-pending, package, rejected, already-checked-in |
| Integration | `GET /api/staff/checkin/web-cash-arrivals` | API test: returns arrivals after `since`, empty when none |
| Component | `ClientPhoneCheckIn` renders all states | React Testing Library: mock fetch, assert UI per result state |

## Migration / Rollout

No migration required. `purchaseSource` is added to new Purchase metadata JSON going forward — old purchases without it show no badge (graceful degradation). PR1 (API+UI) ships first, PR2 (Staff board) follows.

## Open Questions

None — all decisions closed in proposal.
