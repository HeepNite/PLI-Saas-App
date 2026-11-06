# SPEC - Staff Panel Charge Collected On A Tablet M2 Reader

## Status

`PHASE 1 IMPLEMENTED — PENDING DELIVERY`

## Objective

Front-desk staff need to charge a card from the staff panel and collect it on the
Stripe Terminal M2 reader paired with one of the studio tablets (Samsung Android or
iPad). Today every M2 payment is started by the student on the tablet; the panel can
only read results and settle cash by hand.

Owner request (verbatim, 2026-11-03):

> "Bien ahora necesito que retomemos el pago desde el panel. Necesito que veamos eso,
> que veamos cómo hacerlo: poder mandarlo a través de la app que tenemos, ya sea de
> Android o de iOS, o cómo lo vamos a hacer para poder hacer el pago con el tap to pay
> que tenemos con los M2."

Owner answer on what staff can charge (verbatim, 2026-11-03):

> "una combinacion de todas esas, a veces tengo clientes que me quieren comprar un
> paquete de clase y 5 clases sueltas, o tambien tengo clientes que ya apgaron pero
> quieren pagarle a un amigo entonces quiero tener la posibilidad de facilitar esos
> pagos tambien tengo clientes que pagan su clase y quieren comprar un paquete despues
> entonces eso tambien quiero pder hacer"

## Scope

### In scope

- S1. Staff build a charge in the panel from any combination of:
  - catalog items (packages and drop-in classes) at system prices, including
    quantities (example from the owner: one package plus 5 drop-in classes; drop-ins
    are undated credits, see D1);
  - outstanding items already shown as pending/debt in the panel;
  - a free amount with a staff-entered description, used to collect a debt or adjust a
    balance on site (see D3).
- S2. The paying card holder can pay a class for a friend (owner example: a client who
  already paid wants to pay for a friend). The friend gets no account (see D2).
- S3. A client who already paid for a class can buy a package later in a separate
  charge (owner example: "pagan su clase y quieren comprar un paquete despues").
- S4. Staff pick the target tablet; the charge appears on that tablet's
  `/staff/terminal` screen and is collected on its paired M2.
- S5. The panel shows the charge state (pending on tablet, paid, declined, cancelled,
  expired) without a manual refresh.
- S6. Staff can cancel a pending charge from the panel; the tablet can cancel it too.

### Out of scope

- Refunds and partial refunds.
- Server-driven Stripe readers (S700/WisePOS E). The M2 is Bluetooth/SDK-driven and
  cannot be driven from the server.
- iPhone Tap to Pay (separate change `openspec/changes/native-kiosk-tap-to-pay`).
- Changes to the native Android/iOS apps (the design target is to reuse the existing
  `startPreparedPurchase` bridge unchanged).
- Cash collection (already handled by the payments board).

## Context

- Base: `main` (production). `codex/develop` native code has diverged and is not the base.
- Existing M2 path on `main`: `POST /api/checkout/intent` issues a prepared native
  purchase reference bound to the issuing terminalId + sessionId with a 5-minute TTL
  (`lib/stripe/prepared-native-purchase.ts`); the web page hands it to the native app via
  `window.pliNativeBridge` (`startPreparedPurchase`); the PaymentIntent
  (`card_present`, flow `pli_prepared_native_m2_v1`) is created by
  `/api/kiosk/terminal/internal-purchase`; the Stripe webhook marks the Purchase paid.
- Reader-to-terminal assignment lives in `INTERNAL_PURCHASE_LIVE_TERMINALS` (env), not
  the database.
- The staff payments board refreshes by polling (`app/api/staff/payments/pulse`).

## Functional Requirements

- FR1. A charge has one payer (existing student account) and one or more line items.
  Each line item is for the payer, for an existing student account, or for a guest
  friend without an account (D2). Free amounts have no beneficiary.
- FR2. Catalog line items use the system price for that beneficiary (new-student,
  drop-in, package rules apply as today); staff cannot edit catalog prices.
- FR3. Outstanding line items reference the existing pending record and settle it when
  the charge is paid.
