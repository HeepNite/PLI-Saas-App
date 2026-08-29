# Design: Special Class Kiosk Check-in

## Technical Approach

Reuse-first. The canonical `ClassSession` already unifies special and regular classes, so all three capabilities are additive edits on shipped paths — no changes to the online special-class purchase path or the regular-class kiosk flow.

- **F1 (self check-in)**: already class-type-agnostic. `client-phone/route.ts` resolves Attendance by `userId_sessionId` (line 109) and matches Purchase by `courseSlug` + `metadata.date` (lines 138-150). A special-class Purchase carries `courseSlug` (`special-salsa-calena-2026-08-30`) plus `specialClassId`/`classSessionId`, and `admitSpecialClassAuthorization` already created a `SCHEDULED` Attendance at Stripe authorization. One gap: `matchingPurchase` requires `metadata.date` but the special-class Purchase is written by the reservation path, which may not set `metadata.date`. Fix = broaden the match to also select by `specialClassId` presence for the resolved session (see File Changes).
- **F2 (card walk-in)**: kiosk sends nothing that triggers the special branch. Point the kiosk QR at the existing reservation page instead of the generic checkout session — the customer self-enters name/email/phone there, which is exactly the web flow already verified end-to-end. This sidesteps the `attemptId` (UUID) + email hard requirement (`session/route.ts:58-64`) entirely.
- **F3 (cash walk-in)**: cash route creates a pending Purchase with no special-class linkage or Attendance (lines 301-348). Add a serializable admission that links the class, creates a checked-in Attendance, and marks the seat with a dedicated status so every capacity query counts it.

## Architecture Decisions

### Decision: F2 kiosk QR points at the reservation page, not `/api/checkout/session`

**Choice**: Kiosk card walk-in QR encodes `/special-classes/[slug]` (or `/special-salsa-class`), not a pre-created Stripe session.
**Alternatives**: (a) kiosk pre-collects details and calls `handleSpecialClassCheckout` with a synthesized `attemptId`+email; (b) relax the UUID/email requirement for `photoContext: kiosk_terminal`.
**Rationale**: The reservation page is the verified web flow with hold/pricing/capacity already wired. Reusing it means zero change to `handleSpecialClassCheckout`, no synthetic-identity data-quality risk, and the customer supplies a real email on their own phone. The Stripe webhook then creates the Attendance as it does online. Rejected (a)/(b) because they duplicate identity logic and weaken audit data for a one-off kiosk case.

### Decision: F3 pending-cash uses a distinct Purchase status `cash_pending`, added to shared capacity constant

**Choice**: Introduce status string `cash_pending` (no schema change — `Purchase.status` is a free-form string). Extract the duplicated `["paid","succeeded","completed","capture_pending"]` list into one exported `CAPACITY_STATUSES` (in `lib/special-classes/policy.ts` or `management.ts`) and add `cash_pending`. All four occupancy queries import it.
**Alternatives**: (a) give pending-cash a live `holdExpiresAt` and reuse the `pending` clause; (b) count checked-in Attendance directly in occupancy.
**Rationale**: `holdExpiresAt` (a) would expire a checked-in cash seat — wrong: a cash walk-in already in the room must never expire. Counting Attendance (b) diverges the occupancy model (Purchase-based) and double-counts. A distinct status keeps one consistent seat-count semantics, never expires, and cleanly settles to `paid` later without changing the occupied count (settlement is a status transition within the counted set).

### Decision: F3 admission is serializable and reuses the special-class boundary lock

**Choice**: Wrap cash special-class admission in a serializable transaction using `lockSpecialClassBoundary` + `FOR UPDATE`, mirroring `admitSpecialClassAuthorization`, with the same under-cap check before creating the seat.
**Rationale**: The 40-cap must hold across concurrent kiosk cash, online card, and held seats. Reusing the existing lock pattern guarantees one serialization point per special class.

