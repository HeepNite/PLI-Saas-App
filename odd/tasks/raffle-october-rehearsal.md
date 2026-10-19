# October Raffle DEV Rehearsal

Run a reversible end-to-end rehearsal of both delivered October raffle events in DEV and implement the accepted audited winner-attendance workflow.
Rehearsal data mutations must remain reversible; the final observable event, draw, and entry state must match the preflight state.

## Specs

1. **S1 — Rehearsal outcome.** “quieor hacr un simulacro y verificar que todo va bien. que sale bien y que funciona bien”.
2. **S2 — Event scope.** “Los dos días”.
3. **S3 — Authorized mutation.** “Sí, autorizo simulacro y limpieza”.
4. **S4 — Mutation boundary.** Insert two staged synthetic participants per event, permit additional QR registrations only with the reserved rehearsal phone numbers supplied during the test, execute the one configured draw, verify replay idempotence and cross-event isolation, then delete only those rehearsal participants and restore each draw to `open` with its original schedule and no winner.
5. **S5 — Visible tablet rehearsal.** “pero quiero ver como queda quiero ver como funciona en la tablet, ademas quiero ver el el contador tambien”.
6. **S6 — Accelerated clock.** “Sí, cuenta regresiva de 10 minutos”.
7. **S7 — Duplicate-entry policy.** “naa dejemos ahi al final alguien se va a llevar el premio lo vamos a controlar mas de manera fisica tampoco quiero sumar friccion al proceso.” Preserve the existing event-plus-phone uniqueness rule; add no device identity, ticket gate, or SMS verification.
8. **S8 — Real phone numbers.** “ahora por que solo podemos usar los numeros que me pasaste, vamos a poder usar numeros reales ?”.
9. **S9 — Draw animation.** “la animacion no quedo buena parece un semaforo una pantalla amarilla que onda con la que teniamos” and “la misma que usamos ese dia por ahora”. Both October events must use the existing Latino Night no-video animation until the user supplies replacement main-background and draw videos.
10. **S10 — Winner attendance decision.** “por otro lado necesito que tengamos un boton de show up/ draw again por si alguien  no se presenta y tenemos que resortear” and “Sí, usar ese flujo”. `Showed up` confirms and closes the prize; `Draw again` preserves an audit of the no-show, excludes them from the whole event, and reruns the same prize.

## Tasks

- [x] **T1 — S1–S6:** Preflight both exact DEV events, Keychain bindings, zero-entry/open-draw state, and capture an in-memory restoration snapshot. Route: parent inline. Evidence: both events had zero entries, one open draw, no winner timestamps, exact schedules, and matching Keychain token hashes.
- [x] **T2 — S1–S6:** Stage and run the visible day-30 rehearsal, then restore the original observable state. Route: parent inline. Evidence: QR registration, live count, countdown, draw, and winner completed with four authorized test entries; cleanup restored zero entries, the official schedule, open status, and no winner. S9 animation defect discovered.
- [x] **T3 — S9:** Configure both October events to use the existing Latino Night no-video animation and preserve that choice in the repeatable DEV configs. Route: parent inline. Evidence: expected two-assertion RED, then 3 focused files/41 tests GREEN; both DEV events safely updated while empty/open. Commit: `e5d4d21e`.
- [x] **T4 — S7:** Resolve the identity strength required for one-entry-per-person enforcement before proposing implementation. Route: Ask. Decision: preserve phone-only uniqueness and rely on physical event controls; no added friction.
- [ ] **T5 — S1–S6, S9:** Rerun visible tablet rehearsals for both days after the animation is accepted, then restore both events. Route: parent inline. Commit: operational evidence only.
- [ ] **T6 — S1–S6, S9:** Independently verify final DEV state and rehearsal outcomes. Route: `gentle-ai-verify`. Commit: operational evidence only.
- [x] **T7 — S10:** Resolve the durable no-show/redraw contract, including winner confirmation, no-show exclusion, audit retention, and same-prize reroll behavior. Route: Ask. Decision: exact-attempt audited flow accepted.
- [x] **T8 — S10:** Specify and implement durable draw attempts, guarded attendance actions, refresh-safe tablet controls, and same-prize reroll with event-wide no-show exclusion. Route: parent inline; independent verification completed for Risk items 1, 3, and 4. Delivery commits: `76c99e95`, `9d1cce99`, `d47a14c1`, `fdf3211e`. Verification found two compatibility blockers; both were corrected and pinned before closure.

## Log

- **L1:** “bien necesito que hagamos una prueba de esto a ver”
- **L2:** “quieor hacr un simulacro y verificar que todo va bien. que sale bien y que funciona bien”
- **L3:** “Los dos días”
- **L4:** “Sí, autorizo simulacro y limpieza”
- **L5:** “pero quiero ver como queda quiero ver como funciona en la tablet, ademas quiero ver el el contador tambien”
- **L6:** “Sí, cuenta regresiva de 10 minutos”
- **L7:** Day 30 was staged with two synthetic participants and a 10-minute countdown, then the 25-minute safety guard restored zero entries, the original schedule, open status, and no winner. The tablet observation and draw outcome were not reported before restoration.
- **L8:** “puedo escanearlo entonces para agregar participantes ?”
- **L9:** “bien si funciona hasta ahi esta bien ahora podemos saber quien escaneo con el telefono ? por que escanie con el mismo telefono y puse otro numero entonces puedo participar varias veces  como se puede evitar eso”
- **L10:** “naa dejemos ahi al final alguien se va a llevar el premio lo vamos a controlar mas de manera fisica tampoco quiero sumar friccion al proceso. ahora por que solo podemos usar los numeros que me pasaste, vamos a poder usar numeros reales ?”
- **L11:** “la animacion no quedo buena parece un semaforo una pantalla amarilla que onda con la que teniamos”
- **L12:** “la misma que usamos ese dia por ahora, voya  ver si en estos dias hago el video que va por detras tanto el principal como el que este para el sorteo.”
- **L13:** “por otro lado necesito que tengamos un boton de show up/ draw again por si alguien  no se presenta y tenemos que resortear”
- **L14:** “Sí, usar ese flujo”
