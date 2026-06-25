# Tasks: QR Web Self Check-in

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~440 (API ~160 + Client UI ~140 + Staff ~140) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (Slice 1+2: API + Client UI) → PR2 (Slice 3: Staff board) |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Client-phone API + Client UI | PR 1 | Base: main; API + page + component; tests included |
| 2 | Staff board badge + web-cash polling | PR 2 | Base: PR 1 branch; independent slice |

---

## Phase 1: Foundation — Types and Interfaces

- [ ] 1.1 Define `ClientPhoneCheckInRequest` and `ClientPhoneCheckInResponse` types in `types/checkin.ts` (or inline in route) — covers R1.1 contract
- [ ] 1.2 Add `purchaseSource?: "web" | "kiosk" | "front_desk"` to `PaymentRow` in `components/front/staff/staffAdminTypes.ts` — covers R3.2
- [ ] 1.3 Add `WebCashArrival` type for polling endpoint response in `components/front/staff/staffAdminTypes.ts` — covers R3.3

---

## Phase 2: Core Implementation

### Slice 1 — API (PR 1)

- [ ] 2.1 Create `app/api/checkin/qr/client-phone/route.ts`: implement `POST` handler with Clerk auth (R1.2), `parseQrCheckInContext` (R1.1), `isQrCheckInWindowOpen` check (R1.3), user resolution via `upsertUserByIdentifiers`, Attendance `@@unique([userId, sessionId])` idempotency (R1.7), Purchase lookup for stripe-paid (R1.4) and cash-pending (R1.5), PackagePurchase fallback with `reservePackageCreditForAttendanceTx` (R1.6), rejection when no booking (R1.8), `awardPointsFromRule` (R1.9), `checkinSource: "qr_client_phone"` metadata on Attendance (R1.10)
  - **Files**: `app/api/checkin/qr/client-phone/route.ts`
  - **Verification**: `POST /api/checkin/qr/client-phone` with stripe-paid, cash-pending, package, rejected, already-checked-in, window-closed, unauthenticated — all 5 status codes return correct payload

### Slice 2 — Client UI (PR 1)

- [ ] 2.2 Create `components/front/checkin/hooks/useClientPhoneCheckIn.ts`: hook that calls `POST /api/checkin/qr/client-phone`, manages `loading` / `result` state, extracts `courseSlug`/`date`/`time` from URL params
  - **Files**: `components/front/checkin/hooks/useClientPhoneCheckIn.ts`
  - **Verification**: Hook returns `{ loading, result }`; result is `undefined` before first call

- [ ] 2.3 Create `components/front/checkin/ClientPhoneCheckIn.tsx`: mobile-first component rendering 6 states: (a) loading spinner (R2.2), (b) `status: "checked_in"` — "You're checked in! Enjoy your class." (R2.3), (c) `status: "checked_in" + cashPending` — "Please pay $X at front desk" warning (R2.4), (d) `status: "checked_in" + package` — "1 credit used. X remaining." (R2.5), (e) `status: "rejected"` — message + "Book now" link to `/courses` (R2.6), (f) `status: "already_checked_in"` (R2.7), (g) `status: "window_closed"` — appropriate message (R2.8)
  - **Files**: `components/front/checkin/ClientPhoneCheckIn.tsx`
  - **Verification**: Each result status renders correct UI text; loading state shows spinner; "Book now" links to `/courses`

- [ ] 2.4 Modify `app/checkin/page.tsx`: detect client-phone flow — if `useAuth().isSignedIn` is true AND no `kioskSessionToken` / `flowContext=kiosk_terminal` param → render `<ClientPhoneCheckIn />`; if signed out → show "Sign in to check in" prompt with redirect back to QR URL (R2.1, R2.9)
  - **Files**: `app/checkin/page.tsx`
  - **Verification**: Signed-in user sees check-in component; signed-out user sees sign-in prompt with `redirectTo` back to same QR URL

### Slice 3 — Staff Board (PR 2)

- [ ] 2.5 Modify `app/api/checkout/cash/route.ts`: add `purchaseSource: "web"` to `metadata` when creating cash purchase — ~2 lines (R3.1)
  - **Files**: `app/api/checkout/cash/route.ts`
  - **Verification**: Cash purchase metadata includes `purchaseSource: "web"`

