# Exploration: consecutive-offer-before-checkin

## Current State

### Package Holder Check-In Flow (today)

```
PIN entered
  → useKioskPinFlow resolves → kioskPinSessionToken set
  → loadBootstrap() fires
  → bootstrap.package truthy
  → shouldAutoTriggerPackageCheckIn() returns true
  → handlePackageCheckIn() called (auto, no user interaction)
    → POST /api/checkin/qr/package (deducts credit, creates Attendance + Purchase)
    → setPackageCheckInResult({ remainingCredits, points })
  → KioskPackageSuccessOverlay shows (2.5s timer)
    → timer fires → checkConsecutiveOfferAfterCheckIn()
      → POST /api/checkin/qr/bootstrap (fetches consecutiveOffer)
      → setConsecutiveOffer() + setShowConsecutiveOverlay(true)
  → ConsecutiveClassOffer overlay shows
    → Accept → handleConsecutiveAccept() → POST /api/checkin/qr/package { consecutiveAddOn: true }
    → Decline → handleStationCompletion()
```

### Key code locations

| Concern | File | Lines |
|---------|------|-------|
| Auto-trigger gate | `lib/checkin/existing-customer-flow.ts` | `shouldAutoTriggerPackageCheckIn()` L131-L144 |
| Auto-trigger effect | `CheckInQrClient.tsx` | L1031-L1056 |
| handlePackageCheckIn | `CheckInQrClient.tsx` | L498-L587 |
| Post-check-in consecutive check | `CheckInQrClient.tsx` | L462-L496 (`checkConsecutiveOfferAfterCheckIn`) |
| Success overlay + timer | `CheckInQrClient.tsx` | L555-L566 (inside `handlePackageCheckIn`) |
| Pre-auth consecutive fetch | `CheckInQrClient.tsx` | L292-L335 (GET `/api/checkin/terminal/consecutive-offer`) |
| `consecutiveOfferSettled` gate | `CheckInQrClient.tsx` | L309 / L331 |
| ConsecutiveClassOffer render | `CheckInQrClient.tsx` | L1376-L1385 |

### Pre-fetch already exists

There is already a pre-auth fetch for consecutive offer (L292–L335):
- Hits `GET /api/checkin/terminal/consecutive-offer?courseSlug=...` — no auth required
- Sets `consecutiveOffer` state early
- `consecutiveOfferSettled` becomes `true` when resolved (used to gate new-student flow)
- **This data is already available before bootstrap fires**

### The Race Condition Context

`consecutiveOfferSettled` was recently added to fix a race condition where `openNewBooking` fired before the consecutive offer fetch resolved. The same pattern applies here.

---

## Proposed Change

### New Flow

```
PIN entered
  → loadBootstrap() → bootstrap.package truthy
  → shouldAutoTriggerPackageCheckIn() runs BUT is gated
  → NEW GATE: if (consecutiveOffer && consecutiveOfferSettled) → SKIP auto-trigger → SHOW OFFER FIRST
    → ConsecutiveClassOffer overlay shows
      → Accept path:
          1. POST /api/checkin/qr/package (check in class A, deduct credit)
          2. POST /api/checkin/qr/package { consecutiveAddOn: true } (book class B)
          → KioskPackageSuccessOverlay (combined) → done
      → Decline path:
          1. POST /api/checkin/qr/package (check in class A, deduct credit)
          → KioskPackageSuccessOverlay → done
  → If no consecutive offer: original auto-trigger flow unchanged
```

---

## Interception Point

**Location**: `CheckInQrClient.tsx` — the `useEffect` at L1031 that calls `shouldAutoTriggerPackageCheckIn`.

**Current code**:
```tsx
React.useEffect(() => {
  if (!shouldAutoTriggerPackageCheckIn({ ... })) return
  void handlePackageCheckIn()
}, [...])
```

**Modified gate**:
```tsx
React.useEffect(() => {
  if (!shouldAutoTriggerPackageCheckIn({ ... })) return

  // NEW GATE — if consecutive offer exists and is settled, show offer first
  if (consecutiveOffer && consecutiveOfferSettled) {
    setShowConsecutiveOverlay(true)
    return
  }

  // If offer fetch not yet settled, wait (effect re-fires when settled)
  if (!consecutiveOfferSettled) return

  // No offer → proceed with original auto-trigger
  void handlePackageCheckIn()
}, [bootstrap, ..., consecutiveOffer, consecutiveOfferSettled])
```

**Alternative in `shouldAutoTriggerPackageCheckIn`**: Add `hasConsecutiveOffer` and `consecutiveOfferSettled` params. Cleaner separation, easier to test.

---

## Affected Areas