- FR4. The total collected on the M2 equals the sum of the line items.
- FR5. The charge is delivered only to the selected tablet while that tablet has an
  active terminal session; the tablet picks it up by polling (no push exists).
- FR6. When the charge is paid, each line item produces the same records the existing
  flows produce for that item (Purchase, PackagePurchase, attendance/credit), attributed
  to the beneficiary account; guest-friend items are recorded under the payer (D2).
- FR7. Declined, cancelled and expired charges create no paid records and remain visible
  in the panel.

## Constraints

- Reuse the existing prepared-native purchase pipeline, webhook fulfillment and native
  bridge; no new native app release.
- A database schema change is expected (pending charges per tablet); it must be
  specified in `design.md` before implementation.
- Keep the browser kiosk fallback working (QR card + cash).
- SMS verification flows are unchanged.

## Security Rules

- Only authenticated staff with role `owner` or `admin`, or role `staff` with category
  `front_desk` or `manager`, can create or cancel a charge (D4). `teacher`, `guest` and
  `partner` cannot.
- The tablet may only read and start charges addressed to its own terminal.
- Prices and totals are computed server-side; the client never submits amounts for
  catalog or outstanding items.
- Every create, cancel, payment and failure is audited with the staff user and terminal.
- Existing rate limits and terminal session checks stay in force.

## Acceptance Criteria

- [ ] Staff charge one package + 5 drop-ins for one student; the tablet shows the total;
      after a tap the panel shows paid and the student has the package and 5 drop-ins.
- [ ] Staff charge a class for a guest friend on a client's card; no account is created
      for the friend and the payment is recorded under the paying client as a guest item.
- [ ] A student with a paid class buys a package in a second charge.
- [ ] Staff charge a pending item from the panel; after payment it is no longer pending.
- [ ] Staff charge a free amount with a description; it appears in the panel history.
- [ ] A charge sent to the Samsung never appears on the iPad, and vice versa.
- [ ] Cancel from the panel removes the charge from the tablet before collection.
- [ ] A declined card leaves nothing paid and shows declined in the panel.

## Definition Of Done

- [ ] implementation matches accepted behavior
- [ ] relevant tests exist and pass
- [ ] unresolved ambiguity is documented

## Resolved Decisions

- D1. Drop-in classes bought from the panel are undated credits (owner, verbatim):

  > "Son cinco clases sueltas que se tienen que acreditar en el panel del estudiante.
  > Si yo, como estudiante, compro cinco clases sueltas, esas cinco se tienen que
  > habilitar en mi panel y yo, de ahí, lo puedo asignar. O cuando vaya a registrarme y
  > cargue mi teléfono, me tiene que ir descontando ese crédito si es que no tengo
  > paquete."

  Consequences:
  - N drop-ins become N undated credits on the beneficiary's account.
  - The student can assign them from their own panel.
  - At check-in by phone, a drop-in credit is consumed only when the student has no
    package; an active package is consumed first.
  - Analysis must decide whether these credits reuse the existing package-credit model
    (PackagePurchase / PackageUsageLedger, AssignClassesCard) or need a new record.

- D2. Paying a class for a friend never creates an account for the friend (owner,
  verbatim):

  > "Si un usuario le paga a un amigo o amiga la clase, ese amigo va a poder registrarse
  > después con el proceso normal cuando vaya a comprar otra clase, o cuando vaya a
  > comprar su propio paquete o lo que sea, si le gustó. Si no, no pasa nada, pero no
  > queremos agregar un trabajo extra, como tener que crearle una cuenta a esa persona
  > solamente porque un amigo le pagó la clase."

  Consequences:
  - The friend's class is a guest item recorded under the payer's account (the existing
    `Purchase.participants` field may carry this; analysis decides).
  - No phone, email or SMS step for the friend. Staff may optionally type the friend's
    name as a note (D7).
  - If the friend registers later through the normal flow, nothing is migrated.

