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

## Tasks

- **T1** — S1, S3-S4 — Route: existing-customer QR pricing classification and regression tests. Commit: `85b35690` (`fix(qr): classify established scan customers`).
- **T2** — S2-S4 — Route: trusted kiosk QR cash authority continuity and regression tests. Commit: `77a9efd8` (`fix(qr): preserve scan cash authority`).
- **T3** — S1-S4 — Route: production-equivalent verification, differential checks, and hotfix documentation. Commit: this work-unit commit (`test(qr): close booking source hotfix`).
- **T4** — S5 — Route: merge current `main` into the hotfix branch and rerun verification. Commit: `eb108862` (merge `origin/main`) plus verification evidence in the following documentation commit.
- **T5** — S5 — Route: create the approved issue before publishing the `main` pull request. Commit: N/A (GitHub delivery).
- **T6** — S5 — Route: port the reviewed hotfix to `codex/develop`, verify it, and prepare its pull request. Commit: pending.

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