- `components/front/checkin/CheckInQrClient.tsx`
  - Auto-trigger `useEffect` (L1031–L1056): add gate for consecutive offer
  - `handleConsecutiveAccept()` (L593–L652): currently assumes check-in already happened — must be modified to call `handlePackageCheckIn()` FIRST if `packageCheckInResult` is null
  - `handleConsecutiveDecline()` (L654–L658): must call `handlePackageCheckIn()` (not skip it)
  - `handleConsecutiveSuccessDone()` (L660–L664): flow ends at `handleStationCompletion()` — OK
  - Inactivity state (L1112): `consecutiveOfferOpen` already tracked — no change needed

- `lib/checkin/existing-customer-flow.ts`
  - `shouldAutoTriggerPackageCheckIn()` (L131–L144): optionally add `hasConsecutiveOffer` + `consecutiveOfferSettled` params for cleaner logic

- `components/front/checkin/ConsecutiveClassOffer.tsx`
  - No changes needed. `isPackageHolder` prop already exists and works correctly.
  - `packageHolderConsecutiveCents` is already in the offer shape.

---

## Component Reuse Analysis

### ConsecutiveClassOffer.tsx — fully reusable

| Prop | Status | Notes |
|------|--------|-------|
| `offer: ConsecutiveOfferData` | ✅ Already fetched pre-auth | Pre-auth endpoint returns this exact shape |
| `isPackageHolder: boolean` | ✅ Known at display time | `Boolean(bootstrap?.package)` — bootstrap is loaded before we show |
| `onAccept` | ⚠️ Needs re-wiring | Currently calls dropin/package endpoint assuming check-in done |
| `onDecline` | ⚠️ Needs re-wiring | Currently skips check-in entirely |
| `isProcessing` | ✅ Reuse as-is | |

The component UI is 100% reusable. Only the `onAccept` / `onDecline` handlers in `CheckInQrClient` need new logic.

---

## Risk Analysis

### Risk 1: Accept path — sequential operations, partial failure

**Scenario**: User accepts → package check-in (class A) succeeds → class B booking fails  
**Current API**: Both calls are separate HTTP requests, no DB transaction spans them  
**Mitigation Options**:
- **Option A (sequential, no atomicity)**: Call `handlePackageCheckIn()` then, on success, call consecutive add-on. If B fails → show retry UI. User is checked in for A, B is not booked. This is acceptable UX for a kiosk.
- **Option B (new combined endpoint)**: Create `POST /api/checkin/qr/package-with-consecutive` that wraps both operations in a single `prisma.$transaction`. Atomic, but adds a new server route.
- **Recommended**: Option A — the existing consecutive add-on endpoint already handles idempotency (checks for `existingAttendance`). Retry is sufficient. A new combined endpoint adds complexity without compelling justification.

### Risk 2: Decline path — check-in must still happen

**Current code**: `handleConsecutiveDecline` calls `handleStationCompletion()` directly (assumes check-in already done).  
**Fix**: After offer is shown PRE-check-in, decline must trigger `handlePackageCheckIn()` first, then `handleStationCompletion()` on success.

### Risk 3: Race between bootstrap load and consecutive offer fetch

**Analysis**: The pre-auth consecutive fetch fires on `activeCourseSlug` (L292). Bootstrap fires on session auth (L939–L944). In practice:
- Consecutive fetch is lightweight (no auth, just DB read) — typically settles in ~200ms
- Bootstrap requires auth token + POST — typically ~400–800ms
- The offer is almost always settled BEFORE bootstrap resolves
- **Safety**: The gate `!consecutiveOfferSettled` blocks the auto-trigger until settled. No race condition.

### Risk 4: consecutiveOffer set by TWO sources

Offer can be set by:
1. Pre-auth GET (L292–L335)
2. Bootstrap POST response (L441–L443)

Both set the same state (`setConsecutiveOffer`). If bootstrap overrides with a null, the offer disappears. 

**Mitigation**: In `loadBootstrap()` at L441, only set if data exists:
```tsx
if (data?.consecutiveOffer) {
  setConsecutiveOffer(data.consecutiveOffer as ConsecutiveOffer)
}
// Already correct — no null override
```
This is already correctly implemented (L441–L443). No change needed.

### Risk 5: consecutiveOfferSettled=false blocks auto-trigger indefinitely

If the consecutive-offer API call fails (network error), it goes to `.catch()` → `.finally()` → `setConsecutiveOfferSettled(true)`. Correct — settled is set regardless of error. No blocking risk.

### Risk 6: User sees offer when window is not open

The auto-trigger gate already checks `effectiveCheckInWindowOpen`. The offer gate fires AFTER this check, so the window is guaranteed open when the offer is shown.

### Risk 7: Showing offer when bootstrap.package is null

`shouldAutoTriggerPackageCheckIn` already returns false if `!hasPackage`. The offer gate is inside this check, so it only activates for package holders.

