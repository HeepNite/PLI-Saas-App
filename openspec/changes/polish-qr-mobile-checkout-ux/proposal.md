# Proposal: Polish QR Mobile Checkout UX

## Intent

A live walkthrough of the QR mobile self-check-in flow (customer scans the terminal QR, it opens on THEIR phone, they check in / pay on their own device) surfaced friction that makes the flow feel unbranded and hard to use on a small screen: no logo on the welcome screen, success screens that strand the user, a phone-input backspace loop, a cluttered payment review that forces scrolling, and a broken Stripe modal with a Spanish string and unreachable Pay button. None are new-feature work — they are UX polish and small bug fixes that make the phone checkout trustworthy and fast. This is DISTINCT from the kiosk terminal (tablet) flow and from the already-fixed `fix-qr-mobile-package-flow` package/promo bugs.

## Scope

### In Scope
- Welcome card: add PLI logo above "Welcome!" (`CheckInPageRouter.tsx`)
- Success screens: single 5s auto-redirect to `/client-profile`, ALWAYS (even when the consecutive-promo card is showing)
- Phone input: fix `formatUSPhoneOnChange` backspace loop on trailing format chars
- `StepPayments` (MOBILE-QR ONLY, gated): drop duplicate Course line, English long date/time, collapse CLASSES to priced line items + coupon + total, Cash/Card same row on mobile, relabel Card option
- `StripePaymentModal`: sane max height with only the PaymentElement scrolling, sticky Back/Pay buttons, stronger backdrop, English subtitle

### Out of Scope
- Kiosk terminal (tablet) UI — must stay visually unchanged
- Package/promo logic (owned by `fix-qr-mobile-package-flow`)
- SMS verification flow (must NOT be weakened)
- Payment processing / Stripe intent logic
- Prod port (`main`) — ships after dev validation

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None (pure UX/presentation + one util bug fix; no spec-level behavior contract changes). `sdd-design` owns component decisions.

## Approach

Gate every shared component change on the mobile-QR signal so kiosk renders unchanged. StepPayments already exposes `isCheckInFlow` / `isKioskTerminalFlow` (verified L12-13, L45-46); mobile-QR = `isCheckInFlow && !isKioskTerminalFlow` — confirm at design. Welcome (`CheckInPageRouter`) and success (`ClientPhoneCheckIn`) are mobile-QR-only by nature. The phone-input fix is a pure util bug (`formatUSPhone.ts`): add the missing branch — when digit count is unchanged BUT the string got shorter (a format char was deleted), strip the last digit and reformat. Recommend applying this fix GLOBALLY (strictly better; the kiosk on-screen keypad does not hit this path) — design flags the final gating decision. Stripe modal: replace the `mt-[11rem]` + fixed `h-[56vh]` hack with `max-h-[85vh]`, scroll only the PaymentElement, pin buttons sticky, dim/blur harder.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/checkin/CheckInPageRouter.tsx` | Modified | PLI logo above "Welcome!" (~L89-95) |
| `components/front/checkin/ClientPhoneCheckIn.tsx` | Modified | Single 5s redirect to `/client-profile` across 3 success states |
| `components/front/courses/utils/phone.ts` | Modified | `formatUSPhoneOnChange` backspace-on-format-char fix |
| `components/front/courses/enroll/steps/StepPayments.tsx` | Modified | Mobile-QR-gated review/date/layout/label redesign |
| `components/front/payments/StripePaymentModal.tsx` | Modified | Scroll/sticky/backdrop fix + English subtitle (L89) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Shared component change leaks into kiosk | Med | Gate on `isCheckInFlow && !isKioskTerminalFlow`; verify kiosk render at design/verify |
| Phone fix regresses paste/mid-string edits | Low | Cover backspace, paste, and cursor-mid-string in design cases |
| Stripe modal height breaks Apple/Google Pay sheet | Low | Test wallet sheet over modal on real mobile |
| Logo asset source ambiguity | Low | `public/logo/logo-*.png` exist; reuse `BrandedSuccessHeader` src if landed by sibling change, else logo asset |

## Rollback Plan

Revert the change branch. All edits are presentation-layer across 5 files plus one util; no schema, migration, API, or payment-logic changes. Reverting restores prior UI verbatim.

## Dependencies

- `/client-profile` route (`app/client-profile/page.tsx` — exists)
- Mobile-QR gating signals in enroll flow (`isCheckInFlow`, `isKioskTerminalFlow` — verified present)
- PLI logo asset (`public/logo/logo-black.png` / `logo-white.png` — exist)
- Sibling change `fix-qr-mobile-package-flow` (independent; no overlap in these files' targeted areas)

## Success Criteria

- [ ] Welcome screen shows the PLI logo above "Welcome!" on mobile QR
- [ ] Any success state auto-redirects to `/client-profile` after 5s, including with the promo card visible
- [ ] Backspacing over a format char (e.g. `+1 (515)`) no longer loops
- [ ] Mobile StepPayments: no duplicate Course line, English long date, collapsed priced list, Cash/Card same row, relabeled Card option
- [ ] Kiosk terminal StepPayments renders unchanged
- [ ] Stripe modal fits screen, only PaymentElement scrolls, Pay/Back always visible, backdrop dimmed, English subtitle

## Proposal question round

Business context is well-locked (date format, always-5s redirect, card label, mobile-only scope all decided). Two product/scope decisions remain for design confirmation:

1. **Phone fix scope**: apply the `formatUSPhoneOnChange` fix GLOBALLY (recommended — strictly better; kiosk keypad does not hit this path) or gate it to mobile-QR only?
2. **Stripe modal reuse**: does the kiosk use this same `StripePaymentModal` or a separate card path (`KioskQrPaymentPanel`)? If shared, confirm the modal changes are acceptable on kiosk too, or gate them.

**Assumptions (proceed unless corrected)**:
- Phone fix applied globally.
- Stripe modal changes are safe globally (improve any surface); if kiosk uses a different panel, this is moot. Design verifies the card path.
