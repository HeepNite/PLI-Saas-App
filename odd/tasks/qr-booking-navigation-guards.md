# QR booking navigation guards
Production hardening for the scanned kiosk booking path.
Active contract: `docs/specs/qr-booking-navigation-guards/`.

## Specs
1. **S1** — “Evitar las recargas completas: que el paso checkin → clase → sign-in → clase use navegación interna, sin recargar la página, sobre todo el ida y vuelta por sign-in.”
2. **S2** — “1. Back-from-Stripe (bfcache): on the hosted redirects (useEnrollPaymentActions.ts ~:612, ~:689) checkoutAttemptRef stays true. If the page is restored with Back, resetForm frees the UI but Pay silently does nothing. Release the ref whenever processing becomes false (or on pageshow with persisted), and add a test.”
3. **S3** — “2. KioskClassQrCode: a failed cash-grant refresh blanks the grant and schedules no retry (~:58, ~:67-68), so in-studio QR cash stays unavailable. Add a bounded retry, with a test.”
4. **S4** — “Corregir producción primero”
5. **S5** — “3. Move the docs/specs/qr-booking-navigation-guards spec into PR1, so the spec lands with the code that implements it.”
6. **S6** — “Keep both PRs under 400 lines. Do not touch the native M2 bridge files”

## Tasks
- **T1** — S1 — Replace avoidable QR booking document navigations with context-preserving client navigation and tests. Route: worker + parent. Status: done. Commit: `3bc51366`.
- **T2** — S2 — Release the checkout single-flight lock when rendered processing becomes false after bfcache restoration, with regression coverage. Route: parent inline. Status: reopened. Commit: pending.
- **T3** — S3 — Add bounded cash-grant refresh retries without timer accumulation, with regression coverage. Route: parent inline. Status: reopened. Commit: pending.
- **T4** — S1-S4 — Run focused and repository verification, record risk, and close production work. Route: parent + independent verifier for high-risk shared auth/checkout behavior. Status: reopened. Evidence commits: `3bc51366`, `8ddf6b20`, `66b018f9`, `9ef20519`.
- **T5** — S5-S6 — Move `docs/specs/qr-booking-navigation-guards/` into PR1 and preserve clean sub-400 stacked diffs. Route: parent inline. Status: pending. Commit: pending.
- **T6** — S2-S6 — Re-run focused and repository verification without touching native M2 bridge files. Route: parent + independent verifier. Status: pending. Commit: pending.

Delivery strategy: stacked PRs to `main`, selected by the user. PR1 branch `fix/qr-booking-navigation-guards` contains `3bc51366` (308 changed lines). PR2 branch `fix/qr-booking-interaction-guards` targets PR1 and contains `8ddf6b20`, `66b018f9`, and closure/spec commit `9ef20519` (incremental slice below 400 lines).

## Verification

- Focused public/component suite: 112/112 passed.
- Repository unit suite: 3830 passed, 5 skipped; `tests/integration/prisma-security.test.ts` was unavailable because `DATABASE_URL` is missing.
- TypeScript typecheck: passed.
- Scoped ESLint: passed.
- Production `npm run build`: passed.
- `npm run build:turbo`: unavailable in the isolated worktree because Turbopack rejects the external `node_modules` symlink; the standard production build passed.
- Independent verifier: initial S1 failure reproduced redirect-context loss; correction reverified S1-S3 PASS with no remaining blocker.
- Native review PR1: approved and acknowledged (`review-62260472c36c8d94`); two informational warnings, no correction required.
- Native assessment PR2: medium/under-budget, review not due; independent high-risk verification already passed S2-S3.
- Chain budget: PR1 308 changed lines; PR2 253 changed lines.
- Risk: item 3 — shared authentication navigation and checkout action code are used by existing behavior; focused regressions and the independent verifier cover the touched contracts.

## Log
- **L1** — “Evitar las recargas completas: que el paso checkin → clase → sign-in → clase use navegación interna, sin recargar la página, sobre todo el ida y vuelta por sign-in. - Deshabilitar el botón y mostrar 'cargando' mientras se abre Stripe, para que no se toque varias veces. - Revisar los temporizadores del QR de efectivo, que se acumulan. revisalo igual por que acabo de trabajarlo con otro agente”
- **L2** — “Corregir producción primero”
- **L3** — “Phone/SMS embebido (recomendado)”
- **L4** — Independent verification found that `resolveSafeQrRedirect` stripped `kioskQrCashGrant`, `enroll`, `qrBooking`, and `step`; the navigation task was reopened, reproduced RED, corrected, and reverified PASS for S1-S3.
- **L5** — “PRs encadenados (recomendado)”
- **L6** — “Review of fix/qr-booking-navigation-guards and fix/qr-booking-interaction-guards: approved with nits. The owner accepts phone+SMS-only sign-in for the QR \"I have an account\" path. Before opening PRs, please fix:
▎ 1. Back-from-Stripe (bfcache): on the hosted redirects (useEnrollPaymentActions.ts ~:612, ~:689) checkoutAttemptRef stays true. If the page is restored with Back, resetForm frees the UI but Pay silently does nothing. Release the ref whenever processing becomes false (or on pageshow with persisted), and add a test.
▎ 2. KioskClassQrCode: a failed cash-grant refresh blanks the grant and schedules no retry (~:58, ~:67-68), so in-studio QR cash stays unavailable. Add a bounded retry, with a test.
▎ 3. Move the docs/specs/qr-booking-navigation-guards spec into PR1, so the spec lands with the code that implements it.
▎    Keep both PRs under 400 lines. Do not touch the native M2 bridge files”
