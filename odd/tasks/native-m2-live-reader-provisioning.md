# Native M2 LIVE reader provisioning

## Objective

Provision physical Stripe Reader M2 `STRM2D533025669` into the approved LIVE location and capture its LIVE `tmr_*` identity without creating a PaymentIntent or exposing any payment action. This is a bounded bootstrap step for issue #427 before the separately authorized USD 1 physical charge.

## Authority and boundaries

- User authorized LIVE deployment preparation, Android installation, reader provisioning, and one later USD 1 charge.
- Provisioning must remain fail-closed and separate from payment collection.
- `INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED` remains false throughout provisioning.
- No attempt ticket, Purchase, PaymentIntent, collect, confirm, refund, or credit mutation is allowed in provisioning mode.
- The build accepts only the approved HTTPS origin, one ephemeral connection-token file outside the repository, LIVE location `tml_GqQ6wPY5rSAhAt`, and serial `STRM2D533025669`; it never uses the unrelated web terminal PIN/session.
- The resulting `tmr_*` identity is configuration evidence, not payment authority.
- Tracker #497 remains draft/no-merge; `main` is untouched.

## Tasks

- [x] P1 — Record the one-time provisioning contract in the active requirements and resolution artifacts. Evidence: `a2f9e985 docs(native-kiosk): define LIVE reader provisioning`.
- [x] P2 — Implement the initial build-gated Android provisioning path. Evidence: `e7a8f8a3 feat(native-kiosk): add LIVE reader provisioning`; its web-terminal authentication assumption was rejected during physical use and is superseded by P3a.
- [x] P3 — Add focused fail-closed tests and verify the bounded slice, Android unit tests, debug APK assembly, and diff budget. Evidence: 85/85 unit tests, ordinary debug and androidTest APK assemblies, provisioning-mode debug APK assembly, merged-manifest launcher readback, `git diff --check`, and 254 changed lines; ledger commit `c3b846b1`.
- [x] P3a — Remove the unrelated web terminal slug/PIN/session dependency and consume one operator-machine-generated Stripe connection token exactly once from an owner-private build input. Evidence: 86/86 unit tests, androidTest APK assembly, disposable provisioning APK assembly with a private fixture file, `git diff --check`, and 102 changed lines; commit recorded after creation.
- [x] P3c — Support Stripe's repeated connection-token fetches from a bounded private token bundle and allow the exact unregistered M2 to have no `tmr_*` until successful connection assigns it. Evidence: physical RED from SDK logs; 87/87 unit tests; androidTest/provisioning APK assemblies; `git diff --check`; 124 changed lines; commit `a0feb9c3`; approved review `review-34b7adfcd1f451ce`; PR #585.
- [ ] P4 — Generate the ephemeral token bundle without exposing the API key, build/install the disposable APK, connect the physical M2, record the LIVE `tmr_*` ID, then uninstall provisioning before enabling the separately gated USD 1 flow. Evidence: pending.

## Rollback

Disable or omit the provisioning build flag, uninstall the disposable APK, and remove the private consumed-token file. Retain the observed LIVE reader identity as configuration evidence. Never remove payment history or durable attempts; provisioning itself must create neither.
