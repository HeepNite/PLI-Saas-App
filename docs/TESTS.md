# PLI — Tests

Guía específica de tests (unitarios, API y E2E).

## Unitarios / API (Vitest)

### Teléfonos
- `tests/phone.test.ts`
  - Normalización y formato US (E164 y display).
  - Casos inválidos y bordes.

### Checkout (validación)
- `tests/checkout.test.ts`
  - Validaciones puras del payload.
  - Reglas de participantes, servicio y formato.

### Checkout API
- `tests/api/checkout-intent.test.ts`
  - Ruta `/api/checkout/intent`.
  - Mocks de Stripe y validación del payload.
- `tests/api/checkout-session.test.ts`
  - Ruta `/api/checkout/session`.
  - Respuesta de URL de Stripe.

### Perfil del alumno
- `tests/profile-utils.test.ts`
  - Utilidades puras del perfil (fecha, % completado, prefill de booking).
- `tests/api/profile.test.ts`
  - `GET /api/profile` (auth, fetch de perfil, puntos).
  - `PUT /api/profile` (update, perfil completo, ledger de puntos).
  - JSON inválido.
- `tests/api/profile-avatar.test.ts`
  - `POST /api/profile/avatar` (auth, file missing, update OK).
  - Usa mock de Clerk `updateUserProfileImage`.

## E2E (Playwright)

### Flujo de inscripción
- `e2e/course-flow.spec.ts`
  - Modal de enrolamiento completo.
  - Selección de Stripe y apertura del modal de pago.

### Perfil alumno
- `e2e/profile.spec.ts`
  - Render de `/client-profile`.
  - Toggle del formulario de perfil (cerrar y abrir).
  - Apertura del selector de cursos desde el CTA.

## Cómo correr

```bash
# Unit/API
npm run test

# Específicos
npm run test -- tests/api/profile.test.ts
npm run test -- tests/api/profile-avatar.test.ts

# E2E
npm run test:e2e
npx playwright test e2e/profile.spec.ts
```
