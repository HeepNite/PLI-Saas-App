# Kiosk QR Cash Hotfix

## Goal

Restore cash alongside card/wallet when a customer scans a QR issued by an authorized in-studio kiosk tablet, without allowing ordinary public links or caller-controlled markers to authorize kiosk cash.

## Target

- Base: `origin/main` at `daab800da125b11e64a941bd0f373eabbefedba2`
- Branch: `hotfix/kiosk-qr-cash-authority`
- Issue: #702
- Environment: production after required checks and merge

## Tasks

- [x] T1 — Define the trusted kiosk-origin grant and fail-closed payment contract.
  - Status: done.
  - Verification: reconciled against current QR generation, enrollment payload, terminal authorization, pending cash settlement, and special-class admission boundaries.
  - Evidence: `docs/specs/kiosk-qr-cash-hotfix/{requirements,analysis,resolve,design,tasks}.md`.
- [ ] T2 — Implement and propagate the short-lived server-verifiable kiosk QR grant.
  - Status: in progress.
  - Verification: RED/GREEN grant creation, context binding, expiry, tamper rejection, and payload propagation tests.
  - Evidence: pending.
- [ ] T3 — Restore QR-phone cash as pending settlement while preserving public and special-class boundaries.
  - Status: pending.
  - Verification: RED/GREEN UI and cash API tests, focused regression suite, TypeScript, ESLint, diff check, and independent verification.
  - Evidence: pending.
- [ ] T4 — Deliver and verify the production hotfix.
  - Status: pending.
  - Verification: approved issue, sub-400-line PR, required checks, exact production SHA/deployment, and kiosk QR smoke without production test purchase side effects.
  - Evidence: pending.

## Risks

- Item 2: kiosk-origin authorization and bearer-token validation.
- Item 3: checkout payload and cash API contract.
- Item 5: production hotfix delivery.
