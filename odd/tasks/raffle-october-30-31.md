# October 30–31 Raffle Reconciliation

Reconcile the existing raffle implementation and prepare two independent October 2026 raffle events in DEV.
This document is the execution source of truth; repository specs hold the detailed product contract.

## Specs

1. **S1 — Reconciliation.** “papi necesito que reeconsiliemos lo del sorteo que esta en dev, contame como esta eso” and “si dale vamos por ahi por que lo vamos a necesitar para el 30 y 31”.
2. **S2 — Dates and isolation.** “Sí, octubre de 2026” and “Un sorteo separado por día”.
3. **S3 — Delivery target.** “DEV completo y listo para probar”.
4. **S4 — Names and temporary prizes.** “October 30 / October 31 Raffle” and “Todavía no”.
5. **S5 — Schedule.** “el horario lo vamos a habilitar esos dias con el contador desde las 11:00pm y el sorteo lo hacemos a las 12:00”.
6. **S6 — Tablet access.** “Nueva llave por cada día” and “/rifa/30 y /rifa/31”.

## Tasks

- [ ] **T1 — S1:** Reconcile the current raffle contract and migration evidence against `origin/codex/develop`; retire stale repair assumptions without mutating a remote database. Route: parent inline. Commit: pending.
- [ ] **T2 — S2–S6:** Specify and implement permanent `/rifa/30` and `/rifa/31` tablet entrances plus deterministic event configuration for two independent DEV raffles, with behavior-first regression tests and placeholder prizes clearly marked as temporary. Route: parent inline. Commit: pending.
- [ ] **T3 — S2–S6:** Verify the code candidate, commit the work unit, and record focused/suite evidence. Route: parent inline; independent verification required for Risk items 1 and 3. Commit: pending.
- [ ] **T4 — S3–S6:** Prepare and execute the bounded DEV event setup only after exact environment and migration preflight; generate a distinct private key for each day, then verify both public and tablet flows without exposing keys. Route: parent inline. Commit: operational evidence pending.

## Log

- **L1:** “papi necesito que reeconsiliemos lo del sorteo que esta en dev, contame como esta eso”
- **L2:** “si dale vamos por ahi por que lo vamos a necesitar para el 30 y 31”
- **L3:** Decisions: “Sí, octubre de 2026”; “Un sorteo separado por día”; “DEV completo y listo para probar”.
- **L4:** Decisions: “October 30 / October 31 Raffle”; “Todavía no”; “el horario lo vamos a habilitar esos dias con el contador desde las 11:00pm y el sorteo lo hacemos a las 12:00”; “Nueva llave por cada día”.
- **L5:** Decision: “/rifa/30 y /rifa/31”.