- D3. The free amount exists to collect debts and adjust balances on site, with an
  amount staff can change (owner, verbatim):

  > "El monto libre es por si acaso quiero cobrarle alguna deuda, algo que necesite el
  > usuario, ¿no?, ya estando en el lugar."
  >
  > "Por ejemplo me pasó que un cliente tenía un paquete y fue agregando clases. Como no
  > podía pagar todavía con tarjeta, esas clases tampoco se las cobramos en ese momento.
  > Entonces el paquete, de pronto, pasó a ser un paquete de $150 más $60, $70 extra,
  > que eran de las clases que iba tomando por aparte de $10."
  >
  > "Por lo tanto necesito obtener la posibilidad de cambiar ese monto y cobrarlo."

  Consequences:
  - A free-amount line item requires a positive amount and a description, and is always
    tied to the payer's account.
  - Staff can enter any amount, including one that differs from what the system shows
    as owed (example: a $150 package plus $60–$70 of $10 extra classes).
  - Free amounts are audited with the staff user, amount and description.
  - When the debt is also tracked as outstanding items, staff can pick those items
    instead (FR3); the free amount covers what the system does not track.

- D4. Who can create and cancel charges. The question asked was: "¿Quiénes pueden crear
  y cancelar cobros desde el panel? Por ejemplo: solo owner y admin, o también los de
  front desk y manager." Owner answer (verbatim):

  > "También el front desk y los managers, si en caso hay"

  Allowed: `owner`, `admin`, and `staff` with category `front_desk` or `manager`
  (`lib/security/staff-role.ts`, `lib/security/staff-category.ts`). This includes free
  amounts (D3).

- D5. A pending charge expires after 10 minutes and can also be cancelled from the panel
  (owner, verbatim):

  > "Las dos opciones: que, si no lo compra nadie, se vence en 10 minutos (quizás sí, 10
  > minutos) y también que lo pueda cancelar alguien directamente desde el panel."

  Consequences:
  - A charge not paid within 10 minutes of creation becomes `expired`, leaves the tablet
    and stays visible in the panel as expired.
  - Staff with D4 permissions can cancel it from the panel at any time before payment.
  - The 10-minute window is separate from the existing 5-minute prepared-purchase
    reference TTL; the reference is issued only when collection starts on the tablet.
  - Open for design: what happens if the card tap is in progress at the 10-minute mark
    (collection must not be cut off mid-payment).

- D6. A staff charge takes over the tablet as soon as it arrives. The question asked was:
  "Si llega un cobro del staff mientras un alumno está usando la tablet, por ejemplo en
  medio de un check-in o una compra, ¿qué tiene que pasar?" Owner answer (verbatim):

  > "no no, si hay alguien en esa situacion por logica esa persona que esta siendo
  > cobrada por el admin esta frente a la tablet asi que nadie mas deberia estar usando
  > la tablet"

  Consequences:
  - The tablet shows the staff charge immediately, replacing whatever screen is open.
  - No queueing or "waiting for the tablet" state is needed.
  - After the charge ends (paid, declined, cancelled, expired), the tablet returns to the
    kiosk home screen.

- D7. Payroll and friend note (owner, verbatim):

  > "En estos dos no tiene nada que ver el cobro con la nómina del profe así que eso es
  > solamente ingreso y nota del amigo. Sí él puede escribir el nombre del amigo si es
  > necesario."

  Consequences:
  - Free-amount charges count as studio revenue only and never feed instructor payroll.
  - Staff may type an optional friend name note on a guest-friend item (D2).

## Open Questions

- Q1. RESOLVED 2026-11-03 — see "Resolved Decisions" D1.
- Q2. RESOLVED 2026-11-03 — see "Resolved Decisions" D2.
- Q3. RESOLVED 2026-11-03 — see "Resolved Decisions" D3.
- Q3b. RESOLVED 2026-11-03 — see "Resolved Decisions" D7.
- Q4. RESOLVED 2026-11-03 — see "Resolved Decisions" D4.
- Q5. RESOLVED 2026-11-03 — see "Resolved Decisions" D5.
- Q6. RESOLVED 2026-11-03 — see "Resolved Decisions" D6.
