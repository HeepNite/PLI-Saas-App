# QR booking navigation guards
Production hardening for the scanned kiosk booking path.
Active contract: `docs/specs/qr-booking-navigation-guards/`.

## Specs
1. **S1** — “Evitar las recargas completas: que el paso checkin → clase → sign-in → clase use navegación interna, sin recargar la página, sobre todo el ida y vuelta por sign-in.”
2. **S2** — “Deshabilitar el botón y mostrar 'cargando' mientras se abre Stripe, para que no se toque varias veces.”
3. **S3** — “Revisar los temporizadores del QR de efectivo, que se acumulan.”
4. **S4** — “Corregir producción primero”

## Tasks
- **T1** — S1 — Replace avoidable QR booking document navigations with context-preserving client navigation and tests. Route: worker + parent. Status: done. Commit: `3bc51366`.
- **T2** — S2 — Make checkout submission synchronously single-flight and test disabled/loading behavior through redirect or failure. Route: worker. Status: done. Commit: `8ddf6b20`.
- **T3** — S3 — Make refresh/expiry timer replacement and cleanup explicit and deterministic, with lifecycle tests. Route: worker. Status: done. Commit: `66b018f9`.
- **T4** — S1-S4 — Run focused and repository verification, record risk, and close production work. Route: parent + independent verifier for high-risk shared auth/checkout behavior. Status: done. Evidence commits: `3bc51366`, `8ddf6b20`, `66b018f9`, `9ef20519`.

Delivery strategy: stacked PRs to `main`, selected by the user. PR1 branch `fix/qr-booking-navigation-guards` contains `3bc51366` (308 changed lines). PR2 branch `fix/qr-booking-interaction-guards` targets PR1 and contains `8ddf6b20`, `66b018f9`, and closure/spec commit `9ef20519` (incremental slice below 400 lines).

## Verification

- Focused public/component suite: 112/112 passed.
- Repository unit suite: 3830 passed, 5 skipped; `tests/integration/prisma-security.test.ts` was unavailable because `DATABASE_URL` is missing.
- TypeScript typecheck: passed.
- Scoped ESLint: passed.
- Production `npm run build`: passed.
- `npm run build:turbo`: unavailable in the isolated worktree because Turbopack rejects the external `node_modules` symlink; the standard production build passed.
- Independent verifier: initial S1 failure reproduced redirect-context loss; correction reverified S1-S3 PASS with no remaining blocker.
- Chain budget: PR1 308 changed lines; PR2 projected 241 changed lines.
- Risk: item 3 — shared authentication navigation and checkout action code are used by existing behavior; focused regressions and the independent verifier cover the touched contracts.

## Log
- **L1** — “Evitar las recargas completas: que el paso checkin → clase → sign-in → clase use navegación interna, sin recargar la página, sobre todo el ida y vuelta por sign-in. - Deshabilitar el botón y mostrar 'cargando' mientras se abre Stripe, para que no se toque varias veces. - Revisar los temporizadores del QR de efectivo, que se acumulan. revisalo igual por que acabo de trabajarlo con otro agente”
- **L2** — “Corregir producción primero”
- **L3** — “Phone/SMS embebido (recomendado)”
- **L4** — Independent verification found that `resolveSafeQrRedirect` stripped `kioskQrCashGrant`, `enroll`, `qrBooking`, and `step`; the navigation task was reopened, reproduced RED, corrected, and reverified PASS for S1-S3.
- **L5** — “PRs encadenados (recomendado)”
