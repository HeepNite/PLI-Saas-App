# Payroll QA Questionnaire Reconstruction (Phase 1 → Inputs for Phase 2)

> Source note: This document was reconstructed from the user's manually answered checklist. The original exact questionnaire/cuestionario artifact was not found.
>
> Related artifacts reviewed for context: `docs/system/PAYROLL_PHASE1_CHECKLIST.md`, `docs/specs/payroll-flow-integrity-audit/integrity-report.md`, `openspec/changes/payroll-flow-integrity-audit/specs/payroll-integrity/spec.md`.

## Executive Summary

Payroll Phase 1 shows solid coverage in foundational admin flows (viewing payroll config, creating payment methods/models, assigning payroll model to staff, approving/rejecting change requests, and several refresh behaviors). However, key capability gaps remain in **edit flows**, **DAILY amount-paid computation/display**, and **attendance-to-payroll integration**. The highest-risk issue for Phase 2 is that **staff login can trigger check-in behavior**, contaminating attendance data used for payroll.

## Status Legend

- **PASS**: Confirmed working by user QA.
- **FAIL/BUG**: Confirmed malfunction or contradictory behavior.
- **NOT IMPLEMENTED**: User indicates feature/path does not exist yet.
- **NOT TESTED/UNKNOWN**: User could not test or lacked visibility.
- **NEEDS CLARIFICATION**: Functional intent/UI location unclear; requires product or UX clarification.

## Detailed QA Matrix

### 1) Panel de Métodos de Pago

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Owner can view Payroll Config panel | `[ si ] Owner puede ver el panel "Payroll Config"` | PASS |
| Existing methods are listed | `[ si ] Se listan los métodos de pago existentes (Bank Transfer, etc.)` | PASS |
| Method shows name/type/currency/status | `[ si ] Cada método muestra su nombre, tipo, moneda, estado (activo/inactivo)` | PASS |
| Config values visible without overflow cut | `[ si ] Se ven los valores de config (accountAlias, etc.) sin cortarse (overflow)` | PASS |
| Any value cut or outside panel | `[ no ] BUG? → ¿Algún valor aparece cortado o fuera del panel?` | PASS |

### 1.1) Crear/Editar Método de Pago

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Owner can create payment method | `[ si ] Owner puede crear nuevo método de pago` | PASS |
| Owner can edit existing method | `[ no ] Owner puede editar método existente` | FAIL/BUG |
| Changes save correctly | `[ no lo se, no se puede editar ] Los cambios se guardan correctamente` | NOT TESTED/UNKNOWN |
| List refreshes immediately after save | `[al crear si, editar no se puede ] Al guardar, la lista se actualiza inmediatamente (sin cache viejo)` | PASS (create) + FAIL/BUG (edit unavailable) |
| Old value still appears after save | `[ inchequeable ] BUG? → ¿Después de guardar sigue apareciendo el valor viejo?` | NOT TESTED/UNKNOWN |

### 1.2) Panel de Modelos de Pago

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Models are listed | `[ si, modelos, métodos, y currency] Se listan los modelos (Teachers ARS, etc.)` | PASS |
| Shows core fields (name/rate/currency/pay day/cap) | `[ si ] Muestra: nombre, hourly rate, moneda, día de pago, credit cap` | PASS |
| Shows linked default payment method | `[ no lo se deberías explicarme donde ver eso. ] Muestra el método de pago default vinculado` | NEEDS CLARIFICATION |
| Incorrect “Not set” when default exists | `[ deberías explicarme en que parte esta esto] BUG? → ¿El método default aparece como "Not set" cuando debería mostrar el nombre?` | NEEDS CLARIFICATION |

### 1.3) Crear/Editar Modelo

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Owner can create model | `[ si ] Owner puede crear nuevo modelo` | PASS |
| Owner can assign default payment method | `[ si ] Owner puede asignar método de pago default` | PASS |
| Owner can mark model as default | `[ si ] Owner puede marcar un modelo como default` | PASS |
| Changes persist correctly | `[no se puede editar ] Los cambios persisten correctamente` | PASS (create persistence observed) + FAIL/BUG (edit unavailable) |
| Old model info appears after create/edit | `[ crear si se puede y persiste si creo otro, no se puede editar ] BUG? → ¿Después de crear/editar el modelo, sigue apareciendo info vieja?` | PASS (create) + FAIL/BUG (edit unavailable) |

### 2) Asignación de Payroll a Staff (Owner/Admin)

