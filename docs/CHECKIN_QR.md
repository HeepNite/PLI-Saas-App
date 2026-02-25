# QR Check-in (v1)

Guía funcional y técnica del flujo de check-in presencial por QR.

## 1. Objetivo
- Permitir check-in en establecimiento con compra rápida.
- Soportar dos caminos:
  - Alumno nuevo: compra regular y creación de cuenta.
  - Alumno existente: login rápido + recompra del curso actual cuando aplique.
- Registrar asistencia y sumar puntos de forma automática.

## 2. Entrada al flujo
- Página: `/checkin`
- Componente principal: `components/front/checkin/CheckInQrClient.tsx`
- Contexto esperado por query params:
  - `courseSlug`
  - `date` (YYYY-MM-DD)
  - `time` (HH:mm)
  - `durationMinutes` (opcional, default 60)

## 3. Reglas de ventana de check-in
- Definidas en `lib/checkin/qr.ts`.
- Abre 2 horas antes del inicio.
- Cierra 2 horas después del fin de la clase.
- Validación central:
  - `parseQrCheckInContext(...)`
  - `isQrCheckInWindowOpen(...)`

## 4. Selección dinámica del slot presencial
- En frontend, el flujo usa recomendación de clase activa/próxima con tolerancia de llegada tarde.
- Si existe un slot vigente o próximo para la familia del curso (por horario actual), se prioriza ese.
- Si no, usa el contexto recibido en el QR.
- El objetivo es ahorrar pasos y preseleccionar la clase correcta para atención presencial.

## 5. Flujos de usuario

### 5.1 Soy nuevo
- Botón: `Soy nuevo`.
- Abre el popup de compra (`EnrollModal`) en modo check-in nuevo:
  - `flowVariant="checkin-new"`
- Antes de pago se valida teléfono contra Clerk + DB:
  - `POST /api/checkin/qr/new-student/verify`
- Respuestas clave del verify:
  - `hasCompletedPurchase=true`: el teléfono ya tiene compras.
  - `requiresLogin=true`: no puede continuar como nuevo, debe loguear.
- Si tiene cuenta pero no compras previas, se permite continuar como nuevo.

### 5.2 Ya soy cliente
- Botón: `Ya soy cliente`.
- Si no hay sesión: popup de login (Clerk) por teléfono.
- Si hay sesión: bootstrap del curso actual.
- Endpoint:
  - `POST /api/checkin/qr/bootstrap`
- Resultado:
  - Si hay template de recompra del curso actual: botón `Recompra`.
  - Si no hay recompra del curso actual pero sí historial: compra regular del curso actual a precio regular.
  - Si no hay historial de compras: cae a compra tipo nuevo/regular según flujo.

## 6. Pago + check-in
- Pago con tarjeta inicia intent/finalización en checkout:
  - `/api/checkout/intent`
  - `/api/checkout/finalize`
- Luego check-in:
  - Con paquete activo: `POST /api/checkin/qr/package`
  - Sin paquete (drop-in pago): `POST /api/checkin/qr/dropin`
- Ambos endpoints:
  - Validan ventana activa.
  - Crean/actualizan `ClassSession` + `Attendance`.
  - Manejan puntos por hitos de asistencia consecutiva (reglas de puntos).

## 7. Endpoints del dominio QR
- `POST /api/checkin/qr/new-student/verify`
- `POST /api/checkin/qr/bootstrap`
- `POST /api/checkin/qr/package`
- `POST /api/checkin/qr/dropin`

## 8. Tests actuales
- `tests/api/checkin-qr-new-student-verify.test.ts`
- `tests/api/checkin-qr-bootstrap.test.ts`
- `tests/api/checkin-qr-package.test.ts`
- `tests/api/checkin-qr-dropin.test.ts`
- `tests/api/profile-bookings-checkin.test.ts`

## 9. Estado de cobertura
- Cobertura API/negocio: implementada.
- Cobertura E2E dedicada de `/checkin`: pendiente (recomendado para siguiente iteración).
