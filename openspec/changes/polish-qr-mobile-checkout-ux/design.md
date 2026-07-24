# Design: Polish QR Mobile Checkout UX

## Technical Approach

Presentation-layer polish across 5 files + 1 util. Every shared-component change is gated on a single mobile-QR predicate so the kiosk terminal renders byte-identical. Welcome and success screens are mobile-QR-only by construction. Stripe modal is proven kiosk-isolated (see Decision 2), so its fixes apply unconditionally. A small friendly-date helper is added and reused; a single redirect effect covers all success terminals. All code facts verified against the working dir; where develop may diverge, tasks must re-confirm before editing (see Open Questions).

## Architecture Decisions

### Decision 1: One gating predicate for StepPayments
**Choice**: `const mobileQrCheckin = isCheckInFlow && !isKioskTerminalFlow` — derived once inside `StepPayments`, gates every redesigned block.
**Alternatives**: gate on `isQrMobileCompactFlow` (not passed to StepPayments); per-block ad-hoc conditions (drift risk).
**Rationale**: `EnrollModal.tsx` sets `isCheckInFlow` true for both surfaces (L84) and `isKioskTerminalFlow` true only for kiosk (`photoFlowContext === "kiosk_terminal"`, L89). The AND-NOT cleanly isolates mobile-QR. Kiosk keeps the current L118+ rendering unchanged because those blocks stay behind `isCheckInFlow` (true) while new mobile layout hides behind `mobileQrCheckin`.

### Decision 2: Stripe modal changes apply unconditionally (no gate)
**Choice**: Edit `StripePaymentModal.tsx` directly; no kiosk gate.
**Alternatives**: gate modal styles on a flow flag.
**Rationale**: Verified `StripePaymentModal` is imported ONLY by `EnrollModal.tsx` (L10) and reached via the non-kiosk card path (`setShowStripeModal`). The kiosk card path renders a SEPARATE component, `KioskQrPaymentPanel` (EnrollModal L302), a hosted-checkout QR panel with its own layout. Modal edits cannot leak to kiosk.

### Decision 3: Friendly-date helper lives in a small util, reused
**Choice**: Add `formatFriendlyDateTime(date, time)` to `components/front/courses/utils/` (new `datetime.ts` or extend an existing date util) returning `Friday, July 24 · 8:10 PM` via `Intl.DateTimeFormat("en-US", { weekday:"long", month:"long", day:"numeric" })` + existing `to12h`. StepPayments imports it.
**Alternatives**: inline the formatter in JSX (bloat, untestable).
**Rationale**: Clean-architecture rule — no monster files; keep StepPayments presentational and unit-test the formatter in isolation.

### Decision 4: Logo asset = `logo-white.png`
**Choice**: `next/image` with `src="/logo/logo-white.png"` in the `WelcomeScreen` card (CheckInPageRouter L92 area), centered above "Welcome!", ~`h-10 w-auto`.
**Alternatives**: `logo-black.png` (invisible on dark bg); reuse `BrandedSuccessHeader` (not present on develop per note — do not depend on it).
**Rationale**: Card background is dark gradient `from-[#151118] via-[#0d0b12] to-[#09090d]` → white logo. Both assets confirmed present.

### Decision 5: Phone fix — add the equal-count-shorter-string branch, global
**Choice**: In `formatUSPhoneOnChange`, add a branch BEFORE the reformat: if `newDigits.length === oldDigits.length && newValue.length < oldValue.length` → the user deleted a trailing format char → `return formatUSPhone(oldDigits.slice(0, -1))`. Apply globally (no gate).
**Alternatives**: gate to mobile-QR only.
**Rationale**: Existing code only handles `newDigits.length < oldDigits.length`; the format-char-delete loop keeps digit count equal. Kiosk on-screen keypad emits digits only and never hits this path, so global is strictly better and simpler.

### Decision 6: Single 5s redirect effect across success terminals
**Choice**: One `useEffect` in `ClientPhoneCheckIn` that, when `result` is a SUCCESS terminal (`already_checked_in`, `checked_in` cash-pending, `checked_in` package, standard Stripe-paid), starts a 5000ms timer → `router.push("/client-profile")`, with cleanup on unmount. Does NOT fire on `error`, `invalid`, `window_closed`, `rejected` (user must act).
**Alternatives**: per-branch timers (duplication, leak risk); redirect on every terminal (would strand users on error states).
**Rationale**: Locked decision is "always 5s on success, including the promo/package card." A single effect keyed on the resolved success status guarantees coverage and clean teardown. Divergence note: proposal said "3 success states"; there are 4 success terminals — all covered by the one effect.

