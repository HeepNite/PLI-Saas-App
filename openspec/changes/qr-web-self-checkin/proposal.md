# Proposal: QR Web Self Check-in

## Intent

Enable clients who purchased classes online to self-check-in by scanning the studio QR code with their phone, eliminating the front desk bottleneck. Give staff real-time visibility when a web-cash client arrives so they can collect payment immediately.

## Scope

### In scope
- Client-phone QR check-in API (new flow context in existing QR infrastructure)
- Package holder auto check-in with credit deduction via QR scan
- Client-facing QR scan result page (mobile-first)
- Staff board: "Web" vs "Kiosk" source badge on payment cards
- Real-time staff notification for web-cash arrivals only
- Anti-fraud: reject check-in when no valid purchase/package exists

### Out of scope
- Changing existing kiosk terminal QR flows
- General websocket/real-time infrastructure for all events
- Modifying the purchase/checkout flows themselves
- Staff-initiated check-in changes

## Approach

### Slice 1: API — Client phone QR check-in (~200 lines)

**New route**: `POST /api/checkin/qr/client-phone`

Why a new route instead of extending bootstrap:
- Bootstrap is 605 lines of kiosk-specific logic (session tokens, pricing templates, prepared checkout)
- Client-phone flow is simpler: auth → find purchase/package → check-in → done
- Separating avoids polluting the kiosk codepath with conditional branches

**Logic flow**:
```
1. Clerk auth() → reject 401 if not signed in
2. Parse QR context (courseSlug, date, time) via existing parseQrCheckInContext()
3. Validate check-in window via isQrCheckInWindowOpen()
4. Resolve DB user via upsertUserByIdentifiers()
5. Find existing Attendance for (userId, sessionId)
   → If already checked in → return { alreadyCheckedIn: true }
6. Find Purchase for (userId, courseSlug, date)
   → If Stripe paid → upsert Attendance with status "checked_in"
   → If Cash pending → upsert Attendance with status "checked_in", flag cashPending
7. If no Purchase, check active PackagePurchase for courseSlug
   → If found → consume credit via PackageUsageLedger → create Attendance
8. If nothing found → return { rejected: true, message: "No booking found" }
9. Award points via existing awardPointsFromRule()
10. If cashPending → emit staff notification event
```

**Affected files**:
| File | Change |
|------|--------|
| `app/api/checkin/qr/client-phone/route.ts` | NEW — main endpoint |
| `lib/checkin/qr.ts` | No changes — reuse parseQrCheckInContext, isQrCheckInWindowOpen |
| `lib/purchase-status.ts` | No changes — reuse SUCCESSFUL_PURCHASE_STATUSES |

### Slice 2: Client UI — QR scan result page (~150 lines)

**Page**: `/checkin/qr` (already exists as kiosk entry point — extend with client detection)

**Flow**:
```
Scan QR → /checkin/qr?courseSlug=X&date=Y&time=Z
  → Detect: am I signed in via Clerk?
    → YES → call POST /api/checkin/qr/client-phone → show result
    → NO  → show "Sign in to check in" with redirect back
```

**Result states**:
- ✅ Success (Stripe paid): "You're checked in! Enjoy your class."
- ⚠️ Success (Cash pending): "Checked in — please pay $X at the front desk."
- ✅ Success (Package): "Checked in — 1 credit used. X remaining."
- ❌ Rejected: "No booking found for this class. [Book now →]"
- ⚠️ Already checked in: "You're already checked in for this class."
- 🕐 Window closed: "Check-in is not open yet / has closed."

**Affected files**:
| File | Change |
|------|--------|
| `app/checkin/qr/page.tsx` | MODIFY — add client-phone detection branch |
| `components/front/checkin/ClientPhoneCheckIn.tsx` | NEW — result UI component |

### Slice 3: Staff board — Web source badge + real-time cash alert (~120 lines)

**Purchase source tracking**:
- Add `purchaseSource: "web" | "kiosk" | "front_desk"` to Purchase metadata at checkout time
- Existing checkout routes already set `source: "stripe_webhook_checkout"` — extend with channel
- Cash checkout already sets `paymentChannel: "cash"` — add `purchaseSource: "web"` when from profile

**Board badge**:
- Derive from `metadata.purchaseSource` on each PaymentRow
- Show small "Web" / "Kiosk" chip next to payment method badge

**Real-time notification** (web-cash only):
- Simple polling approach: staff board already refreshes periodically
- Add a lightweight endpoint `GET /api/staff/checkin/web-cash-arrivals?since=<timestamp>`
- Returns list of students who checked in via web with cash pending since last poll
- Board shows toast/banner: "🔴 Ana Diaz checked in — $20 cash due"
- Poll interval: 10 seconds (only when board is visible)

**Affected files**:
| File | Change |
|------|--------|
| `app/api/checkout/cash/route.ts` | MODIFY — add `purchaseSource: "web"` to metadata |
| `app/api/stripe/webhook/route.ts` | MODIFY — add `purchaseSource: "web"` to metadata |
| `app/api/staff/checkin/web-cash-arrivals/route.ts` | NEW — polling endpoint |
| `components/front/staff/StaffStudentsBoardPanel.tsx` | MODIFY — add source badge |
| `components/front/staff/useStaffStudentsBoardAdmin.ts` | MODIFY — derive source from metadata |
| `components/front/staff/staffAdminTypes.ts` | MODIFY — add purchaseSource to PaymentRow |

## Estimated Line Count

| Slice | New | Modified | Total |
|-------|-----|----------|-------|
| 1. API | ~160 | ~0 | ~160 |
| 2. Client UI | ~100 | ~40 | ~140 |
| 3. Staff board | ~80 | ~60 | ~140 |
| **Total** | **~340** | **~100** | **~440** |

⚠️ Total ~440 exceeds 400-line budget slightly. With `ask-always` delivery strategy, recommend splitting into 2 PRs:
- PR1: Slice 1 + 2 (API + Client UI) — ~300 lines
- PR2: Slice 3 (Staff board) — ~140 lines

## Risks

1. **QR page dual-purpose**: `/checkin/qr` serves both kiosk and client-phone. Must not break kiosk flow. Mitigated by detecting Clerk auth vs kiosk session token.
2. **Package credit race condition**: Two simultaneous scans could double-deduct. Mitigated by `@@unique([userId, sessionId])` on Attendance and transaction-wrapped credit deduction.
3. **Polling vs WebSocket**: Polling at 10s is simple but not truly real-time. Acceptable for MVP; can upgrade to SSE/WebSocket later if needed.
4. **Cash collection enforcement**: The system notifies but can't force payment. Staff must act on the notification. This is a process constraint, not a technical one.
