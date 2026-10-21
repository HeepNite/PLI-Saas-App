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
- [x] T2a — Implement the short-lived server-verifiable kiosk QR grant primitive and mint route.
  - Status: done.
  - Verification: RED/GREEN grant creation, exact-expiry and tamper rejection, semantic class-context validation, authorized terminal minting, rate limits, TypeScript, ESLint, diff check, and independent approval.
  - Evidence: `d6a883d1328c30745e1381a87c453641a64cea37` (`feat(checkout): issue trusted kiosk QR cash grants`).
- [x] T2b — Render tablet QRs locally and propagate grants without third-party disclosure.
  - Status: done.
  - Verification: current, late-payment, and past-class tablet QRs use local rendering, wait for exact-context grants, refresh before expiry, hide on stalled expiry, and preserve grants through navigation and checkout payloads. Focused tests, TypeScript, diff check, full suite, and independent verification approved; one unrelated integration suite remains unavailable without `DATABASE_URL`.
  - Evidence: `f7e1d17c77ee1efff87e41f860312cf14ad7fabc` (`feat(checkout): secure kiosk class QR grants`).
- [x] T3 — Restore QR-phone cash as pending settlement while preserving public and special-class boundaries.
  - Status: done.
  - Verification: 97 focused checks, TypeScript, ESLint, diff check, and independent adversarial verification approved. Valid grants enable cash plus Stripe; forged public/QR markers, missing/expired/tampered grants, mismatched context, null bodies, and special-class fields fail closed before side effects; terminal cash remains unchanged; QR-phone cash creates a pending kiosk-attributed purchase without attendance.
  - Evidence: pending commit identity.
- [ ] T4 — Deliver and verify the production hotfix.
  - Status: in progress.
  - Verification: approved issue, sub-400-line PR, required checks, exact production SHA/deployment, and kiosk QR smoke without production test purchase side effects.
  - Evidence: pending.

## Risks

- Item 2: kiosk-origin authorization and bearer-token validation.
- Item 3: checkout payload and cash API contract.
- Item 5: production hotfix delivery.
