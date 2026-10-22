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
11. **S11 — Tablet access.** “que no se para que tanto lio con que sea privado si la tablet la manejo yo unicamente y no me da la ociopn de pegar nada”. Replace each October event's long operational key with a distinct six-digit PIN that can be typed manually while preserving event-scoped validation, cookies, and rate limiting.
12. **S12 — Prize authoring.** “pero deberia eso ser asi desde el principio. osea se tendria que agregar los premios que queramos”. The operator adds, edits, removes, and orders any desired prizes from the tablet before live drawing, then an explicit `Start raffle` action saves and permanently locks that event's displayed list.

## Tasks

- [x] **T1 — S1–S6:** Preflight both exact DEV events, Keychain bindings, zero-entry/open-draw state, and capture an in-memory restoration snapshot. Route: parent inline. Evidence: both events had zero entries, one open draw, no winner timestamps, exact schedules, and matching Keychain token hashes.
- [x] **T2 — S1–S6:** Stage and run the visible day-30 rehearsal, then restore the original observable state. Route: parent inline. Evidence: QR registration, live count, countdown, draw, and winner completed with four authorized test entries; cleanup restored zero entries, the official schedule, open status, and no winner. S9 animation defect discovered.
- [x] **T3 — S9:** Configure both October events to use the existing Latino Night no-video animation and preserve that choice in the repeatable DEV configs. Route: parent inline. Evidence: expected two-assertion RED, then 3 focused files/41 tests GREEN; both DEV events safely updated while empty/open. Commit: `e5d4d21e`.
- [x] **T4 — S7:** Resolve the identity strength required for one-entry-per-person enforcement before proposing implementation. Route: Ask. Decision: preserve phone-only uniqueness and rely on physical event controls; no added friction.
- [x] **T5 — S1–S6, S9–S10:** Rerun visible tablet rehearsals for both days after the animation is accepted, exercise `Draw`, `Draw again`, and `Showed up`, then restore both events. Route: parent inline. Evidence: after the initial expired windows and S11 access correction, day 30 proved two manual registrations, two durable `no_show` attempts, no-eligible refusal, a bounded reset, one `confirmed` attempt, and exact cleanup; day 31 proved `no_show` then `confirmed` and exact cleanup. Commit: operational evidence only.
- [x] **T6 — S1–S6, S9:** Independently verify final DEV state and rehearsal outcomes. Route: `gentle-ai-verify`. Evidence: final verifier returned READY with both independent events at zero entries/attempts, one clean editable draft, exact official schedules, explicit no-video animation, null winner/timestamps, route health, and setup eligibility. Commit: operational evidence only.
- [x] **T7 — S10:** Resolve the durable no-show/redraw contract, including winner confirmation, no-show exclusion, audit retention, and same-prize reroll behavior. Route: Ask. Decision: exact-attempt audited flow accepted.
- [x] **T8 — S10:** Specify and implement durable draw attempts, guarded attendance actions, refresh-safe tablet controls, and same-prize reroll with event-wide no-show exclusion. Route: parent inline; independent verification completed for Risk items 1, 3, and 4. Delivery commits: `76c99e95`, `9d1cce99`, `d47a14c1`, `fdf3211e`. Verification found two compatibility blockers; both were corrected and pinned before closure.
- [x] **T9 — S11:** Rotate both October DEV screen credentials to distinct random six-digit PINs, update their Keychain items, verify event isolation and old-key rejection without logging the PINs, and present them only in a local ephemeral macOS dialog. Route: parent inline. Evidence: both new PINs returned 302 for their own event; the day-30 PIN against day 31 and both retired keys returned 404; Keychain items were updated and the raw PINs appeared only in a five-minute local Mac dialog. Commit: `b4d0fff4`.
- [x] **T10 — S12:** Resolve when and where prizes are authored and locked. Route: Ask. Decision: edit the ordered list on the tablet before live drawing; an explicit `Start raffle` button atomically saves and permanently locks it.
- [x] **T11 — S12:** Implement revision-bound draft prize persistence, authenticated save/start API, screen-state setup contract, tablet ordering controls, and post-start lock with RED tests. Route: parent inline; independent verification completed for Risk items 1–4. Delivery commits: `06609b8c`, `78eb50b6`, `1c499fc6`, `04666e07`, `4f26d181`, `9b431205`. Verification found polling overwrite and missing ordered progression; both were corrected and pinned before closure.
- [x] **T12 — S12:** Deliver prize authoring through reviewable PR slices, convert both clean October placeholders to draft, visibly author/start multiple prizes, verify ordered progression, and restore official state. Route: parent inline. Evidence: PRs #699, #701, #705, #706, and #708 merged; day 31 visibly persisted three ordered prizes, locked with `Start raffle`, completed all three prizes with one `no_show` and three `confirmed` attempts, then guarded cleanup restored both events to clean editable drafts. Final independent verifier: READY. Commit: operational evidence only.

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
- **L15:** The first synchronized post-deployment rehearsal window expired without a draw on either event. Guarded cleanup removed two reserved entries per event, removed zero attempts, and restored both official schedules, open status, no winner, zero entries, and the accepted no-video animation. Visible `Draw again` / `Showed up` proof remains pending.
- **L16:** “necesito probar lo nuevo que armamos vamos con eos”
- **L17:** The second synchronized 10-minute countdown window also expired with both draws still `open` and zero attempts. Guarded cleanup again restored zero entries, zero attempts, no winner timestamps, and both official schedules. The next rehearsal should avoid another unattended wait and start unlocked once the user confirms the tablet is open.
- **L18:** The user selected another 10-minute countdown, but the third window also expired with both draws `open` and zero attempts. Cleanup was verified exact again. No fourth countdown window should be staged; the next mutation requires the tablet to be open and uses immediate unlock.
- **L19:** “vmos a probarlo ahora. dale ya lo tengo el 30”
- **L20:** “que no se para que tanto lio con que sea privado si la tablet la manejo yo unicamente y no me da la ociopn de pegar nada”
- **L21:** Selected “PIN corto de 6 dígitos (recomendado)”.
- **L22:** The immediately unlocked day-30 window expired with the draw still `open` and zero attempts after PIN rotation. Cleanup restored exact official state. The next staging requires confirmation that the PIN was accepted and `Draw` is visible before any mutation.
- **L23:** With the PIN accepted and `Draw` visible, the user manually registered two day-30 participants. Two consecutive redraws produced two durable `no_show` attempts and then correctly refused because no eligible entries remained. A bounded reset preserved the participants; the next draw was confirmed with `Showed up`, producing one `confirmed` attempt and `drawn` status before exact cleanup. Day 31 then produced `no_show` followed by `confirmed`; guarded cleanup remained pending.
- **L24:** “pero deberia eso ser asi desde el principio. osea se tendria que agregar los premios que queramos”
- **L25:** Selected “Desde la tablet antes de empezar (recomendado)” and then “Con un botón ‘Start raffle’”.
- **L26:** Day 31 guarded cleanup removed two reserved entries and two attempts with statuses `confirmed` and `no_show`, restoring its official schedule and empty state before prize-authoring delivery.
- **L27:** “ahora si guardo en el orden y los precios etan bien me equivoque yo”
- **L28:** The user visibly saved three ordered day-31 prizes, pressed `Start raffle`, and completed all three. Durable evidence showed prize 1 with `no_show` then `confirmed`, prizes 2–3 each `confirmed`, and event-wide exclusion consumed exactly four reserved entries. Guarded cleanup deleted only the four reserved entries, four attempts, and three rehearsal draws, then recreated the single official `draft` placeholder at `2026-11-01T04:00:00.000Z`.
- **L29:** Final independent verification returned READY: both October events have zero entries/attempts, one `draft` placeholder, no winner/timestamps, exact schedules, explicit empty `videoUrl`, healthy DEV routes, and eligible setup state.