#### 2.1) Staff Users Table

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Payroll Model column visible | `[ si ] Owner puede ver la columna "Payroll Model" en la tabla` | PASS |
| Assigned model or “Not set” shown | `[ si ] Muestra el modelo asignado a cada usuario (o "Not set")` | PASS |
| Owner can assign/change model | `[ si ] Owner puede clickear y asignar/cambiar modelo a un staff` | PASS |
| Change saves and reflects immediately | `[ si ] El cambio se guarda y se refleja inmediatamente` | PASS |
| Still shows old/Not set after assign | `[ no ] BUG? → ¿Después de asignar, sigue diciendo "Not set" o muestra el modelo viejo?` | PASS |

#### 2.2) Filters and Search

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Payroll Model filter works | `[ si ] Filtrar por "Payroll Model" funciona` | PASS |
| User search works combined with payroll filters | `[ esto no esta contemplado en ningún lado] Búsqueda de usuarios funciona combinado con filtros de payroll` | NOT IMPLEMENTED |
| Filters respect current payroll state | `[ si y también se cambian cuando se pide el cambio] BUG? → ¿Los filtros no respetan el estado actual de payroll?` | PASS |

### 3) Staff Viewing Own Payroll

#### 3.1) Mi Perfil

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Staff can see assigned payroll model | `[ si ] Staff puede ver su "Payroll Model" asignado` | PASS |
| Shows model name/rate/currency/payment method | `[ solo muestra el método de pago, no muestra nada mas ] Muestra: nombre del modelo, hourly rate, moneda, método de pago` | FAIL/BUG |
| Shows method config values (e.g., CBU) | `[ si, muestra los números y estas cubiertos como corresponde ] Si tiene método de pago con config (ej: CBU), lo muestra` | PASS |
| Wrong “No model assigned” despite model | `[ no ] BUG? → ¿Dice "No model assigned" cuando sí debería tener uno?` | PASS |

#### 3.2) Change Request (Payment Method)

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Staff can request payment method change | `[ si ] Staff puede solicitar cambio de método de pago` | PASS |
| Staff can choose among available methods | `[ si ] Puede elegir entre métodos disponibles` | PASS |
| After request appears as Pending approval | `[ si pero no muestra ningúnna notificación en el history request ] Al solicitar, queda "Pending approval"` | PASS + FAIL/BUG (history notification missing) |
| Request Change button does nothing | `[ no ] BUG? → ¿El botón de "Request Change" no hace nada?` | PASS |
| Request not shown as pending after submit | `[ si ] BUG? → ¿Después de solicitar, no aparece en estado pending?` | FAIL/BUG |

### 4) Approval of Requests (Owner/Admin)

#### 4.1) Requests Panel

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Request list visible | `[ si ] Owner/Admin puede ver lista de "Payment Change Requests"` | PASS |
| Shows staff, old→new method, date, status | `[ muestra el nombre la fecha y hora, el método al cual quiere cambiar pero no el anterior ] Muestra: nombre del staff, método anterior → nuevo, fecha, estado` | FAIL/BUG (previous method missing) |
| Can approve request | `[ si ] Puede aprobar un request` | PASS |
| Can reject request | `[ si ] Puede rechazar un request` | PASS |
| Status updates immediately on decision | `[ cambia pero por que puedo verlo en el staff no en el administrador no hay un lugar donde muestre el método en la tarjeta del alumno solo se muestra el modelo ] Al aprobar/rechazar, el estado cambia inmediatamente` | PASS + NEEDS CLARIFICATION (admin visibility of effective method) |
| Approve action fails/doesn't change status | `[ no ] BUG? → ¿Al aprobar, aparece error o no cambia el estado?` | PASS |
| Cross-school request leakage in list | `[ no ] BUG? → ¿Requests de otra escuela aparecen en la lista? (Riesgo de seguridad)` | PASS |
| Can approve request from another school | `[ no tenemos esta situación contemplada aun ] BUG? → ¿Se puede aprobar un request de otra escuela?` | NOT TESTED/UNKNOWN |

#### 4.2) Request Filters

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Pending/Approved/Rejected filters work | `[ si ] Filtrar por "Pending", "Approved", "Rejected" funciona` | PASS |
| Requests displayed in wrong status | `[ no ] BUG? → ¿Aparecen requests en estado incorrecto?` | PASS |

### 5) DAILY Card (Amount Paid)

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Staff sees daily Amount Paid | `[ no ] Staff ve su "Amount Paid" del día` | NOT IMPLEMENTED |
| Correct calculation (hours × hourly rate) | `[ no hay nada de esto ] El monto se calcula correctamente (horas × hourly rate)` | NOT IMPLEMENTED |
| Justified absences deducted | `[ no Hay nada de esto trabajado aun] Se descuentan ausencias justificadas` | NOT IMPLEMENTED |
| Late arrivals deducted | `[ no hay nada de esto ] Se descuentan llegadas tarde` | NOT IMPLEMENTED |
| Overtime added | `[ no hay nada de esto ] Se suman horas extra` | NOT IMPLEMENTED |
| Amount paid shown as 0 incorrectly | `[ si, no muestra nada ni el 0 solo -] BUG? → ¿Amount paid está en 0 cuando debería tener valor?` | FAIL/BUG |
| Incorrect amount math | `[ no hay nada ] BUG? → ¿El monto es incorrecto? (¿Calcula mal las horas?)` | NOT IMPLEMENTED |

