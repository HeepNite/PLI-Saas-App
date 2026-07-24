# Tasks: Polish QR Mobile Checkout UX

Worktree: `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-qr-ux`, branch `feat/qr-mobile-checkout-ux` (base `origin/codex/develop`).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~90-120 (Slice A), ~150-200 (Slice B), ~110-150 (Slice C) — total ~350-470 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR A (phone fix + logo) → PR B (StepPayments redesign) → PR C (Stripe modal + redirect) |
| Delivery strategy | force-chained PRs |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Global phone-backspace fix + welcome-screen logo | PR A (base: `feat/qr-mobile-checkout-ux` tracker) | `pnpm vitest run components/front/courses/utils/phone.test.ts` | Manual: type/backspace/paste in any phone input (sign-in, check-in) | Revert `phone.ts` branch + `CheckInPageRouter.tsx` logo block independently; no shared state |
| B | `StepPayments` mobile-QR-gated redesign (date util, dedupe, layout, card label) | PR B (base: PR A branch) | `pnpm vitest run components/front/courses/utils/datetime.test.ts` | Manual: render `StepPayments` with `isCheckInFlow=true, isKioskTerminalFlow=false` vs kiosk true | Revert `StepPayments.tsx` + `datetime.ts`; kiosk branch untouched so no cross-file rollback risk |
| C | `StripePaymentModal` viewport/scroll/English fix + single 5s success redirect | PR C (base: PR B branch) | `pnpm tsc --noEmit` (no dedicated unit target; modal is layout-only) | Manual on real mobile device: modal scroll/sticky footer, Apple/Google Pay sheet; each success terminal auto-redirects at 5s, error/invalid does not | Revert `StripePaymentModal.tsx` + redirect effect in `ClientPhoneCheckIn.tsx` independently |

## Phase 0: Pre-flight (base-branch re-verification)

- [x] 0.1 In the worktree, diff `components/front/courses/utils/phone.ts` `formatUSPhoneOnChange` against the design's documented current body; confirm it still lacks the equal-count-shorter-string branch before editing.
- [x] 0.2 Confirm `public/logo/logo-white.png` and `public/logo/logo-black.png` both exist in the worktree.
- [ ] 0.3 Confirm `StripePaymentModal` has no other importer besides `EnrollModal.tsx` (`grep -rn "StripePaymentModal" components/`) and that kiosk card path renders `KioskQrPaymentPanel`, not the modal.
- [x] 0.4 Confirm `CheckInPageRouter.tsx` still lacks a `BrandedSuccessHeader`/logo in the unauthenticated welcome branch (no accidental duplicate from a develop merge).

## Phase A: Global Phone Fix + Welcome Logo (PR A, base = tracker branch)

*Satisfies: Requirement "Phone Input Formatting on Change"; Requirement "Welcome Screen Branding".*

- [x] A.1 In `components/front/courses/utils/phone.ts`, add the branch to `formatUSPhoneOnChange`: `if (newDigits.length === oldDigits.length && newValue.length < oldValue.length) return formatUSPhone(oldDigits.slice(0, -1))`, placed before the final `return formatUSPhone(newValue)`.
  Done when: backspacing after `+1 (515` (format-char delete, equal digit count) strips a digit instead of no-op — matches scenario "Backspace over a format character removes a digit, not nothing".
- [x] A.2 Write/extend `phone.test.ts` table cases: normal backspace over digit, backspace over trailing format char (loop-free), paste `5151234567`, delete-to-empty, mid-string digit insert/delete.
  Done when: all cases pass and match the 4 phone scenarios in spec.
- [x] A.3 In `components/front/checkin/CheckInPageRouter.tsx` (unauthenticated-with-class-params / `WelcomeScreen` branch), add a centered `next/image` using `src="/logo/logo-white.png"`, roughly `h-10 w-auto`, above the "Welcome!" heading.
  Done when: unauthenticated QR-scan welcome card shows the PLI white logo above "Welcome!" with existing actions unchanged — matches scenario "Unauthenticated visitor scans QR".
- [x] A.4 Manually verify kiosk sign-in and any other phone input (e.g. `app/(auth)/sign-in/page.tsx` if it reuses `formatUSPhoneOnChange`) still formats correctly — global fix, not gated.
  Done when: kiosk on-screen keypad path is unaffected — matches scenario "Kiosk on-screen keypad path unaffected".

## Phase B: StepPayments Mobile-QR Redesign (PR B, base = PR A branch)

*Satisfies: Requirement "English Long Date/Time Format on Mobile Review"; Requirement "Mobile Payment Review Layout Cleanup"; Requirement "Kiosk Terminal Rendering Unchanged" (StepPayments scope).*

- [ ] B.1 Create `components/front/courses/utils/datetime.ts` exporting `formatFriendlyDateTime(date: string, time: string): string`, using `Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })` + existing `to12h`, returning `""` for empty date.
  Done when: `formatFriendlyDateTime("2026-07-24", "20:10")` returns `"Friday, July 24 · 8:10 PM"`.
