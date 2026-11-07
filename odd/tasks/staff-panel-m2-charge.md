# Staff panel M2 charge — phase 1

Branch `feat/staff-panel-m2-charge-v2` (base `origin/main`); full version kept on `feat/staff-panel-m2-charge-full`. Runner: `npx vitest run`.
Status: `PHASE 1 IMPLEMENTED — PENDING DELIVERY`.

## Specs

`docs/specs/staff-panel-m2-charge/requirements.md` (D1–D7). Phase 1 = `package` + `guest_class` + `outstanding` + `free_amount` (see `tasks.md`).

## Tasks

| ID | Scope | Status |
|----|-------|--------|
| T1 | Phase 1a lean rewrite (reuse helpers, one test per rule) | done |
| T2 | Restore `package` + `guest_class` lean on the refactored code (L3), inline | done |
| T3 | Review fixes M1–M4, T1–T4, P1–P2, D1 (one test each), delegated writer | done (uncommitted) |

## Log

- L1 (2026-11-03, owner, verbatim): "Bien ahora necesito que retomemos el pago desde el panel. Necesito que veamos eso, que veamos cómo hacerlo: poder mandarlo a través de la app que tenemos, ya sea de Android o de iOS, o cómo lo vamos a hacer para poder hacer el pago con el tap to pay que tenemos con los M2."
- L2 (2026-11-05, owner, verbatim): "Resolverlo: no podemos tener 6000 líneas de código metiéndose de nuevo." / "Hay que refactorizar, no puede ser eso."
- L3 (2026-11-05, owner, verbatim): "Esperame porque necesito saber por qué estás dejando fuera lo de los paquetes, los amigos y eso. Eso es algo que yo te pedí. No, no te pedí que lo dejes por fuera para bajar el código. ... Acá hay que optimizar el código, no que bajes la cantidad de cosas que estás haciendo solamente para bajar la cantidad de código." → `package` + `guest_class` restored lean on the refactored code (phase 1 = all four kinds; D1 drop-in credits = phase 2).
- L4 (2026-11-06, owner, verbatim): "se me hace que vamos por la A, simpre que no toques los kioskos y su flujo" → rollout gate: `canCreateTerminalCharge` owner-only (admin, staff/front_desk re-enabled after the live $1 test per tablet) + `TERMINAL_CHARGE_TERMINALS` slug allowlist (unset = no tablet; a non-listed kiosk renders exactly as origin/main, no polling; create/prepare/result 409 "Charging is not enabled on this tablet", pending `{ charge: null }`).
