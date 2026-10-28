# Production QR Booking Source Hotfix

Hotfix the production QR-phone booking flow so returning customers keep regular pricing and trusted in-studio scans retain their cash-payment authority through checkout.
Target: production behavior on `pli-saas-app.vercel.app`, implemented without deployment.

## Specs

1. **S1** — “deberia mostrarme la clase a 20 dolares pero no, me esta mostrando a 15 dolares”
2. **S2** — “aparece como que no esta reconociendo el flujo de donde viene, como si fuera que lo tomo del link de booking o /friday y no del escaneo cuando lo que yo hice fue escanear.”
3. **S3** — “(esto en produccion no en dev) verificalo por que esto me va a hacer perder plata si no”
4. **S4** — “Sí, implementar hotfix”
5. **S5** — “la revisión del hotfix. Está aprobado, con tres pedidos:
- traer main antes del PR y volver a correr los tests,
- crear el issue antes del PR,
- llevarlo también a codex/develop.”
6. **S6** — “y de ahi pasarlo a develop asi lo probamos por alla no metamos nada a prod ahora”

## Tasks

- **T1** — S1, S3-S4 — Route: existing-customer QR pricing classification and regression tests. Commit: `85b35690` (`fix(qr): classify established scan customers`).
- **T2** — S2-S4 — Route: trusted kiosk QR cash authority continuity and regression tests. Commit: `77a9efd8` (`fix(qr): preserve scan cash authority`).
- **T3** — S1-S4 — Route: production-equivalent verification, differential checks, and hotfix documentation. Commit: this work-unit commit (`test(qr): close booking source hotfix`).
- **T4** — S5 — Route: merge current `main` into the hotfix branch and rerun verification. Commit: `eb108862` (merge `origin/main`) plus verification evidence in the following documentation commit.
- **T5** — S5 — Route: create the approved issue before publishing the `main` pull request. Commit: N/A; issue `#733`, PR `#737`.
- **T6** — S5-S6 — Route: port signed kiosk QR grant minting and verification to current `codex/develop`. Status: done. Commit: `588f7328`.
- **T7** — S5-S6 — Route: port signed grant QR rendering and timer ownership. Status: done. Commit: `79a24007`.
- **T8** — S1-S6 — Route: port cash authorization continuity and authoritative established-customer pricing. Status: done. Commit: this work-unit commit.
- **T9** — S6 — Route: port client-side QR navigation and phone/SMS auth resume from PR #754 without native M2 bridge changes. Status: pending. Commit: pending.
- **T10** — S6 — Route: port Stripe bfcache single-flight recovery and bounded cash-grant retry from PR #755. Status: pending. Commit: pending.
- **T11** — S5-S6 — Route: verify and publish a stacked PR chain targeting `codex/develop`; do not merge or promote to `main`. Status: pending. Commit: pending.

## Log

- **L1** — “papi necesito que revisemos el booking, especificamente el que esta por scand qr code en el kiosk por que acabo de entrar con un usuario que tiene una compra realizada (el usuario es 5512603078) deberia mostrarme la clase a 20 dolares pero no, me esta mostrando a 15 dolares  y tambien verifica por que me sale el mensaje que dice cash only from studio terminal si acabo de escanear el codigo”
- **L2** — “no aparece cash only solo... aparece como que no esta reconociendo el flujo de donde viene, como si fuera que lo tomo del link de booking o /friday y no del escaneo cuando lo que yo hice fue escanear. (esto en produccion no en dev) verificalo por que esto me va a hacer perder plata si no”
- **L3** — “Sí, implementar hotfix”
- **L4** — “pero antes de nada no mereeges nada sol mantenlo”
- **L5** — Evidence: focused QR/cash suite 51/51; repository suite 3662 passed with only the credential-gated integration suite unavailable; typecheck and touched-file lint passed; independent verifier approved S1-S4 and matched shared-path results against `cfe0b91f`.
- **L6** — “la revisión del hotfix. Está aprobado, con tres pedidos:
- traer main antes del PR y volver a correr los tests,
- crear el issue antes del PR,
- llevarlo también a codex/develop.”
- **L7** — Evidence after merging `origin/main`: focused QR/cash suite 51/51; typecheck and touched-file lint passed; repository suite passed 3667 tests with only the credential-gated `prisma-security` integration suite unavailable because `DATABASE_URL` is not present.
- **L8** — Delivery: issue `#733` was created with the official bug form and labeled `status:approved`; PR `#737` targets `main` with exactly `type:bug`.
- **L9** — T6 port evidence: restored the terminal-minted, signed class-bound QR cash grant and its `/checkin` → booking → cash propagation on `codex/develop`; preserved native M2/card, profile quote, and terminal special-class cash behavior. Added QR grant, boundary, propagation, and established-customer regression coverage.
- **L10** — T6 verification: focused suite 173/173; repository suite 4291 passed with only credential-gated integration suites unavailable; production build, isolated typecheck, lint, and independent verification passed. Two verifier-found special-class QR boundaries were corrected with RED→GREEN regressions. The first cohesive security work unit is commit `4d45396c` at 438 changed lines; review slicing must be selected before the next commit.
- **L11** — “y de ahi pasarlo a develop asi lo probamos por alla no metamos nada a prod ahora”
- **L12** — Delivery decision: keep PRs #754-#755 open toward `main` without merging, and create a separate review chain based on current `origin/codex/develop` for testing. The old 438-line local port commit is being reconstructed into smaller review slices without rewriting or deleting the preserved worktree.