---

## Data Availability

At the moment the offer gate fires:

| Data | Available? | Source |
|------|-----------|--------|
| `consecutiveOffer` | ✅ Yes | Pre-auth GET, settled before bootstrap |
| `consecutiveOfferSettled` | ✅ Yes | Set in finally block |
| `bootstrap.package` | ✅ Yes | loadBootstrap() resolved |
| `effectiveCheckInWindowOpen` | ✅ Yes | Derived from bootstrap.context |
| `hasActiveClerkSession \|\| hasKioskPinSession` | ✅ Yes | Required for loadBootstrap to run |

All required data is available. No additional fetch is needed to show the offer before check-in.

---

## Approaches

### Approach A — Gate in CheckInQrClient (minimal change)

Add gate directly in the auto-trigger `useEffect`.

**Pros**:
- Minimal blast radius — only 4 handlers modified in `CheckInQrClient`
- No new functions, no new files
- `consecutiveOfferSettled` already solves the race condition
- `ConsecutiveClassOffer` component reused unchanged

**Cons**:
- `handleConsecutiveAccept` logic becomes conditional (pre vs post check-in context)
- `handleConsecutiveDecline` needs a new branch

**Effort**: Low

### Approach B — Extract a `useConsecutivePackageOffer` hook

Create `useConsecutivePackageOffer.ts` hook that manages the pre-check-in offer state, handles accept/decline with check-in orchestration.

**Pros**:
- Cleaner separation
- Easier to test in isolation

**Cons**:
- More files to maintain
- Current `CheckInQrClient` hooks are already granular; this adds one more
- `handlePackageCheckIn` would need to be passed in or duplicated

**Effort**: Medium

### Approach C — New combined endpoint (atomic)

Create `POST /api/checkin/qr/package-and-consecutive` that atomically handles both operations.

**Pros**:
- True atomicity — either both succeed or neither
- Cleaner server-side

**Cons**:
- New route = new surface area
- Current approach (sequential calls) is acceptable for kiosk: retry UX handles partial failure
- `hasAttendedCourseToday` check already provides idempotency

**Effort**: High

---

## Recommendation

**Approach A** — gate in `CheckInQrClient.tsx`, sequential API calls.

Rationale:
1. The data is already available — no new fetches, no new endpoints.
2. `ConsecutiveClassOffer.tsx` works as-is.
3. The consecutive add-on endpoint already has proper idempotency.
4. The `consecutiveOfferSettled` race condition guard already exists and works.
5. Minimum changes to a complex component with well-established state.

### Implementation steps (ordered)

1. **Modify `shouldAutoTriggerPackageCheckIn`** in `existing-customer-flow.ts`:
   - Add `hasConsecutiveOffer: boolean` + `consecutiveOfferSettled: boolean` params
   - Return `false` if `hasConsecutiveOffer && consecutiveOfferSettled` (show offer first)
   - Return `false` if `!consecutiveOfferSettled` (wait for fetch)

2. **Add `showConsecutiveOverlay` trigger** in auto-trigger `useEffect`:
   - When gate says "show offer first" → `setShowConsecutiveOverlay(true)`

3. **Modify `handleConsecutiveAccept`**:
   - If `!packageCheckInResult` (pre-check-in): call `handlePackageCheckIn()` first
   - On check-in success: call consecutive add-on (as today)
   - On check-in failure: show error (not consecutive error — the check-in itself failed)

4. **Modify `handleConsecutiveDecline`**:
   - If `!packageCheckInResult` (pre-check-in): call `handlePackageCheckIn()` first, then `handleStationCompletion()`
   - If post-check-in (existing behavior): just `handleStationCompletion()`

5. **Add deps** to auto-trigger `useEffect`: `consecutiveOffer`, `consecutiveOfferSettled`

6. **Inactivity tracking**: `consecutiveOfferOpen: Boolean(showConsecutiveOverlay && consecutiveOffer)` already covers both pre and post scenarios — no change needed (L1112).

---

## Risks Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Class A success, Class B failure | Medium | Retry UI in `ConsecutiveOfferError`; idempotent endpoint |
| Decline skips check-in | High | Must call `handlePackageCheckIn()` before `handleStationCompletion()` in decline handler |
| Race: fetch not settled | Low | `consecutiveOfferSettled` gate prevents premature auto-trigger |
| Double-set of `consecutiveOffer` | Low | Both sources set truthy value; bootstrap does not override with null |
| Window closed mid-offer | Low | User entered flow while window was open; closure is rare within 2.5s decision window |

---

## Ready for Proposal

Yes. The exploration is complete. The scope is clear, the interception point is identified, the component is reusable, and the risk mitigations are defined. Next step: `sdd-propose`.