- [ ] B.2 Write `datetime.test.ts` covering standard date, empty-date guard, and a second weekday/month to catch locale drift.
  Done when: matches scenario "Class date renders in long English format".
- [ ] B.3 In `components/front/courses/enroll/steps/StepPayments.tsx`, add `const mobileQrCheckin = isCheckInFlow && !isKioskTerminalFlow` derived once near the top of the component.
  Done when: predicate is available to gate every new block; existing `isCheckInFlow`/`isKioskTerminalFlow` blocks are untouched.
- [ ] B.4 Behind `mobileQrCheckin`, remove the duplicate course/class name line so it renders exactly once.
  Done when: matches scenario "No duplicate course line".
- [ ] B.5 Behind `mobileQrCheckin`, replace the current date/time render with `formatFriendlyDateTime(...)` and collapse the CLASSES section to one priced line-item per class + coupon line (if any) + single total, removing extra sub-groupings.
  Done when: matches scenario "CLASSES section collapses to priced items, coupon, total".
- [ ] B.6 Behind `mobileQrCheckin`, put Cash and Card options on one row (not stacked) and relabel Card to `Card · Apple Pay · Google Pay` with description "Pay with card or phone wallet."
  Done when: matches scenario "Cash and Card share one row; Card relabeled".
- [ ] B.7 Confirm every block from B.4-B.6 is wrapped by `mobileQrCheckin`, not `isCheckInFlow` alone; existing kiosk-visible blocks (current `isCheckInFlow`/`isKioskTerminalFlow` L98/L118-area logic) are unchanged.
  Done when: rendering `StepPayments` with `isKioskTerminalFlow=true` shows pre-change course line, date format, CLASSES layout, and Cash/Card layout/labels — matches scenario "Kiosk StepPayments and welcome/redirect unaffected" (StepPayments portion).

## Phase C: Stripe Modal Fixes + Success Redirect (PR C, base = PR B branch)

*Satisfies: Requirement "Stripe Payment Modal Fits Viewport and Stays Usable"; Requirement "Always Auto-Redirect After Success"; Requirement "Kiosk Terminal Rendering Unchanged" (Stripe modal portion).*

- [ ] C.1 In `components/front/payments/StripePaymentModal.tsx`, replace the `mt-[11rem]` + `h-[56vh]` layout with a flex column panel: `max-h-[85vh] overflow-hidden flex flex-col`, static header, `flex-1 overflow-y-auto` region wrapping only `PaymentElement`, and a `shrink-0` sticky footer containing Back/Pay.
  Done when: matches scenario "Modal height respects viewport; only PaymentElement scrolls; buttons stay sticky".
- [ ] C.2 In the same file, change backdrop to `bg-black/60 backdrop-blur-md` and translate the Spanish subtitle (L89) to English: "Pay with card or phone wallet."
  Done when: matches scenario "Backdrop dimmed, subtitle English, wallet sheet reachable" (verify Apple/Google Pay sheet still opens over the new layout on a real device).
- [ ] C.3 Verify no kiosk import touches `StripePaymentModal` (re-check `EnrollModal.tsx` sole-importer fact from Phase 0.3); no gate needed per Decision 2.
  Done when: matches scenario "Kiosk Stripe/card payment path unaffected".
- [ ] C.4 In `components/front/checkin/ClientPhoneCheckIn.tsx`, add a single `useEffect` keyed on the resolved success terminal (`already_checked_in`, `checked_in` cash-pending, `checked_in` package, standard Stripe-paid) that starts one 5000ms timer calling `router.push("/client-profile")`, with cleanup on unmount; must NOT fire on `error`/`invalid`/`window_closed`/`rejected`.
  Done when: matches scenario "Each success state redirects after 5s, promo card or not".
- [ ] C.5 Guard the effect so a re-render (e.g. promo data arriving) does not create a second timer or re-trigger the redirect.
  Done when: matches scenario "Timer is single and non-duplicated".

## Phase D: Kiosk-Unchanged Verification (cross-cutting, run after C, before merge of tracker)

*Satisfies: Requirement "Kiosk Terminal Rendering Unchanged" (full coverage).*

- [ ] D.1 Render kiosk payments step with `photoFlowContext="kiosk_terminal"` and diff visually/structurally against a pre-change baseline capture (course line, date format, CLASSES layout, Cash/Card layout/labels).
  Done when: zero visible or structural diff; matches scenario "Kiosk StepPayments and welcome/redirect unaffected".
- [ ] D.2 Confirm kiosk flow never mounts `WelcomeScreen`/logo block and never starts the 5s redirect effect (kiosk uses `CheckInQrClient`, not `ClientPhoneCheckIn`).
  Done when: no logo or redirect reachable from kiosk terminal navigation.
- [ ] D.3 Confirm kiosk card-payment path renders `KioskQrPaymentPanel`, untouched by Phase C.
  Done when: matches scenario "Kiosk Stripe/card payment path unaffected".