#### 5.1) Calculation Breakdown

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Expand to see amount composition items | `[ no ] Al expandir/explorar, se ven los items que componen el monto` | NOT IMPLEMENTED |
| Shows base/adjustments/deductions | `[ solo muestra cuanto tiempo tiene loqueado y si esta actualmente loqueado o no ] Muestra: base por horas, ajustes por clase, deducciones` | NOT IMPLEMENTED |
| Missing items or non-summing values | `[ falta items e informaciónn] BUG? → ¿Faltan items? ¿Los valores no suman?` | FAIL/BUG |

### 6) Attendance Integration (Check-in/Check-out)

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Check-in records entry time | `[ no se registra hora de entrada solo si esta loqueado ademas hay otro error por que si entro por log-in me realiza el check in y no debería, log-in es solo para loguear en el panel de control del staff en este caso no para colocar como checkin si el usuario de repente entra desde su teléfono a chequear cuantas horas esta haciendo se ensucia la info por que cuenta como checkin] Staff hace check-in → se registra hora de entrada` | FAIL/BUG (critical contamination) |
| Check-out records exit time | `[ no solo el checkout y cuantas horas hizo] Staff hace check-out → se registra hora de salida` | FAIL/BUG (partial behavior only) |
| Worked hours feed payroll calculation | `[no, no muestra nada de eso ] Las horas trabajadas aparecen en el cálculo de payroll` | NOT IMPLEMENTED |
| Hours not added to DAILY amount | `[no se muestra nada ] BUG? → ¿Las horas no se suman al Amount paid de la DAILY?` | FAIL/BUG |

#### 6.1) Absences

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Absence can be marked | `[ no hay nada de eso aun] Si staff no va, se marca ausencia` | NOT IMPLEMENTED |
| Absence affects payroll deductions | `[ no hay nada de eso aun ] Ausencia se refleja en payroll (descuento correspondiente)` | NOT IMPLEMENTED |
| Justified absence has different treatment | `[ debería ] Ausencia justificada (con previo aviso) tiene tratamiento diferente` | NEEDS CLARIFICATION |
| Absences not reducing amount | `[ no hay anda de eso planteado aun] BUG? → ¿Las ausencias no restan del monto?` | NOT IMPLEMENTED |

### 7) Edge Cases and Validations

#### 7.1) Payment Method validations

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Cannot create method without name | `[ afirmativo ] No se puede crear método sin nombre` | PASS |
| Cannot create method without type | `[ afirmativo ] No se puede crear método sin tipo` | PASS |
| CBU must be valid format (22 digits AR) | `[ no lo pruebo aun igual no tenemos opción cbu trabajamos solo con mercado pago] CBU debe tener formato válido (22 dígitos en Argentina)` | NOT TESTED/UNKNOWN |
| Alias format validation | `[en elle funciona bien] Alias debe tener formato válido` | PASS |
| Invalid values accepted | `[ no ] BUG? → ¿Acepta valores inválidos? ¿No valida formatos?` | PASS |

#### 7.2) Payroll Model validations

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Hourly rate > 0 | `[ no lo se no tenemos información ] Hourly rate debe ser > 0` | NOT TESTED/UNKNOWN |
| Currency required | `[ no lo se no tenemos información ] Debe tener moneda seleccionada` | NOT TESTED/UNKNOWN |
| Valid pay day (1-7) | `[ no lo se no tenemos información ] Día de pago debe ser válido (1-7)` | NOT TESTED/UNKNOWN |
| Saves invalid/zero values | `[ no lo se no tenemos información ] BUG? → ¿Guarda con valores en 0 o inválidos?` | NOT TESTED/UNKNOWN |

#### 7.3) Permissions

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Staff cannot view Payroll Config | `[ si ] Staff NO puede ver Payroll Config (solo Owner)` | PASS |
| Admin cannot view Payroll Config (if owner-only) | `[ no lo probe aun todavía no estoy con eso ] Admin NO puede ver Payroll Config (si la UI es owner-only)` | NOT TESTED/UNKNOWN |
| Staff cannot approve own requests | `[ correcto ] Staff NO puede aprobar sus propios requests` | PASS |
| Staff/Admin see restricted data/actions | `[ por ahora no] BUG? → ¿Staff/Admin ven cosas que no deberían?` | PASS |
| Owner missing expected options | `[ si ] BUG? → ¿Owner no ve opciones que debería ver?` | FAIL/BUG |

