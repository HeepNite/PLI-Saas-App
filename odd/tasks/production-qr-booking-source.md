# Production QR Booking Source Hotfix

Hotfix the production QR-phone booking flow so returning customers keep regular pricing and trusted in-studio scans retain their cash-payment authority through checkout.
Target: production behavior on `pli-saas-app.vercel.app`, implemented without deployment.

## Specs

1. **S1** — “deberia mostrarme la clase a 20 dolares pero no, me esta mostrando a 15 dolares”
2. **S2** — “aparece como que no esta reconociendo el flujo de donde viene, como si fuera que lo tomo del link de booking o /friday y no del escaneo cuando lo que yo hice fue escanear.”
3. **S3** — “(esto en produccion no en dev) verificalo por que esto me va a hacer perder plata si no”
4. **S4** — “Sí, implementar hotfix”

## Tasks

- **T1** — S1, S3-S4 — Route: existing-customer QR pricing classification and regression tests. Commit: this work-unit commit (`fix(qr): classify established scan customers`).
- **T2** — S2-S4 — Route: trusted kiosk QR cash authority continuity and regression tests. Commit: pending.
- **T3** — S1-S4 — Route: production-equivalent verification, differential checks, and hotfix documentation. Commit: pending.

## Log

- **L1** — “papi necesito que revisemos el booking, especificamente el que esta por scand qr code en el kiosk por que acabo de entrar con un usuario que tiene una compra realizada (el usuario es 5512603078) deberia mostrarme la clase a 20 dolares pero no, me esta mostrando a 15 dolares  y tambien verifica por que me sale el mensaje que dice cash only from studio terminal si acabo de escanear el codigo”
- **L2** — “no aparece cash only solo... aparece como que no esta reconociendo el flujo de donde viene, como si fuera que lo tomo del link de booking o /friday y no del escaneo cuando lo que yo hice fue escanear. (esto en produccion no en dev) verificalo por que esto me va a hacer perder plata si no”
- **L3** — “Sí, implementar hotfix”
- **L4** — “pero antes de nada no mereeges nada sol mantenlo”