## Data Flow

    F1  phone → client-phone/route → find Attendance(userId_sessionId)|Purchase(specialClassId)
                                    → flip Attendance CHECKED_IN (idempotent)

    F2  kiosk → QR(reservation page URL) → customer phone → /special-classes/[slug]
              → /api/checkout/session (special branch) → Stripe → webhook → Attendance

    F3  kiosk cash → /api/checkout/cash (special ctx) ──serializable──┐
              under-cap check → Purchase(cash_pending, specialClassId,│classSessionId)
              → Attendance CHECKED_IN  ← counted by CAPACITY_STATUSES ┘  (staff settle later)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/api/checkin/qr/client-phone/route.ts` | Modify | F1: broaden `matchingPurchase` (~146-150) to select a special-class Purchase for this session (by `specialClassId`/`classSessionId`) when `metadata.date` is absent; treat `cash_pending` special-class Purchase as check-in-eligible; keep `userId_sessionId` idempotency (already blocks double check-in). |
| `components/front/checkin/hooks/useCheckInQrController.ts` | Modify | F2: for a special-class session, build the kiosk QR from the reservation-page URL instead of the `sessionPayload`→`/api/checkout/session` path (~531-556). |
| `lib/checkin/kiosk-qr-payment.ts` | Modify | F2: add a helper that returns the special-class reservation URL for `buildKioskCheckoutQrImageUrl`; keep the QR image builder unchanged. |
| `app/api/checkout/cash/route.ts` | Modify | F3: when body carries special-class context (`checkoutKind`/`specialClassId`), route to a serializable admission that links class, sets `status: cash_pending`, and creates a `CHECKED_IN` Attendance (replaces the plain create at 301-348 for this branch). |
| `lib/special-classes/fulfillment.ts` | Modify | F3: import shared `CAPACITY_STATUSES` (now incl. `cash_pending`); occupancy `count` (line 116-122) and expiry sweep unchanged otherwise. Add `admitSpecialClassCashWalkIn(...)` (new export) implementing the serializable seat+Attendance creation. |
| `lib/special-classes/management.ts` | Modify | F3: replace local `ACTIVE_CAPACITY_STATUSES` (line 3) with the shared constant so capacity validation counts `cash_pending`. |
| `lib/special-classes/read-model.ts` | Modify | F3: `paid` count (line 18) and `available` (line 33) must include `cash_pending` so roster/metrics and sold-out display are correct. |
| `lib/checkout/special-class-reservation.ts` | Modify | F3: occupancy counts (lines 102/114) use shared `CAPACITY_STATUSES` so online reservation sees cash seats. |
| `lib/special-classes/policy.ts` | Modify | Export shared `CAPACITY_STATUSES = ["paid","succeeded","completed","capture_pending","cash_pending"]`. |

## Interfaces / Contracts

```ts
// lib/special-classes/fulfillment.ts (new)
export async function admitSpecialClassCashWalkIn(db: PrismaClient, input: {
  specialClassId: string
  dbUserId: string
  amount: number        // from resolveSpecialClassPricing(now)
  currency: string
  source: string        // "kiosk_cash_walk_in"
  eventId: string       // idempotency key basis
  now?: Date
}): Promise<{ purchaseId: string; attendanceId: string } | { code: "SOLD_OUT" | "NOT_AVAILABLE" }>
```

Idempotency: reuse the audit-log `idempotencyKey` pattern (`${eventId}:cash_walk_in`) and Attendance `userId_sessionId` uniqueness so a double-tap yields one seat.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Shared `CAPACITY_STATUSES` includes `cash_pending`; pricing reuse via `resolveSpecialClassPricing` | Vitest constant + pricing assertions |
| Integration | F3 admission is serializable and never oversells 40 across paid/held/cash; settlement (`cash_pending`→`paid`) does not change occupied count | Extend `tests/integration/special-salsa-class-capacity.test.ts` |
| Integration | F1 phone check-in flips the special-class `SCHEDULED`/`cash_pending` Attendance; idempotent on repeat | New integration test on `client-phone` route |
| Integration | Cancelled/unpublished special class blocks check-in and cash admission | Assert `NOT_AVAILABLE`/rejected |
| E2E/manual | F2 kiosk QR opens reservation page → Stripe → webhook Attendance | Manual kiosk pass |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The only "routing" is Next.js API branch selection on request body, covered by input validation and the existing serializable capacity guard.

## Migration / Rollout

No schema migration. `cash_pending` is a new value in the existing free-form `Purchase.status` string; no enum. Rollback = revert F1/F2/F3 commits; any lingering `cash_pending` rows are inert unless a query references them (all references land together). Feature is additive per request-body branch.

## Open Questions

- [ ] PRODUCT: Cash walk-in without email — reservation page (F2) collects email, but the cash path (F3) may accept a no-email walk-in. Confirm receipts/audit tolerate a synthesized/placeholder email for cash seats (proposal Business Rule). Default assumption: cash seat stores whatever kiosk collected; email optional for cash, required for card.
- [ ] PRODUCT: Should a `cash_pending` seat auto-release if the class starts and the customer never settled, or does it stay counted until staff settle/void? Design assumes it stays counted (no expiry) — confirm.