### 8) Refresh & Fresh State (Cache)

| Checkpoint | User answer (preserved) | Status |
|---|---|---|
| Create method appears immediately | `[ si ] Crear método → aparece inmediatamente en la lista` | PASS |
| Edit method reflects without manual refresh | `[ no se puede editar ] Editar método → cambio visible sin refresh manual` | FAIL/BUG |
| Assign model to staff updates table without refresh | `[ si ] Asignar modelo a staff → aparece en tabla sin refresh` | PASS |
| Approve request updates without refresh | `[ si ] Aprobar request → cambia estado sin refresh` | PASS |
| Stale value until F5 required | `[ no ] BUG? → ¿Aparece el valor viejo hasta que hago F5?` | PASS |
| Two-tab synchronization behavior | `[ no probe esto ] BUG? → ¿En dos pestañas abiertas, no se sincroniza?` | NOT TESTED/UNKNOWN |

## Confirmed Working Items (PASS)

- Payroll Config visibility for Owner and rendering of payment methods/model lists.
- Payment method creation and immediate list refresh on create.
- Payroll model creation, default method assignment, and default model flagging.
- Staff payroll model assignment flow + table/filter consistency.
- Staff can request payment method changes; Owner/Admin can approve/reject.
- Request status filtering and most single-tab freshness behaviors.
- Core permission boundaries (staff blocked from payroll config and self-approval).

## Confirmed Bugs / Gaps (FAIL/BUG)

- Cannot edit payment methods.
- Cannot edit payroll models.
- Staff profile payroll info is incomplete (shows only payment method, not full model data).
- Request history/pending visibility inconsistency after submitting change request.
- Requests panel missing previous method in old→new traceability.
- Owner appears to be missing expected options in some payroll areas.
- DAILY Amount Paid UI shows `-`/missing value instead of computed amount.
- Calculation itemization is incomplete/missing expected payroll components.
- **Critical**: Login flow appears to trigger check-in, contaminating attendance data.
- Check-in/check-out data model appears partial/inconsistent (entry time not reliably recorded).

## Not Implemented Scope

- DAILY Amount Paid end-to-end: calculation, display, deductions, overtime, and breakdown.
- Attendance-to-payroll integration for worked hours.
- Absence capture and payroll impact logic.
- Combined user search + payroll filters behavior (reported as not contemplated).

## Untested / Unknown Cases

- Save behavior for edit flows (blocked by edit unavailability).
- Cross-school approval exploit scenario (explicitly not tested).
- CBU validation (22-digit format) in current Mercado Pago-focused usage.
- Payroll model numeric/business validations (hourly rate, currency required, pay day range).
- Admin visibility rule for Payroll Config.
- Two-tab synchronization behavior.

## Open Questions for Product / Engineering

1. Where should the linked default payment method be visible in Payroll Model UI (exact screen/column/component)?
2. Should Admin role be blocked from Payroll Config, or only some actions (read vs write)?
3. In Requests panel, is previous payment method mandatory for audit traceability and support workflows?
4. Should staff request history include explicit notification events, or is status-only sufficient?
5. What is the canonical separation between **authentication login** and **attendance check-in** events?
6. Should justified absences be modeled now in Phase 2, and what deduction policy applies?
7. Is DAILY card a strict MVP blocker for payroll rollout, or can it ship behind a feature flag?
8. Which source of truth should drive real-time refresh across tabs (polling, WS, or manual invalidation)?

## Recommended Phase 2 Priorities

1. **P0 — Data Integrity & Security**
   - Fix login-vs-check-in coupling immediately.
   - Enforce explicit attendance events independent from auth.
   - Validate school scoping for approvals (including adversarial tests for cross-school IDs).

2. **P0 — Core Payroll Computation Surface**
   - Implement DAILY Amount Paid computation pipeline and UI rendering.
   - Ensure worked hours feed payroll totals.
   - Provide transparent calculation breakdown (base/adjustments/deductions).

3. **P1 — Missing Editability / Operational UX**
   - Enable edit flows for payment methods and payroll models.
   - Complete traceability in requests (previous → new method visible).
   - Resolve owner-option visibility gaps.

4. **P1 — Rule Completeness**
   - Implement and test absence handling and justified-absence policy.
   - Add validation coverage for model/business constraints.

5. **P2 — Consistency & Observability**
   - Define two-tab synchronization strategy.
   - Add request-history UX signals and admin/staff visibility clarity.

---

Reconstruction intent: preserve user QA findings exactly while converting them into a structured requirements-style artifact for Payroll Phase 2 planning.
