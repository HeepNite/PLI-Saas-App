# Delta for QR Mobile Checkout

## ADDED Requirements

### Requirement: Welcome Screen Branding
The mobile-QR welcome screen (`CheckInPageRouter.tsx`, unauthenticated-with-class-params branch) MUST show the PLI logo above "Welcome!".

#### Scenario: Unauthenticated visitor scans QR
- GIVEN a visitor scans the terminal QR on their own phone, not signed in
- WHEN the welcome card renders
- THEN the PLI logo shows above "Welcome!" and existing actions are unchanged

### Requirement: Always Auto-Redirect After Success
Every mobile-QR check-in success state MUST auto-redirect to `/client-profile` exactly 5 seconds after render, for all 3 states, even with the consecutive-promo card visible.

#### Scenario: Each success state redirects after 5s, promo card or not
- GIVEN a client checks in via mobile QR (cash-pending, package-credit, or standard/Stripe-paid), with or without the consecutive-promo card also visible
- WHEN that success card renders
- THEN the browser navigates to `/client-profile` after 5 seconds with no user action required, and the promo card MUST NOT delay, cancel, or pause the timer

#### Scenario: Timer is single and non-duplicated
- GIVEN a success screen mounts once
- WHEN it re-renders due to unrelated state changes (e.g. promo data arriving)
- THEN only one 5s timer is ever active and the redirect fires at most once

### Requirement: English Long Date/Time Format on Mobile Review
Date/time in the mobile-QR payment review MUST use `Weekday, Month Day · h:mm AM/PM` (e.g. `Friday, July 24 · 8:10 PM`).

#### Scenario: Class date renders in long English format
- GIVEN a client reaches mobile-QR payment review
- WHEN the selected class date/time displays
- THEN it reads `Friday, July 24 · 8:10 PM` — no numeric-only or Spanish-locale format

## MODIFIED Requirements

### Requirement: Phone Input Formatting on Change
`formatUSPhoneOnChange` MUST format US phone input consistently on every keystroke, paste, and deletion, never leaving a state where backspace has no visible effect. Applied GLOBALLY (kiosk keypad does not exercise this path, so kiosk is unaffected).

(Previously: comparing digit counts alone meant backspacing over a format char like `(` removed the character but not a digit, so reformatting reinserted the same char — backspace appeared to do nothing.)

#### Scenario: Backspace over a digit removes the digit
- GIVEN the field shows `+1 (515) 123-4567`
- WHEN the user backspaces once after the last digit
- THEN the field shows `+1 (515) 123-456`

#### Scenario: Backspace over a format character removes a digit, not nothing
- GIVEN the field shows `+1 (515` and the cursor sits right after it
- WHEN the user backspaces such that raw digit count would be unchanged but the string shortened
- THEN the last digit is stripped and the field reformats to `+1 (51`
- AND repeated backspacing keeps removing one digit at a time without looping or freezing

#### Scenario: Paste and mid-string edits stay correct
- GIVEN the field is empty or already partially filled
- WHEN the user pastes a full 10-digit number, or inserts/deletes a digit mid-string (e.g. in the area code)
- THEN the field reformats correctly with no duplicated or dropped digits (e.g. pasting `5151234567` yields `+1 (515) 123-4567`)

#### Scenario: Kiosk on-screen keypad path unaffected
- GIVEN the kiosk terminal enters digits via its own on-screen keypad, not native backspace-over-format-char
- WHEN digits are entered on kiosk
- THEN formatting behaves exactly as before this change

### Requirement: Mobile Payment Review Layout Cleanup
On mobile-QR only, `StepPayments` review MUST drop redundant info and present one collapsed, scannable summary.

#### Scenario: No duplicate course line
- GIVEN a client reaches mobile-QR payment review for one class
- WHEN the review renders
- THEN the course/class name appears exactly once, not duplicated

#### Scenario: CLASSES section collapses to priced items, coupon, total
- GIVEN one or more classes are selected in the mobile-QR flow
- WHEN the review renders
- THEN each class is a single priced line item, an applied coupon (if any) is its own line, and total appears once without extra sub-groupings

#### Scenario: Cash and Card share one row; Card relabeled
- GIVEN a client reaches mobile-QR payment method selection
- WHEN the options render
- THEN "Cash" and "Card" sit on the same row (not stacked full-width)
- AND the Card option label reads `Card · Apple Pay · Google Pay` with description `Pay with card or phone wallet.`

### Requirement: Kiosk Terminal Rendering Unchanged
Kiosk terminal flow (`isKioskTerminalFlow === true`) MUST render pixel-for-pixel identically to pre-change behavior. No mobile-QR-only change (logo, redirect, review layout, payment row/labels, Stripe modal treatment) may be visible or reachable in the kiosk render path. Every shared-component change in this proposal MUST be gated on `isCheckInFlow && !isKioskTerminalFlow` (or the component's equivalent kiosk signal).

#### Scenario: Kiosk StepPayments and welcome/redirect unaffected
- GIVEN a staff member operates the kiosk terminal (via `CheckInQrClient`, not `ClientPhoneCheckIn`/`WelcomeScreen`)
- WHEN kiosk renders the payments review step or any other screen
- THEN course line, date/time format, CLASSES layout, and Cash/Card layout/labels render exactly as before; no mobile welcome logo or 5s `/client-profile` redirect appears

#### Scenario: Kiosk Stripe/card payment path unaffected
- GIVEN kiosk reaches its card-payment step
- WHEN the modal or panel renders
- THEN if kiosk shares `StripePaymentModal`, the modal fixes are safe there too; if kiosk uses a separate panel, that panel is untouched

### Requirement: Stripe Payment Modal Fits Viewport and Stays Usable
`StripePaymentModal` MUST fit the mobile viewport, scroll only its payment-element content, keep primary actions reachable, and use English copy.

#### Scenario: Modal height respects viewport; only PaymentElement scrolls; buttons stay sticky
- GIVEN a client opens the Stripe modal on a mobile phone and content overflows
- WHEN the modal renders and the user scrolls within it
- THEN total height never exceeds `85vh`, only the PaymentElement region scrolls, header/subtitle stay fixed, and Back/Pay remain visible and reachable at all times (sticky)

#### Scenario: Backdrop dimmed, subtitle English, wallet sheet reachable
- GIVEN the Stripe modal is open, including when a client taps Apple Pay / Google Pay
- WHEN it renders and the native wallet sheet opens
- THEN the backdrop uses a stronger dim/blur, the subtitle (previously Spanish) renders in English, and the modal's height/scroll changes do not block or clip the wallet sheet
