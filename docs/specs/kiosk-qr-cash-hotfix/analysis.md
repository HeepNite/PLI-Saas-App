# Kiosk QR Cash Hotfix — Analysis

## Observed regression

`StepPayments` classifies every mobile QR check-in as remote and forces Stripe. The earlier unmerged fix restored cash by trusting `photoContext=qr_phone` when `bookingSource=public_booking` was absent.

## Conflict

Both values are caller-controlled. Removing a public marker or posting `photoContext=qr_phone` directly can create a kiosk-attributed pending purchase. Special-class payloads can also reach immediate cash walk-in admission.

## Existing contracts to reuse

- `authorizeStaffTerminalSession()` verifies the tablet's HttpOnly terminal session.
- The tablet already generates class-bound QR URLs.
- Enrollment checkout payloads already carry check-in context.
- Cash purchases already support pending settlement and kiosk attribution.

## Required boundary

The authenticated tablet must obtain the grant from the server. The customer phone may carry that bearer grant, but only server verification of its signature, expiry, purpose, and class context authorizes QR-phone cash.
