# Native M2 LIVE reader provisioning

## Objective

Provision physical Stripe Reader M2 `STRM2D533025669` into the approved LIVE location and capture its LIVE `tmr_*` identity without creating a PaymentIntent or exposing any payment action. This is a bounded bootstrap step for issue #427 before the separately authorized USD 1 physical charge.

## Authority and boundaries

- User authorized LIVE deployment preparation, Android installation, reader provisioning, and one later USD 1 charge.
- Provisioning must remain fail-closed and separate from payment collection.
- `INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED` remains false throughout provisioning.
- No attempt ticket, Purchase, PaymentIntent, collect, confirm, refund, or credit mutation is allowed in provisioning mode.
- The build accepts only the approved HTTPS origin, LIVE location `tml_GqQ6wPY5rSAhAt`, and serial `STRM2D533025669`.
- The resulting `tmr_*` identity is configuration evidence, not payment authority.
- Tracker #497 remains draft/no-merge; `main` is untouched.

## Tasks

- [x] P1 — Record the one-time provisioning contract in the active requirements and resolution artifacts. Evidence: `a2f9e985 docs(native-kiosk): define LIVE reader provisioning`.
- [x] P2 — Implement a build-gated Android provisioning path that authenticates the existing staff terminal, fetches only a LIVE connection token, discovers the exact M2 serial, connects it to the approved location, and displays the resulting `tmr_*` ID. Evidence: `feat(native-kiosk): add LIVE reader provisioning` (commit recorded after creation).
- [ ] P3 — Add focused fail-closed tests and verify the bounded slice, Android unit tests, debug APK assembly, and diff budget. Evidence: commit pending.
- [ ] P4 — Configure a provisioning-only deployment with payment creation OFF, install the provisioning APK, connect the physical M2, record the LIVE `tmr_*` ID, then disable provisioning before enabling the separately gated USD 1 flow. Evidence: pending.

## Rollback

Disable or omit the provisioning build flag and remove the provisioning-only deployment. Retain the observed LIVE reader identity as configuration evidence. Never remove payment history or durable attempts; provisioning itself must create neither.