## Data Flow

    EnrollModal (sets isCheckInFlow, isKioskTerminalFlow, showStripeModal)
        │
        ├── StepPayments ── mobileQrCheckin = isCheckInFlow && !isKioskTerminalFlow
        │        └── formatFriendlyDateTime(date, time)  [util]
        │
        ├── StripePaymentModal (non-kiosk card path only)   [KioskQrPaymentPanel = kiosk, untouched]
        │
    CheckInPageRouter ── WelcomeScreen (logo-white) | ClientPhoneCheckIn
                                                          └── redirect effect ─5s─→ /client-profile
    phone.ts formatUSPhoneOnChange (global, all phone inputs)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/front/courses/utils/datetime.ts` | Create | `formatFriendlyDateTime(date, time)` → `Friday, July 24 · 8:10 PM` (reuses `to12h`) |
| `components/front/courses/enroll/steps/StepPayments.tsx` | Modify | Add `mobileQrCheckin` predicate; drop duplicate Course line; use friendly date; collapse CLASSES to priced line-items + coupon + total; Cash/Card same row on mobile; relabel Card option to `Card · Apple Pay · Google Pay` / "Pay with card or phone wallet." — all behind `mobileQrCheckin`; kiosk blocks untouched |
| `components/front/payments/StripePaymentModal.tsx` | Modify | Replace `mt-[11rem]`+`h-[56vh]` hack with `max-h-[85vh]` flex column; scrollable PaymentElement region + sticky footer (Back/Pay always visible); backdrop `bg-black/60 backdrop-blur-md`; English subtitle "Pay with card or phone wallet." (fixes Spanish L89) |
| `components/front/checkin/CheckInPageRouter.tsx` | Modify | Add centered `next/image` `logo-white.png` above "Welcome!" in `WelcomeScreen` |
| `components/front/checkin/ClientPhoneCheckIn.tsx` | Modify | Single 5s redirect effect → `/client-profile` on success terminals (incl. promo/package card) |
| `components/front/courses/utils/phone.ts` | Modify | Add equal-count-shorter-string branch to `formatUSPhoneOnChange` |

## Interfaces / Contracts

```ts
// utils/datetime.ts
export function formatFriendlyDateTime(date: string, time: string): string
// e.g. "Friday, July 24 · 8:10 PM"; returns "" for empty date

// utils/phone.ts — extended logic
export const formatUSPhoneOnChange = (newValue: string, oldValue: string) => {
  const newDigits = getUsPhoneDigits(newValue)
  const oldDigits = getUsPhoneDigits(oldValue)
  if (newDigits.length < oldDigits.length) return formatUSPhone(oldDigits.slice(0, -1))
  // NEW: trailing format char deleted (digit count equal, string shorter)
  if (newDigits.length === oldDigits.length && newValue.length < oldValue.length)
    return formatUSPhone(oldDigits.slice(0, -1))
  return formatUSPhone(newValue)
}
```

Stripe modal layout: outer `flex items-center justify-center bg-black/60 backdrop-blur-md`; panel `w-full sm:max-w-md rounded-2xl bg-white flex flex-col max-h-[85vh] overflow-hidden`; header (static) + `<div className="flex-1 overflow-y-auto">PaymentElement</div>` + footer `<div className="shrink-0 border-t bg-white ...">Back / Pay</div>`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `formatUSPhoneOnChange` cases: normal typing, digit delete, trailing-format-char delete (no loop), paste full number, empty→`+1 ` | Jest/vitest table cases on util |
| Unit | `formatFriendlyDateTime` output + empty-date guard | pure fn assertions |
| Manual | Kiosk StepPayments renders unchanged (`isKioskTerminalFlow` true) vs mobile-QR redesigned | side-by-side render check |
| Manual | Stripe modal on real mobile: only PaymentElement scrolls, Back/Pay visible, Apple/Google Pay sheet opens over modal | device test |
| Manual | 5s redirect fires on each success terminal incl. promo card; does NOT fire on error/rejected | device test |

Phone cases to preserve: normal forward typing; backspace over a digit; backspace over trailing format char `)`/`-`/space (the fix); paste `5551234567`; delete to empty → `+1 `; cursor-mid-string edits should not regress (equal-count branch only triggers when string got shorter).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure presentation + one string util.

## Migration / Rollout

No migration. Revert the branch to restore prior UI verbatim.

## Kiosk-Unchanged Verification Approach

1. StepPayments: confirm every new block is behind `mobileQrCheckin`; existing `isCheckInFlow`/`isKioskTerminalFlow` blocks (L98, L118) keep current output when `isKioskTerminalFlow` is true.
2. Stripe modal: no kiosk import (grep-confirmed sole importer = EnrollModal, non-kiosk card path); kiosk uses `KioskQrPaymentPanel`.
3. Phone util: kiosk keypad emits digits only; new branch requires a shorter string with equal digit count → unreachable on kiosk.
4. Verify step: render kiosk payments with `photoFlowContext="kiosk_terminal"` and diff against baseline.

## Open Questions

- [ ] CODE-BASE-OF-TRUTH: all facts verified against the working dir (`rescue/fable-local-changes`). Tasks/apply MUST re-confirm on `origin/codex/develop` that line anchors and the `formatUSPhoneOnChange` current body still match before editing (develop may already carry a partial fix or a `BrandedSuccessHeader`).
- [ ] Divergence: proposal cited "3 success states"; actual = 4 success terminals (already_checked_in, cash-pending, package, standard). Single redirect effect covers all — confirmed, not blocking.
