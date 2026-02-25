# Staff Portal (v1)

Guía de arquitectura, permisos y rutas del nuevo módulo Staff.

## 1. Rutas web
- `/staff/sign-in`: login staff.
- `/staff/sign-up`: alta de usuario staff (si corresponde).
- `/staff/resolve`: resuelve rol/categoría y redirige según permisos.
- `/staff/setup`: onboarding inicial para primer owner/admin.
- `/staff/portal`: panel admin (users + school + schedule + requests + payments).
- `/staff/panel`: panel básico para staff no admin.
- `/staff/checkin`: terminal por PIN.
- `/staff/school/course/[slug]`: acceso directo a edición/preview de un curso del school canvas.

## 2. Roles y categorías
- Roles (`lib/security/staff-role.ts`):
  - `owner`
  - `admin`
  - `staff`
- Categorías (`lib/security/staff-category.ts`):
  - `front_desk`
  - `manager`
  - `teacher`
  - `guest_staff`
  - `partner`

## 3. Autorización
- Portal admin:
  - `authorizeStaffPortalRequest()` en `lib/security/staff-portal-auth.ts`.
  - Permite:
    - `owner`
    - `admin` con categoría `manager`
- Staff check-in API:
  - `authorizeStaffRequest()` en `lib/security/staff-auth.ts`.
  - Válido por:
    - Header `x-staff-token` (si `STAFF_CHECKIN_TOKEN` está definido), o
    - sesión Clerk con rol staff válido.

## 4. Endpoints principales staff

### 4.1 Bootstrap y acceso
- `POST /api/staff/bootstrap`
- `POST /api/staff/pin-auth`
- `POST /api/staff/checkin/pin`

### 4.2 Users admin
- `GET/POST /api/staff/users`
- `PATCH/DELETE /api/staff/users/[userId]`
- `GET/PATCH/DELETE /api/staff/users/[userId]/profile`
- `GET /api/staff/users/[userId]/performance`
- `POST /api/staff/users/[userId]/avatar`
- `POST /api/staff/users/[userId]/gallery-upload`

### 4.3 School config
- `GET/POST /api/staff/school/courses`
- `GET/POST /api/staff/school/packages`
- `GET/POST /api/staff/school/points-rules`
- `POST /api/staff/school/points-assign`

### 4.4 Schedule / requests / payments
- `GET /api/staff/schedule`
- `GET/POST /api/staff/requests`
- `PATCH /api/staff/requests/[requestId]`
- `GET /api/staff/payments`
- `PATCH /api/staff/payments/[purchaseId]`

### 4.5 Check-in operativo
- `POST /api/staff/checkin`

## 5. Terminal por PIN (staff/checkin)
- UI: `components/front/staff/StaffCheckInClient.tsx`.
- Endpoint: `POST /api/staff/checkin/pin`.
- Valida PIN de 4 dígitos contra hash en metadata de Clerk.
- Si valida:
  - actualiza presencia (`staffLastCheckInAt`, contador, estado online),
  - genera sign-in token Clerk,
  - redirige a `/staff/resolve`.

## 6. Tests actuales staff
- `tests/staff-role.test.ts`
- `tests/api/staff-bootstrap.test.ts`
- `tests/api/staff-checkin.test.ts`
- `tests/api/staff-schedule.test.ts`
- `tests/api/staff-school.test.ts`
- `tests/api/staff-users.test.ts`

## 7. Estado de cobertura
- API/servicios staff: cubiertos por Vitest.
- E2E visual del portal staff: pendiente (recomendado siguiente iteración).
