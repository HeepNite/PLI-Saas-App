# PLI — Matriz de Tests

Guía rápida de cobertura actual (unit, API y E2E).

## 1. Unit/API (Vitest)

### 1.1 Core checkout/profile
- `tests/phone.test.ts`
- `tests/checkout.test.ts`
- `tests/profile-utils.test.ts`
- `tests/packages.test.ts`
- `tests/points-service.test.ts`
- `tests/api/checkout-intent.test.ts`
- `tests/api/checkout-session.test.ts`
- `tests/api/profile.test.ts`
- `tests/api/profile-avatar.test.ts`
- `tests/api/profile-packages.test.ts`
- `tests/api/profile-activity.test.ts`
- `tests/api/profile-points.test.ts`
- `tests/api/profile-bookings.test.ts`
- `tests/api/profile-bookings-assign.test.ts`
- `tests/api/profile-bookings-availability.test.ts`
- `tests/api/profile-bookings-reschedule.test.ts`
- `tests/api/profile-bookings-checkin.test.ts`
- `tests/api/profile-requests.test.ts`

### 1.2 QR check-in y puntos
- `tests/api/checkin-qr-new-student-verify.test.ts`
- `tests/api/checkin-qr-bootstrap.test.ts`
- `tests/api/checkin-qr-package.test.ts`
- `tests/api/checkin-qr-dropin.test.ts`

### 1.3 Staff (nuevo módulo)
- `tests/staff-role.test.ts`
- `tests/class-schedule.test.ts`
- `tests/api/staff-bootstrap.test.ts`
- `tests/api/staff-checkin.test.ts`
- `tests/api/staff-rooms.test.ts`
- `tests/api/staff-schedule.test.ts`
- `tests/api/staff-school.test.ts`
- `tests/api/staff-users.test.ts`
- `components/front/staff/__tests__/StaffUsersAdminClient.test.ts`

## 2. E2E (Playwright)
- `e2e/course-flow.spec.ts`
  - Render curso.
  - Enroll end-to-end hasta modal de pago.
- `e2e/profile.spec.ts`
  - Perfil, acciones sobre clases/paquetes y requests.
  - Reprogramación y validaciones UI.
- `e2e/checkin.spec.ts`
  - Render del flujo `/checkin`.
  - Apertura de login popup en “Ya soy cliente”.
  - Apertura de booking modal en “Soy nuevo”.
- `e2e/staff.spec.ts`
  - Render del terminal `/staff/checkin`.
  - Error de PIN inválido.
  - Redirect al aceptar PIN.

## 3. Estado de cobertura de lo nuevo
- QR check-in: cubierto en API/unit.
- Staff portal/API: cubierto en API/unit.
- Room management y conflicto de salas: cubierto en unit/API y component tests.
- Staff UI E2E: cobertura inicial del terminal PIN implementada.
- E2E dedicado de `/checkin`: cobertura inicial implementada.
- Pendiente E2E: panel completo `/staff/portal` (roles, school CRUD, requests, payments).

## 4. Comandos

```bash
# Suite completa unit/api
npm run test

# Suite completa e2e
npm run test:e2e

# QR check-in (api)
npm run test -- tests/api/checkin-qr-new-student-verify.test.ts tests/api/checkin-qr-bootstrap.test.ts tests/api/checkin-qr-package.test.ts tests/api/checkin-qr-dropin.test.ts

# Staff (api/unit)
npm run test -- tests/staff-role.test.ts tests/class-schedule.test.ts tests/api/staff-bootstrap.test.ts tests/api/staff-checkin.test.ts tests/api/staff-rooms.test.ts tests/api/staff-schedule.test.ts tests/api/staff-school.test.ts tests/api/staff-users.test.ts components/front/staff/__tests__/StaffUsersAdminClient.test.ts

# E2E puntuales
npm run test:e2e -- e2e/course-flow.spec.ts
npm run test:e2e -- e2e/profile.spec.ts
npm run test:e2e -- e2e/checkin.spec.ts
npm run test:e2e -- e2e/staff.spec.ts
```
