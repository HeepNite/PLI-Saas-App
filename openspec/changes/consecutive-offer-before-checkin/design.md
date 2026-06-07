# Design: Consecutive Offer Before Check-In

## Technical Approach

Reorder the kiosk package-holder flow so the `ConsecutiveClassOffer` overlay is shown BEFORE the package check-in API is fired. Achieved by:

1. Extending `shouldAutoTriggerPackageCheckIn()` with offer-awareness — it returns `false` while a settled offer is pending the user's decision.
2. The auto-trigger `useEffect` in `CheckInQrClient.tsx` becomes the single decision point: when the gate suppresses auto check-in due to a settled offer, it surfaces the overlay (`setShowConsecutiveOverlay(true)`).
3. `handleConsecutiveAccept` and `handleConsecutiveDecline` become responsible for calling `handlePackageCheckIn()` when `packageCheckInResult` is still null (i.e., we are in pre-checkin offer mode).

No new components, hooks, endpoints, or DB changes. Sequential API calls reuse the existing idempotent `/api/checkin/qr/package` endpoint.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Where to gate | Existing auto-trigger `useEffect` (L1031) + `shouldAutoTriggerPackageCheckIn` | New dedicated effect; component-level wrapper | Single source of truth for "should we auto check-in?". Pure helper stays unit-testable. |
| Pre-checkin signal | `packageCheckInResult === null` inside consecutive handlers | New boolean state `preCheckinMode` | Reuses existing state. Adding a flag would create two sources of truth that can drift. |
| API sequencing | Sequential (check-in then add-on), client-orchestrated | New atomic combined endpoint | Add-on endpoint is idempotent; failure of class B doesn't poison class A. Avoids API surface change. |
| Class A failure during Accept | Surface error in `ConsecutiveOfferError`, allow retry/dismiss | Auto-rollback (impossible — credit deducted) | Credit deduction is non-reversible without admin tooling. Idempotency makes retry safe. |
| Class B failure after Class A success | Show `ConsecutiveOfferError` with retry; dismiss → station completion | Force completion silently | Student paid for a ticket they didn't get; must be visible. Idempotent retry is safe. |
| Decline path | Explicit `handlePackageCheckIn()` call before `handleStationCompletion()` | Implicit auto check-in on decline event | Decline must perform the irreversible act intentionally — no hidden side-effects. |

## Data Flow

```
PIN → bootstrap loaded (hasPackage=true)
  │
  ├── consecutive offer pre-fetch (already exists, L292-335)
  │        └─→ consecutiveOfferSettled = true
  │
  ▼
auto-trigger useEffect re-fires (deps include consecutiveOffer + Settled)
  │
  ├── shouldAutoTriggerPackageCheckIn(... hasConsecutiveOffer, consecutiveOfferSettled)
  │
  ├── offer present + settled → return false → setShowConsecutiveOverlay(true)
  │        ├── Accept → handleConsecutiveAccept
  │        │     └─→ if !packageCheckInResult: await handlePackageCheckIn()
  │        │            └─→ POST /api/checkin/qr/package           [class A]
  │        │     └─→ POST /api/checkin/qr/package {consecutiveAddOn:true}  [class B]
  │        │     └─→ on B-fail: setConsecutiveError, retry available
  │        │
  │        └── Decline → handleConsecutiveDecline
  │              └─→ if !packageCheckInResult: await handlePackageCheckIn()
  │              └─→ handleStationCompletion()
  │
  └── no offer (or fetch failed → settled with null) → return true → handlePackageCheckIn()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/checkin/existing-customer-flow.ts` | Modify | Add `hasConsecutiveOffer` + `consecutiveOfferSettled` params to `shouldAutoTriggerPackageCheckIn`. Returns `false` when an offer exists but is not settled, OR when a settled offer is pending user decision. |
| `components/front/checkin/CheckInQrClient.tsx` | Modify | (a) Pass new params to gate at L1033. (b) After gate returns false due to settled offer, call `setShowConsecutiveOverlay(true)`. (c) Add `consecutiveOffer`, `consecutiveOfferSettled` to effect deps. (d) `handleConsecutiveAccept`: guard `!packageCheckInResult` → `await handlePackageCheckIn()` before existing class-B request; bail out on A failure. (e) `handleConsecutiveDecline`: same guard → `await handlePackageCheckIn()` then `handleStationCompletion()`. |

`ConsecutiveClassOffer.tsx` — no changes.

## Interfaces / Contracts

```ts
// lib/checkin/existing-customer-flow.ts
export const shouldAutoTriggerPackageCheckIn = (input: {
  isKioskTerminalFlow: boolean
  mode: "idle" | "existing" | "new"
  hasPackage: boolean
  processingPackageCheckIn: boolean
  hasPackageCheckInResult: boolean
  effectiveCheckInWindowOpen: boolean
  hasActiveSession: boolean
  // NEW
  hasConsecutiveOffer: boolean
  consecutiveOfferSettled: boolean
}) => boolean
```

Behavior table:

| hasConsecutiveOffer | consecutiveOfferSettled | hasPackageCheckInResult | Result |
|---|---|---|---|
| false | * | false | true (auto-checkin, original) |
| true | false | false | false (wait for fetch) |
| true | true | false | false (overlay-first; caller shows overlay) |
| * | * | true | false (already done) |

The caller distinguishes "wait" vs "show overlay" by checking `consecutiveOffer && consecutiveOfferSettled` after the gate returns false.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `shouldAutoTriggerPackageCheckIn` truth table for all 4 new combinations | Vitest, pure function |
| Unit | `handleConsecutiveDecline` calls `handlePackageCheckIn` when `!packageCheckInResult` | RTL with mocked fetch |
| Unit | `handleConsecutiveAccept` aborts class-B when class-A fails | RTL with mocked fetch sequence |
| Integration | Package holder + offer → overlay shows before any POST | RTL on `CheckInQrClient`, assert no `/api/checkin/qr/package` until Accept/Decline |
| Integration | Package holder, no offer → original auto-checkin path unchanged | Existing test must still pass |
| Integration | Drop-in + offer (EnrollModal flow) → unaffected | Existing test must still pass |

## Migration / Rollout

No migration required. Change is client-side behavior only; no DB or API schema changes. Rollback = revert the two files.

## Open Questions

- [ ] Should `consecutiveOfferError` after a successful class A include explicit messaging about the deducted credit (transparency about non-rollback)? Resolved as out-of-scope — keep current error UX; add to follow-up if support tickets surface.