- [ ] 2.6 Modify `app/api/stripe/webhook/route.ts`: add `purchaseSource: "web"` to metadata on successful Stripe checkout — ~2 lines (R3.1)
  - **Files**: `app/api/stripe/webhook/route.ts`
  - **Verification**: Stripe purchase metadata includes `purchaseSource: "web"`

- [ ] 2.7 Create `app/api/staff/checkin/web-cash-arrivals/route.ts`: implement `GET` handler requiring staff auth (role: owner/admin/front_desk), accepts `since` query param (ISO timestamp), queries Attendance joined with Purchase where `checkinSource: "qr_client_phone"`, `paymentChannel: "cash"`, `settlementStatus: "pending"`, `checkedInAt > since` — returns `WebCashArrival[]` (R3.3, R3.6)
  - **Files**: `app/api/staff/checkin/web-cash-arrivals/route.ts`
  - **Verification**: Returns arrivals after `since` param; empty array when none; 401 without staff auth

- [ ] 2.8 Modify `components/front/staff/StaffStudentsBoardPanel.tsx`: add "Web" / "Kiosk" / "Front desk" badge on each payment card derived from `metadata.purchaseSource` — render chip next to payment method (R3.2)
  - **Files**: `components/front/staff/StaffStudentsBoardPanel.tsx`
  - **Verification**: Payment card shows correct source badge; old purchases without field show nothing (graceful degradation)

---

## Phase 3: Integration / Wiring — Staff Board Polling (PR 2)

- [ ] 3.1 Modify `components/front/staff/useStaffStudentsBoardAdmin.ts`: add polling logic for `GET /api/staff/checkin/web-cash-arrivals?since=<ts>` every 10 seconds; maintain `lastPolledAt` timestamp; accumulate new arrivals for toast display (R3.4)
  - **Files**: `components/front/staff/useStaffStudentsBoardAdmin.ts`
  - **Verification**: Polling fires every 10s; `since` param advances; new arrivals trigger toast

- [ ] 3.2 Wire toast notification in `StaffStudentsBoardPanel.tsx`: when `useStaffStudentsBoardAdmin` reports new web-cash arrivals, show toast "[Name] checked in — $X cash due" (R3.5)
  - **Files**: `components/front/staff/StaffStudentsBoardPanel.tsx`
  - **Verification**: Toast appears for web-cash arrivals; does not fire for kiosk or front_desk purchases

---

## Phase 4: Testing

- [ ] 4.1 Write integration test for `POST /api/checkin/qr/client-phone`: cover all 5 result paths — stripe-paid (checked_in), cash-pending (checked_in + cashPending), package (checked_in + package), rejected (no booking), already_checked_in — use mocked Prisma
  - **Files**: `app/api/checkin/qr/client-phone/route.test.ts`
  - **Verification**: `pnpm test` passes; all 5 statuses return correct response shape

- [ ] 4.2 Write integration test for `GET /api/staff/checkin/web-cash-arrivals`: cover returns arrivals after `since`, empty when none, 401 without staff auth
  - **Files**: `app/api/staff/checkin/web-cash-arrivals/route.test.ts`
  - **Verification**: `pnpm test` passes

- [ ] 4.3 Write component test for `ClientPhoneCheckIn`: mock `useClientPhoneCheckIn`, assert correct UI renders for each result status (loading, checked_in, cashPending, package, rejected, already_checked_in, window_closed)
  - **Files**: `components/front/checkin/ClientPhoneCheckIn.test.tsx`
  - **Verification**: `pnpm test` passes; all 6 states have correct text

---

## Phase 5: Cleanup

- [ ] 5.1 No cleanup needed — no dead code, no temporary artifacts

---

## Implementation Order

1. **Phase 1 (types)** → all downstream code depends on types
2. **Phase 2.1 (API route)** → core logic; write and test first
3. **Phase 2.2–2.4 (Client UI)** → depends on API route contract
4. **Phase 2.5–2.8 (Staff board)** → independent of client UI; runs in PR 2
5. **Phase 3 (Staff polling)** → depends on polling endpoint existing
6. **Phase 4 (Tests)** → verify all contracts; run after full implementation

**PR ordering**: PR 1 (2.1–2.4 + 4.1–4.3) merges first. PR 2 (2.5–2.8 + 3.1–3.2) stacks on top.
